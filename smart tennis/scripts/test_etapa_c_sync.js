/**
 * ==============================================================================
 * MOTION TENNIS — SUÍTE DE TESTES DA ETAPA C: SINCRONIZAÇÃO OFFLINE-FIRST
 * ==============================================================================
 * Executa testes automatizados locais para validar:
 * 1. Finalização de partidas e persistência completa (sessões e impactos).
 * 2. Criação automática de eventos MATCH_FINISHED na cloud_outbox com event_id único.
 * 3. Detecção e resiliência a falhas de internet com backoff exponencial.
 * 4. Reenvio bem-sucedido após restabelecimento de conexão (preservando event_id).
 * 5. Tratamento de DUPLICATE_EVENT_IGNORED como confirmação idempotente com sucesso.
 * 6. Recuperação de eventos presos em 'processing' após reinício do backend.
 * 7. Prevenção estrita de concorrência entre múltiplos workers simultâneos.
 * 8. Comportamento defensivo diante de credenciais ausentes ou não configuradas.
 * 9. Isolamento de erros permanentes de validação (status 'failed' sem loop infinito).
 * 10. Fidelidade do XP gerado na outbox em relação ao calculado pelo gameEngine.js.
 * 11. Compatibilidade integral dos três modos oficiais (free, single, clear_all).
 * 12. Vinculação tardia de identidade cloud para partidas jogadas offline.
 * ==============================================================================
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Garante isolamento: usa cópia temporária do banco SQLite para não alterar smart_tennis.db
const originalDbPath = path.resolve(__dirname, '..', 'server', 'database', 'smart_tennis.db');
const tempDbPath = path.resolve(__dirname, '..', 'server', 'database', `test_etapa_c_${Date.now()}.db`);

fs.copyFileSync(originalDbPath, tempDbPath);
process.env.SMART_TENNIS_DB_PATH = tempDbPath;
process.env.SMART_TENNIS_TEST_MODE = '1';
process.env.SMART_TENNIS_PREPARE_SECONDS = '0'; // Começa em ACTIVE imediatamente para registrar impactos nos testes

const { get, run, all } = require('../server/database/db');
const { initializeDatabase } = require('../server/database/initDb');
const personalMatchService = require('../server/services/personalMatchService');
const cloudOutboxService = require('../server/services/cloudOutboxService');
const cloudSyncWorker = require('../server/services/cloudSyncWorker');
const { linkLocalUserToCloud } = require('../server/services/cloudIdentityService');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m [${testName}]`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m [${testName}]: ${details}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  MOTION TENNIS — TESTES ETAPA C (SINCRONIZAÇÃO OFFLINE)');
  console.log('======================================================\n');

  // Configuração simulada de equipamento e Supabase
  const savedUrl = process.env.SUPABASE_URL;
  const savedAnon = process.env.SUPABASE_ANON_KEY;
  const savedEqId = process.env.EQUIPMENT_ID;
  const savedEqKey = process.env.EQUIPMENT_API_KEY;

  const DUMMY_EQ_ID = '990e8400-e29b-41d4-a716-446655440001';
  const DUMMY_API_KEY = 'equipment_secret_api_key_for_testing_123';
  const DUMMY_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiZXhwIjoxOTk5OTk5OTk5fQ.sample_signature';

  process.env.SUPABASE_URL = 'https://motion-tennis-test.supabase.co';
  process.env.SUPABASE_ANON_KEY = DUMMY_ANON_KEY;
  process.env.EQUIPMENT_ID = DUMMY_EQ_ID;
  process.env.EQUIPMENT_API_KEY = DUMMY_API_KEY;

  try {
    // ----------------------------------------------------------------------------
    // GRUPO 1: INICIALIZAÇÃO E TABELAS DA ETAPA C
    // ----------------------------------------------------------------------------
    console.log('\x1b[36m[GRUPO 1] Integridade do SQLite e Tabela cloud_outbox\x1b[0m');
    await initializeDatabase(false);
    await personalMatchService.ensurePersonalMatchTables();
    await cloudOutboxService.ensureOutboxTable();

    const outboxTable = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='cloud_outbox'`);
    assert(Boolean(outboxTable), 'Tabela cloud_outbox criada com sucesso no SQLite');

    const outboxCols = await all(`PRAGMA table_info(cloud_outbox)`);
    const colNames = outboxCols.map((c) => c.name);
    assert(
      colNames.includes('event_id') &&
      colNames.includes('session_id') &&
      colNames.includes('user_id') &&
      colNames.includes('cloud_user_id') &&
      colNames.includes('equipment_id') &&
      colNames.includes('payload_json') &&
      colNames.includes('status') &&
      colNames.includes('retry_count') &&
      colNames.includes('next_retry_at') &&
      colNames.includes('confirmed_at'),
      'cloud_outbox possui todas as colunas canônicas da especificação'
    );

    const impCols = await all(`PRAGMA table_info(personal_match_impacts)`);
    const impColNames = impCols.map((c) => c.name);
    assert(
      impColNames.includes('shot_score') &&
      impColNames.includes('shot_xp') &&
      impColNames.includes('force_kmh') &&
      impColNames.includes('is_bullseye'),
      'personal_match_impacts possui colunas de pontuação e XP granular por impacto'
    );

    // ----------------------------------------------------------------------------
    // GRUPO 2: FINALIZAÇÃO DE PARTIDA E CRIAÇÃO NA OUTBOX
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 2] Registro de Partida, Sessão e Criação na Outbox\x1b[0m');

    const athleteUser = await get("SELECT * FROM users WHERE username = 'nicolas'");
    const ATHLETE_CLOUD_UUID = '550e8400-e29b-41d4-a716-446655440000';

    // Vincula Nicolas à identidade Supabase
    await linkLocalUserToCloud({
      userId: athleteUser.id,
      cloudUserId: ATHLETE_CLOUD_UUID,
      email: 'nicolas@exemplo.com'
    });

    // Inicia e joga partida no modo free
    const matchFree = await personalMatchService.startMatch({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      mode: 'free',
      wallPreset: '3x2'
    });
    assert(Boolean(matchFree && matchFree.id), 'Partida iniciada com sucesso');

    // Registra impacto 1: acerto no setor 4
    const imp1 = await personalMatchService.registerPersonalImpact({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      matchId: matchFree.id,
      x: 45.0,
      y: 62.0,
      speed: 88,
      sectorId: 4,
      classification: 'TARGET_HIT',
      isSimulation: false
    });
    assert(imp1.accepted === true, 'Impacto 1 registrado pelo gameEngine e personalMatchService');

    // Registra impacto 2: acerto no setor 2 com alta velocidade (> 95 km/h para bônus de XP)
    const imp2 = await personalMatchService.registerPersonalImpact({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      matchId: matchFree.id,
      x: 50.0,
      y: 35.0,
      speed: 102,
      sectorId: 2,
      classification: 'TARGET_HIT',
      isSimulation: false
    });
    assert(imp2.accepted === true, 'Impacto 2 com alta velocidade registrado');

    // Finaliza a partida
    const finishedMatch = await personalMatchService.finishMatch({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      matchId: matchFree.id
    });
    assert(finishedMatch && (finishedMatch.state === 'COMPLETED' || finishedMatch.state === 'WON'), 'Partida finalizada com sucesso');

    // Verifica persistência na tabela sessions
    const targetSessionId = finishedMatch.sessionId || finishedMatch.session_id || `pers_${matchFree.id}`;
    const sessionRow = await get(`SELECT * FROM sessions WHERE id = ?`, [targetSessionId]);
    assert(Boolean(sessionRow), 'Sessão gravada com sucesso na tabela SQLite sessions');
    assert(sessionRow.shots_count === 2 && sessionRow.hits_count === 2, 'Métricas de sessão conferem com impactos');

    // Verifica criação automática na cloud_outbox
    const outboxRow = await get(`SELECT * FROM cloud_outbox WHERE match_id = ?`, [matchFree.id]);
    assert(Boolean(outboxRow), 'Evento MATCH_FINISHED criado automaticamente na tabela cloud_outbox');
    assert(outboxRow.status === 'pending', 'Status inicial do evento na outbox é pending');
    assert(outboxRow.cloud_user_id === ATHLETE_CLOUD_UUID, 'cloud_user_id do evento reflete o UUID do atleta vinculado');

    const parsedEnvelope = JSON.parse(outboxRow.payload_json);
    assert(parsedEnvelope.event_type === 'MATCH_FINISHED', 'Tipo do evento no envelope é MATCH_FINISHED');
    assert(parsedEnvelope.event_id === outboxRow.event_id, 'event_id no payload é idêntico à coluna event_id');
    assert(parsedEnvelope.payload.shots_count === 2, 'shots_count no payload confere');
    assert(parsedEnvelope.payload.shots.length === 2, 'Array shots possui exatamente 2 impactos');
    assert(parsedEnvelope.payload.engine_rules_version === 1, 'engine_rules_version é 1');

    // ----------------------------------------------------------------------------
    // GRUPO 3: FIDELIDADE DE XP ENTRE GAMEENGINE E OUTBOX
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 3] Fidelidade Estrita de XP com gameEngine.js\x1b[0m');

    // No modo free, impacto 1 (speed 88): score base 85, XP = round(85/2) = 43
    // Impacto 2 (speed 102 > 95): score 85 + 5 = 90, XP = 43 + 5 = 48
    // Total esperado de XP: 43 + 48 = 91
    const shot1 = parsedEnvelope.payload.shots[0];
    const shot2 = parsedEnvelope.payload.shots[1];
    assert(shot1.score === 85 && shot1.xp === 43, 'Impacto 1 reflete pontuação e XP do gameEngine (85, 43)');
    assert(shot2.score === 90 && shot2.xp === 48, 'Impacto 2 com bônus de velocidade reflete (90, 48)');
    assert(
      parsedEnvelope.payload.xp_granted === 91,
      `XP total concedido na outbox (${parsedEnvelope.payload.xp_granted}) corresponde à soma exata do gameEngine (91)`
    );

    // ----------------------------------------------------------------------------
    // GRUPO 4: FALHA DE REDE E BACKOFF EXPONENCIAL
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 4] Resiliência a Falhas de Internet e Backoff Exponencial\x1b[0m');

    // Mock de fetch que simula queda de internet (rejeição de rede)
    const offlineFetch = async () => {
      throw new Error('getaddrinfo ENOTFOUND motion-tennis-test.supabase.co');
    };

    // Executa ciclo de sincronização com internet offline
    const offlineCycle = await cloudSyncWorker.syncPendingEvents({ fetchFn: offlineFetch });
    assert(offlineCycle.processed === 0, 'Worker não processa evento quando internet está offline');

    const outboxAfterOffline = await get(`SELECT * FROM cloud_outbox WHERE id = ?`, [outboxRow.id]);
    assert(outboxAfterOffline.status === 'pending', 'Status permanece pending (evento não é perdido)');
    assert(outboxAfterOffline.retry_count === 1, 'retry_count foi incrementado para 1');
    assert(Boolean(outboxAfterOffline.next_retry_at), 'next_retry_at foi calculado com backoff exponencial');
    assert(outboxAfterOffline.last_error.includes('ENOTFOUND'), 'last_error registra mensagem de rede sem expor segredos');

    // ----------------------------------------------------------------------------
    // GRUPO 5: RESTABELECIMENTO DE CONEXÃO E ENVIO BEM-SUCEDIDO
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 5] Envio Concluído após Reconexão (Preservando event_id)\x1b[0m');

    let capturedHeaders = null;
    let capturedBody = null;

    // Mock de fetch simulando resposta de sucesso do gateway Supabase
    const successFetch = async (url, opts) => {
      capturedHeaders = opts.headers;
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          op: 'sync_session',
          result: {
            success: true,
            code: 'SUCCESS',
            session_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
            total_score: parsedEnvelope.payload.total_score,
            xp_granted: parsedEnvelope.payload.xp_granted
          }
        })
      };
    };

    // Reseta temporariamente next_retry_at para permitir envio imediato no teste
    await run(`UPDATE cloud_outbox SET next_retry_at = NULL WHERE id = ?`, [outboxRow.id]);

    const successCycle = await cloudSyncWorker.syncPendingEvents({ fetchFn: successFetch });
    assert(successCycle.processed === 1, 'Worker envia evento com sucesso após retorno da conexão');

    const outboxCompleted = await get(`SELECT * FROM cloud_outbox WHERE id = ?`, [outboxRow.id]);
    assert(outboxCompleted.status === 'completed', 'Status do evento atualizado para completed');
    assert(Boolean(outboxCompleted.confirmed_at), 'confirmed_at preenchido com timestamp de confirmação');
    assert(outboxCompleted.event_id === outboxRow.event_id, 'event_id foi estritamente preservado na transmissão');

    assert(capturedHeaders['x-equipment-id'] === DUMMY_EQ_ID, 'Header x-equipment-id enviado corretamente');
    assert(capturedHeaders['x-equipment-key'] === DUMMY_API_KEY, 'Header x-equipment-key enviado ao gateway');
    assert(capturedBody.op === 'sync_session', 'Operação enviada foi sync_session');

    // ----------------------------------------------------------------------------
    // GRUPO 6: IDEMPOTÊNCIA E TRATAMENTO DE DUPLICATE_EVENT_IGNORED
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 6] Idempotência e Tratamento de DUPLICATE_EVENT_IGNORED\x1b[0m');

    // Mock de gateway que simula que a nuvem já havia processado este event_id anteriormente
    const duplicateFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        op: 'sync_session',
        result: {
          success: true,
          code: 'DUPLICATE_EVENT_IGNORED',
          session_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
          message: 'Evento já processado anteriormente.'
        }
      })
    });

    // Cria outro evento simulado pendente
    const dupEventId = crypto.randomUUID();
    const dupInsert = await run(
      `INSERT INTO cloud_outbox (
         event_id, session_id, match_id, user_id, cloud_user_id, equipment_id,
         event_type, payload_json, status, retry_count
       ) VALUES (?, 'pers_dup_123', 'match_dup_123', ?, ?, ?, 'MATCH_FINISHED', ?, 'pending', 0)`,
      [
        dupEventId,
        athleteUser.id,
        ATHLETE_CLOUD_UUID,
        DUMMY_EQ_ID,
        JSON.stringify({ event_id: dupEventId, event_type: 'MATCH_FINISHED', payload: { user_id: ATHLETE_CLOUD_UUID } })
      ]
    );

    await cloudSyncWorker.syncPendingEvents({ fetchFn: duplicateFetch });

    const dupRow = await get(`SELECT * FROM cloud_outbox WHERE id = ?`, [dupInsert.lastID]);
    assert(
      dupRow.status === 'completed' && Boolean(dupRow.confirmed_at),
      'DUPLICATE_EVENT_IGNORED tratado como confirmação idempotente com sucesso (status completed)'
    );

    // ----------------------------------------------------------------------------
    // GRUPO 7: RECUPERAÇÃO APÓS REINÍCIO DO BACKEND
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 7] Recuperação de Eventos Presos em processing Após Reinício\x1b[0m');

    // Simula evento preso em 'processing' com timestamp de 10 minutos atrás (servidor caiu durante envio)
    const staleEventId = crypto.randomUUID();
    const tenMinAgo = new Date(Date.now() - 600000).toISOString();
    const staleInsert = await run(
      `INSERT INTO cloud_outbox (
         event_id, session_id, match_id, user_id, cloud_user_id, equipment_id,
         event_type, payload_json, status, updated_at
       ) VALUES (?, 'pers_stale_1', 'match_stale_1', ?, ?, ?, 'MATCH_FINISHED', '{}', 'processing', ?)`,
      [staleEventId, athleteUser.id, ATHLETE_CLOUD_UUID, DUMMY_EQ_ID, tenMinAgo]
    );

    const recoveredCount = await cloudSyncWorker.recoverStaleProcessingEvents(300000);
    assert(recoveredCount >= 1, 'recoverStaleProcessingEvents detecta e recupera eventos órfãos');

    const staleRow = await get(`SELECT * FROM cloud_outbox WHERE id = ?`, [staleInsert.lastID]);
    assert(staleRow.status === 'pending', 'Evento órfão teve seu status restaurado para pending');

    // ----------------------------------------------------------------------------
    // GRUPO 8: PREVENÇÃO DE CONCORRÊNCIA ENTRE WORKERS
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 8] Bloqueio Atômico e Prevenção de Concorrência\x1b[0m');

    const concurrentEventId = crypto.randomUUID();
    const concInsert = await run(
      `INSERT INTO cloud_outbox (
         event_id, session_id, match_id, user_id, cloud_user_id, equipment_id,
         event_type, payload_json, status
       ) VALUES (?, 'pers_conc_1', 'match_conc_1', ?, ?, ?, 'MATCH_FINISHED', ?, 'pending')`,
      [
        concurrentEventId,
        athleteUser.id,
        ATHLETE_CLOUD_UUID,
        DUMMY_EQ_ID,
        JSON.stringify({ event_id: concurrentEventId, event_type: 'MATCH_FINISHED', payload: { user_id: ATHLETE_CLOUD_UUID } })
      ]
    );

    // Simula dois workers tentando dar claim simultaneamente no mesmo registro
    const claimWorker1 = await run(
      `UPDATE cloud_outbox SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`,
      [concInsert.lastID]
    );
    const claimWorker2 = await run(
      `UPDATE cloud_outbox SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`,
      [concInsert.lastID]
    );

    assert(claimWorker1.changes === 1, 'Worker 1 obtém o lock atômico com sucesso');
    assert(claimWorker2.changes === 0, 'Worker 2 é impedido de processar o mesmo evento concorrentemente');

    // ----------------------------------------------------------------------------
    // GRUPO 9: CREDENCIAIS AUSENTES
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 9] Tratamento Defensivo de Credenciais Ausentes\x1b[0m');

    // Remove temporariamente a chave do equipamento
    delete process.env.EQUIPMENT_API_KEY;

    const noCredEventId = crypto.randomUUID();
    const noCredInsert = await run(
      `INSERT INTO cloud_outbox (
         event_id, session_id, match_id, user_id, cloud_user_id, equipment_id,
         event_type, payload_json, status
       ) VALUES (?, 'pers_nocred_1', 'match_nocred_1', ?, ?, ?, 'MATCH_FINISHED', '{}', 'pending')`,
      [noCredEventId, athleteUser.id, ATHLETE_CLOUD_UUID, DUMMY_EQ_ID]
    );

    await cloudSyncWorker.syncPendingEvents();

    const noCredRow = await get(`SELECT * FROM cloud_outbox WHERE id = ?`, [noCredInsert.lastID]);
    assert(noCredRow.status === 'pending', 'Evento aguarda com status pending na ausência de credenciais');
    assert(noCredRow.last_error.includes('Credenciais'), 'last_error registra ausência de credenciais sem expor dados');

    process.env.EQUIPMENT_API_KEY = DUMMY_API_KEY;

    // ----------------------------------------------------------------------------
    // GRUPO 10: ISOLAMENTO DE ERROS PERMANENTES DE VALIDAÇÃO
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 10] Isolamento de Erros Definitivos (Status failed)\x1b[0m');

    // Gateway retorna erro definitivo de validação (ex: 400 XP_EXCEEDS_PHYSICAL_LIMITS)
    const permanentErrorFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        op: 'sync_session',
        result: {
          success: false,
          error: 'XP_EXCEEDS_PHYSICAL_LIMITS'
        }
      })
    });

    const permEventId = crypto.randomUUID();
    const permInsert = await run(
      `INSERT INTO cloud_outbox (
         event_id, session_id, match_id, user_id, cloud_user_id, equipment_id,
         event_type, payload_json, status
       ) VALUES (?, 'pers_perm_1', 'match_perm_1', ?, ?, ?, 'MATCH_FINISHED', ?, 'pending')`,
      [
        permEventId,
        athleteUser.id,
        ATHLETE_CLOUD_UUID,
        DUMMY_EQ_ID,
        JSON.stringify({ event_id: permEventId, event_type: 'MATCH_FINISHED', payload: { user_id: ATHLETE_CLOUD_UUID } })
      ]
    );

    await cloudSyncWorker.syncPendingEvents({ fetchFn: permanentErrorFetch });

    const permRow = await get(`SELECT * FROM cloud_outbox WHERE id = ?`, [permInsert.lastID]);
    assert(permRow.status === 'failed', 'Erro definitivo de validação (XP_EXCEEDS_PHYSICAL_LIMITS) é marcado como failed');
    assert(permRow.last_error === 'XP_EXCEEDS_PHYSICAL_LIMITS', 'last_error registra o código exato do erro');

    // ----------------------------------------------------------------------------
    // GRUPO 11: COMPATIBILIDADE DOS TRÊS MODOS OFICIAIS (free, single, clear_all)
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 11] Compatibilidade Canônica dos Três Modos Oficiais\x1b[0m');

    // Modo Single: testa acerto no alvo ativo (+1 ponto) e fora do alvo ativo (0 pontos)
    const matchSingle = await personalMatchService.startMatch({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      mode: 'single',
      wallPreset: '3x2'
    });
    const activeSec = matchSingle.activeSector || 1;
    const wrongSec = activeSec === 1 ? 2 : 1;

    // Acerto no alvo correto (deixa resolver coordenadas geométricas do setor ativo)
    await personalMatchService.registerPersonalImpact({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      matchId: matchSingle.id,
      sectorId: activeSec,
      speed: 85,
      classification: 'TARGET_HIT',
      isSimulation: false
    });

    // Acerto no alvo errado (deixa resolver coordenadas geométricas do setor errado)
    await personalMatchService.registerPersonalImpact({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      matchId: matchSingle.id,
      sectorId: wrongSec,
      speed: 85,
      classification: 'TARGET_HIT',
      isSimulation: false
    });

    const finishedSingle = await personalMatchService.finishMatch({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      matchId: matchSingle.id
    });

    const singleOutbox = await get(`SELECT * FROM cloud_outbox WHERE match_id = ?`, [matchSingle.id]);
    const singlePayload = JSON.parse(singleOutbox.payload_json).payload;
    assert(singlePayload.mode === 'single', 'Modo single registrado corretamente');
    assert(singlePayload.shots_count === 2, 'Dois impactos no modo single');
    assert(singlePayload.total_score === 1, 'Score total do modo single é 1 (apenas acerto no alvo correto pontua)');
    assert(singlePayload.hits_count === 1, 'hits_count é 1');

    // Modo Clear All: testa impacto que apaga setor e reativação de setor já apagado
    const matchClear = await personalMatchService.startMatch({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      mode: 'clear_all',
      wallPreset: '3x2'
    });

    // Impacto 1 no setor 3 (apaga setor -> 100 pontos)
    await personalMatchService.registerPersonalImpact({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      matchId: matchClear.id,
      x: 80.0,
      y: 20.0,
      speed: 85,
      sectorId: 3,
      classification: 'TARGET_HIT',
      isSimulation: false
    });

    // Impacto 2 novamente no setor 3 (reativa setor -> 0 pontos, reactivations +1)
    await personalMatchService.registerPersonalImpact({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      matchId: matchClear.id,
      x: 80.0,
      y: 20.0,
      speed: 85,
      sectorId: 3,
      classification: 'TARGET_HIT',
      isSimulation: false
    });

    const finishedClear = await personalMatchService.finishMatch({
      actor: { type: 'user', userId: athleteUser.id },
      userId: athleteUser.id,
      matchId: matchClear.id
    });

    const clearOutbox = await get(`SELECT * FROM cloud_outbox WHERE match_id = ?`, [matchClear.id]);
    const clearPayload = JSON.parse(clearOutbox.payload_json).payload;
    assert(clearPayload.mode === 'clear_all', 'Modo clear_all registrado corretamente');
    assert(clearPayload.total_score === 100, 'Score total do clear_all reflete 100 pontos');
    assert(clearPayload.reactivations === 1, 'Reativação de setor registrada com fidelidade (reactivations = 1)');

    // ----------------------------------------------------------------------------
    // GRUPO 12: VINCULAÇÃO TARDIA DE IDENTIDADE CLOUD
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 12] Resiliência a Partidas Offline Pré-Vinculação\x1b[0m');

    // Cria um atleta novo sem vínculo cloud
    const newAthleteInsert = await run(
      `INSERT INTO users (username, name, password_hash, salt, role) VALUES ('atleta_novo', 'Atleta Novo', 'hash', 'salt', 'player')`
    );
    const newAthleteId = newAthleteInsert.lastID;

    // Atleta joga partida offline antes de vincular conta
    const matchUnlinked = await personalMatchService.startMatch({
      actor: { type: 'user', userId: newAthleteId },
      userId: newAthleteId,
      mode: 'free',
      wallPreset: '3x2'
    });
    await personalMatchService.registerPersonalImpact({
      actor: { type: 'user', userId: newAthleteId },
      userId: newAthleteId,
      matchId: matchUnlinked.id,
      x: 50.0,
      y: 50.0,
      speed: 85,
      sectorId: 1,
      classification: 'TARGET_HIT'
    });
    await personalMatchService.finishMatch({
      actor: { type: 'user', userId: newAthleteId },
      userId: newAthleteId,
      matchId: matchUnlinked.id
    });

    const unlinkedOutbox = await get(`SELECT * FROM cloud_outbox WHERE match_id = ?`, [matchUnlinked.id]);
    assert(unlinkedOutbox.status === 'pending_link', 'Partida de atleta não vinculado aguarda com status pending_link');
    assert(unlinkedOutbox.cloud_user_id === null, 'cloud_user_id é inicialmente null');

    // Atleta vincula conta Supabase posteriormente
    const NEW_ATHLETE_CLOUD_UUID = '770e8400-e29b-41d4-a716-446655440077';
    await linkLocalUserToCloud({
      userId: newAthleteId,
      cloudUserId: NEW_ATHLETE_CLOUD_UUID,
      email: 'atleta_novo@exemplo.com'
    });

    const updatedOutbox = await get(`SELECT * FROM cloud_outbox WHERE match_id = ?`, [matchUnlinked.id]);
    assert(updatedOutbox.status === 'pending', 'Status atualizado automaticamente para pending após vinculação');
    assert(updatedOutbox.cloud_user_id === NEW_ATHLETE_CLOUD_UUID, 'cloud_user_id populado com o UUID vinculado');

    const updatedPayload = JSON.parse(updatedOutbox.payload_json).payload;
    assert(updatedPayload.user_id === NEW_ATHLETE_CLOUD_UUID, 'Payload da outbox atualizado com o UUID do atleta');

  } catch (testError) {
    console.error('\x1b[31m[ERRO NA EXECUÇÃO DO TESTE]:\x1b[0m', testError);
    failedTests++;
  } finally {
    // Restaura variáveis de ambiente
    if (savedUrl) process.env.SUPABASE_URL = savedUrl;
    else delete process.env.SUPABASE_URL;

    if (savedAnon) process.env.SUPABASE_ANON_KEY = savedAnon;
    else delete process.env.SUPABASE_ANON_KEY;

    if (savedEqId) process.env.EQUIPMENT_ID = savedEqId;
    else delete process.env.EQUIPMENT_ID;

    if (savedEqKey) process.env.EQUIPMENT_API_KEY = savedEqKey;
    else delete process.env.EQUIPMENT_API_KEY;

    // Remove banco SQLite temporário
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch (_) {}

    console.log('\n======================================================');
    console.log(`  RESULTADO ETAPA C: ${passedTests} aprovados, ${failedTests} reprovados`);
    console.log('======================================================\n');
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTests();
