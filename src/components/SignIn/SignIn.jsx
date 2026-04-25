import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import StarField from '../Graph/StarField';
import './SignIn.css';

export default function SignIn() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  const handleSignIn = async () => {
    setError(''); setBusy(true);
    try { await signInWithGoogle(); }
    catch (err) { setError(err?.message || 'Sign-in failed.'); }
    finally     { setBusy(false); }
  };

  return (
    <div className="signin-stage">
      <StarField />
      <div className="signin-panel">
        <div className="signin-logo">
          <svg width="32" height="32" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6"   stroke="currentColor" strokeWidth="0.9" opacity="0.85" />
            <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
            <line x1="0.8" y1="7" x2="13.2" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
            <line x1="7" y1="0.8" x2="7" y2="13.2" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
            <circle cx="7" cy="7" r="1" fill="currentColor" />
          </svg>
        </div>
        <h1 className="signin-title">Inner Circle</h1>
        <p className="signin-subtitle">A constellation of the people who matter.</p>

        <button
          className="signin-google"
          onClick={handleSignIn}
          disabled={busy}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.32A8.99 8.99 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.92A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.92 4.04l3.05-2.32z" fill="#FBBC05"/>
            <path d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.95 8.95 0 0 0 9 0 8.99 8.99 0 0 0 .92 4.96l3.05 2.32C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {busy ? 'Signing in...' : 'Continue with Google'}
        </button>

        {error && <div className="signin-error">{error}</div>}
      </div>
    </div>
  );
}
