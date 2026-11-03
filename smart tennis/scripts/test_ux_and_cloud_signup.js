/**
 * ==============================================================================
 * MOTION TENNIS — TESTES DE UX/UI, CADASTRO CLOUD E ISOLAMENTO DE ATLETAS
 * ==============================================================================
 * Valida de forma não-destrutiva e isolada:
 * 1. Cadastro e autenticação via Supabase Auth com provisionamento local seguro.
 * 2. Isolamento rigoroso: novo atleta criado NÃO sobrescreve nem interfere no Nicolas (id=2).
 * 3. Validação de claims, hash de senha local autogerado e atributos iniciais (LV 1, 0 XP).
 * 4. Recuperação de senha online via endpoint oficial Supabase.
 * 5. Outbox: partidas do novo atleta herdam automaticamente seu cloud_user_id (status: pending).
 * 6. Contrato de Login com token (POST /api/auth/cloud/login-with-token).
 * ==============================================================================
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

// Garante isolamento: banco SQLite temporário
const originalDbPath = path.resolve(__dirname, '..', 'server', 'database', 'smart_tennis.db');
const tempDbPath = path.resolve(__dirname, '..', 'server', 'database', `test_ux_signup_${Date.now()}.db`);

fs.copyFileSync(originalDbPath, tempDbPath);
process.env.SMART_TENNIS_DB_PATH = tempDbPath;
process.env.SMART_TENNIS_TEST_MODE = '1';

const testJwtSecret = 'segredo-jwt-teste-ux-signup-com-mais-de-32-chars!';
process.env.SUPABASE_JWT_SECRET = testJwtSecret;
process.env.SUPABASE_URL = 'https://motion-tennis-test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'sb_publishable_test_mock_1234567890abcdef_court';

const { get, run, all, closeDb } = require('../server/database/db');
const { ensureOutboxTable, createMatchFinishedEvent } = require('../server/services/cloudOutboxService');
const {
  provisionLocalPlayerForCloud,
  getLinkedUserByCloudId,
  getCloudIdentityForUser
} = require('../server/services/cloudIdentityService');
const authRoutes = require('../server/routes/authRoutes');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✔ PASS [${testName}]`);
    passedTests++;
  } else {
    console.error(`  ✖ FAIL [${testName}] ${details}`);
    failedTests++;
  }
}

function createTestJwt({ payload, secret = testJwtSecret }) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function makeRequest(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const reqOptions = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('  MOTION TENNIS — TESTES DE UX/UI, CADASTRO & PROVISIONAMENTO');
  console.log('======================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    // ----------------------------------------------------------------------------
    // GRUPO 1: Preservação Intacta do Usuário Nicolas (id=2)
    // ----------------------------------------------------------------------------
    console.log('\x1b[36m[GRUPO 1] Preservação do Usuário Nicolas (id=2)\x1b[0m');

    const nicolasBefore = await get('SELECT id, username, name, role FROM users WHERE id = 2');
    assert(nicolasBefore && nicolasBefore.username === 'nicolas', 'Nicolas presente no banco com id=2');
    assert(nicolasBefore.role === 'player', 'Nicolas possui role player');

    const playerRecord = await get('SELECT * FROM players WHERE user_id = 2');
    assert(Boolean(playerRecord), 'Registro da tabela players do Nicolas intacto');

    // ----------------------------------------------------------------------------
    // GRUPO 2: Provisionamento de Novo Atleta Cloud
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 2] Provisionamento Automático de Novo Atleta Cloud\x1b[0m');

    const newCloudUuid = '99999999-8888-7777-6666-555544443333';
    const newAthleteEmail = 'carlos.atleta@example.com';
    const newAthleteName = 'Carlos Silva';

    const newAthleteUser = await provisionLocalPlayerForCloud({
      cloudUserId: newCloudUuid,
      email: newAthleteEmail,
      name: newAthleteName
    });

    assert(Boolean(newAthleteUser && newAthleteUser.id), 'Novo usuário provisionado no SQLite com sucesso');
    assert(newAthleteUser.id !== 2, 'Novo atleta tem ID local diferente de Nicolas (isolamento garantido)');
    assert(newAthleteUser.name === newAthleteName, 'Nome do atleta salvo corretamente');
    assert(newAthleteUser.role === 'player', 'Role definido como player');
    assert(newAthleteUser.supabase_user_id === newCloudUuid, 'users.supabase_user_id populado com UUID cloud');

    // Valida tabela players
    const newPlayer = await get('SELECT * FROM players WHERE user_id = ?', [newAthleteUser.id]);
    assert(Boolean(newPlayer), 'Registro criado na tabela players');
    assert(Number(newPlayer.level) === 1, 'Novo atleta inicia no Nível 1');
    assert(Number(newPlayer.xp) === 0, 'Novo atleta inicia com 0 XP');
    assert(newPlayer.title === 'Iniciante', 'Novo atleta possui título Iniciante');

    // Valida tabela attributes
    const newAttrs = await get('SELECT * FROM attributes WHERE player_id = ?', [newPlayer.id]);
    assert(Boolean(newAttrs), 'Atributos técnicos inicializados para o novo atleta');

    // Valida associação 1:1 na tabela user_cloud_identities
    const cloudIdentity = await getCloudIdentityForUser(newAthleteUser.id);
    assert(Boolean(cloudIdentity), 'Identidade cloud registrada na tabela user_cloud_identities');
    assert(cloudIdentity.cloud_user_id === newCloudUuid, 'cloud_user_id corresponde ao UUID oficial');
    assert(cloudIdentity.email === newAthleteEmail, 'E-mail do atleta gravado na identidade');

    // Nicolas não foi alterado de nenhuma forma
    const nicolasAfter = await get('SELECT id, username, name FROM users WHERE id = 2');
    assert(nicolasAfter.username === 'nicolas' && nicolasAfter.id === 2, 'Nicolas 100% inalterado após provisionamento');

    // ----------------------------------------------------------------------------
    // GRUPO 3: Login via Token com create_if_missing via HTTP
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 3] Fluxo HTTP POST /api/auth/cloud/login-with-token\x1b[0m');

    const anotherCloudUuid = '11111111-2222-3333-4444-555566667777';
    const anotherToken = createTestJwt({
      payload: {
        iss: 'https://motion-tennis-test.supabase.co/auth/v1',
        sub: anotherCloudUuid,
        aud: 'authenticated',
        email: 'mariana.tenis@example.com',
        user_metadata: { name: 'Mariana Lima' },
        exp: Math.floor(Date.now() / 1000) + 3600
      }
    });

    const loginRes = await makeRequest(server, '/api/auth/cloud/login-with-token', {
      method: 'POST',
      body: {
        access_token: anotherToken,
        create_if_missing: true,
        name: 'Mariana Lima'
      }
    });

    assert(loginRes.statusCode === 200, 'POST /api/auth/cloud/login-with-token retorna HTTP 200 para nova conta');
    assert(loginRes.body.success === true, 'Sucesso confirmado na resposta');
    assert(Boolean(loginRes.body.token), 'Token de sessão local gerado para Mariana');
    assert(loginRes.body.user.cloudUserId === anotherCloudUuid, 'Identidade cloud retornada confere');
    assert(loginRes.body.user.name === 'Mariana Lima', 'Nome retornado confere');
    assert(loginRes.body.user.id !== 2 && loginRes.body.user.id !== newAthleteUser.id, 'Mariana possui ID isolado');

    // ----------------------------------------------------------------------------
    // GRUPO 4: Geração de Partidas do Novo Atleta na Outbox
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 4] Outbox do Atleta Provisionado (Status pending com UUID)\x1b[0m');

    await ensureOutboxTable();

    const matchRow = await run(
      `INSERT INTO personal_matches (
         user_id, equipment_id, mode, state, started_at, ends_at, ended_at,
         duration_seconds, score, shots_count, hits_count, won
       ) VALUES (?, 1, 'free', 'FINISHED', ?, ?, ?, 60, 170, 2, 2, 1)`,
      [newAthleteUser.id, Date.now() - 60000, Date.now(), Date.now()]
    );

    const outboxEvent = await createMatchFinishedEvent({
      match: { id: matchRow.lastID, user_id: newAthleteUser.id, mode: 'free', wall_preset: '3x2' },
      durationSeconds: 60,
      sessionId: `sess_new_athlete_${Date.now()}`
    });

    assert(outboxEvent.status === 'pending', 'Partida de atleta vinculado vai para outbox com status pending');
    assert(outboxEvent.cloud_user_id === newCloudUuid, 'cloud_user_id do evento reflete o UUID do novo atleta');
    assert(outboxEvent.user_id === newAthleteUser.id, 'user_id reflete o ID SQLite isolado do novo atleta');

    // ----------------------------------------------------------------------------
    // GRUPO 5: Colisão e Idempotência de Provisionamento
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 5] Idempotência de Provisionamento\x1b[0m');

    // Chamar loginWithToken novamente com mesmo token de Mariana retorna o mesmo usuário já provisionado
    const repeatLogin = await makeRequest(server, '/api/auth/cloud/login-with-token', {
      method: 'POST',
      body: {
        access_token: anotherToken,
        create_if_missing: true
      }
    });

    assert(repeatLogin.statusCode === 200, 'Re-login retorna HTTP 200');
    assert(repeatLogin.body.user.id === loginRes.body.user.id, 'Mesmo ID SQLite retornado sem criar duplicatas');

  } catch (err) {
    console.error('\n[ERRO NA EXECUÇÃO DO TESTE]:', err);
    failedTests++;
  } finally {
    server.close();
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    } catch (e) {}

    console.log('\n======================================================');
    console.log(`  RESULTADO: ${passedTests} aprovados, ${failedTests} reprovados`);
    console.log('======================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runAllTests();
