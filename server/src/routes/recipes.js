const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { pool } = require('../db/pool');
const { ingestRecipe, ingestRecipeFromText } = require('../ingestion/ingest');

const router = express.Router();

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname) || '.pdf'}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are accepted.'));
    }
    cb(null, true);
  },
});

// POST /api/recipes  (multipart/form-data, field name "file")
//
// If an `ingredientsText` field is supplied (the region a user selected in the
// Apryse viewer), the recipe's ingredients are parsed from that text
// synchronously and the created recipe is returned with its ingredients.
// Otherwise the whole PDF is auto-parsed in the background as before.
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const title = req.body.title || path.parse(req.file.originalname).name;
  const pdfUrl = `/uploads/${req.file.filename}`;
  const ingredientsText = req.body.ingredientsText;

  try {
    const { rows } = await pool.query(
      `INSERT INTO recipes (title, source_pdf_url, uploaded_by, status)
       VALUES ($1, $2, $3, 'processing')
       RETURNING id, title, source_pdf_url, status, created_at`,
      [title, pdfUrl, req.body.userId || 'anonymous']
    );
    const recipe = rows[0];
    const thumbnailPath = path.join(uploadDir, `${path.parse(req.file.filename).name}.png`);

    if (typeof ingredientsText === 'string' && ingredientsText.trim()) {
      // Manual add flow: parse the selected ingredients text now and return the
      // finished recipe (with ingredients) so the client can show the result.
      try {
        await ingestRecipeFromText(recipe.id, req.file.path, thumbnailPath, ingredientsText);
      } catch (ingestErr) {
        console.error(`Manual ingestion failed for recipe ${recipe.id}:`, ingestErr);
        return res
          .status(500)
          .json({ error: `Ingestion failed: ${ingestErr.message || ingestErr}` });
      }
      const full = await loadRecipeWithIngredients(recipe.id);
      console.log(
        `Recipe ${recipe.id}: parsed ${full.ingredients.length} ingredient(s) from ` +
          `${ingredientsText.length} chars of selected text.`
      );
      return res.status(201).json(full);
    }

    // Auto flow: parse the whole PDF in the background so the request returns
    // immediately. In production, push this onto a real job queue instead.
    setImmediate(() => ingestRecipe(recipe.id, req.file.path, thumbnailPath));
    res.status(202).json(recipe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create recipe.' });
  }
});

async function loadRecipeWithIngredients(recipeId) {
  const { rows } = await pool.query('SELECT * FROM recipes WHERE id = $1', [recipeId]);
  const { rows: ingredientRows } = await pool.query(
    `SELECT i.canonical_name, ri.raw_text, ri.quantity, ri.unit
     FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.recipe_id = $1`,
    [recipeId]
  );
  return {
    ...rows[0],
    ingredients: ingredientRows.map((r) => ({
      name: r.canonical_name,
      rawText: r.raw_text,
      quantity: r.quantity,
      unit: r.unit,
    })),
  };
}

// GET /api/recipes  - list all recipes with their parsed ingredients
router.get('/', async (_req, res) => {
  const { rows: recipes } = await pool.query(
    `SELECT id, title, source_pdf_url, thumbnail_url, page_count, status, error, created_at
     FROM recipes ORDER BY created_at DESC`
  );
  const { rows: ingredientRows } = await pool.query(
    `SELECT ri.recipe_id, i.canonical_name, ri.raw_text, ri.quantity, ri.unit
     FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id`
  );

  const byRecipe = new Map();
  for (const row of ingredientRows) {
    if (!byRecipe.has(row.recipe_id)) byRecipe.set(row.recipe_id, []);
    byRecipe.get(row.recipe_id).push({
      name: row.canonical_name,
      rawText: row.raw_text,
      quantity: row.quantity,
      unit: row.unit,
    });
  }

  res.json(
    recipes.map((r) => ({ ...r, ingredients: byRecipe.get(r.id) || [] }))
  );
});

// GET /api/recipes/:id  - single recipe detail
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM recipes WHERE id = $1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Recipe not found.' });

  const { rows: ingredientRows } = await pool.query(
    `SELECT i.canonical_name, ri.raw_text, ri.quantity, ri.unit
     FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.recipe_id = $1`,
    [req.params.id]
  );

  res.json({ ...rows[0], ingredients: ingredientRows });
});

module.exports = router;
