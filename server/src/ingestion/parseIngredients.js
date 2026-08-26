const { normalizeIngredientName } = require('./normalize');

const UNITS = [
  'cups?', 'tbsp', 'tablespoons?', 'tsp', 'teaspoons?', 'oz', 'ounces?',
  'lbs?', 'pounds?', 'g', 'grams?', 'kg', 'kilograms?', 'ml', 'milliliters?',
  'l', 'liters?', 'cloves?', 'slices?', 'cans?', 'pinch(?:es)?', 'dash(?:es)?',
  'stalks?', 'sprigs?',
];
const UNIT_RE = new RegExp(`^(${UNITS.join('|')})\\.?$`, 'i');

// Matches a leading quantity: whole numbers, decimals, simple fractions
// ("1/2"), and mixed numbers ("1 1/2").
const QTY_RE = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*/;

const SECTION_START = /^ingredients?\s*:?$/i;
const SECTION_END = /^(instructions?|directions?|method|steps?|notes?)\s*:?$/i;

function parseQuantity(qtyStr) {
  if (!qtyStr) return null;
  qtyStr = qtyStr.trim();
  if (qtyStr.includes('/')) {
    const parts = qtyStr.split(' ');
    let total = 0;
    for (const part of parts) {
      if (part.includes('/')) {
        const [num, denom] = part.split('/').map(Number);
        if (denom) total += num / denom;
      } else {
        total += Number(part) || 0;
      }
    }
    return total || null;
  }
  const n = Number(qtyStr);
  return Number.isFinite(n) ? n : null;
}

/** Pull just the ingredients-section lines out of the full page text. */
function extractIngredientBlock(rawText) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim());
  const startIdx = lines.findIndex((l) => SECTION_START.test(l));
  if (startIdx === -1) return lines.filter(Boolean); // fall back: scan everything
  const block = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (SECTION_END.test(lines[i])) break;
    if (lines[i]) block.push(lines[i]);
  }
  return block;
}

/**
 * @param {string} rawText - full extracted page text from Apryse TextExtractor
 * @returns {Array<{rawText: string, quantity: number|null, unit: string|null, name: string}>}
 */
function parseIngredients(rawText) {
  const lines = extractIngredientBlock(rawText);
  const results = [];

  for (const line of lines) {
    let rest = line;
    let quantity = null;
    let unit = null;

    const qtyMatch = rest.match(QTY_RE);
    if (qtyMatch) {
      quantity = parseQuantity(qtyMatch[1]);
      rest = rest.slice(qtyMatch[0].length).trim();
    }

    const tokens = rest.split(/\s+/);
    if (tokens.length && UNIT_RE.test(tokens[0])) {
      unit = tokens[0].toLowerCase();
      rest = tokens.slice(1).join(' ');
    }

    const name = normalizeIngredientName(rest);
    if (!name) continue;

    results.push({ rawText: line, quantity, unit, name });
  }

  return results;
}

module.exports = { parseIngredients, extractIngredientBlock };
