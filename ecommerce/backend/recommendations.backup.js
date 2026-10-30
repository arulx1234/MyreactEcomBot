
const express = require('express');
const pool = require('./db');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const {
      query = '',
      budget,
      category,
      minRating
    } = req.body || {};

    const searchQuery =
      typeof query === 'string' ? query.trim().slice(0, 200) : '';

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

    if (maxBudget !== null && (!Number.isFinite(maxBudget) || maxBudget < 0)) {
      return res.status(400).json({
        message: 'Budget must be a valid non-negative number.'
      });
    }

    if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
      return res.status(400).json({
        message: 'Minimum rating must be between 0 and 5.'
      });
    }

    const conditions = [];
    const params = [];

    if (maxBudget !== null) {
      conditions.push('price <= ?');
      params.push(maxBudget);
    }

    if (normalizedCategory) {
      conditions.push('LOWER(category) = LOWER(?)');
      params.push(normalizedCategory);
    }

    if (rating !== null) {
      conditions.push('rating >= ?');
      params.push(rating);
    }

   
if (searchQuery) {
  const keywords = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  for (const word of keywords) {
    conditions.push(
      '(LOWER(name) LIKE ? OR LOWER(category) LIKE ?)'
    );

    const keyword = `%${word}%`;
    params.push(keyword, keyword);
  }
}


    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const [products] = await pool.query(
      `SELECT
        id,
        name,
        price,
        old_price AS oldPrice,
        category,
        image,
        discount,
        rating,
        reviews
      FROM products
      ${whereClause}
      ORDER BY rating DESC, reviews DESC, price ASC
      LIMIT 10`,
      params
    );

    return res.json({
      count: products.length,
      recommendations: products
    });
  } catch (error) {
    console.error('Recommendations error:', error.message);

    return res.status(500).json({
      message: 'Failed to generate product recommendations.'
    });
  }
});

module.exports = router;
