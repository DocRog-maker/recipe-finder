const express = require('express');
const store = require('../db/store');

const router = express.Router();

// GET /api/recipes/:id/annotations?userId=roger@example.com
router.get('/:id/annotations', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId query param is required.' });

  const annotation = store.getAnnotation(req.params.id, userId);
  res.json(annotation || { xfdf: null, updated_at: null });
});

// PUT /api/recipes/:id/annotations  { userId, xfdf }
router.put('/:id/annotations', async (req, res) => {
  const { userId, xfdf } = req.body;
  if (!userId || typeof xfdf !== 'string') {
    return res.status(400).json({ error: 'userId and xfdf are required.' });
  }

  await store.setAnnotation(req.params.id, userId, xfdf);
  res.status(204).end();
});

module.exports = router;
