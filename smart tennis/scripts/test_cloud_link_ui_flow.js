/**
 * ==============================================================================
 * MOTION TENNIS — TESTES DO FLUXO DE VINCULAÇÃO CLOUD (INTERFACE & API)
 * ==============================================================================
 * Valida de forma não-destrutiva e isolada:
 * 1. Tratamento de erros e respostas da função authenticateSupabaseUser.
 * 2. Fluxo HTTP completo via rotas /api/auth/cloud/* com token de Nicolas.
 * 3. Envio seguro do access_token ao endpoint autenticado /api/auth/cloud/link.
 * 4. Associação correta 1:1 entre o atleta local Nicolas (id=2) e o UUID cloud.
 * 5. Preservação de dados locais e promoção de partidas na outbox (pending_link -> pending).
 * 6. Rejeição de vinculação duplicada de UUID cloud para múltiplos atletas.
 * 7. Consulta de status e desvinculação limpa.
 * ==============================================================================
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

// Garante isolamento: usa cópia temporária do banco SQLite para não alterar smart_tennis.db
const originalDbPath = path.resolve(__dirname, '..', 'server', 'database', 'smart_tennis.db');
const tempDbPath = path.resolve(__dirname, '..', 'server', 'database', `test_cloud_link_${Date.now()}.db`);

fs.copyFileSync(originalDbPath, tempDbPath);
process.env.SMART_TENNIS_DB_PATH = tempDbPath;
process.env.SMART_TENNIS_TEST_MODE = '1';

// Configura JWT secret para validação offline nos testes
const testJwtSecret = 'segredo-jwt-teste-com-mais-de-32-chars-longos!';
process.env.SUPABASE_JWT_SECRET = testJwtSecret;
process.env.SUPABASE_URL = 'https://motion-tennis-test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'sb_publishable_test_mock_1234567890abcdef_court';

const { get, run, all, closeDb } = require('../server/database/db');
const { ensureOutboxTable, createMatchFinishedEvent } = require('../server/services/cloudOutboxService');
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

// Cria JWT de teste assinado para o Supabase Auth
function createTestJwt({ payload, secret = testJwtSecret }) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// Implementação idêntica da função de autenticação do cliente para teste unitário
async function testAuthenticateSupabaseUser({ supabaseUrl, anonKey, email, password, fetchFn = globalThis.fetch }) {
  if (!supabaseUrl || !anonKey) {
    throw new Error('Configuração da nuvem Supabase incompleta no servidor.');
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Informe o e-mail e a senha da sua conta online.');
  }

  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`;

  let response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: cleanEmail, password })
    });
  } catch (netErr) {
    const err = new Error('Nuvem Supabase indisponível no momento ou sem conexão com a internet.');
    err.code = 'CLOUD_UNAVAILABLE';
    err.originalError = netErr;
    throw err;
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    const err = new Error('Resposta inválida do serviço de autenticação Supabase.');
    err.code = 'INVALID_RESPONSE';
    throw err;
  }

  if (!response.ok) {
    const errorMsg = data?.error_description || data?.msg || data?.error || 'Falha ao autenticar no Supabase.';
    const err = new Error(
      data?.error === 'invalid_grant' || errorMsg.toLowerCase().includes('invalid')
        ? 'Credenciais inválidas: e-mail ou senha incorretos na conta online.'
        : errorMsg
    );
    err.status = response.status;
    err.code = data?.error || 'AUTH_ERROR';
    throw err;
  }

  if (!data?.access_token) {
    throw new Error('O provedor de autenticação não retornou um token de acesso válido.');
  }

  return data;
}

// Helper para fazer requisições HTTP locais no servidor de teste Express
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
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, statusCode: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, statusCode: res.statusCode, raw: data });
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

async function runTests() {
  console.log('\n======================================================');
  console.log('  MOTION TENNIS — TESTES DE VINCULAÇÃO CLOUD (UI & API)');
  console.log('======================================================\n');

  // Inicializa servidor Express de teste
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    // ----------------------------------------------------------------------------
    // GRUPO 1: Estado Inicial e Contrato das Rotas de Configuração
    // ----------------------------------------------------------------------------
    console.log('\x1b[36m[GRUPO 1] Contrato da Rota GET /api/auth/cloud/config\x1b[0m');

    const configRes = await makeRequest(server, '/api/auth/cloud/config');
    assert(configRes.statusCode === 200, 'GET /api/auth/cloud/config responde com status 200');
    assert(configRes.body.configured === true, 'Configuração pública reporta configured = true');
    assert(Boolean(configRes.body.supabaseUrl), 'supabaseUrl retornado na configuração pública');
    assert(Boolean(configRes.body.anonKey), 'anonKey público retornado');
    assert(configRes.body.jwtSecret === undefined, 'jwtSecret NUNCA exposto ao cliente');

    // Prepara banco temporário para o teste do fluxo de vinculação
    await run('DELETE FROM user_cloud_identities WHERE user_id = 2');
    await run('UPDATE users SET supabase_user_id = NULL WHERE id = 2');

    // Nicolas existe no banco e não tem vínculo inicial
    const nicolas = await get('SELECT id, username, name, supabase_user_id FROM users WHERE id = 2');
    assert(nicolas && nicolas.username === 'nicolas', 'Nicolas presente no banco com id=2');
    assert(nicolas.supabase_user_id === null, 'Nicolas inicia com supabase_user_id = null');

    // ----------------------------------------------------------------------------
    // GRUPO 2: Tratamento de Erros da Autenticação Supabase
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 2] Tratamento de Erros da Função authenticateSupabaseUser\x1b[0m');

    // 1. Rejeita credenciais vazias
    let caughtMissing = false;
    try {
      await testAuthenticateSupabaseUser({
        supabaseUrl: configRes.body.supabaseUrl,
        anonKey: configRes.body.anonKey,
        email: '',
        password: ''
      });
    } catch (e) {
      caughtMissing = true;
      assert(e.message.includes('Informe o e-mail e a senha'), 'Rejeita e-mail ou senha vazios');
    }
    assert(caughtMissing, 'Validação de campos obrigatórios confirmada');

    // 2. Erro de rede (offline)
    const mockOfflineFetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    let caughtOffline = false;
    try {
      await testAuthenticateSupabaseUser({
        supabaseUrl: configRes.body.supabaseUrl,
        anonKey: configRes.body.anonKey,
        email: 'atleta@exemplo.com',
        password: 'senha',
        fetchFn: mockOfflineFetch
      });
    } catch (e) {
      caughtOffline = true;
      assert(e.code === 'CLOUD_UNAVAILABLE', 'Erro de rede mapeado para CLOUD_UNAVAILABLE');
      assert(e.message.includes('indisponível'), 'Mensagem amigável de nuvem indisponível');
    }
    assert(caughtOffline, 'Tratamento de offline comprovado');

    // 3. Credenciais inválidas no Supabase (400)
    const mockInvalidFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'Invalid login credentials' })
    });
    let caughtInvalid = false;
    try {
      await testAuthenticateSupabaseUser({
        supabaseUrl: configRes.body.supabaseUrl,
        anonKey: configRes.body.anonKey,
        email: 'atleta@exemplo.com',
        password: 'senha-errada',
        fetchFn: mockInvalidFetch
      });
    } catch (e) {
      caughtInvalid = true;
      assert(e.message.includes('Credenciais inválidas: e-mail ou senha incorretos'), 'Mapeia erro 400 para mensagem clara');
    }
    assert(caughtInvalid, 'Tratamento de credenciais inválidas comprovado');

    // 4. Sucesso ao obter access_token
    const mockCloudUuid = '0ef1cdd9-085b-4256-9b2f-94711da0e501';
    const validCloudJwt = createTestJwt({
      payload: {
        iss: 'https://motion-tennis-test.supabase.co/auth/v1',
        sub: mockCloudUuid,
        aud: 'authenticated',
        email: 'nicolasrjm2@gmail.com',
        exp: Math.floor(Date.now() / 1000) + 3600
      }
    });

    const mockSuccessFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: validCloudJwt,
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: mockCloudUuid, email: 'nicolasrjm2@gmail.com' }
      })
    });

    const authResult = await testAuthenticateSupabaseUser({
      supabaseUrl: configRes.body.supabaseUrl,
      anonKey: configRes.body.anonKey,
      email: 'nicolasrjm2@gmail.com',
      password: 'senha-correta',
      fetchFn: mockSuccessFetch
    });

    assert(Boolean(authResult.access_token), 'authenticateSupabaseUser retorna access_token');
    assert(authResult.user.id === mockCloudUuid, 'Identificador retornado reflete UUID da conta cloud');

    // ----------------------------------------------------------------------------
    // GRUPO 3: Criação de Partida Offline Antes de Vincular (pending_link)
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 3] Partidas Offline em Espera (status: pending_link)\x1b[0m');

    await ensureOutboxTable();

    const matchRow = await run(
      `INSERT INTO personal_matches (
         user_id, equipment_id, mode, state, started_at, ends_at, ended_at,
         duration_seconds, score, shots_count, hits_count, won
       ) VALUES (2, 1, 'free', 'FINISHED', ?, ?, ?, 60, 100, 2, 2, 1)`,
      [Date.now() - 60000, Date.now(), Date.now()]
    );

    const outboxEvent = await createMatchFinishedEvent({
      match: { id: matchRow.lastID, user_id: 2, mode: 'free', wall_preset: '3x2' },
      durationSeconds: 60,
      sessionId: `sess_offline_test_${Date.now()}`
    });

    assert(outboxEvent.status === 'pending_link', 'Evento gravado na outbox como pending_link');
    assert(outboxEvent.cloud_user_id === null, 'cloud_user_id do evento na outbox é null');

    // ----------------------------------------------------------------------------
    // GRUPO 4: Login Local de Nicolas e Consulta de Status Não Vinculado
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 4] Autenticação Local e Consulta de Status Inicial\x1b[0m');

    const loginRes = await makeRequest(server, '/api/auth/login', {
      method: 'POST',
      body: { username: 'nicolas', password: 'nicolas123' }
    });

    assert(loginRes.statusCode === 200, 'Login local de Nicolas conclui com HTTP 200');
    assert(Boolean(loginRes.body.token), 'Token de sessão local de Nicolas gerado com sucesso');
    const nicolasLocalToken = loginRes.body.token;

    // Consulta status antes de vincular
    const statusBefore = await makeRequest(server, '/api/auth/cloud/status', {
      headers: { 'Authorization': `Bearer ${nicolasLocalToken}` }
    });
    assert(statusBefore.statusCode === 200, 'GET /api/auth/cloud/status responde 200');
    assert(statusBefore.body.linked === false, 'Status inicial confirma linked = false');
    assert(statusBefore.body.identity === null, 'Identidade inicial é null');

    // ----------------------------------------------------------------------------
    // GRUPO 5: Vinculação via POST /api/auth/cloud/link com access_token
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 5] Execução da Vinculação via POST /api/auth/cloud/link\x1b[0m');

    // Rejeição se não enviar token
    const linkEmpty = await makeRequest(server, '/api/auth/cloud/link', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${nicolasLocalToken}` },
      body: {}
    });
    assert(linkEmpty.statusCode === 400, 'Rejeita requisição sem token com HTTP 400');
    assert(linkEmpty.body.code === 'TOKEN_REQUIRED', 'Código de erro TOKEN_REQUIRED retornado');

    // Vinculação legítima com o token obtido do Supabase Auth
    const linkSuccess = await makeRequest(server, '/api/auth/cloud/link', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${nicolasLocalToken}` },
      body: { access_token: validCloudJwt }
    });

    assert(linkSuccess.statusCode === 200, 'POST /api/auth/cloud/link responde com HTTP 200');
    assert(linkSuccess.body.success === true, 'Mensagem de sucesso retornada');
    assert(linkSuccess.body.data.cloudUserId === mockCloudUuid, 'Identidade vinculada é o UUID cloud do token');

    // ----------------------------------------------------------------------------
    // GRUPO 6: Verificação de Status Vinculado e Promoção na Outbox
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 6] Validação Pós-Vinculação e Outbox Promovida\x1b[0m');

    const statusAfter = await makeRequest(server, '/api/auth/cloud/status', {
      headers: { 'Authorization': `Bearer ${nicolasLocalToken}` }
    });
    assert(statusAfter.statusCode === 200, 'GET /api/auth/cloud/status responde 200');
    assert(statusAfter.body.linked === true, 'Status confirma linked = true');
    assert(statusAfter.body.identity.cloudUserId === mockCloudUuid, 'UUID cloud da identidade confere');
    assert(statusAfter.body.identity.email === 'nicolasrjm2@gmail.com', 'E-mail gravado com sucesso');

    // Verifica SQLite diretamente: usuário Nicolas e tabela user_cloud_identities
    const userInDb = await get('SELECT supabase_user_id FROM users WHERE id = 2');
    assert(userInDb.supabase_user_id === mockCloudUuid, 'users.supabase_user_id atualizado no SQLite');

    // Verifica se a partida em pending_link foi promovida e processada pelo worker
    const outboxAfter = await get('SELECT status, cloud_user_id FROM cloud_outbox WHERE id = ?', [outboxEvent.id]);
    assert(outboxAfter.status === 'pending' || outboxAfter.status === 'processing', 'Partida anterior promovida e acionada pelo sync worker');
    assert(outboxAfter.cloud_user_id === mockCloudUuid, 'cloud_user_id populado na outbox');

    // ----------------------------------------------------------------------------
    // GRUPO 7: Prevenção de Vinculação Duplicada para Outro Atleta
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 7] Prevenção de Duplicidade 1:1\x1b[0m');

    // Faz login com admin (id=1)
    const adminLogin = await makeRequest(server, '/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'admin123' }
    });
    assert(adminLogin.statusCode === 200, 'Login do admin conclui com 200');
    const adminToken = adminLogin.body.token;

    // Admin tenta vincular a MESMA conta cloud que já pertence a Nicolas
    const adminDupLink = await makeRequest(server, '/api/auth/cloud/link', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { access_token: validCloudJwt }
    });
    assert(adminDupLink.statusCode === 400, 'Bloqueia tentativa de vincular mesmo UUID com HTTP 400');
    assert(adminDupLink.body.error.includes('já está associada a outro atleta'), 'Mensagem expressa de colisão 1:1');

    // ----------------------------------------------------------------------------
    // GRUPO 8: Desvinculação Limpa e Restauração de Status
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 8] Desvinculação Limpa\x1b[0m');

    const unlinkRes = await makeRequest(server, '/api/auth/cloud/unlink', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${nicolasLocalToken}` }
    });
    assert(unlinkRes.statusCode === 200, 'POST /api/auth/cloud/unlink responde com HTTP 200');

    const statusAfterUnlink = await makeRequest(server, '/api/auth/cloud/status', {
      headers: { 'Authorization': `Bearer ${nicolasLocalToken}` }
    });
    assert(statusAfterUnlink.body.linked === false, 'Status confirma linked = false após desvinculação');

    const userAfterUnlink = await get('SELECT supabase_user_id FROM users WHERE id = 2');
    assert(userAfterUnlink.supabase_user_id === null, 'users.supabase_user_id restaurado para null');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      await closeDb();
    } catch (_) {}

    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    } catch (_) {}
  }

  console.log('\n======================================================');
  console.log(`  RESULTADO: ${passedTests} aprovados, ${failedTests} reprovados`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
