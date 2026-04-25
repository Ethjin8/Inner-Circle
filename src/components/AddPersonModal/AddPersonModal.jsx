import { useEffect, useState } from 'react';
import './AddPersonModal.css';

const STARDUST_PARTICLES = 28;

function generateParticles() {
  return Array.from({ length: STARDUST_PARTICLES }, (_, i) => {
    const angle = (i / STARDUST_PARTICLES) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 60 + Math.random() * 60;
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      delay: Math.random() * 60,
    };
  });
}

export default function AddPersonModal({ open, onClose }) {
  const [listening, setListening] = useState(false);
  const [bursting, setBursting] = useState(false);
  const [particles, setParticles] = useState([]);

  const handleClose = () => {
    setListening(false);
    setBursting(false);
    setParticles([]);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleProbeToggle = () => {
    if (listening) {
      setListening(false);
      setParticles(generateParticles());
      setBursting(true);
      setTimeout(() => {
        setBursting(false);
        setParticles([]);
      }, 720);
    } else {
      setListening(true);
    }
  };

  if (!open) return null;

  return (
    <div className="apm-backdrop" onClick={handleClose} role="presentation">
      <div
        className="apm-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add a person"
      >
        <button className="apm-close" onClick={handleClose} aria-label="Close">
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
          {listening && (
            <svg className="apm-flares" width="220" height="220" viewBox="0 0 220 220" aria-hidden>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <circle
                  key={i}
                  cx="110"
                  cy="110"
                  r={70 + i * 8}
                  fill="none"
                  stroke="rgba(232, 232, 240, 0.5)"
                  strokeWidth="1"
                  strokeDasharray="6 380"
                  strokeLinecap="round"
                  className="apm-flare-arc"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </svg>
          )}

          {bursting && (
            <div className="apm-stardust" aria-hidden>
              {particles.map((p, i) => (
                <span
                  key={i}
                  className="apm-stardust-particle"
                  style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, animationDelay: `${p.delay}ms` }}
                />
              ))}
            </div>
          )}

          <button
            className={`apm-probe ${listening ? 'listening' : ''}`}
            onClick={handleProbeToggle}
            aria-pressed={listening}
            aria-label={listening ? 'Stop listening' : 'Start listening'}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19 L4 24" />
              <path d="M22 6 L26 4" />
              <path d="M22 6 L20 8" />
              <path d="M9 19 a 9 9 0 0 1 0 -12.7 L21.7 19 a 9 9 0 0 1 -12.7 0 Z" />
              <circle cx="22" cy="6" r="1.6" fill="currentColor" />
            </svg>
          </button>
          <div className={`apm-status ${listening ? 'live' : ''}`}>
            {listening ? 'Listening…' : bursting ? 'Charting…' : 'Tap probe to start'}
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
