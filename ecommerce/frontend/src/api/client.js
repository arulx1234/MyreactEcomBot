export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

const ACCESS_TOKEN_KEY = 'aroAccessToken'

let refreshRequest
let sessionExpiredHandler = () => {}

function getStoredToken(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function hasAccessToken() {
  return Boolean(getStoredToken(ACCESS_TOKEN_KEY))
}

export function saveSession({ accessToken }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  // Remove refresh tokens saved by older versions of the application.
  localStorage.removeItem('aroRefreshToken')
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem('aroRefreshToken')
}

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler
}

async function readResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`)
  }

  return data
}

async function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = fetch(`${API_URL}/api/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(readResponse)
      .then((session) => {
        saveSession(session)
        return session.accessToken
      })
      .catch((error) => {
        clearSession()
        sessionExpiredHandler()
        throw error
      })
      .finally(() => {
        refreshRequest = undefined
      })
  }

  return refreshRequest
}

export async function request(path, options = {}, { authenticated = false, retry = true } = {}) {
  const headers = new Headers(options.headers)
  const hasBody = options.body !== undefined && options.body !== null
  if (hasBody && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (authenticated) {
    const accessToken = getStoredToken(ACCESS_TOKEN_KEY)
    if (!accessToken) throw new Error('Please log in to continue.')
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    // Only endpoints that create, rotate, or remove a cookie opt in to credentials.
    // Public API calls must remain compatible with a backend that does not use CORS credentials.
    credentials: options.credentials || 'same-origin',
  })
  if (authenticated && response.status === 401 && retry) {
    await refreshAccessToken()
    return request(path, options, { authenticated, retry: false })
  }

  return readResponse(response)
}

const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const api = {
  signup: (account) => request('/api/signup', json('POST', account)),
  login: (credentials) => request('/api/login', { ...json('POST', credentials), credentials: 'include' }),
  googleLogin: (idToken) => request('/api/google-login', { ...json('POST', { idToken }), credentials: 'include' }),
  logout: () => request('/api/logout', { method: 'POST', credentials: 'include' }),
  products: {
    list: () => request('/api/products'),
    create: (product) => request('/api/products', json('POST', product), { authenticated: true }),
    updateSpecifications: (id, specifications) =>
      request(`/api/products/${id}/specifications`, json('PUT', { specifications }), { authenticated: true }),
    remove: (id) => request(`/api/products/${id}`, { method: 'DELETE' }, { authenticated: true }),
  },
  recommendations: {
    get: (message, context = []) =>
      request('/api/recommendations', json('POST', { message, context })),
  },
  aiChats: {
    list: () => request('/api/ai-chats', {}, { authenticated: true }),
    messages: (chatId) =>
      request(`/api/ai-chats/${chatId}/messages`, {}, { authenticated: true }),
    create: (turn) =>
      request('/api/ai-chats', json('POST', turn), { authenticated: true }),
    addMessage: (chatId, turn) =>
      request(`/api/ai-chats/${chatId}/messages`, json('POST', turn), { authenticated: true }),
    remove: (chatId) =>
      request(`/api/ai-chats/${chatId}`, { method: 'DELETE' }, { authenticated: true }),
  },
  admin: {
    status: () => request('/api/admin-status', {}, { authenticated: true }),
  },
  cart: {
    get: (userId) => request(`/api/cart/${userId}`, {}, { authenticated: true }),
    update: (userId, productId, quantity) => request(`/api/cart/${userId}/${productId}`, json('PUT', { quantity }), { authenticated: true }),
    clear: (userId) => request(`/api/cart/${userId}`, { method: 'DELETE' }, { authenticated: true }),
  },
  wishlist: {
    get: (userId) => request(`/api/wishlist/${userId}`, {}, { authenticated: true }),
    update: (userId, productId, liked) => request(`/api/wishlist/${userId}/${productId}`, json('PUT', { liked }), { authenticated: true }),
  },
  orders: {
    get: (userId) => request(`/api/orders/${userId}`, {}, { authenticated: true }),
    create: (order) => request('/api/orders', json('POST', order), { authenticated: true }),
  },
}
