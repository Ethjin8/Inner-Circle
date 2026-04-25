import { useEffect, useRef, useState } from 'react';
import { CONSTELLATIONS } from './constellations';
import { useAuth } from '../../contexts/AuthContext';
import './Landing.css';
import '../SignIn/SignIn.css';

const STAR_COUNT = 240;
const HOVER_RADIUS = 70;
const CONSTELLATION_HOVER_PADDING = 50;
const SHOOTING_INTERVAL_MS = 3500;

const buildConstellations = (w, h) => {
  const base = Math.min(w, h);
  return CONSTELLATIONS.map((c, index) => {
    const size = c.scale * base;
    const cx = c.pos.cx * w;
    const cy = c.pos.cy * h;
    const stars = c.stars.map(([ux, uy]) => ({
      x: cx + (ux - 0.5) * size,
      y: cy + (uy - 0.5) * size,
    }));
    return { name: c.name, index, stars, edges: c.edges, litT: 0 };
  });
};

const FADE_SPEED = 0.018; // per frame, ~1.5s to settle

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const findHoveredConstellation = (constellations, mx, my) => {
  for (const c of constellations) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of c.stars) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    const pad = CONSTELLATION_HOVER_PADDING;
    if (mx >= minX - pad && mx <= maxX + pad && my >= minY - pad && my <= maxY + pad) {
      return c.index;
    }
  }
  return null;
};

const AMBIENT_EXCLUSION = 28;

const tooCloseToConstellation = (x, y, constellations) => {
  for (const c of constellations) {
    for (const s of c.stars) {
      if (Math.hypot(s.x - x, s.y - y) < AMBIENT_EXCLUSION) return true;
    }
  }
  return false;
};

const generateAmbientStars = (w, h, count, constellations) => {
  const stars = [];
  let tries = 0;
  while (stars.length < count && tries < count * 8) {
    tries += 1;
    const x = Math.random() * w;
    const y = Math.random() * h * 0.85;
    if (tooCloseToConstellation(x, y, constellations)) continue;
    stars.push({
      x,
      y,
      r: Math.random() * 1.2 + 0.25,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.8,
    });
  }
  return stars;
};

const spawnShootingStar = (w, h) => {
  const fromLeft = Math.random() < 0.5;
  return {
    x: fromLeft ? -80 : w + 80,
    y: Math.random() * h * 0.5,
    vx: fromLeft ? 9 : -9,
    vy: 2.4,
    life: 1,
  };
};

const proximity = (sx, sy, mx, my, radius) => {
  const d = Math.hypot(sx - mx, sy - my);
  return Math.max(0, 1 - d / radius);
};

