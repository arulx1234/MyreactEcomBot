const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('./db');
const { ensureProductSpecifications } = require('./product-schema');
const { ensureAiChatSchema } = require('./ai-chat-schema');
const recommendationsRouter = require('./recommendations');
const adminAuth = require('./firebase-admin');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'development-access-token-secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'development-refresh-token-secret';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || 'lax';

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET)
) {
  throw new Error('ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be configured in production.');
}

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use('/api/recommendations', recommendationsRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function isAdminEmail(email) {
  return Boolean(ADMIN_EMAIL) && email?.trim().toLowerCase() === ADMIN_EMAIL;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: COOKIE_SAME_SITE,
    path: '/api',
  };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie('aroRefreshToken', refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie('aroRefreshToken', refreshCookieOptions());
}

function getRefreshCookie(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader.split(';').find((entry) => entry.trim().startsWith('aroRefreshToken='));
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=').trim()) : null;
}

async function createTokenPair(user, executor = pool) {
  const payload = {
    sub: String(user.id),
    email: user.email,
    name: user.name,
    isAdmin: isAdminEmail(user.email)
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN
  });
  const tokenId = crypto.randomUUID();
  const refreshToken = jwt.sign({ sub: String(user.id), jti: tokenId }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN
  });
  const { exp } = jwt.decode(refreshToken);

  await executor.query(
    `INSERT INTO refresh_sessions (token_id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, FROM_UNIXTIME(?))`,
    [tokenId, user.id, hashToken(refreshToken), exp]
  );

  return {
    accessToken,
    refreshToken,
    tokenId
  };
}

function sendSession(res, status, message, session, user) {
  setRefreshCookie(res, session.refreshToken);
  return res.status(status).json({
    message,
    accessToken: session.accessToken,
    user: user && {
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: isAdminEmail(user.email)
    }
  });
}

function requireAuth(req, res, next) {
  const authorization = req.header('authorization');
  const [scheme, token] = authorization ? authorization.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'A valid access token is required.' });
  }

  try {
    req.user = jwt.verify(token, ACCESS_TOKEN_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      message: error.name === 'TokenExpiredError'
        ? 'Access token has expired.'
        : 'Invalid access token.'
    });
  }
}

function requireUserAccess(req, res, next) {
  if (String(req.user.sub) !== String(req.params.userId)) {
    return res.status(403).json({ message: 'You can only access your own account data.' });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin || !isAdminEmail(req.user.email)) {
    return res.status(403).json({ message: 'Admin access is required.' });
  }

  next();
}

app.get('/api/admin-status', requireAuth, (req, res) => {
  res.json({
    isAdmin: req.user.isAdmin
  });
});

function normalizeStoredRecommendations(value) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 10).map((product) => ({
    id: product.id,
    name: typeof product.name === 'string' ? product.name.slice(0, 255) : '',
    price: product.price,
    oldPrice: product.oldPrice,
    category: typeof product.category === 'string' ? product.category.slice(0, 100) : '',
    image: typeof product.image === 'string' ? product.image.slice(0, 500) : '',
    discount: product.discount,
    rating: product.rating,
    reviews: product.reviews,
    specifications: Array.isArray(product.specifications)
      ? product.specifications.filter(item => typeof item === 'string').slice(0, 30)
      : null,
  })).filter(product => product.name);
}

function normalizeCategoryOptions(value) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value
    .filter(category => typeof category === 'string')
    .map(category => category.trim().slice(0, 100))
    .filter(Boolean))].slice(0, 50);
}

function normalizeChatTurn(body) {
  const userMessage = typeof body.userMessage === 'string'
    ? body.userMessage.trim()
    : '';
  if (!userMessage || userMessage.length > 500) {
    return { error: 'A chat message of up to 500 characters is required.' };
  }

  return {
    userMessage,
    assistantReply: typeof body.assistantReply === 'string'
      ? body.assistantReply.slice(0, 4000)
      : '',
    recommendations: normalizeStoredRecommendations(body.recommendations),
    categoryOptions: normalizeCategoryOptions(body.categoryOptions),
    notice: typeof body.notice === 'string' ? body.notice.slice(0, 1000) : '',
  };
}

