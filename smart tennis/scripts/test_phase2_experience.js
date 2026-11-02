// SMART TENNIS — TESTES DA FASE 2 (MODO SHOPPING / MODO PESSOAL)
//
// Executa o servidor REAL (node server/index.js) em processo filho, sobre uma CÓPIA do banco SQLite
// (SMART_TENNIS_DB_PATH), com SMART_TENNIS_TEST_MODE=1 e rodadas curtas. O banco real NÃO é usado.
// A duração comercial de produção (120 s) não é alterada: a redução só vale com o modo de teste ligado.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require(path.join(__dirname, '..', 'node_modules', 'sqlite3'));
const { calculateWallGeometry } = require('../server/services/wallGeometry');

const ROOT = path.join(__dirname, '..');
const REAL_DB = path.join(ROOT, 'server', 'database', 'smart_tennis.db');
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-tennis-phase2-'));
const TEST_DB = path.join(TMP_DIR, 'test.db');
const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}/api`;
const ROUND = 3;      // segundos (somente modo de teste)
const INTERVAL = 2;   // segundos

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ [PASS] ${msg}`); }
  else { fail++; console.error(`  ❌ [FAIL] ${msg}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

let child = null;
function startServer(extraEnv = {}) {
  child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT), HOST: '127.0.0.1',
      SMART_TENNIS_DB_PATH: TEST_DB,
      SMART_TENNIS_TEST_MODE: '1',
      SMART_TENNIS_ROUND_SECONDS: String(ROUND),
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (d) => { if (process.env.VERBOSE) process.stdout.write(d); else if (String(d).includes('[EXPERIENCE]')) process.stdout.write('    ' + d); });
  child.stderr.on('data', (d) => process.stderr.write(d));
  return waitReady();
}
async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/status`); if (r.ok) return; } catch (e) { /* aguardando */ }
    await sleep(250);
  }
  throw new Error('Servidor de teste não ficou pronto');
}
function stopServer() {
  return new Promise((resolve) => {
    if (!child) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGKILL'); // queda abrupta (sem encerramento limpo)
    child = null;
  });
}

