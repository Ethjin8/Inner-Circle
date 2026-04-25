# Living Constellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Inner Circle UI into a cinematic Living Constellation (parallax cosmos, per-category celestial bodies, time-aware motion, dolly-zoom modal transition, satellite-probe voice onboarding) without breaking any existing functionality.

**Architecture:** Pure Canvas2D — no Three.js. All work happens on a feature branch. Each task is a small, browser-verifiable visual change. The project has no unit-test framework; "tests" are scripted browser verifications against the spec's 12 acceptance criteria. Frequent commits per task.

**Tech Stack:** React 19, Vite, Canvas2D, CSS transforms/filters/backdrop-filter, SVG, existing Inter + Space Grotesk fonts.

**Spec:** `docs/superpowers/specs/2026-04-25-living-constellation-design.md`

---

## File Structure

| File | Role | Change kind |
|---|---|---|
| `src/index.css` | Global tokens (palette, typography) | Modify — replace category color tokens |
| `src/App.jsx` | Top-level layout, click handlers, cinematic state | Modify — add cosmos-stage wrapper, cinematic state machine, header astrolabe |
| `src/App.css` | App layout and chrome styles | Modify — bg simplification, cosmos-stage classes, bokeh overlay, header logo glyph, prompt polish |
| `src/components/Graph/StarField.jsx` | Cosmic backdrop | Rewrite — three parallax layers, milky way, dust |
| `src/components/Graph/ConstellationGraph.jsx` | Force-directed graph | Heavy modify — celestial body rendering, orbital drift, time effects, astrolabe YOU |
| `src/components/PersonModal/PersonModal.jsx` | Person detail modal | Modify — entry/exit animation classes |
| `src/components/PersonModal/PersonModal.css` | Modal styles | Modify — origin-based scale-in transition |
| `src/components/AddPersonModal/AddPersonModal.jsx` | Voice onboarding | Modify — satellite probe icon, flare arcs, stardust burst |
| `src/components/AddPersonModal/AddPersonModal.css` | Voice onboarding styles | Modify — probe styling, arc/burst animations |

No new files. No restructuring. Helper functions (`hexWithAlpha`, per-type renderers, `daysSinceContact`, `isBirthdayNow`) live as module-scope functions in `ConstellationGraph.jsx`.

---

## Task 1: Set up feature branch and start dev server

**Files:** None (git/shell only)

- [ ] **Step 1: Verify current state**

```bash
git status --short
git rev-parse --abbrev-ref HEAD
```

Expected: on `main`, with the WIP listed in git status as today.

- [ ] **Step 2: Create feature branch carrying current WIP**

```bash
git checkout -b ui/living-constellation
```

Expected: `Switched to a new branch 'ui/living-constellation'`. WIP preserved in working tree.

- [ ] **Step 3: Start dev server in background**

```bash
npm run dev
```

Run with `run_in_background: true`. Note the port (default `5173`).

- [ ] **Step 4: Verify baseline renders**

Open http://localhost:5173. Confirm: current UI appears, no console errors, force-directed graph visible, click a node opens current PersonModal, double-click attaches as chip, sidebar filter works, Add Person opens current modal.

This baseline is the regression check for every later task.

- [ ] **Step 5: Commit branch start (no code changes)**

No commit needed — branch is just created.

---

## Task 2: Synthesize demo data (`lastContactAt` + Sarah's birthday)

**Files:**
- Modify: `src/components/Graph/ConstellationGraph.jsx` — `DEMO_PEOPLE` array

Spec section: *Data changes*. Required for time-aware effects (recent pulse, dormant comet, birthday supernova) to have something to render against.

Distribution (today is 2026-04-25):
- Within 7 days (recent pulse): Mom (id 1), Jake (id 2), Lily (id 9), Alex (id 6)
- 8–59 days (no effect): Dad (id 7), Grandma (id 11), Prof. Chen (id 4), Ryan (id 10), Tina (id 12)
- 60+ days (dormant comet): Marcus (id 5), Kevin (id 8), Sarah (id 3)

