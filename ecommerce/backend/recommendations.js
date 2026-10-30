
const express = require('express');
const pool = require('./db');
const { runRecommendationWorkflow } = require('./recommendation-workflow');
const { normalizeSearchTerms } = require('./search-normalization');
const {
  getAvailableSubcategories,
  inferRequestedSubcategory,
  isSubcategorySelection,
  inferRequestedAudience,
  removeAudienceTerms,
} = require('./product-taxonomy');

const OLLAMA_URL =
  process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const GROQ_URL = process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const router = express.Router();

const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'best', 'buy', 'can', 'cheap', 'cheapest',
  'cost', 'costliest', 'costly', 'expensive', 'find', 'for', 'get', 'give',
  'good', 'i', 'is', 'latest', 'least', 'low', 'new', 'newest', 'collection',
  'higher', 'highest', 'high', 'lower', 'lowest', 'looking', 'me', 'most', 'need', 'of', 'please', 'price',
  'priced', 'recommend', 'series', 'below', 'budget', 'end', 'less', 'rating', 'ratings', 'rated',
  'star', 'stars', 'than', 'under', 'up', 'upto', 'within', 'plus',
  'show', 'some', 'suggest', 'tell', 'the', 'there', 'to', 'want',
  'what', 'which', 'with', 'you', 'know', 'expensively',
  'very', 'really', 'extremely', 'super', 'expensive', 'pricey', 'priciest',
  'rupee', 'rupees', 'rs', 'inr',
  'highly', 'topmost', 'strong', 'smooth', 'excellent', 'great', 'powerful',
  'quality', 'life',
  'one', 'two', 'three', 'four', 'five',
  'product', 'products', 'item', 'items', 'related',
  'cell', 'mobile', 'mobiles', 'phone', 'phones', 'smartphone', 'smartphones'
]);

const PREMIUM_SEARCH_TERMS = new Set([
  'end', 'flagship', 'high', 'premium', 'range', 'top'
]);

const CATEGORY_SEARCH_WORDS = {
  mobiles: new Set(['mobile', 'mobiles', 'phone', 'phones', 'smartphone', 'smartphones', 'cell']),
  electronics: new Set(['electronics', 'electronic', 'gadget', 'gadgets']),
  fashion: new Set(['fashion', 'clothes', 'clothing', 'apparel']),
  home: new Set(['home', 'kitchen', 'appliance', 'appliances']),
  beauty: new Set(['beauty', 'skincare', 'makeup', 'cosmetic', 'cosmetics']),
  shoes: new Set(['shoe', 'shoes', 'footwear', 'boot', 'boots'])
};

const FEATURE_PATTERNS = {
  camera: /\b(camera|cameras|lens|lenses|photography|photo quality)\b/i,
  battery: /\b(battery|batteries|battery life|battery capacity|mah)\b/i,
  gaming: /\b(gaming|game|games|gpu|graphics)\b/i,
  performance: /\b(performance|processor|chipset|cpu)\b/i,
  storage: /\b(storage|memory)\b/i,
  display: /\b(display|screen|amoled|oled|refresh rate)\b/i,
  waterproof: /\b(waterproof|water resistant|ip67|ip68)\b/i,
  lightweight: /\b(lightweight|light weight)\b/i,
};

function extractSearchTerms(keywords, budget, minRating, category) {
  const text = (Array.isArray(keywords)
    ? keywords.filter(item => typeof item === 'string').join(' ')
    : typeof keywords === 'string'
      ? keywords
      : '');
  const budgetText = budget === null ? '' : String(budget);
  const ratingText = minRating === null ? '' : String(minRating);
  const ratingWords = {
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five'
  };
  const ratingWord = ratingWords[ratingText];
  const categoryWords = CATEGORY_SEARCH_WORDS[category?.toLowerCase()];
  const terms = normalizeSearchTerms(text);
  const featureWords = new Set(Object.keys(FEATURE_PATTERNS));

  return [...new Set(terms.filter(term => (
    term.length > 1 &&
    !SEARCH_STOP_WORDS.has(term) &&
    !categoryWords?.has(term) &&
    !featureWords.has(term) &&
    term !== budgetText &&
    term !== ratingText &&
    term !== ratingWord
  )))];
}

