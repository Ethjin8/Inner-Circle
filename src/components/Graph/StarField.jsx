import { useRef, useEffect } from 'react';

const STAR_COUNT_DESKTOP = 120;
const NEBULA_COUNT_DESKTOP = 7;
const DUST_COUNT_DESKTOP = 40;
const STAR_COUNT_MOBILE = 80;
const NEBULA_COUNT_MOBILE = 3;
const DUST_COUNT_MOBILE = 15;
const SHOOTING_STAR_INTERVAL = 4500;

const NEBULA_COLORS = [
  'rgba(124, 90, 200, 0.05)',
  'rgba(60, 180, 200, 0.04)',
  'rgba(220, 130, 150, 0.03)',
  'rgba(140, 200, 220, 0.04)',
  'rgba(180, 140, 220, 0.04)',
];

export default function StarField() {
  const canvasRef = useRef(null);
  const farRef = useRef([]);
  const midRef = useRef([]);
  const nearRef = useRef([]);
  const milkyExtraRef = useRef([]);
  const shootingStarsRef = useRef([]);
  const animationRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    let isMobile = width < 768;

    const buildLayers = () => {
      const starCount = isMobile ? STAR_COUNT_MOBILE : STAR_COUNT_DESKTOP;
      const nebulaCount = isMobile ? NEBULA_COUNT_MOBILE : NEBULA_COUNT_DESKTOP;
      const dustCount = isMobile ? DUST_COUNT_MOBILE : DUST_COUNT_DESKTOP;

      farRef.current = Array.from({ length: starCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.3 + 0.3,
        opacity: Math.random() * 0.5 + 0.25,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2,
      }));

      midRef.current = Array.from({ length: nebulaCount }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 220 + Math.random() * 220,
        color: NEBULA_COLORS[i % NEBULA_COLORS.length],
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.0005 + Math.random() * 0.0006,
        driftRadius: 30 + Math.random() * 40,
      }));

      nearRef.current = Array.from({ length: dustCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.0 + 0.4,
        vx: 0.04 + Math.random() * 0.12,
        vy: 0.015 + Math.random() * 0.05,
      }));

      const angle = (22 * Math.PI) / 180;
      const cx = width / 2;
      const cy = height / 2;
      milkyExtraRef.current = Array.from({ length: 30 }, () => {
        const along = (Math.random() - 0.5) * Math.max(width, height) * 1.5;
        const across = (Math.random() - 0.5) * 80;
        return {
          x: cx + Math.cos(angle) * along + Math.cos(angle + Math.PI / 2) * across,
          y: cy + Math.sin(angle) * along + Math.sin(angle + Math.PI / 2) * across,
          size: Math.random() * 1.0 + 0.3,
          opacity: Math.random() * 0.3 + 0.15,
          twinkleSpeed: Math.random() * 0.015 + 0.005,
          twinkleOffset: Math.random() * Math.PI * 2,
        };
      });
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      isMobile = width < 768;
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      buildLayers();
    };

    resize();

    const spawnShootingStar = () => {
      shootingStarsRef.current.push({
        x: Math.random() * width * 0.8,
        y: Math.random() * height * 0.3,
        length: Math.random() * 80 + 40,
        speed: Math.random() * 6 + 4,
        angle: Math.PI / 6 + Math.random() * 0.3,
        opacity: 1,
        life: 0,
      });
    };
    const shootingInterval = setInterval(spawnShootingStar, SHOOTING_STAR_INTERVAL);

    const onMouseMove = (e) => {
      mouseRef.current = { x: e.clientX - width / 2, y: e.clientY - height / 2 };
    };
    if (!isMobile) window.addEventListener('mousemove', onMouseMove);

    const drawMilkyWay = () => {
      const cx = width / 2;
      const cy = height / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((22 * Math.PI) / 180);
      const grad = ctx.createLinearGradient(-width, 0, width, 0);
      grad.addColorStop(0, 'rgba(220, 210, 200, 0)');
      grad.addColorStop(0.4, 'rgba(220, 210, 200, 0.045)');
      grad.addColorStop(0.6, 'rgba(220, 210, 200, 0.045)');
      grad.addColorStop(1, 'rgba(220, 210, 200, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, width * 1.2, 95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    let time = 0;
    const draw = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      const mx = isMobile ? 0 : mouseRef.current.x;
      const my = isMobile ? 0 : mouseRef.current.y;

      const farPx = mx * 0.10;
      const farPy = my * 0.10;

      for (const star of farRef.current) {
        const tw = Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
        const a = star.opacity + tw * 0.25;
        ctx.beginPath();
        ctx.arc(star.x + farPx, star.y + farPy, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 210, 255, ${Math.max(0, a)})`;
        ctx.fill();
        if (star.size > 1.0) {
          ctx.beginPath();
          ctx.arc(star.x + farPx, star.y + farPy, star.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(150, 170, 255, ${a * 0.06})`;
          ctx.fill();
        }
      }

      const midPx = mx * 0.25;
      const midPy = my * 0.25;
      for (const n of midRef.current) {
        n.driftPhase += n.driftSpeed;
        const dx = Math.cos(n.driftPhase) * n.driftRadius;
        const dy = Math.sin(n.driftPhase) * n.driftRadius;
        const px = n.x + dx + midPx;
        const py = n.y + dy + midPy;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, n.size);
        grad.addColorStop(0, n.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, n.size, 0, Math.PI * 2);
        ctx.fill();
      }

      const nearPx = mx * 0.55;
      const nearPy = my * 0.55;
      for (const d of nearRef.current) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x > width + 10) d.x = -10;
        if (d.y > height + 10) d.y = -10;
        ctx.beginPath();
        ctx.arc(d.x + nearPx, d.y + nearPy, d.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 220, 240, 0.18)`;
        ctx.fill();
      }

      for (let i = shootingStarsRef.current.length - 1; i >= 0; i--) {
        const s = shootingStarsRef.current[i];
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.life += 1;
        s.opacity = Math.max(0, 1 - s.life / 40);

        if (s.opacity <= 0) {
          shootingStarsRef.current.splice(i, 1);
          continue;
        }

        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;
        const gradient = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
        gradient.addColorStop(1, `rgba(200, 220, 255, ${s.opacity * 0.8})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animationRef.current);
      clearInterval(shootingInterval);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
