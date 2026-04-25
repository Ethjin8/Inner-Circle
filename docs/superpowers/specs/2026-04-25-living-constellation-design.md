# Living Constellation — UI Overhaul Design Spec

**Date:** 2026-04-25
**Author:** Ethan + Claude
**Source brainstorm:** `docs/ui-brainstorm.md` (Direction #1)

## Overview

Push Inner Circle's existing "stars on a flat backdrop" UI into a fully cinematic Living Constellation: a multi-layered cosmos with parallax depth, distinct celestial-body types per relationship category, time-aware motion, and a film-camera-style modal transition. Underlying behavior (single-click view, double-click attach, filter dimming, voice onboarding flow, add-person modal) is preserved bit-for-bit; only the visual layer changes.

Success means a hackathon judge looks at the screen for two seconds and immediately *feels* a moving universe rather than another React dashboard — and a returning user never notices a functional regression.

## Visual identity

### Palette

```
Background base:          #050510   (unchanged)
Milky Way band tint:      rgba(220, 210, 200, 0.04)  (warm cream wash, faint)
Astrolabe / YOU glyph:    #e8e8f0   (pale ivory, replaces blue)

Family       — ringed planet     #e8b06b  (warm gold/amber)
Romantic     — binary partner    #ffc8d6  (soft pink-white)
Friend       — yellow star       #ffce5c  (warm yellow)
Classmate    — blue-white star   #b9d0ff  (cool ice)
Coworker     — green-white star  #9be6c4  (cool mint)
Professional — ember star        #ff9c5a  (warm orange)
Mentor       — quasar            #7df9ff  (electric cyan)
Other        — dim white         #cdc9c0  (neutral ivory)

Strength edges (relationship lines from YOU):
  Strong (>= 65)  rgba(120, 220, 170, 0.55)  (cool sage green, desaturated)
  Mid    (40-64)  rgba(240, 210, 110, 0.55)  (soft amber, desaturated)
  Weak   (< 40)   rgba(220, 130, 130, 0.55)  (dusty rose, desaturated)
```

The current saturated category palette (`#f472b6`, `#60a5fa`, etc.) is replaced — the new palette reads as a coherent astronomical scene rather than a UI legend.

### Typography

Unchanged. Space Grotesk (display) + Inter (body) already feel cosmic-friendly.

### Motion principles

- **Slow > fast.** The cosmos is a scale where motion is barely perceptible. Most animations run at 0.5–1 Hz or slower.
- **Layered parallax.** Depth is conveyed by *differential motion*, not just blur or scale.
- **Earned moments.** Strong effects (supernova flash, modal dolly, stardust coalesce) happen rarely so they feel cinematic, not noisy.
- **Reduced motion respected.** Every animation collapses to its end state under `prefers-reduced-motion`.

## Component changes

### 1. `StarField.jsx` — three-layer parallax cosmos

Replace the single-layer twinkle field with three rendered layers in z-order:

| Layer | Content | Mouse parallax factor |
|---|---|---|
| **Far** | Existing twinkle stars (~120 of them, smaller average size) | 0.10× |
| **Mid** | 6–8 soft nebula blobs (large radial gradients, low opacity, slowly drifting), faint Milky Way band | 0.25× |
| **Near** | Particulate dust (~40 tiny moving specks drifting diagonally) | 0.55× |

- **Milky Way band:** a single wide elliptical gradient rotated ~22° across the screen, color `rgba(220, 210, 200, 0.04)`, with a sparse cluster of ~30 extra tiny stars sprinkled along its axis to suggest density.
- **Nebula blobs:** 6–8 radial gradients in muted purples (`rgba(124, 90, 200, 0.05)`), teals (`rgba(60, 180, 200, 0.04)`), and rose (`rgba(220, 130, 150, 0.03)`); positions drift over 25-second loops.
- **Dust:** small specks (~1px) drifting at slight angles, wrapping when off-screen. Adds "you are inside something" feel.
- **Shooting stars:** kept exactly as today (already nice).

Below 768px viewport: parallax disabled (mouse-tracking off, layers static), nebulae count cut to 3, dust cut to 15.

### 2. `ConstellationGraph.jsx` — celestial bodies + time-aware motion

#### Celestial body rendering — one renderer per category

Each draw step calls a per-type render function instead of the current `arc + fill` for every node. Drawn within the same Canvas2D context — no Three.js.

- **Family — ringed planet.** Filled circle in family color + 1–2 elliptical rings (slightly tilted ~15°), thinner ring stroke. Ring presence/count subtly varies with relationship strength.
- **Romantic — binary star (special case).** *If exactly one romantic relationship exists*, render YOU and that partner as a binary system: both rotate slowly around a barycenter offset from screen center, both drawn as small luminous bodies sharing a faint shared-orbit ellipse. With zero or multiple romantic relationships, fall back to a regular pink-white star at each romantic person's position.
- **Friend — yellow star.** Filled circle in friend color + a soft 4-point anamorphic light cross drawn as two thin perpendicular gradient lines through center.
- **Classmate — blue-white star.** Filled circle in classmate color with a slightly larger soft halo gradient ring.
- **Coworker — green-white star.** Same shape as classmate, green-white tint.
- **Professional — ember orange star.** Slightly more saturated halo, warmer.
- **Mentor — quasar.** Small bright core + a faint cone-of-light beam extending outward at a fixed per-node angle (deterministic from node id). Beam is a triangular gradient, low opacity.
- **Other — dim ivory star.** Plain circle.

Initials and name labels render exactly as today on top of the celestial body.

#### Slow orbital drift (replaces random sin/cos)

Each node carries an `orbitAngle` and `orbitRadius` (small, 3–8px). Per frame:
```
node.x = node.baseX + cos(orbitAngle) * orbitRadius
node.y = node.baseY + sin(orbitAngle) * orbitRadius
orbitAngle += angularVelocity   // ~0.0008 rad/frame, slight per-node variance
```
The whole sky appears to slowly orbit. Existing collision-resolved `baseX/baseY` is unchanged.

#### Time-aware effects

Driven by a new synthesized `lastContactAt` per person (see *Data changes*).

- **Recent pulse halo.** If `lastContactAt` within 7 days, the body's outer glow gently pulses (sin wave, ~3s period, ±15% radius on the halo).
- **Dormant comet tail.** If `lastContactAt` > 60 days ago, draw a fading line trailing behind the orbital drift direction (length ~3× node radius, alpha gradient from 0.25 → 0).
- **Birthday supernova flash.** If `birthday` matches today's month/day (±1 day window), once per ~6 seconds emit a one-frame radial flash (white-to-transparent, expanding ~40px ring with peak alpha 0.7). Loops so demos always show it.

#### Center "YOU" → astrolabe glyph

Replace the solid blue `#375ac8` circle at center with a thin-stroked astrolabe:
- Outer ring (1.5px stroke, ivory)
- Inner ring at 60% radius
- Cross-hairs N/S/E/W
- Small filled center dot
- Slowly rotates: 360° per ~30s.
- "YOU" text label rendered slightly *below* the glyph rather than inside, so it doesn't clip cross-hairs.

When the binary-star case is active, the astrolabe and the romantic partner both orbit the shared barycenter.

#### Edges from YOU

Kept as straight lines from center to each node, but:
- Color comes from the new desaturated strength palette (sage / amber / dusty-rose), not the old saturated greens/yellows/reds.
- Thickness mapping unchanged.
- Faint same-category cross-links also kept; restyled as 1px dashed `rgba(255,255,255,0.04)`.

### 3. `PersonModal.jsx` + `App.jsx` — cinematic dolly + zoom

When a node is clicked:
1. App captures `{ x, y }` of the clicked node from canvas coordinates and stores `zoomTarget` state.
2. Wrapper around `<ConstellationGraph>` and `<StarField>` (a new `<div class="cosmos-stage">`) gets `transform: translate(...) scale(1.6)` toward the clicked point + `filter: blur(6px)` over 380ms with `--ease-out`.
3. A new `<div class="bokeh-overlay">` fades in over the cosmos (radial gradient with subtle dot noise, alpha → 0.35).
4. `PersonModal` mounts; its container animates from `transform: translate(<nodePos>) scale(0.2); opacity: 0` to centered `scale(1); opacity: 1` over 320ms with a slight overshoot easing.

On close (esc / backdrop click):
1. Modal animates back: scale → 0.6, opacity → 0 (220ms).
2. Cosmos un-zooms and un-blurs (260ms).
3. Bokeh overlay fades out.
4. App clears `zoomTarget`.

State machine in `App.jsx` carries a `cinematicState` of `idle | zooming-in | open | zooming-out`. `PersonModal` only renders when state is `open` or `zooming-out`.

`prefers-reduced-motion`: skip the zoom/blur/bokeh; modal just opens/closes with simple opacity fade.

### 4. `AddPersonModal.jsx` — satellite probe + solar flare arcs + stardust

- **Probe icon.** Replace the current mic SVG with a small satellite-probe glyph (parabolic dish, body, antenna). Same affordance — tap to start/stop "listening".
- **Solar-flare arcs.** While `listening`, render 4–6 thin curved arcs sweeping outward from the probe, animated with staggered phases. Implemented as SVG strokes with `stroke-dasharray` animation, not canvas.
- **Stardust coalesce.** When the user "stops" listening (mock submit), trigger a 700ms stardust burst: ~30 small particles emit from the probe and scatter outward fading. Then the modal closes, and (out of scope for this spec but stubbed) the new node would coalesce on the canvas. For now the burst itself is what users see; new-node coalesce is left as a hook for when real person creation lands.
- Hint copy unchanged.

### 5. App chrome

- **Header logo.** Prepend a small static astrolabe glyph (12px) before the "Inner Circle" wordmark.
- **Sidebar chips.** Filter dot colors retuned to the new cosmic palette (gold for family, yellow for friend, cyan for mentor, etc.). Active state unchanged.
- **Prompt bar.** Border color shifted to a pale ivory tint (`rgba(232, 232, 240, 0.12)`), focus state slightly luminous. Hint text restyled with subtle italic. Submit arrow unchanged.
- **App background.** Replace current `radial-gradient(...rgba(20,20,60,0.4)...)` with a deeper, more uniform near-black (`#050510`) — the parallax layers carry the visual interest now, not the bg gradient.

## Data changes

Demo-only; no schema migration.

- Synthesize `lastContactAt` (ISO string) on each of the 12 demo people in `ConstellationGraph.jsx`'s `DEMO_PEOPLE`. Distribution to ensure all three time-effect states demo:
  - 4 people with contact within 7 days (recent-pulse).
  - 5 people with contact 8–59 days ago (no special effect).
  - 3 people dormant 60+ days ago (comet tail).
- Set one demo person's `birthday` to today's month/day (Apr 25) so the supernova flash demos visibly. Candidate: Sarah (id `3`, currently has no birthday — easy to assign).

No other schema fields added.

## Out of scope

- True 3D / Three.js — separate direction in the brainstorm doc.
- Real audio capture or speech-to-text — voice agent is its own workstream.
- Firebase / Cloud Functions / Firestore changes.
- Stardust *coalesce on canvas* for newly-created people (only the in-modal burst lands in this overhaul).
- Legacy `NodeCard` and `Onboarding` components — not wired into App.jsx today, leaving as-is.
- Mobile-specific feature additions beyond keeping current behavior working.

## Acceptance criteria

The overhaul is "done" when, on `npm run dev`:

1. ✅ Home page renders without console errors and 60fps on a Macbook Pro.
2. ✅ Three parallax layers visibly respond to mouse movement on desktop.
3. ✅ Each of the 7 categories renders a visibly distinct celestial-body shape.
4. ✅ Center "YOU" is a slowly-rotating astrolabe glyph, not a blue disk.
5. ✅ At least one node visibly pulses (recent), at least one shows a comet tail (dormant), and one flashes (birthday today).
6. ✅ Clicking a node triggers the dolly+zoom+blur+bokeh transition into the PersonModal; closing reverses cleanly.
7. ✅ Filter sidebar dims non-matching nodes (existing behavior preserved).
8. ✅ Double-click on a node still attaches it as a chip in the prompt area.
9. ✅ Add Person modal opens, shows the satellite probe, plays solar-flare arcs while "listening", emits stardust on stop.
10. ✅ Esc closes any open modal; modal backdrop click closes.
11. ✅ Below 768px the page still works (no layout breakage), parallax simplified.
12. ✅ `prefers-reduced-motion: reduce` collapses heavy animations.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Canvas perf drops with 3 layers + per-type rendering | Cap layer counts (120 stars, 8 nebulae, 40 dust); use offscreen canvas for static layers (Milky Way) where helpful. |
| Modal cinematic transition janky if heavy work runs concurrently | Run zoom on the *wrapper element*, not the canvas — leverages GPU compositing. Reduce render frequency during transition. |
| Color palette shift loses recognizability of categories | Keep the *legend* coupling (sidebar chips show new color); first impressions of judges matter more than longtime-user color memory. |
| User loses orientation when nodes orbit | Orbit radius small (3–8px), angular velocity tiny — sky barely moves within a 30-second look. |
| Birthday supernova effect feels gimmicky | Limit to ±1 day window and ~6s period; only one demo person triggers it. |
| Existing functionality regression | Acceptance criteria #6–#11 explicitly cover preserved behavior; manual browser test before declaring done. |

## Branching and verification

- All work happens on a fresh feature branch off the current `main` HEAD (which carries the user's current WIP).
- `main` is not touched until the user reviews the result.
- After implementation, run `npm run dev`, verify all 12 acceptance-criteria points in a browser, then hand back for sign-off before any merge.