async function api(method, url, token, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* sem corpo */ }
  return { status: res.status, body: json };
}
async function login(username, password) {
  const r = await api('POST', '/auth/login', null, { username, password });
  if (r.status !== 200) throw new Error(`Login falhou para ${username}: ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.body.token, user: r.body.user };
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(TEST_DB, sqlite3.OPEN_READONLY);
    db.all(sql, params, (err, rows) => { db.close(); err ? reject(err) : resolve(rows); });
  });
}
const center = (preset, id) => {
  const s = calculateWallGeometry(preset).sectors.find((x) => x.id === id);
  return { x: s.centerX, y: s.centerY };
};
const evt = () => `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
async function hit(token, expId, p) { return api('POST', `/experience/${expId}/impact`, token, { ...p, client_event_id: evt() }); }
async function current(token) { return (await api('GET', '/experience/current', token)).body; }
async function waitStage(token, index, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const c = await current(token);
    if (c.experience && c.experience.stage.index === index) return c.experience;
    if (!c.experience && c.last && index === 'END') return c.last;
    await sleep(150);
  }
  throw new Error(`Timeout aguardando estágio ${index}`);
}

(async () => {
  const realHashBefore = sha(REAL_DB);
  fs.copyFileSync(REAL_DB, TEST_DB);

  // Snapshot do estado pré-existente (na cópia)
  const snap = async () => ({
    users: await dbAll('SELECT * FROM users ORDER BY id'),
    players: await dbAll('SELECT * FROM players ORDER BY id'),
    sessions: await dbAll('SELECT * FROM sessions ORDER BY id')
  });
  const before = await snap();

  console.log('================================================================');
  console.log('🎾 TESTES DA FASE 2 — MODO SHOPPING / MODO PESSOAL');
  console.log(`   Banco de teste (cópia): ${TEST_DB}`);
  console.log(`   Rodadas de teste: ${ROUND}s | Intervalos: ${INTERVAL}s (produção: 120s / 30s)`);
  console.log('================================================================');

  await startServer();
  const admin = await login('admin', 'admin123');
  const nicolas = await login('nicolas', 'nicolas123');

  // ---- 1/2. Alternância e persistência da configuração ----
  console.log('\nTESTE 1 — Tipo de instalação: alternância e permissão');
  let inst = (await api('GET', '/installation')).body;
  check(inst.mode === 'personal', `Padrão sem configuração prévia = personal (obtido: ${inst.mode})`);
  check(inst.roundSeconds === ROUND && inst.testMode === true, 'Modo de teste reduziu a rodada (somente nesta execução)');

  let r = await api('PUT', '/installation', nicolas.token, { mode: 'shopping' });
  check(r.status === 403, 'Jogador comum NÃO pode alterar o tipo de instalação (403)');
  r = await api('PUT', '/installation', null, { mode: 'shopping' });
  check(r.status === 401, 'Sem autenticação NÃO altera o tipo de instalação (401)');
  r = await api('PUT', '/installation', admin.token, { mode: 'xpto' });
  check(r.status === 400, 'Modo inválido é rejeitado (400)');
  r = await api('PUT', '/installation', admin.token, { mode: 'shopping', shoppingIntervalSeconds: 0 });
  check(r.status === 400, 'Intervalo inválido é rejeitado (400)');

  r = await api('POST', '/experience/start', nicolas.token);
  check(r.status === 400, 'Iniciar experiência no Modo Pessoal é recusado (400)');

  r = await api('PUT', '/installation', admin.token, { mode: 'shopping', shoppingIntervalSeconds: INTERVAL });
  check(r.status === 200 && r.body.mode === 'shopping' && r.body.shoppingIntervalSeconds === INTERVAL, 'Admin altera para Shopping e define intervalo');

  console.log('\nTESTE 2 — Persistência da configuração após reiniciar o servidor');
  await stopServer();
  await startServer();
  inst = (await api('GET', '/installation')).body;
  check(inst.mode === 'shopping' && inst.shoppingIntervalSeconds === INTERVAL, 'Shopping e intervalo persistiram após reinício');
  const adminToken = (await login('admin', 'admin123')).token;
  const nicToken = (await login('nicolas', 'nicolas123')).token;

  // ---- Jogador auxiliar (criado na CÓPIA) ----
  const created = await api('POST', '/admin/users', adminToken, { username: 'fase2_tester', name: 'Fase2 Tester', password: 'teste123', role: 'player' });
  check(created.status === 201 || created.status === 200, 'Jogador auxiliar criado (apenas na cópia do banco)');
  const tester = await login('fase2_tester', 'teste123');

  // ---- 3. Rodada 1 (Treino Livre) ----
  console.log('\nTESTE 3 — Rodada 1 (Treino Livre) e impactos');
  r = await api('POST', '/experience/start', nicToken);
  check(r.status === 201 && r.body.experience.stage.game === 'free', 'Nicolas inicia a experiência (etapa 0 = Treino Livre)');
  let exp = r.body.experience;
  const expId = exp.id;
  const preset = exp.wallPreset;
  check(exp.stage.plannedSeconds === ROUND, `Rodada com ${ROUND}s previstos`);
  check(exp.userId === nicolas.user.id, 'Experiência vinculada ao ID real do Nicolas');

  r = await api('POST', '/experience/start', nicToken);
  check(r.status === 409, 'Segunda experiência simultânea é recusada (409)');
  r = await api('POST', '/experience/start', tester.token);
  check(r.status === 409, 'Outro jogador não inicia enquanto há experiência ativa (409)');
  const busy = await current(tester.token);
  check(busy.busy === true && busy.experience === null, 'Outro jogador vê apenas "ocupado" (sem dados do Nicolas)');

  let c1 = center(preset, 1);
  r = await hit(nicToken, expId, c1);
  check(r.body.accepted && r.body.hit && r.body.points === 85, 'Treino Livre: centro do alvo 1 = +85');
  const dupId = evt();
  r = await api('POST', `/experience/${expId}/impact`, nicToken, { ...center(preset, 2), client_event_id: dupId });
  const afterFirst = r.body.state.round.score;
  r = await api('POST', `/experience/${expId}/impact`, nicToken, { ...center(preset, 2), client_event_id: dupId });
  check(r.body.duplicate === true && r.body.state.round.score === afterFirst, 'Impacto reenviado (mesmo client_event_id) NÃO é contado duas vezes');
  r = await hit(nicToken, expId, { x: 32, y: 23.75 });
  check(r.body.accepted && r.body.hit === false && r.body.points === 0 && r.body.classification === 'NEUTRAL_AREA', 'Corredor entre alvos: conta tentativa, 0 ponto');
  r = await hit(nicToken, expId, { x: 105, y: 50 });
  check(r.body.accepted === false && r.body.reason === 'OUT_OF_BOUNDS', 'Fora da parede: rejeitado');
  r = await hit(tester.token, expId, center(preset, 3));
  check(r.status === 403, 'Outro jogador NÃO consegue lançar impacto na experiência do Nicolas (403)');
  r = await api('POST', `/experience/${expId}/impact`, null, center(preset, 3));
  check(r.status === 401, 'Impacto sem autenticação é recusado (401)');

  exp = (await current(nicToken)).experience;
  check(exp.round.shots === 3 && exp.round.hits === 2 && exp.round.score === 170 && exp.round.neutral === 1,
    `Contadores corretos: 3 tentativas, 2 acertos, 170 pontos (obtido: ${exp.round.shots}/${exp.round.hits}/${exp.round.score})`);

  // ---- 8. F5 ----
  console.log('\nTESTE 8 — Recuperação após F5 (recarregar página)');
  const f5a = (await current(nicToken)).experience;
  await sleep(600);
  const f5b = (await current(nicToken)).experience;
  check(f5a.id === f5b.id && f5a.stage.startedAt === f5b.stage.startedAt && f5a.stage.endsAt === f5b.stage.endsAt,
    'Mesma experiência, mesmo início e mesmo fim de etapa após nova leitura (cronômetro não reinicia)');
  check(f5b.stage.remainingMs < f5a.stage.remainingMs, 'Tempo restante continua diminuindo');
  check(f5b.round.score === 170, 'Placar preservado na recarga');

  // ---- 4/5/6. Transição e intervalo ----
  console.log('\nTESTE 4/5/6 — Fim da rodada de 2 min (reduzida), intervalo, bloqueio e transição automática');
  const startedAt = f5b.startedAt;
  exp = await waitStage(nicToken, 1);
  const elapsed1 = exp.stage.startedAt - startedAt;
  check(elapsed1 === ROUND * 1000, `Rodada 1 durou exatamente ${ROUND}s (timestamps do servidor: ${elapsed1}ms)`);
  check(exp.stage.type === 'interval' && exp.stage.nextGame === 'single' && exp.stage.nextGameName === 'Liga Um por Vez', 'Intervalo 1 mostra o próximo jogo (Liga Um por Vez)');
  check(exp.results.length === 1 && exp.results[0].score === 170 && exp.results[0].status === 'COMPLETED', 'Resultado parcial da rodada 1 disponível no intervalo');
  check(exp.stage.plannedSeconds === INTERVAL, `Intervalo previsto = ${INTERVAL}s`);

  r = await hit(nicToken, expId, center(preset, 1));
  check(r.body.accepted === false && r.body.reason === 'INTERVAL_BLOCKED', 'Impacto durante o intervalo é BLOQUEADO');
  const midInt = (await current(nicToken)).experience;
  check(midInt.results[0].shots === 3 && midInt.totals.score === 170, 'Intervalo não contabilizou acertos nem erros');

  // Sessão salva uma vez
  let sess = await dbAll(`SELECT * FROM sessions WHERE id = ?`, [`exp_${expId}_r0`]);
  check(sess.length === 1 && sess[0].user_id === nicolas.user.id && sess[0].total_score === 170 && sess[0].mode === 'Treino Livre',
    'Rodada 1 salva em sessions para o ID do Nicolas (1 registro)');

  // ---- Rodada 2 (Liga Um por Vez) ----
  exp = await waitStage(nicToken, 2);
  check(exp.stage.game === 'single', 'Transição automática para Liga Um por Vez (sem novo login)');
  check(exp.stage.startedAt - midInt.stage.endsAt === 0, 'Rodada 2 começou exatamente no fim do intervalo (sem deriva)');
  let active = exp.round.activeSector;
  check(active >= 1 && active <= 6, `Alvo aceso inicial definido pelo servidor: ${active}`);
  const wrong = active === 1 ? 2 : 1;
  r = await hit(nicToken, expId, center(preset, wrong));
  check(r.body.accepted && r.body.hit === false && r.body.points === 0, 'Liga Um por Vez: alvo apagado NÃO pontua');
  r = await hit(nicToken, expId, center(preset, active));
  check(r.body.hit === true && r.body.points === 1 && r.body.state.round.activeSector !== active, 'Alvo aceso: +1 ponto e outro alvo (diferente) acende');

  // ---- Rodada 3 (Apagar Todos) + vitória antecipada ----
  console.log('\nTESTE 7 — Vitória antecipada em Apagar Todos');
  exp = await waitStage(nicToken, 4);
  check(exp.stage.game === 'clear_all', 'Transição automática para Apagar Todos');
  check(Object.values(exp.round.sectorStates).every((v) => v === true), 'Os 6 alvos começam acesos');
  r = await hit(nicToken, expId, center(preset, 1));
  check(r.body.hit && r.body.points === 100, 'Alvo aceso apagado (+100)');
  r = await hit(nicToken, expId, center(preset, 1));
  check(r.body.hit === false && r.body.reason === 'REACTIVATED' && r.body.state.round.sectorStates[1] === true, 'Alvo apagado atingido reacende');
  let last;
  for (let id = 1; id <= 6; id++) last = await hit(nicToken, expId, center(preset, id));
  check(last.body.won === true && last.body.state.state === 'COMPLETED' && last.body.state.endReason === 'WON', 'Todos apagados antes do fim: vitória registrada e experiência finalizada antecipadamente');
  check(last.body.state.stage.remainingMs === 0, 'Experiência finalizada não tem tempo restante');
  r = await hit(nicToken, expId, center(preset, 2));
  check(r.body.accepted === false && r.body.reason === 'EXPERIENCE_ENDED', 'Impacto após o encerramento NÃO é aceito');

  const summary = (await current(nicToken)).last;
  check(summary && summary.id === expId && summary.results.length === 3, 'Resumo geral das 3 rodadas disponível após o término');
  check(summary.results[2].won === true && summary.results[2].status === 'WON', 'Rodada 3 marcada como vencida');

  console.log('\nTESTE 10 — Salvamento sem duplicação');
  sess = await dbAll(`SELECT id, total_score FROM sessions WHERE id LIKE ?`, [`exp_${expId}_r%`]);
  check(sess.length === 3, `Exatamente 3 sessões salvas para a experiência (obtido: ${sess.length})`);
  await current(nicToken); await current(nicToken);
  const sess2 = await dbAll(`SELECT id FROM sessions WHERE id LIKE ?`, [`exp_${expId}_r%`]);
  check(sess2.length === 3, 'Leituras repetidas não duplicam resultados');
  const imp = await dbAll(`SELECT COUNT(*) AS n, SUM(accepted) AS acc FROM commercial_impacts WHERE experience_id = ?`, [expId]);
  check(imp[0].n > 0, `Impactos registrados em commercial_impacts (${imp[0].n} linhas, ${imp[0].acc} aceitos)`);

  // ---- 9. Reinício do backend durante a experiência ----
  console.log('\nTESTE 9 — Recuperação após reiniciar o backend');
  r = await api('POST', '/experience/start', nicToken);
  const exp2 = r.body.experience;
  await hit(nicToken, exp2.id, center(exp2.wallPreset, 4));
  await hit(nicToken, exp2.id, center(exp2.wallPreset, 5));
  await stopServer();
  await sleep(1000); // servidor "caído" por 1s (ainda dentro da rodada 1)
  await startServer();
  const nic2 = (await login('nicolas', 'nicolas123')).token;
  let rec = (await current(nic2)).experience;
  check(rec && rec.id === exp2.id && rec.stage.index === 0, 'Experiência restaurada na mesma etapa após reinício');
  check(rec.stage.endsAt === exp2.stage.endsAt && rec.round.score === 170, 'Mesmo prazo de término e placar preservado (cronômetro não foi reiniciado)');
  r = await hit(nic2, exp2.id, center(exp2.wallPreset, 6));
  check(r.body.accepted && r.body.state.round.score === 255, 'Impactos continuam sendo aceitos após a recuperação');
  await stopServer();
  await sleep((ROUND + 1) * 1000); // queda atravessa o fim da rodada 1 e entra no intervalo
  await startServer();
  const nic3 = (await login('nicolas', 'nicolas123')).token;
  rec = (await current(nic3)).experience;
  // Estágio esperado calculado só pela linha do tempo (início + durações), independente de quanto durou a queda
  const timeline = [ROUND, INTERVAL, ROUND, INTERVAL, ROUND].map((s) => s * 1000);
  const expectedIndex = (elapsedMs) => { let acc = 0; for (let i = 0; i < timeline.length; i++) { acc += timeline[i]; if (elapsedMs < acc) return i; } return timeline.length; };
  const expIdx = expectedIndex(rec.serverNow - exp2.startedAt);
  const expStageStart = timeline.slice(0, expIdx).reduce((a, b) => a + b, 0);
  check(rec.stage.index >= 1 && rec.stage.index === expIdx,
    `Queda atravessou o fim da rodada 1: servidor volta na etapa correta pelo relógio (esperada ${expIdx}, obtida ${rec.stage.index}) — tempo da queda conta`);
  check(rec.stage.startedAt === exp2.startedAt + expStageStart, 'A etapa recuperada começa exatamente no instante previsto pela linha do tempo (sem deriva)');
  check(rec.results.length >= 1 && rec.results[0].roundIndex === 0 && rec.results[0].score === 255, 'Rodada 1 finalizada na recuperação com o placar correto');
  const s9 = await dbAll(`SELECT id FROM sessions WHERE id = ?`, [`exp_${exp2.id}_r0`]);
  check(s9.length === 1, 'Resultado da rodada 1 salvo exatamente uma vez após o reinício');
  await stopServer();
  await sleep((INTERVAL + ROUND + INTERVAL + ROUND + 1) * 1000); // expira o restante da experiência com o servidor desligado
  await startServer();
  const nic4 = (await login('nicolas', 'nicolas123')).token;
  const after = await current(nic4);
  check(after.experience === null && after.last && after.last.id === exp2.id && after.last.state === 'COMPLETED',
    'Experiência cujo prazo total expirou durante a queda é encerrada como COMPLETED na recuperação');
  const s9b = await dbAll(`SELECT id FROM sessions WHERE id LIKE ?`, [`exp_${exp2.id}_r%`]);
  check(s9b.length === 1, 'Rodadas sem nenhum impacto (tempo corrido na queda) não geram sessões vazias; a rodada jogada não duplicou');
  const rounds9 = await dbAll(`SELECT round_index, status FROM commercial_rounds WHERE experience_id = ? ORDER BY round_index`, [exp2.id]);
  check(rounds9.length === 3 && rounds9.every((x) => x.status === 'COMPLETED'), 'As 3 rodadas constam como COMPLETED em commercial_rounds');

  // ---- Abortar ----
  console.log('\nTESTE — Interrupção manual (sem reiniciar cronômetro)');
  r = await api('POST', '/experience/start', nic4);
  const exp3 = r.body.experience;
  await hit(nic4, exp3.id, center(exp3.wallPreset, 1));
  r = await api('POST', `/experience/${exp3.id}/abort`, tester.token);
  check(r.status === 403, 'Outro jogador não pode interromper a experiência (403)');
  r = await api('PUT', '/installation', adminToken, { mode: 'personal' });
  check(r.status === 409, 'Admin não troca o tipo de instalação durante experiência ativa (409)');
  r = await api('POST', `/experience/${exp3.id}/abort`, nic4);
  check(r.status === 200 && r.body.experience.state === 'INTERRUPTED', 'Dono interrompe: estado INTERRUPTED');
  const s3 = await dbAll(`SELECT * FROM sessions WHERE id = ?`, [`exp_${exp3.id}_r0`]);
  check(s3.length === 1 && s3[0].total_score === 85, 'Rodada interrompida salva o que foi jogado (1 registro)');
  r = await hit(nic4, exp3.id, center(exp3.wallPreset, 1));
  check(r.body.accepted === false && r.body.reason === 'EXPERIENCE_ENDED', 'Sem impactos após interrupção');

  // ---- Hardware ----
  console.log('\nTESTE — Impactos de hardware respeitam o Modo Shopping');
  r = await api('POST', '/hardware/hit', null, { sector_id: 1, game_mode: 'free' });
  check(r.status === 409, 'Shopping sem experiência ativa: impacto de hardware ignorado (409)');
  r = await api('POST', '/experience/start', nic4);
  const exp4 = r.body.experience;
  r = await api('POST', '/hardware/hit', null, { sector_id: 2, game_mode: 'free', user_id: 1 });
  check(r.status === 201 && r.body.shopping === true && r.body.data.state.round.score === 85, 'Hardware durante a rodada vai para a experiência ativa (ignora user_id do corpo)');
  await api('POST', `/experience/${exp4.id}/abort`, nic4);

  // ---- 11. Modo Pessoal ----
  console.log('\nTESTE 11 — Modo Pessoal preservado');
  r = await api('PUT', '/installation', adminToken, { mode: 'personal' });
  check(r.status === 200 && r.body.mode === 'personal', 'Admin volta para Modo Pessoal');
  r = await api('POST', '/hardware/hit', nic4, { sector_id: 3, game_mode: 'single', target_sensor_id: 3, is_simulation: true });
  check(r.status === 201 && !r.body.shopping, 'Modo Pessoal: fluxo de impacto original (hardware/hit) continua funcionando');
  r = await api('POST', '/sessions', nic4, { mode: 'Treino Livre', shots_count: 10, hits_count: 8, accuracy: 80, total_score: 680, duration_seconds: 300, is_simulation: 1 });
  check(r.status === 201 && r.body.userId === nicolas.user.id, 'Modo Pessoal: salvamento de sessão original continua funcionando (sem limite de 2 min)');
  r = await api('POST', '/experience/start', nic4);
  check(r.status === 400, 'Modo Pessoal não cria experiência comercial');

  // ---- 12. Preservação ----
  console.log('\nTESTE 12 — Usuários e estatísticas existentes preservados (na cópia, linhas pré-existentes)');
  await stopServer();
  const afterSnap = await snap();
  const keep = (a, b, key) => a.every((row) => { const o = b.find((x) => x[key] === row[key]); return o && JSON.stringify(o) === JSON.stringify(row); });
  const usersBefore = before.users.filter((u) => u.username !== 'fase2_tester');
  check(keep(usersBefore, afterSnap.users, 'id'), `Usuários pré-existentes idênticos (${usersBefore.length})`);
  check(keep(before.players, afterSnap.players, 'id'), `Estatísticas/XP dos jogadores pré-existentes idênticos (${before.players.length})`);
  check(keep(before.sessions, afterSnap.sessions, 'id'), `Histórico de sessões pré-existente idêntico (${before.sessions.length})`);

  const realHashAfter = sha(REAL_DB);
  check(realHashBefore === realHashAfter, 'Banco REAL não foi tocado durante os testes (SHA-256 idêntico)');

  console.log('\n================================================================');
  console.log(`TOTAL: ${pass + fail} | APROVADOS: ${pass} | FALHAS: ${fail}`);
  console.log('================================================================');
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch (e) { /* ignora */ }
  process.exit(fail === 0 ? 0 : 1);
})().catch(async (err) => {
  console.error('ERRO NO TESTE:', err);
  await stopServer();
  process.exit(2);
});
