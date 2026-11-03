/**
 * ==============================================================================
 * MOTION TENNIS — TESTES AUTOMATIZADOS: LOGIN MOBILE & SIMPLIFICAÇÃO LANDING PAGE
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n==============================================================================');
console.log('🎾 MOTION TENNIS — TESTES DE LOGIN MOBILE & LANDING PAGE SIMPLIFICADA');
console.log('==============================================================================\n');

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✔ PASS [${name}]`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ FAIL [${name}]: ${err.message}`);
    failedCount++;
  }
}

// ── GRUPO 1: Simplificação da Landing Page ──
console.log('--- GRUPO 1: Landing Page Simplificada e Comercial ---');

const landingPath = path.resolve('client/src/pages/LandingPage.jsx');
const landingCode = fs.readFileSync(landingPath, 'utf8');

test('1.1 - Título principal "MOTION TENNIS" presente', () => {
  assert(landingCode.includes('MOTION'), 'Deve conter MOTION');
  assert(landingCode.includes('TENNIS'), 'Deve conter TENNIS');
});

test('1.2 - Frase de destaque: "Treine melhor. Acompanhe sua evolução."', () => {
  assert(landingCode.includes('Treine melhor. Acompanhe sua evolução.'), 'Frase de destaque exata ausente');
});

test('1.3 - Descrição esportiva sem termos técnicos', () => {
  assert(landingCode.includes('Transforme cada treino em uma experiência interativa. Desenvolva sua precisão, acompanhe seus resultados e evolua com o Motion Tennis.'), 'Descrição comercial ausente');
});

test('1.4 - Destaques rápidos: INTERATIVO, DESEMPENHO e EVOLUÇÃO', () => {
  assert(landingCode.includes('INTERATIVO'), 'Falta destaque INTERATIVO');
  assert(landingCode.includes('DESEMPENHO'), 'Falta destaque DESEMPENHO');
  assert(landingCode.includes('EVOLUÇÃO'), 'Falta destaque EVOLUÇÃO');
});

test('1.5 - Remoção de menções a KY-037', () => {
  assert(!landingCode.includes('KY-037'), 'Não deve conter KY-037 na Landing Page');
});

test('1.6 - Remoção de menções a SQLite e Localhost no site comercial', () => {
  assert(!landingCode.toLowerCase().includes('sqlite'), 'Não deve conter SQLite na Landing Page');
  assert(!landingCode.toLowerCase().includes('localhost'), 'Não deve conter Localhost na Landing Page');
});

test('1.7 - Remoção de alegações de precisão não comprovadas e contagem de posições fixas', () => {
  assert(!landingCode.includes('11 SENSORES'), 'Não deve conter 11 SENSORES');
  assert(!landingCode.includes('precisão milimétrica'), 'Não deve conter precisão milimétrica');
  assert(!landingCode.includes('posições calibradas'), 'Não deve conter posições calibradas');
});

test('1.8 - Legenda dos seis setores de treinamento interativo preservada', () => {
  assert(landingCode.includes('Seis setores de treinamento interativo'), 'Legenda dos 6 setores ausente');
});

test('1.9 - Botões CONHEÇA O MOTION TENNIS e ACESSAR PLATAFORMA preservados', () => {
  assert(landingCode.includes('CONHEÇA O MOTION TENNIS'), 'Falta botão Conheça');
  assert(landingCode.includes('ACESSAR PLATAFORMA'), 'Falta botão Acessar Plataforma');
});


// ── GRUPO 2: Detecção de Dispositivos Móveis ──
console.log('\n--- GRUPO 2: Detecção Robusta de Dispositivos Móveis ---');

const serverConfigPath = path.resolve('client/src/services/serverConfig.js');
const serverConfigCode = fs.readFileSync(serverConfigPath, 'utf8');

test('2.1 - isNativeMobile preservado para Capacitor Android', () => {
  assert(serverConfigCode.includes('export function isNativeMobile()'), 'Falta export isNativeMobile');
});

test('2.2 - isMobileDevice implementado com detecção de navegador mobile (User-Agent + Media Query)', () => {
  assert(serverConfigCode.includes('export function isMobileDevice()'), 'Falta export isMobileDevice');
  assert(serverConfigCode.includes('navigator.userAgent'), 'Deve verificar User-Agent');
  assert(serverConfigCode.includes('max-width: 768px'), 'Deve verificar breakpoint mobile');
});


// ── GRUPO 3: Fluxo de Autenticação Mobile e Redirecionamento ──
console.log('\n--- GRUPO 3: Autenticação Mobile e Redirecionamento ---');

const loginPath = path.resolve('client/src/pages/LoginPage.jsx');
const loginCode = fs.readFileSync(loginPath, 'utf8');

test('3.1 - LoginPage importa isMobileDevice e isWebDemoMode', () => {
  assert(loginCode.includes('isMobileDevice'), 'LoginPage deve importar isMobileDevice');
  assert(loginCode.includes('isWebDemoMode'), 'LoginPage deve importar isWebDemoMode');
});

test('3.2 - Redirecionamento após login envia mobile para /mobile/dashboard', () => {
  assert(loginCode.includes("navigate('/mobile/dashboard')"), 'Deve navegar para /mobile/dashboard no mobile');
});

test('3.3 - Preservação do redirecionamento do desktop para /app/dashboard e /admin/overview', () => {
  assert(loginCode.includes("navigate('/app/dashboard')"), 'Desktop deve navegar para /app/dashboard');
  assert(loginCode.includes("navigate('/admin/overview')"), 'Admin deve navegar para /admin/overview');
});

test('3.4 - Orientação amigável se usuário mobile tentar login local sem @', () => {
  assert(loginCode.includes('No celular ou acesso online, utilize o seu e-mail cadastrado'), 'Deve orientar a usar e-mail no mobile');
});

test('3.5 - Tratamento de teclado mobile (autoCapitalize=none, inputMode)', () => {
  assert(loginCode.includes('autoCapitalize="none"'), 'Deve ter autoCapitalize="none"');
  assert(loginCode.includes('inputMode='), 'Deve ter inputMode configurado');
});

test('3.6 - Tratamento claro de mensagens de erro para o usuário', () => {
  assert(loginCode.includes('Falha na autenticação. Verifique suas credenciais.'), 'Mensagem padrão de erro presente');
});


// ── GRUPO 4: Restauração de Sessão e Independência de Localhost ──
console.log('\n--- GRUPO 4: Restauração de Sessão e Independência de Localhost ---');

const authContextPath = path.resolve('client/src/context/AuthContext.jsx');
const authContextCode = fs.readFileSync(authContextPath, 'utf8');

test('4.1 - AuthContext restaura sessão cloud imediatamente em ambiente web_demo ou mobile', () => {
  assert(authContextCode.includes('isWebDemoMode()'), 'AuthContext deve consultar isWebDemoMode');
  assert(authContextCode.includes('cloudSession?.accessToken'), 'AuthContext deve restaurar cloudSession');
  assert(authContextCode.includes('isCloudOnly: true'), 'Usuário cloud deve ter isCloudOnly');
});

test('4.2 - AuthContext não tenta api.getMe() no modo web_demo (zero dependência de localhost)', () => {
  assert(authContextCode.includes('if (token && !isWebDemoMode())'), 'Não deve chamar api.getMe em web_demo');
});


// ── GRUPO 5: Proteção de Rotas Mobile ──
console.log('\n--- GRUPO 5: Proteção de Rotas Mobile ---');

const appPath = path.resolve('client/src/App.jsx');
const appCode = fs.readFileSync(appPath, 'utf8');

test('5.1 - /mobile/dashboard protegido com ProtectedRoute', () => {
  assert(appCode.includes('<ProtectedRoute><MobileDashboardPage /></ProtectedRoute>'), 'Dashboard mobile deve ser protegido');
});

test('5.2 - /mobile/history protegido com ProtectedRoute', () => {
  assert(appCode.includes('<ProtectedRoute><MobileHistoryPage /></ProtectedRoute>'), 'Histórico mobile deve ser protegido');
});

test('5.3 - /mobile/evolution protegido com ProtectedRoute', () => {
  assert(appCode.includes('<ProtectedRoute><MobileEvolutionPage /></ProtectedRoute>'), 'Evolução mobile deve ser protegida');
});

test('5.4 - /mobile/profile protegido com ProtectedRoute', () => {
  assert(appCode.includes('<ProtectedRoute><MobileProfilePage /></ProtectedRoute>'), 'Perfil mobile deve ser protegido');
});

test('5.5 - Redirecionamento da Academy aponta para mobile quando em dispositivo móvel', () => {
  assert(appCode.includes("isMobileDevice() ? '/mobile/academy' : '/app/academy'"), 'Academy deve redirecionar conforme o dispositivo');
});


// ── GRUPO 6: Resiliência de Conexão no MobileLayout e Supabase Config ──
console.log('\n--- GRUPO 6: Resiliência de Conexão Mobile e Supabase ---');

const mobileLayoutPath = path.resolve('client/src/layouts/MobileLayout.jsx');
const mobileLayoutCode = fs.readFileSync(mobileLayoutPath, 'utf8');
const cloudAuthPath = path.resolve('client/src/services/cloudAuthService.js');
const cloudAuthCode = fs.readFileSync(cloudAuthPath, 'utf8');

test('6.1 - MobileLayout não realiza polling local em modo Web Demo na Vercel', () => {
  assert(mobileLayoutCode.includes('if (isWebDemoMode() && !getSavedServerUrl())'), 'Não deve fazer polling se web_demo sem servidor');
});

test('6.2 - cloudAuthService possui fallback oficial seguro para Supabase Cloud', () => {
  assert(cloudAuthCode.includes('https://pstzmbtqkcrhtdvwqnuv.supabase.co'), 'Deve conter fallback para URL do Supabase');
  assert(cloudAuthCode.includes('sb_publishable_7eZ5Tbzu0avGMEQ9rLLmqw_mjReLqqT'), 'Deve conter fallback para Anon/Publishable Key');
});


// ── RESUMO FINAL ──
console.log('\n==============================================================================');
console.log(`TOTAL DE TESTES: ${passedCount + failedCount}`);
console.log(`PASSADOS: ${passedCount}`);
console.log(`FALHADOS: ${failedCount}`);
console.log('==============================================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
