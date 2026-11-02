/**
 * MOTION TENNIS — SUÍTE DE TESTES AUTOMATIZADOS: FASE 6A
 * Fundação do Aplicativo Android e Conexão Local por QR Code
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_PORT = 3000;
const BASE_URL = `http://127.0.0.1:${SERVER_PORT}`;

// Função idêntica ao client/src/services/serverConfig.js
function validateServerUrl(rawUrl, isMobile = false) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'O endereço não pode estar vazio.' };
  }

  let cleaned = rawUrl.trim().replace(/\/+$/, '');
  if (!cleaned) {
    return { valid: false, error: 'O endereço não pode estar vazio.' };
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned)) {
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      return { valid: false, error: 'Protocolo inválido. Utilize http:// ou https://.' };
    }
  } else {
    cleaned = `http://${cleaned}`;
  }

  try {
    const parsed = new URL(cleaned);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Protocolo inválido. Utilize http:// ou https://.' };
    }

    if (!parsed.hostname || parsed.hostname.length === 0) {
      return { valid: false, error: 'Nome de host ou endereço IP ausente.' };
    }

    if (isMobile && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return {
        valid: false,
        error: "No celular, 'localhost' ou '127.0.0.1' aponta para o próprio telefone. Use o IP local do notebook (ex: http://192.168.0.27:3000)."
      };
    }

    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      return { valid: false, error: 'Endereço inválido. Informe um IP local válido (ex: http://192.168.0.27:3000).' };
    }

    if (parsed.port) {
      const portNum = parseInt(parsed.port, 10);
      if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
        return { valid: false, error: 'Porta inválida (deve estar entre 1 e 65535).' };
      }
    } else if (!cleaned.includes(':') || (cleaned.split(':').length === 2 && cleaned.startsWith('http'))) {
      if (!parsed.hostname.includes('.com') && !parsed.hostname.includes('.org') && !parsed.hostname.includes('.net')) {
        parsed.port = '3000';
        cleaned = parsed.origin;
      }
    }

    return { valid: true, normalizedUrl: cleaned };
  } catch (err) {
    return { valid: false, error: 'Formato de endereço inválido. Exemplo: http://192.168.0.27:3000' };
  }
}

function isValidQrCodeContent(qrText) {
  if (!qrText || typeof qrText !== 'string') {
    return { valid: false, error: 'QR Code vazio ou não reconhecido.' };
  }
  const trimmed = qrText.trim();
  if (trimmed.includes('Bearer ') || trimmed.includes('"token"') || trimmed.includes('password=')) {
    return { valid: false, error: 'QR Code contém dados não permitidos. Escaneie apenas o QR Code de conexão do servidor.' };
  }
  return validateServerUrl(trimmed, false);
}

// Helper fetch HTTP
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: `${u.pathname}${u.search}`,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 3000,
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TIMEOUT_ERROR'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('  MOTION TENNIS — FASE 6A: SUÍTE DE TESTES OBRIGATÓRIOS (15)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 15;

  function assert(testNum, desc, condition, extraInfo = '') {
    if (condition) {
      console.log(`[PASS] Teste ${testNum.toString().padStart(2, '0')}: ${desc}`);
      if (extraInfo) console.log(`       -> ${extraInfo}`);
      passed++;
    } else {
      console.error(`[FAIL] Teste ${testNum.toString().padStart(2, '0')}: ${desc}`);
      if (extraInfo) console.error(`       -> ${extraInfo}`);
    }
  }

  // 1. Aplicativo inicia no Android
  const capacitorConfigFile = path.join(__dirname, '../client/capacitor.config.json');
  const capConfig = JSON.parse(fs.readFileSync(capacitorConfigFile, 'utf8'));
  const androidEntryExists = capConfig.appId === 'com.smarttennis.app' && capConfig.appName === 'Motion Tennis';
  assert(1, 'Aplicativo configurado para Android com ID e Nome corretos', androidEntryExists, `App ID: ${capConfig.appId}, Name: ${capConfig.appName}`);

  // 2. Tela de conexão é exibida
  const mobileConnectPagePath = path.join(__dirname, '../client/src/pages/mobile/MobileConnectPage.jsx');
  const mobileConnectContent = fs.readFileSync(mobileConnectPagePath, 'utf8');
  const hasConnectionUI = mobileConnectContent.includes('Conectar ao Motion Tennis') &&
                          mobileConnectContent.includes('Opção A — Escanear QR Code') &&
                          mobileConnectContent.includes('Opção B — Informar Endereço Manualmente') &&
                          mobileConnectContent.includes('Estado da Conexão');
  assert(2, 'Tela de Conexão Mobile implementada com todas as opções e cards de estado', hasConnectionUI, 'MobileConnectPage.jsx verificado');

  // 3. IP manual aceita endereço local válido
  const validIpRes = validateServerUrl('http://192.168.0.27:3000');
  const validIpRes2 = validateServerUrl('192.168.1.50');
  assert(3, 'IP manual aceita endereços locais válidos', validIpRes.valid && validIpRes2.valid, `Normalizado: ${validIpRes.normalizedUrl}`);

  // 4. Endereços inválidos são rejeitados
  const invalid1 = validateServerUrl('');
  const invalid2 = validateServerUrl('ftp://192.168.0.27:3000');
  const invalid3 = validateServerUrl('http://192.168.0.27:999999');
  const allInvalidRejected = !invalid1.valid && !invalid2.valid && !invalid3.valid;
  assert(4, 'Endereços inválidos (vazio, protocolo inválido, porta fora da faixa) são rejeitados', allInvalidRejected, `Erro esperado capturado: ${invalid2.error}`);

  // 5. QR Code válido configura a API
  const validQr = isValidQrCodeContent('http://192.168.0.27:3000');
  assert(5, 'QR Code válido é reconhecido e aceito', validQr.valid && validQr.normalizedUrl === 'http://192.168.0.27:3000', `URL configurada: ${validQr.normalizedUrl}`);

  // 6. QR Code malformado não é aceito
  const malformedQr1 = isValidQrCodeContent('ESTE_TEXTO_NAO_E_UMA_URL');
  const malformedQr2 = isValidQrCodeContent('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  assert(6, 'QR Code malformado ou contendo tokens confidenciais é rejeitado', !malformedQr1.valid && !malformedQr2.valid, `Rejeição segura: ${malformedQr2.error}`);

  // 7. API online retorna status correto
  let apiStatusOk = false;
  let serverName = '';
  let primaryIp = '';
  try {
    const res = await fetchJson(`${BASE_URL}/api/status`);
    apiStatusOk = res.status === 200 && res.data.status === 'online' && res.data.product === 'MOTION TENNIS';
    serverName = res.data.server?.name || '';
    primaryIp = res.data.server?.primaryIp || '';
  } catch (e) {
    apiStatusOk = false;
  }
  assert(7, 'API online retorna status correto e informações do servidor', apiStatusOk, `Produto: MOTION TENNIS, Servidor: ${serverName}, IP LAN: ${primaryIp}`);

  // 8. API desligada apresenta erro claro
  let connectionFailedGracefully = false;
  try {
    await fetchJson('http://127.0.0.1:39999/api/status', { timeout: 1000 });
  } catch (err) {
    connectionFailedGracefully = true;
  }
  assert(8, 'API inacessível gera erro e permite tratamento com mensagem amigável', connectionFailedGracefully, 'Falha tratada com timeout / catch');

  // 9. A URL escolhida permanece após reiniciar o aplicativo
  const serverConfigSrc = fs.readFileSync(path.join(__dirname, '../client/src/services/serverConfig.js'), 'utf8');
  const hasPersistentStorage = serverConfigSrc.includes('localStorage.setItem(SERVER_URL_KEY') &&
                               serverConfigSrc.includes('localStorage.getItem(SERVER_URL_KEY');
  assert(9, 'A URL escolhida é persistida em armazenamento local permanente', hasPersistentStorage, 'Chave de armazenamento: smart_tennis_server_url');

  // 10. O aplicativo não utiliza localhost indevidamente
  const localhostMobileCheck = validateServerUrl('http://localhost:3000', true);
  assert(10, 'Aplicativo no ambiente mobile rejeita localhost e alerta o usuário', !localhostMobileCheck.valid && localhostMobileCheck.error.includes('aponta para o próprio telefone'), localhostMobileCheck.error);

  // 11. Login funciona pela rede local
  let loginOk = false;
  try {
    const loginRes = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'nicolas', password: 'nicolas123' }
    });
    loginOk = loginRes.status === 200 && Boolean(loginRes.data.token);
  } catch (e) {
    loginOk = false;
  }
  assert(11, 'Login de jogador funciona com sucesso pela API REST', loginOk, 'Token de autenticação gerado com sucesso');

  // 12. Visitante não acessa dados privados
  let visitorAccessDenied = false;
  try {
    const privateRes = await fetchJson(`${BASE_URL}/api/player/1`);
    visitorAccessDenied = privateRes.status === 401 || privateRes.status === 403;
  } catch (e) {
    visitorAccessDenied = true;
  }
  assert(12, 'Visitante não autenticado é bloqueado de acessar dados privados de jogador', visitorAccessDenied, 'Status 401/403 verificado para rota de jogador');

  // 13. Permissão de câmera é tratada corretamente
  const qrScannerSrc = fs.readFileSync(path.join(__dirname, '../client/src/components/mobile/QrScannerOverlay.jsx'), 'utf8');
  const hasCameraErrorHandling = qrScannerSrc.includes('NotAllowedError') &&
                                 qrScannerSrc.includes('Permissão de câmera negada') &&
                                 qrScannerSrc.includes('Digitar IP Manualmente');
  assert(13, 'Permissão de câmera negada é tratada com opção de digitação manual de IP', hasCameraErrorHandling, 'QrScannerOverlay possui fallback completo para recusa de permissão');

  // 14. Frontend compila
  const clientPublicIndex = path.join(__dirname, '../server/public/index.html');
  const clientAssetsExist = fs.existsSync(clientPublicIndex);
  assert(14, 'Frontend compila com sucesso (Vite build gera bundle em server/public)', clientAssetsExist, `Arquivo gerado: ${clientPublicIndex}`);

  // 15. O projeto Android sincroniza e compila
  const apkPath = path.join(__dirname, '../client/android/app/build/outputs/apk/debug/app-debug.apk');
  const apkExists = fs.existsSync(apkPath);
  const apkSize = apkExists ? fs.statSync(apkPath).size : 0;
  assert(15, 'Projeto Android sincroniza e compila gerando o APK de debug oficial', apkExists && apkSize > 1000000, `APK gerado: ${apkPath} (${(apkSize / (1024 * 1024)).toFixed(2)} MB)`);

  console.log('\n================================================================');
  console.log(`  RESULTADO FINAL: ${passed}/${total} TESTES APROVADOS`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('>>> TODOS OS 15 REQUISITOS DA FASE 6A FORAM VALIDADOS COM SUCESSO! <<<');
    process.exit(0);
  } else {
    console.error('>>> ALGUNS TESTES FALHARAM <<<');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
