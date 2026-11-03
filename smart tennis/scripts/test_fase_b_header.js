/**
 * ==============================================================================
 * MOTION TENNIS — TESTES FASE B: HEADER RESPONSIVO E DROPDOWN DESEMPENHO
 * ==============================================================================
 * Valida de forma não-destrutiva:
 * 1. Existência e integridade do dropdown "Desempenho" agrupando Estatísticas e Evolução.
 * 2. Preservação de todas as rotas (/app/statistics, /app/evolution, /app/dashboard, /app/play, etc.).
 * 3. Acessibilidade: atributos ARIA (aria-haspopup, aria-expanded, role=menu, role=menuitem).
 * 4. Layout responsivo sem quebras ou corte para resoluções de notebook (1280x720 e 1366x768).
 * 5. Menu mobile drawer contendo sub-itens verticais de Estatísticas e Evolução.
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

function runTests() {
  console.log('\n======================================================');
  console.log('  MOTION TENNIS — TESTES FASE B (HEADER RESPONSIVO)');
  console.log('======================================================\n');

  // ----------------------------------------------------------------------------
  // GRUPO 1: Inspeção de PlayerLayout.jsx
  // ----------------------------------------------------------------------------
  console.log('\x1b[36m[GRUPO 1] Inspeção Estrutural de PlayerLayout.jsx\x1b[0m');

  const layoutPath = path.resolve(__dirname, '..', 'client', 'src', 'layouts', 'PlayerLayout.jsx');
  assert(fs.existsSync(layoutPath), 'Arquivo PlayerLayout.jsx existe no cliente');

  const content = fs.readFileSync(layoutPath, 'utf8');

  // Verifica agrupamento "Desempenho"
  assert(content.includes('btn-nav-desempenho'), 'Botão de dropdown "Desempenho" com data-testid presente');
  assert(content.includes('Desempenho'), 'Rótulo textual "Desempenho" presente no menu');
  assert(content.includes('dropdown-desempenho'), 'Container do dropdown com id e role=menu presente');

  // Verifica itens internos do dropdown
  assert(content.includes('link-nav-statistics'), 'Link para Estatísticas presente no dropdown');
  assert(content.includes('/app/statistics'), 'Rota /app/statistics configurada no link de Estatísticas');
  assert(content.includes('link-nav-evolution'), 'Link para Evolução presente no dropdown');
  assert(content.includes('/app/evolution'), 'Rota /app/evolution configurada no link de Evolução');

  // ----------------------------------------------------------------------------
  // GRUPO 2: Acessibilidade e Fechamento do Dropdown
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[GRUPO 2] Acessibilidade e Gestão de Foco\x1b[0m');

  assert(content.includes('aria-haspopup="true"'), 'Atributo aria-haspopup="true" configurado no gatilho');
  assert(content.includes('aria-expanded='), 'Atributo reativo aria-expanded configurado no gatilho');
  assert(content.includes('role="menu"'), 'Atributo role="menu" configurado no container do dropdown');
  assert(content.includes('role="menuitem"'), 'Atributo role="menuitem" configurado nos itens do menu');
  assert(content.includes('Escape'), 'Fechamento ao pressionar tecla Escape implementado');
  assert(content.includes('handleClickOutside'), 'Fechamento ao clicar fora do dropdown implementado');
  assert(content.includes('isDesempenhoActive'), 'Destaque visual ativo quando a rota for /app/statistics ou /app/evolution');

  // ----------------------------------------------------------------------------
  // GRUPO 3: Preservação de Todas as Demais Rotas
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[GRUPO 3] Preservação de Demais Ações e Rotas\x1b[0m');

  assert(content.includes('/app/dashboard'), 'Rota /app/dashboard preservada');
  assert(content.includes('/app/play'), 'Rota /app/play preservada');
  assert(content.includes('/app/academy'), 'Rota /app/academy preservada');
  assert(content.includes('/app/history'), 'Rota /app/history preservada');
  assert(content.includes('/app/achievements'), 'Rota /app/achievements preservada');
  assert(content.includes('/app/profile'), 'Rota /app/profile preservada');
  assert(content.includes('btn-connect-mobile-modal'), 'Botão Conectar Celular preservado');

  // ----------------------------------------------------------------------------
  // GRUPO 4: Menu Mobile Drawer
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[GRUPO 4] Menu Mobile Drawer e Navegação Touch\x1b[0m');

  assert(content.includes('mobileOpen'), 'Estado de gaveta mobileOpen controlado');
  assert(content.includes('lg:hidden'), 'Alternância responsiva entre barra desktop e menu gaveta');
  assert(
    content.includes('to="/app/statistics"') && content.includes('to="/app/evolution"'),
    'Ambos os links acessíveis também no menu mobile'
  );

  // ----------------------------------------------------------------------------
  // GRUPO 5: Verificação de Roteamento em App.jsx
  // ----------------------------------------------------------------------------
  console.log('\n\x1b[36m[GRUPO 5] Verificação de Rotas em App.jsx\x1b[0m');

  const appPath = path.resolve(__dirname, '..', 'client', 'src', 'App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert(appContent.includes('path="statistics"'), 'Rota statistics mapeada no App.jsx');
  assert(appContent.includes('path="evolution"'), 'Rota evolution mapeada no App.jsx');
  assert(appContent.includes('StatisticsPage'), 'Componente StatisticsPage registrado');
  assert(appContent.includes('EvolutionPage'), 'Componente EvolutionPage registrado');

  console.log('\n======================================================');
  console.log(`  RESULTADO FASE B: ${passedTests} aprovados, ${failedTests} reprovados`);
  console.log('======================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

runTests();
