const express = require('express');
const router = express.Router();
const { get, run } = require('../database/db');
const { requireAuth, requireAdmin } = require('../services/authService');
const VALID = ['small', 'medium', 'large'];

async function ensureTable() {
  await run('CREATE TABLE IF NOT EXISTS wall_settings (id INTEGER PRIMARY KEY CHECK(id = 1), preset TEXT NOT NULL DEFAULT \'medium\')');
  await run("INSERT OR IGNORE INTO wall_settings (id, preset) VALUES (1, 'medium')");
}

router.get('/', requireAuth, async (req, res) => {
  try {
    await ensureTable();
    const item = await get('SELECT preset FROM wall_settings WHERE id=1');
    res.json({ preset: item?.preset || 'medium' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/', requireAuth, requireAdmin, async (req, res) => {
  const { preset } = req.body;
  if (!VALID.includes(preset)) return res.status(400).json({ error: 'Configuração inválida.' });
  try {
    await ensureTable();
    await run('UPDATE wall_settings SET preset=? WHERE id=1', [preset]);
    res.json({ preset, success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
module.exports = router;
