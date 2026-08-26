/**
 * Prep instructions and descriptors that appear alongside an ingredient but
 * aren't part of its name ("2 cups shredded, cooked chicken breast" -> "chicken
 * breast"). Removed as whole words wherever they occur so we don't rely on
 * where the comma falls.
 */
const PREP_WORDS = new Set([
  // prep participles
  'chopped', 'diced', 'sliced', 'minced', 'grated', 'shredded', 'drained',
  'trimmed', 'cooked', 'uncooked', 'melted', 'softened', 'beaten', 'crushed',
  'peeled', 'seeded', 'deseeded', 'halved', 'quartered', 'cubed', 'ground',
  'crumbled', 'toasted', 'roasted', 'cooled', 'rinsed', 'dried', 'mashed',
  'sifted', 'warmed', 'chilled',
  // size / quality descriptors
  'fresh', 'frozen', 'large', 'small', 'medium', 'ripe', 'boneless',
  'skinless', 'lean', 'thinly', 'finely', 'roughly', 'coarsely', 'tops', 'extra',
]);

/**
 * Turns raw ingredient text ("2 cups shredded, cooked chicken breast") into a
 * canonical name ("chicken breast") used to match recipes against what the user
 * has on hand.
 *
 * This is a simple heuristic. Swap in a real NLP/LLM step here if you need
 * better handling of brand names, substitutions, or multi-word units.
 */
function normalizeIngredientName(raw) {
  let s = raw
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ') // drop parenthetical notes e.g. "(500g each)"
    .replace(/[^a-z\s-]/g, ' ') // strip punctuation/numbers (commas included)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(a|an|the)\s+/, ''); // drop a leading article

  // Drop prep/descriptor words wherever they appear, keeping the real name.
  s = s
    .split(' ')
    .filter((word) => word && !PREP_WORDS.has(word))
    .join(' ')
    .trim();

  return s.replace(/s$/, ''); // naive de-pluralization
}

module.exports = { normalizeIngredientName };
