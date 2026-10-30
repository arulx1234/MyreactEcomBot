import { useNavigate, useParams } from 'react-router-dom'
import ProductDetails from '../ProductDetails'

function ProductDetailsPage({ products, addToCart, requireLogin }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const product = products.find((item) => String(item.id) === String(id))
  const recommendedProducts = product
    ? products
      .filter((item) => (
        String(item.id) !== String(product.id) &&
        item.category?.trim().toLowerCase() === product.category?.trim().toLowerCase()
      ))
      .sort((left, right) => (
        Number(right.rating) - Number(left.rating) ||
        Number(right.reviews) - Number(left.reviews)
      ))
      .slice(0, 4)
    : []

  if (!product) {
    return (
      <div className="section">
        <p className="empty-state">Product not found.</p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="checkout-button" onClick={() => navigate('/')}>Back to home</button>
        </div>
      </div>
    )
  }

  return (
    <ProductDetails
      product={product}
      recommendedProducts={recommendedProducts}
      onAddToCart={() => {
        if (requireLogin && !requireLogin('Please login to add products to cart')) {
          return
        }
        addToCart(product)
      }}
      onBuyNow={() => {
        if (requireLogin && !requireLogin('Please login to place an order')) {
          return
        }
        navigate('/checkout', { state: { buyNowProduct: product } })
      }}
      onClose={() => navigate('/')}
      onSelect={(item) => navigate(`/product/${item.id}`)}
    />
  )
}

export default ProductDetailsPage
