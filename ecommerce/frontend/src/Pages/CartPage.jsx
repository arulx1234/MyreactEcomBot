import { Link, useNavigate } from 'react-router-dom'
import { getImageUrl } from '../utils/imageUrl'

function CartPage({ cart, cartTotal, changeQuantity, clearCart }) {
  const navigate = useNavigate()

  return (
    <div className="section">
      <div className="section-heading">
        <h2>Your Cart</h2>
        <Link to="/" className="text-link">Continue shopping</Link>
      </div>

      {cart.length === 0 ? (
        <div className="empty-state">
          <p>Your cart is empty.</p>
          <Link to="/" className="checkout-button" style={{ display: 'inline-block', textAlign: 'center', width: '220px', textDecoration: 'none' }}>Go to home</Link>
        </div>
      ) : (
        <div className="cart-layout">
          {cart.map((item) => (
            <article key={item.id} className="cart-item">
              <img className="cart-item-image" src={getImageUrl(item.image)} alt={item.name} />
              <div className="cart-item-info">
                <span className="cart-item-category">{item.category}</span>
                <h3>{item.name}</h3>
                <p className="cart-item-unit-price">₹{item.price.toLocaleString('en-IN')} each</p>
                <div className="quantity">
                  <button onClick={() => changeQuantity(item.id, -1)}>−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => changeQuantity(item.id, 1)}>+</button>
                  <button className="remove-item" onClick={() => changeQuantity(item.id, -item.quantity)}>Remove</button>
                </div>
              </div>
              <strong className="cart-item-total">₹{(item.price * item.quantity).toLocaleString('en-IN')}</strong>
            </article>
          ))}

          <div className="cart-summary">
            <div><span>Items</span><strong>{cart.reduce((total, item) => total + item.quantity, 0)}</strong></div>
            <div><span>Delivery</span><strong className="free-label">Free</strong></div>
            <div className="cart-total-line"><span>Total</span><strong>₹{cartTotal.toLocaleString('en-IN')}</strong></div>
          </div>

          <div className="cart-actions">
            <button className="clear-cart-btn" onClick={() => clearCart()}>Clear cart</button>
            <button className="checkout-button" onClick={() => navigate('/checkout')}>Proceed to checkout</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CartPage