app.get('/api/ai-chats', requireAuth, async (req, res) => {
  try {
    const [conversations] = await pool.query(
      `SELECT c.id, c.title, c.created_at AS createdAt, c.updated_at AS updatedAt,
        COUNT(m.id) AS messageCount
       FROM ai_chat_conversations c
       LEFT JOIN ai_chat_messages m ON m.conversation_id = c.id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY c.updated_at DESC
       LIMIT 50`,
      [req.user.sub]
    );
    return res.json(conversations);
  } catch (error) {
    console.error('List AI chat history error:', error.message);
    return res.status(500).json({ message: 'Failed to load AI chat history.' });
  }
});

app.get('/api/ai-chats/:chatId/messages', requireAuth, async (req, res) => {
  try {
    const [conversations] = await pool.query(
      'SELECT id FROM ai_chat_conversations WHERE id = ? AND user_id = ?',
      [req.params.chatId, req.user.sub]
    );
    if (!conversations.length) {
      return res.status(404).json({ message: 'Chat history was not found.' });
    }

    const [messages] = await pool.query(
      `SELECT id, user_message AS userMessage, assistant_reply AS assistantReply,
        recommendations, category_options AS categoryOptions, notice, created_at AS createdAt
       FROM ai_chat_messages
       WHERE conversation_id = ?
       ORDER BY id`,
      [req.params.chatId]
    );
    return res.json(messages.map(message => ({
      ...message,
      recommendations: typeof message.recommendations === 'string'
        ? JSON.parse(message.recommendations)
        : message.recommendations || [],
      categoryOptions: typeof message.categoryOptions === 'string'
        ? JSON.parse(message.categoryOptions)
        : message.categoryOptions || [],
    })));
  } catch (error) {
    console.error('Load AI chat messages error:', error.message);
    return res.status(500).json({ message: 'Failed to load chat messages.' });
  }
});

app.post('/api/ai-chats', requireAuth, async (req, res) => {
  const turn = normalizeChatTurn(req.body || {});
  if (turn.error) return res.status(400).json({ message: turn.error });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [conversationResult] = await connection.query(
      'INSERT INTO ai_chat_conversations (user_id, title) VALUES (?, ?)',
      [req.user.sub, turn.userMessage.slice(0, 160)]
    );
    await connection.query(
      `INSERT INTO ai_chat_messages
        (conversation_id, user_message, assistant_reply, recommendations, category_options, notice)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        conversationResult.insertId,
        turn.userMessage,
        turn.assistantReply,
        JSON.stringify(turn.recommendations),
        JSON.stringify(turn.categoryOptions),
        turn.notice || null,
      ]
    );
    await connection.commit();
    return res.status(201).json({
      id: conversationResult.insertId,
      title: turn.userMessage.slice(0, 160),
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create AI chat error:', error.message);
    return res.status(500).json({ message: 'Failed to save AI chat.' });
  } finally {
    connection.release();
  }
});

app.post('/api/ai-chats/:chatId/messages', requireAuth, async (req, res) => {
  const turn = normalizeChatTurn(req.body || {});
  if (turn.error) return res.status(400).json({ message: turn.error });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [conversations] = await connection.query(
      'SELECT id FROM ai_chat_conversations WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.chatId, req.user.sub]
    );
    if (!conversations.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Chat history was not found.' });
    }

    await connection.query(
      `INSERT INTO ai_chat_messages
        (conversation_id, user_message, assistant_reply, recommendations, category_options, notice)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.params.chatId,
        turn.userMessage,
        turn.assistantReply,
        JSON.stringify(turn.recommendations),
        JSON.stringify(turn.categoryOptions),
        turn.notice || null,
      ]
    );
    await connection.query(
      'UPDATE ai_chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.chatId]
    );
    await connection.commit();
    return res.status(201).json({ message: 'Chat message saved.' });
  } catch (error) {
    await connection.rollback();
    console.error('Save AI chat message error:', error.message);
    return res.status(500).json({ message: 'Failed to save chat message.' });
  } finally {
    connection.release();
  }
});

