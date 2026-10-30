const { Annotation, END, START, StateGraph } = require('@langchain/langgraph');
const pool = require('./db');
const { normalizeSearchText, normalizeSearchTerms } = require('./search-normalization');
const {
  matchesProductSubcategory,
  matchesProductAudience,
} = require('./product-taxonomy');

const normalizeSpecifications = (specifications) => {
  if (Array.isArray(specifications)) {
    return specifications.filter(item => typeof item === 'string').join(' ').toLowerCase();
  }

  if (typeof specifications === 'string') {
    try {
      return normalizeSpecifications(JSON.parse(specifications));
    } catch {
      return specifications.toLowerCase();
    }
  }

  if (specifications && typeof specifications === 'object') {
    return Object.entries(specifications)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(' ') : value}`)
      .join(' ')
      .toLowerCase();
  }

  return '';
}

function getProductDetails(product) {
  if (product.details && typeof product.details === 'object' && !Array.isArray(product.details)) {
    return product.details;
  }
  if (typeof product.details !== 'string') return {};

  try {
    const details = JSON.parse(product.details);
    return details && typeof details === 'object' && !Array.isArray(details)
      ? details
      : {};
  } catch {
    return {};
  }
}

function getSearchableProductText(product) {
  const details = getProductDetails(product);
  const specifications = details.dataQuality?.verificationStatus === 'demo_placeholder'
    ? ''
    : normalizeSpecifications(product.specifications);
  const searchMetadata = [
    details.brand,
    details.model,
    details.searchKeywords,
    details.tags,
    product.searchKeywords,
  ].flatMap(value => Array.isArray(value) ? value : [value])
    .filter(value => typeof value === 'string')
    .join(' ');

  return normalizeSearchText([
    product.name,
    specifications,
    searchMetadata,
  ].filter(Boolean).join(' '));
}

const featurePatterns = {
  camera: /\b(camera|cameras|lens|lenses|photography|photo quality)\b/i,
  battery: /\b(battery|batteries|battery life|battery capacity|mah)\b/i,
  gaming: /\b(gaming|game|games|gpu|graphics)\b/i,
  performance: /\b(performance|processor|chipset|cpu)\b/i,
  storage: /\b(storage|memory|gb|tb)\b/i,
  display: /\b(display|screen|amoled|oled)\b/i,
  waterproof: /\b(waterproof|water resistant|ip67|ip68)\b/i,
  lightweight: /\b(lightweight|light weight)\b/i,
};

function normalizeFeature(feature) {
  const value = feature.toLowerCase().trim();
  if (/\b(camera|cameras|lens|lenses|photography)\b/.test(value)) return 'camera';
  if (/\b(battery|batteries|mah)\b/.test(value)) return 'battery';
  if (/\b(gaming|game|games|gpu|graphics)\b/.test(value)) return 'gaming';
  if (/\b(performance|processor|chipset|cpu)\b/.test(value)) return 'performance';
  if (/\b(storage|memory|gb|tb)\b/.test(value)) return 'storage';
  if (/\b(display|screen|amoled|oled)\b/.test(value)) return 'display';
  if (/\b(waterproof|water resistant|ip67|ip68)\b/.test(value)) return 'waterproof';
  if (/\b(lightweight|light weight)\b/.test(value)) return 'lightweight';
  return value;
}

function featureMatches(specificationText, feature) {
  const matcher = featurePatterns[feature];
  return matcher ? matcher.test(specificationText) : specificationText.includes(feature);
}

function matchesSearchTermGroups(product, searchTermGroups) {
  const productText = getSearchableProductText(product);

  return searchTermGroups.some(group => (
    group.length > 0 &&
    group.every(term => normalizeSearchTerms(term).every(normalizedTerm => (
      productText.includes(normalizedTerm)
    )))
  ));
}

const RecommendationState = Annotation.Root({
  criteria: Annotation(),
  searchTerms: Annotation(),
  searchTermGroups: Annotation(),
  features: Annotation(),
  sortBy: Annotation(),
  sortDirection: Annotation(),
  candidates: Annotation(),
  candidateFeatureData: Annotation(),
  rankedProducts: Annotation(),
  recommendations: Annotation(),
  responseMessage: Annotation(),
});

async function retrieveProducts(state) {
  const { category, maxBudget, minRating } = state.criteria;
  const conditions = [];
  const params = [];

  if (maxBudget !== null) {
    conditions.push('price <= ?');
    params.push(maxBudget);
  }

  if (category) {
    conditions.push('LOWER(category) = LOWER(?)');
    params.push(category);
  }

  if (minRating !== null) {
    conditions.push('rating >= ?');
    params.push(minRating);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';
  const [candidates] = await pool.query(
    `SELECT
      id,
      name,
      price,
      old_price AS oldPrice,
      category,
      image,
      discount,
      rating,
      reviews,
      specifications,
      details
    FROM products
    ${whereClause}
    LIMIT 500`,
    params
  );

  return { candidates };
}

function rankProducts(state) {
  const {
    criteria,
    candidates,
    features,
    searchTerms,
    searchTermGroups = searchTerms.length ? [searchTerms] : [],
  } = state;
  const requestedSubcategory = criteria.subcategory || '';
  const audienceCandidates = criteria.audience
    ? candidates.filter(product => matchesProductAudience(product, criteria.audience))
    : candidates;
  const categoryCandidates = requestedSubcategory
    ? audienceCandidates.filter(product => (
        matchesProductSubcategory(product, criteria.category, requestedSubcategory)
      ))
    : audienceCandidates;
  const normalizedFeatures = [...new Set(features.map(normalizeFeature))];
  const productText = product => (
    getSearchableProductText(product)
  );
  const matchesKeywords = product => (
    !searchTermGroups.length || matchesSearchTermGroups(product, searchTermGroups)
  );
  const matchesFeatures = product => {
    const text = productText(product);
    return normalizedFeatures.every(feature => featureMatches(text, feature));
  };
  const matchingProducts = categoryCandidates.filter(product => (
    matchesKeywords(product) && matchesFeatures(product)
  ));
  const candidateFeatureData = categoryCandidates.some(product => {
    const details = getProductDetails(product);
    return details.dataQuality?.verificationStatus !== 'demo_placeholder' &&
      normalizeSpecifications(product.specifications).length > 0;
  });
  const sortColumns = {
    price: 'price',
    rating: 'rating',
    reviews: 'reviews',
  };
  const sortField = sortColumns[state.sortBy] || 'rating';
  const sortMultiplier = state.sortDirection === 'ASC' ? 1 : -1;
  const sortProducts = products => products.sort((left, right) => (
    (Number(left[sortField]) - Number(right[sortField])) * sortMultiplier ||
    Number(right.rating) - Number(left.rating) ||
    Number(right.reviews) - Number(left.reviews)
  ));

  let products = sortProducts(matchingProducts).slice(0, 5);
  let responseMessage;

  if (!products.length && normalizedFeatures.length && categoryCandidates.length) {
    const identityMatches = categoryCandidates.filter(matchesKeywords);
    products = sortProducts(identityMatches.length ? identityMatches : categoryCandidates).slice(0, 5);
    responseMessage = candidateFeatureData
      ? 'No products matched all the requested features in their saved specifications. Showing products that match the product and price criteria; add verified specs in Admin to improve feature matching.'
      : 'The catalog has no verified specifications for the requested features yet. Showing products that match the product and price criteria instead.';
  } else if (!products.length && requestedSubcategory && !categoryCandidates.length) {
    const budgetMessage = criteria.maxBudget !== null
      ? ` under ₹${criteria.maxBudget.toLocaleString('en-IN')}`
      : '';
    responseMessage = `No matching products in the ${requestedSubcategory} subcategory are available${budgetMessage} in the ${criteria.category} category.`;
  } else if (!products.length && criteria.audience && !audienceCandidates.length) {
    responseMessage = `No products explicitly listed for ${criteria.audience} are currently available in the catalog.`;
  } else if (!products.length && !candidates.length) {
    responseMessage = criteria.maxBudget !== null
      ? `No products in the ${criteria.category || 'catalog'} category are available under ₹${criteria.maxBudget.toLocaleString('en-IN')}. Try increasing your budget.`
      : 'No products match those search criteria. Try another product or category.';
  } else if (!products.length && searchTermGroups.length) {
    responseMessage = 'No product names or saved specifications match those search terms. Try a broader product description.';
  } else if (!products.length && !criteria.category && !searchTerms.length) {
    responseMessage = 'Tell me which type of product you are looking for, such as phones, shoes, or electronics.';
  }

  return {
    candidateFeatureData,
    rankedProducts: products,
    responseMessage,
  };
}

function recommendProducts(state) {
  return { recommendations: state.rankedProducts };
}

const recommendationWorkflow = new StateGraph(RecommendationState)
  .addNode('retrieve_products', retrieveProducts)
  .addNode('rank_products', rankProducts)
  .addNode('generate_recommendation', recommendProducts)
  .addEdge(START, 'retrieve_products')
  .addEdge('retrieve_products', 'rank_products')
  .addEdge('rank_products', 'generate_recommendation')
  .addEdge('generate_recommendation', END)
  .compile();

async function runRecommendationWorkflow(input) {
  return recommendationWorkflow.invoke({
    ...input,
    candidates: [],
    candidateFeatureData: false,
    rankedProducts: [],
    recommendations: [],
    responseMessage: '',
  });
}

module.exports = { matchesSearchTermGroups, rankProducts, runRecommendationWorkflow };
