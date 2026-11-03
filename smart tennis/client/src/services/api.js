import { getApiBaseUrl, getSavedServerUrl, isNativeMobile } from './serverConfig';
import { getPlayerOfflineData } from './db';

export function getAuthToken() {
  return localStorage.getItem('smart_tennis_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('smart_tennis_token', token);
  } else {
    localStorage.removeItem('smart_tennis_token');
  }
}

export function getGuestToken() {
  return localStorage.getItem('smart_tennis_guest_token');
}

export function setGuestToken(token) {
  if (token) {
    localStorage.setItem('smart_tennis_guest_token', token);
  } else {
    localStorage.removeItem('smart_tennis_guest_token');
  }
}

export function getCurrentStoredUserId() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const payloadBase64 = token.split('.')[0];
    const decoded = JSON.parse(atob(payloadBase64));
    if (decoded?.type === 'guest') return null;
    return decoded?.id || null;
  } catch (e) {
    return null;
  }
}

export async function fetchJson(endpoint, options = {}) {
  const serverUrl = getSavedServerUrl();
  const baseUrl = getApiBaseUrl();

  // Se estiver no celular Android nativo e nenhum servidor tiver sido configurado
  if (isNativeMobile() && !serverUrl) {
    const err = new Error(
      'Nenhum servidor Motion Tennis configurado no aplicativo. ' +
      'Por favor, conecte-se ao servidor informando o IP do notebook ou escaneando o QR Code.'
    );
    err.code = 'SERVER_NOT_CONFIGURED';
    err.status = 0;
    throw err;
  }

  const url = `${baseUrl}${endpoint}`;
  const userToken = getAuthToken();
  const guestToken = getGuestToken();
  const activeToken = userToken || guestToken;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    // Se for erro de rede e for requisição GET de atleta autenticado (nunca visitante!), tenta cache offline
    const isNetworkError = err.name === 'TypeError' || (err.message && (err.message.includes('fetch') || err.message.includes('NetworkError')));
    const isGet = !options.method || options.method === 'GET';

    if (isNetworkError && isGet && userToken && !guestToken) {
      const userId = getCurrentStoredUserId();
      if (userId) {
        const offlineData = await getPlayerOfflineData(userId).catch(() => null);
        if (offlineData) {
          if (endpoint === '/player' && offlineData.profile) {
            return offlineData.profile;
          }
          if (endpoint.startsWith('/sessions') && offlineData.sessions) {
            return offlineData.sessions;
          }
          if (endpoint === '/skills/attributes' && offlineData.attributes) {
            return offlineData.attributes;
          }
          if (endpoint === '/achievements' && offlineData.achievements) {
            return offlineData.achievements;
          }
          if (endpoint === '/shots/hitmap' && offlineData.hitmap) {
            return offlineData.hitmap;
          }
        }
      }
    }

    const connErr = new Error(
      'Não foi possível comunicar com o servidor Motion Tennis. ' +
      'Verifique se o notebook está ligado na mesma rede Wi-Fi e se o IP configurado está correto.'
    );
    connErr.code = 'NETWORK_ERROR';
    connErr.status = 0;
    connErr.originalError = err;
    throw connErr;
  }

  // Validação estrita do Content-Type retornado
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    const rawText = await response.text().catch(() => '');
    const isHtml = rawText.trim().startsWith('<') || rawText.includes('<!doctype') || rawText.includes('<html');

    if (isHtml) {
      const err = new Error(
        'O aplicativo recebeu uma página web (HTML) em vez de dados da API (JSON). ' +
        'Isso ocorre quando o endereço aponta para o dispositivo local ou a rota não existe no servidor. ' +
        'Verifique o IP e a porta nas opções de conexão.'
      );
      err.code = 'UNEXPECTED_HTML_RESPONSE';
      err.status = response.status;
      err.rawResponse = rawText.slice(0, 250);
      throw err;
    }

    const err = new Error(`Resposta inválida do servidor: formato esperado JSON, recebido ${contentType || 'desconhecido'}.`);
    err.code = 'INVALID_CONTENT_TYPE';
    err.status = response.status;
    throw err;
  }

  // Parse seguro do JSON
  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    const err = new Error('Falha ao processar a resposta JSON do servidor.');
    err.code = 'JSON_PARSE_ERROR';
    err.status = response.status;
    throw err;
  }

  if (!response.ok) {
    const errMsg = data?.error || data?.message || `Erro HTTP ${response.status}`;
    const err = new Error(errMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Auth & Guest Session
  login: (credentials) => fetchJson('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => fetchJson('/auth/me'),
  logout: () => fetchJson('/auth/logout', { method: 'POST' }),
  startGuestSession: () => fetchJson('/auth/guest', { method: 'POST', body: JSON.stringify({}) }),
  getGuestMe: () => fetchJson('/auth/guest/me'),
  logoutGuest: () => fetchJson('/auth/guest/logout', { method: 'POST' }),

  // Cloud Auth & Supabase Identity (Etapa B)
  getCloudConfig: () => fetchJson('/auth/cloud/config'),
  getCloudStatus: () => fetchJson('/auth/cloud/status'),
  linkCloudAccount: (data) => fetchJson('/auth/cloud/link', { method: 'POST', body: JSON.stringify(data) }),
  unlinkCloudAccount: (data) => fetchJson('/auth/cloud/unlink', { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  loginWithSupabaseToken: (accessToken, options = {}) => fetchJson('/auth/cloud/login-with-token', {
    method: 'POST',
    body: JSON.stringify({
      access_token: accessToken,
      create_if_missing: options.create_if_missing !== undefined ? options.create_if_missing : true,
      name: options.name || undefined
    })
  }),

  // Player
  getPlayer: () => fetchJson('/player'),
  updatePlayer: (data) => fetchJson('/player', { method: 'PUT', body: JSON.stringify(data) }),
  resetDemoData: () => fetchJson('/player/reset', { method: 'POST' }),
  clearData: () => fetchJson('/player/clear', { method: 'POST' }),

  // Sensors & Hits
  getSensors: () => fetchJson('/sensors'),
  sendHardwareHit: (data) => fetchJson('/hardware/hit', { method: 'POST', body: JSON.stringify(data) }),
  simulateSensorHit: (data) => fetchJson('/hardware/simulate', { method: 'POST', body: JSON.stringify(data) }),
  getHardwareStatus: () => fetchJson('/hardware/status'),
  setHardwareMode: (mode) => fetchJson('/hardware/mode', { method: 'POST', body: JSON.stringify({ mode }) }),

  // Legacy Shots & Hitmap
  getRecentShots: (limit = 20) => fetchJson(`/shots/recent?limit=${limit}`),
  getHitMapData: () => fetchJson('/shots/hitmap'),
  getHitmap: () => fetchJson('/shots/hitmap'),

  // Skills & Tree
  getAttributes: () => fetchJson('/skills/attributes'),
  getAttributeDetail: (key) => fetchJson(`/skills/attribute/${key}`),
  getSkillTree: () => fetchJson('/skills/tree'),
  unlockSkillNode: (id) => fetchJson(`/skills/tree/${id}/unlock`, { method: 'POST' }),

  // Academy (100% Gratuito para Visitantes, Jogadores e Admins)
  getAcademyOverview: () => fetchJson('/academy'),
  getAcademySkillContent: (skill) => fetchJson(`/academy/${skill}`),
  getAcademyCatalog: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    const q = new URLSearchParams(cleanParams).toString();
    return fetchJson(`/academy/catalog${q ? '?' + q : ''}`);
  },
  getAcademyLessons: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    const q = new URLSearchParams(cleanParams).toString();
    return fetchJson(`/academy/lessons${q ? '?' + q : ''}`);
  },
  getAcademyCategories: () => fetchJson('/academy/categories'),
  getAcademyLessonDetail: (id) => fetchJson(`/academy/lessons/${encodeURIComponent(id)}`),
  getAcademyProgress: () => fetchJson('/academy/progress'),
  setAcademyLessonProgress: (id, completed = true) =>
    fetchJson(`/academy/lessons/${encodeURIComponent(id)}/progress`, {
      method: 'POST',
      body: JSON.stringify({ completed })
    }),

  // Trainings
  getTrainings: () => fetchJson('/trainings'),
  completeTraining: (id, data) => fetchJson(`/trainings/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),

  // Achievements
  getAchievements: () => fetchJson('/achievements'),

  // Sessions
  getSessions: (limit = 30) => {
    const resolvedLimit = typeof limit === 'object' && limit !== null ? (limit.limit || 30) : limit;
    return fetchJson(`/sessions?limit=${resolvedLimit}`);
  },
  createSession: (data) => fetchJson('/sessions', { method: 'POST', body: JSON.stringify(data) }),

  // System Status & Wall Config
  getStatus: () => fetchJson('/status'),
  getWallConfig: () => fetchJson('/sensors/wall-config'),
  updateWallConfig: (data) => fetchJson('/sensors/wall-config', { method: 'PUT', body: JSON.stringify(data) }),
  updateMyWallConfig: (data) => fetchJson('/sensors/wall-config', { method: 'PUT', body: JSON.stringify(data) }),

  // IoT & Arduino Integration
  getIotDiagnostics: () => fetchJson('/hardware/iot-diagnostics'),
  updateIotCalibration: (data) => fetchJson('/hardware/iot-calibration', { method: 'PUT', body: JSON.stringify(data) }),
  testSyntheticTdoa: (data) => fetchJson('/hardware/iot-diagnostics/test-tdoa', { method: 'POST', body: JSON.stringify(data) }),
  sendArduinoEvents: (data) => fetchJson('/hardware/arduino/events', { method: 'POST', body: JSON.stringify(data) }),

  // Instalação (Shopping / Pessoal) e experiência comercial (tempo e regras no backend)
  getInstallation: () => fetchJson('/installation'),
  experience: {
    getCurrent: () => fetchJson('/experience/current'),
    start: () => fetchJson('/experience/start', { method: 'POST' }),
    sendImpact: (id, data) => fetchJson(`/experience/${id}/impact`, { method: 'POST', body: JSON.stringify(data) }),
    abort: (id) => fetchJson(`/experience/${id}/abort`, { method: 'POST' })
  },

  // Partidas do Modo Pessoal (5s preparação + 5 minutos controlados pelo backend)
  personalMatch: {
    getCurrent: (mode = null) => fetchJson(`/personal-match/current${mode ? `?mode=${encodeURIComponent(mode)}` : ''}`),
    start: (data) => fetchJson('/personal-match/start', { method: 'POST', body: JSON.stringify(data) }),
    finish: (data = {}) => fetchJson('/personal-match/finish', { method: 'POST', body: JSON.stringify(data) }),
    sendImpact: (data) => fetchJson('/personal-match/impact', { method: 'POST', body: JSON.stringify(data) })
  },

  // Admin APIs
  admin: {
    setInstallation: (data) => fetchJson('/installation', { method: 'PUT', body: JSON.stringify(data) }),
    getUsers: () => fetchJson('/admin/users'),
    createUser: (data) => fetchJson('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id, data) => fetchJson(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id) => fetchJson(`/admin/users/${id}`, { method: 'DELETE' }),
    resetUserPassword: (id, newPassword) => fetchJson(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),

    getEquipments: () => fetchJson('/admin/equipments'),
    createEquipment: (data) => fetchJson('/admin/equipments', { method: 'POST', body: JSON.stringify(data) }),
    updateEquipment: (id, data) => fetchJson(`/admin/equipments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEquipment: (id) => fetchJson(`/admin/equipments/${id}`, { method: 'DELETE' }),

    getEquipmentUsers: (equipmentId) => fetchJson(`/admin/equipments/${equipmentId}/users`),
    addEquipmentUser: (equipmentId, userId) => fetchJson(`/admin/equipments/${equipmentId}/users`, { method: 'POST', body: JSON.stringify({ userId }) }),
    removeEquipmentUser: (equipmentId, userId) => fetchJson(`/admin/equipments/${equipmentId}/users/${userId}`, { method: 'DELETE' }),

    getWallConfig: () => fetchJson('/admin/wall-config'),
    setWallConfig: (preset) => fetchJson('/admin/wall-config', { method: 'POST', body: JSON.stringify({ preset }) }),

    // Gerenciar Academy (Admin)
    getAcademyLessons: () => fetchJson('/admin/academy/lessons'),
    createAcademyLesson: (data) => fetchJson('/admin/academy/lessons', { method: 'POST', body: JSON.stringify(data) }),
    updateAcademyLesson: (id, data) =>
      fetchJson(`/admin/academy/lessons/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
    setAcademyLessonPublished: (id, published) =>
      fetchJson(`/admin/academy/lessons/${encodeURIComponent(id)}/publish`, {
        method: 'PATCH',
        body: JSON.stringify({ published })
      }),
    deleteAcademyLesson: (id) =>
      fetchJson(`/admin/academy/lessons/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    updateAcademySettings: (data) =>
      fetchJson('/admin/academy/settings', { method: 'PUT', body: JSON.stringify(data) }),
    validateYoutubeUrl: (url) =>
      fetchJson('/admin/academy/validate-youtube', { method: 'POST', body: JSON.stringify({ url }) }),

    getSensors: () => fetchJson('/admin/sensors'),
    getSessions: () => fetchJson('/admin/sessions'),
    getReports: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return fetchJson(`/admin/reports${q ? '?' + q : ''}`);
    }
  },
  adminGetStats: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`/admin/reports${q ? '?' + q : ''}`);
  }
};