function extractAlternativeSearchTermGroups(message, budget, minRating, category) {
  const groups = message
    .split(/\b(?:and|or)\b/i)
    .map(phrase => extractSearchTerms(phrase, budget, minRating, category))
    .filter(terms => terms.length > 0);

  return groups.length > 1 ? groups : [];
}

function inferRequestedFeatures(message) {
  return Object.entries(FEATURE_PATTERNS)
    .filter(([, pattern]) => pattern.test(message))
    .map(([feature]) => feature);
}

function inferPriceSort(message) {
  if (/\b(?:top[- ]range|high[- ]end|flagship|premium(?: range| phone| phones)?|most expensive|very expensive|extremely expensive|highest price|highest priced|high(?:est)?[- ]price|price high|expensive|costliest|priciest|maximum price|pricey)\b/i.test(message)) {
    return { sortBy: 'price', sortDirection: 'DESC' };
  }

  if (/\b(?:least expensive|lowest price|lowest priced|low(?:est)?[- ]price|price low|cheapest|least costly|minimum price|cheap(?:er)?)\b/i.test(message)) {
    return { sortBy: 'price', sortDirection: 'ASC' };
  }

  return null;
}

function requestsHighRatings(message) {
  return /\b(?:good|great|high|best|top)[ -]?(?:ratings?|rated|rating)(?:\b|$)|\b(?:good|great|best|top)[ -]rated\b/i.test(message);
}

function isFollowUpRequest(message) {
  return /\b(?:cheaper|cheapest|more|other|similar|same|those|them|these|ones|another|instead|higher|lower)\b/i.test(message);
}

function isPremiumSearch(message) {
  return /\b(?:top[- ]range|high[- ]end|flagship|premium)\b/i.test(message);
}

function parseAmount(message) {
  const match = message.match(
    /\b(?:under|below|less than|up to|upto|within|not more than|max(?:imum)?|budget(?: of)?)\s*[₹$]?\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|lakh|lac|crore|cr)?\b/i
  );

  if (!match) return null;

  const amount = Number(match[1].replace(/,/g, ''));
  const multiplier = {
    k: 1000,
    thousand: 1000,
    lakh: 100000,
    lac: 100000,
    crore: 10000000,
    cr: 10000000
  }[match[2]?.toLowerCase()] || 1;

  return Number.isFinite(amount) ? amount * multiplier : null;
}

function parseMinRating(message) {
  const match = message.match(
    /\b(?:at least|min(?:imum)?|rated|rating of)?\s*(\d(?:\.\d+)?|zero|one|two|three|four|five)\s*(?:\+|plus\b)?\s*(?:stars?(?:\s+ratings?)?|ratings?)\b/i
  );

  if (!match) return null;

  const wordRatings = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5
  };
  const rating = wordRatings[match[1].toLowerCase()] ?? Number(match[1]);
  return rating >= 0 && rating <= 5 ? rating : null;
}

function inferCategory(message, categories) {
  const text = message.toLowerCase();
  
const aliases = {
  mobiles: /\b(?:mobile|mobiles|phone|phones|smartphone|smartphones|cell phone|cell phones|iphone|iphones|android|samsung galaxy)\b/i,

  electronics: /\b(?:electronics?|gadgets?|headphones?|earphones?|earbuds?|airpods?|airdopes?|bluetooth|speaker|speakers|laptop|laptops|notebook|notebooks|computer|computers|keyboard|keyboards|mouse|mice|charger|chargers|power bank|power banks|camera|cameras|webcam|webcams|smartwatch|smartwatches|smart watch|smart watches|smart bulb|streaming devices?|ssd|storage devices?|hard drives?|adapter|adapters)\b/i,

  fashion: /\b(?:fashion|clothes|clothing|apparel|shirt|shirts|t-?shirts?|trousers|jeans|jacket|jackets|dress|dresses|outfit|outfits|kurta|kurtas|saree|sarees)\b/i,

  home: /\b(?:home|kitchen|appliances?|toaster|toasters|oven|ovens|fridge|fridges|refrigerator|refrigerators|washing machine|washing machines|washer|freezer|freezers|microwave|microwaves|mixer|mixers|blender|blenders|cookware|utensils|vacuum cleaner|vacuum cleaners)\b/i,

  beauty: /\b(?:beauty|skin[\s-]?care|makeup|cosmetics?|serums?|moisturi[sz]ers?|face[\s-]?wash(?:es)?|face[\s-]?cleansers?|shampoos?|conditioners?|hair care|sunscreens?|lipsticks?|lotions?|face creams?)\b/i,

  shoes: /\b(?:shoe|shoes|footwear|boot|boots|sneaker|sneakers|sandals?|slippers?|heels|loafers|running shoes|sports shoes)\b/i
};


  const inferred = Object.entries(aliases).find(([, pattern]) => pattern.test(text));
  if (!inferred) return '';

  return categories.find(item => item.toLowerCase() === inferred[0]) || '';
}

