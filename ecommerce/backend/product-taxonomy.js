const { normalizeSearchText } = require('./search-normalization');

const WOMEN_AUDIENCE_PATTERN = /\b(?:women(?:'s|s)?|woman(?:'s)?|lad(?:y|ies)|female)\b/i;
const MEN_AUDIENCE_PATTERN = /\b(?:men(?:'s|s)?|man(?:'s)?|gentlemen|gentleman|males?)\b/i;

const PRODUCT_SUBCATEGORIES = {
  mobiles: [
    { name: 'iPhones', pattern: /\b(?:iphones?|ios)\b/i },
    { name: 'Android phones', pattern: /\b(?:android|samsung galaxy)\b/i },
    { name: '5G phones', pattern: /\b5g\b/i },
    { name: 'Smartphones', pattern: /\b(?:smartphones?|iphones?|android phones?|mobile phones?|phones?|mobiles?|samsung galaxy)\b/i },
    { name: 'Mobile accessories', pattern: /\b(?:phone cases?|screen protectors?|phone chargers?|mobile accessories)\b/i },
  ],
  electronics: [
    { name: 'Laptop accessories', pattern: /\b(?:laptop cooling pads?|laptop stands?|laptop bags?|laptop sleeves?)\b/i },
    { name: 'Laptops', pattern: /\b(?:laptops?|notebooks?)\b/i },
    { name: 'Headphones and earphones', pattern: /\b(?:headphones?|earphones?|earbuds?|airdopes?|airdobes?|airpods?)\b/i },
    { name: 'Speakers', pattern: /\b(?:speakers?|soundbars?)\b/i },
    { name: 'Smartwatches and fitness bands', pattern: /\b(?:smart[\s-]?watch(?:es)?|fitness bands?)\b/i },
    { name: 'Keyboards and mice', pattern: /\b(?:keyboards?|mice|computer mice|mouses?)\b/i },
    { name: 'Chargers and adapters', pattern: /\b(?:chargers?|power ?banks?|usb hubs?|adapters?)\b/i },
    { name: 'Storage devices', pattern: /\b(?:ssds?|hard drives?|memory cards?|flash drives?)\b/i },
    { name: 'Webcams and cameras', pattern: /\b(?:webcams?|cameras?)\b/i },
    { name: 'Smart home and streaming devices', pattern: /\b(?:smart (?:led )?bulbs?|streaming devices?|hdmi devices?)\b/i },
  ],
  fashion: [
    { name: 'T-shirts', pattern: /\bt[\s-]?shirts?\b/i },
    { name: 'Shirts and tops', pattern: /\b(?:shirts?|tops?)\b/i },
    { name: 'Trousers and jeans', pattern: /\b(?:trousers?|jeans?|chinos?)\b/i },
    { name: 'Leggings', pattern: /\bleggings?\b/i },
    { name: 'Dresses', pattern: /\b(?:dress(?:es)?|kurtis?)\b/i },
    { name: 'Ethnic wear', pattern: /\b(?:ethnic wear|sarees?|kurtas?)\b/i },
    { name: 'Hoodies and sweatshirts', pattern: /\b(?:hoodies?|sweatshirts?)\b/i },
    { name: 'Outfits', pattern: /\boutfits?\b/i },
  ],
  home: [
    { name: 'Washing machines', pattern: /\b(?:washing machines?|washers?)\b/i },
    { name: 'Refrigerators', pattern: /\b(?:fridges?|refrigerators?|freezers?)\b/i },
    { name: 'Ovens and microwaves', pattern: /\b(?:ovens?|microwaves?)\b/i },
    { name: 'Toasters', pattern: /\btoasters?\b/i },
    { name: 'Kitchen appliances', pattern: /\b(?:kettles?|mixer grinders?|blenders?|induction cooktops?|air fryers?|kitchen scales?)\b/i },
    { name: 'Cooling and fans', pattern: /\b(?:air coolers?|table fans?|ceiling fans?)\b/i },
    { name: 'Cleaning appliances', pattern: /\b(?:vacuum cleaners?)\b/i },
    { name: 'Water purifiers', pattern: /\bwater purifiers?\b/i },
    { name: 'Cookware', pattern: /\b(?:cookware|utensils|cookware sets?)\b/i },
    { name: 'Home storage', pattern: /\b(?:storage organizers?|organizer sets?)\b/i },
  ],
  beauty: [
    { name: 'Hair care', pattern: /\b(?:hair(?:\s+\w+){0,2}\s+serums?|shampoos?|conditioners?|hair oils?|hair care)\b/i },
    { name: 'Skincare', pattern: /\b(?:skin[\s-]?care|moisturizers?|face creams?|face cleansers?|face scrubs?|face masks?|sunscreens?|skin gels?|toners?|serums?|under eye creams?)\b/i },
    { name: 'Makeup and beauty tools', pattern: /\b(?:makeup|makeup brushes?)\b/i },
    { name: 'Body care', pattern: /\b(?:body lotions?|body care)\b/i },
  ],
  shoes: [
    { name: 'Running and sports shoes', pattern: /\b(?:running|sports|training) (?:shoes?|sneakers?)\b/i },
    { name: 'Walking shoes', pattern: /\bwalking shoes?\b/i },
    { name: 'Outdoor and trekking shoes', pattern: /\b(?:outdoor|trekking|hiking) shoes?\b/i },
    { name: 'Sneakers', pattern: /\bsneakers?\b/i },
    { name: 'Formal shoes', pattern: /\bformal (?:leather )?shoes?\b/i },
    { name: 'Boots', pattern: /\bboots?\b/i },
    { name: 'Sandals and slippers', pattern: /\b(?:sandals?|slippers?)\b/i },
    { name: 'Loafers', pattern: /\bloafers?\b/i },
    { name: 'Casual shoes', pattern: /\b(?:casual )?(?:shoes?|slip[ -]?on shoes?|canvas shoes?)\b/i },
  ],
};

