/**
 * ==============================================================================
 * MOTION TENNIS — TESTES AUTOMATIZADOS FASE C: CADASTRO E LOGIN FUNCIONAIS
 * ==============================================================================
 * Valida de forma não-destrutiva em banco SQLite temporário isolado:
 * 1. Tratamento de cadastro com confirmação de e-mail pendente (requiresConfirmation).
 * 2. Detecção e mapeamento estrito do erro 'Email not confirmed' (code: EMAIL_NOT_CONFIRMED).
 * 3. Função de reenvio de confirmação de e-mail (POST /auth/v1/resend).
 * 4. Login com token Supabase e auto-provisionamento de atleta individual no SQLite (LV 1, 0 XP, Iniciante).
 * 5. Idempotência do login (re-login não duplica registros).
 * 6. Isolamento estrito entre múltiplos atletas (Beatriz vs Carlos).
 * 7. Preservação integral da conta do Nicolas (id=2, XP e nível mantidos).
 * 8. Login offline no equipamento via POST /api/auth/login com username e com e-mail usando hash PBKDF2 local.
 * 9. Visualização do atleta recém-criado no painel administrativo (/api/admin/users) com vínculo cloud.
 * 10. Fluxo de recuperação de senha online (recoverPasswordWithSupabase).
 * ==============================================================================
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

// Cria cópia temporária do banco SQLite para garantir que smart_tennis.db não seja alterado
const originalDbPath = path.resolve(__dirname, '..', 'server', 'database', 'smart_tennis.db');
const tempDbPath = path.resolve(__dirname, '..', 'server', 'database', `test_fase_c_${Date.now()}.db`);

fs.copyFileSync(originalDbPath, tempDbPath);
process.env.SMART_TENNIS_DB_PATH = tempDbPath;
process.env.SMART_TENNIS_TEST_MODE = '1';

// Configuração do Supabase para ambiente de teste
const testJwtSecret = 'super-secret-jwt-key-motion-tennis-test-32chars!';
process.env.SUPABASE_JWT_SECRET = testJwtSecret;
process.env.SUPABASE_URL = 'https://motion-tennis-test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'sb_publishable_test_fase_c_mock_key';

const { get, run, all, closeDb } = require('../server/database/db');
const { ensureCloudIdentityTables, provisionLocalPlayerForCloud } = require('../server/services/cloudIdentityService');
const authRoutes = require('../server/routes/authRoutes');
const adminRoutes = require('../server/routes/adminRoutes');

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

// Helper para gerar tokens JWT Supabase simulados e válidos para testes
function createTestJwt({ payload, secret = testJwtSecret }) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// Helper de requisições HTTP locais no servidor de teste
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

// Implementações espelhadas das funções do cliente cloudAuthService para teste não-browser
async function authenticateSupabaseUser({ supabaseUrl, anonKey, email, password, fetchFn = globalThis.fetch }) {
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
    const errorDesc = (data?.error_description || data?.msg || data?.error || '').trim();
    const isEmailNotConfirmed =
      errorDesc.toLowerCase().includes('email not confirmed') ||
      errorDesc.toLowerCase().includes('email_not_confirmed') ||
      data?.error_code === 'email_not_confirmed';

    let userFacingMessage = errorDesc || 'Falha ao autenticar no Supabase.';
    let errorCode = data?.error || 'AUTH_ERROR';

    if (isEmailNotConfirmed) {
      userFacingMessage = 'E-mail não confirmado. Por favor, verifique sua caixa de entrada para ativar a conta antes de entrar.';
      errorCode = 'EMAIL_NOT_CONFIRMED';
    } else if (data?.error === 'invalid_grant' || errorDesc.toLowerCase().includes('invalid')) {
      userFacingMessage = 'Credenciais inválidas: e-mail ou senha incorretos na conta online.';
    }

    const err = new Error(userFacingMessage);
    err.status = response.status;
    err.code = errorCode;
    err.rawError = data;
    throw err;
  }

  if (!data?.access_token) {
    throw new Error('O provedor de autenticação não retornou um token de acesso válido.');
  }

  return data;
}

async function signUpWithSupabase({ supabaseUrl, anonKey, email, password, name, fetchFn = globalThis.fetch }) {
  if (!supabaseUrl || !anonKey) {
    throw new Error('Configuração da nuvem Supabase incompleta no servidor.');
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim();
  if (!cleanEmail || !password) {
    throw new Error('Informe o e-mail e uma senha válida.');
  }

  if (password.length < 6) {
    throw new Error('A senha deve possuir pelo menos 6 caracteres.');
  }

  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/signup`;

  let response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        data: {
          name: cleanName || cleanEmail.split('@')[0],
          full_name: cleanName || cleanEmail.split('@')[0]
        }
      })
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
    const err = new Error('Resposta inválida do serviço de cadastro Supabase.');
    err.code = 'INVALID_RESPONSE';
    throw err;
  }

  if (!response.ok) {
    const errorMsg = data?.msg || data?.error_description || data?.error || 'Falha ao cadastrar no Supabase.';
    const err = new Error(
      errorMsg.toLowerCase().includes('already') || data?.error_code === 'user_already_exists'
        ? 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.'
        : errorMsg
    );
    err.status = response.status;
    err.code = data?.error_code || 'SIGNUP_ERROR';
    throw err;
  }

  const hasSession = Boolean(data?.access_token || data?.session?.access_token);
  const requiresConfirmation = !hasSession;

  return {
    user: data.user || data,
    session: data.session || (data.access_token ? data : null),
    requiresConfirmation,
    message: requiresConfirmation
      ? 'Conta criada! Verifique seu e-mail para confirmar seu cadastro antes de jogar.'
      : 'Conta criada com sucesso!'
  };
}

async function resendConfirmationEmail({ supabaseUrl, anonKey, email, fetchFn = globalThis.fetch }) {
  const url = supabaseUrl || process.env.SUPABASE_URL;
  const key = anonKey || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Sincronização em nuvem não configurada no servidor local.');
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Informe um e-mail válido para reenviar a confirmação.');
  }

  const endpoint = `${url.replace(/\/+$/, '')}/auth/v1/resend`;

  let response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'signup',
        email: cleanEmail
      })
    });
  } catch (netErr) {
    const err = new Error('Nuvem Supabase indisponível no momento ou sem conexão com a internet.');
    err.code = 'CLOUD_UNAVAILABLE';
    err.originalError = netErr;
    throw err;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {}

  if (!response.ok) {
    const errorMsg = data?.msg || data?.error_description || data?.error || 'Falha ao reenviar e-mail de confirmação.';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.code = data?.error_code || 'RESEND_ERROR';
    throw err;
  }

  return {
    success: true,
    message: 'E-mail de confirmação reenviado com sucesso! Verifique sua caixa de entrada e spam.'
  };
}

async function recoverPasswordWithSupabase({ supabaseUrl, anonKey, email, fetchFn = globalThis.fetch }) {
  const url = supabaseUrl || process.env.SUPABASE_URL;
  const key = anonKey || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Configuração da nuvem Supabase incompleta no servidor.');
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Informe o seu e-mail cadastrado.');
  }

  const endpoint = `${url.replace(/\/+$/, '')}/auth/v1/recover`;

  let response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: cleanEmail })
    });
  } catch (netErr) {
    const err = new Error('Nuvem Supabase indisponível no momento ou sem conexão com a internet.');
    err.code = 'CLOUD_UNAVAILABLE';
    err.originalError = netErr;
    throw err;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {}

  if (!response.ok) {
    const errorMsg = data?.msg || data?.error_description || data?.error || 'Falha ao solicitar recuperação de senha.';
    const err = new Error(errorMsg);
    err.status = response.status;
    throw err;
  }

  return {
    success: true,
    message: 'E-mail de recuperação enviado! Verifique sua caixa de entrada.'
  };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  🎾 MOTION TENNIS — TESTES DA FASE C: AUTH & CADASTRO');
  console.log('======================================================\n');

  // Inicializa servidor Express de teste com as rotas reais
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    // ----------------------------------------------------------------------------
    // GRUPO 1: CADASTRO COM E-MAIL PENDENTE & REENVIO DE CONFIRMAÇÃO
    // ----------------------------------------------------------------------------
    console.log('\x1b[36m[GRUPO 1] Cadastro e Confirmação de E-mail Pendente\x1b[0m');

    // 1.1 Cadastro no Supabase com confirmação de e-mail exigida (retorna session: null)
    const mockSignupWithConfirm = async (url, opts) => {
      const body = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'b1111111-2222-3333-4444-555555555555',
          email: body.email,
          user_metadata: body.data,
          session: null // Supabase retorna session null quando exige confirmação
        })
      };
    };

    const signupRes = await signUpWithSupabase({
      supabaseUrl: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      email: 'beatriz.atleta@exemplo.com',
      password: 'senhaSegura123',
      name: 'Beatriz Tenista',
      fetchFn: mockSignupWithConfirm
    });

    assert(signupRes.requiresConfirmation === true, 'signUpWithSupabase identifica que confirmação é necessária');
    assert(signupRes.session === null, 'signupRes não possui sessão ativa antes da confirmação');
    assert(signupRes.message.includes('Verifique seu e-mail'), 'Mensagem orienta usuário a verificar caixa postal');

    // 1.2 Reenvio de e-mail de confirmação (resendConfirmationEmail)
    let resendEndpointCalled = null;
    let resendBodySent = null;
    const mockResendSuccess = async (url, opts) => {
      resendEndpointCalled = url;
      resendBodySent = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ message: 'ok' })
      };
    };

    const resendRes = await resendConfirmationEmail({
      email: 'beatriz.atleta@exemplo.com',
      fetchFn: mockResendSuccess
    });

    assert(resendRes.success === true, 'resendConfirmationEmail reporta sucesso');
    assert(resendEndpointCalled.endsWith('/auth/v1/resend'), 'Chama o endpoint oficial /auth/v1/resend');
    assert(resendBodySent.type === 'signup', 'Envia type: "signup" no corpo do reenvio');
    assert(resendBodySent.email === 'beatriz.atleta@exemplo.com', 'Envia o e-mail correto para confirmação');

    // 1.3 Rejeição de e-mail inválido no reenvio
    let caughtInvalidResend = false;
    try {
      await resendConfirmationEmail({ email: 'sem-arroba', fetchFn: mockResendSuccess });
    } catch (e) {
      caughtInvalidResend = true;
      assert(e.message.includes('e-mail válido'), 'Rejeita e-mail inválido para reenvio');
    }
    assert(caughtInvalidResend, 'Validação de e-mail no reenvio confirmada');

    // ----------------------------------------------------------------------------
    // GRUPO 2: MAPEAMENTO DO ERRO "EMAIL NOT CONFIRMED" NO LOGIN
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 2] Detecção Estrita de Erro "Email not confirmed"\x1b[0m');

    // 2.1 Simula resposta oficial do Supabase Auth quando e-mail não foi confirmado
    const mockUnconfirmedLogin = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Email not confirmed'
      })
    });

    let caughtUnconfirmed = null;
    try {
      await authenticateSupabaseUser({
        supabaseUrl: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        email: 'beatriz.atleta@exemplo.com',
        password: 'senhaSegura123',
        fetchFn: mockUnconfirmedLogin
      });
    } catch (err) {
      caughtUnconfirmed = err;
    }

    assert(Boolean(caughtUnconfirmed), 'authenticateSupabaseUser lança erro ao falhar');
    assert(caughtUnconfirmed.code === 'EMAIL_NOT_CONFIRMED', 'Código de erro mapeado exatamente como EMAIL_NOT_CONFIRMED');
    assert(caughtUnconfirmed.message.includes('E-mail não confirmado'), 'Mensagem amigável informa sobre a confirmação pendente');
    assert(!caughtUnconfirmed.message.includes('Credenciais inválidas'), 'NÃO confunde e-mail não confirmado com senha incorreta');

    // 2.2 Simula erro de credenciais incorretas reais
    const mockWrongPassword = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Invalid login credentials'
      })
    });

    let caughtWrongPass = null;
    try {
      await authenticateSupabaseUser({
        supabaseUrl: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        email: 'beatriz.atleta@exemplo.com',
        password: 'senhaErrada',
        fetchFn: mockWrongPassword
      });
    } catch (err) {
      caughtWrongPass = err;
    }
    assert(caughtWrongPass && caughtWrongPass.code === 'invalid_grant', 'Erro de credencial mantém código invalid_grant');
    assert(caughtWrongPass.message.includes('Credenciais inválidas'), 'Mensagem informa sobre credenciais incorretas');

    // ----------------------------------------------------------------------------
    // GRUPO 3: LOGIN DE CONTA CONFIRMADA & AUTO-PROVISIONAMENTO NO SQLITE
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 3] Auto-Provisionamento de Atleta no SQLite (LV 1, 0 XP)\x1b[0m');

    const beatrizCloudId = 'd4b857f8-9a3c-4e89-b31a-637dc8c78a01';
    const nowSec = Math.floor(Date.now() / 1000);

    const beatrizToken = createTestJwt({
      payload: {
        sub: beatrizCloudId,
        aud: 'authenticated',
        email: 'beatriz.atleta@exemplo.com',
        exp: nowSec + 3600,
        iss: `${process.env.SUPABASE_URL}/auth/v1`,
        user_metadata: {
          name: 'Beatriz Tenista',
          full_name: 'Beatriz Tenista'
        }
      }
    });

    // Chama o endpoint de login com token do notebook
    const beatrizLoginRes = await makeRequest(server, '/api/auth/cloud/login-with-token', {
      method: 'POST',
      body: {
        access_token: beatrizToken,
        create_if_missing: true,
        password: 'senhaSegura123'
      }
    });

    assert(beatrizLoginRes.statusCode === 200, 'POST /api/auth/cloud/login-with-token responde com 200');
    assert(beatrizLoginRes.body.success === true, 'Login reporta success = true');
    assert(Boolean(beatrizLoginRes.body.token), 'Retorna token JWT de sessão local para o atleta');
    assert(beatrizLoginRes.body.user.cloudUserId === beatrizCloudId, 'user.cloudUserId corresponde ao UUID cloud');

    const beatrizUserId = beatrizLoginRes.body.user.id;
    assert(beatrizUserId !== 2, `Novo atleta recebe ID SQLite próprio (${beatrizUserId}) diferente de Nicolas (2)`);

    // Valida o registro de atleta criado em `players`
    const beatrizPlayer = await get('SELECT * FROM players WHERE user_id = ?', [beatrizUserId]);
    assert(Boolean(beatrizPlayer), 'Registro esportivo em players criado automaticamente');
    assert(beatrizPlayer.level === 1, 'Novo atleta inicia com Nível 1');
    assert(beatrizPlayer.xp === 0, 'Novo atleta inicia com 0 XP');
    assert(beatrizPlayer.title === 'Iniciante', 'Novo atleta inicia com título Iniciante');
    assert(beatrizPlayer.precision === 0, 'Novo atleta inicia com precisão 0');

    // Valida a associação 1:1 na tabela `user_cloud_identities`
    const beatrizCloudIdentity = await get(
      'SELECT * FROM user_cloud_identities WHERE user_id = ? AND cloud_user_id = ?',
      [beatrizUserId, beatrizCloudId]
    );
    assert(Boolean(beatrizCloudIdentity), 'Identidade cloud registrada 1:1 em user_cloud_identities');
    assert(beatrizCloudIdentity.email === 'beatriz.atleta@exemplo.com', 'E-mail salvo na identidade cloud');

    // ----------------------------------------------------------------------------
    // GRUPO 4: IDEMPOTÊNCIA DE RE-LOGIN & ISOLAMENTO DE ATLETAS
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 4] Idempotência de Re-Login e Isolamento entre Atletas\x1b[0m');

    // 4.1 Re-login com o mesmo atleta não duplica registros
    const beatrizReloginRes = await makeRequest(server, '/api/auth/cloud/login-with-token', {
      method: 'POST',
      body: {
        access_token: beatrizToken,
        create_if_missing: true,
        password: 'senhaSegura123'
      }
    });

    assert(beatrizReloginRes.statusCode === 200, 'Re-login responde 200');
    assert(beatrizReloginRes.body.user.id === beatrizUserId, 'Re-login retorna exatamente o mesmo user.id');

    const totalBeatrizUsers = await all('SELECT id FROM users WHERE supabase_user_id = ?', [beatrizCloudId]);
    assert(totalBeatrizUsers.length === 1, 'Nenhum usuário duplicado criado no re-login');

    const totalBeatrizPlayers = await all('SELECT id FROM players WHERE user_id = ?', [beatrizUserId]);
    assert(totalBeatrizPlayers.length === 1, 'Nenhum perfil duplicado em players');

    // 4.2 Segundo atleta (Carlos) faz login
    const carlosCloudId = 'c5a746e7-8b2b-3d78-a209-526cb7b67902';
    const carlosToken = createTestJwt({
      payload: {
        sub: carlosCloudId,
        aud: 'authenticated',
        email: 'carlos.silva@exemplo.com',
        exp: nowSec + 3600,
        iss: `${process.env.SUPABASE_URL}/auth/v1`,
        user_metadata: {
          name: 'Carlos Silva'
        }
      }
    });

    const carlosLoginRes = await makeRequest(server, '/api/auth/cloud/login-with-token', {
      method: 'POST',
      body: {
        access_token: carlosToken,
        create_if_missing: true,
        password: 'senhaDoCarlos456'
      }
    });

    assert(carlosLoginRes.statusCode === 200, 'Segundo atleta (Carlos) autentica com sucesso 200');
    const carlosUserId = carlosLoginRes.body.user.id;
    assert(carlosUserId !== beatrizUserId, `Carlos (user_id=${carlosUserId}) isolado de Beatriz (user_id=${beatrizUserId})`);
    assert(carlosUserId !== 2, `Carlos isolado de Nicolas (id=2)`);

    const carlosPlayer = await get('SELECT * FROM players WHERE user_id = ?', [carlosUserId]);
    assert(carlosPlayer.level === 1 && carlosPlayer.xp === 0, 'Carlos recebe seu próprio perfil independente (LV 1, 0 XP)');

    // ----------------------------------------------------------------------------
    // GRUPO 5: PRESERVAÇÃO INTEGRAL DA CONTA DO NICOLAS (ID=2)
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 5] Preservação da Conta de Nicolas (id=2, XP mantido)\x1b[0m');

    const nicolasUser = await get('SELECT id, username, name, role, status, supabase_user_id FROM users WHERE id = 2');
    assert(Boolean(nicolasUser), 'Conta de Nicolas existe no banco');
    assert(nicolasUser.username === 'nicolas', 'Username de Nicolas intacto');
    assert(nicolasUser.role === 'player', 'Role de Nicolas intacto');
    assert(nicolasUser.status === 'active', 'Status de Nicolas intacto');
    assert(nicolasUser.supabase_user_id === '0ef1cdd9-085b-4256-9b2f-94711da0e501', 'UUID cloud do Nicolas preservado');

    const nicolasPlayer = await get('SELECT * FROM players WHERE user_id = 2');
    assert(Boolean(nicolasPlayer), 'Perfil esportivo de Nicolas intacto');
    assert(nicolasPlayer.level === 10, `Nível de Nicolas preservado (${nicolasPlayer.level} = 10)`);
    assert(nicolasPlayer.xp === 25, `XP de Nicolas preservado (${nicolasPlayer.xp} XP)`);

    // ----------------------------------------------------------------------------
    // GRUPO 6: LOGIN OFFLINE COM CREDENCIAIS LOCAIS & PAINEL ADMIN
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 6] Login Offline e Visibilidade no Painel Admin\x1b[0m');

    // 6.1 Login offline da Beatriz via POST /api/auth/login usando username
    const beatrizDbUser = await get('SELECT username FROM users WHERE id = ?', [beatrizUserId]);
    const offlineLoginByUsername = await makeRequest(server, '/api/auth/login', {
      method: 'POST',
      body: {
        username: beatrizDbUser.username,
        password: 'senhaSegura123'
      }
    });

    assert(offlineLoginByUsername.statusCode === 200, 'Login offline por username responde com 200');
    assert(offlineLoginByUsername.body.success === true, 'Login offline reporta success = true');
    assert(offlineLoginByUsername.body.user.id === beatrizUserId, 'Login offline retorna o ID correto de Beatriz');

    // 6.2 Login offline da Beatriz via POST /api/auth/login usando e-mail
    const offlineLoginByEmail = await makeRequest(server, '/api/auth/login', {
      method: 'POST',
      body: {
        username: 'beatriz.atleta@exemplo.com',
        password: 'senhaSegura123'
      }
    });

    assert(offlineLoginByEmail.statusCode === 200, 'Login offline por e-mail responde com 200');
    assert(offlineLoginByEmail.body.user.id === beatrizUserId, 'Login offline por e-mail identifica Beatriz corretamente');

    // 6.3 Rejeição de senha errada offline
    const wrongOfflineLogin = await makeRequest(server, '/api/auth/login', {
      method: 'POST',
      body: {
        username: 'beatriz.atleta@exemplo.com',
        password: 'senhaIncorreta'
      }
    });
    assert(wrongOfflineLogin.statusCode === 401, 'Login offline com senha errada rejeitado com 401');

    // 6.4 Painel Admin: Consulta GET /api/admin/users
    // Gera token de admin para autenticação na rota protegida
    const adminUser = await get('SELECT * FROM users WHERE role = "admin" LIMIT 1');
    const { generateToken } = require('../server/services/authService');
    const adminToken = generateToken(adminUser);

    const adminUsersRes = await makeRequest(server, '/api/admin/users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    assert(adminUsersRes.statusCode === 200, 'GET /api/admin/users autenticado responde com 200');
    assert(Array.isArray(adminUsersRes.body), 'Retorna lista de usuários do sistema');

    const adminBeatriz = adminUsersRes.body.find((u) => u.id === beatrizUserId);
    assert(Boolean(adminBeatriz), 'Beatriz aparece listada no painel administrativo');
    assert(adminBeatriz.cloud_email === 'beatriz.atleta@exemplo.com', 'E-mail cloud exibido no painel admin');
    assert(adminBeatriz.level === 1 && adminBeatriz.xp === 0, 'Nível e XP corretos no painel admin');

    const adminCarlos = adminUsersRes.body.find((u) => u.id === carlosUserId);
    assert(Boolean(adminCarlos), 'Carlos aparece listado no painel administrativo');

    // 6.5 Recuperação de senha online (recoverPasswordWithSupabase)
    let recoverEndpointCalled = null;
    let recoverBodySent = null;
    const mockRecoverSuccess = async (url, opts) => {
      recoverEndpointCalled = url;
      recoverBodySent = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({})
      };
    };

    const recoverRes = await recoverPasswordWithSupabase({
      supabaseUrl: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      email: 'beatriz.atleta@exemplo.com',
      fetchFn: mockRecoverSuccess
    });

    assert(recoverRes.success === true, 'recoverPasswordWithSupabase reporta sucesso');
    assert(recoverEndpointCalled.endsWith('/auth/v1/recover'), 'Chama o endpoint oficial /auth/v1/recover');
    assert(recoverBodySent.email === 'beatriz.atleta@exemplo.com', 'Envia e-mail correto para recuperação');

  } finally {
    // Encerra servidor HTTP e fecha banco de dados temporário
    await new Promise((resolve) => server.close(resolve));
    await closeDb();

    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    } catch (_) {}
  }

  console.log('\n======================================================');
  console.log(`  RESULTADO DOS TESTES DA FASE C:`);
  console.log(`  Total: ${passedTests + failedTests}`);
  console.log(`  ✔ Aprovados: ${passedTests}`);
  console.log(`  ✖ Falhas:    ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
