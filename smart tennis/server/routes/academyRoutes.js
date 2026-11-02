const express = require('express');
const router = express.Router();
const { get, all } = require('../database/db');
const { requireAuth, requireAdmin, verifyToken } = require('../services/authService');
const guestSessionService = require('../services/guestSessionService');
const academyService = require('../services/academyService');

/**
 * Middleware de autenticação opcional para a Motion Tennis Academy.
 * Permite acesso 100% gratuito a:
 *  - Visitantes sem login (anônimos)
 *  - Visitantes em Modo Visitante (sessão guest)
 *  - Jogadores autenticados (enriquece resposta com progresso pessoal)
 *  - Administradores
 */
async function optionalAcademyAuth(req, res, next) {
  req.user = null;
  req.guest = null;
  req.actor = { type: 'anonymous' };

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  try {
    const guestDecoded = guestSessionService.decodeGuestToken(token);
    if (guestDecoded) {
      const guestSess = await guestSessionService.verifyGuestSession(token);
      if (guestSess) {
        req.guest = guestSess;
        req.actor = { type: 'guest', guestId: guestSess.guestId, guest: guestSess };
      }
      return next();
    }

    const payload = verifyToken(token);
    if (payload && payload.id) {
      const user = await get(
        'SELECT id, username, name, role, avatar, status FROM users WHERE id = ?',
        [payload.id]
      );
      if (user && user.status !== 'inactive') {
        req.user = user;
        req.actor = { type: 'user', userId: user.id, user };
      }
    }
  } catch (err) {
    // Em rotas públicas de leitura, falha de token opcional não bloqueia o visitante
  }

  return next();
}

function handleAcademyError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({ error: error.message || 'Erro na Motion Tennis Academy.' });
}

// ================= ROTAS PÚBLICAS & GRATUITAS (CATÁLOGO E REPRODUÇÃO) ================= //

