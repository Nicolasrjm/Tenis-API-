/**
 * ==============================================================================
 * MOTION TENNIS — TESTES AUTOMATIZADOS: CORREÇÕES PONTUAIS DE INTERFACE
 * ==============================================================================
 * Valida de forma não-destrutiva:
 * 1. LANDING PAGE: Remoção de 'ACADEMY (GRATUITA)' e 'Conectar Celular' do header.
 * 2. LANDING PAGE: Preservação de 'Conheça o Motion Tennis' e 'Acessar Plataforma'.
 * 3. LANDING PAGE: Seção informativa sobre benefícios da Academy sem catálogo público.
 * 4. LOGIN: Atalhos Nicolas e Admin protegidos estritamente por import.meta.env.DEV.
 * 5. LOGIN: Atalhos preenchem apenas usuário e focam senha (sem senhas expostas/em código).
 * 6. BUILD: Eliminação completa dos atalhos de dev no bundle de produção (Tree-shaking).
 * 7. ADMIN HEADER: Botão Sair/Logout com shrink-0 sempre visível e acessível.
 * 8. ADMIN HEADER: Otimização de largura (5 rotas primárias + dropdown Sistema para secundárias).
 * 9. ADMIN HEADER: Preservação de todas as 8 rotas administrativas.
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

function runCorrecoesTests() {
  console.log('==============================================================================');
  console.log('🎾 MOTION TENNIS — TESTES DE CORREÇÕES PONTUAIS DE INTERFACE');
  console.log('==============================================================================\n');

  const clientPath = path.resolve(__dirname, '..', 'client', 'src');
  const serverPublicAssets = path.resolve(__dirname, '..', 'server', 'public', 'assets');
  
  const landingCode = fs.readFileSync(path.join(clientPath, 'pages', 'LandingPage.jsx'), 'utf8');
  const loginCode = fs.readFileSync(path.join(clientPath, 'pages', 'LoginPage.jsx'), 'utf8');
  const adminLayoutCode = fs.readFileSync(path.join(clientPath, 'layouts', 'AdminLayout.jsx'), 'utf8');

  // ----------------------------------------------------------------------------
  // 1. HEADER PÚBLICO E SEÇÃO ACADEMY (LandingPage.jsx)
  // ----------------------------------------------------------------------------
  console.log('--- GRUPO 1: Header Público e Academy Informativa ---');

  // Header não contém ACADEMY (GRATUITA)
  const headerMatch = landingCode.match(/<header[\s\S]*?<\/header>/);
  const headerContent = headerMatch ? headerMatch[0] : '';

  assert(!headerContent.includes('ACADEMY (GRATUITA)'), '1.1 - ACADEMY (GRATUITA) removida do header público');
  assert(!headerContent.includes('landing-nav-academy'), '1.2 - Link destacado de academy removido da barra superior');
  assert(!headerContent.includes('Conectar Celular'), '1.3 - Botão Conectar Celular removido do header público');
  assert(!headerContent.includes('btn-landing-connect-mobile'), '1.4 - Botão técnico de modal QR removido da landing page');

  // Header prioriza ações limpas
  assert(headerContent.includes('Conheça o Motion Tennis'), '1.5 - Ação "Conheça o Motion Tennis" presente no header');
  assert(headerContent.includes('Acessar Plataforma'), '1.6 - Botão "Acessar Plataforma" presente no header');

  // Seção informativa da Academy no site
  assert(landingCode.includes('id="academy-info"'), '1.7 - Seção informativa da Academy presente no site');
  assert(landingCode.includes('Motion Tennis Academy'), '1.8 - Apresentação da Motion Tennis Academy');
  assert(landingCode.includes('6 Módulos Técnicos'), '1.9 - Menção aos 6 atributos e metodologia');
  assert(landingCode.includes('Acesso no Notebook e Celular'), '1.10 - Esclarecimento dos 2 pontos de acesso do atleta');
  assert(!landingCode.includes('iframe') && !landingCode.includes('youtube'), '1.11 - Catálogo de vídeo ou player YouTube NÃO duplicado no site público');

  // ----------------------------------------------------------------------------
  // 2. ACESSOS RÁPIDOS EM DEV (LoginPage.jsx)
  // ----------------------------------------------------------------------------
  console.log('\n--- GRUPO 2: Acessos Rápidos Nicolas e Admin (Somente DEV) ---');

  assert(loginCode.includes('import.meta.env.DEV'), '2.1 - Restrição por import.meta.env.DEV configurada');
  assert(loginCode.includes('dev-shortcut-nicolas'), '2.2 - Atalho para Nicolas presente em modo DEV');
  assert(loginCode.includes('dev-shortcut-admin'), '2.3 - Atalho para Administrador presente em modo DEV');
  
  // Preenchimento de usuário e foco na senha
  assert(loginCode.includes("setEmailOrUser('nicolas')"), '2.4 - Clique no atalho preenche identificador "nicolas"');
  assert(loginCode.includes("setEmailOrUser('admin')"), '2.5 - Clique no atalho preenche identificador "admin"');
  assert(loginCode.includes('passwordInputRef.current?.focus()'), '2.6 - Foco automático no campo de senha ao clicar no atalho');

  // Segurança: zero senhas no código ou na tela
  assert(!loginCode.includes("setPassword('nicolas123')"), '2.7 - Senha de Nicolas NÃO preenchida automaticamente');
  assert(!loginCode.includes("setPassword('admin123')"), '2.8 - Senha de Admin NÃO preenchida automaticamente');
  assert(!loginCode.includes('nicolas123'), '2.9 - Senha de Nicolas não existe em texto no código');
  assert(!loginCode.includes('admin123'), '2.10 - Senha de Admin não existe em texto no código');

  // Preservação do fluxo de login legítimo
  assert(loginCode.includes('handleLogin'), '2.11 - Fluxo legítimo handleLogin preservado');
  assert(loginCode.includes('loginCloud(') && loginCode.includes('login('), '2.12 - Mecanismo dual de autenticação preservado');

  // ----------------------------------------------------------------------------
  // 3. TREE-SHAKING DO BUNDLE DE PRODUÇÃO
  // ----------------------------------------------------------------------------
  console.log('\n--- GRUPO 3: Verificação de Build de Produção (Zero vazamento) ---');

  if (fs.existsSync(serverPublicAssets)) {
    const assetFiles = fs.readdirSync(serverPublicAssets).filter(f => f.endsWith('.js'));
    let foundDevShortcutInProd = false;

    for (const file of assetFiles) {
      const content = fs.readFileSync(path.join(serverPublicAssets, file), 'utf8');
      if (content.includes('dev-shortcut-nicolas') || content.includes('dev-shortcut-admin') || content.includes('dev-shortcuts-panel')) {
        foundDevShortcutInProd = true;
        break;
      }
    }

    assert(!foundDevShortcutInProd, '3.1 - Tree-shaking confirmado: atalhos de dev ausentes no bundle de produção');
  } else {
    console.log('  ⚠ SKIP [3.1 - Pasta server/public/assets não encontrada]');
  }

  // ----------------------------------------------------------------------------
  // 4. HEADER DO ADMIN RESPONSIVO (AdminLayout.jsx)
  // ----------------------------------------------------------------------------
  console.log('\n--- GRUPO 4: Header do Admin Responsivo e Logout Sempre Visível ---');

  // Logout sempre visível e não cortado
  assert(adminLayoutCode.includes('admin-btn-logout'), '4.1 - Botão de logout presente com data-testid');
  assert(adminLayoutCode.includes('shrink-0'), '4.2 - Classes shrink-0 aplicadas para impedir corte de logout');
  assert(adminLayoutCode.includes('handleLogout'), '4.3 - Handler de logout conectado');
  assert(adminLayoutCode.includes('LogOut'), '4.4 - Ícone de LogOut renderizado');

  // Todas as 8 rotas administrativas preservadas
  const requiredAdminRoutes = [
    '/admin/overview',
    '/admin/academy',
    '/admin/equipments',
    '/admin/users',
    '/admin/sessions',
    '/admin/sensors',
    '/admin/reports',
    '/admin/settings'
  ];

  requiredAdminRoutes.forEach(route => {
    assert(adminLayoutCode.includes(route), `4.5+ - Rota administrativa preservada: ${route}`);
  });

  // Agrupamento compacto em menu Sistema
  assert(adminLayoutCode.includes('admin-btn-sistema-dropdown'), '4.6 - Dropdown compacto "Sistema" implementado');
  assert(adminLayoutCode.includes('admin-dropdown-menu'), '4.7 - Menu popup de opções secundárias com role="menu"');
  assert(adminLayoutCode.includes('isSecondaryActive'), '4.8 - Destaque reativo do dropdown quando rota secundária está ativa');
  assert(adminLayoutCode.includes('Escape'), '4.9 - Acessibilidade por teclado (tecla Escape fecha dropdown)');
  assert(adminLayoutCode.includes('handleClickOutside'), '4.10 - Fechamento ao clicar fora do dropdown');

  // Botão Área do Jogador não empurra logout
  assert(adminLayoutCode.includes('admin-link-player-area'), '4.11 - Link Área do Jogador presente e compacto');
  assert(adminLayoutCode.includes('hidden xl:inline') || adminLayoutCode.includes('shrink-0'), '4.12 - Layout responsivo evita empurrar ferramentas da direita');

  // ----------------------------------------------------------------------------
  // RESUMO
  // ----------------------------------------------------------------------------
  console.log('\n==============================================================================');
  console.log(`TOTAL DE TESTES: ${passedTests + failedTests}`);
  console.log(`PASSADOS: ${passedTests}`);
  console.log(`FALHADOS: ${failedTests}`);
  console.log('==============================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCorrecoesTests();
