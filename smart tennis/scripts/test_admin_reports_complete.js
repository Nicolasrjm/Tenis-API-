const { get, all, run } = require('../server/database/db');
const { generateToken, hashPassword } = require('../server/services/authService');
const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🎾 TESTES OBRIGATÓRIOS: RELATÓRIOS ADMINISTRATIVOS');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Obter usuário admin e gerar token para requisições
    const adminUser = await get(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
    assert(adminUser !== null, 'Usuário Administrador encontrado no banco');
    const adminToken = generateToken(adminUser);

    // 2. Garantir usuários de teste: Rogerio (id 3) e Teste (id 4)
    let rogerio = await get(`SELECT * FROM users WHERE username = 'rogerio'`);
    if (!rogerio) {
      const cred = hashPassword('123456');
      const ins = await run(`INSERT INTO users (username, name, password_hash, salt, role) VALUES ('rogerio', 'Rogerio Jogador', ?, ?, 'player')`, [cred.hash, cred.salt]);
      rogerio = await get(`SELECT * FROM users WHERE id = ?`, [ins.lastID]);
    }
    const rogerioToken = generateToken(rogerio);

    let nicolas = await get(`SELECT * FROM users WHERE username = 'nicolas'`);
    assert(nicolas !== null, 'Usuário Nicolas encontrado no banco');
    const nicolasToken = generateToken(nicolas);

    // 3. Teste do Endpoint /api/admin/reports com Token Admin
    console.log('\n[TESTE 1] Consulta de Relatórios pelo Administrador...');
    const app = require('../server/index'); // Inicia ou carrega o servidor

    // Aguarda 1 segundo para servidor escutar
    await new Promise(r => setTimeout(r, 1000));

    const repRealRes = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/admin/reports?period=all&origin=real',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    assert(repRealRes.status === 200, 'GET /api/admin/reports respondeu com status 200');
    assert(repRealRes.body.totalSessions !== undefined, 'totalSessions não é undefined');
    assert(repRealRes.body.totalHits !== undefined, 'totalHits não é undefined');
    assert(repRealRes.body.avgAccuracy !== undefined, 'avgAccuracy não é undefined');
    assert(!isNaN(repRealRes.body.avgAccuracy), 'avgAccuracy não é NaN');
    assert(repRealRes.body.activePlayers !== undefined, 'activePlayers não é undefined');
    assert(Array.isArray(repRealRes.body.weeklyTrend), 'weeklyTrend é um Array');
    assert(repRealRes.body.weeklyTrend.length === 7, 'weeklyTrend possui exatamente 7 dias cronológicos');
    assert(Array.isArray(repRealRes.body.modeDistribution), 'modeDistribution é um Array');
    assert(repRealRes.body.modeDistribution.length === 3, 'modeDistribution contempla os 3 modos');
    assert(Array.isArray(repRealRes.body.topPlayers), 'topPlayers é um Array');
    assert(Array.isArray(repRealRes.body.topSensors), 'topSensors é um Array');

    // 4. Teste de Partidas Reais vs Simuladas (Etapa 5)
    console.log('\n[TESTE 2] Criação de Partida Simulada e Isolamento das Partidas Reais...');
    const realSessionsBefore = repRealRes.body.totalSessions;

    // Cria partida simulada para Rogerio
    const simSessRes = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/sessions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${rogerioToken}`
      }
    }, {
      mode: 'Liga Um por Vez',
      shots_count: 20,
      hits_count: 16,
      accuracy: 80,
      total_score: 16,
      duration_seconds: 45,
      is_simulation: 1
    });

    assert(simSessRes.status === 201, 'Partida simulada criada com sucesso');

    // Cria partida REAL para Nicolas
    const realSessRes = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/sessions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nicolasToken}`
      }
    }, {
      mode: 'Treino Livre',
      shots_count: 30,
      hits_count: 27,
      accuracy: 90,
      total_score: 2295,
      duration_seconds: 60,
      is_simulation: 0
    });

    assert(realSessRes.status === 201, 'Partida real criada com sucesso');

    // Consulta com filtro de origin=real: deve ter aumentado apenas +1 (a do Nicolas)
    const repAfterReal = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/admin/reports?period=all&origin=real',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert(repAfterReal.body.totalSessions === realSessionsBefore + 1, 'Filtro origin=real contabilizou apenas a partida real');

    // Consulta com filtro de origin=simulation: deve incluir a partida simulada do Rogerio
    const repSimRes = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/admin/reports?period=all&origin=simulation',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert(repSimRes.body.totalSessions >= 1, 'Filtro origin=simulation encontrou partidas simuladas');
    const rogerioInSim = repSimRes.body.topPlayers.some(p => p.name === rogerio.name);
    assert(rogerioInSim, 'Rogerio aparece no relatório de simulações com sua partida simulada');

    // 5. Teste de Isolamento de Usuários (Etapa 4)
    console.log('\n[TESTE 3] Isolamento de Dados entre Jogadores...');
    // Rogerio consulta suas próprias sessões
    const rogerioSessions = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/sessions',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${rogerioToken}` }
    });

    const onlyRogerio = rogerioSessions.body.every(s => s.user_id === rogerio.id);
    assert(onlyRogerio, 'Rogerio vê exclusivamente suas próprias sessões (nenhuma sessão de outro jogador)');

    // Nicolas consulta suas próprias sessões
    const nicolasSessions = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/sessions',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${nicolasToken}` }
    });

    const onlyNicolas = nicolasSessions.body.every(s => s.user_id === nicolas.id);
    assert(onlyNicolas, 'Nicolas vê exclusivamente suas próprias sessões (nenhuma sessão de Rogerio)');

    // 6. Teste de Hardware IoT (Etapa 3 - Sensores mais ativos)
    console.log('\n[TESTE 4] Verificação de Sensores Físicos (Hardware IoT)...');
    assert(repAfterReal.body.hasHardwareSensors === false || repAfterReal.body.topSensors.length === 0, 'Sem dados de sensores reais de hardware, retorna lista vazia com mensagem informativa');

    console.log('\n====================================================');
    console.log(`RESULTADO FINAL: ${passed} PASSARAM, ${failed} FALHARAM.`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('ERRO DURANTE OS TESTES:', error);
    process.exit(1);
  }
}

runTests();
