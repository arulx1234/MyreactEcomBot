import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleGoogleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);

    console.log("Google user:", result.user);

    if (onLogin) {
      onLogin(result.user.email);
    }

    alert(`Welcome back, ${result.user.displayName}!`);
  } catch (error) {
    console.error("Google login error:", error);
    alert("Google login failed. Please try again.");
  }
};

  const handleSubmit = async (e) => {
  e.preventDefault();

  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    setMessage({
      text: 'Please enter your email.',
      color: '#b91c1c',
    });
    return;
  }

  if (!password.trim()) {
    setMessage({
      text: 'Please enter your password.',
      color: '#b91c1c',
    });
    return;
  }

  try {
    const response = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: trimmedEmail,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage({
        text: data.message || 'Invalid email or password.',
        color: '#b91c1c',
      });
      return;
    }

    setMessage({
      text: `Welcome back, ${data.user.name}!`,
      color: '#15803d',
    });

    if (onLogin) {
      onLogin(data.user);
    }
    setMessage({
      text: `Welcome back, ${data.user.name}!`,
      color: '#15803d',
    });
  } catch (error) {
    console.error('Login error:', error);

    setMessage({
      text: 'Unable to connect to the server. Please try again.',
      color: '#b91c1c',
    });
  }
};

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-brand-panel">
          <div className="brand-header">
            <img src="/images/logo.png" alt="Aro.D.Buy" className="login-logo" />
          </div>
          <div className="brand-copy">
            <span className="eyebrow">Welcome back</span>
            <h1>Sign in to continue shopping</h1>
            <p>Access your wishlist, saved carts, orders and exclusive deals with one secure account.</p>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-topbar">
            <button className="back-shop-btn" type="button" onClick={() => navigate('/')}>Back to shop</button>
          </div>

          <div className="login-form-box">
            <h2>Login</h2>
            <p>Use your email to access your account</p>

            <form className="login-form" onSubmit={handleSubmit}>
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </label>

              <div className="login-options">
                <label className="remember-me">
                  <input type="checkbox" />
                  Remember me
                </label>
                <button type="button" className="text-link">Forgot password?</button>
              </div>

              <button type="submit" className="login-submit">Login</button>
              <button type="button" className="login-submit" onClick={handleGoogleLogin}>
                 Continue with Google
              </button>
            </form>

            <p style={{ marginTop: '18px', color: '#6b7280' }}>
              New here?{' '}
              <button type="button" className="text-link" onClick={() => navigate('/signup')}>
                Create an account
              </button>
            </p>

            {message && (
              <p style={{ color: message.color, marginTop: '16px' }} className="login-message">
                {message.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
