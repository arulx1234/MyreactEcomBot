import { getImageUrl } from './utils/imageUrl'

function ProductDetails({
  product,
  recommendedProducts = [],
  onAddToCart,
  onBuyNow,
  onClose,
  onSelect,
}) {
  if (!product) return null

  const recommended = recommendedProducts.filter((item) => (
    String(item.id) !== String(product.id) &&
    item.category?.trim().toLowerCase() === product.category?.trim().toLowerCase()
  ))

  const details = product.details && typeof product.details === 'object'
    ? product.details
    : {}
  const features = Array.isArray(details.features) && details.features.length
    ? details.features
    : Array.isArray(product.specifications) && product.specifications.length
    ? product.specifications
    : Array.isArray(product.features)
      ? product.features
    : ['Free delivery', 'Secure payment', 'Easy returns', 'Quality checked']
  const specifications = details.specifications && typeof details.specifications === 'object' &&
    !Array.isArray(details.specifications)
    ? Object.entries(details.specifications).filter(([, value]) => (
      value !== null && value !== undefined && value !== ''
    ))
    : []
  const useCases = Array.isArray(details.useCases) ? details.useCases : []
  const pros = Array.isArray(details.pros) ? details.pros : []
  const cons = Array.isArray(details.cons) ? details.cons : []
  const tags = Array.isArray(details.tags) ? details.tags : []
  const verificationStatus = details.dataQuality?.verificationStatus
  const manufacturerSource = typeof details.dataQuality?.source === 'string' &&
    /^https?:\/\//i.test(details.dataQuality.source)
    ? details.dataQuality.source
    : null
  const brandWebsite = typeof details.brandWebsite === 'string' &&
    /^https?:\/\//i.test(details.brandWebsite)
    ? details.brandWebsite
    : null
  const productBadge = verificationStatus === 'verified'
    ? 'Verified product'
    : verificationStatus === 'manufacturer_source'
      ? 'Manufacturer source'
      : 'Catalog product'

  return (
    <div className="product-details-page" style={styles.pageShell}>
      <div className="product-details-container" style={styles.container} role="article" aria-label={`${product.name} details`}>
        <div style={styles.pageHeader}>
          <button type="button" style={styles.backButton} onClick={onClose} aria-label="Back to products">
            ← Back to products
          </button>
        </div>

        <div className="product-details-layout" style={styles.productLayout}>
          <div className="product-details-image-box" style={styles.imageBox}>
            <span style={styles.imageBadge}>{productBadge}</span>
            <img
              src={getImageUrl(product.image || 'uploads/products/hero1.jpeg')}
              alt={product.name}
              style={styles.image}
            />
          </div>

          <div className="product-details-info" style={styles.infoBox}>
            <p style={styles.category}>{product.category || 'Featured'}</p>
            <h2 style={styles.title}>{product.name}</h2>
            {(details.brand || details.model || details.brandDescription) && (
              <div style={styles.brandInfo}>
                {details.brandLogo && (
                  <img
                    src={getImageUrl(details.brandLogo)}
                    alt={`${details.brand || 'Product'} brand`}
                    style={styles.brandLogo}
                  />
                )}
                {details.brand && (
                  brandWebsite
                    ? <a href={brandWebsite} target="_blank" rel="noopener noreferrer" style={styles.brandLink}>{details.brand}</a>
                    : <span style={styles.brand}>{details.brand}</span>
                )}
                {details.model && <span style={styles.brand}>Model: {details.model}</span>}
                {details.brandDescription && (
                  <p style={styles.brandDescription}>{details.brandDescription}</p>
                )}
              </div>
            )}

            <div style={styles.ratingRow}>
              <span style={styles.stars}>{'★'.repeat(product.rating || 4)}</span>
              <span style={styles.reviews}>({product.reviews || 124} reviews)</span>
            </div>

            <div style={styles.priceRow}>
              <span style={styles.price}>₹{(product.price || 0).toLocaleString('en-IN')}</span>
              <span style={styles.oldPrice}>₹{(product.oldPrice || product.price || 0).toLocaleString('en-IN')}</span>
            </div>
            <p style={styles.savings}>
              {product.discount ? `Save ${product.discount}% today` : 'Great value for your shopping'}
            </p>

            <p style={styles.description}>
              {details.description || product.description || 'A great choice from Aro.D.Buy with free delivery and secure checkout.'}
            </p>

            {features.length > 0 && (
              <ul style={styles.featureList}>
                {features.map((feature) => (
                  <li key={feature} style={styles.featureItem}>{feature}</li>
                ))}
              </ul>
            )}

            <div style={styles.trustRow}>
              <span>✓ In stock</span>
              <span>🚚 Fast delivery</span>
              <span>↩ Easy returns</span>
            </div>

            <div className="product-details-actions" style={styles.actions}>
              <button type="button" style={styles.primaryButton} onClick={onAddToCart}>
                Add to cart
              </button>
              <button type="button" style={styles.secondaryButton} onClick={onBuyNow}>
                Buy now
              </button>
            </div>
          </div>
        </div>

        {(specifications.length > 0 || useCases.length > 0 || pros.length > 0 || cons.length > 0 ||
          tags.length > 0 || details.warranty || details.dataQuality?.note || manufacturerSource) && (
          <section style={styles.additionalDetails} aria-label="More product details">
            {specifications.length > 0 && (
              <div>
                <h3 style={styles.detailHeading}>Specifications</h3>
                <dl style={styles.specificationList}>
                  {specifications.map(([key, value]) => (
                    <div key={key} style={styles.specificationRow}>
                      <dt style={styles.specificationLabel}>
                        {key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ')}
                      </dt>
                      <dd style={styles.specificationValue}>
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {useCases.length > 0 && (
              <div>
                <h3 style={styles.detailHeading}>Use cases</h3>
                <ul style={styles.detailList}>
                  {useCases.map((useCase) => <li key={useCase}>{useCase}</li>)}
                </ul>
              </div>
            )}
            {tags.length > 0 && (
              <div>
                <h3 style={styles.detailHeading}>Tags</h3>
                <ul style={styles.tagList}>
                  {tags.map((tag) => <li key={tag} style={styles.tag}>{tag}</li>)}
                </ul>
              </div>
            )}
            {(pros.length > 0 || cons.length > 0) && (
              <div style={styles.prosCons}>
                {pros.length > 0 && (
                  <div>
                    <h3 style={styles.detailHeading}>Pros</h3>
                    <ul style={styles.detailList}>{pros.map((pro) => <li key={pro}>{pro}</li>)}</ul>
                  </div>
                )}
                {cons.length > 0 && (
                  <div>
                    <h3 style={styles.detailHeading}>Things to know</h3>
                    <ul style={styles.detailList}>{cons.map((con) => <li key={con}>{con}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
            {details.warranty && (
              <div>
                <h3 style={styles.detailHeading}>Warranty</h3>
                <p style={styles.description}>
                  {typeof details.warranty === 'string'
                    ? details.warranty
                    : JSON.stringify(details.warranty)}
                </p>
              </div>
            )}
            {details.dataQuality?.note && (
              <p style={styles.dataQualityNote}>{details.dataQuality.note}</p>
            )}
            {manufacturerSource && (
              <p style={styles.dataQualityNote}>
                Source:{' '}
                <a href={manufacturerSource} target="_blank" rel="noopener noreferrer">
                  Manufacturer information
                </a>
              </p>
            )}
          </section>
        )}

        {recommended.length > 0 && (
          <div style={styles.recommendedSection}>
            <h3 style={styles.recommendedTitle}>Recommended products</h3>
            <div className="recommended-products-grid" style={styles.recommendedGrid}>
              {recommended.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect && onSelect(item)}
                  style={styles.cardButton}
                >
                  <img
                    src={getImageUrl(item.image || 'uploads/products/hero1.jpeg')}
                    alt={item.name}
                    style={styles.cardImage}
                  />
                  <div style={styles.cardBody}>
                    <p style={styles.cardCategory}>{item.category || 'Popular'}</p>
                    <h4 style={styles.cardTitle}>{item.name}</h4>
                    <p style={styles.cardPrice}>₹{(item.price || 0).toLocaleString('en-IN')}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  pageShell: {
    width: '100%',
    minHeight: 'calc(100vh - 90px)',
    padding: '24px 16px 48px',
    background: 'transparent',
  },
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    background: 'var(--panel)',
    color: 'var(--text)',
    borderRadius: '24px',
    padding: '28px',
    boxShadow: 'var(--shadow)',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: '18px',
  },
  backButton: {
    border: '1px solid rgba(37, 99, 235, 0.28)',
    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    color: '#1d4ed8',
    borderRadius: '999px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.12)',
    transition: 'all 0.2s ease',
  },
  productLayout: {
    display: 'grid',
    gridTemplateColumns: '1.05fr 1.2fr',
    gap: '32px',
    alignItems: 'center',
  },
  imageBox: {
    position: 'relative',
    background: 'var(--soft)',
    borderRadius: '18px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '420px',
  },
  image: {
    width: '100%',
    maxHeight: '420px',
    borderRadius: '14px',
    objectFit: 'contain',
    padding: '10px',
    boxSizing: 'border-box',
  },
  imageBadge: {
    position: 'absolute',
    top: '28px',
    left: '28px',
    zIndex: 1,
    padding: '7px 10px',
    borderRadius: '999px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '11px',
    fontWeight: 800,
  },
  infoBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  category: {
    margin: 0,
    fontSize: '12px',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: '#2563eb',
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontSize: '32px',
    lineHeight: 1.2,
    color: 'var(--text)',
  },
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#f59e0b',
    fontWeight: 700,
  },
  stars: {
    letterSpacing: '2px',
  },
  reviews: {
    color: '#475569',
    fontSize: '14px',
    fontWeight: 600,
  },
  priceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '6px',
  },
  price: {
    fontSize: '30px',
    fontWeight: 800,
    color: 'var(--text)',
  },
  oldPrice: {
    fontSize: '18px',
    color: 'var(--muted)',
    textDecoration: 'line-through',
  },
  savings: {
    margin: '-4px 0 0',
    color: '#16a34a',
    fontSize: '13px',
    fontWeight: 800,
  },
  description: {
    margin: 0,
    color: 'var(--muted)',
    lineHeight: 1.7,
    fontSize: '15px',
  },
  featureList: {
    margin: '8px 0 0 0',
    paddingLeft: '18px',
    color: 'var(--muted)',
    display: 'grid',
    gap: '6px',
  },
  featureItem: {
    fontSize: '14px',
    lineHeight: 1.6,
  },
  brand: {
    margin: 0,
    color: 'var(--muted)',
    fontSize: '14px',
  },
  brandInfo: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px 12px',
  },
  brandLogo: {
    maxWidth: '72px',
    maxHeight: '32px',
    objectFit: 'contain',
  },
  brandLink: {
    color: 'var(--primary)',
    fontSize: '14px',
    fontWeight: 700,
    textDecoration: 'none',
  },
  brandDescription: {
    flexBasis: '100%',
    margin: 0,
    color: 'var(--muted)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  additionalDetails: {
    display: 'grid',
    gap: '24px',
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid var(--line)',
    color: 'var(--text)',
  },
  detailHeading: {
    margin: '0 0 12px',
    fontSize: '18px',
    color: 'var(--text)',
  },
  specificationList: {
    margin: 0,
    border: '1px solid var(--line)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  specificationRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 0.7fr) 1.3fr',
    gap: '16px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--line)',
  },
  specificationLabel: {
    color: 'var(--muted)',
    textTransform: 'capitalize',
  },
  specificationValue: {
    margin: 0,
    overflowWrap: 'anywhere',
  },
  detailList: {
    margin: 0,
    paddingLeft: '20px',
    display: 'grid',
    gap: '8px',
    color: 'var(--muted)',
    lineHeight: 1.6,
  },
  prosCons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '24px',
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  tag: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'var(--soft)',
    color: 'var(--muted)',
    fontSize: '13px',
  },
  dataQualityNote: {
    margin: 0,
    color: 'var(--muted)',
    fontSize: '13px',
    lineHeight: 1.6,
  },
  trustRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '2px',
  },
  actions: {
    display: 'flex',
    gap: '14px',
    marginTop: '10px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 'none',
    background: '#2563eb',
    color: '#ffffff',
    padding: '14px 24px',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid var(--line)',
    background: 'var(--soft)',
    color: 'var(--primary)',
    padding: '14px 24px',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
  },
  recommendedSection: {
    marginTop: '32px',
    borderTop: '1px solid var(--line)',
    paddingTop: '24px',
  },
  recommendedTitle: {
    margin: '0 0 16px 0',
    color: 'var(--text)',
    fontSize: '22px',
  },
  recommendedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '18px',
  },
  cardButton: {
    border: '1px solid var(--line)',
    borderRadius: '16px',
    background: 'var(--panel)',
    overflow: 'hidden',
    textAlign: 'left',
    cursor: 'pointer',
    padding: 0,
    boxShadow: 'var(--shadow)',
  },
  cardImage: {
    width: '100%',
    height: '180px',
    objectFit: 'contain',
    padding: '10px',
    boxSizing: 'border-box',
    display: 'block',
  },
  cardBody: {
    padding: '14px 14px 16px',
  },
  cardCategory: {
    margin: '0 0 8px 0',
    color: '#3b82f6',
    fontSize: '11px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  cardTitle: {
    margin: '0 0 8px 0',
    color: 'var(--text)',
    fontSize: '16px',
    minHeight: '40px',
  },
  cardPrice: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '18px',
    fontWeight: 800,
  },
}

export default ProductDetails
