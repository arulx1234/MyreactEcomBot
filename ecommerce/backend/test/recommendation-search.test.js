const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  matchesSearchTermGroups,
  rankProducts,
} = require('../recommendation-workflow');
const {
  getAvailableSubcategories,
  getProductSubcategory,
  getProductSubcategories,
  inferRequestedSubcategory,
  isSubcategorySelection,
  matchesProductSubcategory,
  inferRequestedAudience,
  removeAudienceTerms,
  matchesProductAudience,
} = require('../product-taxonomy');
const {
  extractAlternativeSearchTermGroups,
  findSelectedCategory,
  isCategoryListRequest,
} = require('../recommendations');

const conditioner = {
  name: 'Nourishing Hair Conditioner',
  specifications: ['productType: Nourishing Hair Conditioner'],
};
const serum = {
  name: 'Hair Repair Serum',
  specifications: ['productType: Hair Repair Serum'],
};
const shampoo = {
  name: 'Herbal Hair Shampoo',
  specifications: ['productType: Herbal Hair Shampoo'],
};

test('alternative product types match independently instead of requiring both', () => {
  const groups = extractAlternativeSearchTermGroups(
    'give me good hair conditioner and hair serum under 500 rupees',
    500,
    null,
    'beauty'
  );

  assert.deepEqual(groups, [
    ['hair', 'conditioner'],
    ['hair', 'serum'],
  ]);
  assert.equal(matchesSearchTermGroups(conditioner, groups), true);
  assert.equal(matchesSearchTermGroups(serum, groups), true);
  assert.equal(matchesSearchTermGroups(shampoo, groups), false);
});

test('words within one product phrase remain conjunctive', () => {
  const group = [['hair', 'conditioner', 'serum']];

  assert.equal(matchesSearchTermGroups(conditioner, group), false);
  assert.equal(matchesSearchTermGroups(serum, group), false);
});

test('assistant search matches product metadata and category synonyms', () => {
  const product = {
    name: 'Samsung Galaxy Smartphone',
    category: 'mobiles',
    specifications: ['operatingSystem: Android with Samsung One UI'],
    details: JSON.stringify({
      brand: 'Samsung',
      model: 'Galaxy Smartphone',
      searchKeywords: ['android phone', 'handset', 'cell phone'],
      tags: ['mobiles'],
    }),
  };

  assert.equal(matchesSearchTermGroups(product, [['handset']]), true);
  assert.equal(matchesSearchTermGroups(product, [['cell'], ['phone']]), true);
  assert.equal(matchesSearchTermGroups(product, [['samsung'], ['galaxy']]), true);
});

test('assistant search does not treat demo placeholder specs as verified capabilities', () => {
  const product = {
    name: 'Samsung Galaxy Smartphone',
    specifications: ['batteryCapacity: Illustrative sample (unverified): 6000mAh'],
    details: {
      brand: 'Samsung',
      model: 'Galaxy Smartphone',
      searchKeywords: ['android phone', 'handset'],
      dataQuality: { verificationStatus: 'demo_placeholder' },
    },
  };

  assert.equal(matchesSearchTermGroups(product, [['handset']]), true);
  assert.equal(matchesSearchTermGroups(product, [['6000mah']]), false);
});

test('a conjunction with a rating constraint is not treated as a product alternative', () => {
  const groups = extractAlternativeSearchTermGroups(
    'hair conditioner and high rating',
    null,
    4,
    'beauty'
  );

  assert.deepEqual(groups, []);
});

test('category taxonomy exposes product types that exist in the catalog', () => {
  const products = [
    { name: 'Double Door Refrigerator' },
    { name: 'Bread toster' },
    { name: 'Front Load Washing Machine' },
  ];

  assert.deepEqual(getAvailableSubcategories(products, 'home'), [
    'Washing machines',
    'Refrigerators',
    'Toasters',
  ]);
});

