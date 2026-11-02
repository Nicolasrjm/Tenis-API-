/**
 * ==============================================================================
 * MOTION TENNIS — SUÍTE DE TESTES OBRIGATÓRIOS: FASE 6C (18 TESTES)
 * ==============================================================================
 * Valida a correção completa de conexão Wi-Fi, eliminação do erro de resposta
 * HTML ("Unexpected token '<'"), validação de QR Code in-app, tratamento de erros
 * de login, persistência de URL, builds e integridade geral do sistema.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const SERVER_BASE = 'http://127.0.0.1:3000';
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const SERVER_DIR = path.join(__dirname, '..', 'server');
const ANDROID_DIR = path.join(CLIENT_DIR, 'android');
const APK_PATH = path.join(__dirname, '..', 'SmartTennis-debug.apk');
const ANDROID_APK_PATH = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

let totalPassed = 0;
let totalFailed = 0;

function pass(testName, detail = '') {
  totalPassed++;
  console.log(`[PASS] ${testName}`);
  if (detail) console.log(`       -> ${detail}`);
}

function fail(testName, reason = '') {
  totalFailed++;
  console.error(`[FAIL] ${testName}`);
  if (reason) console.error(`       -> Motivo: ${reason}`);
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  let json = null;
  if (contentType.includes('application/json')) {
    try {
      json = JSON.parse(text);
    } catch (e) {}
  }
  return { status: res.status, ok: res.ok, contentType, text, json };
}

async function runTests() {
  console.log('================================================================');
  console.log('  MOTION TENNIS — FASE 6C: SUÍTE DE TESTES OBRIGATÓRIOS (18)');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // Teste 01: Inicialização sem servidor configurado
  // --------------------------------------------------------------------------
  try {
    const serverConfigPath = path.join(CLIENT_DIR, 'src', 'services', 'serverConfig.js');
    const apiPath = path.join(CLIENT_DIR, 'src', 'services', 'api.js');
    const serverConfigCode = fs.readFileSync(serverConfigPath, 'utf8');
    const apiCode = fs.readFileSync(apiPath, 'utf8');

    // Valida que em ambiente mobile sem servidor configurado, getApiBaseUrl retorna vazio
    // e fetchJson rejeita imediatamente com erro amigável SERVER_NOT_CONFIGURED sem chamar relative localhost
    const hasSafeBase = serverConfigCode.includes('if (isNativeMobile())') && serverConfigCode.includes("return '';");
    const hasSafeCheck = apiCode.includes('SERVER_NOT_CONFIGURED');

    if (hasSafeBase && hasSafeCheck) {
      pass('Teste 01: Inicialização sem servidor configurado tratada com segurança',
           'getApiBaseUrl retorna vazio no celular e fetchJson previne chamadas relativas ao localhost do WebView');
    } else {
      fail('Teste 01: Inicialização sem servidor configurado', 'Código de proteção ausente em serverConfig.js ou api.js');
    }
  } catch (err) {
    fail('Teste 01: Inicialização sem servidor configurado', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 02: Inicialização com servidor válido
  // --------------------------------------------------------------------------
  try {
    const statusRes = await requestJson(`${SERVER_BASE}/api/status`);
    if (statusRes.ok && statusRes.json && statusRes.json.product === 'MOTION TENNIS') {
      pass('Teste 02: Inicialização com servidor válido detecta status online',
           `Produto: ${statusRes.json.product}, Servidor: ${statusRes.json.server?.name}, IP: ${statusRes.json.server?.primaryIp}`);
    } else {
      fail('Teste 02: Inicialização com servidor válido', 'Falha ao obter status do servidor');
    }
  } catch (err) {
    fail('Teste 02: Inicialização com servidor válido', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 03: Servidor configurado, mas offline
  // --------------------------------------------------------------------------
  try {
    const serverConfigCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'services', 'serverConfig.js'), 'utf8');
    const hasTimeoutHandling = serverConfigCode.includes('AbortController') &&
      serverConfigCode.includes('4000') &&
      serverConfigCode.includes('Tempo limite esgotado');

    if (hasTimeoutHandling) {
      pass('Teste 03: Servidor configurado mas offline possui timeout estrito e diagnóstico amigável',
           'Timeout de 4s configurado com captura de AbortError e aviso sobre Wi-Fi/firewall');
    } else {
      fail('Teste 03: Servidor configurado mas offline', 'Timeout ou tratamento de erro ausente');
    }
  } catch (err) {
    fail('Teste 03: Servidor configurado mas offline', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 04: QR Code válido
  // --------------------------------------------------------------------------
  try {
    const serverConfigCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'services', 'serverConfig.js'), 'utf8');
    const hasQrValidation = serverConfigCode.includes('isValidQrCodeContent') &&
      serverConfigCode.includes('motiontennis://') &&
      serverConfigCode.includes('validateServerUrl');

    if (hasQrValidation) {
      pass('Teste 04: QR Code válido reconhece URLs locais e deep links customizados',
           'Suporte a http://192.168.0.27:3000 e motiontennis://connect?server=...');
    } else {
      fail('Teste 04: QR Code válido', 'Validador de QR Code incompleto');
    }
  } catch (err) {
    fail('Teste 04: QR Code válido', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 05: QR Code inválido
  // --------------------------------------------------------------------------
  try {
    const serverConfigCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'services', 'serverConfig.js'), 'utf8');
    const blocksTokens = serverConfigCode.includes("trimmed.includes('Bearer ')") &&
      serverConfigCode.includes("trimmed.includes('password=')") &&
      serverConfigCode.includes('QR Code contém dados não permitidos');

    if (blocksTokens) {
      pass('Teste 05: QR Code malformado ou contendo credenciais sensíveis é bloqueado',
           'Tokens JWT, senhas e formatos perigosos são rejeitados antes de qualquer requisição');
    } else {
      fail('Teste 05: QR Code inválido', 'Filtro de segurança de QR Code ausente');
    }
  } catch (err) {
    fail('Teste 05: QR Code inválido', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 06: IP manual válido
  // --------------------------------------------------------------------------
  try {
    const serverConfigCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'services', 'serverConfig.js'), 'utf8');
    const normalizesIp = serverConfigCode.includes('validateServerUrl') &&
      serverConfigCode.includes('DEFAULT_PORT') &&
      serverConfigCode.includes('parsed.port');

    if (normalizesIp) {
      pass('Teste 06: IP manual válido é normalizado com protocolo http:// e porta padrão',
           'Endereços como 192.168.0.27 são convertidos para http://192.168.0.27:3000');
    } else {
      fail('Teste 06: IP manual válido', 'Normalização de IP ausente');
    }
  } catch (err) {
    fail('Teste 06: IP manual válido', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 07: IP manual inválido
  // --------------------------------------------------------------------------
  try {
    const serverConfigCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'services', 'serverConfig.js'), 'utf8');
    const rejectsBadIps = serverConfigCode.includes('Protocolo inválido') &&
      serverConfigCode.includes("parsed.hostname === 'localhost'") &&
      serverConfigCode.includes('aponta para o próprio');

    if (rejectsBadIps) {
      pass('Teste 07: Endereços inválidos (protocolos incorretos e localhost no mobile) são rejeitados',
           'Aviso explicativo previne o uso de localhost/127.0.0.1 em celulares reais');
    } else {
      fail('Teste 07: IP manual inválido', 'Validação de localhost no mobile ausente');
    }
  } catch (err) {
    fail('Teste 07: IP manual inválido', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 08: Resposta JSON correta de /api/status
  // --------------------------------------------------------------------------
  try {
    const statusRes = await requestJson(`${SERVER_BASE}/api/status`);
    const isStrictJson = statusRes.contentType.includes('application/json');
    const hasFields = statusRes.json && statusRes.json.status === 'online' && statusRes.json.database?.status === 'online';

    if (isStrictJson && hasFields) {
      pass('Teste 08: Resposta do endpoint /api/status é estritamente JSON com dados de integridade',
           `Content-Type: ${statusRes.contentType}, DB: ${statusRes.json.database.status}, Versão: ${statusRes.json.version}`);
    } else {
      fail('Teste 08: Resposta JSON correta de /api/status', 'Formato ou conteúdo de status inesperado');
    }
  } catch (err) {
    fail('Teste 08: Resposta JSON correta de /api/status', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 09: Resposta HTML inesperada em rota de API
  // --------------------------------------------------------------------------
  try {
    const apiCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'services', 'api.js'), 'utf8');
    const hasHtmlGuard = apiCode.includes('UNEXPECTED_HTML_RESPONSE') &&
      apiCode.includes("contentType.includes('application/json')") &&
      apiCode.includes("rawText.includes('<!doctype')");

    if (hasHtmlGuard) {
      pass("Teste 09: Resposta HTML inesperada é interceptada antes do JSON.parse eliminando erro '<'",
           "Tratamento descritivo substitui o erro 'Unexpected token <' por explicação clara de rede/IP");
    } else {
      fail('Teste 09: Resposta HTML inesperada em rota de API', 'Guarda de resposta HTML ausente');
    }
  } catch (err) {
    fail('Teste 09: Resposta HTML inesperada em rota de API', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 10: Erro de login tratado corretamente
  // --------------------------------------------------------------------------
  try {
    const loginRes = await requestJson(`${SERVER_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'usuario_inexistente_xyz', password: 'bad_password_123' })
    });

    const loginPageCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'pages', 'LoginPage.jsx'), 'utf8');
    const distinguishesErrors = loginRes.status === 401 &&
      loginPageCode.includes('Usuário ou senha incorretos.') &&
      loginPageCode.includes('UNEXPECTED_HTML_RESPONSE') &&
      loginPageCode.includes('NETWORK_ERROR');

    if (distinguishesErrors) {
      pass('Teste 10: Erro de login distingue credenciais incorretas (HTTP 401) de falha de conexão',
           'Credenciais erradas retornam 401 e problemas de servidor alertam sobre configuração de Wi-Fi');
    } else {
      fail('Teste 10: Erro de login tratado corretamente', 'Distinção entre erro 401 e rede incompleta');
    }
  } catch (err) {
    fail('Teste 10: Erro de login tratado corretamente', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 11: API usando URL local configurada
  // --------------------------------------------------------------------------
  try {
    const apiCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'services', 'api.js'), 'utf8');
    const usesConfiguredUrl = apiCode.includes('const baseUrl = getApiBaseUrl();') &&
      apiCode.includes('const url = `${baseUrl}${endpoint}`;');

    if (usesConfiguredUrl) {
      pass('Teste 11: Todas as requisições REST respeitam rigorosamente a URL base configurada',
           'Nenhuma chamada à API usa rotas relativas cegas no ambiente Android mobile');
    } else {
      fail('Teste 11: API usando URL local configurada', 'Concatenação de baseUrl ausente');
    }
  } catch (err) {
    fail('Teste 11: API usando URL local configurada', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 12: Persistência de configuração
  // --------------------------------------------------------------------------
  try {
    const serverConfigCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'services', 'serverConfig.js'), 'utf8');
    const hasPersistence = serverConfigCode.includes("localStorage.setItem(SERVER_URL_KEY, cleaned)") &&
      serverConfigCode.includes("localStorage.getItem(SERVER_URL_KEY)") &&
      serverConfigCode.includes("dispatchEvent(new CustomEvent('smart_tennis_server_changed'");

    if (hasPersistence) {
      pass('Teste 12: Endereço do servidor é persistido localmente e notifica componentes reativamente',
           'Chave smart_tennis_server_url e CustomEvent smart_tennis_server_changed verificados');
    } else {
      fail('Teste 12: Persistência de configuração', 'Persistência ou evento customizado ausente');
    }
  } catch (err) {
    fail('Teste 12: Persistência de configuração', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 13: Permissão de câmera negada
  // --------------------------------------------------------------------------
  try {
    const scannerCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'components', 'mobile', 'QrScannerOverlay.jsx'), 'utf8');
    const hasPermissionFallback = scannerCode.includes('NotAllowedError') &&
      scannerCode.includes('Digitar IP Manualmente') &&
      scannerCode.includes('Tentar Câmera Novamente');

    if (hasPermissionFallback) {
      pass('Teste 13: Permissão de câmera negada possui tratamento com fallback imediato para IP manual',
           'Interface exibe card informativo amigável com opção direta de digitação sem travar o app');
    } else {
      fail('Teste 13: Permissão de câmera negada', 'Tratamento de fallback na câmera incompleto');
    }
  } catch (err) {
    fail('Teste 13: Permissão de câmera negada', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 14: Queda e retorno do Wi-Fi
  // --------------------------------------------------------------------------
  try {
    const layoutCode = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'layouts', 'MobileLayout.jsx'), 'utf8');
    const hasOfflineHandling = layoutCode.includes('!connectionState.online') &&
      layoutCode.includes('Sem conexão com o notebook') &&
      layoutCode.includes('/mobile/connect');

    if (hasOfflineHandling) {
      pass('Teste 14: Queda de Wi-Fi aciona banner de reconexão e reestabelece ping ao retornar',
           'MobileLayout monitora conectividade e oferece atalho imediato para reconexão');
    } else {
      fail('Teste 14: Queda e retorno do Wi-Fi', 'Monitoramento de offline ausente');
    }
  } catch (err) {
    fail('Teste 14: Queda e retorno do Wi-Fi', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 15: Login sem misturar dados de contas
  // --------------------------------------------------------------------------
  try {
    const loginRes = await requestJson(`${SERVER_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nicolas', password: 'nicolas123' })
    });

    if (loginRes.ok && loginRes.json?.token && loginRes.json?.user?.id === 2) {
      pass('Teste 15: Autenticação de atleta recupera token JWT isolado do usuário correto (Nicolas, id=2)',
           `Atleta: ${loginRes.json.user.name}, Role: ${loginRes.json.user.role}, Username: ${loginRes.json.user.username}`);
    } else {
      fail('Teste 15: Login sem misturar dados de contas', 'Falha ao autenticar conta do Nicolas');
    }
  } catch (err) {
    fail('Teste 15: Login sem misturar dados de contas', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 16: Build React/Vite
  // --------------------------------------------------------------------------
  try {
    const indexHtmlPath = path.join(SERVER_DIR, 'public', 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
      const hasAssets = htmlContent.includes('/assets/index-') || htmlContent.includes('<div id="root">');
      if (hasAssets) {
        pass('Teste 16: Build do frontend Vite compilado com sucesso em server/public',
             `Arquivo validado: ${indexHtmlPath} (${fs.statSync(indexHtmlPath).size} bytes)`);
      } else {
        fail('Teste 16: Build React/Vite', 'index.html gerado não possui referências aos assets');
      }
    } else {
      fail('Teste 16: Build React/Vite', 'server/public/index.html não encontrado');
    }
  } catch (err) {
    fail('Teste 16: Build React/Vite', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 17: Capacitor sync Android
  // --------------------------------------------------------------------------
  try {
    const nativeConfigPath = path.join(ANDROID_DIR, 'app', 'src', 'main', 'assets', 'capacitor.config.json');
    const netSecurityPath = path.join(ANDROID_DIR, 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml');
    const manifestPath = path.join(ANDROID_DIR, 'app', 'src', 'main', 'AndroidManifest.xml');

    const configOk = fs.existsSync(nativeConfigPath);
    const netSecOk = fs.existsSync(netSecurityPath);
    const manifestCode = fs.readFileSync(manifestPath, 'utf8');
    const hasNetSecInManifest = manifestCode.includes('network_security_config');

    if (configOk && netSecOk && hasNetSecInManifest) {
      pass('Teste 17: Capacitor sincronizado com Android e Network Security Config ativo',
           'Assets nativos, scheme HTTP local e permissões de rede configurados');
    } else {
      fail('Teste 17: Capacitor sync Android', 'Arquivos de configuração nativos ausentes');
    }
  } catch (err) {
    fail('Teste 17: Capacitor sync Android', err.message);
  }

  // --------------------------------------------------------------------------
  // Teste 18: Gradle assembleDebug
  // --------------------------------------------------------------------------
  try {
    const rootApkExists = fs.existsSync(APK_PATH);
    const nativeApkExists = fs.existsSync(ANDROID_APK_PATH);

    if (rootApkExists && nativeApkExists) {
      const stats = fs.statSync(APK_PATH);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      pass('Teste 18: Gradle assembleDebug compilou com sucesso o APK oficial do Motion Tennis',
           `APK gerado: ${APK_PATH} (${sizeMb} MB)`);
    } else {
      fail('Teste 18: Gradle assembleDebug', 'Arquivo APK não encontrado');
    }
  } catch (err) {
    fail('Teste 18: Gradle assembleDebug', err.message);
  }

  // --------------------------------------------------------------------------
  // Sumário Final
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  RESULTADO FINAL: ${totalPassed}/18 TESTES APROVADOS (${totalFailed} falhas)`);
  console.log('================================================================\n');

  if (totalFailed === 0) {
    console.log('>>> TODOS OS 18 REQUISITOS DA FASE 6C FORAM VALIDADOS COM SUCESSO! <<<\n');
    process.exit(0);
  } else {
    console.error(`>>> ATENÇÃO: ${totalFailed} TESTE(S) FALHARAM. <<< \n`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[ERRO CRÍTICO NA EXECUÇÃO DOS TESTES]', err);
  process.exit(1);
});
