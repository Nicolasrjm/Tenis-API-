const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, description) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS [${description}]`);
  } else {
    failedTests++;
    console.error(`  ✖ FAIL [${description}]`);
  }
}

console.log('==============================================================================');
console.log('🎾 MOTION TENNIS — TESTES DE PALETA SPORT PREMIUM EM CINZA-AZULADO (#DCE3E8)');
console.log('==============================================================================\n');

// ---------------------------------------------------------------------------
// GRUPO 1: Design Tokens e Tipografia Refinada
// ---------------------------------------------------------------------------
console.log('--- GRUPO 1: Design Tokens em Cinza-Azulado ---');
const tokensPath = path.join(rootDir, 'client/src/theme/tokens.js');
assert(fs.existsSync(tokensPath), 'Arquivo de tokens centralizados client/src/theme/tokens.js existe');

const tokensContent = fs.existsSync(tokensPath) ? fs.readFileSync(tokensPath, 'utf8') : '';
assert(tokensContent.includes('#DCE3E8'), 'Fundo principal Landing/Login #DCE3E8 configurado nos tokens');
assert(tokensContent.includes('#C9D4DC'), 'Seções alternadas #C9D4DC configuradas nos tokens');
assert(tokensContent.includes('#F4F6F8'), 'Cards e formulários #F4F6F8 configurados nos tokens');
assert(tokensContent.includes('#E8EDF1'), 'Inputs #E8EDF1 configurados nos tokens');
assert(tokensContent.includes('#B8C6D0'), 'Bordas estruturais #B8C6D0 configuradas nos tokens');
assert(tokensContent.includes('#142B3D'), 'Texto e Header principal #142B3D configurados nos tokens');
assert(tokensContent.includes('#475569'), 'Texto secundário nítido #475569 configurado nos tokens');
assert(tokensContent.includes('#B8F044'), 'CTA verde-lima #B8F044 configurado nos tokens');

const cssPath = path.join(rootDir, 'client/src/index.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');
assert(cssContent.includes('--sport-bg-light: #DCE3E8'), 'Variável CSS --sport-bg-light definida como #DCE3E8');
assert(cssContent.includes('--sport-surface-alt: #C9D4DC'), 'Variável CSS --sport-surface-alt definida como #C9D4DC');
assert(cssContent.includes('--sport-border: #B8C6D0'), 'Variável CSS --sport-border definida como #B8C6D0');
assert(cssContent.includes('.card-sport'), 'Classe .card-sport presente');
assert(cssContent.includes('.input-sport'), 'Classe .input-sport presente');
assert(cssContent.includes('.btn-sport-lime'), 'Classe .btn-sport-lime presente');

const tailwindPath = path.join(rootDir, 'client/tailwind.config.js');
const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
assert(tailwindContent.includes('#DCE3E8'), 'Tom cinza-azulado #DCE3E8 registrado no Tailwind');
assert(tailwindContent.includes('#C9D4DC'), 'Tom de seção alternada #C9D4DC registrado no Tailwind');
assert(tailwindContent.includes('#F4F6F8'), 'Tom de card #F4F6F8 registrado no Tailwind');

// ---------------------------------------------------------------------------
// GRUPO 2: Componentes Base do Design System
// ---------------------------------------------------------------------------
console.log('\n--- GRUPO 2: Componentes Base do Design System ---');
const btnPath = path.join(rootDir, 'client/src/components/ui/SportButton.jsx');
const cardPath = path.join(rootDir, 'client/src/components/ui/SportCard.jsx');
const badgePath = path.join(rootDir, 'client/src/components/ui/SportBadge.jsx');

assert(fs.existsSync(btnPath), 'Componente SportButton.jsx existe');
assert(fs.existsSync(cardPath), 'Componente SportCard.jsx existe');
assert(fs.existsSync(badgePath), 'Componente SportBadge.jsx existe');

// ---------------------------------------------------------------------------
// GRUPO 3: Site Público (LandingPage.jsx) em Cinza-Azulado
// ---------------------------------------------------------------------------
console.log('\n--- GRUPO 3: Site Público em Cinza-Azulado (#DCE3E8) ---');
const landingPath = path.join(rootDir, 'client/src/pages/LandingPage.jsx');
const landingContent = fs.readFileSync(landingPath, 'utf8');

assert(landingContent.includes('bg-[#DCE3E8]'), 'Landing page usa fundo cinza-azulado #DCE3E8');
assert(landingContent.includes('bg-[#C9D4DC]'), 'Seções alternadas usam cinza #C9D4DC');
assert(landingContent.includes('bg-[#F4F6F8]'), 'Cards usam cinza suave #F4F6F8');
assert(landingContent.includes('border-[#B8C6D0]'), 'Bordas estruturais usam #B8C6D0');
assert(landingContent.includes('text-[#142B3D]'), 'Texto principal usa azul marinho #142B3D');
assert(landingContent.includes('text-[#475569]'), 'Texto secundário usa #475569');
assert(landingContent.includes('bg-[#142B3D]'), 'Header institucional em marinho #142B3D');
assert(landingContent.includes('btn-sport-lime'), 'Botão de ação principal em verde-lima #B8F044');
assert(!landingContent.includes('ACADEMY (GRATUITA)'), 'ACADEMY (GRATUITA) ausente do topo');
assert(!landingContent.includes('Conectar Celular'), 'Conectar Celular ausente do topo da landing page');
assert(landingContent.includes('id="academy-info"'), 'Seção #academy-info preservada');

// ---------------------------------------------------------------------------
// GRUPO 4: Login e Cadastro (LoginPage.jsx) em Cinza-Azulado
// ---------------------------------------------------------------------------
console.log('\n--- GRUPO 4: Login e Cadastro em Cinza-Azulado (#DCE3E8) ---');
const loginPath = path.join(rootDir, 'client/src/pages/LoginPage.jsx');
const loginContent = fs.readFileSync(loginPath, 'utf8');

assert(loginContent.includes('bg-[#DCE3E8]'), 'Fundo geral do Login usa cinza-azulado #DCE3E8');
assert(loginContent.includes('bg-[#F4F6F8]'), 'Card central usa cinza suave #F4F6F8');
assert(loginContent.includes('bg-[#E8EDF1]'), 'Inputs usam superfície #E8EDF1');
assert(loginContent.includes('border-[#B8C6D0]'), 'Bordas do card e inputs usam #B8C6D0');
assert(loginContent.includes('text-[#142B3D]'), 'Títulos em marinho #142B3D');
assert(loginContent.includes('btn-sport-lime'), 'Botão principal em verde-lima');
assert(loginContent.includes('import.meta.env.DEV'), 'Atalhos dev protegidos por import.meta.env.DEV');
assert(loginContent.includes('data-testid="dev-shortcut-nicolas"'), 'Atalho de dev para Nicolas presente');
assert(loginContent.includes('data-testid="dev-shortcut-admin"'), 'Atalho de dev para Administrador presente');
assert(loginContent.includes('data-testid="btn-enter-with-account"'), 'Aba Entrar presente');
assert(loginContent.includes('data-testid="btn-register-tab"'), 'Aba Criar Conta presente');
assert(loginContent.includes('data-testid="btn-play-as-guest-action"'), 'Ação Jogar como Visitante presente');

// ---------------------------------------------------------------------------
// GRUPO 5: Preservação Obrigatória da Área do Jogador
// ---------------------------------------------------------------------------
console.log('\n--- GRUPO 5: Preservação da Área do Jogador ---');
const playerLayoutPath = path.join(rootDir, 'client/src/layouts/PlayerLayout.jsx');
const playerLayoutContent = fs.readFileSync(playerLayoutPath, 'utf8');

assert(playerLayoutContent.includes('bg-[#07110B]'), 'Base escura da área do jogador estritamente preservada');
assert(playerLayoutContent.includes('bg-[#142B3D]'), 'Header do atleta em marinho institucional');
assert(playerLayoutContent.includes('data-testid="btn-nav-desempenho"'), 'Dropdown Desempenho preservado com data-testid');
assert(playerLayoutContent.includes('data-testid="link-nav-statistics"'), 'Link Estatísticas preservado');
assert(playerLayoutContent.includes('data-testid="link-nav-evolution"'), 'Link Evolução preservado');

console.log('\n==============================================================================');
console.log(`TOTAL DE TESTES PALETA CINZA-AZULADO: ${totalTests}`);
console.log(`PASSADOS: ${passedTests}`);
console.log(`FALHADOS: ${failedTests}`);
console.log('==============================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
