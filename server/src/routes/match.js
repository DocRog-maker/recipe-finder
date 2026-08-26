const express = require('express');
const { pool } = require('../db/pool');
const { normalizeIngredientName } = require('../ingestion/normalize');

const router = express.Router();

// POST /api/match  { ingredients: ["chicken thighs", "garlic", "lemon", "rice"] }
router.post('/', async (req, res) => {
  const haveRaw = Array.isArray(req.body.ingredients) ? req.body.ingredients : [];
  console.log(`searching for ${haveRaw}`)
  const have = new Set(haveRaw.map(normalizeIngredientName).filter(Boolean));

  const { rows: recipes } = await pool.query(
    `SELECT id, title, source_pdf_url, thumbnail_url FROM recipes WHERE status = 'ready'`
  );
   console.log(`recipe number ${recipes}`)
  const { rows: ingredientRows } = await pool.query(
    `SELECT ri.recipe_id, i.canonical_name
     FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id`
  );

  const byRecipe = new Map();
  for (const row of ingredientRows) {
    if (!byRecipe.has(row.recipe_id)) byRecipe.set(row.recipe_id, []);
    byRecipe.get(row.recipe_id).push(row.canonical_name);
  }

  const results = recipes
    .map((recipe) => {
      const required = byRecipe.get(recipe.id) || [];
      if (required.length === 0) return null;
      const matched = required.filter((name) => have.has(name));
      const missing = required.filter((name) => !have.has(name));
      return {
        ...recipe,
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
