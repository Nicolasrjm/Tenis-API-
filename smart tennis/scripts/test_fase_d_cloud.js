/**
 * ==============================================================================
 * MOTION TENNIS — TESTES AUTOMATIZADOS FASE D: PLATAFORMA MOBILE WEB CLOUD
 * ==============================================================================
 * Valida de forma autônoma, modular e não-destrutiva:
 * 1. Consultas seguras PostgREST via cloudDataService (profile, attributes, sessions, shots, achievements).
 * 2. Paginação de histórico com cabeçalho 'Prefer: count=exact' e 'content-range'.
 * 3. Agregação resiliente em getCloudAthleteOverview (tolerância a falhas parciais).
 * 4. Isolamento estrito RLS multi-atleta (JWT auth.uid() = user_id; sem vazamento de dados).
 * 5. Rejeição de chaves administrativas (service_role) e uso exclusivo de anon/publishable key.
 * 6. Login cloud autônomo sem dependência do notebook local (modo isCloudOnly).
 * 7. Ciclo de vida da sessão cloud (armazenamento, restauração, expiração e logout).
 * ==============================================================================
 */

const crypto = require('crypto');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✔ PASS [${testName}]`);
    passedTests++;
  } else {
    console.error(`  ✖ FAIL [${testName}] ${details}`);
    failedTests++;
  }
}

// ==============================================================================
// 1. MOCK DE LOCALSTORAGE PARA SIMULAÇÃO DE NAVEGADOR
// ==============================================================================
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockStorage = new MockLocalStorage();

// ==============================================================================
// 2. FUNÇÕES ESPELHADAS DO CLIENTE (cloudDataService & cloudAuthService)
// ==============================================================================

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

async function getCloudProfile({ supabaseUrl, anonKey, accessToken, fetchFn }) {
  if (!accessToken) throw new Error('Token de acesso do atleta não fornecido.');
  if (!supabaseUrl || !anonKey) throw new Error('Configuração da nuvem Supabase não encontrada.');

  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/player_profiles?select=*`;
  const res = await fetchFn(endpoint, {
    method: 'GET',
    headers: buildPostgrestHeaders({ anonKey, accessToken })
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

async function getCloudAttributes({ supabaseUrl, anonKey, accessToken, fetchFn }) {
  if (!accessToken) throw new Error('Token de acesso do atleta não fornecido.');
  if (!supabaseUrl || !anonKey) throw new Error('Configuração da nuvem Supabase não encontrada.');

  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/player_attributes?select=*&order=key.asc`;
  const res = await fetchFn(endpoint, {
    method: 'GET',
    headers: buildPostgrestHeaders({ anonKey, accessToken })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.message || 'Falha ao carregar atributos esportivos da nuvem.');
    err.status = res.status;
    throw err;
  }

  return res.json();
}

async function getCloudSessions({
  supabaseUrl,
  anonKey,
  accessToken,
  limit = 20,
  offset = 0,
  mode = null,
  fetchFn
}) {
  if (!accessToken) throw new Error('Token de acesso do atleta não fornecido.');
  if (!supabaseUrl || !anonKey) throw new Error('Configuração da nuvem Supabase não encontrada.');

  let endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/synced_sessions?select=*&order=started_at.desc&limit=${limit}&offset=${offset}`;
  if (mode && mode !== 'all') {
    endpoint += `&mode=eq.${encodeURIComponent(mode)}`;
  }

  const res = await fetchFn(endpoint, {
    method: 'GET',
    headers: buildPostgrestHeaders({ anonKey, accessToken, preferCount: true })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.message || 'Falha ao carregar histórico de partidas da nuvem.');
    err.status = res.status;
    throw err;
  }

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

async function getCloudSessionShots({ supabaseUrl, anonKey, accessToken, sessionId, fetchFn }) {
  if (!accessToken) throw new Error('Token de acesso do atleta não fornecido.');
  if (!sessionId) throw new Error('ID da sessão não informado.');
  if (!supabaseUrl || !anonKey) throw new Error('Configuração da nuvem Supabase não encontrada.');

  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/synced_shots?session_id=eq.${encodeURIComponent(sessionId)}&select=*&order=shot_time_offset_ms.asc`;
  const res = await fetchFn(endpoint, {
    method: 'GET',
    headers: buildPostgrestHeaders({ anonKey, accessToken })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.message || 'Falha ao carregar impactos da sessão.');
    err.status = res.status;
    throw err;
  }

  return res.json();
}

async function getCloudAchievements({ supabaseUrl, anonKey, accessToken, fetchFn }) {
  if (!accessToken) throw new Error('Token de acesso do atleta não fornecido.');
  if (!supabaseUrl || !anonKey) throw new Error('Configuração da nuvem Supabase não encontrada.');

  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/player_achievements?select=*&order=unlocked_at.desc`;
  const res = await fetchFn(endpoint, {
    method: 'GET',
    headers: buildPostgrestHeaders({ anonKey, accessToken })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.message || 'Falha ao carregar conquistas da nuvem.');
    err.status = res.status;
    throw err;
  }

  return res.json();
}

async function getCloudAthleteOverview({ supabaseUrl, anonKey, accessToken, fetchFn }) {
  const [profile, attributes, sessionsResult, achievements] = await Promise.all([
    getCloudProfile({ supabaseUrl, anonKey, accessToken, fetchFn }).catch(() => null),
    getCloudAttributes({ supabaseUrl, anonKey, accessToken, fetchFn }).catch(() => []),
    getCloudSessions({ supabaseUrl, anonKey, accessToken, limit: 10, offset: 0, fetchFn }).catch(() => ({ sessions: [], totalCount: 0 })),
    getCloudAchievements({ supabaseUrl, anonKey, accessToken, fetchFn }).catch(() => [])
  ]);

  const sessions = sessionsResult?.sessions || [];
  const latestSession = sessions.length > 0 ? sessions[0] : null;

  let bestScore = 0;
  for (const s of sessions) {
    if (s.total_score && s.total_score > bestScore) {
      bestScore = s.total_score;
    }
  }

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

// Helpers de Sessão Cloud
const CLOUD_SESSION_KEY = 'mt_cloud_session';

function saveCloudSession(session, storage = mockStorage) {
  if (!session?.access_token) return;
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token || null,
    expires_at: session.expires_at || (Date.now() + (session.expires_in || 3600) * 1000),
    user: session.user || null
  };
  storage.setItem(CLOUD_SESSION_KEY, JSON.stringify(payload));
}

function getStoredCloudSession(storage = mockStorage) {
  try {
    const raw = storage.getItem(CLOUD_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.access_token) return null;
    if (session.expires_at && session.expires_at < Date.now()) {
      return null; // Expirado
    }
    return session;
  } catch {
    return null;
  }
}

function clearCloudSession(storage = mockStorage) {
  storage.removeItem(CLOUD_SESSION_KEY);
}

// Simulação de login autônomo do atleta remoto
async function loginWithCloudAccountStandalone({ email, password, supabaseUrl, anonKey, fetchFn, mockLocalApiFail = true }) {
  // 1. Autentica direto no Supabase Auth
  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`;
  const authRes = await fetchFn(endpoint, {
    method: 'POST',
    headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!authRes.ok) {
    const errData = await authRes.json();
    throw new Error(errData.error_description || errData.msg || 'Credenciais inválidas');
  }

  const authData = await authRes.json();

  // Salva no storage
  saveCloudSession(authData, mockStorage);

  if (mockLocalApiFail) {
    // Notebook desligado ou atleta remoto no celular com internet:
    // Retorna autenticação direta pelo Supabase sem depender do SQLite!
    return {
      success: true,
      token: authData.access_token,
      authType: 'supabase_cloud',
      isCloudOnly: true,
      user: {
        id: authData.user?.id,
        cloudUserId: authData.user?.id,
        name: authData.user?.user_metadata?.name || authData.user?.email?.split('@')[0],
        email: authData.user?.email,
        role: 'player',
        avatar: '🎾',
        status: 'active',
        isCloudOnly: true
      },
      cloudSession: authData
    };
  }

  return { success: true, isCloudOnly: false, cloudSession: authData };
}

// ==============================================================================
// 3. EXECUÇÃO DA SUÍTE DE TESTES
// ==============================================================================
async function runFaseDTests() {
  console.log('==============================================================================');
  console.log('INICIANDO TESTES FASE D — PLATAFORMA MOBILE WEB COM PROGRESSO CLOUD');
  console.log('==============================================================================\n');

  const mockSupabaseUrl = 'https://motiontennis-mock.supabase.co';
  const mockAnonKey = 'sb_publishable_test_fase_d_key';
  const mockServiceRoleKey = 'sb_secret_super_admin_dont_leak';

  const athleteNicolas = {
    id: '0ef1cdd9-085b-4256-9b2f-94711da0e501',
    email: 'nicolas@motiontennis.com',
    token: 'jwt_token_nicolas_athlete_valid'
  };

  const athleteBeatriz = {
    id: 'b1111111-2222-3333-4444-555555555555',
    email: 'beatriz@motiontennis.com',
    token: 'jwt_token_beatriz_athlete_valid'
  };

  // Banco de dados em memória simulando Supabase PostgreSQL com RLS
  const cloudDb = {
    player_profiles: [
      {
        user_id: athleteNicolas.id,
        display_name: 'Nicolas',
        avatar: '🎾',
        level: 10,
        xp: 25,
        xp_next: 2500,
        title: 'Profissional',
        overall_accuracy: 88.5,
        total_matches: 1,
        total_shots: 26,
        total_hits: 23,
        best_streak: 12
      },
      {
        user_id: athleteBeatriz.id,
        display_name: 'Beatriz',
        avatar: '⚡',
        level: 2,
        xp: 350,
        xp_next: 500,
        title: 'Intermediário',
        overall_accuracy: 72.0,
        total_matches: 3,
        total_shots: 60,
        total_hits: 43,
        best_streak: 6
      }
    ],
    player_attributes: [
      { user_id: athleteNicolas.id, key: 'consistency', name: 'Consistência', value: 85, level: 8 },
      { user_id: athleteNicolas.id, key: 'endurance', name: 'Resistência', value: 80, level: 7 },
      { user_id: athleteNicolas.id, key: 'power', name: 'Potência', value: 92, level: 9 },
      { user_id: athleteNicolas.id, key: 'precision', name: 'Precisão', value: 89, level: 8 },
      { user_id: athleteNicolas.id, key: 'reaction', name: 'Reação', value: 84, level: 8 },
      { user_id: athleteNicolas.id, key: 'technique', name: 'Técnica', value: 90, level: 9 }
    ],
    synced_sessions: [
      {
        id: 'sess_real_homologada_001',
        user_id: athleteNicolas.id,
        hardware_code: 'MT-HOMOLOG-001',
        mode: 'free_play',
        total_score: 1785,
        xp_granted: 903,
        accuracy: 88.46,
        shots_count: 26,
        hits_count: 23,
        duration_seconds: 180,
        started_at: '2026-11-01T20:00:00Z',
        ended_at: '2026-11-01T20:03:00Z'
      }
    ],
    synced_shots: [
      { id: 'shot_1', session_id: 'sess_real_homologada_001', shot_time_offset_ms: 1200, score: 50, zone_hit: 'A1', x: 1.2, y: 0.8 },
      { id: 'shot_2', session_id: 'sess_real_homologada_001', shot_time_offset_ms: 3400, score: 100, zone_hit: 'B2', x: 1.5, y: 1.1 }
    ],
    player_achievements: [
      { id: 'ach_1', user_id: athleteNicolas.id, achievement_code: 'FIRST_MATCH', title: 'Primeira Partida', unlocked_at: '2026-11-01T20:03:00Z' },
      { id: 'ach_2', user_id: athleteNicolas.id, achievement_code: 'SNIPER_ACCURACY', title: 'Precisão Cirúrgica', unlocked_at: '2026-11-01T20:03:00Z' }
    ]
  };

  // Simulação de Fetch inteligente com RLS autoritativo
  const mockFetch = async (urlStr, options = {}) => {
    const url = new URL(urlStr);
    const headers = options.headers || {};
    const authHeader = headers['Authorization'] || '';
    const apikey = headers['apikey'] || '';

    // Valida chave da API (rejeita service_role)
    if (apikey === mockServiceRoleKey) {
      return {
        ok: false,
        status: 403,
        json: async () => ({ message: 'Acesso negado: chave service_role proibida no frontend.' })
      };
    }

    // Extrai identidade a partir do Bearer Token (Simulação RLS)
    let authenticatedUserId = null;
    if (authHeader.includes(athleteNicolas.token)) {
      authenticatedUserId = athleteNicolas.id;
    } else if (authHeader.includes(athleteBeatriz.token)) {
      authenticatedUserId = athleteBeatriz.id;
    }

    // Simulação do endpoint de autenticação Supabase Auth
    if (url.pathname.includes('/auth/v1/token')) {
      const body = JSON.parse(options.body || '{}');
      if (body.email === athleteNicolas.email && body.password === 'senhaSegura123') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: athleteNicolas.token,
            refresh_token: 'refresh_token_nicolas_123',
            expires_in: 3600,
            user: {
              id: athleteNicolas.id,
              email: athleteNicolas.email,
              user_metadata: { name: 'Nicolas' }
            }
          })
        };
      }
      return {
        ok: false,
        status: 400,
        json: async () => ({ error_description: 'E-mail ou senha incorretos' })
      };
    }

    if (!authenticatedUserId) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ message: 'JWT ausente ou inválido.' })
      };
    }

    // Rota: /rest/v1/player_profiles
    if (url.pathname.includes('/rest/v1/player_profiles')) {
      // RLS Policy: auth.uid() = user_id
      const matches = cloudDb.player_profiles.filter(p => p.user_id === authenticatedUserId);
      return {
        ok: true,
        status: 200,
        json: async () => matches
      };
    }

    // Rota: /rest/v1/player_attributes
    if (url.pathname.includes('/rest/v1/player_attributes')) {
      // RLS Policy: auth.uid() = user_id
      const matches = cloudDb.player_attributes.filter(a => a.user_id === authenticatedUserId);
      return {
        ok: true,
        status: 200,
        json: async () => matches
      };
    }

    // Rota: /rest/v1/synced_sessions
    if (url.pathname.includes('/rest/v1/synced_sessions')) {
      // RLS Policy: auth.uid() = user_id
      let matches = cloudDb.synced_sessions.filter(s => s.user_id === authenticatedUserId);
      const modeParam = url.searchParams.get('mode');
      if (modeParam && modeParam.startsWith('eq.')) {
        const mode = modeParam.replace('eq.', '');
        matches = matches.filter(s => s.mode === mode);
      }
      const totalCount = matches.length;
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const paginated = matches.slice(offset, offset + limit);

      const resHeaders = {
        'content-range': `${offset}-${Math.min(offset + limit - 1, totalCount - 1)}/${totalCount}`,
        get: (h) => (h.toLowerCase() === 'content-range' ? `${offset}-${Math.min(offset + limit - 1, totalCount - 1)}/${totalCount}` : null)
      };

      return {
        ok: true,
        status: 200,
        headers: resHeaders,
        json: async () => paginated
      };
    }

    // Rota: /rest/v1/synced_shots
    if (url.pathname.includes('/rest/v1/synced_shots')) {
      const sessParam = url.searchParams.get('session_id');
      const sessId = sessParam ? sessParam.replace('eq.', '') : null;
      // RLS Policy: subquery em synced_sessions onde user_id = auth.uid()
      const allowedSession = cloudDb.synced_sessions.find(s => s.id === sessId && s.user_id === authenticatedUserId);
      if (!allowedSession) {
        return {
          ok: true,
          status: 200,
          json: async () => [] // RLS retorna vazio para sessão de outro usuário ou inexistente
        };
      }
      const shots = cloudDb.synced_shots.filter(shot => shot.session_id === sessId);
      return {
        ok: true,
        status: 200,
        json: async () => shots
      };
    }

    // Rota: /rest/v1/player_achievements
    if (url.pathname.includes('/rest/v1/player_achievements')) {
      const matches = cloudDb.player_achievements.filter(ach => ach.user_id === authenticatedUserId);
      return {
        ok: true,
        status: 200,
        json: async () => matches
      };
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not found' })
    };
  };

  // ----------------------------------------------------------------------------
  // BLOCO 1: Consultas Seguras PostgREST (cloudDataService)
  // ----------------------------------------------------------------------------
  console.log('--- TESTES BLOCO 1: Consultas PostgREST com Token Oficial ---');

  const profile = await getCloudProfile({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteNicolas.token,
    fetchFn: mockFetch
  });
  assert(profile !== null, 'D1.1 - Perfil cloud de Nicolas recuperado');
  assert(profile.display_name === 'Nicolas', 'D1.2 - Nome correto no perfil', profile.display_name);
  assert(profile.level === 10 && profile.xp === 25, 'D1.3 - Nível 10 e XP 25 confirmados', `LV=${profile?.level}, XP=${profile?.xp}`);
  assert(profile.total_matches === 1 && profile.total_shots === 26, 'D1.4 - Totais de partidas e impactos preservados');

  const attrs = await getCloudAttributes({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteNicolas.token,
    fetchFn: mockFetch
  });
  assert(Array.isArray(attrs) && attrs.length === 6, 'D1.5 - Retorna exatamente os 6 atributos esportivos', `Count=${attrs?.length}`);
  assert(attrs.some(a => a.key === 'power' && a.value === 92), 'D1.6 - Atributo Potência com valor 92');

  const sessionsRes = await getCloudSessions({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteNicolas.token,
    limit: 10,
    offset: 0,
    fetchFn: mockFetch
  });
  assert(sessionsRes.sessions.length === 1, 'D1.7 - Sessão homologada real retornada');
  assert(sessionsRes.totalCount === 1, 'D1.8 - totalCount derivado do cabeçalho content-range');
  assert(sessionsRes.sessions[0].total_score === 1785, 'D1.9 - Pontuação da sessão 1785 confirmada');
  assert(sessionsRes.sessions[0].xp_granted === 903, 'D1.10 - XP concedido 903 confirmado');

  const shots = await getCloudSessionShots({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteNicolas.token,
    sessionId: 'sess_real_homologada_001',
    fetchFn: mockFetch
  });
  assert(shots.length === 2, 'D1.11 - Retorna impactos detalhados da sessão');
  assert(shots[0].zone_hit === 'A1' && shots[1].score === 100, 'D1.12 - Telemetria e zonas de impacto preservadas');

  const achs = await getCloudAchievements({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteNicolas.token,
    fetchFn: mockFetch
  });
  assert(achs.length === 2, 'D1.13 - Conquistas desbloqueadas retornadas');
  assert(achs.some(a => a.achievement_code === 'FIRST_MATCH'), 'D1.14 - Conquista FIRST_MATCH presente');

  // ----------------------------------------------------------------------------
  // BLOCO 2: Paginação e Filtros
  // ----------------------------------------------------------------------------
  console.log('\n--- TESTES BLOCO 2: Paginação e Filtros de Sessões ---');

  const emptyFilterRes = await getCloudSessions({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteNicolas.token,
    mode: 'precision_target', // Nicolas só jogou free_play
    fetchFn: mockFetch
  });
  assert(emptyFilterRes.sessions.length === 0, 'D2.1 - Filtro por modo sem partidas retorna lista vazia');
  assert(emptyFilterRes.totalCount === 0, 'D2.2 - totalCount 0 quando não há correspondência');
  assert(!emptyFilterRes.hasMore, 'D2.3 - hasMore false quando não há registros');

  const pagedRes = await getCloudSessions({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteNicolas.token,
    limit: 1,
    offset: 0,
    fetchFn: mockFetch
  });
  assert(pagedRes.sessions.length === 1, 'D2.4 - Limite de página respeitado');
  assert(pagedRes.hasMore === false, 'D2.5 - hasMore false quando offset+limit >= totalCount');

  // ----------------------------------------------------------------------------
  // BLOCO 3: Agregação Resiliente (getCloudAthleteOverview)
  // ----------------------------------------------------------------------------
  console.log('\n--- TESTES BLOCO 3: Visão Agregada do Atleta (Overview) ---');

  const overview = await getCloudAthleteOverview({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteNicolas.token,
    fetchFn: mockFetch
  });

  assert(overview.profile.display_name === 'Nicolas', 'D3.1 - Perfil presente no overview');
  assert(overview.attributes.length === 6, 'D3.2 - Atributos presentes no overview');
  assert(overview.latestSession !== null, 'D3.3 - Última sessão identificada');
  assert(overview.bestScore === 1785, 'D3.4 - Melhor pontuação calculada corretamente', `bestScore=${overview.bestScore}`);
  assert(overview.evolutionHistory.length === 1, 'D3.5 - Histórico de evolução cronológica montado');
  assert(overview.evolutionHistory[0].accuracy === 88.46, 'D3.6 - Precisão formatada numericamente');

  // Tolerância a falhas parciais (ex: conquistas offline não quebram overview)
  const failingFetch = async (urlStr, options) => {
    if (urlStr.includes('player_achievements')) {
      return { ok: false, status: 500, json: async () => ({ message: 'Timeout' }) };
    }
    return mockFetch(urlStr, options);
  };

  const resilientOverview = await getCloudAthleteOverview({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteNicolas.token,
    fetchFn: failingFetch
  });
  assert(resilientOverview.profile.display_name === 'Nicolas', 'D3.7 - Resiliência: Perfil carregado mesmo com falha em conquistas');
  assert(Array.isArray(resilientOverview.achievements) && resilientOverview.achievements.length === 0, 'D3.8 - Resiliência: Fallback gracioso para array vazio');

  // ----------------------------------------------------------------------------
  // BLOCO 4: Isolamento Estrito RLS Multi-Atleta (Nicolas vs Beatriz)
  // ----------------------------------------------------------------------------
  console.log('\n--- TESTES BLOCO 4: RLS e Isolamento Multi-Atleta ---');

  const beatrizProfile = await getCloudProfile({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteBeatriz.token,
    fetchFn: mockFetch
  });
  assert(beatrizProfile.display_name === 'Beatriz', 'D4.1 - Beatriz visualiza exclusivamente seu perfil');
  assert(beatrizProfile.level === 2, 'D4.2 - Beatriz é nível 2, sem interferência dos dados do Nicolas');

  // Tentativa de consulta de impactos do Nicolas por Beatriz
  const unauthorizedShots = await getCloudSessionShots({
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    accessToken: athleteBeatriz.token,
    sessionId: 'sess_real_homologada_001', // Pertence ao Nicolas!
    fetchFn: mockFetch
  });
  assert(unauthorizedShots.length === 0, 'D4.3 - RLS impede Beatriz de visualizar impactos do Nicolas');

  // Tentativa com chave service_role (deve ser rejeitada pelo frontend)
  try {
    await getCloudProfile({
      supabaseUrl: mockSupabaseUrl,
      anonKey: mockServiceRoleKey,
      accessToken: athleteNicolas.token,
      fetchFn: mockFetch
    });
    assert(false, 'D4.4 - Rejeição de service_role', 'Deveria ter falhado');
  } catch (err) {
    assert(err.status === 403, 'D4.4 - Chave service_role rejeitada estritamente com HTTP 403');
  }

  // ----------------------------------------------------------------------------
  // BLOCO 5: Login Cloud Standalone e Modo isCloudOnly
  // ----------------------------------------------------------------------------
  console.log('\n--- TESTES BLOCO 5: Login Autônomo Mobile (Modo isCloudOnly) ---');

  mockStorage.clear();
  const remoteLoginRes = await loginWithCloudAccountStandalone({
    email: 'nicolas@motiontennis.com',
    password: 'senhaSegura123',
    supabaseUrl: mockSupabaseUrl,
    anonKey: mockAnonKey,
    fetchFn: mockFetch,
    mockLocalApiFail: true // Notebook desligado!
  });

  assert(remoteLoginRes.success === true, 'D5.1 - Login cloud bem sucedido sem notebook');
  assert(remoteLoginRes.isCloudOnly === true, 'D5.2 - Sinalizador isCloudOnly ativado');
  assert(remoteLoginRes.authType === 'supabase_cloud', 'D5.3 - Tipo de autenticação supabase_cloud');
  assert(remoteLoginRes.user.email === 'nicolas@motiontennis.com', 'D5.4 - Usuário autenticado com e-mail correto');
  assert(remoteLoginRes.user.role === 'player', 'D5.5 - Role definida como player');

  // ----------------------------------------------------------------------------
  // BLOCO 6: Ciclo de Vida da Sessão Cloud (Storage, Restauração e Logout)
  // ----------------------------------------------------------------------------
  console.log('\n--- TESTES BLOCO 6: Ciclo de Vida da Sessão Cloud ---');

  const storedSession = getStoredCloudSession(mockStorage);
  assert(storedSession !== null, 'D6.1 - Sessão salva no localStorage recuperada');
  assert(storedSession.access_token === athleteNicolas.token, 'D6.2 - Token de acesso preservado no storage');
  assert(storedSession.user.id === athleteNicolas.id, 'D6.3 - ID do usuário preservado');

  // Simulação de sessão expirada
  mockStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify({
    access_token: 'expired_token',
    expires_at: Date.now() - 5000 // Expirado há 5 segundos
  }));
  const expiredSession = getStoredCloudSession(mockStorage);
  assert(expiredSession === null, 'D6.4 - Sessão expirada descartada automaticamente');

  // Limpeza de sessão (Logout)
  saveCloudSession({ access_token: 'valid_token_logout_test', expires_in: 3600 }, mockStorage);
  assert(getStoredCloudSession(mockStorage) !== null, 'D6.5 - Nova sessão gravada antes do logout');
  clearCloudSession(mockStorage);
  assert(getStoredCloudSession(mockStorage) === null, 'D6.6 - Sessão limpa com sucesso após logout');

  // ----------------------------------------------------------------------------
  // RESUMO DOS TESTES
  // ----------------------------------------------------------------------------
  console.log('\n==============================================================================');
  console.log(`TOTAL DE TESTES FASE D: ${passedTests + failedTests}`);
  console.log(`PASSADOS: ${passedTests}`);
  console.log(`FALHADOS: ${failedTests}`);
  console.log('==============================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runFaseDTests().catch(err => {
  console.error('Erro catastrófico na execução dos testes:', err);
  process.exit(1);
});
