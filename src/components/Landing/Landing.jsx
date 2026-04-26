import { useEffect, useRef, useState, useMemo } from 'react';
import { allocateConstellations } from './allocateConstellations';
import { layoutConstellations } from './layoutConstellations';
import { RELATIONSHIP_TYPES } from '../../constants/personSchema';
import { useAuth } from '../../contexts/AuthContext';
import './Landing.css';
import '../SignIn/SignIn.css';

const generateDemoPeople = (count) => {
  const types = RELATIONSHIP_TYPES.map((t) => t.key);
  return Array.from({ length: count }, (_, i) => ({
    id: `demo-${i}`,
    name: `Demo ${i + 1}`,
    relType: types[i % types.length],
  }));
};

const drawSkyGradient = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#020108');
  g.addColorStop(0.45, '#0a0820');
  g.addColorStop(1, '#1a0e2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};

const drawConstellation = (ctx, group) => {
  const { stars, edges, label, cx, size } = group;

  ctx.strokeStyle = 'rgba(180, 200, 255, 0.32)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const [a, b] of edges) {
    const sa = stars[a]; const sb = stars[b];
    if (!sa || !sb) continue;
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
  }
  ctx.stroke();

  for (const s of stars) {
    const [r, g, b] = hexToRgb(s.color);
    const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 14);
    halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.55)`);
    halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(s.x - 14, s.y - 14, 28, 28);

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (label) {
    let maxY = -Infinity;
    for (const s of stars) if (s.y > maxY) maxY = s.y;
    ctx.fillStyle = 'rgba(220, 230, 255, 0.55)';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, maxY + size * 0.12);
  }
};

const generateBackgroundStars = (count, w, h) => {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.4 + Math.random() * 1.1,
      a: 0.25 + Math.random() * 0.55,
      tw: Math.random() * Math.PI * 2,
    });
  }
  return stars;
};

const drawBackgroundStars = (ctx, stars, t) => {
  for (const s of stars) {
    const flicker = 0.7 + 0.3 * Math.sin(t * 0.001 + s.tw);
    ctx.fillStyle = `rgba(220, 230, 255, ${s.a * flicker})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawNorthStar = (ctx, w, h, t, yRatio = 0.45) => {
  const x = w / 2;
  const y = h * yRatio;
  const pulse = 0.75 + 0.25 * Math.sin(t * 0.0008);

  const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, 70 * pulse);
  outerGlow.addColorStop(0, `rgba(255, 255, 255, ${0.18 * pulse})`);
  outerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = outerGlow;
  ctx.fillRect(x - 70, y - 70, 140, 140);

  const innerGlow = ctx.createRadialGradient(x, y, 0, x, y, 14 * pulse);
  innerGlow.addColorStop(0, `rgba(255, 255, 255, ${0.85 * pulse})`);
  innerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = innerGlow;
  ctx.fillRect(x - 14, y - 14, 28, 28);

  ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * pulse})`;
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
};

export default function Landing({ onEnter, user, people = [] }) {
  const { signInWithGoogle } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authClosing, setAuthClosing] = useState(false);
  const showAuthRef = useRef(false);
  const authCloseTimerRef = useRef(null);
  useEffect(() => { showAuthRef.current = showAuth; }, [showAuth]);

  const closeAuth = () => {
    setAuthClosing(true);
    clearTimeout(authCloseTimerRef.current);
    authCloseTimerRef.current = setTimeout(() => {
      setShowAuth(false);
      setAuthClosing(false);
    }, 240);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [zooming, setZooming] = useState(false);
  const canvasRef = useRef(null);
  const zoomTimerRef = useRef(null);
  const zoomingRef = useRef(false);

  const triggerEnter = () => {
    if (zoomingRef.current) return;
    zoomingRef.current = true;
    setZooming(true);
    onEnter();
  };

  const handleLandingClick = () => {
    if (zoomingRef.current) return;
    if (user) triggerEnter();
    else if (showAuthRef.current) closeAuth();
    else setShowAuth(true);
  };
  const stateRef = useRef({
    constellations: [],
    bgStars: [],
  });

  const [demoCount, setDemoCount] = useState(0);
  const [demoInput, setDemoInput] = useState(20);
  const effectivePeople = demoCount > 0 ? generateDemoPeople(demoCount) : people;
  const groups = useMemo(
    () => {
      const show = demoCount > 0 || (user && people.length > 0);
      return show ? allocateConstellations(effectivePeople) : [];
    },
    [user, people, demoCount, effectivePeople],
  );
  const groupsRef = useRef(groups);
  const effectivePeopleRef = useRef(effectivePeople);
  const layoutRef = useRef(null);
  useEffect(() => {
    groupsRef.current = groups;
    effectivePeopleRef.current = effectivePeople;
    layoutRef.current?.();
  }, [groups, effectivePeople]);

  const prevUserRef = useRef(user);
  useEffect(() => {
    if (user && prevUserRef.current === null) triggerEnter();
    prevUserRef.current = user ?? null;
    return () => clearTimeout(zoomTimerRef.current);
  }, [user]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const layout = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const overlay = document.querySelector('.landing-overlay');
      const rect = overlay ? overlay.getBoundingClientRect() : null;
      stateRef.current.constellations = layoutConstellations(groupsRef.current, w, h, rect);
      const peopleCount = effectivePeopleRef.current.length;
      stateRef.current.bgStars = generateBackgroundStars(peopleCount * 15, w, h);
    };
    layoutRef.current = layout;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
    };
    resize();

    window.addEventListener('resize', resize);

    let raf;
    const render = (t) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const { constellations } = stateRef.current;

      ctx.clearRect(0, 0, w, h);
      drawSkyGradient(ctx, w, h);
      drawBackgroundStars(ctx, stateRef.current.bgStars, t);
      const flying = zoomingRef.current;
      for (const c of constellations) {
        if (flying) {
          if (!c.dustInit) {
            c.dustInit = true;
            c.snapStart = t;
            for (const s of c.stars) {
              const wx = Math.sin(t * s.freqX + s.phaseX) * s.amp;
              const wy = Math.cos(t * s.freqY + s.phaseY) * s.amp;
              s.x = c.cx + (s.ux - 0.5) * c.size + wx;
              s.y = c.cy + (s.uy - 0.5) * c.size + wy;
              s.dvx = (Math.random() - 0.5) * 1.2;
              s.dvy = -0.4 - Math.random() * 1.2;
            }
          }
          const elapsed = t - c.snapStart;
          const edgeAlpha = Math.max(0, 1 - elapsed / 180);
          if (edgeAlpha > 0) {
            ctx.strokeStyle = `rgba(180, 200, 255, ${0.32 * edgeAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            for (const [a, b] of c.edges) {
              const sa = c.stars[a]; const sb = c.stars[b];
              if (!sa || !sb) continue;
              const j = (Math.random() - 0.5) * (1 - edgeAlpha) * 8;
              ctx.moveTo(sa.x + j, sa.y + j);
              ctx.lineTo(sb.x - j, sb.y - j);
            }
            ctx.stroke();
          }
          const dustAlpha = Math.max(0, 1 - elapsed / 1400);
          for (const s of c.stars) {
            s.dvy -= 0.015;
            s.x += s.dvx;
            s.y += s.dvy;
            const [r, g, bl] = hexToRgb(s.color);
            const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 8);
            halo.addColorStop(0, `rgba(${r}, ${g}, ${bl}, ${0.5 * dustAlpha})`);
            halo.addColorStop(1, `rgba(${r}, ${g}, ${bl}, 0)`);
            ctx.fillStyle = halo;
            ctx.fillRect(s.x - 8, s.y - 8, 16, 16);
            ctx.fillStyle = `rgba(${r}, ${g}, ${bl}, ${dustAlpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          c.cx += c.vx;
          c.cy += c.vy;
          const half = c.size / 2;
          if (c.cx - half < c.xMin) { c.cx = c.xMin + half; c.vx = -c.vx; }
          if (c.cx + half > c.xMax) { c.cx = c.xMax - half; c.vx = -c.vx; }
          if (c.cy - half < c.yMin) { c.cy = c.yMin + half; c.vy = -c.vy; }
          if (c.cy + half > c.yMax) { c.cy = c.yMax - half; c.vy = -c.vy; }
          for (const s of c.stars) {
            const wx = Math.sin(t * s.freqX + s.phaseX) * s.amp;
            const wy = Math.cos(t * s.freqY + s.phaseY) * s.amp;
            s.x = c.cx + (s.ux - 0.5) * c.size + wx;
            s.y = c.cy + (s.uy - 0.5) * c.size + wy;
          }
          drawConstellation(ctx, c);
        }
      }
      drawNorthStar(ctx, w, h, t, 0.45);

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      layoutRef.current = null;
      window.removeEventListener('resize', resize);
    };
  }, [onEnter]);

  const handleSignIn = async () => {
    setError(''); setBusy(true);
    try { await signInWithGoogle(); }
    catch (err) { setError(err?.message || 'Sign-in failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`landing ${zooming ? 'zooming' : ''}`} onClick={handleLandingClick} role="presentation">
      <canvas ref={canvasRef} className="landing-canvas" />
      <img src="/foreground.png" alt="" className="landing-foreground" />
      <div className="landing-flash" />
      <div className="landing-demo" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          min="0"
          max="100"
          value={demoInput}
          onChange={(e) => setDemoInput(Number(e.target.value) || 0)}
        />
        <button onClick={() => setDemoCount(demoInput)}>Load demo</button>
        {demoCount > 0 && <button onClick={() => setDemoCount(0)}>Clear</button>}
      </div>
      {showAuth && !user ? (
        <div className={`signin-panel ${authClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="signin-logo">
            <svg width="32" height="32" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="0.9" opacity="0.85" />
              <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
              <line x1="0.8" y1="7" x2="13.2" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
              <line x1="7" y1="0.8" x2="7" y2="13.2" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
              <circle cx="7" cy="7" r="1" fill="currentColor" />
            </svg>
          </div>
          <h1 className="signin-title">Inner Circle</h1>
          <p className="signin-subtitle">A constellation of the people who matter.</p>
          <button className="signin-google" onClick={handleSignIn} disabled={busy}>
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
      ) : (
        <>
          <div className="landing-overlay">
            <h1 className="landing-wordmark">Inner Circle</h1>
            <p className="landing-tagline">Stay in touch with the people who matter most.</p>
          </div>
          <div className="landing-hint">Click anywhere to enter</div>
        </>
      )}
    </div>
  );
}
