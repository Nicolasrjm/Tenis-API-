/**
 * ==============================================================================
 * MOTION TENNIS — SUÍTE DE TESTES DA ETAPA B: CONFIGURAÇÃO SUPABASE E IDENTIDADE
 * ==============================================================================
 * Executa testes automatizados locais para validar:
 * 1. Funcionamento offline sem configuração (resiliência offline-first).
 * 2. Inicialização segura com configuração presente.
 * 3. Bloqueio e neutralização estrita de service_role.
 * 4. Rejeição de tokens inválidos, expirados, malformados ou com audiência errada.
 * 5. Validação criptográfica de tokens Supabase válidos.
 * 6. Preservação integral dos dados de usuários locais sem vínculo cloud.
 * 7. Associação segura 1:1 entre usuário local e UUID Supabase Auth (link/unlink).
 * 8. Rejeição de tokens Supabase de usuários não vinculados (código CLOUD_USER_NOT_LINKED).
 * 9. Não exposição de segredos ou chaves privadas na API pública/frontend.
 * ==============================================================================
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Garante isolamento: usa cópia temporária do banco SQLite para não alterar smart_tennis.db
const originalDbPath = path.resolve(__dirname, '..', 'server', 'database', 'smart_tennis.db');
const tempDbPath = path.resolve(__dirname, '..', 'server', 'database', `test_etapa_b_${Date.now()}.db`);

fs.copyFileSync(originalDbPath, tempDbPath);
process.env.SMART_TENNIS_DB_PATH = tempDbPath;

const { get, run, all } = require('../server/database/db');
const { initializeDatabase } = require('../server/database/initDb');
const {
  isSupabaseConfigured,
  getSupabaseConfig,
  getPublicClientConfig,
  getEquipmentConfig,
  isValidUuid,
  isValidJwt,
  isValidAnonKey,
  isValidSupabaseUrl
} = require('../server/config/supabaseConfig');

const {
  verifySupabaseToken,
  getLinkedUserByCloudId,
  getCloudIdentityForUser,
  linkLocalUserToCloud,
  unlinkLocalUserFromCloud
} = require('../server/services/cloudIdentityService');

const {
  verifyPassword,
  generateToken,
  verifyToken,
  resolveTokenUser
} = require('../server/services/authService');

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

// Helper para criar JWTs de teste com cabeçalho e payload
function createTestJwt({ header = { alg: 'HS256', typ: 'JWT' }, payload, secret = 'test-jwt-secret-12345678901234567890' }) {
  const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${hB64}.${pB64}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  MOTION TENNIS — TESTES ETAPA B (SUPABASE & IDENTIDADE)');
  console.log('======================================================\n');

  let savedUrl = process.env.SUPABASE_URL;
  let savedAnon = process.env.SUPABASE_ANON_KEY;

  try {
    // ----------------------------------------------------------------------------
    // GRUPO 1: BANCO SQLITE E MIGRAÇÃO NÃO-DESTRUTIVA
    // ----------------------------------------------------------------------------
    console.log('\x1b[36m[GRUPO 1] Integridade do SQLite e Migrações Aditivas\x1b[0m');
    await initializeDatabase(false);

    const cols = await all(`PRAGMA table_info(users)`);
    const hasSupabaseCol = cols.some((c) => c.name === 'supabase_user_id');
    assert(hasSupabaseCol, 'Coluna supabase_user_id adicionada à tabela users sem perda de dados');

    const uciTable = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_cloud_identities'`);
    assert(Boolean(uciTable), 'Tabela user_cloud_identities criada no SQLite com chaves únicas');

    // ----------------------------------------------------------------------------
    // GRUPO 2: AUSÊNCIA DE CONFIGURAÇÃO (MODO OFFLINE-FIRST)
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 2] Resiliência Offline na Ausência de Configuração\x1b[0m');

    // Limpa temporariamente variáveis de ambiente cloud
    const savedUrl = process.env.SUPABASE_URL;
    const savedAnon = process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    assert(!isSupabaseConfigured(), 'isSupabaseConfigured() retorna FALSE na ausência de configuração');

    const offlinePublicCfg = getPublicClientConfig();
    assert(
      offlinePublicCfg.configured === false && offlinePublicCfg.supabaseUrl === null && offlinePublicCfg.anonKey === null,
      'Configuração pública offline indica configured = false sem expor chaves'
    );

    // Usuário local faz login normalmente e gera token local
    const nicUser = await get("SELECT * FROM users WHERE username = 'nicolas'");
    assert(Boolean(nicUser), 'Usuário local Nicolas presente no banco');
    assert(verifyPassword('nicolas123', nicUser.password_hash, nicUser.salt), 'Senha local PBKDF2 válida');

    const localToken = generateToken(nicUser);
    assert(typeof localToken === 'string' && localToken.split('.').length === 2, 'Token local gerado no formato clássico de 2 partes');

    const verifiedLocal = verifyToken(localToken);
    assert(verifiedLocal && verifiedLocal.id === nicUser.id, 'Token local verificado com sucesso pelo authService');

    const resolvedLocal = await resolveTokenUser(localToken);
    assert(resolvedLocal && resolvedLocal.authType === 'local' && resolvedLocal.user.id === nicUser.id, 'resolveTokenUser resolve autenticação local sem dependência de nuvem');

    // ----------------------------------------------------------------------------
    // GRUPO 3: CONFIGURAÇÃO PRESENTE E INICIALIZAÇÃO SEGURA
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 3] Inicialização Segura com Configuração Cloud\x1b[0m');

    const dummyAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZiIsInJvbGUiOiJhbm9uIiwiZXhwIjoxOTk5OTk5OTk5fQ.sample_signature_value';
    process.env.SUPABASE_URL = 'https://motion-tennis-test.supabase.co';
    process.env.SUPABASE_ANON_KEY = dummyAnonKey;
    process.env.SUPABASE_JWT_SECRET = 'segredo-jwt-teste-com-mais-de-32-chars-longos!';

    assert(isSupabaseConfigured(), 'isSupabaseConfigured() retorna TRUE com URL e AnonKey válidos');

    const fullCfg = getSupabaseConfig();
    assert(
      fullCfg.configured === true && fullCfg.url === 'https://motion-tennis-test.supabase.co' && fullCfg.anonKey === dummyAnonKey,
      'getSupabaseConfig() extrai URL e AnonKey normatizados'
    );

    const publicCfg = getPublicClientConfig();
    assert(
      publicCfg.configured === true &&
      publicCfg.supabaseUrl === 'https://motion-tennis-test.supabase.co' &&
      publicCfg.anonKey === dummyAnonKey &&
      publicCfg.jwtSecret === undefined,
      'getPublicClientConfig() NUNCA expõe jwtSecret ao cliente'
    );

    // Validação de formato de chaves anon modernas e bloqueio de administrativas
    const modernPublishableKey = 'sbp_test1234567890abcdefghijklmn_court';
    assert(isValidAnonKey(modernPublishableKey), 'isValidAnonKey aceita chave pública moderna com prefixo sbp_');

    const pkKey = 'pk_test1234567890abcdefghijklmn_court';
    assert(isValidAnonKey(pkKey), 'isValidAnonKey aceita chave pública moderna com prefixo pk_');

    const secretSbsKey = 'sbs_test1234567890abcdefghijklmn_court';
    assert(!isValidAnonKey(secretSbsKey), 'isValidAnonKey rejeita chave secreta com prefixo sbs_');

    const secretSkKey = 'sk_test1234567890abcdefghijklmn_court';
    assert(!isValidAnonKey(secretSkKey), 'isValidAnonKey rejeita chave secreta com prefixo sk_');

    const serviceRoleJwt = createTestJwt({
      payload: { iss: 'supabase', role: 'service_role', exp: 2000000000 },
      secret: 'any-secret'
    });
    assert(!isValidAnonKey(serviceRoleJwt), 'isValidAnonKey rejeita chave JWT que possua role: service_role');

    // ----------------------------------------------------------------------------
    // GRUPO 4: BLOQUEIO E NEUTRALIZAÇÃO ESTRITA DE SERVICE_ROLE
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 4] Defesa Estatutária contra SUPABASE_SERVICE_ROLE_KEY\x1b[0m');

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret_service_role_key';
    // Recarrega o módulo para disparar o guard estatutário
    delete require.cache[require.resolve('../server/config/supabaseConfig')];
    const reloadedConfig = require('../server/config/supabaseConfig');

    assert(
      process.env.SUPABASE_SERVICE_ROLE_KEY === undefined,
      'SUPABASE_SERVICE_ROLE_KEY é sumariamente apagada e neutralizada de process.env'
    );

    const checkPublicAgain = reloadedConfig.getPublicClientConfig();
    assert(
      checkPublicAgain.service_role === undefined && checkPublicAgain.serviceRole === undefined,
      'Configuração pública nunca referencia ou contém service_role'
    );

    // ----------------------------------------------------------------------------
    // GRUPO 5: VALIDAÇÃO DE TOKENS SUPABASE AUTH (REJEIÇÃO DE TOKENS INVÁLIDOS)
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 5] Rejeição Estrita de Tokens Supabase Inválidos\x1b[0m');

    const testSecret = 'segredo-jwt-teste-com-mais-de-32-chars-longos!';
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const pastExp = Math.floor(Date.now() / 1000) - 3600;

    // Caso A: Formato corrompido
    const malformedRes = await verifySupabaseToken('invalid.token', { jwtSecret: testSecret });
    assert(!malformedRes.valid && malformedRes.code === 'MALFORMED_JWT', 'Rejeita token com menos de 3 segmentos');

    // Caso B: Token expirado
    const expiredJwt = createTestJwt({
      payload: { sub: validUuid, aud: 'authenticated', exp: pastExp, iss: 'https://motion-tennis-test.supabase.co/auth/v1' },
      secret: testSecret
    });
    const expiredRes = await verifySupabaseToken(expiredJwt, { jwtSecret: testSecret });
    assert(!expiredRes.valid && expiredRes.code === 'TOKEN_EXPIRED', 'Rejeita token com expiração no passado');

    // Caso C: Audiência incorreta
    const wrongAudJwt = createTestJwt({
      payload: { sub: validUuid, aud: 'anon', exp: futureExp, iss: 'https://motion-tennis-test.supabase.co/auth/v1' },
      secret: testSecret
    });
    const wrongAudRes = await verifySupabaseToken(wrongAudJwt, { jwtSecret: testSecret });
    assert(!wrongAudRes.valid && wrongAudRes.code === 'INVALID_AUDIENCE', "Rejeita token com aud diferente de 'authenticated'");

    // Caso D: sub não é UUID
    const badSubJwt = createTestJwt({
      payload: { sub: 'not-a-uuid-1234', aud: 'authenticated', exp: futureExp, iss: 'https://motion-tennis-test.supabase.co/auth/v1' },
      secret: testSecret
    });
    const badSubRes = await verifySupabaseToken(badSubJwt, { jwtSecret: testSecret });
    assert(!badSubRes.valid && badSubRes.code === 'INVALID_SUB_UUID', 'Rejeita token onde sub não é um UUID válido');

    // Caso E: Assinatura HMAC incorreta / adulterada
    const tamperedJwt = createTestJwt({
      payload: { sub: validUuid, aud: 'authenticated', exp: futureExp, iss: 'https://motion-tennis-test.supabase.co/auth/v1' },
      secret: 'chave-totalmente-errada-para-teste!'
    });
    const tamperedRes = await verifySupabaseToken(tamperedJwt, { jwtSecret: testSecret });
    assert(!tamperedRes.valid && tamperedRes.code === 'INVALID_SIGNATURE', 'Rejeita token adulterado ou assinado com chave diferente');

    // Caso F: Algoritmo não suportado ou 'none'
    const algNoneJwt = createTestJwt({
      header: { alg: 'none', typ: 'JWT' },
      payload: { sub: validUuid, aud: 'authenticated', exp: futureExp, iss: 'https://motion-tennis-test.supabase.co/auth/v1' },
      secret: testSecret
    });
    const algNoneRes = await verifySupabaseToken(algNoneJwt, { jwtSecret: testSecret });
    assert(!algNoneRes.valid && algNoneRes.code === 'UNSUPPORTED_ALGORITHM', 'Rejeita token com algoritmo none');

    const algUnknownJwt = createTestJwt({
      header: { alg: 'MD5', typ: 'JWT' },
      payload: { sub: validUuid, aud: 'authenticated', exp: futureExp, iss: 'https://motion-tennis-test.supabase.co/auth/v1' },
      secret: testSecret
    });
    const algUnknownRes = await verifySupabaseToken(algUnknownJwt, { jwtSecret: testSecret });
    assert(!algUnknownRes.valid && algUnknownRes.code === 'UNSUPPORTED_ALGORITHM', 'Rejeita token com algoritmo inseguro/desconhecido');

    // Caso G: Emissor (iss) ausente
    const noIssJwt = createTestJwt({
      payload: { sub: validUuid, aud: 'authenticated', exp: futureExp },
      secret: testSecret
    });
    const noIssRes = await verifySupabaseToken(noIssJwt, { jwtSecret: testSecret });
    assert(!noIssRes.valid && noIssRes.code === 'MISSING_ISSUER', 'Rejeita token sem claim iss quando projeto está configurado');

    // Caso H: Emissor (iss) de outro projeto
    const wrongIssJwt = createTestJwt({
      payload: { sub: validUuid, aud: 'authenticated', exp: futureExp, iss: 'https://attacker-project.supabase.co/auth/v1' },
      secret: testSecret
    });
    const wrongIssRes = await verifySupabaseToken(wrongIssJwt, { jwtSecret: testSecret });
    assert(!wrongIssRes.valid && wrongIssRes.code === 'INVALID_ISSUER', 'Rejeita token com iss pertencente a outro projeto Supabase');

    // ----------------------------------------------------------------------------
    // GRUPO 6: TOKEN SUPABASE VÁLIDO E CLAIMS CONFORMES
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 6] Validação de Token Supabase Auth Autêntico\x1b[0m');

    const legitimateJwt = createTestJwt({
      payload: {
        sub: validUuid,
        aud: 'authenticated',
        email: 'atleta.nicolas@exemplo.com',
        exp: futureExp,
        iss: 'https://motion-tennis-test.supabase.co/auth/v1'
      },
      secret: testSecret
    });

    const validRes = await verifySupabaseToken(legitimateJwt, { jwtSecret: testSecret });
    assert(
      validRes.valid === true && validRes.cloudUserId === validUuid && validRes.email === 'atleta.nicolas@exemplo.com',
      'Token autêntico é validado com sucesso e extrai cloudUserId e email'
    );

    // ----------------------------------------------------------------------------
    // GRUPO 7: PRESERVAÇÃO INTEGRAL DE USUÁRIOS LOCAIS SEM VÍNCULO
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 7] Preservação de Usuários Locais Não Vinculados\x1b[0m');

    const adminUser = await get("SELECT * FROM users WHERE username = 'admin'");
    const adminCloudId = await getCloudIdentityForUser(adminUser.id);
    assert(adminCloudId === null, 'Usuário Admin local inicia sem nenhum vínculo cloud');
    assert(adminUser.role === 'admin' && adminUser.status === 'active', 'Dados e privilégios locais do Admin permanecem 100% intactos');

    const adminToken = generateToken(adminUser);
    const resolvedAdmin = await resolveTokenUser(adminToken);
    assert(resolvedAdmin && resolvedAdmin.user.username === 'admin', 'Admin faz login local normalmente sem conta Supabase');

    // ----------------------------------------------------------------------------
    // GRUPO 8: ASSOCIAÇÃO SEGURA 1:1 ENTRE ATLETA LOCAL E SUPABASE AUTH
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 8] Vinculação e Desvinculação Segura de Identidade\x1b[0m');

    // Vincula Nicolas local ao UUID legítimo
    const linkRes = await linkLocalUserToCloud({
      userId: nicUser.id,
      cloudUserId: validUuid,
      email: 'atleta.nicolas@exemplo.com'
    });
    assert(linkRes.success === true, 'Atleta Nicolas vinculado com sucesso à conta Supabase Auth');

    // Busca reversa
    const linkedFound = await getLinkedUserByCloudId(validUuid);
    assert(linkedFound && linkedFound.id === nicUser.id && linkedFound.username === 'nicolas', 'getLinkedUserByCloudId localiza o usuário Nicolas através do UUID');

    // Autenticação via token Supabase no resolveTokenUser
    const resolvedSupabase = await resolveTokenUser(legitimateJwt);
    assert(
      resolvedSupabase && resolvedSupabase.authType === 'supabase' && resolvedSupabase.user.id === nicUser.id,
      'resolveTokenUser reconhece token Supabase válido e autentica o atleta Nicolas correspondente'
    );

    // Unicidade: impede vincular o mesmo UUID cloud a outro usuário local
    let duplicateRejected = false;
    try {
      await linkLocalUserToCloud({
        userId: adminUser.id,
        cloudUserId: validUuid,
        email: 'tentativa.duplicada@exemplo.com'
      });
    } catch (err) {
      duplicateRejected = true;
    }
    assert(duplicateRejected, 'Impede vincular o mesmo UUID Supabase a dois atletas locais diferentes');

    // Bloqueio de usuário inativo mesmo com token cloud válido
    await run("UPDATE users SET status = 'inactive' WHERE id = ?", [nicUser.id]);
    const resolvedInactive = await resolveTokenUser(legitimateJwt);
    assert(
      resolvedInactive && resolvedInactive.status === 403,
      'resolveTokenUser rejeita com status 403 autenticação de usuário local com status inativo'
    );
    // Restaura status ativo
    await run("UPDATE users SET status = 'active' WHERE id = ?", [nicUser.id]);

    // Desvinculação limpa
    const unlinkRes = await unlinkLocalUserFromCloud(nicUser.id);
    assert(unlinkRes.success === true, 'Desvinculação concluída com sucesso');

    const unlinkedAgain = await getLinkedUserByCloudId(validUuid);
    assert(unlinkedAgain === null, 'Identidade desvinculada não retorna mais usuário local');

    // Token válido para conta agora desvinculada retorna status 403 / CLOUD_USER_NOT_LINKED
    const resolvedUnlinked = await resolveTokenUser(legitimateJwt);
    assert(
      resolvedUnlinked && resolvedUnlinked.code === 'CLOUD_USER_NOT_LINKED' && resolvedUnlinked.status === 403,
      'Token de conta desvinculada é rejeitado com status 403 e código CLOUD_USER_NOT_LINKED'
    );

    // ----------------------------------------------------------------------------
    // GRUPO 9: PROTEÇÃO DO ENDPOINT CONTRA VINCULAÇÃO SEM COMPROVAÇÃO
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 9] Proteção contra Vinculação sem Comprovação Criptográfica\x1b[0m');

    const authRoutes = require('../server/routes/authRoutes');
    const linkRouteLayer = authRoutes.stack.find(
      (layer) => layer.route && layer.route.path === '/cloud/link' && layer.route.methods.post
    );
    assert(Boolean(linkRouteLayer), 'Rota POST /api/auth/cloud/link registrada no router');

    let statusCode = null;
    let jsonResponse = null;
    const mockReq = {
      user: { id: nicUser.id, role: 'player' },
      body: { cloud_user_id: validUuid } // Tentativa de burlar enviando UUID arbitrário sem token
    };
    const mockRes = {
      status(code) { statusCode = code; return this; },
      json(data) { jsonResponse = data; return this; }
    };

    const endpointHandler = linkRouteLayer.route.stack[linkRouteLayer.route.stack.length - 1].handle;
    await endpointHandler(mockReq, mockRes);

    assert(
      statusCode === 400 && jsonResponse?.code === 'TOKEN_REQUIRED',
      'POST /cloud/link rejeita tentativa de vincular com apenas cloud_user_id sem token'
    );

  } finally {
    // Restaura ambiente e limpa banco temporário
    if (savedUrl) process.env.SUPABASE_URL = savedUrl;
    else delete process.env.SUPABASE_URL;

    if (savedAnon) process.env.SUPABASE_ANON_KEY = savedAnon;
    else delete process.env.SUPABASE_ANON_KEY;

    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch (e) {}

    console.log('\n======================================================');
    console.log(`  RESULTADO: ${passedTests} aprovados, ${failedTests} reprovados`);
    console.log('======================================================\n');
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTests();
