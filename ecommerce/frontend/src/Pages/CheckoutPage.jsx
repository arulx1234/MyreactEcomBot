import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../Components/Buttons/Button'
import { getImageUrl } from '../utils/imageUrl'
import { api } from '../api/client'

function CheckoutPage({ cart, cartTotal, onPlaceOrder, buyNowProduct }) {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedProduct = location.state?.buyNowProduct || buyNowProduct
  const items = selectedProduct ? [{ ...selectedProduct, quantity: 1 }] : cart
  const total = selectedProduct ? selectedProduct.price : cartTotal
  const [orderForm, setOrderForm] = useState({
    fullName: '',
    mobile: '',
    address: '',
    city: '',
    pincode: '',
    payment: 'cod',
  })
  const updateOrderForm = (field, value) => setOrderForm((current) => ({ ...current, [field]: value }))

  const handleSubmit = async (event) => {
  event.preventDefault()

  try {
    const savedUser = localStorage.getItem('aroCurrentUser')
    const currentUser = savedUser ? JSON.parse(savedUser) : null

    if (!currentUser?.id) {
      alert('Please login before placing an order.')
      return
    }

    const data = await api.orders.create({
        userId: currentUser.id,
        fullName: orderForm.fullName,
        mobile: orderForm.mobile,
        address: orderForm.address,
        city: orderForm.city,
        pincode: orderForm.pincode,
        paymentMethod: orderForm.payment,
        total,
        items,
    })

    alert(`Order placed successfully! Order ID: ${data.orderId}`)

    onPlaceOrder({
      ...orderForm,
      product: selectedProduct,
      items,
      total,
    })
  } catch (error) {
    console.error('Order error:', error)
    alert(error.message || 'Cannot connect to the backend.')
  }
}

  const emptyState = !selectedProduct && cart.length === 0

  if (emptyState) {
    return (
      <div className="section">
        <div className="empty-state">
          <p>No product selected for checkout.</p>
          <Button variant="success" style={{ width: '220px' }} onClick={() => navigate('/')}>
            Back to home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="section checkout-page" style={{ maxWidth: '1100px' }}>
      <div className="checkout-header">
        <div>
          <p className="checkout-badge">Secure checkout</p>
          <h2>{selectedProduct ? 'Buy now' : 'Checkout'}</h2>
        </div>
        <Button variant="secondary" style={{ borderRadius: '999px', padding: '10px 18px', fontWeight: 800 }} onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      <div className="checkout-layout">
        <div className="checkout-summary-panel">
          <div className="summary-top">
            <h3>Order summary</h3>
            <span>{items.length} item{items.length > 1 ? 's' : ''}</span>
          </div>

          {items.map((item) => (
            <div key={item.id} className="summary-item">
              <img src={getImageUrl(item.image)} alt={item.name} />
              <div className="summary-item-details">
                <h4>{item.name}</h4>
                <p>{item.category}</p>
                <span>Qty: {item.quantity || 1}</span>
              </div>
              <strong>₹{(item.price * (item.quantity || 1)).toLocaleString('en-IN')}</strong>
            </div>
          ))}

          <div className="summary-pricing">
            <div><span>Subtotal</span><strong>₹{total.toLocaleString('en-IN')}</strong></div>
            <div><span>Shipping</span><strong>Free</strong></div>
            <div><span>Taxes</span><strong>Included</strong></div>
            <div className="total-line"><span>Total</span><strong>₹{total.toLocaleString('en-IN')}</strong></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="checkout-form-panel">
          <div className="form-title-row">
            <h3>Delivery details</h3>
            <span>Fast and safe</span>
          </div>

          <label className="checkout-field">
            <span>Full name</span>
            <input value={orderForm.fullName} onChange={(event) => updateOrderForm('fullName', event.target.value)} placeholder="Enter your name" />
          </label>

          <label className="checkout-field">
            <span>Mobile</span>
            <input value={orderForm.mobile} onChange={(event) => updateOrderForm('mobile', event.target.value)} placeholder="Enter mobile number" />
          </label>

          <label className="checkout-field">
            <span>Address</span>
            <textarea value={orderForm.address} onChange={(event) => updateOrderForm('address', event.target.value)} placeholder="Street name, house number" rows="3" />
          </label>

          <div className="checkout-grid">
            <label className="checkout-field">
              <span>City</span>
              <input value={orderForm.city} onChange={(event) => updateOrderForm('city', event.target.value)} placeholder="City" />
            </label>
            <label className="checkout-field">
              <span>Pincode</span>
              <input value={orderForm.pincode} onChange={(event) => updateOrderForm('pincode', event.target.value)} placeholder="Pincode" />
            </label>
          </div>

          <div className="payment-options">
            <h4>Payment method</h4>
            <label><input type="radio" name="payment" checked={orderForm.payment === 'cod'} onChange={() => updateOrderForm('payment', 'cod')} /> Cash on delivery</label>
            <label><input type="radio" name="payment" checked={orderForm.payment === 'upi'} onChange={() => updateOrderForm('payment', 'upi')} /> UPI</label>
            <label><input type="radio" name="payment" checked={orderForm.payment === 'card'} onChange={() => updateOrderForm('payment', 'card')} /> Card</label>
          </div>

          <button type="submit" className="checkout-button place-order-btn">Place order</button>
        </form>
      </div>
    </div>
  )
}

export default CheckoutPage
