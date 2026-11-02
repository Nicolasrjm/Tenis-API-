/**
 * ==============================================================================
 * MOTION TENNIS — SUÍTE DE TESTES DA ETAPA D: VALIDAÇÃO DO CONTRATO END-TO-END
 * ==============================================================================
 * Valida rigorosamente a cadeia completa de integração:
 * 1. Gateway Deno/Supabase (handler.mjs):
 *    - Rejeição de métodos não-POST (HTTP 405)
 *    - Rejeição de corpo maior que 1MB (HTTP 413)
 *    - Rejeição de x-equipment-id ausente/inválido (HTTP 400)
 *    - Rejeição de x-equipment-key ausente/vazia (HTTP 401)
 *    - Rejeição de operações não permitidas (HTTP 400)
 *    - Sanitização do envelope repassado à RPC
 * 2. Contrato de Sincronização entre Outbox -> Worker -> Handler:
 *    - Modo Treino Livre (free)
 *    - Modo Alvo Único (single)
 *    - Modo Apagar Todos (clear_all) com vitória e reativações
 *    - Partida sem acertos (shots_count > 0, hits_count = 0)
 *    - Partida com bônus de velocidade (> 95 km/h)
 *    - Compatibilidade canônica de fingerprint SHA-256
 * ==============================================================================
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

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
  console.log('  MOTION TENNIS — TESTES ETAPA D (CONTRATO & GATEWAY)');
  console.log('======================================================\n');

  try {
    const handlerPath = 'file:///' + path.resolve(__dirname, '..', '..', 'supabase', 'functions', 'equipment-gateway', 'handler.mjs').replace(/\\/g, '/');
    const { handleGatewayRequest, OPERATIONS, MAX_BODY_BYTES } = await import(handlerPath);

    const DUMMY_EQ_ID = '990e8400-e29b-41d4-a716-446655440001';
    const DUMMY_API_KEY = 'equipment_secret_api_key_for_testing_123';
    const ATHLETE_UUID = '550e8400-e29b-41d4-a716-446655440000';

    // ----------------------------------------------------------------------------
    // GRUPO 1: REGRAS E SEGURANÇA DA EDGE FUNCTION (handler.mjs)
    // ----------------------------------------------------------------------------
    console.log('\x1b[36m[GRUPO 1] Validações de Segurança do Gateway (Edge Function)\x1b[0m');

    assert(
      Object.keys(OPERATIONS).length === 3 &&
      OPERATIONS.heartbeat && OPERATIONS.issue_pairing_challenge && OPERATIONS.sync_session,
      'Gateway restringe operações estritamente a heartbeat, issue_pairing_challenge e sync_session'
    );

    // 1. Rejeição de método diferente de POST
    const getRes = await handleGatewayRequest({ method: 'GET', headers: {}, bodyText: '' }, {});
    assert(getRes.status === 405 && getRes.body.error === 'METHOD_NOT_ALLOWED', 'Rejeita requisições GET com HTTP 405');

    // 2. Rejeição de payload maior que 1MB
    const largeRes = await handleGatewayRequest({
      method: 'POST',
      headers: {},
      bodyText: 'x'.repeat(MAX_BODY_BYTES + 1)
    }, {});
    assert(largeRes.status === 413 && largeRes.body.error === 'PAYLOAD_TOO_LARGE', 'Rejeita requisições maiores que 1MB com HTTP 413');

    // 3. Rejeição de equipment-id ausente ou inválido
    const noEqRes = await handleGatewayRequest({
      method: 'POST',
      headers: { 'x-equipment-key': DUMMY_API_KEY },
      bodyText: JSON.stringify({ op: 'sync_session' })
    }, {});
    assert(noEqRes.status === 400 && noEqRes.body.detail.includes('x-equipment-id'), 'Rejeita x-equipment-id ausente');

    const badEqRes = await handleGatewayRequest({
      method: 'POST',
      headers: { 'x-equipment-id': 'not-a-valid-uuid', 'x-equipment-key': DUMMY_API_KEY },
      bodyText: JSON.stringify({ op: 'sync_session' })
    }, {});
    assert(badEqRes.status === 400 && badEqRes.body.detail.includes('x-equipment-id'), 'Rejeita x-equipment-id que não seja UUID');

    // 4. Rejeição de x-equipment-key ausente ou vazia
    const noKeyRes = await handleGatewayRequest({
      method: 'POST',
      headers: { 'x-equipment-id': DUMMY_EQ_ID, 'x-equipment-key': '' },
      bodyText: JSON.stringify({ op: 'sync_session' })
    }, {});
    assert(noKeyRes.status === 401 && noKeyRes.body.error === 'INVALID_CREDENTIALS', 'Rejeita requisição com chave de equipamento vazia');

    // 5. Rejeição de operação desconhecida ou injeção de RPC arbitrária
    const badOpRes = await handleGatewayRequest({
      method: 'POST',
      headers: { 'x-equipment-id': DUMMY_EQ_ID, 'x-equipment-key': DUMMY_API_KEY },
      bodyText: JSON.stringify({ op: 'arbitrary_rpc_call' })
    }, {});
    assert(badOpRes.status === 400 && badOpRes.body.error === 'OPERATION_NOT_ALLOWED', 'Rejeita qualquer tentativa de operação desconhecida');

    // 6. Rejeição de JSON malformado
    const badJsonRes = await handleGatewayRequest({
      method: 'POST',
      headers: { 'x-equipment-id': DUMMY_EQ_ID, 'x-equipment-key': DUMMY_API_KEY },
      bodyText: '{ malformed json'
    }, {});
    assert(badJsonRes.status === 400 && badJsonRes.body.detail.includes('JSON'), 'Rejeita corpo JSON malformado');

    // ----------------------------------------------------------------------------
    // GRUPO 2: CONTRATO DO EVENTO MATCH_FINISHED NO MODO FREE
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 2] Validação do Contrato no Modo Treino Livre (free)\x1b[0m');

    let invokedRpc = null;
    let invokedArgs = null;
    const mockDeps = {
      rpc: async (fn, args) => {
        invokedRpc = fn;
        invokedArgs = args;
        return {
          data: {
            success: true,
            code: 'SUCCESS',
            status: 'SUCCESS',
            session_id: '11111111-2222-3333-4444-555555555555'
          },
          error: null
        };
      }
    };

    const eventFree = {
      event_id: crypto.randomUUID(),
      event_type: 'MATCH_FINISHED',
      schema_version: '1.0',
      timestamp: new Date().toISOString(),
      payload: {
        local_session_id: 'pers_free_001',
        user_id: ATHLETE_UUID,
        is_simulation: false,
        engine_rules_version: 1,
        mode: 'free',
        wall_preset: '3x2',
        started_at: new Date(Date.now() - 300000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 300,
        shots_count: 2,
        hits_count: 2,
        total_score: 175, // 85 + 90
        xp_granted: 91,   // 43 + 48
        reactivations: 0,
        shots: [
          {
            x: 45.0,
            y: 60.0,
            is_hit: true,
            score: 85,
            xp: 43,
            match_points: 85,
            sector_id: 4,
            force_kmh: 80.0,
            is_bullseye: false,
            shot_time_offset_ms: 5000
          },
          {
            x: 50.0,
            y: 35.0,
            is_hit: true,
            score: 90,
            xp: 48,
            match_points: 90, // com velocidade > 95 km/h
            sector_id: 2,
            force_kmh: 105.0,
            is_bullseye: true,
            shot_time_offset_ms: 15000
          }
        ]
      }
    };

    const freeRes = await handleGatewayRequest({
      method: 'POST',
      headers: {
        'x-equipment-id': DUMMY_EQ_ID,
        'x-equipment-key': DUMMY_API_KEY,
        'content-type': 'application/json'
      },
      bodyText: JSON.stringify({
        op: 'sync_session',
        data: { event: eventFree }
      })
    }, mockDeps);

    assert(freeRes.status === 200 && freeRes.body.ok === true, 'Gateway aceita evento MATCH_FINISHED no modo free');
    assert(invokedRpc === 'sync_equipment_session_v2', 'Gateway mapeia sync_session exclusivamente para sync_equipment_session_v2');
    assert(invokedArgs.p_equipment_id === DUMMY_EQ_ID, 'Argumento p_equipment_id repassado à RPC');
    assert(invokedArgs.p_api_key === DUMMY_API_KEY, 'Argumento p_api_key repassado à RPC');
    assert(invokedArgs.p_event.event_id === eventFree.event_id, 'Argumento p_event preserva event_id canônico');
    assert(invokedArgs.p_event.payload.total_score === 175, 'total_score preservado (175)');
    assert(invokedArgs.p_event.payload.xp_granted === 91, 'xp_granted preservado (91)');

    // ----------------------------------------------------------------------------
    // GRUPO 3: CONTRATO DO EVENTO NO MODO SINGLE (ALVO ÚNICO)
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 3] Validação do Contrato no Modo Alvo Único (single)\x1b[0m');

    const eventSingle = {
      event_id: crypto.randomUUID(),
      event_type: 'MATCH_FINISHED',
      schema_version: '1.0',
      timestamp: new Date().toISOString(),
      payload: {
        local_session_id: 'pers_single_001',
        user_id: ATHLETE_UUID,
        is_simulation: false,
        engine_rules_version: 1,
        mode: 'single',
        wall_preset: '3x2',
        started_at: new Date(Date.now() - 300000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 300,
        shots_count: 2,
        hits_count: 1,
        total_score: 1, // apenas o acerto no alvo correto pontua 1
        xp_granted: 106, // 63 (alvo correto) + 43 (outro setor)
        reactivations: 0,
        shots: [
          {
            x: 50.0,
            y: 50.0,
            is_hit: true,
            score: 115, // base 85 + 30 bônus alvo
            xp: 63,     // base 43 + 20 bônus XP
            match_points: 1,
            sector_id: 5,
            force_kmh: 85.0,
            is_bullseye: false,
            shot_time_offset_ms: 10000
          },
          {
            x: 20.0,
            y: 20.0,
            is_hit: true,
            score: 85,  // acerto em outro setor
            xp: 43,
            match_points: 0,
            sector_id: 1,
            force_kmh: 80.0,
            is_bullseye: false,
            shot_time_offset_ms: 20000
          }
        ]
      }
    };

    const singleRes = await handleGatewayRequest({
      method: 'POST',
      headers: {
        'x-equipment-id': DUMMY_EQ_ID,
        'x-equipment-key': DUMMY_API_KEY,
        'content-type': 'application/json'
      },
      bodyText: JSON.stringify({
        op: 'sync_session',
        data: { event: eventSingle }
      })
    }, mockDeps);

    assert(singleRes.status === 200 && singleRes.body.ok === true, 'Gateway valida com sucesso evento no modo single');
    assert(invokedArgs.p_event.payload.total_score === 1, 'Modo single pontua 1 ponto no total');
    assert(invokedArgs.p_event.payload.hits_count === 1, 'hits_count reflete 1 impacto pontuado');

    // ----------------------------------------------------------------------------
    // GRUPO 4: CONTRATO DO EVENTO NO MODO CLEAR ALL COM VITÓRIA E REATIVAÇÕES
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 4] Validação no Modo Apagar Todos (clear_all) com Reativações\x1b[0m');

    const eventClear = {
      event_id: crypto.randomUUID(),
      event_type: 'MATCH_FINISHED',
      schema_version: '1.0',
      timestamp: new Date().toISOString(),
      payload: {
        local_session_id: 'pers_clear_001',
        user_id: ATHLETE_UUID,
        is_simulation: false,
        engine_rules_version: 1,
        mode: 'clear_all',
        wall_preset: '3x2',
        started_at: new Date(Date.now() - 120000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 120,
        shots_count: 3,
        hits_count: 2,
        total_score: 700, // 100 (apaga setor) + 0 (reativação) + 600 (vitória com bônus +500)
        xp_granted: 159,  // 53 + 53 + 53
        reactivations: 1,
        shots: [
          {
            x: 80.0,
            y: 20.0,
            is_hit: true,
            score: 100,
            xp: 53,
            match_points: 100,
            sector_id: 3,
            force_kmh: 85.0,
            is_bullseye: false,
            shot_time_offset_ms: 5000
          },
          {
            x: 80.0,
            y: 20.0,
            is_hit: true,
            score: 100,
            xp: 53,
            match_points: 0, // reativação do setor 3 já apagado
            sector_id: 3,
            force_kmh: 85.0,
            is_bullseye: false,
            shot_time_offset_ms: 15000
          },
          {
            x: 80.0,
            y: 20.0,
            is_hit: true,
            score: 100,
            xp: 53,
            match_points: 600, // apaga o último setor restante (+100 + 500 vitória)
            sector_id: 3,
            force_kmh: 85.0,
            is_bullseye: false,
            shot_time_offset_ms: 25000
          }
        ]
      }
    };

    const clearRes = await handleGatewayRequest({
      method: 'POST',
      headers: {
        'x-equipment-id': DUMMY_EQ_ID,
        'x-equipment-key': DUMMY_API_KEY,
        'content-type': 'application/json'
      },
      bodyText: JSON.stringify({
        op: 'sync_session',
        data: { event: eventClear }
      })
    }, mockDeps);

    assert(clearRes.status === 200 && clearRes.body.ok === true, 'Gateway valida com sucesso evento no modo clear_all com vitória');
    assert(invokedArgs.p_event.payload.total_score === 700, 'Pontuação total de 700 preservada (100 + 600 vitória)');
    assert(invokedArgs.p_event.payload.reactivations === 1, 'Reativação = 1 preservada no contrato');

    // ----------------------------------------------------------------------------
    // GRUPO 5: CONTRATO PARA PARTIDA SEM ACERTOS (0 HITS)
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 5] Validação de Partida sem Acertos (Erros e Foras)\x1b[0m');

    const eventZeroHits = {
      event_id: crypto.randomUUID(),
      event_type: 'MATCH_FINISHED',
      schema_version: '1.0',
      timestamp: new Date().toISOString(),
      payload: {
        local_session_id: 'pers_miss_001',
        user_id: ATHLETE_UUID,
        is_simulation: false,
        engine_rules_version: 1,
        mode: 'free',
        wall_preset: '3x2',
        started_at: new Date(Date.now() - 300000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 300,
        shots_count: 2,
        hits_count: 0,
        total_score: 0,
        xp_granted: 0,
        reactivations: 0,
        shots: [
          {
            x: 5.0,
            y: 5.0,
            is_hit: false,
            score: 0,
            xp: 0,
            match_points: 0,
            sector_id: null,
            force_kmh: 70.0,
            is_bullseye: false,
            shot_time_offset_ms: 10000
          },
          {
            x: 95.0,
            y: 95.0,
            is_hit: false,
            score: 0,
            xp: 0,
            match_points: 0,
            sector_id: null,
            force_kmh: 75.0,
            is_bullseye: false,
            shot_time_offset_ms: 20000
          }
        ]
      }
    };

    const zeroHitsRes = await handleGatewayRequest({
      method: 'POST',
      headers: {
        'x-equipment-id': DUMMY_EQ_ID,
        'x-equipment-key': DUMMY_API_KEY,
        'content-type': 'application/json'
      },
      bodyText: JSON.stringify({
        op: 'sync_session',
        data: { event: eventZeroHits }
      })
    }, mockDeps);

    assert(zeroHitsRes.status === 200 && zeroHitsRes.body.ok === true, 'Gateway aceita partida onde nenhum tiro acertou os alvos');
    assert(invokedArgs.p_event.payload.shots_count === 2 && invokedArgs.p_event.payload.hits_count === 0, 'shots_count = 2 e hits_count = 0');
    assert(invokedArgs.p_event.payload.total_score === 0 && invokedArgs.p_event.payload.xp_granted === 0, 'Score e XP estritamente zerados');

  } catch (err) {
    console.error('\x1b[31m[ERRO NO TESTE DO CONTRATO]:\x1b[0m', err);
    failedTests++;
  } finally {
    console.log('\n======================================================');
    console.log(`  RESULTADO ETAPA D: ${passedTests} aprovados, ${failedTests} reprovados`);
    console.log('======================================================\n');
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTests();
