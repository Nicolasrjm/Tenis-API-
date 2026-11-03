/**
 * ==============================================================================
 * MOTION TENNIS — SERVIÇO DE LEITURA SEGURA DA NUVEM SUPABASE (FASE D2)
 * ==============================================================================
 * Camada de consulta direta ao Supabase PostgREST para dispositivos móveis e web.
 *
 * DIRETRIZES DE SEGURANÇA E ARQUITETURA:
 * 1. ZERO SERVICE_ROLE: Utiliza estritamente chaves públicas (anonKey / publishable key)
 *    e o access_token do atleta autenticado.
 * 2. RLS AUTORITATIVO: As políticas RLS do PostgreSQL filtram automaticamente por
 *    auth.uid() = user_id. NUNCA confia em IDs enviados pelo cliente.
 * 3. INDEPENDÊNCIA DE BACKEND: Não depende de notebook ligado, Express ou SQLite local.
 * 4. PAGINAÇÃO E RESILIÊNCIA: Suporta paginação, limites, ordenação temporal e
 *    estados de erro/offline com feedback limpo.
 * ==============================================================================
 */

import { getCloudConfig } from './cloudAuthService.js';

/**
 * Monta cabeçalhos autenticados para a REST API do Supabase (PostgREST).
 */
function buildPostgrestHeaders({ anonKey, accessToken, preferCount = false }) {
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  if (preferCount) {
    headers['Prefer'] = 'count=exact';
  }
  return headers;
}

/**
 * Consulta o perfil oficial do atleta no Supabase (player_profiles).
 */
