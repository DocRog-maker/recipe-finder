const path = require('path');
const { PDFNet } = require('@pdftron/pdfnet-node');
const { pool } = require('../db/pool');
const { parseIngredients } = require('./parseIngredients');
const { normalizeIngredientName } = require('./normalize');

/**
 * Reads every page of the PDF with Apryse's TextExtractor. If a page comes
 * back with no text at all (a scanned/photographed recipe), runs Apryse OCR
 * on the document first and re-extracts.
 */
async function extractText(doc) {
  const pageCount = await doc.getPageCount();
  const readPages = async () => {
    let text = '';
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const txt = await PDFNet.TextExtractor.create();
      const rect = await page.getCropBox();
      txt.begin(page, rect);
      text += (await txt.getAsText()) + '\n';
    }
    return text;
  };

  let text = await readPages();

  if (text.trim().length === 0) {
    try {
      const ocrOptions = new PDFNet.OCROptions();
      await PDFNet.OCRModule.imageAndTextSearchablePDFFromPDF(doc, ocrOptions);
      text = await readPages();
    } catch (err) {
      // OCR module may not be included in the license, or OCR resources
      // aren't installed. Fall back to whatever text (likely none) we have,
      // and let the recipe be flagged for manual review below.
      console.warn('OCR fallback unavailable/failed:', err.message || err);
    }
  }

  return text;
}

async function renderThumbnail(doc, outPath) {
  const draw = await PDFNet.PDFDraw.create();
  await draw.setDPI(96);
  const page = await doc.getPage(1);
  await draw.export(page, outPath, 'PNG');
}

/** Upsert an ingredient by canonical name, returning its id. */
async function upsertIngredient(client, canonicalName) {
  const { rows } = await client.query(
    `INSERT INTO ingredients (canonical_name)
     VALUES ($1)
     ON CONFLICT (canonical_name) DO UPDATE SET canonical_name = EXCLUDED.canonical_name
     RETURNING id`,
    [canonicalName]
  );
  return rows[0].id;
}

/**
 * Renders the thumbnail, records the page count, and replaces the recipe's
 * ingredient rows with whatever `parseIngredients(rawText)` yields. Shared by
 * both the auto (full-PDF) and manual (selected-text) ingestion paths.
 */
async function persistRecipe(recipeId, doc, thumbnailPath, rawText) {
  const pageCount = await doc.getPageCount();
  await renderThumbnail(doc, thumbnailPath);

  const parsed = parseIngredients(rawText);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [recipeId]);

    for (const item of parsed) {
      const canonicalName = normalizeIngredientName(item.name);
      if (!canonicalName) continue;
      const ingredientId = await upsertIngredient(client, canonicalName);
      await client.query(
        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, raw_text, quantity, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipeId, ingredientId, item.rawText, item.quantity, item.unit]
      );
    }

    const status = parsed.length > 0 ? 'ready' : 'failed';
    const error = parsed.length > 0 ? null : 'No ingredients could be extracted.';
    await client.query(
      `UPDATE recipes
       SET status = $1, error = $2, page_count = $3, thumbnail_url = $4
       WHERE id = $5`,
      [status, error, pageCount, `/uploads/${path.basename(thumbnailPath)}`, recipeId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Auto ingestion: read the whole PDF with Apryse and parse ingredients from the
 * full page text. Expects a `recipes` row with status='processing'.
 *
 * @param {number} recipeId
 * @param {string} pdfPath - absolute path to the uploaded PDF on disk
 * @param {string} thumbnailPath - where to write the page-1 thumbnail PNG
 */
async function ingestRecipe(recipeId, pdfPath, thumbnailPath) {
  try {
    await PDFNet.runWithCleanup(async () => {
      const doc = await PDFNet.PDFDoc.createFromFilePath(pdfPath);
      doc.initSecurityHandler();
      const rawText = await extractText(doc);
      await persistRecipe(recipeId, doc, thumbnailPath, rawText);
    }, process.env.APRYSE_LICENSE_KEY);
  } catch (err) {
    console.error(`Ingestion failed for recipe ${recipeId}:`, err);
    await pool.query(`UPDATE recipes SET status = 'failed', error = $1 WHERE id = $2`, [
      String(err.message || err),
      recipeId,
    ]);
  }
}

/**
 * Manual ingestion: parse ingredients from caller-supplied text (the region a
 * user selected in the viewer) instead of the whole PDF. Still opens the PDF to
 * render the thumbnail and record the page count. Throws on a genuine failure
 * (bad PDF, DB error) so the caller can report it distinctly from the benign
 * "text contained no recognisable ingredients" case, which persistRecipe
 * records as status='failed' with an explanatory message.
 *
 * @param {number} recipeId
 * @param {string} pdfPath
 * @param {string} thumbnailPath
 * @param {string} ingredientsText - the selected ingredients block
 */
async function ingestRecipeFromText(recipeId, pdfPath, thumbnailPath, ingredientsText) {
  await PDFNet.runWithCleanup(async () => {
    const doc = await PDFNet.PDFDoc.createFromFilePath(pdfPath);
    doc.initSecurityHandler();
    await persistRecipe(recipeId, doc, thumbnailPath, ingredientsText);
  }, process.env.APRYSE_LICENSE_KEY);
}

module.exports = { ingestRecipe, ingestRecipeFromText };
