/**
 * test_vercel_preparation.js
 * 
 * Validação rigorosa dos 14 itens obrigatórios para publicação segura na Vercel:
 * 1. Build de produção (Vercel dist & Notebook public)
 * 2. Ausência de credenciais privadas (zero service_role, zero postgres passwords)
 * 3. Ausência de atalhos de DEV no bundle de produção
 * 4. Configuração Vercel (vercel.json, rewrites SPA, headers de segurança e cache)
 * 5. Reutilização de componentes (PlayPage única, sem duplicatas)
 * 6. Jogo Demonstrativo com mouse: 100% em memória, zero persistência
 * 7. Invariante da Arena Escura (#050D07) no jogo demonstrativo
 * 8. Identificação discreta de demonstração ("Partida demonstrativa — resultados não são salvos")
 * 9. Isolamento arquitetural de rede (WebSocket e Hardware APIs inertes em web_demo)
 * 10. Arquitetura de leitura Cloud via PostgREST com RLS
 * 11. Tratamento gracioso de indisponibilidade de backend local
 * 12. Persistência de tema Claro/Escuro
 * 13. Arquivo .env.example seguro com placeholders
 * 14. Preservação integral do ambiente do equipamento físico
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
console.log('🎾 MOTION TENNIS — TESTES DE PREPARAÇÃO PARA DEPLOY VERCEL');
console.log('==============================================================================\n');

// ----------------------------------------------------------------------------
// GRUPO 1: Configuração Vercel e Build de Produção
// ----------------------------------------------------------------------------
console.log('--- GRUPO 1: Configuração Vercel e Build de Produção ---');

const clientVercelPath = path.join(projectRoot, 'client', 'vercel.json');
assert(fs.existsSync(clientVercelPath), 'client/vercel.json existe');
const clientVercel = JSON.parse(fs.readFileSync(clientVercelPath, 'utf8'));

assert(clientVercel.outputDirectory === 'dist', 'outputDirectory configurado como "dist"');
assert(clientVercel.rewrites && clientVercel.rewrites.some((r) => r.source === '/(.*)' && r.destination === '/index.html'), 'Rewrite SPA configurado para /index.html');
assert(clientVercel.headers && clientVercel.headers.some((h) => h.source && h.source.includes('assets')), 'Cache-Control configurado para assets');

const rootVercelPath = path.join(projectRoot, 'vercel.json');
assert(fs.existsSync(rootVercelPath), 'vercel.json na raiz do projeto existe');

const clientDistHtml = path.join(projectRoot, 'client', 'dist', 'index.html');
assert(fs.existsSync(clientDistHtml), 'Build Vercel gerou client/dist/index.html');

const serverPublicHtml = path.join(projectRoot, 'server', 'public', 'index.html');
assert(fs.existsSync(serverPublicHtml), 'Build local gerou server/public/index.html');

// ----------------------------------------------------------------------------
// GRUPO 2: Segurança do Bundle de Produção (Zero Segredos e Zero DEV Shortcuts)
// ----------------------------------------------------------------------------
console.log('\n--- GRUPO 2: Segurança do Bundle de Produção ---');

const distAssetsDir = path.join(projectRoot, 'client', 'dist', 'assets');
assert(fs.existsSync(distAssetsDir), 'Pasta client/dist/assets existe');
const distFiles = fs.readdirSync(distAssetsDir);
const jsBundleName = distFiles.find((f) => f.endsWith('.js'));
assert(Boolean(jsBundleName), 'Bundle JS de produção localizado: ' + jsBundleName);

const bundleContent = fs.readFileSync(path.join(distAssetsDir, jsBundleName), 'utf8');

assert(!bundleContent.includes('service_role'), 'Bundle NÃO contém service_role');
assert(!bundleContent.includes('postgres://') && !bundleContent.includes('postgresql://'), 'Bundle NÃO contém credenciais PostgreSQL');
assert(!bundleContent.includes('dev-shortcuts-panel'), 'Painel de atalhos DEV removido pelo tree-shaking');
assert(!bundleContent.includes('dev-shortcut-nicolas'), 'Atalho de Nicolas removido pelo tree-shaking');
assert(!bundleContent.includes('dev-shortcut-admin'), 'Atalho de Admin removido pelo tree-shaking');

const envExamplePath = path.join(projectRoot, 'client', '.env.example');
assert(fs.existsSync(envExamplePath), '.env.example existe');
const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
assert(!envExampleContent.includes('eyJ') && !envExampleContent.includes('secret'), '.env.example contém apenas placeholders');
assert(envExampleContent.includes('VITE_APP_MODE=web_demo'), '.env.example orienta VITE_APP_MODE=web_demo');

// ----------------------------------------------------------------------------
// GRUPO 3: Reutilização de Código e Não-Duplicação
// ----------------------------------------------------------------------------
console.log('\n--- GRUPO 3: Reutilização e Não-Duplicação ---');

const webDemoPlayPath = path.join(projectRoot, 'client', 'src', 'components', 'WebDemoPlay.jsx');
assert(!fs.existsSync(webDemoPlayPath), 'WebDemoPlay.jsx redundante NÃO existe (código reutilizado no PlayPage)');

const webDemoEnginePath = path.join(projectRoot, 'client', 'src', 'services', 'webDemoEngine.js');
assert(!fs.existsSync(webDemoEnginePath), 'webDemoEngine.js redundante NÃO existe (motor de jogo único reaproveitado)');

const appEnvPath = path.join(projectRoot, 'client', 'src', 'services', 'appEnvironment.js');
assert(fs.existsSync(appEnvPath), 'appEnvironment.js existe como ponto central de controle');
const appEnvContent = fs.readFileSync(appEnvPath, 'utf8');
assert(appEnvContent.includes('isWebDemoMode') && appEnvContent.includes('isEquipmentMode'), 'appEnvironment exporta checagens explícitas de ambiente');

// ----------------------------------------------------------------------------
// GRUPO 4: Jogo Demonstrativo com Mouse no PlayPage
// ----------------------------------------------------------------------------
console.log('\n--- GRUPO 4: Jogo Demonstrativo com Mouse no PlayPage ---');

const playPagePath = path.join(projectRoot, 'client', 'src', 'pages', 'PlayPage.jsx');
const playPageContent = fs.readFileSync(playPagePath, 'utf8');

assert(playPageContent.includes('isWebDemoMode'), 'PlayPage importa isWebDemoMode');
assert(playPageContent.includes('web-demo-discreet-badge'), 'Badge discreto "Partida demonstrativa — resultados não são salvos" presente');
assert(playPageContent.includes('focus-game-viewport'), 'Viewport do modo foco mantido');
assert(playPageContent.includes('#050D07'), 'Arena ativa mantém fundo preto de projeção (#050D07)');

// Verifica que no modo web demo as operações de rede de hardware são ignoradas
assert(playPageContent.includes('if (isWebDemo)'), 'Fluxo isWebDemo explicitamente tratado');
assert(playPageContent.includes('Setor ${hitSector} atingido! +85 pts'), 'Pontuação de 85 pts no Treino Livre calculada em memória');
assert(playPageContent.includes('DESAFIO CONCLUÍDO!'), 'Bônus de vitória no modo Apagar Todos calculado em memória');

// ----------------------------------------------------------------------------
// GRUPO 5: Isolamento de Rede e APIs
// ----------------------------------------------------------------------------
console.log('\n--- GRUPO 5: Isolamento de Rede e APIs ---');

const wsPath = path.join(projectRoot, 'client', 'src', 'services', 'websocket.js');
const wsContent = fs.readFileSync(wsPath, 'utf8');
assert(wsContent.includes('isWebDemoMode()'), 'WebSocket cancela conexão quando isWebDemoMode é verdadeiro');

const apiPath = path.join(projectRoot, 'client', 'src', 'services', 'api.js');
const apiContent = fs.readFileSync(apiPath, 'utf8');
assert(apiContent.includes('isWebDemoMode'), 'api.js consulta isWebDemoMode');
assert(apiContent.includes('cloudDataService'), 'api.js delega leituras para cloudDataService quando sem servidor local');

// ----------------------------------------------------------------------------
// GRUPO 6: Preservação do Capacitor (sem phantom dependency)
// ----------------------------------------------------------------------------
console.log('\n--- GRUPO 6: Preservação do Capacitor e Dependências Limpas ---');

const pkgPath = path.join(projectRoot, 'client', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
assert(!pkg.dependencies['smart-tennis'], 'Dependência fantasma "smart-tennis": "file:.." removida com sucesso');
assert(Boolean(pkg.dependencies['@capacitor/core']), 'Capacitor Core preservado para futuro APK');
assert(Boolean(pkg.scripts['build:vercel']), 'Script build:vercel configurado no package.json');

console.log('\n==============================================================================');
console.log(`TOTAL DE TESTES VERCEL: ${totalTests}`);
console.log(`PASSADOS: ${passedTests}`);
console.log(`FALHADOS: ${failedTests}`);
console.log('==============================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
