import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getImageUrl } from '../utils/imageUrl'

function HomePage({
  products,
  cart,
  liked,
  query,
  setQuery,
  category,
  setCategory,
  addToCart,
  toggleLiked,
  cartCount,
  likedCount,
  requireLogin,
}) {
  const navigate = useNavigate()
  const categories = [
    ['mobiles', 'Mobiles', 'Latest smartphones', 'phonesicon.jpeg'],
    ['electronics', 'Electronics', 'Tech & gadgets', 'electronicsicon.jpeg'],
    ['fashion', 'Fashion', 'Trendy collections', 'fashionicon.jpeg'],
    ['home', 'Home & Kitchen', 'Make your home better', 'homeicon.jpeg'],
    ['beauty', 'Beauty', 'Beauty essentials', 'beauty.jpeg'],
    ['shoes', 'Shoes', 'Comfortable footwear', 'shoe1.jpeg'],
  ]
  const heroImages = ['hero1.jpeg', 'hero2.jpeg', 'hero3.jpeg', 'hero4.jpeg', 'hero5.jpeg']
  const [slide, setSlide] = useState(0)

  const searchTerm = query.trim().toLowerCase()

  const displayedProducts = products.filter((product) => {
    const matchesCategoryFilter = category === 'all' || product.category === category
    const productName = product.name.toLowerCase()
    const productCategory = product.category.toLowerCase()
    const matchingCategory = categories.find(([id, label]) => (
      id === product.category || label.toLowerCase() === productCategory
    ))
    const categoryText = matchingCategory ? `${matchingCategory[1]} ${matchingCategory[0]}`.toLowerCase() : ''

    if (!searchTerm) return matchesCategoryFilter

    const matchesSearch = (
      productName.includes(searchTerm) ||
      productCategory.includes(searchTerm) ||
      categoryText.includes(searchTerm)
    )

    return matchesCategoryFilter && matchesSearch
  })

  const sectionTitle = category === 'all' ? "Today's Deals" : categories.find(([id]) => id === category)?.[1]

  const selectCategory = (nextCategory) => {
    setCategory(nextCategory)
    setTimeout(() => document.querySelector('#deals')?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  useEffect(() => {
    const timer = setInterval(() => setSlide((current) => (current + 1) % heroImages.length), 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <main>
        <section className="hero-slider" aria-label="Featured offers">
          <div className="hero-slides" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {heroImages.map((image, index) => (
              <div className="hero-slide" key={image}><img src={`/images/${image}`} alt={`Featured offer ${index + 1}`} /></div>
            ))}
          </div>
          <button className="hero-prev" onClick={() => setSlide((slide + heroImages.length - 1) % heroImages.length)} aria-label="Previous offer">‹</button>
          <button className="hero-next" onClick={() => setSlide((slide + 1) % heroImages.length)} aria-label="Next offer">›</button>
          <div className="hero-dots">
            {heroImages.map((image, index) => (
              <button key={image} className={slide === index ? 'active' : ''} onClick={() => setSlide(index)} aria-label={`Show offer ${index + 1}`} />
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <h2>Shop by Category</h2>
            <button onClick={() => selectCategory('all')}>View all →</button>
          </div>
          <div className="category-grid">
            {categories.map(([id, label, description, image]) => (
              <button className="category-card" key={id} onClick={() => selectCategory(id)}>
                <img src={`/images/${image}`} alt="" />
                <h3>{label}</h3>
                <p>{description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="section deals-section" id="deals">
          <div className="section-heading">
            <div>
              <h2>🔥 {sectionTitle}</h2>
              {(query || category !== 'all') && <p className="result-count">{displayedProducts.length} products found</p>}
            </div>
            <button onClick={() => { setQuery(''); setCategory('all') }}>Clear filters</button>
          </div>

          <div className="product-grid">
            {displayedProducts.map((product) => (
              <article className="product-card" key={product.id} onClick={() => navigate(`/product/${product.id}`)}>
                <div className="product-image">
                  <img src={getImageUrl(product.image)} alt={product.name} />
                  <span className="discount">{product.discount}% OFF</span>
                  <button
                    className={liked.includes(product.id) ? 'wishlist liked' : 'wishlist'}
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleLiked(product.id)
                    }}
                    aria-label={`Save ${product.name}`}
                    aria-pressed={liked.includes(product.id)}
                  >
                    {liked.includes(product.id) ? '♥' : '♡'}
                  </button>
                </div>
                <div className="product-info">
                  <p className="product-category">{product.category}</p>
                  <h3>{product.name}</h3>
                  <p className="rating">{'★'.repeat(product.rating)}<span> ({product.reviews})</span></p>
                  <p className="price">₹{product.price.toLocaleString('en-IN')} <del>₹{product.oldPrice.toLocaleString('en-IN')}</del></p>
                  <p className="delivery">Free delivery</p>
                  <div className="product-actions">
                    <button
                      className="cart-icon-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (requireLogin && !requireLogin('Please login to add products to cart')) {
                          return
                        }
                        addToCart(product)
                      }}
                      aria-label={`Add ${product.name} to cart`}
                      title="Add to cart"
                    >
                      🛒
                    </button>
                    <button className="buy-now" onClick={(event) => {
                      event.stopPropagation()
                      if (requireLogin && !requireLogin('Please login to place an order')) {
                        return
                      }
                      navigate('/checkout', { state: { buyNowProduct: product } })
                    }}>Buy now</button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!displayedProducts.length && <p className="empty-state">No products match your search.</p>}
        </section>
      </main>
    </>
  )
}

export default HomePage
