import { Capacitor } from '@capacitor/core';

const SERVER_URL_KEY = 'smart_tennis_server_url';
const DEFAULT_PORT = 3000;

/**
 * Retorna true se estiver sendo executado como aplicativo nativo Capacitor (Android).
 */
export function isNativeMobile() {
  return Capacitor.isNativePlatform();
}

/**
 * Valida se uma string é uma URL de servidor válida para o Motion Tennis.
 * Retorna { valid: boolean, error?: string, normalizedUrl?: string }
 */
export function validateServerUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'O endereço não pode estar vazio.' };
  }

  let cleaned = rawUrl.trim().replace(/\/+$/, '');
  if (!cleaned) {
    return { valid: false, error: 'O endereço não pode estar vazio.' };
  }

  // Se contém um esquema explícito que não seja http ou https, rejeita imediatamente
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned)) {
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      return { valid: false, error: 'Protocolo inválido. Utilize http:// ou https://.' };
    }
  } else {
    // Se não tem esquema, adiciona http://
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

    // Se estiver no Android nativo e apontar para localhost/127.0.0.1
    if (isNativeMobile() && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return {
        valid: false,
        error: "No celular, 'localhost' ou '127.0.0.1' aponta para o próprio telefone. Use o IP local do notebook (ex: http://192.168.0.27:3000)."
      };
    }

    // Se o hostname não possui ponto (.) e não é 'localhost', rejeita strings arbitrárias
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      return { valid: false, error: 'Endereço inválido. Informe um IP local válido (ex: http://192.168.0.27:3000).' };
    }

    // Se a porta foi especificada, valida range
    if (parsed.port) {
      const portNum = parseInt(parsed.port, 10);
      if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
        return { valid: false, error: 'Porta inválida (deve estar entre 1 e 65535).' };
      }
    } else if (!cleaned.includes(':') || (cleaned.split(':').length === 2 && cleaned.startsWith('http'))) {
      // Se não especificou porta em IP local e não é HTTPS padrão, sugere/aplica a porta 3000
      if (!parsed.hostname.includes('.com') && !parsed.hostname.includes('.org') && !parsed.hostname.includes('.net')) {
        parsed.port = DEFAULT_PORT.toString();
        cleaned = parsed.origin;
      }
    }

    return { valid: true, normalizedUrl: cleaned };
  } catch (err) {
    return { valid: false, error: 'Formato de endereço inválido. Exemplo: http://192.168.0.27:3000' };
  }
}

/**
 * Valida o conteúdo recebido de um QR Code.
 * Suporta URL direta (http://192.168.0.27:3000) e esquemas de deep link (motiontennis://connect?server=...).
 */
export function isValidQrCodeContent(qrText) {
  if (!qrText || typeof qrText !== 'string') {
    return { valid: false, error: 'QR Code vazio ou não reconhecido.' };
  }
  let trimmed = qrText.trim();

  // Não permitir senhas, tokens ou payloads JWT
  if (trimmed.includes('Bearer ') || trimmed.includes('"token"') || trimmed.includes('password=')) {
    return { valid: false, error: 'QR Code contém dados não permitidos. Escaneie apenas o QR Code de conexão do servidor.' };
  }

  // Suporte a deep link motiontennis://connect?server=... ou motiontennis://connect?url=...
  if (trimmed.startsWith('motiontennis://')) {
    try {
      const parsedUrl = new URL(trimmed);
      const serverParam = parsedUrl.searchParams.get('server') || parsedUrl.searchParams.get('url');
      if (serverParam) {
        trimmed = decodeURIComponent(serverParam);
      }
    } catch (e) {
      // continua com trimmed original
    }
  }

  return validateServerUrl(trimmed);
}

/**
 * Obtém a URL do servidor configurada pelo usuário no dispositivo móvel.
 * Em ambiente web (browser do notebook), o padrão é a rota relativa vazia ('' -> usa a mesma porta).
 */
export function getSavedServerUrl() {
  const saved = localStorage.getItem(SERVER_URL_KEY);
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }

  // Se estiver no browser local do notebook, usa relative host
  if (!isNativeMobile()) {
    return '';
  }

  return '';
}

