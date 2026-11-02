const express = require('express');
const router = express.Router();
const { get, run } = require('../database/db');
const { verifyPassword, generateToken, requireAuth } = require('../services/authService');
const guestSessionService = require('../services/guestSessionService');
const { getPublicClientConfig } = require('../config/supabaseConfig');
const {
  verifySupabaseToken,
  getLinkedUserByCloudId,
  getCloudIdentityForUser,
  linkLocalUserToCloud,
  unlinkLocalUserFromCloud
} = require('../services/cloudIdentityService');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, guest_token } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Informe usuário e senha.' });
    }

    // Se havia sessão visitante anterior no header ou body, encerra-a imediatamente (Teste 20)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const prevGuest = guestSessionService.decodeGuestToken(authHeader.split(' ')[1]);
      if (prevGuest?.guestId) {
        await guestSessionService.destroyGuestSession(prevGuest.guestId);
      }
    }
    if (guest_token) {
      const prevGuest = guestSessionService.decodeGuestToken(guest_token);
      if (prevGuest?.guestId) {
        await guestSessionService.destroyGuestSession(prevGuest.guestId);
      }
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanUsername]);

    if (!user) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Esta conta de usuário está desativada. Contate o administrador.' });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    // Get linked equipment
    const eqUser = await get(`
      SELECT e.id, e.code, e.name, e.status, e.location 
      FROM equipments e
      JOIN equipment_users eu ON eu.equipment_id = e.id
      WHERE eu.user_id = ?
      LIMIT 1
    `, [user.id]);

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        status: user.status,
        equipment: eqUser || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/guest — Inicia sessão temporária segura de visitante (Fase 3)
