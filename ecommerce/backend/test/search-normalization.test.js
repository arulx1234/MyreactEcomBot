const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeSearchText, normalizeSearchTerms } = require('../search-normalization');

const synonymPairs = [
  ['fridge', 'Double Door Refrigerator'],
  ['earphones', 'Wireless Earbuds Pro'],
  ['AirPods', 'Wireless Airdobes 131'],
  ['notebook', 'HP windows laptop'],
  ['smart watch', 'Smart Watch Active'],
  ['power bank', 'Portable Power Bank'],
  ['moisturiser', 'Hydrating Face Moisturizer'],
  ['face wash', 'Gentle Face Cleanser'],
  ['toaster', 'Bread toster'],
  ['avocado moisturizer', 'Avacado moisturizer'],
  ['shirts', "Men's Formal Shirt"],
];

for (const [query, productName] of synonymPairs) {
  test(`matches "${query}" with catalog product "${productName}"`, () => {
    const queryTerms = normalizeSearchTerms(query);
    const normalizedProduct = normalizeSearchText(productName);

    assert.ok(queryTerms.length > 0);
    assert.ok(
      queryTerms.every(term => normalizedProduct.includes(term)),
      `Expected "${query}" to match "${productName}" after normalization`
    );
  });
}

test('does not merge distinct product types', () => {
  const normalizedEarbuds = normalizeSearchText('Wireless Earbuds Pro');
  const normalizedHeadphones = normalizeSearchText('Over-Ear Headphones');

  assert.equal(normalizedEarbuds.includes('headphone'), false);
  assert.equal(normalizedHeadphones.includes('earbud'), false);
});