function getPriorSearchCriteria(context, categories) {
  const previousUserMessages = context
    .filter(item => item.role === 'user')
    .map(item => item.content);
  const latestMatching = (getValue) => {
    for (let index = previousUserMessages.length - 1; index >= 0; index -= 1) {
      const value = getValue(previousUserMessages[index]);
      if (Array.isArray(value) && !value.length) continue;
      if (value !== null && value !== undefined && value !== '') return value;
    }
    return null;
  };

  return {
    category: latestMatching(message => inferCategory(message, categories)),
    budget: latestMatching(message => parseAmount(message)),
    minRating: latestMatching(message => parseMinRating(message)),
    features: latestMatching(message => inferRequestedFeatures(message)),
  };
}

function isGreeting(message) {
  return /^(?:hi|hello|hey|howdy|good morning|good afternoon|good evening)(?: there)?[!.?,\s]*$/i.test(message);
}

function isCategoryListQuestion(message) {
  const simpleBrowseRequests = new Set([
    'category',
    'categories',
    'product category',
    'product categories',
    'product type',
    'product types',
    'products',
    'type of products',
    'types of products',
    'catalog',
  ]);
  const normalizedMessage = message.toLowerCase().replace(/[!?.,]/g, '').trim();
  return (
    simpleBrowseRequests.has(normalizedMessage) ||
    /\b(?:what|which|list|show)\b.{0,40}\b(?:categories|category)\b/i.test(message) ||
    /\b(?:categories|category)\b.{0,40}\b(?:available|there|store|catalog|have|offer)\b/i.test(message) ||
    /\b(?:sub[\s-]?categories?|categories?|product types?|types?)\s+(?:of|in|for)\b/i.test(message) ||
    /\b(?:what|which)\s+(?:are\s+)?(?:the\s+)?types?\s+of\s+products?\b/i.test(message) ||
    /\b(?:what|which)\s+products?\s+(?:do you have|are available|are there|do you sell)\b/i.test(message)
  );
}

function isCategoryListRequest(message) {
  return isCategoryListQuestion(message) &&
    !inferCategory(message, Object.keys(CATEGORY_SEARCH_WORDS));
}

function findSelectedCategory(message, categories) {
  const normalizedMessage = message.toLowerCase().trim();
  const exactCategory = categories.find(
    category => category.toLowerCase() === normalizedMessage
  );
  if (exactCategory) return exactCategory;

  for (const [categoryKey, aliases] of Object.entries(CATEGORY_SEARCH_WORDS)) {
    if (!aliases.has(normalizedMessage)) continue;
    return categories.find(category => category.toLowerCase() === categoryKey) || '';
  }

  if (isCategoryListQuestion(message)) {
    return inferCategory(message, categories);
  }

  return '';
}

function isThankYou(message) {
  return /^(?:okay[, ]*)?(?:thank you(?: so much| very much)?|thanks(?: a lot| so much)?|appreciate it)[!.?,\s]*$/i.test(message);
}

function normalizeContext(context) {
  if (!Array.isArray(context)) return [];

  return context
    .filter(item => (
      item &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.content === 'string'
    ))
    .slice(-10)
    .map(item => ({
      role: item.role,
      content: item.content.slice(0, 1000),
    }));
}