// GET /api/academy/catalog — Catálogo completo da Motion Tennis Academy (gratuito e sem exigir login)
router.get('/catalog', optionalAcademyAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { category, level, search } = req.query;
    const catalog = await academyService.getPublicCatalog({
      userId,
      category,
      level,
      search
    });
    res.json(catalog);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// GET /api/academy/lessons — Lista de aulas publicadas (compatível com Web e futuro App Android)
router.get('/lessons', optionalAcademyAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { category, level, search } = req.query;
    const catalog = await academyService.getPublicCatalog({
      userId,
      category,
      level,
      search
    });
    res.json({
      freeAccess: true,
      requiresLogin: false,
      requiresSubscription: false,
      totalPublished: catalog.totalPublished,
      plannedInitialLessonsCount: catalog.plannedInitialLessonsCount,
      lessons: catalog.lessons,
      categories: catalog.categories,
      userProgress: catalog.userProgress
    });
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// GET /api/academy/categories — Lista de categorias/módulos e progresso (compatível com Web e Android)
router.get('/categories', optionalAcademyAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const catalog = await academyService.getPublicCatalog({ userId });
    res.json({
      freeAccess: true,
      categories: catalog.categories,
      totalPublished: catalog.totalPublished,
      plannedInitialLessonsCount: catalog.plannedInitialLessonsCount
    });
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// GET /api/academy/lessons/:id — Detalhe de aula publicada + reprodução embed YouTube + aulas relacionadas
router.get('/lessons/:id', optionalAcademyAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const isAdmin = Boolean(req.user && req.user.role === 'admin');
    const detail = await academyService.getLessonDetail(req.params.id, { userId, isAdmin });
    res.json(detail);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// ================= ROTAS DE PROGRESSO DO ALUNO AUTENTICADO ================= //

// GET /api/academy/progress — Progresso individual do jogador autenticado
router.get('/progress', requireAuth, async (req, res) => {
  try {
    const progress = await academyService.getUserProgress({ userId: req.user.id });
    res.json(progress);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// POST /api/academy/lessons/:id/progress — Marca ou desmarca aula como concluída (apenas conta autenticada)
router.post('/lessons/:id/progress', requireAuth, async (req, res) => {
  try {
    // Bloqueia tentativa de alterar progresso de outra conta
    if (
      req.body?.user_id !== undefined &&
      req.body?.user_id !== null &&
      Number(req.body.user_id) !== Number(req.user.id)
    ) {
      return res.status(403).json({ error: 'Não é permitido alterar o progresso de outro jogador.' });
    }

    const completed = req.body?.completed !== undefined ? Boolean(req.body.completed) : true;
    const result = await academyService.setUserLessonProgress({
      userId: req.user.id,
      lessonId: req.params.id,
      completed
    });
    res.json(result);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// PUT /api/academy/lessons/:id/progress — Alias REST para atualizar conclusão de aula
router.put('/lessons/:id/progress', requireAuth, async (req, res) => {
  try {
    if (
      req.body?.user_id !== undefined &&
      req.body?.user_id !== null &&
      Number(req.body.user_id) !== Number(req.user.id)
    ) {
      return res.status(403).json({ error: 'Não é permitido alterar o progresso de outro jogador.' });
    }

    const completed = req.body?.completed !== undefined ? Boolean(req.body.completed) : true;
    const result = await academyService.setUserLessonProgress({
      userId: req.user.id,
      lessonId: req.params.id,
      completed
    });
    res.json(result);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// ================= ROTAS ADMINISTRATIVAS (GERENCIAR ACADEMY) ================= //

// GET /api/academy/admin/lessons — Lista todas as aulas (publicadas e rascunhos/em breve) para o Admin
router.get('/admin/lessons', requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = await academyService.listAdminLessons();
    res.json(data);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// POST /api/academy/admin/lessons — Cria nova videoaula
router.post('/admin/lessons', requireAuth, requireAdmin, async (req, res) => {
  try {
    const created = await academyService.createAdminLesson(req.body);
    res.status(201).json(created);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// PUT /api/academy/admin/lessons/:id — Edita videoaula existente
router.put('/admin/lessons/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await academyService.updateAdminLesson(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// PATCH /api/academy/admin/lessons/:id/publish — Publica ou despublica videoaula
router.patch('/admin/lessons/:id/publish', requireAuth, requireAdmin, async (req, res) => {
  try {
    const published = Boolean(req.body?.published);
    const updated = await academyService.setAdminLessonPublished(req.params.id, published);
    res.json(updated);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// DELETE /api/academy/admin/lessons/:id — Exclui videoaula
router.delete('/admin/lessons/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await academyService.deleteAdminLesson(req.params.id);
    res.json(result);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// PUT /api/academy/admin/settings — Atualiza configurações de exibição do catálogo
router.put('/admin/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const showComingSoon = Boolean(req.body?.showComingSoon);
    await academyService.setShowComingSoonSetting(showComingSoon);
    res.json({ showComingSoon });
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// POST /api/academy/admin/validate-youtube — Valida URL do YouTube em tempo real no painel Admin
router.post('/admin/validate-youtube', requireAuth, requireAdmin, async (req, res) => {
  try {
    const parsed = academyService.validateAndParseYouTubeUrl(req.body?.url, { allowEmpty: false });
    res.json(parsed);
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// ================= ROTAS LEGADAS DE COMPATIBILIDADE (/api/academy e /api/academy/:skill) ================= //

// GET /api/academy — Visão geral por módulos + catálogo público (acessível sem login!)
router.get('/', optionalAcademyAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const catalog = await academyService.getPublicCatalog({ userId });

    const counts = await all(`
      SELECT skill,
             COUNT(*) as total_lessons,
             SUM(CASE WHEN published = 1 AND embed_url IS NOT NULL AND embed_url != '' THEN 1 ELSE 0 END) as published_lessons
      FROM academy_content
      GROUP BY skill
    `);

    let attributes = [];
    if (userId) {
      const player = await get('SELECT id FROM players WHERE user_id = ?', [userId]);
      if (player) {
        attributes = await all(
          'SELECT attribute_key as key, name, icon, level, xp, xp_next, description FROM player_attributes WHERE player_id = ?',
          [player.id]
        );
      }
    }

    const defaultSkills = [
      { key: 'precision', name: 'Precisão', icon: '🎯', level: 1, xp: 0, xp_next: 100, description: 'Capacidade de acertar alvos específicos e zonas de pontuação máxima.' },
      { key: 'consistency', name: 'Consistência', icon: '🔄', level: 1, xp: 0, xp_next: 100, description: 'Manutenção de sequências longas de acertos sem erros.' },
      { key: 'speed', name: 'Velocidade', icon: '⚡', level: 1, xp: 0, xp_next: 100, description: 'Potência e velocidade média dos golpes registrados.' },
      { key: 'control', name: 'Controle', icon: '🎮', level: 1, xp: 0, xp_next: 100, description: 'Domínio sobre a direção e força da bola em diferentes alturas.' },
      { key: 'reflex', name: 'Reflexo', icon: '⚡', level: 1, xp: 0, xp_next: 100, description: 'Tempo de reação rápido em modos dinâmicos de alvos.' },
      { key: 'strategy', name: 'Estratégia', icon: '🧠', level: 1, xp: 0, xp_next: 100, description: 'Inteligência de jogo, leitura de quadra e tomada de decisão.' }
    ];

    const baseSkills = attributes.length > 0 ? attributes : defaultSkills;
    const overview = baseSkills.map((attr) => {
      const found = counts.find((c) => c.skill === attr.key);
      return {
        ...attr,
        total_lessons: found ? found.total_lessons : 2,
        published_lessons: found ? Number(found.published_lessons || 0) : 0,
        category: academyService.SKILL_TO_CATEGORY[attr.key] || attr.name
      };
    });

    res.json({
      skills: overview,
      freeAccess: true,
      requiresLogin: false,
      requiresSubscription: false,
      catalog
    });
  } catch (error) {
    handleAcademyError(res, error);
  }
});

// GET /api/academy/:skill — Conteúdos de uma habilidade/módulo específico (acessível sem login!)
router.get('/:skill', optionalAcademyAuth, async (req, res) => {
  try {
    const { skill } = req.params;
    const validSkills = ['precision', 'consistency', 'speed', 'control', 'reflex', 'strategy'];

    if (!validSkills.includes(skill)) {
      return res.status(400).json({ error: 'Habilidade inválida.' });
    }

    const userId = req.user ? req.user.id : null;
    const isAdmin = Boolean(req.user && req.user.role === 'admin');
    const catalog = await academyService.getPublicCatalog({ userId, category: skill });

    let attribute = null;
    let relatedTrainings = [];
    if (userId) {
      const player = await get('SELECT id FROM players WHERE user_id = ?', [userId]);
      if (player) {
        attribute = await get(
          'SELECT attribute_key as key, name, icon, level, xp, xp_next, description FROM player_attributes WHERE player_id = ? AND attribute_key = ?',
          [player.id, skill]
        );
      }
    }

    if (!attribute) {
      attribute = {
        key: skill,
        name: academyService.SKILL_TO_CATEGORY[skill] || skill,
        icon: '🎾',
        level: 1,
        xp: 0,
        xp_next: 100,
        description: `Módulo técnico de ${academyService.SKILL_TO_CATEGORY[skill] || skill} da Motion Tennis Academy.`
      };
    }

    relatedTrainings = await all('SELECT * FROM trainings WHERE category = ?', [skill]);

    // Para visitantes/jogadores comuns, `lessons` retorna apenas aulas publicadas desse módulo;
    // os slots planejados "Em breve" ficam em `plannedSlots`.
    const plannedSlots = catalog.initialModulesPreview.filter(
      (s) => s.category === academyService.SKILL_TO_CATEGORY[skill]
    );

    res.json({
      freeAccess: true,
      skill: attribute,
      lessons: catalog.lessons,
      plannedSlots,
      relatedTrainings,
      isAdmin
    });
  } catch (error) {
    handleAcademyError(res, error);
  }
});

module.exports = router;
