/**
 * appEnvironment.js
 * 
 * Gerencia a distinção arquitetural obrigatória entre:
 * 1. MODO DEMONSTRAÇÃO WEB (Vercel / Produção Pública)
 * 2. MODO EQUIPAMENTO (Notebook físico da quadra / Local)
 * 
 * DIRETRIZES DE SEGURANÇA:
 * - Em MODO DEMONSTRAÇÃO WEB, qualquer persistência (SQLite, Outbox, Supabase write,
 *   localStorage de partidas, Edge Functions) é estritamente desabilitada.
 * - Configuração de build explícita (VITE_APP_MODE) com fallback seguro em runtime.
 */

export const APP_MODES = {
  WEB_DEMO: 'web_demo',
  EQUIPMENT: 'equipment'
};

/**
 * Retorna o modo operacional atual da aplicação.
 */
export function getAppMode() {
  // 1. Configuração explícita de build (VITE_APP_MODE)
  const envMode = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_MODE) || '';
  if (envMode === APP_MODES.WEB_DEMO) return APP_MODES.WEB_DEMO;
  if (envMode === APP_MODES.EQUIPMENT) return APP_MODES.EQUIPMENT;

  // 2. Detecção automática de ambiente Vercel (process.env.VERCEL ou hostname *.vercel.app)
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '';
    if (host.endsWith('.vercel.app')) {
      return APP_MODES.WEB_DEMO;
    }
  }

  // 3. Padrão para desenvolvimento local no equipamento
  return APP_MODES.EQUIPMENT;
}

/**
 * Retorna true se a aplicação estiver executando em modo demonstração web pública (Vercel).
 */
export function isWebDemoMode() {
  return getAppMode() === APP_MODES.WEB_DEMO;
}

/**
 * Retorna true se a aplicação estiver executando no notebook físico da quadra.
 */
export function isEquipmentMode() {
  return getAppMode() === APP_MODES.EQUIPMENT;
}
