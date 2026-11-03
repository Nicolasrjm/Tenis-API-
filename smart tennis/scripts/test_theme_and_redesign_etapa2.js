/**
 * test_theme_and_redesign_etapa2.js
 * 
 * Validação rigorosa dos requisitos da ETAPA 2:
 * 1. Tokens e Definições de Tema Claro e Escuro
 * 2. Tema Padrão Escuro (Sport Premium Dark)
 * 3. Pre-hydration script no index.html
 * 4. ThemeContext e ThemeToggle com persistência em localStorage
 * 5. Alternador de tema nos 5 locais obrigatórios
 * 6. Preservação inviolável da Arena Ativa em modo estritamente escuro (#050D07)
 * 7. Telas internas atualizadas com suporte dual-theme
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS [${message}]`);
  } else {
    failedTests++;
    console.error(`  ✖ FAIL [${message}]`);
  }
}

console.log('\n==============================================================================');
console.log('🎾 MOTION TENNIS — TESTES DE TEMA CLARO/ESCURO & REDESIGN ETAPA 2');
console.log('==============================================================================\n');

// ----------------------------------------------------------------------------
// GRUPO 1: Configuração de Tokens e CSS
// ----------------------------------------------------------------------------
console.log('--- GRUPO 1: Configuração de Tokens e CSS ---');

const tokensPath = path.join(projectRoot, 'client', 'src', 'theme', 'tokens.js');
assert(fs.existsSync(tokensPath), 'Arquivo tokens.js existe');
const tokensContent = fs.readFileSync(tokensPath, 'utf-8');

// Escuro (Padrão)
assert(tokensContent.includes('#101820'), 'Token dark mainBg (#101820) definido');
assert(tokensContent.includes('#18242E'), 'Token dark secBg (#18242E) definido');
assert(tokensContent.includes('#22313D'), 'Token dark cardBg (#22313D) definido');
assert(tokensContent.includes('#0D1B2A'), 'Token dark headerBg (#0D1B2A) definido');
assert(tokensContent.includes('#344653'), 'Token dark border (#344653) definido');
assert(tokensContent.includes('#F1F5F9'), 'Token dark textPrimary (#F1F5F9) definido');
assert(tokensContent.includes('#A8BAC8'), 'Token dark textSecondary (#A8BAC8) definido');
assert(tokensContent.includes('#B8F044'), 'Token dark lime (#B8F044) definido');
assert(tokensContent.includes('#60A5FA'), 'Token dark blue (#60A5FA) definido');

// Claro (Cinza-azulado suave)
assert(tokensContent.includes('#DCE3E8'), 'Token light mainBg (#DCE3E8) definido');
assert(tokensContent.includes('#C9D4DC'), 'Token light secBg (#C9D4DC) definido');
assert(tokensContent.includes('#F4F6F8'), 'Token light cardBg (#F4F6F8) definido');
assert(tokensContent.includes('#E8EDF1'), 'Token light inputBg (#E8EDF1) definido');
assert(tokensContent.includes('#142B3D'), 'Token light headerBg/textPrimary (#142B3D) definido');
assert(tokensContent.includes('#B8C6D0'), 'Token light border (#B8C6D0) definido');
assert(tokensContent.includes('#475569'), 'Token light textSecondary (#475569) definido');

// Invariante de Arena
assert(tokensContent.includes('#050D07'), 'Token arenaBg (#050D07) estritamente preservado');

// Tailwind config
const tailwindPath = path.join(projectRoot, 'client', 'tailwind.config.js');
assert(fs.existsSync(tailwindPath), 'Arquivo tailwind.config.js existe');
const tailwindContent = fs.readFileSync(tailwindPath, 'utf-8');
assert(tailwindContent.includes("darkMode: 'class'"), 'Tailwind configurado com darkMode: "class"');

// index.css
const cssPath = path.join(projectRoot, 'client', 'src', 'index.css');
assert(fs.existsSync(cssPath), 'Arquivo index.css existe');
const cssContent = fs.readFileSync(cssPath, 'utf-8');
assert(cssContent.includes('--sport-bg: #101820') || cssContent.includes('#101820'), 'index.css define base escura como padrão');
assert(cssContent.includes('html.light') && cssContent.includes('#DCE3E8'), 'index.css define variaveis para html.light (#DCE3E8)');

// index.html prehydration
const htmlPath = path.join(projectRoot, 'client', 'index.html');
assert(fs.existsSync(htmlPath), 'Arquivo index.html existe');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
assert(htmlContent.includes('motion_theme'), 'index.html lê chave motion_theme do localStorage');
assert(htmlContent.includes("'dark'"), 'index.html adota "dark" como tema padrão de fallback');

// ----------------------------------------------------------------------------
// GRUPO 2: ThemeContext e ThemeToggle
// ----------------------------------------------------------------------------
console.log('\n--- GRUPO 2: ThemeContext e ThemeToggle ---');

const themeContextPath = path.join(projectRoot, 'client', 'src', 'context', 'ThemeContext.jsx');
assert(fs.existsSync(themeContextPath), 'Arquivo ThemeContext.jsx existe');
const themeContextContent = fs.readFileSync(themeContextPath, 'utf-8');
assert(themeContextContent.includes("useState(() => {"), 'ThemeContext inicializa estado lendo localStorage');
assert(themeContextContent.includes("localStorage.getItem('motion_theme')"), 'ThemeContext inicializa estado lendo localStorage');
assert(themeContextContent.includes("'dark'"), 'Tema padrão é dark');
assert(themeContextContent.includes("classList.add('dark')") && themeContextContent.includes("classList.add('light')"), 'ThemeContext sincroniza classes no <html>');
assert(themeContextContent.includes("setAttribute('data-theme'"), 'ThemeContext sincroniza data-theme no <html>');

const togglePath = path.join(projectRoot, 'client', 'src', 'components', 'ui', 'ThemeToggle.jsx');
assert(fs.existsSync(togglePath), 'Arquivo ThemeToggle.jsx existe');
const toggleContent = fs.readFileSync(togglePath, 'utf-8');
assert(toggleContent.includes('data-testid="theme-toggle-btn"'), 'ThemeToggle possui data-testid="theme-toggle-btn"');
assert(toggleContent.includes('Moon') && toggleContent.includes('Sun'), 'ThemeToggle renderiza ícones Sun e Moon');

const mainPath = path.join(projectRoot, 'client', 'src', 'main.jsx');
const mainContent = fs.readFileSync(mainPath, 'utf-8');
assert(mainContent.includes('<ThemeProvider>'), 'Aplicação encapsulada por <ThemeProvider> no main.jsx');

// ----------------------------------------------------------------------------
// GRUPO 3: Alternador de Tema nos 5 Locais Obrigatórios
// ----------------------------------------------------------------------------
console.log('\n--- GRUPO 3: Alternador de Tema nos 5 Locais Obrigatórios ---');

// 1. Landing Page
const landingPath = path.join(projectRoot, 'client', 'src', 'pages', 'LandingPage.jsx');
const landingContent = fs.readFileSync(landingPath, 'utf-8');
assert(landingContent.includes('<ThemeToggle') && landingContent.includes('ThemeToggle'), '1. ThemeToggle presente no header da Landing Page');

// 2. Login Page
const loginPath = path.join(projectRoot, 'client', 'src', 'pages', 'LoginPage.jsx');
const loginContent = fs.readFileSync(loginPath, 'utf-8');
assert(loginContent.includes('<ThemeToggle') && loginContent.includes('ThemeToggle'), '2. ThemeToggle presente no topo da tela de Login/Cadastro');

// 3. PlayerLayout (Área do Atleta)
const playerLayoutPath = path.join(projectRoot, 'client', 'src', 'layouts', 'PlayerLayout.jsx');
const playerLayoutContent = fs.readFileSync(playerLayoutPath, 'utf-8');
assert(playerLayoutContent.includes('<ThemeToggle') && playerLayoutContent.includes('ThemeToggle'), '3. ThemeToggle presente no header do Atleta (PlayerLayout)');

// 4. AdminLayout (Console de Administração)
const adminLayoutPath = path.join(projectRoot, 'client', 'src', 'layouts', 'AdminLayout.jsx');
const adminLayoutContent = fs.readFileSync(adminLayoutPath, 'utf-8');
assert(adminLayoutContent.includes('<ThemeToggle') && adminLayoutContent.includes('ThemeToggle'), '4. ThemeToggle presente no header do Admin (AdminLayout)');

// 5. MobileLayout (Navegação Mobile Web)
const mobileLayoutPath = path.join(projectRoot, 'client', 'src', 'layouts', 'MobileLayout.jsx');
const mobileLayoutContent = fs.readFileSync(mobileLayoutPath, 'utf-8');
assert(mobileLayoutContent.includes('<ThemeToggle') && mobileLayoutContent.includes('ThemeToggle'), '5. ThemeToggle presente no header do Mobile (MobileLayout)');

// ----------------------------------------------------------------------------
// GRUPO 4: Invariante Estrita da Arena Ativa (#050D07)
// ----------------------------------------------------------------------------
console.log('\n--- GRUPO 4: Invariante Estrita da Arena Ativa ---');

const playPath = path.join(projectRoot, 'client', 'src', 'pages', 'PlayPage.jsx');
const playContent = fs.readFileSync(playPath, 'utf-8');
assert(playContent.includes('focus-game-viewport'), 'Viewport do modo foco presente');
assert(playContent.includes('bg-[#050D07]'), 'Arena ativa possui background fixo preto/projeção (#050D07)');
assert(!playContent.includes('focus-game-viewport') || !playContent.match(/focus-game-viewport[^>]*light:/), 'Arena ativa NUNCA recebe tema claro no modo de jogo');

// ----------------------------------------------------------------------------
// GRUPO 5: Telas Internas Atualizadas com Suporte Dual Theme
// ----------------------------------------------------------------------------
console.log('\n--- GRUPO 5: Telas Internas Atualizadas com Suporte Dual Theme ---');

const dashboardPath = path.join(projectRoot, 'client', 'src', 'pages', 'DashboardPage.jsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');
assert(dashboardContent.includes('dark:bg-[#22313D]') && dashboardContent.includes('bg-[#F4F6F8]'), 'Dashboard adaptado para Dark (#22313D) e Light (#F4F6F8)');

const historyPath = path.join(projectRoot, 'client', 'src', 'pages', 'HistoryPage.jsx');
const historyContent = fs.readFileSync(historyPath, 'utf-8');
assert(historyContent.includes('dark:bg-[#22313D]') && historyContent.includes('bg-[#F4F6F8]'), 'Histórico adaptado para Dark e Light');

const statsPath = path.join(projectRoot, 'client', 'src', 'pages', 'StatisticsPage.jsx');
const statsContent = fs.readFileSync(statsPath, 'utf-8');
assert(statsContent.includes('dark:bg-[#22313D]') && statsContent.includes('bg-[#F4F6F8]'), 'Estatísticas adaptado para Dark e Light');

const evolutionPath = path.join(projectRoot, 'client', 'src', 'pages', 'EvolutionPage.jsx');
const evolutionContent = fs.readFileSync(evolutionPath, 'utf-8');
assert(evolutionContent.includes('dark:bg-[#22313D]') && evolutionContent.includes('bg-[#F4F6F8]'), 'Evolução adaptado para Dark e Light');

const achievementsPath = path.join(projectRoot, 'client', 'src', 'pages', 'AchievementsPage.jsx');
const achievementsContent = fs.readFileSync(achievementsPath, 'utf-8');
assert(achievementsContent.includes('dark:bg-[#22313D]') && achievementsContent.includes('bg-[#F4F6F8]'), 'Conquistas adaptado para Dark e Light');

const profilePath = path.join(projectRoot, 'client', 'src', 'pages', 'ProfilePage.jsx');
const profileContent = fs.readFileSync(profilePath, 'utf-8');
assert(profileContent.includes('dark:bg-[#22313D]') && profileContent.includes('bg-[#F4F6F8]'), 'Perfil adaptado para Dark e Light');

const academyPath = path.join(projectRoot, 'client', 'src', 'pages', 'AcademyPage.jsx');
const academyContent = fs.readFileSync(academyPath, 'utf-8');
assert(academyContent.includes('dark:bg-[#22313D]') && academyContent.includes('bg-[#F4F6F8]'), 'Academy adaptada para Dark e Light');

const skillAcademyPath = path.join(projectRoot, 'client', 'src', 'pages', 'SkillAcademyPage.jsx');
const skillAcademyContent = fs.readFileSync(skillAcademyPath, 'utf-8');
assert(skillAcademyContent.includes('dark:bg-[#22313D]') && skillAcademyContent.includes('bg-[#F4F6F8]'), 'SkillAcademy adaptada para Dark e Light');

const lessonPath = path.join(projectRoot, 'client', 'src', 'pages', 'AcademyLessonPage.jsx');
const lessonContent = fs.readFileSync(lessonPath, 'utf-8');
assert(lessonContent.includes('dark:bg-[#22313D]') && lessonContent.includes('bg-[#F4F6F8]'), 'AcademyLesson adaptada para Dark e Light');

console.log('\n==============================================================================');
console.log(`TOTAL DE TESTES ETAPA 2: ${totalTests}`);
console.log(`PASSADOS: ${passedTests}`);
console.log(`FALHADOS: ${failedTests}`);
console.log('==============================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