app.delete('/api/ai-chats/:chatId', requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM ai_chat_conversations WHERE id = ? AND user_id = ?',
      [req.params.chatId, req.user.sub]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Chat history was not found.' });
    }
    return res.json({ message: 'Chat history deleted.' });
  } catch (error) {
    console.error('Delete AI chat error:', error.message);
    return res.status(500).json({ message: 'Failed to delete chat history.' });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Aro.D.Buy backend is running!'
  });
});

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required.'
      });
    }

    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        message: 'An account with this email already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

await pool.query(
  'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
  [name, email, hashedPassword]
);

    res.status(201).json({
      message: 'Account created successfully!'
    });
  } catch (error) {
    console.error('Signup error:', error.message);

    res.status(500).json({
      message: 'Failed to create account.'
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.'
      });
    }

    const [users] = await pool.query(
      'SELECT id, name, email, password FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    const user = users[0];

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
         message: 'Invalid email or password.'
     });
    }

    const session = await createTokenPair(user);
    return sendSession(res, 200, 'Login successful!', session, user);
  } catch (error) {
    console.error('Login error:', error.message);

    res.status(500).json({
      message: 'Failed to login.'
    });
  }
});
app.post('/api/google-login', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        message: 'Google ID token is required.'
      });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const email = decodedToken.email;
    const name = decodedToken.name || 'Google User';

    if (!email) {
      return res.status(400).json({
        message: 'Google account email is missing.'
      });
    }

    const [existingUsers] = await pool.query(
      'SELECT id, name, email FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      const user = existingUsers[0];
      const session = await createTokenPair(user);
      return sendSession(res, 200, 'Google login successful!', session, user);
    }

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, NULL)',
      [name, email]
    );

    const user = { id: result.insertId, name, email };
    const session = await createTokenPair(user);
    return sendSession(res, 201, 'Google account created successfully!', session, user);

  } catch (error) {
    console.error('Google login error:', error.message);

    res.status(401).json({
      message: 'Invalid or expired Google login.'
    });
  }
});

app.post('/api/refresh', async (req, res) => {
  const refreshToken = getRefreshCookie(req);

  if (!refreshToken) {
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
  } catch (error) {
    clearRefreshCookie(res);
    return res.status(401).json({
      message: error.name === 'TokenExpiredError'
        ? 'Refresh token has expired. Please log in again.'
        : 'Invalid refresh token.'
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [sessions] = await connection.query(
      `SELECT token_id FROM refresh_sessions
       WHERE token_id = ? AND user_id = ? AND token_hash = ?
         AND revoked_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [decoded.jti, decoded.sub, hashToken(refreshToken)]
    );

    if (sessions.length === 0) {
      // A signed but already-used token indicates token replay. End every session for
      // this account so a stolen token cannot continue through a rotated token chain.
      await connection.query(
        'UPDATE refresh_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
        [decoded.sub]
      );
      await connection.commit();
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'This refresh token is no longer valid. Please log in again.' });
    }

    const [users] = await connection.query(
      'SELECT id, name, email FROM users WHERE id = ? FOR UPDATE',
      [decoded.sub]
    );
    if (users.length === 0) {
      await connection.rollback();
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'The account for this token no longer exists.' });
    }

    await connection.query('UPDATE refresh_sessions SET revoked_at = NOW() WHERE token_id = ?', [decoded.jti]);
    const session = await createTokenPair(users[0], connection);
    await connection.query(
      'UPDATE refresh_sessions SET replaced_by_token_id = ? WHERE token_id = ?',
      [session.tokenId, decoded.jti]
    );
    await connection.commit();
    setRefreshCookie(res, session.refreshToken);
    return res.json({ accessToken: session.accessToken });
  } catch (error) {
    await connection.rollback();
    console.error('Refresh token error:', error.message);
    return res.status(500).json({
      message: 'Failed to refresh access token.'
    });
  } finally {
    connection.release();
  }
});

app.post('/api/logout', async (req, res) => {
  const refreshToken = getRefreshCookie(req);
  clearRefreshCookie(res);

  if (!refreshToken) {
    return res.status(204).end();
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    await pool.query(
      'UPDATE refresh_sessions SET revoked_at = NOW() WHERE token_id = ? AND user_id = ? AND token_hash = ? AND revoked_at IS NULL',
      [decoded.jti, decoded.sub, hashToken(refreshToken)]
    );
  } catch (error) {
    // The client cookie is still cleared, even when it is expired or malformed.
  }
  return res.status(204).end();
});

app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email, created_at FROM users'
    );

    res.json(users);
  } catch (error) {
    console.error('Database error:', error.message);
    res.status(500).json({
      message: 'Failed to fetch users'
    });
  }
});

app.get('/api/cart/:userId', requireAuth, requireUserAccess, async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT c.product_id AS id, c.quantity, p.name, p.price, p.old_price AS oldPrice,
        p.category, p.image, p.discount, p.rating, p.reviews
       FROM cart_items c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ?
       ORDER BY c.id`,
      [req.params.userId]
    );
    res.json(items);
  } catch (error) {
    console.error('Get cart error:', error.message);
    res.status(500).json({ message: 'Failed to fetch cart.' });
  }
});

app.put('/api/cart/:userId/:productId', requireAuth, requireUserAccess, async (req, res) => {
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      await pool.query(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [req.params.userId, req.params.productId]
      );
      return res.json({ message: 'Cart item removed.' });
    }

    await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
      [req.params.userId, req.params.productId, quantity]
    );
    res.json({ message: 'Cart updated.' });
  } catch (error) {
    console.error('Update cart error:', error.message);
    res.status(500).json({ message: 'Failed to update cart.' });
  }
});