Sarah (id 3) also gets `birthday: '2003-04-25'` (today's month/day).

- [ ] **Step 1: Replace the `DEMO_PEOPLE` array**

In `src/components/Graph/ConstellationGraph.jsx`, replace the entire `DEMO_PEOPLE` array (currently lines ~20–124) with:

```js
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
```

- [ ] **Step 2: Verify in browser**

Reload http://localhost:5173. Confirm: graph still renders correctly, no console errors, no visible change yet (effects come in later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/components/Graph/ConstellationGraph.jsx
git commit -m "Synthesize lastContactAt and Sarah's birthday on demo people"
```

---

## Task 3: Cosmic palette refresh

**Files:**
- Modify: `src/index.css` — `:root` variables
- Modify: `src/App.jsx` — `FILTERS`, `CATEGORY_COLORS`
- Modify: `src/components/Graph/ConstellationGraph.jsx` — `CATEGORIES`, `strengthToEdgeColor`
- Modify: `src/components/PersonModal/PersonModal.jsx` — `CATEGORY_COLORS`

Spec section: *Visual identity → Palette*.

- [ ] **Step 1: Update palette tokens in `src/index.css`**

In the `:root { ... }` block, replace the lines starting with `--accent-blue` through `--node-blue-glow` with:

```css
  --accent-cream: #e8e8f0;

  --celestial-family: #e8b06b;
  --celestial-romantic: #ffc8d6;
  --celestial-friend: #ffce5c;
  --celestial-classmate: #b9d0ff;
  --celestial-coworker: #9be6c4;
  --celestial-professional: #ff9c5a;
  --celestial-mentor: #7df9ff;
  --celestial-other: #cdc9c0;

  --strength-strong: 120, 220, 170;
  --strength-mid: 240, 210, 110;
  --strength-weak: 220, 130, 130;
```

(Remove the now-unused `--accent-blue`, `--accent-blue-glow`, `--accent-purple`, `--accent-purple-glow`, `--node-green`, `--node-green-glow`, `--node-yellow`, `--node-yellow-glow`, `--node-red`, `--node-red-glow`, `--node-blue`, `--node-blue-glow` tokens.)

- [ ] **Step 2: Update `FILTERS` and `CATEGORY_COLORS` in `src/App.jsx`**

Replace the `FILTERS` constant with:

```jsx
const FILTERS = [
  { key: null, label: 'All' },
  { key: 'family', label: 'Family', color: '#e8b06b' },
  { key: 'friend', label: 'Friends', color: '#ffce5c' },
  { key: 'classmate', label: 'School', color: '#b9d0ff' },
  { key: 'coworker', label: 'Work', color: '#9be6c4' },
  { key: 'professional', label: 'Professional', color: '#ff9c5a' },
  { key: 'romantic', label: 'Romantic', color: '#ffc8d6' },
  { key: 'mentor', label: 'Mentors', color: '#7df9ff' },
];
```

Replace `CATEGORY_COLORS` with:

```jsx
const CATEGORY_COLORS = {
  family: '#e8b06b',
  friend: '#ffce5c',
  classmate: '#b9d0ff',
  coworker: '#9be6c4',
  professional: '#ff9c5a',
  romantic: '#ffc8d6',
  mentor: '#7df9ff',
};
```

- [ ] **Step 3: Update `CATEGORIES` and `strengthToEdgeColor` in `src/components/Graph/ConstellationGraph.jsx`**

Replace the `CATEGORIES` constant with:

```js
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
```

Replace `strengthToEdgeColor` with:

```js
function strengthToEdgeColor(strength) {
  if (strength >= 65) return '120, 220, 170';   // sage green
  if (strength >= 40) return '240, 210, 110';    // soft amber
  return '220, 130, 130';                         // dusty rose
}
```

- [ ] **Step 4: Update `CATEGORY_COLORS` in `src/components/PersonModal/PersonModal.jsx`**

Replace the `CATEGORY_COLORS` constant near the top of the file with:

```jsx
const CATEGORY_COLORS = {
  family: '#e8b06b',
  friend: '#ffce5c',
  classmate: '#b9d0ff',
  coworker: '#9be6c4',
  professional: '#ff9c5a',
  romantic: '#ffc8d6',
  mentor: '#7df9ff',
  other: '#cdc9c0',
};
```

- [ ] **Step 5: Verify in browser**

Reload. Confirm: nodes render in new harmonized palette (gold/yellow/cyan/etc.), sidebar chip dots match, edges show desaturated sage/amber/dusty-rose, PersonModal badge dot uses new colors. No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/App.jsx src/components/Graph/ConstellationGraph.jsx src/components/PersonModal/PersonModal.jsx
git commit -m "Refresh palette to harmonized cosmic colors"
```

---

## Task 4: Simplify app background

**Files:**
- Modify: `src/App.css` — `.app` rule

Spec section: *Component changes → App chrome → App background*.

- [ ] **Step 1: Replace `.app` background**

In `src/App.css`, replace the `.app` rule's `background` property with a flat color:

```css
.app {
  width: 100%;
  height: 100dvh;
  position: relative;
  overflow: hidden;
  background: var(--bg-deep);
}
```

(Remove the `radial-gradient(...)` background — the parallax StarField will carry visual interest in Task 8.)

- [ ] **Step 2: Verify in browser**

Reload. Confirm: background is flat near-black `#050510`, no console errors, all UI still visible.

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "Simplify app background to flat near-black"
```

---

## Task 5: Astrolabe YOU glyph

**Files:**
- Modify: `src/components/Graph/ConstellationGraph.jsx` — replace center YOU rendering in `draw()`

Spec section: *Component changes → ConstellationGraph → Center "YOU" → astrolabe glyph*.

- [ ] **Step 1: Replace the YOU rendering block**

In `src/components/Graph/ConstellationGraph.jsx`, locate the block at the end of `draw()` that draws the center YOU (currently `ctx.beginPath(); ctx.arc(cx, cy, centerRadius, ...); ctx.fillStyle = 'rgba(55, 90, 200, 0.9)'; ...` through `ctx.fillText('YOU', cx, cy);`). Replace it with:

```js
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
```

- [ ] **Step 2: Verify in browser**

Reload. Confirm: center is no longer a solid blue circle — it's a thin-stroked astrolabe (outer ring, inner ring, cross-hairs, 12 hour ticks, center dot) slowly rotating clockwise. "YOU" label sits below the glyph in pale ivory.

- [ ] **Step 3: Commit**

```bash
git add src/components/Graph/ConstellationGraph.jsx
git commit -m "Replace YOU center node with rotating astrolabe glyph"
```

---

## Task 6: Per-category celestial body rendering

**Files:**
- Modify: `src/components/Graph/ConstellationGraph.jsx` — add module-scope helpers, replace per-node draw block

Spec section: *Component changes → ConstellationGraph → Celestial body rendering*. The centerpiece task.

- [ ] **Step 1: Add helper functions at module scope**

In `src/components/Graph/ConstellationGraph.jsx`, add the following helpers ABOVE the `DEMO_PEOPLE` constant (i.e., after the existing `strengthToEdgeColor` function):

```js
function hexWithAlpha(hex, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function drawSoftStar(ctx, x, y, r, color, alpha, isHovered) {
  const haloR = r * 1.9;
  const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, haloR);
  halo.addColorStop(0, hexWithAlpha(color, 0.45 * alpha));
  halo.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, haloR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hexWithAlpha(color, alpha);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 255, ${(isHovered ? 0.55 : 0.22) * alpha})`;
  ctx.lineWidth = isHovered ? 2 : 1.5;
  ctx.stroke();
}

function drawHaloStar(ctx, x, y, r, color, alpha, isHovered) {
  const haloR = r * 2.3;
  const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, haloR);
  halo.addColorStop(0, hexWithAlpha(color, 0.55 * alpha));
  halo.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, haloR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hexWithAlpha(color, alpha);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 255, ${(isHovered ? 0.55 : 0.22) * alpha})`;
  ctx.lineWidth = isHovered ? 2 : 1.5;
  ctx.stroke();
}

