import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api/client';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

    googleProvider.setCustomParameters({
      prompt: 'select_account',
    });
  const handleGoogleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);

    console.log("Google user:", result.user);

   const data = await api.googleLogin(await result.user.getIdToken());
   saveSession(data);

if (onLogin) {
  onLogin(data.user);
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
    const data = await api.login({ email: trimmedEmail, password });
    saveSession(data);

    setMessage({
      text: `Welcome back, ${data.user.name}!`,
      color: '#15803d',
    });

    if (onLogin) {
      onLogin(data.user);
    }
     
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
                <div className="password-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="password-visibility-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                      <circle cx="12" cy="12" r="2.75" />
                    </svg>
                  </button>
                </div>
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
