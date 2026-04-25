import { useRef, useEffect, useCallback } from 'react';

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

const DEMO_PEOPLE = [
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

function strengthToDistance(strength, maxRadius) {
  const normalized = 1 - strength / 100;
  return maxRadius * 0.22 + normalized * maxRadius * 0.78;
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

function resolveCollisions(nodes, cx, cy, width, height, iterations = 80) {
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      const dxc = nodes[i].baseX - cx;
      const dyc = nodes[i].baseY - cy;
      const distC = Math.sqrt(dxc * dxc + dyc * dyc);
      const minCenterDist = nodes[i].radius + 46;
      if (distC < minCenterDist && distC > 0) {
        const push = (minCenterDist - distC) / distC;
        nodes[i].baseX += dxc * push;
        nodes[i].baseY += dyc * push;
      }

      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].baseX - nodes[i].baseX;
        const dy = nodes[j].baseY - nodes[i].baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = nodes[i].radius + nodes[j].radius + 28;
        if (dist < minDist && dist > 0) {
          const push = (minDist - dist) / dist * 0.5;
          nodes[i].baseX -= dx * push;
          nodes[i].baseY -= dy * push;
          nodes[j].baseX += dx * push;
          nodes[j].baseY += dy * push;
        }
      }

      clampToBounds(nodes[i], width, height);
    }
  }
}