function drawEmberStar(ctx, x, y, r, color, alpha, isHovered) {
  const haloR = r * 2.5;
  const halo = ctx.createRadialGradient(x, y, r * 0.3, x, y, haloR);
  halo.addColorStop(0, hexWithAlpha(color, 0.65 * alpha));
  halo.addColorStop(0.5, hexWithAlpha(color, 0.25 * alpha));
  halo.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, haloR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hexWithAlpha(color, alpha);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 255, ${(isHovered ? 0.55 : 0.25) * alpha})`;
  ctx.lineWidth = isHovered ? 2 : 1.5;
  ctx.stroke();
}

function drawAnamorphicStar(ctx, x, y, r, color, alpha, isHovered) {
  drawSoftStar(ctx, x, y, r, color, alpha, isHovered);

  const flareLen = r * 3.2;
  const flareH = ctx.createLinearGradient(x - flareLen, y, x + flareLen, y);
  flareH.addColorStop(0, hexWithAlpha(color, 0));
  flareH.addColorStop(0.5, hexWithAlpha(color, 0.55 * alpha));
  flareH.addColorStop(1, hexWithAlpha(color, 0));
  ctx.strokeStyle = flareH;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - flareLen, y);
  ctx.lineTo(x + flareLen, y);
  ctx.stroke();

  const flareV = ctx.createLinearGradient(x, y - flareLen, x, y + flareLen);
  flareV.addColorStop(0, hexWithAlpha(color, 0));
  flareV.addColorStop(0.5, hexWithAlpha(color, 0.55 * alpha));
  flareV.addColorStop(1, hexWithAlpha(color, 0));
  ctx.strokeStyle = flareV;
  ctx.beginPath();
  ctx.moveTo(x, y - flareLen);
  ctx.lineTo(x, y + flareLen);
  ctx.stroke();
}

function drawRingedPlanet(ctx, x, y, r, color, alpha, strength) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hexWithAlpha(color, alpha);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 * alpha})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.26);

  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.7, r * 0.45, 0, 0, Math.PI * 2);
  ctx.strokeStyle = hexWithAlpha(color, 0.55 * alpha);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (strength > 70) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 2.05, r * 0.55, 0, 0, Math.PI * 2);
    ctx.strokeStyle = hexWithAlpha(color, 0.3 * alpha);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

function drawQuasar(ctx, x, y, r, color, alpha, idStr) {
  let h = 0;
  for (let i = 0; i < idStr.length; i++) h = (h * 31 + idStr.charCodeAt(i)) >>> 0;
  const angle = ((h % 360) * Math.PI) / 180;
  const beamLen = r * 8;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const beamGrad = ctx.createLinearGradient(0, 0, beamLen, 0);
  beamGrad.addColorStop(0, hexWithAlpha(color, 0.32 * alpha));
  beamGrad.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.3);
  ctx.lineTo(beamLen, -r * 0.05);
  ctx.lineTo(beamLen, r * 0.05);
  ctx.lineTo(0, r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const haloR = r * 1.5;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
  halo.addColorStop(0, hexWithAlpha(color, 0.95 * alpha));
  halo.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, haloR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hexWithAlpha(color, alpha);
  ctx.fill();
}

function drawCelestialBody(ctx, node, r, color, alpha, isHovered) {
  switch (node.category) {
    case 'family':
      drawRingedPlanet(ctx, node.x, node.y, r, color, alpha, node.strength);
      break;
    case 'romantic':
      drawSoftStar(ctx, node.x, node.y, r, color, alpha, isHovered);
      break;
    case 'friend':
      drawAnamorphicStar(ctx, node.x, node.y, r, color, alpha, isHovered);
      break;
    case 'mentor':
      drawQuasar(ctx, node.x, node.y, r, color, alpha, String(node.id));
      break;
    case 'professional':
      drawEmberStar(ctx, node.x, node.y, r, color, alpha, isHovered);
      break;
    case 'classmate':
    case 'coworker':
      drawHaloStar(ctx, node.x, node.y, r, color, alpha, isHovered);
      break;
    default:
      drawSoftStar(ctx, node.x, node.y, r, color, alpha, isHovered);
  }
}
```

- [ ] **Step 2: Replace the per-node body draw block in `draw()`**

In `draw()`, locate the for-loop that draws each node's body (currently `ctx.beginPath(); ctx.arc(node.x, node.y, r, ...); ctx.fillStyle = cat.color + ...; ctx.fill();` ... through the closing `ctx.fillText(node.name, node.x, node.y + r + 16);`). Replace just the body rendering — leave initials and name label intact:

