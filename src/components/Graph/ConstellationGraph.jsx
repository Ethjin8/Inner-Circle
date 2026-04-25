import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceManyBody, forceCollide, forceX, forceY } from 'd3-force-3d';

const CATEGORIES = {
  family: { color: '#e8b06b' },
  romantic: { color: '#ffc8d6' },
  friend: { color: '#ffce5c' },
  classmate: { color: '#b9d0ff' },
  coworker: { color: '#9be6c4' },
  professional: { color: '#ff9c5a' },
  mentor: { color: '#7df9ff' },
  other: { color: '#cdc9c0' },
};

function strengthToEdgeColor(strength) {
  if (strength >= 65) return '120, 220, 170';
  if (strength >= 40) return '240, 210, 110';
  return '220, 130, 130';
}

function daysSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function isBirthdayToday(iso) {
  if (!iso) return false;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  return d.getMonth() === today.getMonth() && Math.abs(d.getDate() - today.getDate()) <= 1;
}

function hexWithAlpha(hex, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function countInfoFields(p) {
  let n = 0;
  if (p.birthday) n++;
  const c = p.context || {};
  if (c.how_we_met) n++;
  if (c.school) n++;
  if (c.work) n++;
  if (c.hobbies?.length) n++;
  if (c.sports?.length) n++;
  if (c.favorites?.foods?.length) n++;
  if (c.favorites?.music?.length) n++;
  const h = p.history || {};
  if (h.memories_together?.length) n++;
  if (h.important_events?.length) n++;
  if (h.things_to_look_forward_to?.length) n++;
  return Math.max(1, n);
}

function personRadius(p) {
  return 24 + (Math.min(countInfoFields(p), 8) / 8) * 16;
}

function nodeRadius(node) {
  if (node.kind === 'you') return 44;
  if (node.kind === 'cat') return 36;
  return node.__radius;
}

export const DEMO_PEOPLE = [
  {
    id: '1', name: 'Mom', initials: 'MO', birthday: '1972-03-18',
    lastContactAt: '2026-04-23T18:30:00Z',
    relationship: { type: 'family', strength: 92 },
    context: {
      how_we_met: null, school: null, work: 'Retired teacher',
      hobbies: ['gardening', 'cooking', 'reading'], sports: [],
      favorites: { foods: ['pasta', 'chocolate cake'], music: ['classical', 'oldies'] },
    },
    history: {
      memories_together: [
        'Family road trip to Grand Canyon 2019',
        'Teaching me to cook her pasta recipe',
        'Movie nights every Sunday',
      ],
      important_events: ["Parents' 30th anniversary in June"],
      things_to_look_forward_to: ['Planning a family reunion this summer'],
    },
  },
  {
    id: '2', name: 'Jake', initials: 'JK', birthday: '2003-11-02',
    lastContactAt: '2026-04-24T22:00:00Z',
    relationship: { type: 'friend', strength: 78 },
    context: {
      how_we_met: 'Freshman orientation at UCLA', school: 'UCLA', work: null,
      hobbies: ['gaming', 'skateboarding'], sports: ['basketball'],
      favorites: { foods: ['ramen', 'burritos'], music: ['hip-hop', 'electronic'] },
    },
    history: {
      memories_together: ['Late-night study sessions for CS 31', 'Beach day at Santa Monica'],
      important_events: ['His birthday party in November'],
      things_to_look_forward_to: ['LA Hacks 2026 together'],
    },
  },
  {
    id: '3', name: 'Sarah', initials: 'SA', birthday: '2003-04-25',
    lastContactAt: '2026-01-10T14:00:00Z',
    relationship: { type: 'friend', strength: 65 },
    context: { how_we_met: 'Met through Jake at a house party', hobbies: ['photography'] },
  },
  {
    id: '4', name: 'Prof. Chen', initials: 'PC',
    lastContactAt: '2026-04-08T16:00:00Z',
    relationship: { type: 'mentor', strength: 55 },
    context: { school: 'UCLA', work: 'CS faculty, machine learning' },
  },
  {
    id: '5', name: 'Marcus', initials: 'MA',
    lastContactAt: '2025-12-05T20:00:00Z',
    relationship: { type: 'friend', strength: 40 },
    context: { hobbies: ['climbing'] },
  },
  {
    id: '6', name: 'Alex', initials: 'AX',
    lastContactAt: '2026-04-22T11:00:00Z',
    relationship: { type: 'classmate', strength: 70 },
    context: { school: 'UCLA', hobbies: ['chess'] },
  },
  {
    id: '7', name: 'Dad', initials: 'DA', birthday: '1970-07-09',
    lastContactAt: '2026-04-12T19:00:00Z',
    relationship: { type: 'family', strength: 85 },
    context: {
      work: 'Civil engineer',
      hobbies: ['woodworking', 'hiking'],
      favorites: { foods: ['steak'], music: ['rock'] },
    },
    history: {
      memories_together: ['Camping trip in Yosemite', 'Building a treehouse together'],
    },
  },
  {
    id: '8', name: 'Kevin', initials: 'KV',
    lastContactAt: '2025-11-20T15:00:00Z',
    relationship: { type: 'professional', strength: 35 },
    context: { work: 'Recruiter at Anthropic' },
  },
  {
    id: '9', name: 'Lily', initials: 'LI', birthday: '2004-08-21',
    lastContactAt: '2026-04-25T09:00:00Z',
    relationship: { type: 'romantic', strength: 88 },
    context: {
      how_we_met: 'Met at a coffee shop near campus', school: 'UCLA',
      work: 'Part-time at the campus bookstore',
      hobbies: ['painting', 'yoga', 'film photography'], sports: [],
      favorites: { foods: ['sushi', 'matcha'], music: ['indie rock', 'R&B'] },
    },
    history: {
      memories_together: [
        'First date at Griffith Observatory',
        'Painting together at her apartment',
        'Surprise birthday picnic',
      ],
      important_events: ['One year anniversary in September'],
      things_to_look_forward_to: ['Trip to San Francisco next month', 'Meeting her parents'],
    },
  },
  {
    id: '10', name: 'Ryan', initials: 'RY',
    lastContactAt: '2026-03-30T10:00:00Z',
    relationship: { type: 'classmate', strength: 50 },
    context: { school: 'UCLA' },
  },
  {
    id: '11', name: 'Grandma', initials: 'GM', birthday: '1948-02-14',
    lastContactAt: '2026-04-05T13:00:00Z',
    relationship: { type: 'family', strength: 72 },
    history: { memories_together: ['Sunday dinners at her place', 'Learning to knit'] },
  },
  {
    id: '12', name: 'Tina', initials: 'TI',
    lastContactAt: '2026-03-20T17:00:00Z',
    relationship: { type: 'coworker', strength: 45 },
    context: { work: 'Same team at the campus dining hall' },
  },
];

function buildGraphData(people) {
  const grouped = {};
  for (const p of people) {
    const cat = p.relationship?.type ?? 'other';
    (grouped[cat] ||= []).push(p);
  }

  const youNode = { id: 'you', kind: 'you', fx: 0, fy: 0 };
  const catNodes = Object.entries(grouped).map(([cat, list]) => {
    const sum = list.reduce((acc, p) => acc + (p.relationship?.strength ?? 50), 0);
    return {
      id: `cat_${cat}`,
      kind: 'cat',
      category: cat,
      name: cat.toUpperCase(),
      avgStrength: sum / Math.max(1, list.length),
    };
  });
  const personNodes = people.map((p) => ({
    id: p.id,
    kind: 'person',
    category: p.relationship?.type ?? 'other',
    name: p.name,
    initials: p.initials,
    person: p,
    strength: p.relationship?.strength ?? 0,
    daysSince: daysSince(p.lastContactAt),
    isBirthday: isBirthdayToday(p.birthday),
    __radius: personRadius(p),
  }));

  const trunkLinks = catNodes.map((c) => ({
    source: 'you',
    target: c.id,
    kind: 'trunk',
    avgStrength: c.avgStrength,
    category: c.category,
  }));
  const branchLinks = people.map((p) => ({
    source: `cat_${p.relationship?.type ?? 'other'}`,
    target: p.id,
    kind: 'branch',
    strength: p.relationship?.strength ?? 0,
    category: p.relationship?.type ?? 'other',
  }));

  return {
    nodes: [youNode, ...catNodes, ...personNodes],
    links: [...trunkLinks, ...branchLinks],
  };
}

export default function ConstellationGraph({
  activeFilters,
  focusedCategory,
  onZoomOut,
  people = DEMO_PEOPLE,
  onNodeClick,
  onNodeDoubleClick,
  activeTool,
  onSnip,
  deletingIds = [],
}) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const hoveredLinkRef = useRef(null);
  const hoveredNodeRef = useRef(null);
  const particlesRef = useRef([]);
  const prevDeletingRef = useRef([]);
  const lastFocusPinRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const filterSet = useMemo(
    () => (activeFilters instanceof Set ? activeFilters : new Set()),
    [activeFilters],
  );
  const isDimmed = useCallback(
    (cat) => {
      if (!cat || cat === 'you') return false;
      if (focusedCategory) return cat !== focusedCategory;
      return filterSet.size > 0 && !filterSet.has(cat);
    },
    [focusedCategory, filterSet],
  );

  const deletingSet = useMemo(() => new Set(deletingIds), [deletingIds]);

  const graphData = useMemo(() => buildGraphData(people), [people]);

  // Resize observer for the container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Configure d3 forces once the graph is mounted
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge', forceManyBody().strength((n) => {
      if (n.kind === 'you') return -1200;
      if (n.kind === 'cat') return -700;
      return -180;
    }));
    fg.d3Force('collide', forceCollide((n) => nodeRadius(n) + 6));
    fg.d3Force('x', forceX(0).strength(0.05));
    fg.d3Force('y', forceY(0).strength(0.06));
    const linkForce = fg.d3Force('link');
    if (linkForce) {
      linkForce.distance((l) => (l.kind === 'trunk' ? 160 : 70)).strength(0.6);
    }
  }, [graphData]);

  // Category focus zoom
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    if (focusedCategory) {
      const cat = graphData.nodes.find(
        (n) => n.kind === 'cat' && n.category === focusedCategory,
      );
      if (!cat) return;
      // Pin the focused cat so the camera stays centered on a stable target.
      cat.fx = cat.x ?? 0;
      cat.fy = cat.y ?? 0;
      lastFocusPinRef.current = cat;
      fg.centerAt(cat.fx, cat.fy, 600);
      fg.zoom(2.6, 600);
    } else {
      const pinned = lastFocusPinRef.current;
      if (pinned) {
        delete pinned.fx;
        delete pinned.fy;
        lastFocusPinRef.current = null;
      }
      fg.centerAt(0, 0, 500);
      fg.zoom(1, 500);
    }
  }, [focusedCategory, graphData]);

  // Esc / wheel to un-focus (preserve original behaviour)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === '-') onZoomOut?.();
    };
    const onWheel = (e) => {
      if (focusedCategory && e.deltaY !== 0) onZoomOut?.();
    };
    window.addEventListener('keydown', onKey);
    const el = containerRef.current;
    el?.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      el?.removeEventListener('wheel', onWheel);
    };
  }, [onZoomOut, focusedCategory]);

  // Spawn particles for newly-deleting nodes
  useEffect(() => {
    const newIds = deletingIds.filter((id) => !prevDeletingRef.current.includes(id));
    for (const id of newIds) {
      const node = graphData.nodes.find((n) => n.id === id);
      if (!node || node.x == null) continue;
      const cat = CATEGORIES[node.category] || CATEGORIES.other;
      const numP = node.kind === 'cat' ? 22 : 14;
      for (let p = 0; p < numP; p++) {
        const angle = (p / numP) * Math.PI * 2 + Math.random() * 0.5;
        const speed = (1.5 + Math.random() * 3.5) / 6; // world-space speed
        particlesRef.current.push({
          x: node.x,
          y: node.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 0.5 + Math.random() * (node.kind === 'cat' ? 1.4 : 0.9),
          alpha: 1,
          color: cat.color,
          life: 0,
          maxLife: 45 + Math.random() * 20,
        });
      }
    }
    prevDeletingRef.current = [...deletingIds];
  }, [deletingIds, graphData]);

  const handleNodeClick = useCallback((node, event) => {
    if (activeTool === 'snip') return;
    if (node.kind === 'you') return;
    if (node.kind === 'cat') {
      onNodeClick?.({ isCategory: true, category: node.category, id: node.id });
      return;
    }
    if (event?.shiftKey) {
      onNodeDoubleClick?.(node.person);
      return;
    }
    const sx = event?.clientX;
    const sy = event?.clientY;
    onNodeClick?.(node.person, sx != null ? { x: sx, y: sy } : null);
  }, [activeTool, onNodeClick, onNodeDoubleClick]);

  const handleNodeHover = useCallback((node) => {
    hoveredNodeRef.current = node || null;
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas) return;
    if (activeTool === 'snip') {
      canvas.style.cursor = hoveredLinkRef.current ? 'crosshair' : 'crosshair';
    } else {
      canvas.style.cursor = node ? (node.kind === 'you' ? 'grab' : 'pointer') : 'grab';
    }
  }, [activeTool]);

  const handleLinkHover = useCallback((link) => {
    hoveredLinkRef.current = link || null;
    const canvas = containerRef.current?.querySelector('canvas');
    if (canvas && activeTool === 'snip') canvas.style.cursor = 'crosshair';
  }, [activeTool]);

  const handleLinkClick = useCallback((link) => {
    if (activeTool !== 'snip') return;
    const target = link.target;
    if (!target || typeof target !== 'object') return;
    if (target.kind === 'cat') {
      onSnip?.({ isCategory: true, id: target.id, category: target.category });
    } else if (target.kind === 'person') {
      onSnip?.({ isCategory: false, id: target.id, category: target.category });
    }
  }, [activeTool, onSnip]);

  const handleNodeDragEnd = useCallback((node) => {
    if (node.kind === 'you') return;
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  const handleBackgroundClick = useCallback(() => {
    if (focusedCategory) onZoomOut?.();
  }, [focusedCategory, onZoomOut]);

  // ----- node painting -----
  const paintNode = useCallback((node, ctx, globalScale) => {
    if (deletingSet.has(node.id)) return;
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    const r = nodeRadius(node);
    const isHov = hoveredNodeRef.current?.id === node.id;
    const dim = isDimmed(node.category);
    const alpha = dim ? 0.18 : 1;
    const drawR = r * (isHov ? 1.12 : 1);
    const cat = CATEGORIES[node.category] || CATEGORIES.other;
    const color = dim ? '#6a6f7a' : (node.kind === 'you' ? '#e8e8f0' : cat.color);

    if (node.kind === 'you') {
      ctx.beginPath();
      ctx.arc(node.x, node.y, drawR, 0, Math.PI * 2);
      ctx.fillStyle = hexWithAlpha(color, alpha);
      ctx.fill();
      ctx.strokeStyle = hexWithAlpha(color, 0.95 * alpha);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = `rgba(11,15,25,${0.95 * alpha})`;
      ctx.font = "600 16px 'Inter',sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('YOU', node.x, node.y);
      return;
    }

    if (node.kind === 'cat') {
      ctx.beginPath();
      ctx.arc(node.x, node.y, drawR, 0, Math.PI * 2);
      ctx.fillStyle = hexWithAlpha(color, alpha);
      ctx.fill();
      ctx.strokeStyle = hexWithAlpha(color, alpha);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = `rgba(11,15,25,${0.95 * alpha})`;
      const maxTextWidth = drawR * 1.45;
      let cfs = Math.max(9, drawR * 0.46);
      if (cfs * 0.6 * node.name.length > maxTextWidth) {
        cfs = Math.max(9, maxTextWidth / (node.name.length * 0.6));
      }
      ctx.font = `600 ${cfs}px 'Inter',sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name, node.x, node.y);
      return;
    }

    // person node — halo + filled circle + name/initials
    const haloR = drawR * 1.6;
    const halo = ctx.createRadialGradient(node.x, node.y, drawR * 0.5, node.x, node.y, haloR);
    halo.addColorStop(0, hexWithAlpha(color, 0.4 * alpha));
    halo.addColorStop(1, hexWithAlpha(color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(node.x, node.y, drawR, 0, Math.PI * 2);
    ctx.fillStyle = hexWithAlpha(color, alpha);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${(isHov ? 1.0 : 0.6) * alpha})`;
    ctx.lineWidth = isHov ? 2 : 1.5;
    ctx.stroke();

    const nameFits = (node.name?.length ?? 0) <= 11;
    const textInside = nameFits ? node.name : (node.initials || node.name);
    ctx.fillStyle = `rgba(11,15,25,${0.95 * alpha})`;
    let fs = Math.max(9, drawR * 0.55);
    if (fs * 0.6 * textInside.length > drawR * 1.75) {
      fs = Math.max(9, (drawR * 1.75) / (textInside.length * 0.6));
    }
    ctx.font = `600 ${fs}px 'Inter',sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(textInside, node.x, node.y);
    if (!nameFits && !dim) {
      ctx.fillStyle = `rgba(255,255,255,${0.7 * alpha})`;
      ctx.font = `500 ${11 / globalScale}px 'Inter',sans-serif`;
      ctx.fillText(node.name, node.x, node.y + drawR + 14 / globalScale);
    }
  }, [deletingSet, isDimmed]);

  const findNodeAt = useCallback((gx, gy) => {
    let best = null;
    let bestDist = Infinity;
    for (const n of graphData.nodes) {
      if (deletingSet.has(n.id)) continue;
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      const r = nodeRadius(n);
      const dx = gx - n.x;
      const dy = gy - n.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r * r && d2 < bestDist) {
        bestDist = d2;
        best = n;
      }
    }
    return best;
  }, [graphData, deletingSet]);

  const findLinkAt = useCallback((gx, gy, tol) => {
    let best = null;
    let bestD = tol;
    for (const l of graphData.links) {
      const s = l.source;
      const t = l.target;
      if (!s || !t || typeof s !== 'object' || typeof t !== 'object') continue;
      if (!Number.isFinite(s.x) || !Number.isFinite(t.x)) continue;
      const vx = t.x - s.x;
      const vy = t.y - s.y;
      const len2 = vx * vx + vy * vy;
      if (len2 === 0) continue;
      let u = ((gx - s.x) * vx + (gy - s.y) * vy) / len2;
      u = Math.max(0, Math.min(1, u));
      const px = s.x + u * vx;
      const py = s.y + u * vy;
      const d = Math.hypot(gx - px, gy - py);
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  }, [graphData]);

  // Manual pointer interaction (force-graph's shadow-canvas hit detection
  // misfires for our custom-painted nodes — only the last-painted few register).
  useEffect(() => {
    const fg = fgRef.current;
    const root = containerRef.current;
    if (!fg || !root) return;
    const canvas = root.querySelector('canvas');
    if (!canvas) return;

    const toGraph = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      return fg.screen2GraphCoords(sx, sy);
    };

    let downScreen = null;

    const onMove = (ev) => {
      const { x, y } = toGraph(ev);
      const node = findNodeAt(x, y);
      if (activeTool === 'snip') {
        const link = node ? null : findLinkAt(x, y, 8);
        hoveredLinkRef.current = link;
        canvas.style.cursor = 'crosshair';
      } else {
        hoveredLinkRef.current = null;
      }
      handleNodeHover(node);
    };

    const onDown = (ev) => {
      if (ev.button !== 0) return;
      downScreen = { x: ev.clientX, y: ev.clientY };
    };

    const onUp = (ev) => {
      if (ev.button !== 0 || !downScreen) return;
      const dx = ev.clientX - downScreen.x;
      const dy = ev.clientY - downScreen.y;
      downScreen = null;
      const moved = Math.hypot(dx, dy) > 4;
      if (moved) return; // pan / drag — not a click
      const { x, y } = toGraph(ev);
      const node = findNodeAt(x, y);
      if (node) {
        handleNodeClick(node, ev);
        return;
      }
      if (activeTool === 'snip') {
        const link = findLinkAt(x, y, 8);
        if (link) handleLinkClick(link);
        return;
      }
      handleBackgroundClick();
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, [findNodeAt, findLinkAt, handleNodeClick, handleNodeHover, handleLinkClick, handleBackgroundClick, activeTool]);

  // ----- link painting -----
  const paintLink = useCallback((link, ctx) => {
    const src = link.source;
    const tgt = link.target;
    if (!src || !tgt || typeof src !== 'object' || typeof tgt !== 'object') return;
    if (deletingSet.has(src.id) || deletingSet.has(tgt.id)) return;
    if (!Number.isFinite(src.x) || !Number.isFinite(tgt.x)) return;

    const isHovEdge = hoveredLinkRef.current === link;
    const dim = isDimmed(link.category);
    const dimMul = dim ? 0.12 : 1;

    if (isHovEdge && activeTool === 'snip') {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = 'rgba(255,80,80,0.95)';
      ctx.shadowColor = 'rgba(255,80,80,0.8)';
      ctx.shadowBlur = 12;
      ctx.lineWidth = (link.kind === 'trunk' ? 1.5 : 1.2);
    } else if (link.kind === 'trunk') {
      const ea = (0.1 + (link.avgStrength / 100) * 0.3) * dimMul;
      ctx.strokeStyle = `rgba(255,255,255,${ea})`;
      ctx.lineWidth = 0.5 + (link.avgStrength / 100) * 4;
    } else {
      const rgb = strengthToEdgeColor(link.strength);
      const a = dim ? 0.18 : 0.55;
      ctx.strokeStyle = dim ? `rgba(140,140,150,${a})` : `rgba(${rgb}, ${a})`;
      ctx.lineWidth = 0.5 + (link.strength / 100) * 4;
    }

    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }, [deletingSet, isDimmed, activeTool]);

  const paintLinkPointer = useCallback((link, color, ctx) => {
    const src = link.source;
    const tgt = link.target;
    if (!src || !tgt || typeof src !== 'object' || typeof tgt !== 'object') return;
    if (!Number.isFinite(src.x) || !Number.isFinite(tgt.x)) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
  }, []);

  // ----- particle layer (post-render, in graph coordinates) -----
  const onRenderFramePost = useCallback((ctx) => {
    const list = particlesRef.current;
    if (list.length === 0) return;
    const next = list
      .map((p) => {
        const life = p.life + 1;
        return {
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vx: p.vx * 0.93,
          vy: p.vy * 0.93,
          life,
          alpha: 1 - life / p.maxLife,
        };
      })
      .filter((p) => p.life < p.maxLife);
    for (const p of next) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = hexWithAlpha(p.color, p.alpha * 0.9);
      ctx.fill();
    }
    particlesRef.current = next;
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 80,
        left: 280,
        right: 24,
        bottom: 110,
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        enablePointerInteraction={false}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={paintNode}
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={paintLink}
        linkPointerAreaPaint={paintLinkPointer}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onNodeDragEnd={handleNodeDragEnd}
        onLinkClick={handleLinkClick}
        onLinkHover={handleLinkHover}
        onBackgroundClick={handleBackgroundClick}
        onRenderFramePost={onRenderFramePost}
        d3AlphaDecay={0.04}
        d3VelocityDecay={0.55}
        cooldownTicks={200}
        warmupTicks={80}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enableNodeDrag={activeTool !== 'snip'}
        minZoom={0.3}
        maxZoom={5}
      />
    </div>
  );
}
