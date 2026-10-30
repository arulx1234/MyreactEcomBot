import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Button from './Components/Buttons/Button'
import ShoppingAssistant from './Components/ShoppingAssistant'
import './App.css'
import './Header.css'
import './ProductGrid.css'
import './Footer.css'
import './Responsive.css'
import HomePage from './Pages/HomePage'
import CartPage from './Pages/CartPage'
import CheckoutPage from './Pages/CheckoutPage'
import OrdersPage from './Pages/OrdersPage'
import ProductDetailsPage from './Pages/ProductDetailsPage'
import WishlistPage from './Pages/WishlistPage'
import Login from './Pages/Login'
import Signup from './Pages/Signup'
import AdminPage from './Pages/AdminPage'
import { api, clearSession, hasAccessToken, setSessionExpiredHandler } from './api/client'

function App() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('aroCart') || '[]')
    } catch {
      return []
    }
  })
  const [liked, setLiked] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('aroWishlist') || '[]')
    } catch {
      return []
    }
  })
   

  const [databaseOrderCount, setDatabaseOrderCount] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('aroTheme') || 'light'
    } catch {
      return 'light'
    }
  })
  const [isLoggedIn , setIsLoggedIn] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('aroLoggedIn') || 'false') && hasAccessToken()
    } catch {
      return false
    }
  })
  const [currentUser, setCurrentUser] = useState(() => {
  try {
    const savedUser = localStorage.getItem('aroCurrentUser')
    return savedUser ? JSON.parse(savedUser) : null
  } catch {
    return null
  }
})

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setIsLoggedIn(false)
      setCurrentUser(null)
      localStorage.setItem('aroLoggedIn', 'false')
      localStorage.removeItem('aroCurrentUser')
      localStorage.removeItem('aroCurrentUserName')
    })
    return () => setSessionExpiredHandler(() => {})
  }, [])

  useEffect(() => {
  const fetchProducts = async () => {
    try {
      const catalog = await api.products.list()
      setProducts(catalog.map((product) => ({
        ...product,
        price: Number(product.price),
        oldPrice: Number(product.oldPrice),
        discount: Number(product.discount),
        rating: Number(product.rating),
        reviews: Number(product.reviews),
      })))
    } catch (error) {
      console.error('Fetch products error:', error)
      setProducts([])
    }
  }

  fetchProducts()
}, [])

  useEffect(() => {
    if (!currentUser?.id || !isLoggedIn) return

    const fetchSavedShoppingData = async () => {
      try {
        const [savedCart, savedWishlist] = await Promise.all([
          api.cart.get(currentUser.id),
          api.wishlist.get(currentUser.id),
        ])

        setCart(savedCart)
        setLiked(savedWishlist)
      } catch (error) {
        console.error('Fetch saved shopping data error:', error)
      }
    }

    fetchSavedShoppingData()
  }, [currentUser, isLoggedIn])

  useEffect(() => {
    if (!currentUser?.email || !isLoggedIn) {
      return
    }

    const refreshAdminStatus = async () => {
      try {
        const data = await api.admin.status()

        if (data.isAdmin !== Boolean(currentUser.isAdmin)) {
          const updatedUser = { ...currentUser, isAdmin: data.isAdmin }
          setCurrentUser(updatedUser)
          localStorage.setItem('aroCurrentUser', JSON.stringify(updatedUser))
        }
      } catch (error) {
        console.error('Admin status error:', error)
      }
    }

    refreshAdminStatus()
  }, [currentUser, isLoggedIn])

  useEffect(() => {
  const fetchOrderCount = async () => {
    if (!currentUser?.id) {
      setDatabaseOrderCount(0)
      return
    }

    try {
      setDatabaseOrderCount((await api.orders.get(currentUser.id)).length)
    } catch (error) {
      console.error('Fetch order count error:', error)
      setDatabaseOrderCount(0)
    }
  }

  fetchOrderCount()
}, [currentUser])



  useEffect(() => {
    if (!isLoggedIn) localStorage.setItem('aroCart', JSON.stringify(cart))
  }, [cart, isLoggedIn])
  useEffect(() => {
    if (!isLoggedIn) localStorage.setItem('aroWishlist', JSON.stringify(liked))
  }, [liked, isLoggedIn])
  
  useEffect(() => {
    localStorage.setItem('aroLoggedIn', JSON.stringify(isLoggedIn))
  }, [isLoggedIn])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('aroTheme', theme)
  }, [theme])

  const notify = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  const addToCart = async (product) => {
    const nextQuantity = (cart.find((item) => item.id === product.id)?.quantity || 0) + 1
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      return existing
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }]
    })
    if (currentUser?.id) {
      await api.cart.update(currentUser.id, product.id, nextQuantity)
    }
    notify(`${product.name} added to cart`)
  }

  const changeQuantity = async (id, amount) => {
    const item = cart.find((cartItem) => cartItem.id === id)
    const nextQuantity = (item?.quantity || 0) + amount
    setCart((current) => current.flatMap((item) => (
      item.id === id && item.quantity + amount <= 0 ? [] : item.id === id
        ? [{ ...item, quantity: item.quantity + amount }] : [item]
    )))
    if (currentUser?.id) {
      await api.cart.update(currentUser.id, id, nextQuantity)
    }
  }

  const toggleLiked = async (id) => {
    const isLiked = liked.includes(id)
    setLiked((current) => current.includes(id)
      ? current.filter((itemId) => itemId !== id)
      : [...current, id])
    if (currentUser?.id) {
      await api.wishlist.update(currentUser.id, id, !isLiked)
    }
  }

  const removeFromWishlist = async (id) => {
    setLiked((current) => current.filter((itemId) => itemId !== id))
    if (currentUser?.id) {
      await api.wishlist.update(currentUser.id, id, false)
    }
  }
  const clearCart = async () => {
    setCart([])
    if (currentUser?.id) {
      await api.cart.clear(currentUser.id)
    }
  }

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const wishlistProducts = products.filter((product) => liked.includes(product.id))

  const placeOrder = ({ fullName, mobile, address, city, pincode, payment, product, items, total }) => {
    const required = ['fullName', 'mobile', 'address', 'city', 'pincode']
    const missing = required.some((field) => !String({ fullName, mobile, address, city, pincode }[field]).trim())

    if (missing) {
      notify('Please complete your delivery details')
      return
    }

    if (product) {
      notify(`${product.name} bought successfully`)
    } else {
      clearCart()
      notify('Order placed successfully')
    }

    window.location.href = '/'
  }

  return (
    <BrowserRouter>
      <AppShell
        products={products}
        cart={cart}
        liked={liked}
        databaseOrderCount={databaseOrderCount}
        query={query}
        setQuery={setQuery}
        category={category}
        setCategory={setCategory}
        cartCount={cartCount}
        cartTotal={cartTotal}
        wishlistProducts={wishlistProducts}
        addToCart={addToCart}
        changeQuantity={changeQuantity}
        toggleLiked={toggleLiked}
        removeFromWishlist={removeFromWishlist}
        clearCart={clearCart}
        placeOrder={placeOrder}
        toast={toast}
        theme={theme}
        setTheme={setTheme}
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        notify={notify}
      />    </BrowserRouter>
  )
}