```js
for (const node of nodesRef.current) {
  const cat = CATEGORIES[node.category] || CATEGORIES.other;
  const isFiltered = activeFilter && activeFilter !== node.category;
  const isHovered = hoveredRef.current?.id === node.id;
  const nodeAlpha = isFiltered ? 0.15 : 1;
  const r = node.radius * (isHovered ? 1.12 : 1);

  drawCelestialBody(ctx, node, r, cat.color, nodeAlpha, isHovered);

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
```

- [ ] **Step 3: Verify in browser**

Reload. Confirm visually:
- Mom (family) and Dad (family) and Grandma (family) → ringed planets with elliptical rings.
- Lily (romantic) → soft pink-white star with halo.
- Jake/Marcus (friend) → yellow star with horizontal + vertical anamorphic light cross.
- Prof. Chen (mentor) → cyan core with a faint cone-of-light beam.
- Kevin (professional) → ember orange star with warm halo.
- Alex/Ryan (classmate) and Tina (coworker) → small star with larger soft halo.

Hover any node — body grows ~12% and rim brightens.

- [ ] **Step 4: Commit**

```bash
git add src/components/Graph/ConstellationGraph.jsx
git commit -m "Render distinct celestial body per category"
```

---

## Task 7: Slow orbital drift (replace random sin/cos)

**Files:**
- Modify: `src/components/Graph/ConstellationGraph.jsx` — `initNodes`, `draw`

Spec section: *Component changes → ConstellationGraph → Slow orbital drift*.

- [ ] **Step 1: Update `initNodes` to set orbital fields per node**

In `initNodes`, in the `nodes.map(...)` body, replace the three current drift fields:

```js
driftOffset: Math.random() * Math.PI * 2,
driftSpeed: 0.002 + Math.random() * 0.003,
driftAmount: 1.5 + Math.random() * 3,
```

with:

```js
orbitAngle: Math.random() * Math.PI * 2,
orbitRadius: 3 + Math.random() * 5,
orbitSpeed: 0.0006 + Math.random() * 0.0008,
```

- [ ] **Step 2: Update the per-frame drift in `draw()`**

In `draw()`, replace the for-loop that updates `node.x`/`node.y` from drift (currently `node.x = node.baseX + Math.sin(t * node.driftSpeed + node.driftOffset) * node.driftAmount;` etc.) with:

```js
for (const node of nodesRef.current) {
  const r = node.radius + 20;
  node.orbitAngle += node.orbitSpeed;
  node.x = node.baseX + Math.cos(node.orbitAngle) * node.orbitRadius;
  node.y = node.baseY + Math.sin(node.orbitAngle) * node.orbitRadius;
  node.x = Math.max(PADDING_LEFT + r, Math.min(width - PADDING_RIGHT - r, node.x));
  node.y = Math.max(PADDING_TOP + r, Math.min(height - PADDING_BOTTOM - r, node.y));
}
```

- [ ] **Step 3: Verify in browser**

Reload. Confirm: nodes drift in small slow circular paths around their settled positions, not figure-8s. Whole sky reads as gently orbiting. No node escapes the viewport.

- [ ] **Step 4: Commit**

```bash
git add src/components/Graph/ConstellationGraph.jsx
git commit -m "Replace random drift with slow orbital motion"
```

---

## Task 8: Time-aware effects (recent pulse, dormant comet, birthday supernova)

**Files:**
- Modify: `src/components/Graph/ConstellationGraph.jsx`

Spec section: *Component changes → ConstellationGraph → Time-aware effects*.

- [ ] **Step 1: Add module-scope time helpers**

Add ABOVE `DEMO_PEOPLE` (alongside `hexWithAlpha` etc.):

```js
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
```

- [ ] **Step 2: Compute effect flags per node in `initNodes`**

In `initNodes` `nodes.map(...)`, add to the returned node object:

```js
daysSince: daysSince(person.lastContactAt),
isBirthday: isBirthdayToday(person.birthday),
```

- [ ] **Step 3: Layer pulse + comet BEFORE the celestial body, supernova AFTER it**

In `draw()`, in the for-loop that renders nodes, edit the structure so the body is wrapped by pre and post effects:

```js
for (const node of nodesRef.current) {
  const cat = CATEGORIES[node.category] || CATEGORIES.other;
  const isFiltered = activeFilter && activeFilter !== node.category;
  const isHovered = hoveredRef.current?.id === node.id;
  const nodeAlpha = isFiltered ? 0.15 : 1;
  const r = node.radius * (isHovered ? 1.12 : 1);

  if (!isFiltered && node.daysSince < 7) {
    const pulse = (Math.sin(t * 0.06) * 0.5 + 0.5);
    const pulseAlpha = (0.16 + pulse * 0.18) * nodeAlpha;
    const pulseR = r * 2.4 + pulse * r * 0.4;
    const grad = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, pulseR);
    grad.addColorStop(0, hexWithAlpha(cat.color, pulseAlpha));
    grad.addColorStop(1, hexWithAlpha(cat.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!isFiltered && node.daysSince >= 60 && Number.isFinite(node.daysSince)) {
    const tailLen = r * 3.5;
    const tx = node.x - Math.cos(node.orbitAngle) * tailLen;
    const ty = node.y - Math.sin(node.orbitAngle) * tailLen;
    const grad = ctx.createLinearGradient(tx, ty, node.x, node.y);
    grad.addColorStop(0, hexWithAlpha(cat.color, 0));
    grad.addColorStop(1, hexWithAlpha(cat.color, 0.28 * nodeAlpha));
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1, r * 0.45);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(node.x, node.y);
    ctx.stroke();
  }

  drawCelestialBody(ctx, node, r, cat.color, nodeAlpha, isHovered);

  if (!isFiltered && node.isBirthday) {
    const phase = (t % 360) / 360;
    const flashR = r + phase * r * 4.5;
    const flashAlpha = (1 - phase) * 0.7 * nodeAlpha;
    ctx.beginPath();
    ctx.arc(node.x, node.y, flashR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 245, 220, ${flashAlpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

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
```