test('known beauty, fashion and shoe products map to the appropriate subcategories', () => {
  assert.equal(getProductSubcategory('Hair Repair Serum', 'beauty'), 'Hair care');
  assert.equal(getProductSubcategory('Hair Oil Treatment', 'beauty'), 'Hair care');
  assert.equal(getProductSubcategory('Makeup Brush Set', 'beauty'), 'Makeup and beauty tools');
  assert.equal(getProductSubcategory('Vitamin C Face Serum', 'beauty'), 'Skincare');
  assert.equal(getProductSubcategory("Men's Casual T-Shirt", 'fashion'), 'T-shirts');
  assert.equal(getProductSubcategory("Women's Running Sneakers", 'shoes'), 'Running and sports shoes');
  assert.equal(getProductSubcategory("Women's Walking Shoes", 'shoes'), 'Walking shoes');
  assert.equal(getProductSubcategory('Outdoor Trekking Shoes', 'shoes'), 'Outdoor and trekking shoes');
});

test('mobile taxonomy exposes useful overlapping phone types from catalog data', () => {
  const products = [
    { name: 'iPhone 17', specifications: { operatingSystem: 'iOS', network: '5G' } },
    { name: 'Samsung Galaxy S26', specifications: { operatingSystem: 'Android', network: '5G' } },
    { name: 'Budget Android Phone', specifications: { operatingSystem: 'Android' } },
  ];

  assert.deepEqual(getAvailableSubcategories(products, 'mobiles'), [
    'iPhones',
    'Android phones',
    '5G phones',
    'Smartphones',
  ]);
  assert.deepEqual(getProductSubcategories(products[0], 'mobiles'), [
    'iPhones',
    '5G phones',
    'Smartphones',
  ]);
  assert.equal(isSubcategorySelection('Smartphones', 'mobiles'), true);
  assert.equal(isSubcategorySelection('iPhones', 'mobiles'), true);
  assert.equal(isSubcategorySelection('Android phones', 'mobiles'), true);
  assert.equal(findSelectedCategory('Smartphones', ['mobiles']), 'mobiles');
});

test('mobile subcategory selections return only matching products', () => {
  const products = [
    { name: 'iPhone 17', specifications: ['operatingSystem: iOS', 'network: 5G'] },
    { name: 'Samsung Galaxy S26', specifications: ['operatingSystem: Android', 'network: 5G'] },
    { name: 'Budget Android Phone', specifications: ['operatingSystem: Android'] },
  ].map((product, index) => ({
    ...product,
    price: 500 + index,
    rating: 4,
    reviews: 10,
  }));
  const result = rankProducts({
    criteria: {
      category: 'mobiles',
      subcategory: inferRequestedSubcategory('iPhones', 'mobiles'),
      maxBudget: null,
      minRating: null,
    },
    candidates: products,
    features: [],
    searchTerms: [],
    searchTermGroups: [],
    sortBy: 'rating',
    sortDirection: 'DESC',
  });

  assert.ok(products[0] && matchesProductSubcategory(products[0], 'mobiles', 'iPhones'));
  assert.deepEqual(result.rankedProducts.map(product => product.name), ['iPhone 17']);
});

test('selecting skincare excludes hair oil and returns only skincare products', () => {
  const products = [
    { name: 'Hydrating Face Moisturizer', specifications: ['productType: Hydrating Face Moisturizer'] },
    { name: 'Hair Oil Treatment', specifications: ['productType: Hair Oil Treatment'] },
  ];
  const result = rankProducts({
    criteria: { category: 'beauty', subcategory: 'Skincare', maxBudget: null, minRating: null },
    candidates: products.map(product => ({ ...product, price: 300, rating: 4, reviews: 10 })),
    features: [],
    searchTerms: [],
    searchTermGroups: [],
    sortBy: 'rating',
    sortDirection: 'DESC',
  });

  assert.deepEqual(result.rankedProducts.map(product => product.name), [
    'Hydrating Face Moisturizer',
  ]);
});

