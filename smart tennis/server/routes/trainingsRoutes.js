const express = require('express');
const router = express.Router();
const { all, get, run } = require('../database/db');
const { broadcastEvent } = require('../services/eventHub');
const { requireAuth } = require('../services/authService');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const trainings = await all(`SELECT * FROM trainings ORDER BY xp_reward ASC`);
    res.json(trainings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const training = await get(`SELECT * FROM trainings WHERE id = ?`, [req.params.id]);
    if (!training) {
      return res.status(404).json({ error: 'Treinamento não encontrado' });
    }
    res.json(training);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const { score, accuracy, shotsCount, hitsCount } = req.body || {};
    const training = await get(`SELECT * FROM trainings WHERE id = ?`, [req.params.id]);
    if (!training) {
      return res.status(404).json({ error: 'Treinamento não encontrado' });
    }

    const userId = Number(req.user.id);
    const player = await get(`SELECT * FROM players WHERE user_id = ? LIMIT 1`, [userId]);
    const newCompleted = (player ? player.trainings_completed : 0) + 1;
    const newXp = (player ? player.xp : 0) + training.xp_reward;

    if (player) {
      await run(`
        UPDATE players SET
          trainings_completed = ?,
          xp = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newCompleted, newXp, player.id]);
    }

    const sessionId = `train_${Date.now()}`;
    await run(`
      INSERT INTO sessions (
        id, user_id, mode, shots_count, hits_count, accuracy, total_score, avg_force, duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [sessionId, userId, training.title, shotsCount || 10, hitsCount || 8, accuracy || 80.0, score || training.target_score, 82.5, 300]);

    broadcastEvent('TRAINING_COMPLETED', {
      trainingId: training.id,
      title: training.title,
      xpGained: training.xp_reward,
      totalTrainings: newCompleted
    });

    res.json({
      success: true,
      message: `Treino "${training.title}" concluído! +${training.xp_reward} XP concedido.`,
      xpGained: training.xp_reward,
      trainingsCompleted: newCompleted
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