- [ ] **Step 4: Verify in browser**

Reload. Confirm:
- Mom, Jake, Lily, Alex visibly *pulse* — soft halo around them grows and shrinks.
- Marcus, Kevin, Sarah show a faint comet-tail line trailing behind their drift direction.
- Sarah additionally flashes with an expanding ring every ~6 seconds (birthday).

- [ ] **Step 5: Commit**

```bash
git add src/components/Graph/ConstellationGraph.jsx
git commit -m "Add time-aware effects: recent pulse, dormant comet, birthday flash"
```

---

## Task 9: StarField — three parallax layers + Milky Way + dust

**Files:**
- Rewrite: `src/components/Graph/StarField.jsx`

Spec section: *Component changes → StarField*.

- [ ] **Step 1: Rewrite `StarField.jsx`**

Replace the entire contents of `src/components/Graph/StarField.jsx` with:

```jsx
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

      drawMilkyWay();

      const farPx = mx * 0.10;
      const farPy = my * 0.10;
      for (const s of milkyExtraRef.current) {
        const tw = Math.sin(time * s.twinkleSpeed + s.twinkleOffset);
        const a = s.opacity + tw * 0.15;
        ctx.beginPath();
        ctx.arc(s.x + farPx, s.y + farPy, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 215, 230, ${Math.max(0, a)})`;
        ctx.fill();
      }
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
```

- [ ] **Step 2: Verify in browser**

Reload. Confirm:
- A faint diagonal Milky Way band is visible (gentle warm-cream wash) crossing the screen at ~22°.
- Several large, very subtle nebula glows drift slowly.
- Tiny dust specks drift diagonally and wrap when off-screen.
- Move the mouse — far stars shift slightly, mid nebulae shift more, near dust shifts most (parallax).
- Shooting stars still occasionally streak.

- [ ] **Step 3: Commit**

```bash
git add src/components/Graph/StarField.jsx
git commit -m "Rewrite StarField with three parallax layers, Milky Way, and dust"
```

---

## Task 10: Header astrolabe + sidebar/prompt polish

**Files:**
- Modify: `src/App.jsx` — add astrolabe SVG inside the logo
- Modify: `src/App.css` — `.logo`, `.logo-glyph`, `.prompt-form` border tweak

Spec section: *Component changes → App chrome*.

- [ ] **Step 1: Add astrolabe SVG inside the header logo**

In `src/App.jsx`, replace the `<div className="logo">` block with:

```jsx
<div className="logo">
  <svg className="logo-glyph" width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="0.9" opacity="0.85" />
    <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
    <line x1="0.8" y1="7" x2="13.2" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
    <line x1="7" y1="0.8" x2="7" y2="13.2" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
    <circle cx="7" cy="7" r="1" fill="currentColor" />
  </svg>
  <span className="logo-text">Inner Circle</span>
