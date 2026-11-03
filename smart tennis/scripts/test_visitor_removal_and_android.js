/**
 * ==============================================================================
 * MOTION TENNIS — TESTES AUTOMATIZADOS: REMOÇÃO DE VISITANTE & PREPARAÇÃO ANDROID
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n==============================================================================');
console.log('🎾 MOTION TENNIS — TESTES DE REMOÇÃO DO VISITANTE E BUILD ANDROID CAPACITOR');
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

// ── GRUPO 1: Remoção do Acesso Visitante na Versão Pública e Mobile ──
console.log('--- GRUPO 1: Remoção do Acesso Visitante na Versão Pública e Mobile ---');

const loginPath = path.resolve('client/src/pages/LoginPage.jsx');
const loginCode = fs.readFileSync(loginPath, 'utf8');

test('1.1 - Importação de isEquipmentMode e isWebDemoMode em LoginPage', () => {
  assert(loginCode.includes('isEquipmentMode'), 'Deve importar isEquipmentMode');
  assert(loginCode.includes('isWebDemoMode'), 'Deve importar isWebDemoMode');
});

test('1.2 - Condição canShowGuest restringindo visitante exclusivamente ao notebook físico', () => {
  assert(
    loginCode.includes('canShowGuest = isEquipmentMode() && !isNativeMobile() && !isMobileDevice()'),
    'canShowGuest deve checar isEquipmentMode(), !isNativeMobile() e !isMobileDevice()'
  );
});

test('1.3 - Abas adaptativas (grid-cols-2 na web/mobile e grid-cols-3 no equipamento)', () => {
  assert(
    loginCode.includes("grid ${canShowGuest ? 'grid-cols-3' : 'grid-cols-2'}"),
    'Grid de abas deve ser grid-cols-2 quando visitante não for exibido'
  );
});

test('1.4 - Botão de aba Visitante condicional à flag canShowGuest', () => {
  assert(
    loginCode.includes('{canShowGuest && (') && loginCode.includes('data-testid="btn-play-as-guest"'),
    'Botão de aba Visitante deve ser envolvido por {canShowGuest && (...)}'
  );
});

test('1.5 - Conteúdo da aba Visitante condicional à flag canShowGuest', () => {
  assert(
    loginCode.includes('{canShowGuest && activeTab === \'guest\' && ('),
    'Conteúdo da aba Visitante deve ser protegido por {canShowGuest && activeTab === "guest" && (...)}'
  );
});

test('1.6 - Trava defensiva em handlePlayAsGuest contra chamadas indevidas fora do equipamento', () => {
  assert(
    loginCode.includes('if (!canShowGuest) {'),
    'handlePlayAsGuest deve verificar !canShowGuest'
  );
  assert(
    loginCode.includes('O modo visitante está disponível apenas no equipamento físico da quadra.'),
    'Mensagem de proteção ao usuário deve estar presente'
  );
});

// ── GRUPO 2: Modos Operacionais (appEnvironment & serverConfig) ──
console.log('\n--- GRUPO 2: Modos Operacionais (appEnvironment & serverConfig) ---');

const appEnvPath = path.resolve('client/src/services/appEnvironment.js');
const appEnvCode = fs.readFileSync(appEnvPath, 'utf8');

test('2.1 - appEnvironment define modos WEB_DEMO e EQUIPMENT', () => {
  assert(appEnvCode.includes("WEB_DEMO: 'web_demo'"), 'Deve conter WEB_DEMO');
  assert(appEnvCode.includes("EQUIPMENT: 'equipment'"), 'Deve conter EQUIPMENT');
});

test('2.2 - Detecção automática de host Vercel em runtime', () => {
  assert(appEnvCode.includes('.vercel.app'), 'Deve detectar terminação .vercel.app');
});

const serverConfigPath = path.resolve('client/src/services/serverConfig.js');
const serverConfigCode = fs.readFileSync(serverConfigPath, 'utf8');

test('2.3 - Detecção de plataforma nativa via Capacitor', () => {
  assert(serverConfigCode.includes('Capacitor.isNativePlatform()'), 'isNativeMobile deve checar Capacitor');
});

// ── GRUPO 3: Navegação e Rotas no App (App.jsx) ──
console.log('\n--- GRUPO 3: Navegação e Rotas no App (App.jsx) ---');

const appPath = path.resolve('client/src/App.jsx');
const appCode = fs.readFileSync(appPath, 'utf8');

test('3.1 - Rota raiz no app nativo redireciona para mobile dashboard sem forçar pareamento prévio', () => {
  assert(
    appCode.includes('isNativeMobile() ? <Navigate to="/mobile/dashboard" replace /> : <LandingPage />'),
    'App nativo deve abrir direto na área mobile/dashboard'
  );
});

test('3.2 - Rotas de autenticação e mobile preservadas integralmente', () => {
  assert(appCode.includes('path="/login"'), 'Rota de login preservada');
  assert(appCode.includes('path="/mobile"'), 'Rota mobile preservada');
  assert(appCode.includes('path="dashboard"'), 'Rota dashboard preservada');
  assert(appCode.includes('path="history"'), 'Rota history preservada');
  assert(appCode.includes('path="evolution"'), 'Rota evolution preservada');
  assert(appCode.includes('path="academy"'), 'Rota academy preservada');
  assert(appCode.includes('path="profile"'), 'Rota profile preservada');
});

// ── GRUPO 4: Configuração e Build do Capacitor Android ──
console.log('\n--- GRUPO 4: Configuração e Build do Capacitor Android ---');

const capConfigPath = path.resolve('client/capacitor.config.json');
const capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));

test('4.1 - capacitor.config.json aponta para ativos locais compilados (sem URL remota/localhost)', () => {
  assert.strictEqual(capConfig.appId, 'com.smarttennis.app', 'appId deve ser com.smarttennis.app');
  assert.strictEqual(capConfig.appName, 'Motion Tennis', 'appName deve ser Motion Tennis');
  assert.strictEqual(capConfig.webDir, '../server/public', 'webDir deve apontar para ../server/public');
  assert(!capConfig.server?.url, 'Não deve conter server.url apontando para navegador remoto ou localhost');
});

const androidManifestPath = path.resolve('client/android/app/src/main/AndroidManifest.xml');
assert(fs.existsSync(androidManifestPath), 'AndroidManifest.xml deve existir');
const manifestCode = fs.readFileSync(androidManifestPath, 'utf8');

test('4.2 - AndroidManifest contém permissões necessárias e nenhuma invasiva', () => {
  assert(manifestCode.includes('android.permission.INTERNET'), 'Deve ter permissão INTERNET');
  assert(manifestCode.includes('android.permission.CAMERA'), 'Deve ter permissão CAMERA para QR Code');
  assert(manifestCode.includes('android.permission.ACCESS_NETWORK_STATE'), 'Deve ter ACCESS_NETWORK_STATE');
  assert(!manifestCode.includes('android.permission.READ_CONTACTS'), 'Não deve pedir contatos');
  assert(!manifestCode.includes('android.permission.ACCESS_FINE_LOCATION'), 'Não deve pedir localização precisa');
  assert(!manifestCode.includes('android.permission.RECORD_AUDIO'), 'Não deve pedir áudio/microfone');
});

const apkPath = path.resolve('client/android/app/build/outputs/apk/debug/app-debug.apk');
test('4.3 - APK debug foi compilado com sucesso e possui tamanho consistente', () => {
  assert(fs.existsSync(apkPath), `APK não encontrado em: ${apkPath}`);
  const stats = fs.statSync(apkPath);
  assert(stats.size > 2 * 1024 * 1024, `APK deve ter mais de 2MB (tamanho atual: ${stats.size} bytes)`);
  console.log(`      Tamanho do APK compilado: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`);
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