export async function getCloudProfile({ supabaseUrl, anonKey, accessToken, fetchFn = globalThis.fetch }) {
  if (!accessToken) throw new Error('Token de acesso do atleta não fornecido.');

  let url = supabaseUrl;
  let key = anonKey;
  if (!url || !key) {
    const config = await getCloudConfig();
    url = config.supabaseUrl;
    key = config.anonKey;
  }
  if (!url || !key) throw new Error('Configuração da nuvem Supabase não encontrada.');

  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/player_profiles?select=*`;

  const res = await fetchFn(endpoint, {
    method: 'GET',
    headers: buildPostgrestHeaders({ anonKey: key, accessToken })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.message || 'Falha ao carregar perfil esportivo da nuvem.');
    err.status = res.status;
    throw err;
  }

  const profiles = await res.json();
  return Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;
}

/**
 * Consulta os 6 atributos esportivos do atleta no Supabase (player_attributes).
 */
export async function getCloudAttributes({ supabaseUrl, anonKey, accessToken, fetchFn = globalThis.fetch }) {
  if (!accessToken) throw new Error('Token de acesso do atleta não fornecido.');

  let url = supabaseUrl;
  let key = anonKey;
  if (!url || !key) {
    const config = await getCloudConfig();
    url = config.supabaseUrl;
    key = config.anonKey;
  }
  if (!url || !key) throw new Error('Configuração da nuvem Supabase não encontrada.');

  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/player_attributes?select=*&order=key.asc`;

  const res = await fetchFn(endpoint, {
    method: 'GET',
    headers: buildPostgrestHeaders({ anonKey: key, accessToken })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.message || 'Falha ao carregar atributos esportivos da nuvem.');
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Consulta as sessões sincronizadas do atleta no Supabase (synced_sessions) com paginação.
 */
export async function getCloudSessions({
  supabaseUrl,
  anonKey,
  accessToken,
  limit = 20,
  offset = 0,
  mode = null,
  fetchFn = globalThis.fetch
}) {
  if (!accessToken) throw new Error('Token de acesso do atleta não fornecido.');

  let url = supabaseUrl;
  let key = anonKey;
  if (!url || !key) {
    const config = await getCloudConfig();
    url = config.supabaseUrl;
    key = config.anonKey;
  }
  if (!url || !key) throw new Error('Configuração da nuvem Supabase não encontrada.');

  let endpoint = `${url.replace(/\/+$/, '')}/rest/v1/synced_sessions?select=*&order=started_at.desc&limit=${limit}&offset=${offset}`;
  if (mode && mode !== 'all') {
    endpoint += `&mode=eq.${encodeURIComponent(mode)}`;
  }

  const res = await fetchFn(endpoint, {
    method: 'GET',
    headers: buildPostgrestHeaders({ anonKey: key, accessToken, preferCount: true })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.message || 'Falha ao carregar histórico de partidas da nuvem.');
    err.status = res.status;
    throw err;
  }

  // Extrai total de registros do header content-range (ex: "0-9/42")
  let totalCount = null;
  const contentRange = res.headers?.get ? res.headers.get('content-range') : (res.headers && res.headers['content-range']);
  if (contentRange && contentRange.includes('/')) {
    const totalPart = contentRange.split('/')[1];
    if (totalPart && totalPart !== '*') {
      totalCount = parseInt(totalPart, 10);
    }
  }

  const sessions = await res.json();
  return {
    sessions: Array.isArray(sessions) ? sessions : [],
    totalCount: totalCount !== null ? totalCount : (Array.isArray(sessions) ? sessions.length : 0),
    hasMore: totalCount !== null ? (offset + limit) < totalCount : false
  };
}

/**
 * Consulta os impactos detalhados de uma sessão específica (synced_shots).
 */
export async function getCloudSessionShots({ supabaseUrl, anonKey, accessToken, sessionId, fetchFn = globalThis.fetch }) {
  if (!accessToken) throw new Error('Token de acesso do atleta não fornecido.');
  if (!sessionId) throw new Error('ID da sessão não informado.');

  let url = supabaseUrl;
  let key = anonKey;
  if (!url || !key) {
    const config = await getCloudConfig();
    url = config.supabaseUrl;
    key = config.anonKey;
  }
  if (!url || !key) throw new Error('Configuração da nuvem Supabase não encontrada.');

  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/synced_shots?session_id=eq.${encodeURIComponent(sessionId)}&select=*&order=shot_time_offset_ms.asc`;

  const res = await fetchFn(endpoint, {
    method: 'GET',
    headers: buildPostgrestHeaders({ anonKey: key, accessToken })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.message || 'Falha ao carregar impactos da sessão.');
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Consulta as conquistas desbloqueadas pelo atleta (player_achievements).
 */
export async function getCloudAchievements({ supabaseUrl, anonKey, accessToken, fetchFn = globalThis.fetch }) {
  if (!accessToken) throw new Error('Token de acesso do atleta não fornecido.');

  let url = supabaseUrl;
  let key = anonKey;
  if (!url || !key) {
    const config = await getCloudConfig();
    url = config.supabaseUrl;
    key = config.anonKey;
  }
  if (!url || !key) throw new Error('Configuração da nuvem Supabase não encontrada.');

  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/player_achievements?select=*&order=unlocked_at.desc`;

  const res = await fetchFn(endpoint, {
    method: 'GET',
    headers: buildPostgrestHeaders({ anonKey: key, accessToken })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.message || 'Falha ao carregar conquistas da nuvem.');
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Carrega a visão agregada completa do atleta (Perfil, Sessões Recentes, Atributos e Conquistas).
 * Utilizado para alimentar a tela Inicial e Evolução do site mobile em uma única chamada paralela.
 */
export async function getCloudAthleteOverview({ supabaseUrl, anonKey, accessToken, fetchFn = globalThis.fetch }) {
  const [profile, attributes, sessionsResult, achievements] = await Promise.all([
    getCloudProfile({ supabaseUrl, anonKey, accessToken, fetchFn }).catch(() => null),
    getCloudAttributes({ supabaseUrl, anonKey, accessToken, fetchFn }).catch(() => []),
    getCloudSessions({ supabaseUrl, anonKey, accessToken, limit: 10, offset: 0, fetchFn }).catch(() => ({ sessions: [], totalCount: 0 })),
    getCloudAchievements({ supabaseUrl, anonKey, accessToken, fetchFn }).catch(() => [])
  ]);

  const sessions = sessionsResult?.sessions || [];
  const latestSession = sessions.length > 0 ? sessions[0] : null;

  // Calcula melhor pontuação das sessões recuperadas
  let bestScore = 0;
  for (const s of sessions) {
    if (s.total_score && s.total_score > bestScore) {
      bestScore = s.total_score;
    }
  }

  // Agrega evolução cronológica de precisão e pontuação
  const evolutionHistory = [...sessions]
    .reverse()
    .map((s) => ({
      id: s.id,
      date: s.started_at,
      mode: s.mode,
      score: s.total_score,
      accuracy: Number(s.accuracy) || 0,
      shots: s.shots_count,
      hits: s.hits_count,
      xp: s.xp_granted
    }));

  return {
    profile: profile || {
      display_name: 'Atleta',
      avatar: '🎾',
      level: 1,
      xp: 0,
      xp_next: 250,
      title: 'Iniciante',
      overall_accuracy: 0,
      total_matches: 0,
      total_shots: 0,
      total_hits: 0,
      best_streak: 0
    },
    attributes: Array.isArray(attributes) ? attributes : [],
    latestSession,
    recentSessions: sessions,
    totalSessionsCount: sessionsResult?.totalCount || sessions.length,
    achievements: Array.isArray(achievements) ? achievements : [],
    bestScore,
    evolutionHistory
  };
}

export const cloudDataService = {
  getCloudProfile,
  getCloudAttributes,
  getCloudSessions,
  getCloudSessionShots,
  getCloudAchievements,
  getCloudAthleteOverview
};
