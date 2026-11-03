/**
 * ==============================================================================
 * MOTION TENNIS — TESTES AUTOMATIZADOS: CORREÇÃO DEFINITIVA DO APK ANDROID & PERFIL
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n==============================================================================');
console.log('🎾 MOTION TENNIS — TESTES DE AMBIENTE ANDROID CLOUD & LIMPEZA DO PERFIL');
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

// ── GRUPO 1: Modos Operacionais e appEnvironment ──
console.log('--- GRUPO 1: Modos Operacionais e appEnvironment ---');

const appEnvPath = path.resolve('client/src/services/appEnvironment.js');
const appEnvCode = fs.readFileSync(appEnvPath, 'utf8');

test('1.1 - appEnvironment define modos WEB_DEMO, EQUIPMENT e ANDROID_CLOUD', () => {
  assert(appEnvCode.includes("WEB_DEMO: 'web_demo'"), 'Deve conter WEB_DEMO');
  assert(appEnvCode.includes("EQUIPMENT: 'equipment'"), 'Deve conter EQUIPMENT');
  assert(appEnvCode.includes("ANDROID_CLOUD: 'android_cloud'"), 'Deve conter ANDROID_CLOUD');
});

test('1.2 - Detecção explícita de VITE_APP_MODE=android_cloud', () => {
  assert(appEnvCode.includes('APP_MODES.ANDROID_CLOUD'), 'Deve checar ANDROID_CLOUD');
});

test('1.3 - Proteção de segurança: Android nativo NUNCA cai em EQUIPMENT', () => {
  assert(appEnvCode.includes('window.Capacitor?.isNativePlatform?.()'), 'Deve detectar Capacitor nativo');
  assert(appEnvCode.includes('return APP_MODES.ANDROID_CLOUD;'), 'Capacitor nativo deve retornar ANDROID_CLOUD');
});

test('1.4 - Exportação de isAndroidCloudMode e isCloudOnlyMode', () => {
  assert(appEnvCode.includes('export function isAndroidCloudMode()'), 'Falta isAndroidCloudMode');
  assert(appEnvCode.includes('export function isCloudOnlyMode()'), 'Falta isCloudOnlyMode');
});

// ── GRUPO 2: Configuração de Build do Android ──
console.log('\n--- GRUPO 2: Configuração de Build do Android ---');

const envAndroidPath = path.resolve('client/.env.android');
test('2.1 - Arquivo client/.env.android existe com VITE_APP_MODE=android_cloud', () => {
  assert(fs.existsSync(envAndroidPath), '.env.android deve existir');
  const envContent = fs.readFileSync(envAndroidPath, 'utf8');
  assert(envContent.includes('VITE_APP_MODE=android_cloud'), 'Deve configurar VITE_APP_MODE=android_cloud');
  assert(envContent.includes('VITE_SUPABASE_URL='), 'Deve conter VITE_SUPABASE_URL');
  assert(envContent.includes('VITE_SUPABASE_ANON_KEY='), 'Deve conter VITE_SUPABASE_ANON_KEY');
});

const viteConfigPath = path.resolve('client/vite.config.js');
const viteConfigCode = fs.readFileSync(viteConfigPath, 'utf8');

test('2.2 - vite.config.js direciona build android para dist', () => {
  assert(viteConfigCode.includes("mode === 'android'"), 'Deve detectar mode android');
  assert(viteConfigCode.includes("isCloudBundle ? 'dist' : '../server/public'"), 'Deve compilar em dist');
});

const capConfigPath = path.resolve('client/capacitor.config.json');
const capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));

test('2.3 - capacitor.config.json aponta webDir para dist', () => {
  assert.strictEqual(capConfig.webDir, 'dist', 'webDir deve ser dist');
  assert(!capConfig.server?.url, 'Não deve conter URL remota no server');
});

const clientPkgPath = path.resolve('client/package.json');
const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));

test('2.4 - package.json possui script build:android', () => {
  assert(clientPkg.scripts['build:android'], 'Deve conter script build:android');
  assert.strictEqual(clientPkg.scripts['build:android'], 'vite build --mode android', 'Script deve ser vite build --mode android');
});

// ── GRUPO 3: Remoção de Visitante e Acesso Local no Login ──
console.log('\n--- GRUPO 3: Remoção de Visitante e Acesso Local no Login ---');

const loginPath = path.resolve('client/src/pages/LoginPage.jsx');
const loginCode = fs.readFileSync(loginPath, 'utf8');

test('3.1 - canShowGuest restringe visitante exclusivamente ao equipamento físico', () => {
  assert(loginCode.includes('canShowGuest = isEquipmentMode() && !isNativeMobile() && !isMobileDevice()'));
});

test('3.2 - Atalhos DEV (Nicolas/Admin) ocultos em mobile e Android', () => {
  assert(loginCode.includes('import.meta.env.DEV && canShowGuest && ('));
});

test('3.3 - Login orienta uso de e-mail no mobile/Android', () => {
  assert(loginCode.includes('No celular ou acesso online, utilize o seu e-mail cadastrado'));
});

// ── GRUPO 4: Limpeza do Perfil Mobile (Sem Informações Técnicas) ──
console.log('\n--- GRUPO 4: Limpeza do Perfil Mobile ---');

const mobileProfilePath = path.resolve('client/src/pages/mobile/MobileProfilePage.jsx');
const mobileProfileCode = fs.readFileSync(mobileProfilePath, 'utf8');

test('4.1 - Remoção do Card "Identidade Cloud Supabase"', () => {
  assert(!mobileProfileCode.includes('Identidade Cloud Supabase'), 'Não deve conter Identidade Cloud Supabase');
});

test('4.2 - Remoção de UUID da conta exibido na tela', () => {
  assert(!mobileProfileCode.includes('UUID da Conta'), 'Não deve conter UUID da Conta');
  assert(!mobileProfileCode.includes('cloudIdentity?.id'), 'Não deve exibir cloudIdentity.id');
  assert(!mobileProfileCode.includes('cloudUserId'), 'Não deve exibir cloudUserId');
});

test('4.3 - Remoção do indicador "Último Sincronismo: Tempo Real"', () => {
  assert(!mobileProfileCode.includes('Último Sincronismo'), 'Não deve conter Último Sincronismo');
  assert(!mobileProfileCode.includes('Tempo Real'), 'Não deve conter Tempo Real');
});

test('4.4 - Remoção do Card "Notebook da Quadra" e ação "Configurar"', () => {
  assert(!mobileProfileCode.includes('Notebook da Quadra'), 'Não deve conter Notebook da Quadra');
  assert(!mobileProfileCode.includes('Configurar →'), 'Não deve conter ação Configurar IP');
  assert(!mobileProfileCode.includes('btn-manage-server-connection'), 'Não deve conter botão de conexão');
});

test('4.5 - Preservação dos dados do atleta: Nome, Avatar, E-mail, Nível, XP', () => {
  assert(mobileProfileCode.includes('player?.avatar'), 'Deve conter avatar');
  assert(mobileProfileCode.includes('player?.name'), 'Deve conter nome');
  assert(mobileProfileCode.includes('player?.level'), 'Deve conter nível');
  assert(mobileProfileCode.includes('userEmail'), 'Deve conter e-mail');
  assert(mobileProfileCode.includes('currentXp'), 'Deve conter XP');
});

test('4.6 - Preservação de Desempenho, ThemeToggle e Sair da Conta', () => {
  assert(mobileProfileCode.includes('Desempenho Esportivo'), 'Deve conter Desempenho');
  assert(mobileProfileCode.includes('ThemeToggle'), 'Deve conter ThemeToggle');
  assert(mobileProfileCode.includes('btn-profile-logout'), 'Deve conter botão de logout');
});

// ── GRUPO 5: Layout e Navegação Mobile Sem Pareamento Obrigatório ──
console.log('\n--- GRUPO 5: Layout e Navegação Mobile ---');

const mobileLayoutPath = path.resolve('client/src/layouts/MobileLayout.jsx');
const mobileLayoutCode = fs.readFileSync(mobileLayoutPath, 'utf8');

test('5.1 - Header pill em modo cloud exibe "Nuvem" sem navegar para /mobile/connect', () => {
  assert(mobileLayoutCode.includes('<span>Nuvem</span>'), 'Deve exibir Nuvem');
  assert(mobileLayoutCode.includes('isEquipmentMode() && !isNativeMobile() ? ('), 'Pill clicável apenas no equipamento');
});

test('5.2 - Banner offline amigável para internet sem menção a notebook', () => {
  assert(mobileLayoutCode.includes('Sem conexão com a internet. Verifique sua rede.'));
});

const mobileConnectPath = path.resolve('client/src/pages/mobile/MobileConnectPage.jsx');
const mobileConnectCode = fs.readFileSync(mobileConnectPath, 'utf8');

test('5.3 - MobileConnectPage redireciona usuários nativos/cloud para o dashboard', () => {
  assert(mobileConnectCode.includes('isNativeMobile() || isCloudOnlyMode()'));
  assert(mobileConnectCode.includes("navigate('/mobile/dashboard', { replace: true })"));
});

// ── GRUPO 6: Independência da API e Autenticação Cloud ──
console.log('\n--- GRUPO 6: Independência da API e Autenticação Cloud ---');

const authContextPath = path.resolve('client/src/context/AuthContext.jsx');
const authContextCode = fs.readFileSync(authContextPath, 'utf8');

test('6.1 - AuthContext não tenta api.getMe() no modo cloud ou Android', () => {
  assert(authContextCode.includes('if (isEquipmentMode() && !isNativeMobile()) {'));
});

const apiPath = path.resolve('client/src/services/api.js');
const apiCode = fs.readFileSync(apiPath, 'utf8');

test('6.2 - api.js não exige pareamento com QR code ou IP no celular', () => {
  assert(!apiCode.includes('Nenhum servidor Motion Tennis configurado no aplicativo'));
  assert(apiCode.includes('Modo Cloud: servidor local da quadra não configurado.'));
});

// ── GRUPO 7: Verificação do APK Compilado ──
console.log('\n--- GRUPO 7: Verificação do APK Compilado ---');

const apkPath = path.resolve('client/android/app/build/outputs/apk/debug/app-debug.apk');
test('7.1 - APK Debug existe e foi compilado com sucesso', () => {
  assert(fs.existsSync(apkPath), `APK não encontrado em ${apkPath}`);
  const stats = fs.statSync(apkPath);
  assert(stats.size > 3 * 1024 * 1024, 'APK deve ter mais de 3MB');
  console.log(`      Tamanho do APK: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`);
});

// ── RESUMO FINAL ──
console.log('\n==============================================================================');
console.log(`TOTAL DE TESTES: ${passedCount + failedCount} | APROVADOS: ${passedCount} | FALHAS: ${failedCount}`);
console.log('==============================================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
}