</div>
```

- [ ] **Step 2: Add `.logo-glyph` CSS rule**

In `src/App.css`, add (after the existing `.logo` rule):

```css
.logo-glyph {
  color: var(--text-primary);
  flex-shrink: 0;
}
```

- [ ] **Step 3: Lift the prompt-form border luminosity**

In `src/App.css`, locate `.prompt-form` and update its `border` and `:focus-within` rules:

```css
.prompt-form {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(10, 10, 30, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(232, 232, 240, 0.12);
  border-radius: var(--radius-lg);
  transition: border-color 0.2s;
}

.prompt-form:focus-within {
  border-color: rgba(232, 232, 240, 0.28);
}
```

- [ ] **Step 4: Verify in browser**

Reload. Confirm: small astrolabe glyph next to "Inner Circle" wordmark in header. Sidebar dot colors in new palette. Prompt input has a slightly brighter ivory border that lifts on focus.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.css
git commit -m "Add header astrolabe glyph and polish prompt bar border"
```

---

## Task 11: Cinematic dolly + zoom + bokeh modal transition

**Files:**
- Modify: `src/App.jsx` — add `cinematicState`, `zoomTarget`, cosmos-stage wrapper, bokeh overlay
- Modify: `src/App.css` — `.cosmos-stage` classes, `.bokeh-overlay`
- Modify: `src/components/PersonModal/PersonModal.jsx` — accept `originPoint` prop, apply transform
- Modify: `src/components/PersonModal/PersonModal.css` — origin-based scale-in keyframe

Spec section: *Component changes → PersonModal + App → cinematic transition*.

- [ ] **Step 1: Add cinematic state and node-position capture in `App.jsx`**

In `src/App.jsx`, replace the body of `App()` so it has the new state and handlers — full replacement of the component:

```jsx
function App() {
  const [activeFilter, setActiveFilter] = useState(null);
  const [attachedNodes, setAttachedNodes] = useState([]);
  const [promptText, setPromptText] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [zoomTarget, setZoomTarget] = useState(null);
  const [cinematicState, setCinematicState] = useState('idle');

  const handleNodeClick = useCallback((node) => {
    setZoomTarget({ x: node.x, y: node.y });
    setCinematicState('zooming-in');
    setSelectedPerson(node);
    setTimeout(() => setCinematicState('open'), 380);
  }, []);

  const handleNodeDoubleClick = useCallback((node) => {
    setAttachedNodes((prev) => {
      if (prev.some((n) => n.id === node.id)) return prev;
      return [...prev, node];
    });
  }, []);

  const closeModal = useCallback(() => {
    setCinematicState('zooming-out');
    setTimeout(() => {
      setSelectedPerson(null);
      setZoomTarget(null);
      setCinematicState('idle');
    }, 280);
  }, []);

  const removeAttachedNode = useCallback((nodeId) => {
    setAttachedNodes((prev) => prev.filter((n) => n.id !== nodeId));
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!promptText.trim() && attachedNodes.length === 0) return;
    setPromptText('');
    setAttachedNodes([]);
  }, [promptText, attachedNodes]);

  const stageStyle = zoomTarget
    ? { transformOrigin: `${zoomTarget.x}px ${zoomTarget.y}px` }
    : undefined;

  const showModal = cinematicState !== 'idle' && selectedPerson;

  return (
    <div className="app">
      <div className={`cosmos-stage ${cinematicState}`} style={stageStyle}>
        <StarField />

        <header className="header">
          <div className="logo">
            <svg className="logo-glyph" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="0.9" opacity="0.85" />
              <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
              <line x1="0.8" y1="7" x2="13.2" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
              <line x1="7" y1="0.8" x2="7" y2="13.2" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
              <circle cx="7" cy="7" r="1" fill="currentColor" />
            </svg>
            <span className="logo-text">Inner Circle</span>
          </div>

          <div className="header-actions">
            <button className="btn-primary" onClick={() => setAddPersonOpen(true)}>+ Add Person</button>
          </div>
        </header>

        <aside className="sidebar">
          <div className="sidebar-label">Categories</div>
          {FILTERS.map((f) => (
            <button
              key={f.key ?? 'all'}
              className={`sidebar-chip ${activeFilter === f.key ? 'active' : 'inactive'}`}
              onClick={() => setActiveFilter(f.key === activeFilter ? null : f.key)}
            >
              {f.color && (
                <span className="filter-dot" style={{ background: f.color }} />
              )}
              {f.label}
            </button>
          ))}
        </aside>

        <div className="graph-container">
          <ConstellationGraph
            activeFilter={activeFilter}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
          />
        </div>

        <div className="prompt-area">
          {attachedNodes.length > 0 && (
            <div className="attached-nodes">
              {attachedNodes.map((node) => (
                <span
                  key={node.id}
                  className="attached-chip"
                  style={{ borderColor: CATEGORY_COLORS[node.category] || '#cdc9c0' }}
                >
                  <span
                    className="attached-chip-dot"
                    style={{ background: CATEGORY_COLORS[node.category] || '#cdc9c0' }}
                  />
                  {node.name}
                  <button
                    className="attached-chip-remove"
                    onClick={() => removeAttachedNode(node.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <form className="prompt-form" onSubmit={handleSubmit}>
            <input
              className="prompt-input"
              type="text"
              placeholder="Ask about your connections..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
            <button
              className="prompt-submit"
              type="submit"
              disabled={!promptText.trim() && attachedNodes.length === 0}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </form>
          <div className="prompt-hint">Click a node to view details — double-click to attach as context</div>
        </div>
      </div>

      {cinematicState !== 'idle' && (
        <div className={`bokeh-overlay ${cinematicState}`} onClick={closeModal} />
      )}

      {showModal && (
        <PersonModal
          person={selectedPerson}
          originPoint={zoomTarget}
          phase={cinematicState}
          onClose={closeModal}
        />
      )}
      <AddPersonModal open={addPersonOpen} onClose={() => setAddPersonOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Add cosmos-stage and bokeh CSS to `App.css`**

In `src/App.css`, add at the end of the file:

```css
.cosmos-stage {
  position: absolute;
  inset: 0;
  transition: transform 380ms cubic-bezier(0.16, 1, 0.3, 1), filter 380ms cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: 50% 50%;
  will-change: transform, filter;
}

.cosmos-stage.zooming-in,
.cosmos-stage.open {
  transform: scale(1.45);
  filter: blur(6px) brightness(0.7);
}

.cosmos-stage.zooming-out {
  transform: scale(1);
  filter: blur(0px) brightness(1);
  transition-duration: 280ms;
}

.bokeh-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  pointer-events: auto;
  background:
    radial-gradient(circle at 30% 40%, rgba(180, 200, 255, 0.06), transparent 35%),
    radial-gradient(circle at 70% 60%, rgba(220, 180, 200, 0.05), transparent 40%),
    rgba(5, 5, 16, 0.42);
  opacity: 0;
  transition: opacity 320ms ease-out;
}

.bokeh-overlay.zooming-in,
.bokeh-overlay.open {
  opacity: 1;
}

.bokeh-overlay.zooming-out {
  opacity: 0;
  transition-duration: 220ms;
}

