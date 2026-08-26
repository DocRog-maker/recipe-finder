const express = require('express');
const store = require('../db/store');
const { normalizeIngredientName } = require('../ingestion/normalize');

const router = express.Router();

// POST /api/match  { ingredients: ["chicken thighs", "garlic", "lemon", "rice"] }
router.post('/', (req, res) => {
  const haveRaw = Array.isArray(req.body.ingredients) ? req.body.ingredients : [];
  const have = new Set(haveRaw.map(normalizeIngredientName).filter(Boolean));

  const results = store
    .listRecipes()
    .filter((recipe) => recipe.status === 'ready')
    .map((recipe) => {
      const required = (recipe.ingredients || []).map((i) => i.name);
      if (required.length === 0) return null;
      const matched = required.filter((name) => have.has(name));
      const missing = required.filter((name) => !have.has(name));
      return {
        id: recipe.id,
        title: recipe.title,
        source_pdf_url: recipe.source_pdf_url,
        thumbnail_url: recipe.thumbnail_url,
        matchCount: matched.length,
        totalCount: required.length,
        matchPercent: Math.round((matched.length / required.length) * 100),
        missing,
      };
    })
    .filter(Boolean)
    .filter((r) => r.matchCount > 0)
    .sort((a, b) => b.matchPercent - a.matchPercent);

  res.json(results);
});

module.exports = router;