export default function ConstellationGraph({ activeFilter, people = DEMO_PEOPLE, onNodeClick, onNodeDoubleClick }) {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const animRef = useRef(null);
  const hoveredRef = useRef(null);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const clickTimerRef = useRef(null);

  const initNodes = useCallback((width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(width, height) * 0.58;

    const nodes = people.map((person, i) => {
      const strength = person.relationship?.strength ?? 0;
      const category = person.relationship?.type ?? 'other';
      const infoFields = countInfoFields(person);
      const dist = strengthToDistance(strength, maxRadius);
      const angleSpread = (Math.PI * 2) / people.length;
      const angle = angleSpread * i - Math.PI / 2;

      const bx = cx + Math.cos(angle) * dist;
      const by = cy + Math.sin(angle) * dist;

      return {
        ...person,
        category,
        strength,
        infoFields,
        targetDist: dist,
        x: bx,
        y: by,
        baseX: bx,
        baseY: by,
        radius: 18 + (Math.min(infoFields, 8) / 8) * 18,
        driftOffset: Math.random() * Math.PI * 2,
        driftSpeed: 0.002 + Math.random() * 0.003,
        driftAmount: 1.5 + Math.random() * 3,
      };
    });

    resolveCollisions(nodes, cx, cy, width, height);

    for (const node of nodes) {
      const dx = node.baseX - cx;
      const dy = node.baseY - cy;
      const angle = Math.atan2(dy, dx);
      node.baseX = cx + Math.cos(angle) * node.targetDist;
      node.baseY = cy + Math.sin(angle) * node.targetDist;
      clampToBounds(node, width, height);
    }
    nodes.forEach(n => { n.x = n.baseX; n.y = n.baseY; });
    nodesRef.current = nodes;
  }, [people]);

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

    const hitTest = (mx, my) => {
      for (const node of nodesRef.current) {
        const dx = mx - node.x;
        const dy = my - node.y;
        if (Math.sqrt(dx * dx + dy * dy) < node.radius + 6) return node;
      }
      return null;
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const found = hitTest(mouseRef.current.x, mouseRef.current.y);
      hoveredRef.current = found;
      canvas.style.cursor = found ? 'pointer' : 'default';
    };

    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (!node) return;
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        onNodeDoubleClick?.(node);
      } else {
        clickTimerRef.current = setTimeout(() => {
          clickTimerRef.current = null;
          onNodeClick?.(node);
        }, 250);
      }
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);

    const draw = () => {
      timeRef.current += 1;
      const t = timeRef.current;
      const cx = width / 2;
      const cy = height / 2;
      ctx.clearRect(0, 0, width, height);

      for (const node of nodesRef.current) {
        const r = node.radius + 20;
        node.x = node.baseX + Math.sin(t * node.driftSpeed + node.driftOffset) * node.driftAmount;
        node.y = node.baseY + Math.cos(t * node.driftSpeed * 0.7 + node.driftOffset) * node.driftAmount;
        node.x = Math.max(PADDING_LEFT + r, Math.min(width - PADDING_RIGHT - r, node.x));
        node.y = Math.max(PADDING_TOP + r, Math.min(height - PADDING_BOTTOM - r, node.y));
      }

      const centerRadius = 28;

      for (const node of nodesRef.current) {
        const isFiltered = activeFilter && activeFilter !== node.category;
        const rgb = strengthToEdgeColor(node.strength);
        const alpha = isFiltered ? 0.06 : 0.55;
        const edgeWidth = isFiltered ? 0.3 : 0.5 + (node.strength / 100) * 5;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(node.x, node.y);
        ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
        ctx.lineWidth = edgeWidth;
        ctx.stroke();
      }

      for (let i = 0; i < nodesRef.current.length; i++) {
        for (let j = i + 1; j < nodesRef.current.length; j++) {
          const a = nodesRef.current[i];
          const b = nodesRef.current[j];
          if (activeFilter && (activeFilter !== a.category || activeFilter !== b.category)) continue;
          if (a.category !== b.category) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const threshold = 200;
          if (dist < threshold) {
            const alpha = (1 - dist / threshold) * 0.05;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.setLineDash([4, 6]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      for (const node of nodesRef.current) {
        const cat = CATEGORIES[node.category] || CATEGORIES.other;
        const isFiltered = activeFilter && activeFilter !== node.category;
        const isHovered = hoveredRef.current?.id === node.id;
        const nodeAlpha = isFiltered ? 0.15 : 1;
        const r = node.radius * (isHovered ? 1.12 : 1);

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = cat.color + Math.round((isHovered ? 0.95 : 0.8) * nodeAlpha * 255).toString(16).padStart(2, '0');
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${(isHovered ? 0.5 : 0.2) * nodeAlpha})`;
        ctx.lineWidth = isHovered ? 2 : 1.5;
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * nodeAlpha})`;
        ctx.font = `600 ${r * 0.55}px 'Space Grotesk', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.initials, node.x, node.y);

        if (!isFiltered) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * nodeAlpha})`;
          ctx.font = `500 11px 'Inter', sans-serif`;
          ctx.fillText(node.name, node.x, node.y + r + 16);
        }
      }

      const astrolabeR = 28;
      const innerR = astrolabeR * 0.6;
      const astrolabeAngle = t * 0.0035;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(astrolabeAngle);

      ctx.beginPath();
      ctx.arc(0, 0, astrolabeR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(232, 232, 240, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, innerR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(232, 232, 240, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-astrolabeR, 0);
      ctx.lineTo(astrolabeR, 0);
      ctx.moveTo(0, -astrolabeR);
      ctx.lineTo(0, astrolabeR);
      ctx.strokeStyle = 'rgba(232, 232, 240, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const tickInner = astrolabeR * 0.85;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * tickInner, Math.sin(a) * tickInner);
        ctx.lineTo(Math.cos(a) * astrolabeR, Math.sin(a) * astrolabeR);
        ctx.strokeStyle = 'rgba(232, 232, 240, 0.45)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232, 232, 240, 0.9)';
      ctx.fill();

      ctx.restore();

      ctx.fillStyle = 'rgba(232, 232, 240, 0.85)';
      ctx.font = "600 11px 'Inter', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('YOU', cx, cy + astrolabeR + 14);

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animRef.current);
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [activeFilter, initNodes, onNodeClick, onNodeDoubleClick]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
      }}
    />
  );
}