function getPreferencePrompt(categories) {
  return `
You are the query-understanding engine for an ecommerce product catalog.
Interpret the latest request using prior conversation turns when it is a follow-up.
Do not answer conversationally. Extract only search criteria for catalog filtering.
Catalog browsing requests (for example "categories", "products", "product types", "what types of products are there?") are not requests for product recommendations. Do not invent a product keyword, category, budget, or feature for these requests; the application will show available categories and product types as choices.
When the user enters only a category name (for example "shoes" or "home"), treat it as choosing that category to browse its available product types, not as a request to recommend random products.
Return one JSON object with exactly these fields:
- category: one exact category from the available categories, or null
- keywords: array of product identity words (brand, model, product type), not request wording
- features: array of canonical product capability labels (for example "camera", "battery", "gaming", "performance"); combine synonymous phrases into one label
- budget: maximum numeric price, or null
- minRating: minimum rating from 0 to 5, or null
- sortBy: "price", "rating", "reviews", or null
- sortDirection: "asc", "desc", or null

Available categories: ${JSON.stringify(categories)}
Rules:
- Resolve short follow-up requests (such as "cheaper ones") against the previous user and assistant turns.
- Keep the previous category/features when a follow-up only changes price, sort, or rating.
- Put product identity words in keywords. Put requested capabilities only in features, not keywords.
- Recognize audience wording including women, woman's, women's, womens, ladies, female, men, man's, men's, mens, gentlemen, and male.
- Audience is a strict catalog filter applied by the application, not a product keyword. Do not remove, broaden, or convert an audience constraint into an inferred category.
- Do not infer a category from audience-only requests; for example, "mens products" may match explicitly men-labelled products across the catalog.
- Include only features explicitly requested by the user; do not treat generic praise ("good", "strong", "smooth") as a feature by itself.
- Map "good camera" to "camera", "strong battery life" to "battery", and "smooth gaming performance" to "gaming" and/or "performance".
- Only return a feature as a filter when the user requested it; do not invent product features or catalog facts.
- Put price adjectives such as expensive/cheap in sortBy/sortDirection, never in keywords or features.
- "high price", "highest price", "most expensive", and "priciest" mean sortBy "price", sortDirection "desc".
- "low price", "lowest price", "cheapest", and "least expensive" mean sortBy "price", sortDirection "asc".
- Do not infer a price limit from words like high or expensive; only set budget when the user gives a numeric limit. A budget is a maximum price.
- Do not invent constraints. Return JSON only.
  `.trim();
}

function parsePreferenceResponse(content) {
  const preferences = typeof content === 'string' ? JSON.parse(content) : null;
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    throw new Error('LLM returned an invalid preference object.');
  }
  return preferences;
}

async function extractWithOllama(message, categories, context) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: 'json',
      messages: [
        {
          role: 'system',
          content: getPreferencePrompt(categories)
        },
        ...context,
        {
          role: 'user',
          content: message
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}`);
  }

  const result = await response.json();
  return parsePreferenceResponse(result.message?.content);
}

async function extractWithGroq(message, categories, context) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is required when LLM_PROVIDER is set to groq.');
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: getPreferencePrompt(categories) },
        ...context,
        { role: 'user', content: message },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq returned HTTP ${response.status}`);
  }

  const result = await response.json();
  return parsePreferenceResponse(result.choices?.[0]?.message?.content);
}

