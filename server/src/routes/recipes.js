const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const store = require('../db/store');
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
    const recipe = await store.createRecipe({
      title,
      source_pdf_url: pdfUrl,
      uploaded_by: req.body.userId || 'anonymous',
      status: 'processing',
    });
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
      const full = store.getRecipe(recipe.id);
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

// GET /api/recipes  - list all recipes with their parsed ingredients
router.get('/', (_req, res) => {
  res.json(store.listRecipes());
});

// GET /api/recipes/:id  - single recipe detail
router.get('/:id', (req, res) => {
  const recipe = store.getRecipe(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });
  res.json(recipe);
});

module.exports = router;
