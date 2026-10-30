import { Link, useNavigate } from 'react-router-dom'
import { getImageUrl } from '../utils/imageUrl'

function WishlistPage({ wishlistProducts, removeFromWishlist, addToCart }) {
  const navigate = useNavigate()

  return (
    <div className="section">
      <div className="section-heading">
        <h2>My Wishlist</h2>
        <Link to="/" className="text-link">Back to home</Link>
      </div>

      {wishlistProducts.length === 0 ? (
        <div className="empty-state">
          <p>Your wishlist is empty.</p>
          <Link to="/" className="checkout-button" style={{ display: 'inline-block', textAlign: 'center', width: '220px', textDecoration: 'none' }}>Explore products</Link>
        </div>
      ) : (
        <div className="product-grid wishlist-grid">
          {wishlistProducts.map((product) => (
            <article className="product-card" key={product.id} onClick={() => navigate(`/product/${product.id}`)}>
              <div className="product-image">
                <img src={getImageUrl(product.image)} alt={product.name} />
                <button className="wishlist liked" onClick={(event) => { event.stopPropagation(); removeFromWishlist(product.id) }}>♥</button>
              </div>
              <div className="product-info">
                <p className="product-category">{product.category}</p>
                <h3>{product.name}</h3>
                <p className="rating">{'★'.repeat(product.rating)}<span> ({product.reviews})</span></p>
                <p className="price">₹{product.price.toLocaleString('en-IN')} <del>₹{product.oldPrice.toLocaleString('en-IN')}</del></p>
                <div className="product-actions">
                  <button className="add-cart" onClick={(event) => { event.stopPropagation(); addToCart(product) }}>Add to cart</button>
                  <button className="buy-now" onClick={(event) => { event.stopPropagation(); navigate('/checkout', { state: { buyNowProduct: product } }) }}>Buy now</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default WishlistPage