@media (prefers-reduced-motion: reduce) {
  .cosmos-stage,
  .cosmos-stage.zooming-in,
  .cosmos-stage.open,
  .cosmos-stage.zooming-out {
    transform: none;
    filter: none;
    transition: none;
  }
  .bokeh-overlay {
    transition: none;
  }
}
```

- [ ] **Step 3: Add origin/phase props and entry transform to `PersonModal.jsx`**

In `src/components/PersonModal/PersonModal.jsx`, update the function signature and the root `pm-panel` div to apply the entry/exit class:

Change the signature:
```jsx
export default function PersonModal({ person, originPoint, phase, onClose }) {
```

Replace the `return (...)` JSX with:
```jsx
return (
  <div className={`pm-backdrop ${phase || ''}`} onClick={onClose} role="presentation">
    <div
      className={`pm-panel ${phase || ''}`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={`${person.name} details`}
      style={
        originPoint
          ? {
              '--origin-x': `${originPoint.x}px`,
              '--origin-y': `${originPoint.y}px`,
            }
          : undefined
      }
    >
      {/* ...keep all existing inner content unchanged... */}
    </div>
  </div>
);
```

(Inside the panel, leave all the existing markup unchanged — the close button, header, sections, etc.)

- [ ] **Step 4: Add origin-based scale-in to `PersonModal.css`**

In `src/components/PersonModal/PersonModal.css`, append:

```css
.pm-backdrop {
  z-index: 40;
  background: transparent;
}

.pm-panel {
  transform-origin: 50% 50%;
  transition: transform 360ms cubic-bezier(0.34, 1.4, 0.64, 1), opacity 320ms ease-out;
  opacity: 1;
}

.pm-panel.zooming-in {
  animation: pm-fly-in 380ms cubic-bezier(0.34, 1.4, 0.64, 1) both;
}

.pm-panel.zooming-out {
  animation: pm-fly-out 240ms ease-in both;
}

@keyframes pm-fly-in {
  0% {
    opacity: 0;
    transform: translate(
        calc(var(--origin-x, 50vw) - 50vw),
        calc(var(--origin-y, 50vh) - 50vh)
      )
      scale(0.18);
  }
  60% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
}

@keyframes pm-fly-out {
  0% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(
        calc(var(--origin-x, 50vw) - 50vw),
        calc(var(--origin-y, 50vh) - 50vh)
      )
      scale(0.4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pm-panel.zooming-in,
  .pm-panel.zooming-out {
    animation: none;
  }
}
```

- [ ] **Step 5: Verify in browser**

Reload. Click any node:
- Cosmos behind blurs and scales toward the clicked point.
- Bokeh overlay fades in.
- Modal panel "flies out" from the clicked node position to the screen center, with a slight overshoot.

Press Escape or click the bokeh:
- Modal scales back toward the clicked point and fades.
- Cosmos un-blurs and un-zooms.
- App returns to idle. Cursor unchanged.

Check filter sidebar still works during idle. Confirm double-click still attaches a node.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/App.css src/components/PersonModal/PersonModal.jsx src/components/PersonModal/PersonModal.css
git commit -m "Add cinematic dolly+zoom+bokeh transition for PersonModal"
```

---

## Task 12: AddPersonModal — satellite probe + solar flares + stardust burst

**Files:**
- Modify: `src/components/AddPersonModal/AddPersonModal.jsx`
- Modify: `src/components/AddPersonModal/AddPersonModal.css`

Spec section: *Component changes → AddPersonModal*.

- [ ] **Step 1: Replace the `apm-mic-wrap` block in `AddPersonModal.jsx`**

In `src/components/AddPersonModal/AddPersonModal.jsx`, also add a `bursting` state. Replace the entire body of the component with:

```jsx
import { useEffect, useState } from 'react';
import './AddPersonModal.css';

const STARDUST_PARTICLES = 28;

export default function AddPersonModal({ open, onClose }) {
  const [listening, setListening] = useState(false);
  const [bursting, setBursting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setListening(false);
      setBursting(false);
    }
  }, [open]);

  const handleProbeToggle = () => {
    if (listening) {
      setListening(false);
      setBursting(true);
      setTimeout(() => setBursting(false), 720);
    } else {
      setListening(true);
    }
  };

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
              {Array.from({ length: STARDUST_PARTICLES }, (_, i) => {
                const angle = (i / STARDUST_PARTICLES) * Math.PI * 2 + Math.random() * 0.4;
                const dist = 60 + Math.random() * 60;
                const dx = Math.cos(angle) * dist;
                const dy = Math.sin(angle) * dist;
                return (
                  <span
                    key={i}
                    className="apm-stardust-particle"
                    style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${Math.random() * 60}ms` }}
                  />
                );
              })}
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
```

- [ ] **Step 2: Add probe / flares / stardust styles to `AddPersonModal.css`**

In `src/components/AddPersonModal/AddPersonModal.css`, append:

```css
.apm-mic-wrap {
  position: relative;
}

