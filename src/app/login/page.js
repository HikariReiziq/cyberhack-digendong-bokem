'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import './login.css';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { user, login, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('session') === 'expired' && user) {
      logout();
      setError('Your session has expired. Please sign in again.');
      // Remove query param from URL without refreshing
      router.replace('/login');
      return;
    }

    if (user && searchParams.get('session') !== 'expired') {
      router.push('/dashboard');
    }
  }, [user, router, searchParams, logout]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email dan password harus diisi');
      return;
    }
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error);
    }
  }

  if (user && searchParams.get('session') !== 'expired') return null;

  return (
    <div className="auth-container">
      {/* Left Panel: Sign In Form */}
      <div className="auth-form-side">
        <div className="auth-form-wrapper">
          {/* Back Button */}
          <Link href="/" className="back-link" aria-label="Back to home">
            <span className="back-link-icon">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 1L1 4L4 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 4H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <span>Back</span>
          </Link>

          {/* Header */}
          <div className="auth-header">
            <h1 className="auth-title">Sign In</h1>
            <p className="auth-subtitle">Sign In to your AromaSys account</p>
          </div>

          {/* Error Message */}
          {error && <div className="auth-error-message">{error}</div>}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form-element">
            {/* Email Outlined Input */}
            <div className="material-input-group">
              <input
                id="login-email"
                type="email"
                placeholder="john.doe@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <label htmlFor="login-email">Email</label>
            </div>

            {/* Password Outlined Input with eye toggle */}
            <div className="material-input-group">
              <div className="material-input-group-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="•••••••••••••••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="icon-suffix"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <label htmlFor="login-password">Password</label>
            </div>

            {/* Role Dropdown */}
            <div className="material-input-group">
              <select
                id="login-role"
                value={role}
                onChange={e => setRole(e.target.value)}
                required
              >
                <option value="" disabled hidden>Select a role...</option>
                <option value="Operator">Operator</option>
                <option value="QC">QC (Quality Control)</option>
                <option value="PPIC">PPIC (Production Planning)</option>
                <option value="Admin">Admin</option>
              </select>
              <label htmlFor="login-role">Role</label>
            </div>

            {/* Actions: Remember me & Forgot Password */}
            <div className="auth-actions-row">
              <label className="auth-remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <Link href="#" className="auth-forgot-link">
                Forgot Password
              </Link>
            </div>

            {/* CTA Button */}
            <button type="submit" className="auth-btn-submit">
              Sign In
            </button>
          </form>

          {/* Switch page */}
          <div className="auth-footer-nav">
            <span>Don&apos;t have an account? </span>
            <Link href="/register" className="auth-switch-link">
              Sign Up
            </Link>
          </div>
        </div>
      </div>

      {/* Right Panel: Atmospheric Essential Oils Image */}
      <div
        className="auth-image-side curve-left"
        style={{ backgroundImage: 'url("/login_bg.png")' }}
        aria-hidden="true"
      >
        <span className="auth-overlay-tagline">
          Smart Warehouse, Smarter Decisions
        </span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#e0e7df' }}><div className="spinner spinner-lg"></div></div>}>
      <LoginContent />
    </Suspense>
  );
}
