async function ensureProductSpecifications(pool) {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME IN ('specifications', 'details')`
  )

  const existingColumns = new Set(columns.map(({ COLUMN_NAME }) => COLUMN_NAME))

  if (!existingColumns.has('specifications')) {
    await pool.query(
      'ALTER TABLE products ADD COLUMN specifications JSON NULL'
    )
  }

  if (!existingColumns.has('details')) {
    await pool.query(
      'ALTER TABLE products ADD COLUMN details JSON NULL'
    )
  }
}

module.exports = { ensureProductSpecifications }
