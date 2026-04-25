import { useEffect, useState } from 'react';
import './AddPersonModal.css';

export default function AddPersonModal({ open, onClose }) {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setListening(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="apm-backdrop" onClick={onClose} role="presentation">
      <div
        className="apm-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add a person"
      >
        <button className="apm-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="apm-header">
          <div className="apm-eyebrow">Voice onboarding</div>
          <h2 className="apm-title">Tell me about someone</h2>
          <p className="apm-subtitle">
            Just talk — who they are, how you know them, anything you want to remember. I'll add them to your graph.
          </p>
        </div>

        <div className="apm-mic-wrap">
          <button
            className={`apm-mic ${listening ? 'listening' : ''}`}
            onClick={() => setListening((v) => !v)}
            aria-pressed={listening}
            aria-label={listening ? 'Stop listening' : 'Start listening'}
          >
            {listening && <span className="apm-mic-pulse" aria-hidden />}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
            </svg>
          </button>
          <div className={`apm-status ${listening ? 'live' : ''}`}>
            {listening ? 'Listening…' : 'Tap to start'}
          </div>
        </div>

        <div className="apm-hints">
          <div className="apm-hint-label">Try saying</div>
          <ul className="apm-hint-list">
            <li>"My friend Jake from CS 31 — we've known each other since freshman year."</li>
            <li>"Add my mom. Her birthday is March 18th and she loves gardening."</li>
            <li>"Lily, my girlfriend. We met at a coffee shop near campus."</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
