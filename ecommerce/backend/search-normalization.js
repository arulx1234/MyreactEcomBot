const SEARCH_SYNONYMS = [
  [/\b(?:fridges?|refrigerators?)\b/gi, 'fridge'],
  [/\b(?:earphones?|airdopes?|airdobes?|airpods?)\b/gi, 'earbuds'],
  [/\bnotebooks?\b/gi, 'laptop'],
  [/\bmoisturisers?\b/gi, 'moisturizer'],
  [/\bsmart[\s-]?watch(?:es)?\b/gi, 'smartwatch'],
  [/\bpower[\s-]?banks?\b/gi, 'powerbank'],
  [/\bface[\s-]?wash(?:es)?\b/gi, 'face cleanser'],
  [/\b(?:tosters?|toasters?)\b/gi, 'toaster'],
  [/\b(?:avacado|avocado)\b/gi, 'avocado'],
  [/\bshirts\b/gi, 'shirt'],
];

function normalizeSearchText(text) {
  return SEARCH_SYNONYMS.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    text.toLowerCase()
  );
}

function normalizeSearchTerms(text) {
  return normalizeSearchText(text).match(/[\p{L}\p{N}]+/gu) || [];
}

module.exports = { normalizeSearchText, normalizeSearchTerms };
