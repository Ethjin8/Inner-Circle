// Place each constellation on screen, alternating L/R sides for balance,
// avoiding the north star and previously-placed constellations.

const NORTH_STAR = { cx: 0.5, cy: 0.45, r: 0.12 };
const MAX_TRIES = 80;

// Shrink size as the number of constellations grows so they fit the top half.
const adaptiveScale = (count) => Math.min(0.36, 1.1 / Math.sqrt(Math.max(count, 1)));

const bounds = (stars, cx, cy, size) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of stars) {
    const x = cx + (s.ux - 0.5) * size;
    const y = cy + (s.uy - 0.5) * size;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
};

const overlaps = (a, b, pad) =>
  a.minX < b.maxX + pad && a.maxX > b.minX - pad &&
  a.minY < b.maxY + pad && a.maxY > b.minY - pad;

const hitsNorthStar = (b, w, h) => {
  const nx = NORTH_STAR.cx * w;
  const ny = NORTH_STAR.cy * h;
  const r = NORTH_STAR.r * Math.min(w, h);
  return b.minX < nx + r && b.maxX > nx - r && b.minY < ny + r && b.maxY > ny - r;
};

const hitsRect = (b, rect, pad = 16) => {
  if (!rect) return false;
  return b.minX < rect.right + pad && b.maxX > rect.left - pad &&
         b.minY < rect.bottom + pad && b.maxY > rect.top - pad;
};

const tryPlace = (group, sideLeft, w, h, placed, excludeRect, scale) => {
  const size = scale * Math.min(w, h);
  const xMin = sideLeft ? 0.08 * w : 0.55 * w;
  const xMax = sideLeft ? 0.45 * w : 0.92 * w;
  const yMin = 0.05 * h;
  const yMax = 0.42 * h;
  const half = size / 2;

  for (let i = 0; i < MAX_TRIES; i += 1) {
    const cx = xMin + half + Math.random() * Math.max(0, xMax - xMin - size);
    const cy = yMin + half + Math.random() * Math.max(0, yMax - yMin - size);
    const b = bounds(group.stars, cx, cy, size);
    if (hitsNorthStar(b, w, h)) continue;
    if (hitsRect(b, excludeRect)) continue;
    if (placed.some((p) => overlaps(b, p.bounds, 24))) continue;
    return { cx, cy, size, bounds: b, xMin, xMax, yMin, yMax };
  }
  const cx = xMin + half + Math.random() * Math.max(0, xMax - xMin - size);
  const cy = yMin + half + Math.random() * Math.max(0, yMax - yMin - size);
  return { cx, cy, size, bounds: bounds(group.stars, cx, cy, size), xMin, xMax, yMin, yMax };
};

export const layoutConstellations = (groups, w, h, excludeRect) => {
  const placed = [];
  const scale = adaptiveScale(groups.length);
  groups.forEach((g, i) => {
    const sideLeft = i % 2 === 0;
    const pos = tryPlace(g, sideLeft, w, h, placed, excludeRect, scale);
    const stars = g.stars.map((s) => ({
      ...s,
      x: pos.cx + (s.ux - 0.5) * pos.size,
      y: pos.cy + (s.uy - 0.5) * pos.size,
    }));
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.012 + Math.random() * 0.012;
    stars.forEach((s) => {
      s.phaseX = Math.random() * Math.PI * 2;
      s.phaseY = Math.random() * Math.PI * 2;
      s.freqX = 0.0006 + Math.random() * 0.0006;
      s.freqY = 0.0006 + Math.random() * 0.0006;
      s.amp = 1.5 + Math.random() * 1.5;
    });
    placed.push({
      ...g,
      cx: pos.cx,
      cy: pos.cy,
      size: pos.size,
      bounds: pos.bounds,
      xMin: pos.xMin,
      xMax: pos.xMax,
      yMin: pos.yMin,
      yMax: pos.yMax,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      stars,
    });
  });
  return placed;
};
