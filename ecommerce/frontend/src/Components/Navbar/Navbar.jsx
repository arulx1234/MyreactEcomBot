import { Link } from 'react-router-dom'

function Navbar({ cartCount = 0, wishlistCount = 0, isLoggedIn = false }) {
  return (
    <header style={styles.header}>
      <div style={styles.container}>
        <Link to="/" style={styles.logo}>Aro.D.Buy</Link>

        <nav style={styles.nav}>
          <Link to="/" style={styles.link}>Home</Link>
          <Link to="/cart" style={styles.link}>Cart ({cartCount})</Link>
          <Link to="/wishlist" style={styles.link}>Wishlist ({wishlistCount})</Link>
          <Link to={isLoggedIn ? '/orders' : '/login'} style={styles.link}>
            {isLoggedIn ? 'Orders' : 'Login'}
          </Link>
        </nav>
      </div>
    </header>
  )
}

const styles = {
  header: {
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  logo: {
    color: '#1f2937',
    fontSize: '1.3rem',
    fontWeight: 800,
    textDecoration: 'none',
    letterSpacing: '0.02em',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    flexWrap: 'wrap',
  },
  link: {
    color: '#374151',
    textDecoration: 'none',
    fontWeight: 600,
  },
}

export default Navbar