.apm-probe {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 1px solid rgba(232, 232, 240, 0.18);
  background: radial-gradient(circle at 35% 30%, rgba(232, 232, 240, 0.08), rgba(10, 10, 30, 0.95));
  color: var(--text-primary, #e8e8f0);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s ease, transform 0.2s ease;
  z-index: 2;
}

.apm-probe:hover {
  border-color: rgba(232, 232, 240, 0.4);
}

.apm-probe.listening {
  border-color: rgba(232, 232, 240, 0.55);
}

.apm-flares {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1;
}

.apm-flare-arc {
  transform-origin: 110px 110px;
  animation: apm-flare-spin 3.6s linear infinite;
  opacity: 0.85;
}

@keyframes apm-flare-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.apm-stardust {
  position: absolute;
  top: 50%;
  left: 50%;
  pointer-events: none;
  z-index: 3;
}

.apm-stardust-particle {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(232, 232, 240, 0.95);
  box-shadow: 0 0 4px rgba(232, 232, 240, 0.6);
  animation: apm-stardust-burst 720ms ease-out forwards;
}

@keyframes apm-stardust-burst {
  0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .apm-flare-arc { animation: none; }
  .apm-stardust-particle { animation: none; opacity: 0; }
}
```

- [ ] **Step 3: Verify in browser**

Open Add Person modal:
- Probe icon (parabolic dish + body) replaces the old mic.
- Tap probe → status reads "Listening…", concentric flare arcs spin around the probe.
- Tap probe again → flares disappear, brief stardust burst (~30 particles) emits radially from the probe and fades, status reads "Charting…" momentarily, then "Tap probe to start".
- Esc closes modal. Backdrop click closes modal.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddPersonModal/AddPersonModal.jsx src/components/AddPersonModal/AddPersonModal.css
git commit -m "Replace mic with satellite probe, add solar flare arcs and stardust burst"
```

---

## Task 13: Final acceptance verification

**Files:** None (browser-based check)

Spec section: *Acceptance criteria*.

- [ ] **Step 1: Run through all 12 acceptance criteria manually**

In the browser at http://localhost:5173:

1. Console clean, frame rate smooth (Cmd+Opt+I → Performance / fps meter).
2. Move mouse around — far stars/nebulae/dust visibly shift at three different rates.
3. Spot 7 distinct celestial body shapes: ringed planet (Mom/Dad/Grandma), pink-white star (Lily), yellow anamorphic star (Jake/Marcus), cyan quasar with beam (Prof. Chen), ember orange (Kevin), halo star (Alex/Tina/Ryan).
4. Center YOU is a slowly-rotating astrolabe glyph.
5. Mom/Jake/Lily/Alex pulse; Marcus/Kevin/Sarah trail comet tails; Sarah additionally flashes (birthday).
6. Click Sarah — cosmos blurs+zooms toward her, modal flies in, esc closes cleanly.
7. Click Family filter — non-family nodes dim, family nodes highlighted.
8. Double-click Jake — chip appears in prompt area; remove it via × button.
9. Click + Add Person — modal opens with satellite probe, flare arcs play, stardust burst on stop.
10. Press Escape with any modal open — closes.
11. Resize window to <768px — UI still functional, parallax simplified.
12. macOS *System Settings → Accessibility → Reduce Motion* on — verify heavy animations collapse.

- [ ] **Step 2: Fix any regressions found**

If any criterion fails, return to the relevant Task and patch. Each fix gets its own commit.

- [ ] **Step 3: Final summary commit**

If any small adjustments were made, commit them. Otherwise no commit needed.

- [ ] **Step 4: Hand back for user review**

Report status, list of commits on `ui/living-constellation`, and direct the user to localhost:5173 for hands-on review before any merge to `main`.

---

## Self-review checklist (run after writing the plan)

**Spec coverage:**
- ✅ Visual identity → palette: Task 3 covers all category color tokens and edge color tuples.
- ✅ Visual identity → typography: unchanged, no task needed.
- ✅ Motion principles: implicit in per-feature timings (orbit speed, pulse 3s, supernova 6s, modal 380/280ms, reduced-motion respected).
- ✅ StarField → 3 layers + Milky Way + dust: Task 9.
- ✅ ConstellationGraph → celestial bodies: Task 6.
- ✅ ConstellationGraph → orbital drift: Task 7.
- ✅ ConstellationGraph → time-aware effects: Task 8.
- ✅ ConstellationGraph → astrolabe YOU: Task 5.
- ✅ ConstellationGraph → edges desaturated: Task 3 step 3.
- ⚠️ ConstellationGraph → binary star (romantic) special-case: NOT covered as a separate task. The spec says it activates only when exactly one romantic relationship exists. With Lily as the only romantic, it would apply. Decision: defer. The current `drawSoftStar` for romantic is already visually distinctive (pink-white halo). Adding the binary-rotation special case is a stretch goal that risks complicating layout. Documented here as an explicit deferral; if Ethan asks for it during review, add as a follow-up task.
- ✅ PersonModal → cinematic dolly: Task 11.
- ✅ AddPersonModal → satellite probe + flares + stardust: Task 12.
- ✅ Chrome → header astrolabe + sidebar chips + prompt bar: Task 10 + Task 3.
- ✅ App background simplification: Task 4.
- ✅ Data changes (lastContactAt + Sarah birthday): Task 2.
- ✅ Acceptance criteria: Task 13.
- ✅ Branching: Task 1.

**Placeholder scan:** No "TBD"/"TODO"/"implement later" in tasks. All code blocks complete. Verification steps describe exactly what to look for.

**Type/name consistency:** `drawCelestialBody`, `drawSoftStar`, `drawHaloStar`, `drawEmberStar`, `drawAnamorphicStar`, `drawRingedPlanet`, `drawQuasar`, `hexWithAlpha`, `daysSince`, `isBirthdayToday` — all consistent across tasks. Node fields (`orbitAngle`, `orbitRadius`, `orbitSpeed`, `daysSince`, `isBirthday`) consistent between Task 7 and Task 8. CSS classes (`cosmos-stage`, `bokeh-overlay`, `pm-panel`, `apm-probe`, `apm-flares`, `apm-stardust`) consistent.

**Scope:** Single coherent UI overhaul. ~13 tasks, each 2–10 minutes of focused work, gated by browser verification.

**Documented deferral:** Romantic binary-star special case — flagged in self-review, can be added post-merge if requested.