async function extractShoppingPreferences(message, categories, context) {
  try {
    return {
      preferences: await extractWithGroq(message, categories, context),
      provider: 'Groq',
    };
  } catch (groqError) {
    console.warn('Groq preference extraction failed; trying Ollama fallback:', groqError.message);

    try {
      return {
        preferences: await extractWithOllama(message, categories, context),
        provider: 'Ollama',
        fallback: true,
      };
    } catch (ollamaError) {
      throw new AggregateError(
        [groqError, ollamaError],
        `Groq and Ollama preference extraction both failed. Groq: ${groqError.message}; Ollama: ${ollamaError.message}`
      );
    }
  }
}

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const message =
      typeof body.message === 'string'
        ? body.message.trim().slice(0, 500)
        : '';
    const context = normalizeContext(body.context);

    if (message && isGreeting(message)) {
      return res.json({
        count: 0,
        recommendations: [],
        message: 'Hi! 👋 Welcome to Aro.D.Buy. What product are you looking for today? You can tell me a category, budget, or rating.'
      });
    }

    if (message && isThankYou(message)) {
      return res.json({
        count: 0,
        recommendations: [],
        message: "You're welcome! Let me know if you'd like help finding another product."
      });
    }

    let query = body.query ?? '';
    let budget = body.budget;
    let category = body.category;
    let minRating = body.minRating;
    let features = [];
    let notice;
    let explicitCategory = '';
    let subcategory = '';
    let sortBy = 'rating';
    let sortDirection = 'DESC';

    if (message) {
      const [categoryRows] = await pool.query(
        'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category'
      );

      const categories = categoryRows.map(row => row.category);
      if (isCategoryListRequest(message)) {
        return res.json({
          count: 0,
          recommendations: [],
          message: categories.length
            ? 'Here are the categories available. Choose one to see matching products:'
            : 'There are no product categories in the catalog yet.',
          categoryOptions: categories,
        });
      }

      const selectedCategory = findSelectedCategory(message, categories);
      if (selectedCategory && !isSubcategorySelection(message, selectedCategory)) {
        const [products] = await pool.query(
          `SELECT name, specifications
          FROM products
          WHERE LOWER(category) = LOWER(?)
          LIMIT 500`,
          [selectedCategory]
        );
        const subcategories = getAvailableSubcategories(products, selectedCategory);
        return res.json({
          count: 0,
          recommendations: [],
          message: subcategories.length
            ? `Choose a product type in ${selectedCategory} to see matching products:`
            : `There are no classified product types in ${selectedCategory} yet.`,
          categoryOptions: subcategories,
        });
      }

      explicitCategory = inferCategory(message, categories);
      const requestedAudience = inferRequestedAudience(message);
      const followUp = isFollowUpRequest(message);
      const priorCriteria = followUp
        ? getPriorSearchCriteria(context, categories)
        : { category: null, budget: null, minRating: null, features: null };
      let preferences = {};

      try {
        const result = await extractShoppingPreferences(
          message,
          categories,
          followUp ? context : []
        );
        preferences = result.preferences;
        if (result.fallback) {
          notice = 'Groq is unavailable, so Ollama was used to understand your search.';
        }
      } catch (error) {
        console.warn(
          'Groq and Ollama preference extraction failed; using local product matching:',
          error.message
        );
        notice = 'Groq and Ollama are unavailable, so basic product matching was used.';
      }

      query = Array.isArray(preferences.keywords)
        ? preferences.keywords.filter(item => typeof item === 'string').slice(0, 12)
        : typeof preferences.keywords === 'string'
          ? preferences.keywords
          : message;
      if (requestedAudience) {
        query = removeAudienceTerms(message);
      }
      features = [...new Set([
        ...inferRequestedFeatures(message),
        ...(followUp && Array.isArray(preferences.features)
          ? preferences.features
            .filter(item => typeof item === 'string')
            .map(item => item.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 8)
          : []),
      ])];
      if (!features.length && priorCriteria.features) {
        features = priorCriteria.features;
      }
      const modelCategory = typeof preferences.category === 'string'
        ? categories.find(item => item.toLowerCase() === preferences.category.trim().toLowerCase())
        : '';
      category = explicitCategory || (requestedAudience ? '' : modelCategory) || priorCriteria.category || '';
      subcategory = inferRequestedSubcategory(message, category);
      if (isSubcategorySelection(message, category)) {
        query = [];
      }

      const modelSortBy = ['price', 'rating', 'reviews'].includes(preferences.sortBy)
        ? preferences.sortBy
        : '';
      const modelSortDirection = ['ASC', 'DESC'].includes(String(preferences.sortDirection).toUpperCase())
        ? String(preferences.sortDirection).toUpperCase()
        : '';
      const explicitPriceSort = inferPriceSort(message);
      const ratingSort = requestsHighRatings(message);
      sortBy = explicitPriceSort?.sortBy || (ratingSort ? 'rating' : modelSortBy) || 'rating';
      sortDirection = explicitPriceSort?.sortDirection || (ratingSort ? 'DESC' : modelSortDirection) || 'DESC';
      if (/\b(?:new|newest|latest)\s+(?:product|products|collection|arrivals?)\b/i.test(message)) {
        notice = [
          notice,
          'The catalog does not track product release dates, so I sorted matching products by rating rather than verified newness.',
        ].filter(Boolean).join(' ');
      }

      const parsedBudget =
        preferences.budget !== undefined &&
        preferences.budget !== null &&
        preferences.budget !== ''
          ? Number(preferences.budget)
          : null;
      const hasBudgetConstraint =
        /\b(?:under|below|less than|up to|upto|within|not more than|max(?:imum)?|budget)\b/i.test(message);
      const parsedMessageBudget = parseAmount(message);
      budget = parsedMessageBudget ?? (
        hasBudgetConstraint &&
        parsedBudget !== null &&
        Number.isFinite(parsedBudget) &&
        parsedBudget >= 0
          ? parsedBudget
          : hasBudgetConstraint
            ? null
            : followUp
              ? priorCriteria.budget
              : null
      );

      const parsedRating =
        preferences.minRating !== undefined &&
        preferences.minRating !== null &&
        preferences.minRating !== ''
          ? Number(preferences.minRating)
          : null;
      const hasRatingConstraint = /\b(?:star|rating|rated)\b/i.test(message);
      const parsedMessageRating = parseMinRating(message);
      minRating = parsedMessageRating ?? (
        hasRatingConstraint &&
        parsedRating !== null &&
        Number.isFinite(parsedRating) &&
        parsedRating >= 0 &&
        parsedRating <= 5
          ? parsedRating
          : hasRatingConstraint
            ? null
            : followUp
              ? parsedRating ?? priorCriteria.minRating
              : null
      );
    }

    const searchQuery =
      typeof query === 'string' || Array.isArray(query)
        ? query
        : '';

    const normalizedCategory =
      typeof category === 'string' ? category.trim().slice(0, 100) : '';

    const maxBudget =
      budget !== undefined && budget !== null && budget !== ''
        ? Number(budget)
        : null;

    const rating =
      minRating !== undefined && minRating !== null && minRating !== ''
        ? Number(minRating)
        : null;

    if (
      maxBudget !== null &&
      (!Number.isFinite(maxBudget) || maxBudget < 0)
    ) {
      return res.status(400).json({
        message: 'Budget must be a valid non-negative number.'
      });
    }

    if (
      rating !== null &&
      (!Number.isFinite(rating) || rating < 0 || rating > 5)
    ) {
      return res.status(400).json({
        message: 'Minimum rating must be between 0 and 5.'
      });
    }

    const subcategorySelection = isSubcategorySelection(message, normalizedCategory);
    const searchTerms = subcategorySelection
      ? []
      : extractSearchTerms(
        searchQuery,
        maxBudget,
        rating,
        normalizedCategory
      ).filter(term => !isPremiumSearch(message) || !PREMIUM_SEARCH_TERMS.has(term));
    const alternativeSearchTermGroups = message && !subcategorySelection
      ? extractAlternativeSearchTermGroups(message, maxBudget, rating, normalizedCategory)
      : [];
    const workflowResult = await runRecommendationWorkflow({
      criteria: {
        category: normalizedCategory,
        subcategory,
        audience: inferRequestedAudience(message),
        maxBudget,
        minRating: rating,
      },
      searchTerms,
      searchTermGroups: alternativeSearchTermGroups.length > 1
        ? alternativeSearchTermGroups
        : searchTerms.length
          ? [searchTerms]
          : [],
      features,
      sortBy,
      sortDirection,
    });

    return res.json({
      count: workflowResult.recommendations.length,
      recommendations: workflowResult.recommendations,
      ...(workflowResult.responseMessage ? { message: workflowResult.responseMessage } : {}),
      ...(notice ? { notice } : {})
    });
  } catch (error) {
    console.error('Recommendations error:', error.message);

    return res.status(500).json({
      message: 'Failed to generate product recommendations.'
    });
  }
});


module.exports = router;
module.exports.extractAlternativeSearchTermGroups = extractAlternativeSearchTermGroups;
module.exports.isCategoryListRequest = isCategoryListRequest;
module.exports.findSelectedCategory = findSelectedCategory;
