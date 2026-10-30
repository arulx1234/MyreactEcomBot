import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api/client';

export default function Signup({ onSignup }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (event) => {
  const { name, value } = event.target;
  setForm((current) => ({ ...current, [name]: value }));
};

// Google Sign-In
const handleGoogleSignup = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);

    const data = await api.googleLogin(await result.user.getIdToken());
    saveSession(data);

    if (onSignup) onSignup(data.user);

    alert(`Welcome ${result.user.displayName}!`);
  } catch (error) {
    console.error("Google sign-in error:", error);
    alert("Google sign-in failed. Please try again.");
  }
};

const handleSubmit = async (event) => {
  event.preventDefault();

  const { fullName, email, password, confirmPassword } = form;

  if (
    !fullName.trim() ||
    !email.trim() ||
    !password.trim() ||
    !confirmPassword.trim()
  ) {
    setMessage({
      text: 'Please fill in all fields to create your account.',
      color: '#b91c1c',
    });
    return;
  }

  if (password !== confirmPassword) {
    setMessage({
      text: 'Passwords do not match. Please re-enter them.',
      color: '#b91c1c',
    });
    return;
  }

  try {
    await api.signup({
      name: fullName.trim(),
      email: email.trim(),
      password,
    });
    const loginData = await api.login({ email: email.trim(), password });
    saveSession(loginData);

    setMessage({
      text: 'Account created successfully!',
      color: '#15803d',
    });

    if (onSignup) onSignup(loginData.user);
  } catch (error) {
    console.error('Signup error:', error);

    setMessage({
      text: error.message || 'Unable to create your account. Please try again.',
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
            <span className="eyebrow">Create account</span>
            <h1>Join and start your shopping journey</h1>
            <p>Discover new arrivals, save your favorites, and order faster with a personalized account.</p>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-topbar">
            <button className="back-shop-btn" type="button" onClick={() => navigate('/')}>
              Back to shop
            </button>
          </div>

          <div className="login-form-box">
            <h2>Sign up</h2>
            <p>Create your free account</p>

            <form className="login-form" onSubmit={handleSubmit}>
              <label>
                Full name
                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                />
              </label>

              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                />
              </label>

              <label>
                Password
                <div className="password-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Create a password"
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

              <label>
                Confirm password
                <div className="password-input-wrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    className="password-visibility-toggle"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showConfirmPassword}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                      <circle cx="12" cy="12" r="2.75" />
                    </svg>
                  </button>
                </div>
              </label>

              <button type="submit" className="login-submit">Create account</button>
              <button type="button" className="login-submit" onClick={handleGoogleSignup}>
                Continue with Google
              </button>
            </form>

            <p style={{ marginTop: '18px', color: '#6b7280' }}>
              Already have an account?{' '}
              <button type="button" className="text-link" onClick={() => navigate('/login')}>
                Login here
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
