import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

function OrdersPage({ currentUser }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      if (!currentUser?.id) {
        setOrders([])
        setLoading(false)
        return
      }

      try {
        setOrders(await api.orders.get(currentUser.id))
      } catch (error) {
        console.error('Fetch orders error:', error)
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [currentUser])

  return (
    <div className="section">
      <div className="section-heading">
        <h2>My Orders</h2>
        <Link to="/" className="text-link">
          Back to home
        </Link>
      </div>

      {loading ? (
        <div className="empty-state">
          <p>Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <p>No orders yet.</p>

          <Link
            to="/"
            className="checkout-button"
            style={{
              display: 'inline-block',
              textAlign: 'center',
              width: '220px',
              textDecoration: 'none'
            }}
          >
            Shop now
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-card-header">
                <div>
                  <p className="order-label">Order #{order.id}</p>
                  <h3>{order.status}</h3>
                </div>

                <span className="order-total">
                  ₹{Number(order.total_amount || 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="order-items">
                {order.items?.map((item) => (
                  <div
                    key={`${order.id}-${item.id}`}
                    className="order-item-row"
                  >
                    <span>{item.product_name}</span>

                    <span>
                      {item.quantity || 1} × ₹
                      {Number(item.price || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="order-meta">
                <span>
                  {new Date(order.created_at).toLocaleDateString()}
                </span>

                <span>{order.payment_method}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default OrdersPage