router.post('/guest', async (req, res) => {
  try {
    // Se já havia uma sessão visitante anterior no header, destrói antes de criar a nova
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const prev = guestSessionService.decodeGuestToken(authHeader.split(' ')[1]);
      if (prev?.guestId) {
        await guestSessionService.destroyGuestSession(prev.guestId);
      }
    }

    const ttlMs = req.body?.ttl_ms;
    const session = await guestSessionService.createGuestSession({ ttlMs });

    res.status(201).json({
      success: true,
      token: session.token,
      guest: session.guest
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/guest/me — Verifica validade da sessão temporária de visitante
router.get('/guest/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Sessão de visitante não informada.' });
    }
    const token = authHeader.split(' ')[1];
    const sess = await guestSessionService.verifyGuestSession(token);
    if (!sess) {
      return res.status(401).json({ error: 'Sessão de visitante inválida ou expirada.' });
    }

    res.json({
      guest: {
        id: sess.guestId,
        guestId: sess.guestId,
        isGuest: true,
        role: 'guest',
        name: 'Visitante',
        avatar: '🎾',
        expiresAt: sess.expiresAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/guest/logout — Encerra sessão de visitante e elimina todos os resultados temporários
router.post('/guest/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = guestSessionService.decodeGuestToken(token);
      if (decoded?.guestId) {
        await guestSessionService.destroyGuestSession(decoded.guestId);
      }
    }
    res.json({ success: true, message: 'Sessão de visitante encerrada e dados temporários removidos.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const eqUser = await get(`
      SELECT e.id, e.code, e.name, e.status, e.location 
      FROM equipments e
      JOIN equipment_users eu ON eu.equipment_id = e.id
      WHERE eu.user_id = ?
      LIMIT 1
    `, [user.id]);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        status: user.status,
        equipment: eqUser || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = guestSessionService.decodeGuestToken(token);
      if (decoded?.guestId) {
        await guestSessionService.destroyGuestSession(decoded.guestId);
      }
    }
  } catch (e) {}
  res.json({ success: true, message: 'Logout realizado com sucesso.' });
});

// ==============================================================================
// ENDPOINTS SUPABASE CLOUD & IDENTIDADE (ETAPA B)
// ==============================================================================

// GET /api/auth/cloud/config — Configuração pública segura para o aplicativo / frontend
router.get('/cloud/config', (req, res) => {
  try {
    const config = getPublicClientConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/cloud/status — Consulta se o usuário local logado possui identidade Supabase associada
router.get('/cloud/status', requireAuth, async (req, res) => {
  try {
    const identity = await getCloudIdentityForUser(req.user.id);
    res.json({
      success: true,
      userId: req.user.id,
      linked: Boolean(identity),
      identity: identity ? {
        cloudUserId: identity.cloud_user_id,
        email: identity.email,
        linkedAt: identity.linked_at,
        lastSeenAt: identity.last_seen_at
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/cloud/link — Vincula com segurança o atleta local autenticado à sua conta Supabase Auth
router.post('/cloud/link', requireAuth, async (req, res) => {
  try {
    const { supabase_token, access_token } = req.body || {};
    const token = supabase_token || access_token;

    // DEFESA ESTATUTÁRIA: Rejeita vinculação por simples UUID ou sem token criptográfico
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'É obrigatório fornecer um token Supabase válido (supabase_token ou access_token) para comprovar a identidade cloud.',
        code: 'TOKEN_REQUIRED'
      });
    }

    const verifyRes = await verifySupabaseToken(token);
    if (!verifyRes.valid) {
      return res.status(401).json({ error: verifyRes.error || 'Token Supabase inválido.', code: verifyRes.code });
    }

    // A identidade cloud e o email são derivados EXCLUSIVAMENTE do token validado
    const result = await linkLocalUserToCloud({
      userId: req.user.id,
      cloudUserId: verifyRes.cloudUserId,
      email: verifyRes.email,
      metadata: { verifiedVia: 'supabase_jwt', verifiedAt: new Date().toISOString() }
    });

    res.json({
      success: true,
      message: 'Atleta vinculado com sucesso à conta Supabase Auth.',
      data: result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/auth/cloud/unlink — Desvincula a conta Supabase do atleta local
router.post('/cloud/unlink', requireAuth, async (req, res) => {
  try {
    // Se senha fornecida para confirmação de segurança, valida contra o hash PBKDF2 local
    if (req.body?.password) {
      const dbUser = await get('SELECT password_hash, salt FROM users WHERE id = ?', [req.user.id]);
      if (dbUser && !verifyPassword(req.body.password, dbUser.password_hash, dbUser.salt)) {
        return res.status(401).json({ error: 'Senha incorreta para confirmar a desvinculação.', code: 'INVALID_PASSWORD' });
      }
    }

    const result = await unlinkLocalUserFromCloud(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/cloud/login-with-token — Autentica atleta no notebook utilizando seu token Supabase Auth
router.post('/cloud/login-with-token', async (req, res) => {
  try {
    const { access_token } = req.body || {};
    if (!access_token) {
      return res.status(400).json({ error: 'Token Supabase access_token não informado.' });
    }

    const verifyRes = await verifySupabaseToken(access_token);
    if (!verifyRes.valid) {
      return res.status(401).json({ error: verifyRes.error || 'Token Supabase inválido.', code: verifyRes.code });
    }

    const linkedUser = await getLinkedUserByCloudId(verifyRes.cloudUserId);
    if (!linkedUser) {
      return res.status(403).json({
        success: false,
        error: 'Esta conta Supabase Auth não está vinculada a nenhum atleta neste equipamento.',
        code: 'CLOUD_USER_NOT_LINKED',
        cloudUserId: verifyRes.cloudUserId,
        email: verifyRes.email
      });
    }

    if (linkedUser.status === 'inactive') {
      return res.status(403).json({ error: 'Esta conta de usuário está desativada. Contate o administrador.' });
    }

    // Carrega equipamento associado ao usuário
    const eqUser = await get(`
      SELECT e.id, e.code, e.name, e.status, e.location 
      FROM equipments e
      JOIN equipment_users eu ON eu.equipment_id = e.id
      WHERE eu.user_id = ?
      LIMIT 1
    `, [linkedUser.id]);

    const token = generateToken(linkedUser);

    res.json({
      success: true,
      token,
      authType: 'supabase',
      user: {
        id: linkedUser.id,
        username: linkedUser.username,
        name: linkedUser.name,
        role: linkedUser.role,
        avatar: linkedUser.avatar,
        status: linkedUser.status,
        cloudUserId: verifyRes.cloudUserId,
        equipment: eqUser || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