function AppShell({
  products,
  cart,
  liked, 
  databaseOrderCount,
  query,
  setQuery,
  category,
  setCategory,
  cartCount,
  cartTotal,
  wishlistProducts,
  addToCart,
  changeQuantity,
  toggleLiked,
  removeFromWishlist,
  clearCart,
  placeOrder,
  toast,
  theme,
  setTheme,
  isLoggedIn,
  setIsLoggedIn,
  currentUser,
  setCurrentUser,
  notify,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!menuRef.current || menuRef.current.contains(event.target)) {
        return
      }
      setMenuOpen(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const toggleMenu = () => setMenuOpen((open) => !open)
  const requireLogin = (message) => {
    if (!isLoggedIn) {
      notify(message)
      navigate('/login')
      return false
    }
    return true
  }
 const handleLogin = (user) => {
  setIsLoggedIn(true)
  setCurrentUser(user)
   
  localStorage.setItem('aroCurrentUser', JSON.stringify(user))
  localStorage.setItem('aroCurrentUserName', user.name)
  setMenuOpen(false)
  navigate('/')
}
  const handleLogout = async () => {
    setIsLoggedIn(false)
    setCurrentUser(null)
    clearSession()
    localStorage.setItem('aroLoggedIn', 'false')
    localStorage.removeItem('aroCurrentUser')
    localStorage.removeItem('aroCurrentUserName')
    setMenuOpen(false)
    navigate('/')
    try {
      await api.logout()
    } catch (error) {
      console.error('Logout request error:', error)
    }
  }

  const categorySuggestions = [
    { id: 'mobiles', label: 'Mobiles' },
    { id: 'electronics', label: 'Electronics' },
    { id: 'fashion', label: 'Fashion' },
    { id: 'home', label: 'Home & Kitchen' },
    { id: 'beauty', label: 'Beauty' },
    { id: 'shoes', label: 'Shoes' },
  ]

  const searchSuggestions = (() => {
    const searchText = query.trim().toLowerCase()
    if (!searchText) return []

    const matches = []
    const seen = new Set()

    categorySuggestions.forEach((category) => {
      const categoryValue = `${category.label} ${category.id}`.toLowerCase()
      if (categoryValue.includes(searchText) || category.id.includes(searchText)) {
        matches.push({ type: 'category', id: category.id, label: category.label })
        seen.add(`category:${category.id}`)
      }
    })

    products.forEach((product) => {
      const text = `${product.name} ${product.category}`.toLowerCase()
      if (text.includes(searchText) && !seen.has(`product:${product.id}`)) {
        matches.push({ type: 'product', id: product.id, label: product.name })
        seen.add(`product:${product.id}`)
      }
    })

    return matches.slice(0, 6)
  })()

  const handleSuggestionClick = (item) => {
    if (item.type === 'category') {
      setQuery('')
      setCategory(item.id)
      navigate('/')
      return
    }

    setQuery(item.label)
    navigate(`/product/${item.id}`)
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()

    const searchText = query.trim().toLowerCase()
    if (!searchText) {
      setCategory('all')
      navigate('/')
      return
    }

    const matchingCategory = categorySuggestions.find((item) => item.label.toLowerCase() === searchText || item.id.toLowerCase() === searchText)
    if (matchingCategory) {
      setCategory(matchingCategory.id)
      setQuery('')
      navigate('/')
      return
    }

    const matchingProduct = products.find((product) => product.name.toLowerCase().includes(searchText) || product.category.toLowerCase().includes(searchText))
    if (matchingProduct) {
      setQuery(matchingProduct.name)
      navigate(`/product/${matchingProduct.id}`)
      return
    }

    setCategory('all')
    navigate('/')
  }

  return (
    <div className={`app-shell${isAuthPage ? ' app-shell-auth' : ''}`}>
      {!isAuthPage && <header className="main-header">
        <div className="header-container">
          <Link to="/" className="logo"><img src="/images/logo.png" alt="Aro.D.Buy" /></Link>
          <div className="search-wrap">
            <form className="search-container" onSubmit={handleSearchSubmit}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products or categories"
                aria-label="Search products or categories"
              />
              <button type="submit" aria-label="Search">⌕</button>
            </form>
            {query.trim() && searchSuggestions.length > 0 && (
              <div className="search-suggestions" role="listbox" aria-label="Search suggestions">
                {searchSuggestions.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    className="search-suggestion-item"
                    onClick={() => handleSuggestionClick(item)}
                  >
                    <span className="search-suggestion-type">{item.type === 'category' ? 'Category' : 'Product'}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="header-right">
            <Link to="/cart" className="icon-btn cart-button" aria-label="Open cart">
              🛒<span className="cart-count">{cartCount}</span>
            </Link>

            <div className="user-menu-wrap" ref={menuRef}>
              <button
                className="user-menu-trigger account-menu-trigger"
                type="button"
                title="Account menu"
                aria-label="Open account menu"
                aria-expanded={menuOpen}
                onClick={toggleMenu}
              >
                <span aria-hidden="true">👤</span>
              </button>

              {menuOpen && (
                <div className="user-menu-dropdown">
                  {isLoggedIn && (
                    <div className="account-summary">
                      <strong>My account</strong>
                      <span>{currentUser?.name || localStorage.getItem('aroCurrentUserName') || 'Account Holder'}</span>
                      <small>{currentUser?.email}</small>
                    </div>
                  )}
                  <button className="menu-item" onClick={() => { setMenuOpen(false); navigate('/wishlist') }}>
                    <span>♡</span> Wishlist <strong>{liked.length}</strong>
                  </button>
                  <button className="menu-item" onClick={() => { setMenuOpen(false); navigate('/orders') }}>
                    <span>▣</span> Orders <strong>{databaseOrderCount}</strong>
                  </button>
                  {currentUser?.isAdmin && (
                    <button className="menu-item" onClick={() => { setMenuOpen(false); navigate('/admin') }}>
                      <span>⚙</span> Admin products
                    </button>
                  )}

                  <div className="theme-row">
                    <span>Display mode</span>
                    <div className="theme-switch">
                      <button className={theme === 'light' ? 'selected' : ''} onClick={() => { setTheme('light'); setMenuOpen(false) }}>Light</button>
                      <button className={theme === 'dark' ? 'selected' : ''} onClick={() => { setTheme('dark'); setMenuOpen(false) }}>Dark</button>
                    </div>
                  </div>

                  {isLoggedIn ? (
                    <Button
                      variant="primary"
                      onClick={handleLogout}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <span>↩</span> Logout
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => { setMenuOpen(false); navigate('/login') }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <span>✓</span> Login
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>}

      <div className="app-content">
      <Routes>
        <Route path="/" element={<HomePage
          products={products}
          cart={cart}
          liked={liked}
          query={query}
          setQuery={setQuery}
          category={category}
          setCategory={setCategory}
          addToCart={(product) => {
            if (requireLogin('Please login to add products to cart')) {
              addToCart(product)
            }
          }}
          toggleLiked={(id) => {
            if (requireLogin('Please login to save products to wishlist')) {
              toggleLiked(id)
            }
          }}
          cartCount={cartCount}
          likedCount={liked.length}
          requireLogin={requireLogin}
        />} />
        <Route path="/product/:id" element={<ProductDetailsPage
          products={products}
          addToCart={(product) => {
            if (requireLogin('Please login to add products to cart')) {
              addToCart(product)
            }
          }}
          requireLogin={requireLogin}
        />} />
        <Route path="/cart" element={<CartPage cart={cart} cartTotal={cartTotal} changeQuantity={changeQuantity} clearCart={clearCart} />} />
        <Route path="/wishlist" element={<WishlistPage wishlistProducts={wishlistProducts} removeFromWishlist={removeFromWishlist} addToCart={(product) => {
          if (requireLogin('Please login to add products to cart')) {
            addToCart(product)
          }
        }} requireLogin={requireLogin} />} />
        <Route path="/orders" element={<OrdersPage currentUser={currentUser} />} />
        <Route path="/checkout" element={<CheckoutPage cart={cart} cartTotal={cartTotal} onPlaceOrder={placeOrder} />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/signup" element={<Signup onSignup={handleLogin} />} />
        <Route path="/admin" element={<AdminPage
          products={products}
          currentUser={currentUser}
          onProductsChanged={() => window.location.reload()}
        />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>

      {!isAuthPage && <ShoppingAssistant currentUser={currentUser} />}

      {!isAuthPage && <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <img src="/images/logo.png" alt="Aro.D.Buy" />
            </Link>
            <p>Smart shopping made simple. Discover quality products at prices you will love.</p>
          </div>

          <div className="footer-column">
            <h3>Quick links</h3>
            <Link to="/">Home</Link>
            <Link to="/cart">Cart</Link>
            <Link to="/wishlist">Wishlist</Link>
            <Link to="/orders">My orders</Link>
          </div>

          <div className="footer-column">
            <h3>Customer care</h3>
            <a href="mailto:support@arodbuy.com">Help &amp; support</a>
            <a href="mailto:returns@arodbuy.com">Returns &amp; refunds</a>
            <a href="mailto:privacy@arodbuy.com">Privacy policy</a>
            <a href="mailto:legal@arodbuy.com">Terms &amp; conditions</a>
          </div>

          <div className="footer-column footer-contact">
            <h3>Get in touch</h3>
            <a href="mailto:support@arodbuy.com">support@arodbuy.com</a>
            <a href="tel:+919876543210">+91 98765 43210</a>
            <span>Mon - Sat, 9:00 AM - 6:00 PM</span>
          </div>

          <div className="footer-column footer-social">
            <h3>Follow us</h3>
            <div className="social-links">
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
                <span>Instagram</span>
              </a>
              <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" /><path d="M9 8.5c.2-.4.5-.4.8-.4l.7 1.6c.1.2.1.4-.1.6l-.5.5c.5 1 1.2 1.7 2.2 2.2l.5-.5c.2-.2.4-.2.6-.1l1.6.7c.1.3 0 .7-.2.9-.4.4-1 .6-1.5.5-2.6-.6-4.8-2.8-5.4-5.4-.1-.5.1-1.1.5-1.5Z" /></svg>
                <span>WhatsApp</span>
              </a>
              <a href="https://x.com/" target="_blank" rel="noreferrer" aria-label="X">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 4 14 16M19 4 5 20" /></svg>
                <span>X</span>
              </a>
              <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3a5 5 0 0 0-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9a1 1 0 0 1 1-1Z" /></svg>
                <span>Facebook</span>
              </a>
              <a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8.2a2.5 2.5 0 0 0-1.8-1.8C17.6 6 12 6 12 6s-5.6 0-7.2.4A2.5 2.5 0 0 0 3 8.2 26 26 0 0 0 2.7 12 26 26 0 0 0 3 15.8a2.5 2.5 0 0 0 1.8 1.8C6.4 18 12 18 12 18s5.6 0 7.2-.4a2.5 2.5 0 0 0 1.8-1.8 26 26 0 0 0 .3-3.8 26 26 0 0 0-.3-3.8Z" /><path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" /></svg>
                <span>YouTube</span>
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Aro.D.Buy. All rights reserved.</span>
          <span>Made for better everyday shopping.</span>
        </div>
      </footer>}

      {toast && (
        <div className="app-toast">
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
