import { useMemo, useState } from 'react'
import { getImageUrl } from '../utils/imageUrl'
import { api } from '../api/client'

const emptyForm = {
  name: '',
  price: '',
  oldPrice: '',
  category: 'beauty',
  image: 'uploads/products/beauty2.jpeg',
  discount: 0,
  rating: 0,
  reviews: 0,
  specifications: '',
}

function readSpecifications(value) {
  if (Array.isArray(value)) return value.join('\n')
  if (typeof value !== 'string' || !value) return ''

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.join('\n') : value
  } catch {
    return value
  }
}

function parseSpecifications(value) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
}

function AdminPage({ products, currentUser, onProductsChanged }) {
  const [form, setForm] = useState(emptyForm)
  const [specificationDrafts, setSpecificationDrafts] = useState({})
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savingSpecifications, setSavingSpecifications] = useState(null)

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products
    return products.filter((product) =>
      `${product.name} ${product.category} ${product.id}`.toLowerCase().includes(term)
    )
  }, [products, search])

  if (!currentUser?.isAdmin) {
    return (
      <main className="section admin-page">
        <div className="admin-empty-state">
          <span className="admin-empty-icon">🔒</span>
          <h2>Admin access required</h2>
          <p>Your account is not configured as an administrator.</p>
        </div>
      </main>
    )
  }

  const updateField = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  const addProduct = async (event) => {
    event.preventDefault()
    setMessage('')
    setIsSaving(true)

    try {
      const data = await api.products.create({
          ...form,
          price: Number(form.price),
          oldPrice: Number(form.oldPrice),
          discount: Number(form.discount),
          rating: Number(form.rating),
          reviews: Number(form.reviews),
          specifications: parseSpecifications(form.specifications),
      })
      setMessage(data.message || 'Product added successfully.')
      setForm(emptyForm)
      onProductsChanged()
    } catch (error) {
      setMessage(error.message || 'Unable to add product.')
    } finally {
      setIsSaving(false)
    }
  }

  const saveSpecifications = async (product) => {
    setMessage('')
    setSavingSpecifications(product.id)

    try {
      const data = await api.products.updateSpecifications(
        product.id,
        parseSpecifications(specificationDrafts[product.id] ?? readSpecifications(product.specifications))
      )
      setMessage(data.message || 'Product specifications updated.')
      onProductsChanged()
    } catch (error) {
      setMessage(error.message || 'Unable to update product specifications.')
    } finally {
      setSavingSpecifications(null)
    }
  }

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return

    try {
      const data = await api.products.remove(id)
      setMessage(data.message)
      onProductsChanged()
    } catch (error) {
      setMessage(error.message || 'Unable to delete product.')
    }
  }

  return (
    <main className="section admin-page">
      <div className="admin-hero">
        <div>
          <span className="admin-eyebrow">CONTROL CENTER</span>
          <h1>Product administration</h1>
          <p>Manage your Aro.D.Buy catalog from one simple workspace.</p>
        </div>
        <div className="admin-user-chip">
          <span className="admin-user-avatar">{currentUser.name?.charAt(0).toUpperCase() || 'A'}</span>
          <span><strong>{currentUser.name}</strong><small>Administrator</small></span>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card"><span>📦</span><div><small>Total products</small><strong>{products.length}</strong></div></div>
        <div className="admin-stat-card"><span>🗂️</span><div><small>Categories</small><strong>{new Set(products.map((product) => product.category)).size}</strong></div></div>
        <div className="admin-stat-card"><span>✨</span><div><small>Latest product ID</small><strong>{products.length ? Math.max(...products.map((product) => product.id)) : '-'}</strong></div></div>
      </div>

      <div className="admin-layout">
        <section className="admin-panel admin-form-panel">
          <div className="admin-panel-heading">
            <div><span className="admin-panel-icon">＋</span><div><h2>Add product</h2><p>Create a new catalog item</p></div></div>
          </div>
          <form onSubmit={addProduct} className="admin-form">
            <label>Product name<input name="name" value={form.name} onChange={updateField} placeholder="e.g. Dove shampoo" required /></label>
            <div className="admin-form-grid">
              <label>Sale price<input name="price" type="number" min="0" value={form.price} onChange={updateField} placeholder="999" required /></label>
              <label>Original price<input name="oldPrice" type="number" min="0" value={form.oldPrice} onChange={updateField} placeholder="1499" required /></label>
            </div>
            <div className="admin-form-grid">
              <label>Category
                <select name="category" value={form.category} onChange={updateField}>
                  {['beauty', 'electronics', 'fashion', 'home', 'mobiles', 'shoes'].map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>Discount (%)<input name="discount" type="number" min="0" value={form.discount} onChange={updateField} /></label>
            </div>
            <label>Image path<input name="image" value={form.image} onChange={updateField} required /><small className="admin-help">Use a file inside backend/uploads/products</small></label>
            <div className="admin-image-preview"><img src={getImageUrl(form.image)} alt="Product preview" onError={(event) => { event.currentTarget.style.opacity = '0.25' }} /><span>Preview</span></div>
            <div className="admin-form-grid">
              <label>Rating<input name="rating" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={updateField} /></label>
              <label>Reviews<input name="reviews" type="number" min="0" value={form.reviews} onChange={updateField} /></label>
            </div>
            <label>Verified product specifications<textarea name="specifications" value={form.specifications} onChange={updateField} placeholder={'Enter one verified specification per line\nCamera: 50 MP\nBattery: 5000 mAh'} rows="4" /><small className="admin-help">Only enter facts verified for this product. These are used by the shopping assistant.</small></label>
            <button className="admin-primary-btn" type="submit" disabled={isSaving}>{isSaving ? 'Saving product...' : '＋ Add product'}</button>
          </form>
          {message && <div className="admin-message">{message}</div>}
        </section>

        <section className="admin-panel admin-products-panel">
          <div className="admin-panel-heading admin-products-heading">
            <div><span className="admin-panel-icon">▦</span><div><h2>Catalog products</h2><p>{filteredProducts.length} products shown</p></div></div>
            <input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search catalog..." aria-label="Search catalog" />
          </div>
          <div className="admin-product-list">
            {filteredProducts.map((product) => (
              <article className="admin-product-row" key={product.id}>
                <img src={getImageUrl(product.image)} alt="" />
                <div className="admin-product-info"><strong>{product.name}</strong><span>ID #{product.id} · {product.category}</span></div>
                <div className="admin-product-price">₹{Number(product.price).toLocaleString('en-IN')}<small>{product.discount}% off</small></div>
                <div className="admin-product-specifications">
                  <details>
                    <summary>
                      Verified specifications ({parseSpecifications(readSpecifications(product.specifications)).length})
                    </summary>
                    <textarea
                      aria-label={`Verified specifications for ${product.name}`}
                      placeholder="One verified specification per line"
                      rows="3"
                      value={specificationDrafts[product.id] ?? readSpecifications(product.specifications)}
                      onChange={(event) => setSpecificationDrafts((current) => ({
                        ...current,
                        [product.id]: event.target.value,
                      }))}
                    />
                    <button
                      className="admin-primary-btn"
                      type="button"
                      disabled={savingSpecifications === product.id}
                      onClick={() => saveSpecifications(product)}
                    >
                      {savingSpecifications === product.id ? 'Saving...' : 'Save specs'}
                    </button>
                  </details>
                </div>
                <button className="admin-delete-btn" type="button" onClick={() => deleteProduct(product.id)} aria-label={`Delete ${product.name}`}>Delete</button>
              </article>
            ))}
            {!filteredProducts.length && <div className="admin-list-empty">No products match your search.</div>}
          </div>
        </section>
      </div>
    </main>
  )
}

export default AdminPage
