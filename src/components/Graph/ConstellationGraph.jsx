import { useRef, useEffect, useCallback } from 'react';

// Pan momentum after release. Higher = longer glide. Range ~0.85–0.97.
const PAN_INERTIA_DECAY = 0.92;
const PAN_INERTIA_MIN_VELOCITY = 0.1;

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
  if (strength >= 65) return '120, 220, 170';   // sage green
  if (strength >= 40) return '240, 210, 110';    // soft amber
  return '220, 130, 130';                         // dusty rose
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

function drawMinimalNode(ctx, node, r, color, alpha, isHovered) {
  const haloR = r * 1.6;
  const halo = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, haloR);
  halo.addColorStop(0, hexWithAlpha(color, 0.4 * alpha));
  halo.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  ctx.fillStyle = hexWithAlpha(color, 1.0 * alpha);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 255, ${(isHovered ? 1.0 : 0.6) * alpha})`;
  ctx.lineWidth = isHovered ? 2 : 1.5;
  ctx.stroke();
}

function truncateLabel(label, maxChars) {
  if (!label) return '';
  if (label.length <= maxChars) return label;
  if (maxChars <= 1) return '…';
  return `${label.slice(0, maxChars - 1)}…`;
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

const PADDING_TOP = 80;
const PADDING_BOTTOM = 160;
const PADDING_LEFT = 180;
const PADDING_RIGHT = 60;

function clampToBounds(node, width, height) {
  const r = node.radius + 20;
  node.baseX = Math.max(PADDING_LEFT + r, Math.min(width - PADDING_RIGHT - r, node.baseX));
  node.baseY = Math.max(PADDING_TOP + r, Math.min(height - PADDING_BOTTOM - r, node.baseY));
}

export default function ConstellationGraph({ activeFilters, focusedCategory, onZoomOut, onZoomIn, people = DEMO_PEOPLE, onNodeClick, onNodeDoubleClick, activeTool, onSnip, deletingIds = [], panRef: externalPanRef, isFirstExperience = false, userName = '', onCenterClick }) {
  const filterSet = activeFilters instanceof Set ? activeFilters : new Set();
  const hasFilter = filterSet.size > 0;
  const isDimmed = (cat) => {
    if (focusedCategory) return cat !== focusedCategory;
    return hasFilter && !filterSet.has(cat);
  };
  // Fade focus dimming based on zoom: full at scale >= 2.6, gone at <= 1.2
  const dimAmount = (cat, scale) => {
    if (focusedCategory) {
      if (cat === focusedCategory) return 0;
      const t = Math.max(0, Math.min(1, (scale - 1.2) / (2.6 - 1.2)));
      return t;
    }
    return hasFilter && !filterSet.has(cat) ? 1 : 0;
  };
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const animRef = useRef(null);
  const hoveredRef = useRef(null);
  const hoverStartRef = useRef(0);
  const hoveredEdgeRef = useRef(null);
  const clickTimerRef = useRef(null);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
const internalPanRef = useRef({ x: 0, y: 0 });
  const userPanRef = externalPanRef ?? internalPanRef;
  const youPosRef = useRef({ x: 0, y: 0 });
  const camRef = useRef({ x: 0, y: 0, scale: 1, targetX: 0, targetY: 0, targetScale: 1 });
  const zoomRef = useRef(1);
  const focusedCategoryRef = useRef(focusedCategory);
  useEffect(() => { focusedCategoryRef.current = focusedCategory; }, [focusedCategory]);
  const dragStateRef = useRef({ active: false, nodeId: null, startMx: 0, startMy: 0, startNx: 0, startNy: 0, moved: false, suppressClick: false, lastMx: 0, lastMy: 0, vx: 0, vy: 0 });
  const panMomentumRef = useRef({ vx: 0, vy: 0, raf: null });
  const particlesRef = useRef([]); // [{x,y,vx,vy,r,alpha,color,life,maxLife}]
  const prevDeletingRef = useRef([]); // track when ids newly enter deleting
  const youHoverTRef = useRef(0); // 0..1 fade between YOU and +
  const lastActivityRef = useRef(performance.now());
  const recenteredRef = useRef(false);

  const initNodes = useCallback((width, height) => {
    const cx = width / 2;
    const cy = height / 2 - Math.min(width, height) * 0.05;

    const grouped = {};
    for (const p of people) {
      const cat = p.relationship?.type ?? 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }

    const catKeys = Object.keys(grouped);
    const numCats = catKeys.length;
    const baseWinSize = Math.min(width, height);
    const nodes = [];

    catKeys.forEach((catKey, i) => {
      const g = grouped[catKey];
      const sum = g.reduce((acc, p) => acc + (p.relationship?.strength ?? 50), 0);
      const avgStrength = sum / Math.max(1, g.length);

      const mappedOffset = 0.45 - (avgStrength / 100) * 0.30;
      const catRadiusOffset = baseWinSize * mappedOffset;
      const theta = (i * (Math.PI * 2)) / Math.max(1, numCats) - Math.PI / 2;

      const baseCatX = cx + Math.cos(theta) * catRadiusOffset * 1.35;
      const baseCatY = cy + Math.sin(theta) * catRadiusOffset * 0.8;

      const oldCat = nodesRef.current.find(old => old.id === `cat_${catKey}`);
      const manualOffX = oldCat ? (oldCat.manualOffX ?? 0) : 0;
      const manualOffY = oldCat ? (oldCat.manualOffY ?? 0) : 0;

      const catNode = {
        isCategory: true,
        id: `cat_${catKey}`,
        name: catKey.toUpperCase(),
        initials: '',
        category: catKey,
        avgStrength,
        x: oldCat ? oldCat.x : baseCatX + manualOffX,
        y: oldCat ? oldCat.y : baseCatY + manualOffY,
        targetX: baseCatX + manualOffX,
        targetY: baseCatY + manualOffY,
        baseX: baseCatX,
        baseY: baseCatY,
        manualOffX,
        manualOffY,
        theta,
        catRadiusOffset,
        radius: 16,
      };
      nodes.push(catNode);

      const peopleList = grouped[catKey];
      const numPeople = peopleList.length;
      const spreadAngle = Math.PI * 0.5;
      let startAngle = theta - spreadAngle / 2;
      if (numPeople === 1) startAngle = theta;
      const angleStep = numPeople > 1 ? spreadAngle / (numPeople - 1) : 0;
      const basePersonDist = catRadiusOffset * 0.38;

      peopleList.forEach((person, j) => {
        const infoFields = countInfoFields(person);
        const personR = 5 + (Math.min(infoFields, 8) / 8) * 8;
        const pTheta = startAngle + j * angleStep;
        const pDist = basePersonDist + (j % 2 === 0 ? 0 : personR * 1.2);
        const basePx = baseCatX + Math.cos(pTheta) * pDist * 1.35;
        const basePy = baseCatY + Math.sin(pTheta) * pDist * 0.8;

        const oldNode = nodesRef.current.find(old => old.id === person.id);
        const pManualOffX = oldNode ? (oldNode.manualOffX ?? 0) : 0;
        const pManualOffY = oldNode ? (oldNode.manualOffY ?? 0) : 0;

        nodes.push({
          ...person,
          isCategory: false,
          category: catKey,
          strength: person.relationship?.strength ?? 0,
          scoringStatus: person.scoring?.status ?? null,
          // True once the AI pipeline has produced real dimension scores.
          // Until then, edges render neutral so unscored nodes don't fake a strength.
          isScored: Boolean(person.scoring?.dimensions),
          parentCat: catNode,
          x: oldNode ? oldNode.x : basePx + pManualOffX,
          y: oldNode ? oldNode.y : basePy + pManualOffY,
          targetX: basePx + pManualOffX,
          targetY: basePy + pManualOffY,
          baseX: basePx,
          baseY: basePy,
          manualOffX: pManualOffX,
          manualOffY: pManualOffY,
          radius: personR,
          orbitAngle: oldNode ? oldNode.orbitAngle : Math.random() * Math.PI * 2,
          orbitRadius: oldNode ? oldNode.orbitRadius : 2 + Math.random() * 3,
          orbitSpeed: oldNode ? oldNode.orbitSpeed : 0.0006 + Math.random() * 0.0008,
          daysSince: daysSince(person.lastContactAt),
          isBirthday: isBirthdayToday(person.birthday),
        });
      });
    });

    nodesRef.current = nodes;
  }, [people]);

  // Reset user pan only when entering a category focus, so scroll-out exits
  // smoothly without snapping the camera.
  useEffect(() => {
    if (focusedCategory) {
      userPanRef.current.x = 0;
      userPanRef.current.y = 0;
      zoomRef.current = 2.6;
    }
  }, [focusedCategory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = canvas.parentElement.clientWidth;
    let height = canvas.parentElement.clientHeight;

    const resize = () => {
      width = canvas.parentElement.clientWidth;
      height = canvas.parentElement.clientHeight;
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      initNodes(width, height);
    };
    resize();

    const getCenter = () => ({
      cx: width / 2,
      cy: height / 2 - Math.min(width, height) * 0.05,
    });

    const screenToWorld = (sx, sy) => {
      const { cx, cy } = getCenter();
      return {
        wx: (sx - (camRef.current.x + cx)) / camRef.current.scale + cx,
        wy: (sy - (camRef.current.y + cy)) / camRef.current.scale + cy,
      };
    };

    const hitTest = (mx, my) => {
      const { cx, cy } = getCenter();
      const { wx, wy } = screenToWorld(mx, my);
      // YOU lives in world space at (cx + youOffset)
      const youX = cx + youPosRef.current.x;
      const youY = cy + youPosRef.current.y;
      const ydist = Math.sqrt((wx - youX) ** 2 + (wy - youY) ** 2);
      if (ydist < 44 && !focusedCategoryRef.current) return { id: 'center', isCenter: true };
      for (const node of [...nodesRef.current].reverse()) {
        if (Math.sqrt((wx - node.x) ** 2 + (wy - node.y) ** 2) < node.radius + 6) return node;
      }
      return null;
    };

    const hitTestEdge = (mx, my) => {
      const { wx, wy } = screenToWorld(mx, my);
      const { cx, cy } = getCenter();
      let best = null; let bestDist = 14;
      for (const node of nodesRef.current) {
        let ax, ay, bx, by;
        if (node.isCategory) { ax = cx; ay = cy; bx = node.x; by = node.y; }
        else { const p = node.parentCat; if (!p) continue; ax = p.x; ay = p.y; bx = node.x; by = node.y; }
        const dx = bx - ax; const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1) continue;
        const t = Math.max(0, Math.min(1, ((wx - ax) * dx + (wy - ay) * dy) / len2));
        const dist = Math.sqrt((wx - ax - t * dx) ** 2 + (wy - ay - t * dy) ** 2);
        if (dist < bestDist) { bestDist = dist; best = node; }
      }
      return best;
    };

    const dragState = dragStateRef.current;

    const stopMomentum = () => {
      if (panMomentumRef.current.raf) {
        cancelAnimationFrame(panMomentumRef.current.raf);
        panMomentumRef.current.raf = null;
      }
      panMomentumRef.current.vx = 0;
      panMomentumRef.current.vy = 0;
    };

    const applyPanToCamera = () => {
      const fc = focusedCategoryRef.current;
      if (fc) {
        const catNode = nodesRef.current.find(n => n.isCategory && n.category === fc);
        if (catNode) {
          const s = camRef.current.scale;
          camRef.current.x = (width / 2 - catNode.x) * s + userPanRef.current.x;
          camRef.current.y = (height / 2 - Math.min(width, height) * 0.05 - catNode.y) * s + userPanRef.current.y;
        }
      } else {
        camRef.current.x = userPanRef.current.x;
        camRef.current.y = userPanRef.current.y;
      }
    };

    const stepMomentum = () => {
      const m = panMomentumRef.current;
      userPanRef.current.x += m.vx;
      userPanRef.current.y += m.vy;
      applyPanToCamera();
      m.vx *= PAN_INERTIA_DECAY;
      m.vy *= PAN_INERTIA_DECAY;
      if (Math.abs(m.vx) < PAN_INERTIA_MIN_VELOCITY && Math.abs(m.vy) < PAN_INERTIA_MIN_VELOCITY) {
        m.raf = null;
        return;
      }
      m.raf = requestAnimationFrame(stepMomentum);
    };

    const markActivity = () => {
      lastActivityRef.current = performance.now();
      recenteredRef.current = false;
    };

    const onMouseDown = (e) => {
      markActivity();
      if (activeTool === 'snip') return;
      stopMomentum();
      const rect = canvas.getBoundingClientRect();
      const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      dragState.active = true;
      dragState.startMx = e.clientX;
      dragState.startMy = e.clientY;
      dragState.lastMx = e.clientX;
      dragState.lastMy = e.clientY;
      dragState.vx = 0;
      dragState.vy = 0;
      dragState.moved = false;
      dragState.suppressClick = false;
      if (!node) {
        if (isFirstExperience) { dragState.active = false; return; }
        dragState.nodeId = 'pan';
        dragState.startNx = userPanRef.current.x;
        dragState.startNy = userPanRef.current.y;
      } else if (node.isCenter) {
        if (isFirstExperience) { dragState.active = false; return; }
        dragState.nodeId = 'you';
        dragState.startNx = youPosRef.current.x;
        dragState.startNy = youPosRef.current.y;
      } else {
        dragState.nodeId = node.id;
        dragState.startNx = node.manualOffX ?? 0;
        dragState.startNy = node.manualOffY ?? 0;
      }
    };

    const onMouseUp = () => {
      if (dragState.active && dragState.moved) dragState.suppressClick = true;
      if (dragState.active && dragState.nodeId === 'pan' && (Math.abs(dragState.vx) > 0.5 || Math.abs(dragState.vy) > 0.5)) {
        panMomentumRef.current.vx = dragState.vx;
        panMomentumRef.current.vy = dragState.vy;
        if (!panMomentumRef.current.raf) panMomentumRef.current.raf = requestAnimationFrame(stepMomentum);
      }
      dragState.active = false;
      dragState.nodeId = null;
    };

    const onMouseMove = (e) => {
      markActivity();
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (dragState.active && dragState.nodeId) {
        const dxPx = e.clientX - dragState.startMx;
        const dyPx = e.clientY - dragState.startMy;
        if (!dragState.moved && (Math.abs(dxPx) > 4 || Math.abs(dyPx) > 4)) dragState.moved = true;
        const dxW = dxPx / camRef.current.scale;
        const dyW = dyPx / camRef.current.scale;

        if (dragState.nodeId === 'pan') {
          dragState.vx = e.clientX - dragState.lastMx;
          dragState.vy = e.clientY - dragState.lastMy;
          dragState.lastMx = e.clientX;
          dragState.lastMy = e.clientY;
          userPanRef.current.x = dragState.startNx + dxPx;
          userPanRef.current.y = dragState.startNy + dyPx;
          // Snap camera to the correct target (focusOffset + userPan when focused, else userPan)
          // so cursor tracks 1:1 with no spring lag.
          if (focusedCategoryRef.current) {
            const catNode = nodesRef.current.find(n => n.isCategory && n.category === focusedCategoryRef.current);
            if (catNode) {
              const s = camRef.current.scale;
              camRef.current.x = (width / 2 - catNode.x) * s + userPanRef.current.x;
              camRef.current.y = (height / 2 - Math.min(width, height) * 0.05 - catNode.y) * s + userPanRef.current.y;
            }
          } else {
            camRef.current.x = userPanRef.current.x;
            camRef.current.y = userPanRef.current.y;
          }
        } else if (dragState.nodeId === 'you') {
          youPosRef.current.x = dragState.startNx + dxW;
          youPosRef.current.y = dragState.startNy + dyW;
        } else {
          const node = nodesRef.current.find(n => n.id === dragState.nodeId);
          if (node) {
            const newOffX = dragState.startNx + dxW;
            const newOffY = dragState.startNy + dyW;
            if (node.isCategory) {
              const diffX = newOffX - (node.manualOffX ?? 0);
              const diffY = newOffY - (node.manualOffY ?? 0);
              node.manualOffX = newOffX; node.manualOffY = newOffY;
              node.targetX = node.baseX + newOffX; node.targetY = node.baseY + newOffY;
              for (const pn of nodesRef.current) {
                if (!pn.isCategory && pn.category === node.category) {
                  pn.manualOffX = (pn.manualOffX ?? 0) + diffX;
                  pn.manualOffY = (pn.manualOffY ?? 0) + diffY;
                  pn.targetX = pn.baseX + pn.manualOffX;
                  pn.targetY = pn.baseY + pn.manualOffY;
                }
              }
            } else {
              node.manualOffX = newOffX; node.manualOffY = newOffY;
              node.targetX = node.baseX + newOffX; node.targetY = node.baseY + newOffY;
            }
          }
        }
        canvas.style.cursor = 'grabbing';
        return;
      }

      if (activeTool === 'snip') {
        hoveredEdgeRef.current = hitTestEdge(mouseRef.current.x, mouseRef.current.y);
        if (hoveredRef.current) hoverStartRef.current = 0;
        hoveredRef.current = null;
        canvas.style.cursor = 'crosshair';
      } else {
        hoveredEdgeRef.current = null;
        const found = hitTest(mouseRef.current.x, mouseRef.current.y);
        const prev = hoveredRef.current;
        if (found?.id !== prev?.id) {
          hoverStartRef.current = found && !found.isCategory && !found.isCenter ? performance.now() : 0;
        }
        hoveredRef.current = found;
        canvas.style.cursor = found ? 'pointer' : 'grab';
      }
    };

    const onClick = (e) => {
      if (dragState.active) return;
      if (dragState.suppressClick) { dragState.suppressClick = false; return; }
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
      if (activeTool === 'snip') { const edge = hitTestEdge(mx, my); if (edge) onSnip?.(edge); return; }
      const node = hitTest(mx, my);
      if (!node) return;
      if (node.isCenter) { onCenterClick?.(); return; }
      if (e.shiftKey && !node.isCategory) {
        if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
        onNodeDoubleClick?.(node);
        return;
      }

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current); clickTimerRef.current = null;
        onNodeDoubleClick?.(node);
      } else {
        const cx = e.clientX; const cy = e.clientY;
        clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; onNodeClick?.(node, { x: cx, y: cy }); }, 250);
      }
    };

    let wheelLockUntil = 0;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === '-') {
        stopMomentum();
        markActivity();
        wheelLockUntil = performance.now() + 500;
        userPanRef.current.x = 0;
        userPanRef.current.y = 0;
        youPosRef.current.x = 0;
        youPosRef.current.y = 0;
        zoomRef.current = 1;
        camRef.current.targetX = 0;
        camRef.current.targetY = 0;
        camRef.current.targetScale = 1;
        onZoomOut?.();
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      if (performance.now() < wheelLockUntil) return;
      markActivity();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { cx, cy } = getCenter();
      // Use current cam scale (mid-spring) so transitions are continuous.
      const oldScale = camRef.current.scale;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newScale = Math.max(0.4, Math.min(4, oldScale * factor));
      if (newScale === oldScale) return;
      const wx = (mx - cx - camRef.current.x) / oldScale + cx;
      const wy = (my - cy - camRef.current.y) / oldScale + cy;
      const newCamX = mx - cx - (wx - cx) * newScale;
      const newCamY = my - cy - (wy - cy) * newScale;
      zoomRef.current = newScale;
      camRef.current.scale = newScale;
      camRef.current.x = newCamX;
      camRef.current.y = newCamY;
      camRef.current.targetScale = newScale;
      camRef.current.targetX = newCamX;
      camRef.current.targetY = newCamY;
      // Sync userPan so the draw loop's spring target equals current cam.
      // In focused mode: cam = (cx - catNode.x) * scale + userPan.
      const fc = focusedCategoryRef.current;
      const exitingFocus = fc && newScale < 1.2;
      if (fc && !exitingFocus) {
        const catNode = nodesRef.current.find(n => n.isCategory && n.category === fc);
        if (catNode) {
          userPanRef.current.x = newCamX - (cx - catNode.x) * newScale;
          userPanRef.current.y = newCamY - (cy - catNode.y) * newScale;
        }
      } else {
        userPanRef.current.x = newCamX;
        userPanRef.current.y = newCamY;
      }
      if (exitingFocus) onZoomOut?.();
      stopMomentum();
    };

    const draw = () => {
      timeRef.current += 1;
      const { cx, cy } = getCenter();
      ctx.clearRect(0, 0, width, height);

      // Auto-recenter after 10s of inactivity (skip while dragging or in first-experience).
      if (!recenteredRef.current && !dragStateRef.current.active && !isFirstExperience &&
          performance.now() - lastActivityRef.current > 10000) {
        recenteredRef.current = true;
        stopMomentum();
        userPanRef.current.x = 0;
        userPanRef.current.y = 0;
        youPosRef.current.x = 0;
        youPosRef.current.y = 0;
        zoomRef.current = 1;
        if (focusedCategoryRef.current) onZoomOut?.();
      }

      // Camera target. Treat as unfocused once zoom drops below the exit
      // threshold even if focusedCategory hasn't cleared yet — otherwise the
      // focused-mode formula misuses the just-set absolute pan and jumps.
      if (focusedCategoryRef.current && zoomRef.current >= 1.2) {
        const catNode = nodesRef.current.find(n => n.isCategory && n.category === focusedCategoryRef.current);
        if (catNode) {
          const focusScale = zoomRef.current;
          camRef.current.targetX = (cx - catNode.x) * focusScale + userPanRef.current.x;
          camRef.current.targetY = (cy - catNode.y) * focusScale + userPanRef.current.y;
          camRef.current.targetScale = focusScale;
        }
      } else {
        camRef.current.targetX = userPanRef.current.x;
        camRef.current.targetY = userPanRef.current.y;
        camRef.current.targetScale = zoomRef.current;
      }
      camRef.current.x += (camRef.current.targetX - camRef.current.x) * 0.08;
      camRef.current.y += (camRef.current.targetY - camRef.current.y) * 0.08;
      camRef.current.scale += (camRef.current.targetScale - camRef.current.scale) * 0.08;

      // Collision pass: nudge overlapping nodes apart through their target offsets
      const draggedId = dragStateRef.current.active ? dragStateRef.current.nodeId : null;
      const collidable = nodesRef.current.filter(n => !deletingIds.includes(n.id) && n.id !== draggedId);
      const youR = 44;
      const youWX = cx + youPosRef.current.x;
      const youWY = cy + youPosRef.current.y;
      for (let i = 0; i < collidable.length; i++) {
        const a = collidable[i];
        // YOU obstacle (constellation origin, follows youPos)
        {
          const dx = a.x - youWX, dy = a.y - youWY;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const minD = a.radius + youR + 8;
          if (d < minD) {
            const push = (minD - d) * 0.12;
            const nx = dx / d, ny = dy / d;
            a.manualOffX = (a.manualOffX ?? 0) + nx * push;
            a.manualOffY = (a.manualOffY ?? 0) + ny * push;
            a.targetX = a.baseX + a.manualOffX;
            a.targetY = a.baseY + a.manualOffY;
          }
        }
        for (let j = i + 1; j < collidable.length; j++) {
          const b = collidable[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const minD = a.radius + b.radius + 8;
          if (d < minD) {
            const overlap = (minD - d) * 0.06;
            const nx = dx / d, ny = dy / d;
            a.manualOffX = (a.manualOffX ?? 0) - nx * overlap;
            a.manualOffY = (a.manualOffY ?? 0) - ny * overlap;
            b.manualOffX = (b.manualOffX ?? 0) + nx * overlap;
            b.manualOffY = (b.manualOffY ?? 0) + ny * overlap;
            a.targetX = a.baseX + a.manualOffX;
            a.targetY = a.baseY + a.manualOffY;
            b.targetX = b.baseX + b.manualOffX;
            b.targetY = b.baseY + b.manualOffY;
          }
        }
      }

      // Spring step — node target is its base layout + manual offset + youPos shift
      const yox = youPosRef.current.x, yoy = youPosRef.current.y;
      for (const a of nodesRef.current) {
        let swayX = 0; let swayY = 0;
        if (!a.isCategory) {
          swayX = Math.sin(timeRef.current * a.orbitSpeed * 15 + a.orbitAngle) * 1.5;
          swayY = Math.cos(timeRef.current * a.orbitSpeed * 17 + a.orbitAngle) * 1.5;
        }
        a.x += ((a.targetX + yox + swayX) - a.x) * 0.1;
        a.y += ((a.targetY + yoy + swayY) - a.y) * 0.1;
      }

      // Spawn particles for newly-deleting nodes
      const newIds = deletingIds.filter(id => !prevDeletingRef.current.includes(id));
      if (newIds.length > 0) {
        for (const id of newIds) {
          const node = nodesRef.current.find(n => n.id === id);
          if (!node) continue;
          const cat = CATEGORIES[node.category] || CATEGORIES.other;
          // convert node world pos to screen pos
          const sx = (node.x - cx) * camRef.current.scale + cx + camRef.current.x;
          const sy = (node.y - cy) * camRef.current.scale + cy + camRef.current.y;
          const numP = node.isCategory ? 22 : 14;
          for (let p = 0; p < numP; p++) {
            const angle = (p / numP) * Math.PI * 2 + Math.random() * 0.5;
            const speed = 1.5 + Math.random() * 3.5;
            particlesRef.current.push({
              x: sx, y: sy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: 2 + Math.random() * (node.isCategory ? 5 : 3),
              alpha: 1,
              color: cat.color,
              life: 0, maxLife: 45 + Math.random() * 20,
            });
          }
        }
      }
      prevDeletingRef.current = [...deletingIds];

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife);
      for (const p of particlesRef.current) { p.x += p.vx; p.y += p.vy; p.vx *= 0.93; p.vy *= 0.93; p.life++; p.alpha = 1 - p.life / p.maxLife; }

      ctx.save();
      ctx.translate(cx + camRef.current.x, cy + camRef.current.y);
      ctx.scale(camRef.current.scale, camRef.current.scale);
      ctx.translate(-cx, -cy);

      const youWorldX = cx + youPosRef.current.x;
      const youWorldY = cy + youPosRef.current.y;

      // YOU → cat trunk edges (world space)
      for (const node of nodesRef.current) {
        if (deletingIds.includes(node.id)) continue;
        if (!node.isCategory) continue;
        const isHovEdge = hoveredEdgeRef.current?.id === node.id;
        const dimT = dimAmount(node.category, camRef.current.scale);
        const dimMul = 1 - dimT * (1 - 0.12);
        const ea = isHovEdge ? 0.95 : (0.1 + (node.avgStrength / 100) * 0.3) * dimMul;
        const ew = 2.25;
        ctx.beginPath(); ctx.moveTo(youWorldX, youWorldY); ctx.lineTo(node.x, node.y);
        ctx.lineWidth = ew;
        if (isHovEdge && activeTool === 'snip') {
          ctx.setLineDash([6, 4]); ctx.strokeStyle = 'rgba(255,80,80,0.95)';
          ctx.shadowColor = 'rgba(255,80,80,0.8)'; ctx.shadowBlur = 12;
        } else { ctx.strokeStyle = `rgba(255,255,255,${ea})`; }
        ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
      }

      // Cat→Person edges (world space)
      for (const node of nodesRef.current) {
        if (deletingIds.includes(node.id)) continue;
        if (node.isCategory) continue;
        const isHovEdge = hoveredEdgeRef.current?.id === node.id;
        const dimT = dimAmount(node.category, camRef.current.scale);
        {
          const p = node.parentCat;
          if (!p || deletingIds.includes(p.id)) continue;
          const isHovPEdge = hoveredEdgeRef.current?.id === node.id;
          const rgb = node.isScored ? strengthToEdgeColor(node.strength) : '160,160,170';
          const ew = 2.25;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(node.x, node.y);
          ctx.lineWidth = ew;
          if (isHovPEdge && activeTool === 'snip') {
            ctx.setLineDash([6, 4]); ctx.strokeStyle = 'rgba(255,80,80,0.95)';
            ctx.shadowColor = 'rgba(255,80,80,0.8)'; ctx.shadowBlur = 12;
          } else {
            const baseA = node.isScored ? 0.55 : 0.32;
            const a = baseA * (1 - dimT) + 0.18 * dimT;
            const r = parseInt(rgb.split(',')[0]) * (1 - dimT) + 140 * dimT;
            const g = parseInt(rgb.split(',')[1]) * (1 - dimT) + 140 * dimT;
            const b = parseInt(rgb.split(',')[2]) * (1 - dimT) + 150 * dimT;
            ctx.strokeStyle = `rgba(${r|0},${g|0},${b|0},${a})`;
          }
          ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
        }
      }

      // Nodes
      for (const node of nodesRef.current) {
        if (deletingIds.includes(node.id)) continue;
        const cat = CATEGORIES[node.category] || CATEGORIES.other;
        const dimT = dimAmount(node.category, camRef.current.scale);
        const isHov = hoveredRef.current?.id === node.id;
        const nodeAlpha = 1 - dimT * (1 - 0.18);
        const r = node.radius * (isHov ? 1.12 : 1);
        const renderColor = dimT > 0.5 ? '#6a6f7a' : cat.color;

        if (node.isCategory) {
          ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fillStyle = hexWithAlpha(renderColor, nodeAlpha); ctx.fill();
          ctx.strokeStyle = hexWithAlpha(renderColor, nodeAlpha); ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = `rgba(232,232,240,${0.9 * nodeAlpha})`;
          ctx.font = `300 12px 'Inter',sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(node.name, node.x, node.y + r + 6);
        } else {
          drawMinimalNode(ctx, node, r, renderColor, nodeAlpha, isHov);
          ctx.fillStyle = `rgba(232,232,240,${0.9 * nodeAlpha})`;
          ctx.font = `300 11px 'Inter',sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(node.name, node.x, node.y + r + 5);

          // Scoring state overlay: dashed pulse for pending, warning glyph for failed.
          if (node.scoringStatus === 'pending') {
            const pulse = 1 + Math.sin(timeRef.current * 0.08) * 0.04;
            const ringR = r * 1.35 * pulse;
            const phase = (timeRef.current * 0.6) % 24;
            ctx.save();
            ctx.beginPath(); ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
            ctx.setLineDash([4, 4]); ctx.lineDashOffset = -phase;
            ctx.strokeStyle = `rgba(232,232,240,${0.55 * nodeAlpha})`;
            ctx.lineWidth = 1.1;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          } else if (node.scoringStatus === 'failed') {
            const gx = node.x + r * 0.78, gy = node.y - r * 0.78;
            ctx.save();
            ctx.beginPath(); ctx.arc(gx, gy, r * 0.28, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,140,120,${0.95 * nodeAlpha})`; ctx.fill();
            ctx.fillStyle = `rgba(11,15,25,${0.95 * nodeAlpha})`;
            ctx.font = `700 ${Math.max(8, r * 0.34)}px 'Inter',sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('!', gx, gy + 0.5);
            ctx.restore();
          }
        }
      }

      // YOU drawn in world space, last so it stays on top
      const bpm = 30;
      const pulse = (Math.sin(timeRef.current * (bpm / 60) * 0.05) + 1) / 2; // 0–1
      const youHovered = hoveredRef.current?.isCenter ? 1 : 0;
      youHoverTRef.current += (youHovered - youHoverTRef.current) * 0.12;
      const t = youHoverTRef.current;
      const youRadius = isFirstExperience ? 44 * (1 + 0.12 * pulse) : 44;
      ctx.beginPath(); ctx.arc(youWorldX, youWorldY, youRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232,232,240,1)'; ctx.fill();
      ctx.strokeStyle = 'rgba(232,232,240,0.95)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (isFirstExperience) {
        const plusAlpha = 0.3 + 0.7 * pulse;
        ctx.fillStyle = `rgba(11,15,25,${plusAlpha})`;
        ctx.font = "300 64px 'Inter',sans-serif";
        ctx.fillText('+', youWorldX, youWorldY);
      } else {
        if (t < 0.999) {
          ctx.fillStyle = `rgba(11,15,25,${0.95 * (1 - t)})`;
          ctx.font = "600 16px 'Inter',sans-serif";
          ctx.fillText('YOU', youWorldX, youWorldY);
        }
        if (t > 0.001) {
          ctx.fillStyle = `rgba(11,15,25,${0.95 * t})`;
          ctx.font = "300 64px 'Inter',sans-serif";
          ctx.fillText('+', youWorldX, youWorldY);
        }
      }

      if (isFirstExperience) {
        const FADE_START = 300; // ~1.8s transition + 1s delay
        const FADE_DURATION = 160;
        const textAlpha = Math.min(1, Math.max(0, (timeRef.current - FADE_START) / FADE_DURATION)) * 0.85;

        ctx.font = "400 35px 'Inter',sans-serif";
        ctx.fillStyle = `rgba(200,200,210,${textAlpha})`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const greetingOffset = 40;
        const lineHeight = 50;
        const baseY = youWorldY + 44 + greetingOffset;
        ctx.fillText(`Talk to me, ${userName}`, youWorldX, baseY);
      }

      ctx.restore();

      // Hover tooltip for person nodes — 170ms delay, then animate in
      const hov = hoveredRef.current;
      const HOVER_DELAY = 314;
      const ANIM_DUR = 140;
      if (hov && !hov.isCategory && !hov.isCenter && hoverStartRef.current) {
        const elapsed = performance.now() - hoverStartRef.current;
        if (elapsed >= HOVER_DELAY) {
          const t = Math.min(1, (elapsed - HOVER_DELAY) / ANIM_DUR);
          const ease = 1 - Math.pow(1 - t, 3);
          const scale = 0.85 + 0.15 * ease;
          const alpha = ease;
          const { cx: tcx, cy: tcy } = getCenter();
          const sx = (hov.x - tcx) * camRef.current.scale + tcx + camRef.current.x;
          const sy = (hov.y - tcy) * camRef.current.scale + tcy + camRef.current.y;
          const label = 'Shift+click to add to context';
          ctx.font = "500 8px 'Inter',sans-serif";
          const tw = ctx.measureText(label).width;
          const ph = 8; const pv = 6;
          const bw = tw + ph * 2; const bh = 12 + pv * 2;
          const by = sy - hov.radius * camRef.current.scale - bh - 10;
          const offsetY = (1 - ease) * 4;
          ctx.save();
          ctx.translate(sx, by + bh / 2 + offsetY);
          ctx.scale(scale, scale);
          ctx.beginPath();
          ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 6);
          ctx.fillStyle = `rgba(11,15,25,${0.82 * alpha})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,${0.15 * alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = `rgba(200,200,210,${0.9 * alpha})`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }

      // Render particles in screen space
      for (const p of particlesRef.current) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexWithAlpha(p.color, p.alpha * 0.9);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animRef.current);
      if (panMomentumRef.current.raf) cancelAnimationFrame(panMomentumRef.current.raf);
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [activeFilters, activeTool, initNodes, onNodeClick, onNodeDoubleClick, onSnip, onZoomOut, onZoomIn, deletingIds]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />;
}
