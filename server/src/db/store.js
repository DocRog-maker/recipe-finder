const fs = require('fs');
const path = require('path');

// Single-file JSON data store. Holds everything that used to live in Postgres:
// recipes (with their parsed ingredients embedded) and per-user annotations.
// The PDFs and thumbnails themselves stay on disk under uploads/.
//
// Shape of db.json:
// {
//   "nextRecipeId": 4,
//   "recipes": [
//     { id, title, source_pdf_url, thumbnail_url, page_count, uploaded_by,
//       status, error, created_at,
//       ingredients: [ { name, rawText, quantity, unit } ] }
//   ],
//   "annotations": { "<recipeId>:<userId>": { recipe_id, user_id, xfdf, updated_at } }
// }

const dataDir = path.resolve(process.env.DATA_DIR || './data');
const dbFile = path.join(dataDir, 'db.json');

fs.mkdirSync(dataDir, { recursive: true });

function loadInitial() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    return {
      nextRecipeId: parsed.nextRecipeId || 1,
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
      annotations: parsed.annotations && typeof parsed.annotations === 'object' ? parsed.annotations : {},
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Could not read data store, starting empty:', err.message);
    }
    return { nextRecipeId: 1, recipes: [], annotations: {} };
  }
}

const db = loadInitial();

// Persist the whole store atomically (temp file + rename). Writes are chained so
// concurrent mutations can't interleave; each write serialises the latest state.
let writeChain = Promise.resolve();
function persist() {
  writeChain = writeChain
    .then(async () => {
      const tmp = `${dbFile}.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify(db, null, 2));
      await fs.promises.rename(tmp, dbFile);
    })
    .catch((err) => console.error('Failed to persist data store:', err));
  return writeChain;
}

// ---- Recipes ----------------------------------------------------------------

async function createRecipe({ title, source_pdf_url, uploaded_by, status }) {
  const recipe = {
    id: db.nextRecipeId++,
    title,
    source_pdf_url,
    thumbnail_url: null,
    page_count: null,
    uploaded_by: uploaded_by || 'anonymous',
    status: status || 'processing',
    error: null,
    created_at: new Date().toISOString(),
    ingredients: [],
  };
  db.recipes.push(recipe);
  await persist();
  return recipe;
}

function getRecipe(id) {
  const rid = Number(id);
  return db.recipes.find((r) => r.id === rid) || null;
}

function listRecipes() {
  // Newest first (created_at is an ISO string, so lexical sort is chronological).
  return [...db.recipes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

async function updateRecipe(id, patch) {
  const recipe = getRecipe(id);
  if (!recipe) return null;
  Object.assign(recipe, patch);
  await persist();
  return recipe;
}

async function setRecipeIngredients(id, ingredients) {
  const recipe = getRecipe(id);
  if (!recipe) return null;
  recipe.ingredients = ingredients;
  await persist();
  return recipe;
}

// ---- Annotations ------------------------------------------------------------

const annKey = (recipeId, userId) => `${recipeId}:${userId}`;

function getAnnotation(recipeId, userId) {
  return db.annotations[annKey(recipeId, userId)] || null;
}

async function setAnnotation(recipeId, userId, xfdf) {
  db.annotations[annKey(recipeId, userId)] = {
    recipe_id: Number(recipeId),
    user_id: userId,
    xfdf,
    updated_at: new Date().toISOString(),
  };
  await persist();
}

module.exports = {
  createRecipe,
  getRecipe,
  listRecipes,
  updateRecipe,
  setRecipeIngredients,
  getAnnotation,
  setAnnotation,
};