test('skin care search phrases select Skincare and avoid unrelated beauty products', () => {
  const products = [
    { name: 'Daily Sunscreen SPF 50', specifications: ['productType: Daily Sunscreen SPF 50'] },
    { name: 'Hydrating Face Moisturizer', specifications: ['productType: Hydrating Face Moisturizer'] },
    { name: 'Aloe Vera Skin Gel', specifications: ['productType: Aloe Vera Skin Gel'] },
    { name: 'Makeup Brush Set', specifications: ['productType: Makeup Brush Set'] },
    { name: 'Hair Oil Treatment', specifications: ['productType: Hair Oil Treatment'] },
  ];
  const result = rankProducts({
    criteria: { category: 'beauty', subcategory: inferRequestedSubcategory('skin care products', 'beauty'), maxBudget: null, minRating: null },
    candidates: products.map(product => ({ ...product, price: 300, rating: 4, reviews: 10 })),
    features: [],
    searchTerms: [],
    searchTermGroups: [],
    sortBy: 'rating',
    sortDirection: 'DESC',
  });

  assert.equal(inferRequestedSubcategory('skin care products', 'beauty'), 'Skincare');
  assert.equal(isSubcategorySelection('skin care products', 'beauty'), true);
  assert.deepEqual(result.rankedProducts.map(product => product.name).sort(), [
    'Aloe Vera Skin Gel',
    'Daily Sunscreen SPF 50',
    'Hydrating Face Moisturizer',
  ]);
});

test('every product in the current catalog is assigned a subcategory', () => {
  const products = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'public', 'products.json'),
    'utf8'
  ));
  const unclassified = products.filter(
    product => !getProductSubcategories(product, product.category).length
  );

  assert.deepEqual(unclassified.map(product => product.name), []);
});

