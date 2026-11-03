/**
 * ==============================================================================
 * MOTION TENNIS — TESTES FASE A: AUDITORIA E CORREÇÃO DE REGRESSÕES
 * ==============================================================================
 * Valida de forma não-destrutiva:
 * 1. Resolução do erro SQLITE_ERROR: no such table: player_attributes na Academy.
 * 2. Disponibilidade das rotas públicas e autenticadas da Academy (/api/academy e /api/academy/:skill).
 * 3. Carregamento dos 6 atributos técnicos da tabela SQLite `attributes`.
 * 4. Carregamento dos dados de perfil do atleta (Nível, XP, Treinos, Recordes).
 * ==============================================================================
 */

const http = require('http');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Garante isolamento: banco SQLite temporário
const originalDbPath = path.resolve(__dirname, '..', 'server', 'database', 'smart_tennis.db');
const tempDbPath = path.resolve(__dirname, '..', 'server', 'database', `test_fase_a_${Date.now()}.db`);

fs.copyFileSync(originalDbPath, tempDbPath);
process.env.SMART_TENNIS_DB_PATH = tempDbPath;
process.env.SMART_TENNIS_TEST_MODE = '1';

const { get, run, all } = require('../server/database/db');
const authRoutes = require('../server/routes/authRoutes');
const academyRoutes = require('../server/routes/academyRoutes');
const playerRoutes = require('../server/routes/playerRoutes');
const skillsRoutes = require('../server/routes/skillsRoutes');

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

async function runTests() {
  console.log('\n======================================================');
  console.log('  MOTION TENNIS — TESTES FASE A (ACADEMY, PERFIL & ATRIBUTOS)');
  console.log('======================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/academy', academyRoutes);
  app.use('/api/player', playerRoutes);
  app.use('/api/skills', skillsRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    // ----------------------------------------------------------------------------
    // GRUPO 1: Autenticação de Nicolas
    // ----------------------------------------------------------------------------
    console.log('\x1b[36m[GRUPO 1] Autenticação Local do Atleta Nicolas\x1b[0m');

    const loginRes = await makeRequest(server, '/api/auth/login', {
      method: 'POST',
      body: { username: 'nicolas', password: 'nicolas123' }
    });

    assert(loginRes.statusCode === 200, 'Login local de Nicolas responde 200');
    assert(Boolean(loginRes.body.token), 'Token JWT de Nicolas gerado');
    const nicolasToken = loginRes.body.token;

    // ----------------------------------------------------------------------------
    // GRUPO 2: Rota GET /api/academy (Visitante e Autenticado)
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 2] Rota GET /api/academy (Sem erro player_attributes)\x1b[0m');

    // 1. Visitante (sem token)
    const academyGuest = await makeRequest(server, '/api/academy');
    assert(academyGuest.statusCode === 200, 'GET /api/academy público responde 200');
    assert(Array.isArray(academyGuest.body.skills), 'skills retornado como array');
    assert(academyGuest.body.skills.length === 6, 'Retorna os 6 módulos padrão para visitante');

    // 2. Autenticado com Nicolas (onde o erro ocorria ao buscar player_attributes)
    const academyAuth = await makeRequest(server, '/api/academy', {
      headers: { 'Authorization': `Bearer ${nicolasToken}` }
    });
    assert(academyAuth.statusCode === 200, 'GET /api/academy autenticado responde 200 (SEM ERRO player_attributes)');
    assert(Array.isArray(academyAuth.body.skills), 'skills retornado como array para atleta autenticado');
    assert(academyAuth.body.skills.length === 6, 'Retorna 6 módulos técnicos com dados do SQLite');
    const prec = academyAuth.body.skills.find(s => s.key === 'precision');
    assert(Boolean(prec && prec.level), `Módulo Precisão carregado com nível ${prec?.level}`);

    // ----------------------------------------------------------------------------
    // GRUPO 3: Rota GET /api/academy/:skill
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 3] Rota GET /api/academy/:skill\x1b[0m');

    const skills = ['precision', 'consistency', 'speed', 'control', 'reflex', 'strategy'];
    for (const sk of skills) {
      const res = await makeRequest(server, `/api/academy/${sk}`, {
        headers: { 'Authorization': `Bearer ${nicolasToken}` }
      });
      if (res.statusCode !== 200) {
        console.error(`Debug /api/academy/${sk}: status=${res.statusCode}, body=`, res.body);
      }
      assert(res.statusCode === 200, `GET /api/academy/${sk} responde 200 para atleta autenticado`);
    }

    // ----------------------------------------------------------------------------
    // GRUPO 4: Rota GET /api/player (Perfil Completo)
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 4] Rota GET /api/player (Nível, XP, Recordes)\x1b[0m');

    const playerRes = await makeRequest(server, '/api/player', {
      headers: { 'Authorization': `Bearer ${nicolasToken}` }
    });

    assert(playerRes.statusCode === 200, 'GET /api/player responde 200');
    assert(playerRes.body.name === 'Nicolas', 'Nome do atleta é Nicolas');
    assert(playerRes.body.level !== undefined && playerRes.body.level !== null, `Nível do atleta: LV. ${playerRes.body.level}`);
    assert(playerRes.body.xp !== undefined && playerRes.body.xp !== null, `Experiência do atleta: ${playerRes.body.xp} XP`);
    assert(playerRes.body.best_score !== undefined, `Melhor pontuação: ${playerRes.body.best_score} pts`);
    assert(playerRes.body.trainings_completed !== undefined, `Treinos completados: ${playerRes.body.trainings_completed}`);

    // ----------------------------------------------------------------------------
    // GRUPO 5: Rotas GET /api/skills/*
    // ----------------------------------------------------------------------------
    console.log('\n\x1b[36m[GRUPO 5] Rotas GET /api/skills/attributes\x1b[0m');

    const skillsRes = await makeRequest(server, '/api/skills/attributes', {
      headers: { 'Authorization': `Bearer ${nicolasToken}` }
    });
    assert(skillsRes.statusCode === 200, 'GET /api/skills/attributes responde 200');
    assert(Array.isArray(skillsRes.body) && skillsRes.body.length === 6, 'Retorna exatamente os 6 atributos da tabela attributes');

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
    console.log(`  RESULTADO FASE A: ${passedTests} aprovados, ${failedTests} reprovados`);
    console.log('======================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTests();
