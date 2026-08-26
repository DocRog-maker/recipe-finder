const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

// GET /api/recipes/:id/annotations?userId=roger@example.com
router.get('/:id/annotations', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId query param is required.' });

  const { rows } = await pool.query(
    `SELECT xfdf, updated_at FROM annotations WHERE recipe_id = $1 AND user_id = $2`,
    [req.params.id, userId]
  );

  res.json(rows[0] || { xfdf: null, updated_at: null });
});

// PUT /api/recipes/:id/annotations  { userId, xfdf }
router.put('/:id/annotations', async (req, res) => {
  const { userId, xfdf } = req.body;
  if (!userId || typeof xfdf !== 'string') {
    return res.status(400).json({ error: 'userId and xfdf are required.' });
  }

  await pool.query(
    `INSERT INTO annotations (recipe_id, user_id, xfdf, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (recipe_id, user_id)
     DO UPDATE SET xfdf = EXCLUDED.xfdf, updated_at = now()`,
    [req.params.id, userId, xfdf]
  );

  res.status(204).end();
});

module.exports = router;
