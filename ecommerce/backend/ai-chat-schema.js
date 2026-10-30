async function ensureAiChatSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_chat_conversations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      title VARCHAR(160) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX ai_chat_conversations_user_updated (user_id, updated_at),
      CONSTRAINT ai_chat_conversations_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      conversation_id BIGINT UNSIGNED NOT NULL,
      user_message TEXT NOT NULL,
      assistant_reply TEXT NULL,
      recommendations JSON NULL,
      category_options JSON NULL,
      notice TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX ai_chat_messages_conversation_created (conversation_id, created_at),
      CONSTRAINT ai_chat_messages_conversation_fk
        FOREIGN KEY (conversation_id) REFERENCES ai_chat_conversations(id) ON DELETE CASCADE
    )
  `);

  const [columns] = await pool.query(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ai_chat_messages'
      AND COLUMN_NAME = 'category_options'
  `);

  if (!columns.length) {
    await pool.query(
      'ALTER TABLE ai_chat_messages ADD COLUMN category_options JSON NULL'
    );
  }
}

module.exports = { ensureAiChatSchema };
