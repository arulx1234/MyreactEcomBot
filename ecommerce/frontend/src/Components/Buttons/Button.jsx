function Button({ children, type = 'button', variant = 'primary', style, ...props }) {
  const baseStyle = {
    border: 'none',
    borderRadius: '12px',
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ...style,
  }

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      color: '#fff',
      boxShadow: '0 12px 24px rgba(79, 70, 229, 0.22)',
    },
    success: {
      background: 'linear-gradient(135deg, #16a34a, #15803d)',
      color: '#fff',
      boxShadow: '0 12px 24px rgba(22, 163, 74, 0.2)',
    },
    secondary: {
      background: '#e2e8f0',
      color: '#1f2937',
    },
  }

  return (
    <button
      type={type}
      {...props}
      style={{ ...baseStyle, ...variants[variant] }}
    >
      {children}
    </button>
  )
}

export default Button
