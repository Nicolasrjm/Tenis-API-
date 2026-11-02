const express = require('express');
const router = express.Router();
const { get, run } = require('../database/db');
const { verifyPassword, generateToken, requireAuth } = require('../services/authService');
const guestSessionService = require('../services/guestSessionService');

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

module.exports = router;