app.delete('/api/cart/:userId', requireAuth, requireUserAccess, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id = ?', [req.params.userId]);
    res.json({ message: 'Cart cleared.' });
  } catch (error) {
    console.error('Clear cart error:', error.message);
    res.status(500).json({ message: 'Failed to clear cart.' });
  }
});

app.get('/api/wishlist/:userId', requireAuth, requireUserAccess, async (req, res) => {
  try {
    const [items] = await pool.query(
      'SELECT product_id AS id FROM wishlist_items WHERE user_id = ? ORDER BY id',
      [req.params.userId]
    );
    res.json(items.map((item) => item.id));
  } catch (error) {
    console.error('Get wishlist error:', error.message);
    res.status(500).json({ message: 'Failed to fetch wishlist.' });
  }
});

app.put('/api/wishlist/:userId/:productId', requireAuth, requireUserAccess, async (req, res) => {
  try {
    if (req.body.liked) {
      await pool.query(
        'INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)',
        [req.params.userId, req.params.productId]
      );
    } else {
      await pool.query(
        'DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?',
        [req.params.userId, req.params.productId]
      );
    }
    res.json({ message: 'Wishlist updated.' });
  } catch (error) {
    console.error('Update wishlist error:', error.message);
    res.status(500).json({ message: 'Failed to update wishlist.' });
  }
});

app.delete('/api/wishlist/:userId', requireAuth, requireUserAccess, async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlist_items WHERE user_id = ?', [req.params.userId]);
    res.json({ message: 'Wishlist cleared.' });
  } catch (error) {
    console.error('Clear wishlist error:', error.message);
    res.status(500).json({ message: 'Failed to clear wishlist.' });
  }
});

