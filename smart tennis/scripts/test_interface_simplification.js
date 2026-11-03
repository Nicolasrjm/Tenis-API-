/**
 * ==============================================================================
 * MOTION TENNIS — TESTES AUTOMATIZADOS: LIMPEZA E SIMPLIFICAÇÃO DA INTERFACE
 * ==============================================================================
 * Valida de forma não-destrutiva:
 * 1. LOGIN: Remoção de banner de servidor, latência, QR code, toggle Online/Local/Demo e demo buttons.
 * 2. LOGIN: Preservação de Logo, Entrar, Criar Conta, Visitante e Esqueci minha senha com auth interna.
 * 3. HEADER: Conquistas integrado no dropdown Desempenho; remoção de badge de equipamento.
 * 4. TELA JOGAR: Modo foco maximizado sem barra técnica redundante; 3 modos e regras preservadas.
 * 5. ACADEMY: Acesso restrito a 2 pontos (Notebook / Celular) e área administrativa única (/admin/academy).
 * 6. PERFIL: Remoção de botões destrutivos de SQLite da tela comum do atleta.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

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

function runSimplificationTests() {
  console.log('==============================================================================');
  console.log('🎾 MOTION TENNIS — TESTES DE LIMPEZA E SIMPLIFICAÇÃO DA INTERFACE');
  console.log('==============================================================================\n');

  const clientPath = path.resolve(__dirname, '..', 'client', 'src');
  const loginCode = fs.readFileSync(path.join(clientPath, 'pages', 'LoginPage.jsx'), 'utf8');
  const playerLayoutCode = fs.readFileSync(path.join(clientPath, 'layouts', 'PlayerLayout.jsx'), 'utf8');
  const playPageCode = fs.readFileSync(path.join(clientPath, 'pages', 'PlayPage.jsx'), 'utf8');
  const appCode = fs.readFileSync(path.join(clientPath, 'App.jsx'), 'utf8');
  const profilePageCode = fs.readFileSync(path.join(clientPath, 'pages', 'ProfilePage.jsx'), 'utf8');
  const adminLayoutCode = fs.readFileSync(path.join(clientPath, 'layouts', 'AdminLayout.jsx'), 'utf8');

  // ----------------------------------------------------------------------------
  // 1. LOGIN LIMPO E SIMPLIFICADO
  // ----------------------------------------------------------------------------
  console.log('--- GRUPO 1: Simplificação da Tela de Login ---');

  assert(!loginCode.includes('login-server-banner'), '1.1 - Banner de servidor online/offline removido');
  assert(!loginCode.includes('latency'), '1.2 - Latência em ms removida da interface');
  assert(!loginCode.includes('btn-login-scan-qr'), '1.3 - Botão de escanear QR code removido do login');
  assert(!loginCode.includes('QrScannerOverlay'), '1.4 - Componente QrScannerOverlay removido do login');
  assert(!loginCode.includes('link-login-mobile-connect'), '1.5 - Link de configurações técnicas removido');
  assert(!loginCode.includes("setLoginType('cloud')"), '1.6 - Seletor manual Online/Local removido da interface');
  assert(!loginCode.includes('Acesso Rápido de Demonstração'), '1.7 - Botões de demonstração rápida removidos');
  assert(!loginCode.includes('login-link-free-academy'), '1.8 - Link público redundante da Academy removido');

  // Elementos mantidos
  assert(loginCode.includes('MOTION') && loginCode.includes('TENNIS'), '1.9 - Logo Motion Tennis presente');
  assert(loginCode.includes('btn-enter-with-account'), '1.10 - Aba/Opção Entrar presente');
  assert(loginCode.includes('btn-register-tab'), '1.11 - Aba/Opção Criar Conta presente');
  assert(loginCode.includes('btn-play-as-guest'), '1.12 - Opção Jogar como Visitante presente');
  assert(loginCode.includes('Esqueci minha senha'), '1.13 - Fluxo Esqueci Minha Senha presente');
  assert(loginCode.includes('loginCloud') && loginCode.includes('login('), '1.14 - Decisão interna de mecanismo de auth preservada');

  // ----------------------------------------------------------------------------
  // 2. HEADER E NAVEGAÇÃO RESPONSIVA
  // ----------------------------------------------------------------------------
  console.log('\n--- GRUPO 2: Header e Navegação Simplificada ---');

  assert(playerLayoutCode.includes('btn-nav-desempenho'), '2.1 - Menu Desempenho preservado');
  assert(playerLayoutCode.includes('link-nav-statistics'), '2.2 - Estatísticas dentro de Desempenho');
  assert(playerLayoutCode.includes('link-nav-evolution'), '2.3 - Evolução dentro de Desempenho');
  assert(playerLayoutCode.includes('link-nav-achievements'), '2.4 - Conquistas agrupado dentro do dropdown Desempenho');
  assert(!playerLayoutCode.includes('MOTION TENNIS #001'), '2.5 - Badge técnico de equipamento removido do header do atleta');
  assert(playerLayoutCode.includes('to="/app/dashboard"'), '2.6 - Acesso ao Dashboard preservado');
  assert(playerLayoutCode.includes('to="/app/play"'), '2.7 - Acesso a Jogar preservado');
  assert(playerLayoutCode.includes('to="/app/academy"'), '2.8 - Acesso à Academy preservado');
  assert(playerLayoutCode.includes('to="/app/history"'), '2.9 - Acesso ao Histórico preservado');
  assert(playerLayoutCode.includes('to="/app/profile"'), '2.10 - Acesso ao Perfil preservado');

  // ----------------------------------------------------------------------------
  // 3. TELA JOGAR LIMPA E MODO FOCO
  // ----------------------------------------------------------------------------
  console.log('\n--- GRUPO 3: Tela Jogar e Modo Foco ---');

  assert(playPageCode.includes('mode-btn-free'), '3.1 - Modo Treino Livre preservado');
  assert(playPageCode.includes('mode-btn-single'), '3.2 - Modo Liga Um por Vez preservado');
  assert(playPageCode.includes('mode-btn-clear_all'), '3.3 - Modo Apagar Todos preservado');
  assert(playPageCode.includes('showWallAccordion'), '3.4 - Dimensões da parede em painel recolhível');
  assert(playPageCode.includes('IotDiagnosticPanel'), '3.5 - Diagnóstico IoT em painel recolhível');
  assert(playPageCode.includes('focus-game-viewport'), '3.6 - Viewport do Modo Foco maximizado presente');
  assert(playPageCode.includes('btn-end-match'), '3.7 - Botão Sair no Modo Foco');
  assert(playPageCode.includes('countdown-overlay'), '3.8 - Contagem regressiva de 5s presente');
  assert(!playPageCode.includes('BARRA INFERIOR DE FEEDBACK'), '3.9 - Barra inferior de feedback técnico removida do modo foco');
  assert(playPageCode.includes('Partida salva com sucesso'), '3.10 - Feedback limpo e fidedigno de sincronização');
  assert(!playPageCode.includes('enfileirada na outbox'), '3.11 - Termos técnicos de infraestrutura (outbox) removidos da visão comum');

  // ----------------------------------------------------------------------------
  // 4. ACADEMY: APENAS 2 PONTOS DE ACESSO DO ATLETA E 1 ADMIN
  // ----------------------------------------------------------------------------
  console.log('\n--- GRUPO 4: Consolidação dos Acessos da Academy ---');

  // Em App.jsx:
  assert(appCode.includes('path="/app"') && appCode.includes('path="academy"'), '4.1 - Ponto de Acesso A: No notebook (/app/academy)');
  assert(appCode.includes('path="/mobile"') && appCode.includes('path="academy"'), '4.2 - Ponto de Acesso B: No celular (/mobile/academy)');
  assert(appCode.includes('path="/admin"') && appCode.includes('path="academy"'), '4.3 - Área administrativa restrita (/admin/academy)');
  assert(!appCode.includes('<Route path="/academy" element={<AcademyPage />}'), '4.4 - Academy pública independente eliminada (redireciona para o app)');
  assert(adminLayoutCode.includes('/admin/academy'), '4.5 - Menu Academy integrado no AdminLayout');

  // ----------------------------------------------------------------------------
  // 5. PERFIL DO ATLETA LIMPO (SEM AÇÕES DESTRUTIVAS DE BANCO)
  // ----------------------------------------------------------------------------
  console.log('\n--- GRUPO 5: Limpeza do Perfil do Atleta ---');

  assert(!profilePageCode.includes('handleClearData'), '5.1 - Botão zerar dados SQLite removido do perfil do atleta');
  assert(!profilePageCode.includes('RESTAURAR DEMONSTRAÇÃO'), '5.2 - Botão restaurar demonstração removido do perfil do atleta');
  assert(profilePageCode.includes('CloudLinkCard'), '5.3 - Card de vinculação cloud preservado');

  // ----------------------------------------------------------------------------
  // RESUMO
  // ----------------------------------------------------------------------------
  console.log('\n==============================================================================');
  console.log(`TOTAL DE TESTES DE SIMPLIFICAÇÃO: ${passedTests + failedTests}`);
  console.log(`PASSADOS: ${passedTests}`);
  console.log(`FALHADOS: ${failedTests}`);
  console.log('==============================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSimplificationTests();
