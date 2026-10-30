const fs = require('fs');
const path = require('path');
const pool = require('./db');
const { ensureProductSpecifications } = require('./product-schema');

async function importProducts() {
  try {
    const filePath = path.join(
      __dirname,
      '..',
      'frontend',
      'public',
      'products.json'
    );

    const products = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    await ensureProductSpecifications(pool);

    for (const product of products) {
      const imageName = path.basename(product.image);
      const specificationEntries = product.specifications &&
        typeof product.specifications === 'object' &&
        !Array.isArray(product.specifications)
        ? Object.entries(product.specifications)
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
        : product.specifications;
      const specifications = Array.isArray(specificationEntries)
        ? JSON.stringify(specificationEntries)
        : null;
      const details = JSON.stringify({
        brand: product.brand,
        brandLogo: product.brandLogo,
        brandWebsite: product.brandWebsite,
        brandDescription: product.brandDescription,
        model: product.model,
        description: product.description,
        features: product.features,
        specifications: product.specifications,
        useCases: product.useCases,
        searchKeywords: product.searchKeywords,
        tags: product.tags,
        pros: product.pros,
        cons: product.cons,
        warranty: product.warranty,
        dataQuality: product.dataQuality,
      });
      await pool.query(
        `INSERT INTO products
        (id, name, price, old_price, category, image, discount, rating, reviews, specifications, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          price = VALUES(price),
          old_price = VALUES(old_price),
          category = VALUES(category),
          image = VALUES(image),
          discount = VALUES(discount),
          rating = VALUES(rating),
          reviews = VALUES(reviews),
          specifications = COALESCE(VALUES(specifications), specifications),
          details = VALUES(details)`,
        [
          product.id,
          product.name,
          Number(product.price),
          Number(product.oldPrice),
          product.category,
          `images/${imageName}`,
          Number(product.discount),
          Number(product.rating),
          Number(product.reviews),
          specifications,
          details,
        ]
      );
    }

    console.log(`${products.length} products imported successfully!`);
  } catch (error) {
    console.error('Product import error:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

importProducts();