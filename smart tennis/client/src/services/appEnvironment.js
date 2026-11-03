/**
 * appEnvironment.js
 * 
 * Gerencia a distinção arquitetural obrigatória entre:
 * 1. MODO DEMONSTRAÇÃO WEB (Vercel / Produção Pública)
 * 2. MODO ANDROID CLOUD (Capacitor APK / Dispositivo Móvel)
 * 3. MODO EQUIPAMENTO (Notebook físico da quadra / Local com SQLite)
 * 
 * DIRETRIZES DE SEGURANÇA:
 * - Em MODO DEMONSTRAÇÃO WEB e ANDROID CLOUD, qualquer persistência local em SQLite,
 *   Outbox de equipamento e chamadas a localhost:3000 são estritamente desabilitadas.
 * - O app Android nativo NUNCA cai automaticamente em modo 'equipment'.
 * - Configuração de build explícita (VITE_APP_MODE) com fallback seguro em runtime.
 */

export const APP_MODES = {
  WEB_DEMO: 'web_demo',
  EQUIPMENT: 'equipment',
  ANDROID_CLOUD: 'android_cloud'
};

/**
 * Retorna o modo operacional atual da aplicação.
 */
export function getAppMode() {
  // 1. Configuração explícita de build (VITE_APP_MODE)
  const envMode = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_MODE) || '';
  if (envMode === APP_MODES.WEB_DEMO) return APP_MODES.WEB_DEMO;
  if (envMode === APP_MODES.ANDROID_CLOUD) return APP_MODES.ANDROID_CLOUD;
  if (envMode === APP_MODES.EQUIPMENT) return APP_MODES.EQUIPMENT;

  // 2. Detecção automática de ambiente nativo Capacitor (Android)
  if (typeof window !== 'undefined') {
    if (window.Capacitor?.isNativePlatform?.() || window.Capacitor?.getPlatform?.() === 'android') {
      return APP_MODES.ANDROID_CLOUD;
    }
  }

  // 3. Detecção automática de ambiente Vercel (process.env.VERCEL ou hostname *.vercel.app)
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '';
    if (host.endsWith('.vercel.app')) {
      return APP_MODES.WEB_DEMO;
    }
  }

  // 4. Padrão para desenvolvimento local no equipamento físico
  return APP_MODES.EQUIPMENT;
}

/**
 * Retorna true se a aplicação estiver executando em modo demonstração web pública (Vercel).
 */
export function isWebDemoMode() {
  return getAppMode() === APP_MODES.WEB_DEMO;
}

/**
 * Retorna true se a aplicação estiver executando no aplicativo Android nativo conectado à nuvem.
 */
export function isAndroidCloudMode() {
  return getAppMode() === APP_MODES.ANDROID_CLOUD;
}

/**
 * Retorna true se a aplicação estiver executando no notebook físico da quadra (com SQLite).
 */
export function isEquipmentMode() {
  return getAppMode() === APP_MODES.EQUIPMENT;
}

/**
 * Retorna true se a aplicação estiver em modo exclusivamente em nuvem (Vercel ou Android).
 */
export function isCloudOnlyMode() {
  const mode = getAppMode();
  return mode === APP_MODES.WEB_DEMO || mode === APP_MODES.ANDROID_CLOUD;
}