function getProductSubcategories(value, category) {
  const subcategories = PRODUCT_SUBCATEGORIES[category?.toLowerCase()];
  if (!subcategories) return [];

  const specifications = value?.specifications;
  const specificationText = typeof specifications === 'string'
    ? specifications
    : JSON.stringify(specifications || '');
  const text = normalizeSearchText(typeof value === 'string'
    ? value
    : [value?.name, specificationText].filter(Boolean).join(' '));
  const matches = subcategories.filter(subcategory => subcategory.pattern.test(text));
  return category.toLowerCase() === 'mobiles'
    ? matches.map(subcategory => subcategory.name)
    : matches.slice(0, 1).map(subcategory => subcategory.name);
}

function getProductSubcategory(value, category) {
  return getProductSubcategories(value, category)[0] || '';
}

function getAvailableSubcategories(products, category) {
  const available = new Set(
    products
      .flatMap(product => getProductSubcategories(product, category))
  );
  return (PRODUCT_SUBCATEGORIES[category?.toLowerCase()] || [])
    .map(subcategory => subcategory.name)
    .filter(name => available.has(name));
}

function inferRequestedSubcategory(message, category) {
  const subcategories = PRODUCT_SUBCATEGORIES[category?.toLowerCase()] || [];
  const normalizedMessage = normalizeSearchText(message).trim();
  const selectedSubcategory = subcategories.find(
    subcategory => normalizeSearchText(subcategory.name).trim() === normalizedMessage
  );
  if (selectedSubcategory) return selectedSubcategory.name;

  return getProductSubcategory(message, category);
}

function isSubcategorySelection(message, category) {
  const subcategory = inferRequestedSubcategory(message, category);
  if (!subcategory) return false;

  const browseWords = /\b(?:find|show|search|looking for|want|need|give me|i|me|products?|items?|available|in|the|please)\b/gi;
  const normalizedMessage = normalizeSearchText(message)
    .replace(browseWords, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s-]/g, '');
  const normalizedSubcategory = normalizeSearchText(subcategory)
    .trim()
    .replace(/[\s-]/g, '');

  return normalizedMessage === normalizedSubcategory;
}

function matchesProductSubcategory(product, category, subcategory) {
  return getProductSubcategories(product, category).includes(subcategory);
}

function inferRequestedAudience(message) {
  const text = normalizeSearchText(message);
  const requestsWomen = WOMEN_AUDIENCE_PATTERN.test(text);
  const requestsMen = MEN_AUDIENCE_PATTERN.test(text);

  if (requestsWomen === requestsMen) return '';
  return requestsWomen ? 'women' : 'men';
}

function removeAudienceTerms(message) {
  return String(message || '').replace(
    /\b(?:women(?:'s|s)?|woman(?:'s)?|lad(?:y|ies)|female|men(?:'s|s)?|man(?:'s)?|gentlemen|gentleman|males?)\b/gi,
    ' '
  ).replace(/\s+/g, ' ').trim();
}

function matchesProductAudience(product, audience) {
  if (!audience) return true;

  const text = normalizeSearchText([
    product?.name,
    typeof product?.specifications === 'string'
      ? product.specifications
      : JSON.stringify(product?.specifications || ''),
  ].filter(Boolean).join(' '));
  const womenLabelled = WOMEN_AUDIENCE_PATTERN.test(text);
  const menLabelled = MEN_AUDIENCE_PATTERN.test(text);

  return audience === 'women'
    ? womenLabelled && !menLabelled
    : audience === 'men' && menLabelled && !womenLabelled;
}

module.exports = {
  getAvailableSubcategories,
  getProductSubcategories,
  getProductSubcategory,
  matchesProductSubcategory,
  inferRequestedSubcategory,
  isSubcategorySelection,
  inferRequestedAudience,
  removeAudienceTerms,
  matchesProductAudience,
};