/**
 * Salva a URL do servidor no armazenamento persistente do aplicativo.
 */
export function saveServerUrl(url) {
  const validation = validateServerUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const cleaned = validation.normalizedUrl;
  localStorage.setItem(SERVER_URL_KEY, cleaned);
  
  // Notifica componentes React sobre alteração de servidor
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_tennis_server_changed', { detail: cleaned }));
  }

  return cleaned;
}

/**
 * Limpa o servidor configurado
 */
export function clearSavedServerUrl() {
  localStorage.removeItem(SERVER_URL_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_tennis_server_changed', { detail: '' }));
  }
}

/**
 * Retorna a URL base completa para chamadas da API REST.
 * Ex: '' + '/api' = '/api' (no web)
 * Ex: 'http://192.168.0.27:3000' + '/api' = 'http://192.168.0.27:3000/api' (no celular)
 */
export function getApiBaseUrl() {
  const server = getSavedServerUrl();
  if (server) {
    return `${server}/api`;
  }
  // No Android nativo, se não houver servidor configurado, retorna vazio para evitar requisições
  // relativas ao localhost do WebView que resultam em fallback HTML do Capacitor
  if (isNativeMobile()) {
    return '';
  }
  return '/api';
}

/**
 * Retorna a URL base do WebSocket.
 */
export function getWebSocketBaseUrl() {
  const server = getSavedServerUrl();
  if (server) {
    const wsProto = server.startsWith('https') ? 'wss:' : 'ws:';
    const host = server.replace(/^https?:\/\//, '');
    return `${wsProto}//${host}/ws`;
  }
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  return 'ws://localhost:3000/ws';
}

/**
 * Testa a conexão HTTP com o servidor indicado chamando /api/status.
 * Retorna status, latência e informações do servidor ou lança erro explicativo.
 */
export async function testServerConnection(customUrl) {
  const targetServer = customUrl !== undefined ? (customUrl || '').trim().replace(/\/+$/, '') : getSavedServerUrl();
  
  if (!targetServer && isNativeMobile()) {
    return {
      success: false,
      error: 'Nenhum endereço de servidor configurado no aplicativo mobile.',
      serverUrl: ''
    };
  }

  const testUrl = targetServer ? `${targetServer}/api/status` : '/api/status';

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 segundos de timeout

  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // Validação estrita do Content-Type
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '');
      if (text.includes('<!doctype') || text.includes('<html') || text.trim().startsWith('<')) {
        return {
          success: false,
          error: 'O endereço respondeu com uma página web (HTML), não com a API do Motion Tennis. Verifique o IP e a porta (ex: http://192.168.0.27:3000).',
          serverUrl: targetServer
        };
      }
      return {
        success: false,
        error: `O servidor não respondeu em formato JSON (Content-Type: ${contentType || 'desconhecido'}).`,
        serverUrl: targetServer
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Servidor respondeu com código HTTP ${response.status}`,
        serverUrl: targetServer
      };
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    if (data.product !== 'MOTION TENNIS' && !data.server) {
      return {
        success: false,
        error: 'O endereço respondeu, mas não é um servidor Motion Tennis oficial.',
        serverUrl: targetServer
      };
    }

    return {
      success: true,
      latency,
      serverName: data.server?.name || data.product || 'Motion Tennis Server',
      serverUrl: targetServer || 'Servidor Local (Notebook)',
      data
    };
  } catch (err) {
    clearTimeout(timeoutId);
    let userFriendlyMessage = 'Não foi possível conectar ao notebook.';
    if (err.name === 'AbortError') {
      userFriendlyMessage = 'Tempo limite esgotado (timeout de 4s). Verifique se o notebook está na mesma rede Wi-Fi.';
    } else if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('network'))) {
      userFriendlyMessage = 'Falha de rede. Certifique-se de que o celular está no mesmo Wi-Fi do notebook e que a porta 3000 está liberada no firewall.';
    } else if (err.message) {
      userFriendlyMessage = err.message;
    }

    return {
      success: false,
      error: userFriendlyMessage,
      serverUrl: targetServer
    };
  }
}