test('each catalog subcategory filter returns only products classified in that subcategory', () => {
  const products = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'public', 'products.json'),
    'utf8'
  )).map(product => ({
    ...product,
    oldPrice: product.oldPrice,
    specifications: Object.entries(product.specifications || {})
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${value}`),
  }));
  const categories = [...new Set(products.map(product => product.category))];

  for (const category of categories) {
    const categoryProducts = products.filter(product => product.category === category);
    for (const subcategory of getAvailableSubcategories(categoryProducts, category)) {
      const expectedIds = categoryProducts
        .filter(product => matchesProductSubcategory(product, category, subcategory))
        .map(product => product.id);
      const result = rankProducts({
        criteria: { category, subcategory, maxBudget: null, minRating: null },
        candidates: categoryProducts,
        features: [],
        searchTerms: [],
        searchTermGroups: [],
        sortBy: 'rating',
        sortDirection: 'DESC',
      });
      const actualIds = result.rankedProducts.map(product => product.id).sort((left, right) => left - right);

      assert.equal(actualIds.length, Math.min(expectedIds.length, 5), `${category} > ${subcategory} count`);
      assert.ok(
        actualIds.every(id => expectedIds.includes(id)),
        `${category} > ${subcategory} must not include products from another type`
      );
    }
  }
});

test('women and men audience filters only return explicitly labelled products', () => {
  const products = [
    { name: "Women's Cotton Dress" },
    { name: "Women's Walking Shoes" },
    { name: "Men's Formal Shirt" },
    { name: 'Wireless Airdobes 131' },
  ];

  assert.equal(inferRequestedAudience('women related products'), 'women');
  assert.equal(inferRequestedAudience("show me men's products"), 'men');
  assert.equal(inferRequestedAudience('mens products'), 'men');
  assert.equal(inferRequestedAudience('womens products'), 'women');
  assert.equal(inferRequestedAudience('ladies products'), 'women');
  assert.equal(inferRequestedAudience('female products'), 'women');
  assert.equal(inferRequestedAudience('male products'), 'men');
  assert.equal(inferRequestedAudience('show products for women and men'), '');
  assert.equal(removeAudienceTerms("casual shirt's for men"), "casual shirt's for");
  assert.equal(matchesProductAudience(products[0], 'women'), true);
  assert.equal(matchesProductAudience(products[2], 'women'), false);

  const result = rankProducts({
    criteria: { category: '', subcategory: '', audience: 'women', maxBudget: null, minRating: null },
    candidates: products.map((product, index) => ({
      ...product,
      price: 500 + index,
      rating: 4,
      reviews: 10,
    })),
    features: [],
    searchTerms: [],
    searchTermGroups: [],
    sortBy: 'rating',
    sortDirection: 'DESC',
  });

  assert.deepEqual(result.rankedProducts.map(product => product.name).sort(), [
    "Women's Cotton Dress",
    "Women's Walking Shoes",
  ]);
});

test('mens casual shirt query excludes t-shirts and returns catalog casual shirts', () => {
  const products = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'public', 'products.json'),
    'utf8'
  ));
  const result = rankProducts({
    criteria: { category: 'fashion', subcategory: 'Shirts and tops', audience: 'men', maxBudget: null, minRating: null },
    candidates: products
      .filter(product => product.category === 'fashion')
      .map(product => ({
        ...product,
        price: Number(product.price),
        rating: Number(product.rating),
      })),
    features: [],
    searchTerms: ['casual', 'shirt'],
    searchTermGroups: [['casual', 'shirt']],
    sortBy: 'rating',
    sortDirection: 'DESC',
  });

  assert.deepEqual(result.rankedProducts.map(product => product.id).sort((a, b) => a - b), [
    6, 12, 13, 16, 17,
  ]);
});

test('mens query only returns men-labelled items from the complete catalog', () => {
  const products = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'public', 'products.json'),
    'utf8'
  )).map(product => ({
    ...product,
    specifications: product.specifications,
  }));
  const result = rankProducts({
    criteria: {
      category: '',
      subcategory: '',
      audience: inferRequestedAudience('mens products'),
      maxBudget: null,
      minRating: null,
    },
    candidates: products,
    features: [],
    searchTerms: [],
    searchTermGroups: [],
    sortBy: 'rating',
    sortDirection: 'DESC',
  });

  assert.ok(result.rankedProducts.length > 0);
  assert.ok(result.rankedProducts.every(product => matchesProductAudience(product, 'men')));
  assert.ok(result.rankedProducts.every(product => !matchesProductAudience(product, 'women')));
});

test('laptop searches distinguish laptops from laptop accessories', () => {
  const laptop = { name: 'HP windows laptop', specifications: ['deviceType: HP windows laptop'] };
  const coolingPad = { name: 'Laptop Cooling Pad', specifications: ['deviceType: Laptop Cooling Pad'] };

  assert.equal(inferRequestedSubcategory('find laptop below 2000', 'electronics'), 'Laptops');
  assert.equal(getProductSubcategory(laptop, 'electronics'), 'Laptops');
  assert.equal(getProductSubcategory(coolingPad, 'electronics'), 'Laptop accessories');
  assert.equal(getProductSubcategory(coolingPad, 'electronics') === 'Laptops', false);
});

test('a subcategory button label is recognized as a selection, not a product keyword query', () => {
  assert.equal(inferRequestedSubcategory('Laptop accessories', 'electronics'), 'Laptop accessories');
  assert.equal(isSubcategorySelection('Laptop accessories', 'electronics'), true);
  assert.equal(isSubcategorySelection('show laptop accessories', 'electronics'), false);
  assert.equal(isSubcategorySelection('skin care products', 'beauty'), true);
  assert.equal(isSubcategorySelection('show me skin care products', 'beauty'), true);
  assert.equal(isSubcategorySelection('find laptop below 2000', 'electronics'), false);
});

test('a laptop request does not fall back to a laptop accessory', () => {
  const result = rankProducts({
    criteria: { category: 'electronics', subcategory: 'Laptops', maxBudget: 2000, minRating: null },
    candidates: [{
      name: 'Laptop Cooling Pad',
      specifications: ['deviceType: Laptop Cooling Pad'],
      price: 999,
      rating: 4,
      reviews: 10,
    }],
    features: [],
    searchTerms: ['laptop'],
    searchTermGroups: [['laptop']],
    sortBy: 'rating',
    sortDirection: 'DESC',
  });

  assert.deepEqual(result.rankedProducts, []);
  assert.match(result.responseMessage, /No matching products in the Laptops subcategory are available under ₹2,000 in the electronics category/i);
});

test('selecting laptop accessories finds the catalog cooling pad without keyword filters', () => {
  const result = rankProducts({
    criteria: { category: 'electronics', subcategory: 'Laptop accessories', maxBudget: null, minRating: null },
    candidates: [{
      name: 'Laptop Cooling Pad',
      specifications: ['deviceType: Laptop Cooling Pad'],
      price: 999,
      rating: 4,
      reviews: 10,
    }],
    features: [],
    searchTerms: [],
    searchTermGroups: [],
    sortBy: 'rating',
    sortDirection: 'DESC',
  });

  assert.equal(result.rankedProducts.length, 1);
  assert.equal(result.rankedProducts[0].name, 'Laptop Cooling Pad');
});

test('a selected shoe subcategory returns products that belong to it', () => {
  const result = rankProducts({
    criteria: { category: 'shoes', subcategory: 'Casual shoes', maxBudget: null, minRating: null },
    candidates: [{
      name: 'Casual orange Shoe',
      specifications: ['shoeType: Casual orange Shoe'],
      price: 1200,
      rating: 4,
      reviews: 10,
    }],
    features: [],
    searchTerms: ['casual'],
    searchTermGroups: [['casual']],
    sortBy: 'rating',
    sortDirection: 'DESC',
  });

  assert.equal(result.rankedProducts.length, 1);
  assert.equal(result.rankedProducts[0].name, 'Casual orange Shoe');
});

test('category-list questions are detected without matching product searches', () => {
  assert.equal(isCategoryListRequest('categories'), true);
  assert.equal(isCategoryListRequest('category'), true);
  assert.equal(isCategoryListRequest('products'), true);
  assert.equal(isCategoryListRequest('product types'), true);
  assert.equal(isCategoryListRequest('types of products'), true);
  assert.equal(isCategoryListRequest('What are the categories are there?'), true);
  assert.equal(isCategoryListRequest('Which categories do you have?'), true);
  assert.equal(isCategoryListRequest('Show me the available categories'), true);
  assert.equal(isCategoryListRequest('What are the categories in fashion?'), false);
  assert.equal(isCategoryListRequest('what type of products is there?'), true);
  assert.equal(isCategoryListRequest('What types of products are available?'), true);
  assert.equal(isCategoryListRequest('which types of products is there?'), true);
  assert.equal(isCategoryListRequest('Which types of products are available?'), true);
  assert.equal(isCategoryListRequest('What products do you have?'), true);
  assert.equal(isCategoryListRequest('Recommend electronics under 5000'), false);
  assert.equal(isCategoryListRequest('Find a laptop with good battery life'), false);
});

test('a bare category name selects that category for product-type choices', () => {
  const categories = ['beauty', 'electronics', 'fashion', 'home', 'mobiles', 'shoes'];

  assert.equal(findSelectedCategory('shoes', categories), 'shoes');
  assert.equal(findSelectedCategory('shoe', categories), 'shoes');
  assert.equal(findSelectedCategory('phones', categories), 'mobiles');
  assert.equal(findSelectedCategory('home', categories), 'home');
  assert.equal(findSelectedCategory('What are the categories in fashion?', categories), 'fashion');
  assert.equal(findSelectedCategory('find shoes under 2000', categories), '');
});

test('category and subcategory browse questions select the requested category', () => {
  const categories = ['beauty', 'electronics', 'fashion', 'home', 'mobiles', 'shoes'];
  const questions = [
    ['categories of beauty?', 'beauty'],
    ['What are the sub categories in electronics?', 'electronics'],
    ['product types for fashion', 'fashion'],
    ['types in home?', 'home'],
    ['What categories are there in mobiles?', 'mobiles'],
    ['sub-categories of shoes', 'shoes'],
  ];

  for (const [question, category] of questions) {
    assert.equal(isCategoryListRequest(question), false, question);
    assert.equal(findSelectedCategory(question, categories), category, question);
  }
});