app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const {
      userId,
      fullName,
      mobile,
      address,
      city,
      pincode,
      paymentMethod,
      total,
      items
    } = req.body;

    if (
      !userId ||
      !fullName ||
      !mobile ||
      !address ||
      !city ||
      !pincode ||
      !paymentMethod ||
      total === undefined ||
      !items ||
      items.length === 0
    ) {
      return res.status(400).json({
        message: 'All order details are required.'
      });
    }

    if (String(req.user.sub) !== String(userId)) {
      return res.status(403).json({ message: 'You can only place orders for your own account.' });
    }

    const [orderResult] = await pool.query(
      `INSERT INTO orders
      (user_id, total_amount, status, full_name, mobile, address, city, pincode, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        total,
        'Placed',
        fullName,
        mobile,
        address,
        city,
        pincode,
        paymentMethod
      ]
    );

    const orderId = orderResult.insertId;

    for (const item of items) {
      await pool.query(
        `INSERT INTO order_items
        (order_id, product_id, product_name, quantity, price)
        VALUES (?, ?, ?, ?, ?)`,
        [
          orderId,
          item.id,
          item.name,
          item.quantity || 1,
          item.price
        ]
      );
    }

    res.status(201).json({
      message: 'Order placed successfully!',
      orderId
    });

  } catch (error) {
    console.error('Order error:', error.message);

    res.status(500).json({
      message: 'Failed to place order.'
    });
  }
});



// Get all orders for a specific user
app.get('/api/orders/:userId', requireAuth, requireUserAccess, async (req, res) => {
  try {
    const { userId } = req.params;

    const [orders] = await pool.query(
      `SELECT
        id,
        user_id,
        total_amount,
        status,
        full_name,
        mobile,
        address,
        city,
        pincode,
        payment_method,
        created_at
      FROM orders
      WHERE user_id = ?
      ORDER BY created_at DESC`,
      [userId]
    );

    for (const order of orders) {
      const [items] = await pool.query(
        `SELECT
          id,
          product_id,
          product_name,
          quantity,
          price
        FROM order_items
        WHERE order_id = ?`,
        [order.id]
      );

      order.items = items;
    }

    res.json(orders);

  } catch (error) {
    console.error('Get orders error:', error.message);

    res.status(500).json({
      message: 'Failed to fetch orders.'
    });
  }
});

app.get('/api/products', async (req, res) => {
  try {
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
        reviews,
        specifications,
        details
      FROM products
      ORDER BY id`
    );

    res.json(products);

  } catch (error) {
    console.error('Get products error:', error.message);

    res.status(500).json({
      message: 'Failed to fetch products.'
    });

  }
});

app.post('/api/products', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      name, price, oldPrice, category, image,
      discount = 0, rating = 0, reviews = 0, specifications = []
    } = req.body;

    if (!name || price === undefined || oldPrice === undefined || !category || !image) {
      return res.status(400).json({
        message: 'Name, price, old price, category and image are required.'
      });
    }

    if (
      !Array.isArray(specifications) ||
      specifications.length > 50 ||
      specifications.some((item) => typeof item !== 'string' || !item.trim() || item.length > 200)
    ) {
      return res.status(400).json({
        message: 'Product specifications must be a list of text values.'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO products
      (name, price, old_price, category, image, discount, rating, reviews, specifications)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, price, oldPrice, category, image, discount, rating, reviews, JSON.stringify(specifications)]
    );

    res.status(201).json({
      message: 'Product created successfully.',
      id: result.insertId
    });
  } catch (error) {
    console.error('Create product error:', error.message);
    res.status(500).json({ message: 'Failed to create product.' });
  }
});

app.put('/api/products/:id/specifications', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { specifications } = req.body || {};
    if (
      !Array.isArray(specifications) ||
      specifications.length > 50 ||
      specifications.some((item) => typeof item !== 'string' || !item.trim() || item.length > 200)
    ) {
      return res.status(400).json({
        message: 'Product specifications must be a list of text values.'
      });
    }

    const [result] = await pool.query(
      'UPDATE products SET specifications = ? WHERE id = ?',
      [JSON.stringify(specifications), req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.json({ message: 'Product specifications updated successfully.' });
  } catch (error) {
    console.error('Update product specifications error:', error.message);
    res.status(500).json({ message: 'Failed to update product specifications.' });
  }
});

app.delete('/api/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM products WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Delete product error:', error.message);
    res.status(500).json({ message: 'Failed to delete product.' });
  }
});

async function initializeRefreshSessionStore() {
  await ensureProductSpecifications(pool);
  await ensureAiChatSchema(pool);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_sessions (
      token_id CHAR(36) PRIMARY KEY,
      user_id BIGINT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      replaced_by_token_id CHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX refresh_sessions_user_active (user_id, revoked_at, expires_at)
    )
  `);
}

initializeRefreshSessionStore()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Aro.D.Buy backend running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize backend storage:', error);
    process.exit(1);
  });
