/**
 * ==============================================================================
 * MOTION TENNIS — MÓDULO CENTRALIZADO DE CONFIGURAÇÃO SUPABASE (ETAPA B)
 * ==============================================================================
 * Gerencia a leitura segura de variáveis de ambiente para a fundação cloud.
 *
 * DIRETRIZES ESTATUTÁRIAS DE SEGURANÇA:
 * 1. SUPABASE_SERVICE_ROLE_KEY é ESTRITAMENTE PROIBIDA no notebook da quadra,
 *    no aplicativo Android e no frontend. Se detectada, é sumariamente desconsiderada.
 * 2. O equipamento opera utilizando exclusivamente SUPABASE_URL e SUPABASE_ANON_KEY
 *    combinados com sua credencial de hardware individual (EQUIPMENT_ID e EQUIPMENT_API_KEY).
 * 3. Se nenhuma configuração for informada, o sistema permanece 100% OFFLINE-FIRST,
 *    garantindo que o SQLite e os jogos locais nunca dependam da nuvem para funcionar.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// Carregador leve e nativo de arquivos .env (zero dependências externas)
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      // Remove aspas simples ou duplas ao redor do valor
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Não sobrescreve variáveis já definidas explicitamente no ambiente
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

// Inicializa a leitura dos arquivos de ambiente na inicialização do módulo
(function initEnv() {
  const candidates = [
    path.resolve(__dirname, '..', '..', '.env.local'),
    path.resolve(__dirname, '..', '..', '.env'),
    path.resolve(__dirname, '..', '.env.local'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '..', '.env.local'),
    path.resolve(__dirname, '..', '..', '..', '.env')
  ];

  for (const p of candidates) {
    loadEnvFile(p);
  }

  // Defesa estatutária: detecta e neutraliza tentativa de injetar service_role no notebook
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('\x1b[33m[SEGURANÇA] AVISO: SUPABASE_SERVICE_ROLE_KEY detectada no ambiente local!\x1b[0m');
    console.warn('\x1b[33m[SEGURANÇA] Por regra arquitetural, a service_role é estritamente proibida no notebook e foi desconsiderada.\x1b[0m');
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
})();

// Regex de validação
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function isValidUuid(str) {
  return typeof str === 'string' && UUID_REGEX.test(str.trim());
}

function isValidJwt(str) {
  return typeof str === 'string' && JWT_REGEX.test(str.trim());
}

function decodeJwtPayload(jwtStr) {
  try {
    if (!jwtStr || typeof jwtStr !== 'string') return null;
    const parts = jwtStr.trim().split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * Valida chaves públicas do Supabase (anon keys).
 * Aceita:
 * 1. Formato JWT tradicional (3 partes) com payload não-administrativo (role != 'service_role').
 * 2. Chaves publicáveis modernas do Supabase (oficiais sb_publishable_..., sbp_... ou pk_...).
 * Rejeita categoricamente chaves secretas (sb_secret_..., sbs_..., sk_..., ou JWTs de service_role).
 */
function isValidAnonKey(key) {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();

  // Rejeita categoricamente chaves secretas/administrativas conhecidas
  if (trimmed.startsWith('sb_secret_') || trimmed.startsWith('sbs_') || trimmed.startsWith('sk_')) {
    return false;
  }

  // Chaves publicáveis do Supabase (oficiais sb_publishable_..., sbp_..., pk_...)
  if (/^(sb_publishable|sbp|pk)_[A-Za-z0-9_-]{10,}$/.test(trimmed)) {
    return true;
  }

  // Chave pública clássica no formato JWT de 3 partes
  if (JWT_REGEX.test(trimmed)) {
    const payload = decodeJwtPayload(trimmed);
    if (!payload) return false;
    if (payload.role === 'service_role' || payload.role === 'secret') {
      return false; // Rejeita se possuir role administrativa
    }
    return true;
  }

  return false;
}

function isValidSupabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:') return true;
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Retorna true se a nuvem Supabase está adequadamente configurada no notebook.
 */
function isSupabaseConfigured() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return isValidSupabaseUrl(url) && isValidAnonKey(anonKey);
}

/**
 * Retorna a configuração do Supabase para consumo interno do servidor.
 * NUNCA contém chaves administrativas.
 */
function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim().replace(/\/+$/, '') : null;
  const anonKey = process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.trim() : null;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET ? process.env.SUPABASE_JWT_SECRET.trim() : null;
  const configured = isSupabaseConfigured();

  return {
    configured,
    url: configured ? url : null,
    anonKey: configured ? anonKey : null,
    jwtSecret: jwtSecret || null, // Somente no backend local para validação offline de tokens
    audience: 'authenticated',
    issuer: configured ? `${url}/auth/v1` : null
  };
}

/**
 * Retorna a configuração pública segura para ser consumida pelo frontend/mobile app.
 * NUNCA expõe jwtSecret, chaves de equipamento ou credenciais privadas.
 */
function getPublicClientConfig() {
  const config = getSupabaseConfig();
  return {
    configured: config.configured,
    supabaseUrl: config.url,
    anonKey: config.anonKey,
    audience: config.audience
  };
}

/**
 * Retorna os metadados do equipamento local configurado na quadra.
 */
function getEquipmentConfig() {
  const eqId = process.env.EQUIPMENT_ID ? process.env.EQUIPMENT_ID.trim() : null;
  const rawApiKey = process.env.EQUIPMENT_API_KEY ? process.env.EQUIPMENT_API_KEY.trim() : null;
  const hardwareCode = process.env.EQUIPMENT_HARDWARE_CODE ? process.env.EQUIPMENT_HARDWARE_CODE.trim() : 'ST-001';
  const location = process.env.EQUIPMENT_LOCATION ? process.env.EQUIPMENT_LOCATION.trim() : 'Quadra Principal';
  const wallPreset = process.env.EQUIPMENT_WALL_PRESET ? process.env.EQUIPMENT_WALL_PRESET.trim() : '3x2';

  return {
    equipmentId: isValidUuid(eqId) ? eqId : null,
    hardwareCode,
    location,
    wallPreset,
    hasApiKey: Boolean(rawApiKey && rawApiKey.length >= 8),
    apiKey: rawApiKey || null
  };
}

module.exports = {
  loadEnvFile,
  isValidUuid,
  isValidJwt,
  isValidAnonKey,
  decodeJwtPayload,
  isValidSupabaseUrl,
  isSupabaseConfigured,
  getSupabaseConfig,
  getPublicClientConfig,
  getEquipmentConfig
};