const drawSkyGradient = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#020108');
  g.addColorStop(0.45, '#0a0820');
  g.addColorStop(1, '#1a0e2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

const drawStarGlow = (ctx, x, y, radius, alpha) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(255, 220, 130, ${alpha})`);
  g.addColorStop(1, 'rgba(255, 220, 130, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
};

const drawNorthStar = (ctx, w, h, t) => {
  const x = w / 2;
  const y = h / 4;
  const pulse = 0.75 + 0.25 * Math.sin(t * 0.0008);

  const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, 70 * pulse);
  outerGlow.addColorStop(0, `rgba(255, 220, 130, ${0.18 * pulse})`);
  outerGlow.addColorStop(1, 'rgba(255, 220, 130, 0)');
  ctx.fillStyle = outerGlow;
  ctx.fillRect(x - 70, y - 70, 140, 140);

  const innerGlow = ctx.createRadialGradient(x, y, 0, x, y, 14 * pulse);
  innerGlow.addColorStop(0, `rgba(255, 245, 190, ${0.85 * pulse})`);
  innerGlow.addColorStop(1, 'rgba(255, 220, 130, 0)');
  ctx.fillStyle = innerGlow;
  ctx.fillRect(x - 14, y - 14, 28, 28);

  ctx.fillStyle = `rgba(255, 252, 230, ${0.95 * pulse})`;
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
};

const drawStar = (ctx, x, y, r, lit, alpha = 1) => {
  const g = Math.round(255 - 50 * lit);
  const b = Math.round(255 - 150 * lit);
  ctx.fillStyle = `rgba(255, ${g}, ${b}, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

export default function Landing({ onEnter, user }) {
  const { signInWithGoogle } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
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
  const stateRef = useRef({
    mouse: { x: -9999, y: -9999 },
    ambient: [],
    shooting: [],
    constellations: [],
  });

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

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stateRef.current.constellations = buildConstellations(w, h);
      stateRef.current.ambient = generateAmbientStars(
        w,
        h,
        STAR_COUNT,
        stateRef.current.constellations,
      );
    };
    resize();

    const onMove = (e) => {
      stateRef.current.mouse = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      stateRef.current.mouse = { x: -9999, y: -9999 };
    };
    const onClick = () => {
      if (zoomingRef.current) return;
      if (user) triggerEnter();
      else setShowAuth(true);
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('click', onClick);

    // const shootingTimer = setInterval(() => {
    //   stateRef.current.shooting.push(
    //     spawnShootingStar(window.innerWidth, window.innerHeight)
    //   );
    // }, SHOOTING_INTERVAL_MS);

    let raf;
    const render = (t) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const { mouse, ambient, constellations } = stateRef.current;

      ctx.clearRect(0, 0, w, h);
      drawSkyGradient(ctx, w, h);
      drawNorthStar(ctx, w, h, t);

      // // Ambient stars
      // ambient.forEach((s) => {
      //   const prox = proximity(s.x, s.y, mouse.x, mouse.y, HOVER_RADIUS);
      //   const twinkle = 0.6 + 0.4 * Math.sin(t * 0.001 * s.speed + s.phase);
      //   const r = s.r * (1 + prox * 1.4);
      //   if (prox > 0.08) drawStarGlow(ctx, s.x, s.y, r * 5, prox * 0.55);
      //   drawStar(ctx, s.x, s.y, r, prox, twinkle);
      // });

      // // Constellations: ease toward hovered state with slow reverse-burst-fade.
      // const hovered = findHoveredConstellation(constellations, mouse.x, mouse.y);
      // constellations.forEach((c) => {
      //   const target = c.index === hovered ? 1 : 0;
      //   c.litT += (target - c.litT) * FADE_SPEED;
      // });

      // // Lines: opacity follows litT.
      // constellations.forEach((c) => {
      //   const e = easeInOutCubic(Math.max(0, Math.min(1, c.litT)));
      //   if (e < 0.02) return;
      //   ctx.strokeStyle = `rgba(255, 220, 130, ${0.75 * e})`;
      //   ctx.lineWidth = 1.2;
      //   ctx.shadowColor = `rgba(255, 220, 130, ${0.55 * e})`;
      //   ctx.shadowBlur = 10 * e;
      //   ctx.beginPath();
      //   c.edges.forEach(([a, b]) => {
      //     ctx.moveTo(c.stars[a].x, c.stars[a].y);
      //     ctx.lineTo(c.stars[b].x, c.stars[b].y);
      //   });
      //   ctx.stroke();
      //   ctx.shadowBlur = 0;
      // });

      // // Stars + reverse-burst ring during transition.
      // constellations.forEach((c) => {
      //   const e = easeInOutCubic(Math.max(0, Math.min(1, c.litT)));
      //   c.stars.forEach((s) => {
      //     const localProx = proximity(s.x, s.y, mouse.x, mouse.y, HOVER_RADIUS);
      //     const lit = Math.max(localProx, e);
      //     const baseR = 1.8;
      //     const r = baseR * (1 + lit * 1.6);

      //     // Reverse burst: a ring contracts inward as the constellation lights up.
      //     const burstAlpha = Math.sin(Math.PI * e) * 0.55;
      //     if (burstAlpha > 0.02) {
      //       const burstR = (1 - e) * 32 + 6;
      //       const ring = ctx.createRadialGradient(s.x, s.y, burstR * 0.4, s.x, s.y, burstR);
      //       ring.addColorStop(0, 'rgba(255, 220, 130, 0)');
      //       ring.addColorStop(0.7, `rgba(255, 220, 130, ${burstAlpha})`);
      //       ring.addColorStop(1, 'rgba(255, 220, 130, 0)');
      //       ctx.fillStyle = ring;
      //       ctx.fillRect(s.x - burstR, s.y - burstR, burstR * 2, burstR * 2);
      //     }

      //     if (lit > 0.05) drawStarGlow(ctx, s.x, s.y, r * 5, lit * 0.55);
      //     drawStar(ctx, s.x, s.y, r, lit);
      //   });
      // });

      // canvas.style.cursor = hovered !== null ? 'pointer' : 'default';

      // // Shooting stars
      // const next = [];
      // for (const ss of stateRef.current.shooting) {
      //   const x = ss.x + ss.vx;
      //   const y = ss.y + ss.vy;
      //   const life = ss.life - 0.005;
      //   if (life > 0 && x > -200 && x < w + 200) next.push({ ...ss, x, y, life });
      // }
      // stateRef.current.shooting = next;

      // stateRef.current.shooting.forEach((ss) => {
      //   const tailX = ss.x - ss.vx * 10;
      //   const tailY = ss.y - ss.vy * 10;
      //   const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
      //   grad.addColorStop(0, `rgba(255, 245, 220, ${ss.life})`);
      //   grad.addColorStop(1, 'rgba(255, 245, 220, 0)');
      //   ctx.strokeStyle = grad;
      //   ctx.lineWidth = 1.8;
      //   ctx.beginPath();
      //   ctx.moveTo(ss.x, ss.y);
      //   ctx.lineTo(tailX, tailY);
      //   ctx.stroke();
      // });

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      // clearInterval(shootingTimer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('click', onClick);
    };
  }, [onEnter]);

  const handleSignIn = async () => {
    setError(''); setBusy(true);
    try { await signInWithGoogle(); }
    catch (err) { setError(err?.message || 'Sign-in failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`landing ${zooming ? 'zooming' : ''}`}>
      <canvas ref={canvasRef} className="landing-canvas" />
      <img src="/foreground.png" alt="" className="landing-foreground" />
      <div className="landing-flash" />
      {showAuth && !user ? (
        <div className="signin-panel" onClick={(e) => e.stopPropagation()}>
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
        <div className="landing-hint">Click anywhere to enter</div>
      )}
    </div>
  );
}
