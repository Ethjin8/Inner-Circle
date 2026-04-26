# Inner Circle — Design System

> **Single source of truth.** Every UI change references this doc. If you find yourself inventing a value (font size, color, radius, easing), check here first. If it's not here and it should be, add it — don't fork it.

**Last updated:** 2026-04-26

---

## 1. Voice & principles

Inner Circle is a constellation of the people who matter most. The interface should feel **editorial, calm, and intimate** — closer to a hand-bound notebook than a SaaS dashboard.

Five non-negotiables, in priority order:

1. **Editorial over template.** Serif display type, generous negative space, considered hierarchy. Nothing about the UI should feel like a Vite + Tailwind starter.
2. **Minimal chrome.** No glassmorphism, no gradient buttons, no drop-shadow stacks. Borders are 1px hairlines. Surfaces are flat black.
3. **Thickness, not opacity.** When something needs emphasis (an edge, a node, a divider), make it heavier — don't make it brighter or fade neighbors.
4. **The canvas is the product.** The constellation graph fills the viewport. UI elements are floating, dismissible, and never compete with the sky.
5. **Keyboard-first navigation.** ⌘K opens everything important. Power users should never have to mouse to a sidebar.

---

## 2. Typography

### Fonts

Two families. Geist scales from 11px tabular to 96px display without changing personality, so we don't need a serif for emphasis — weight and size do the work. **No serif typeface anywhere in the product.** This is a tool, not an editorial magazine.

| Role | Family | Use for |
|---|---|---|
| **Display / UI / body** | `Geist` | Everything text: page titles, the "Inner Circle" wordmark, person names, buttons, labels, descriptions, sidebar text, prompts, tooltips. |
| **Numeric** | `Geist Mono` | Scores, counts, dates, IDs, timestamps. Anything tabular. |

**HTML head (`index.html`):**

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

**CSS tokens (`src/index.css`):**

```css
--font-display: 'Geist', system-ui, -apple-system, sans-serif;
--font-body:    'Geist', system-ui, -apple-system, sans-serif;
--font-mono:    'Geist Mono', ui-monospace, monospace;
```

`--font-display` is kept as a token alias for semantic clarity at call sites, but it points at the same family as `--font-body`. Display moments are differentiated by **size and weight**, not by family.

### Type scale

Use these tokens. Don't invent new sizes.

| Token | Size | Line height | Tracking | Typical use |
|---|---|---|---|---|
| `--text-xs`   | 11px | 1.4 | 0     | Caption, helper text |
| `--text-sm`   | 12px | 1.45 | 0    | Sidebar labels, chips, metadata |
| `--text-base` | 13px | 1.5 | 0     | Default UI body |
| `--text-md`   | 14px | 1.5 | 0     | Primary actions, dense paragraphs |
| `--text-lg`   | 16px | 1.5 | 0     | Tagline, modal subheaders |
| `--text-xl`   | 20px | 1.3 | -0.01em | Section headers (sans) |
| `--text-2xl`  | 28px | 1.2 | -0.01em | Person name in modal |
| `--text-3xl`  | 44px | 1.05 | -0.02em | Modal hero, large display |
| `--text-4xl`  | 72px | 1.0 | -0.025em | Landing wordmark "Inner Circle" |

### Weight rules

- **Geist:** 300 for the largest display sizes (`--text-3xl`+) where ultra-light feels intentional. 400 default body. 500 for emphasized labels and chip text. 600 for primary buttons and active nav. 700 reserved for the wordmark and rare hero moments.
- **Geist Mono:** 400 default. 500 for emphasized numerics (e.g., a highlighted score).

### Hierarchy patterns

```
Inner Circle              ← Geist 300, --text-4xl, --text-primary (landing wordmark)
Stay in touch with…       ← Geist 400, --text-lg, --text-secondary

Friends                   ← Geist 500, --text-2xl (memory gallery row)
12 memories               ← Geist Mono 400, --text-sm, --text-muted

Lily Chen                 ← Geist 500, --text-2xl (modal)
Closest friend · 73/100   ← Geist 400, --text-sm + Geist Mono for "73/100"
```

Display moments lean on weight contrast (300 ultra-light against 500 medium) rather than typeface change. Track display sizes slightly tighter (`-0.02em`) to keep them feeling deliberate at scale.

### Don't

- ❌ Don't introduce a serif typeface anywhere. We're a single-family system.
- ❌ Don't mix mono and proportional Geist on the same line of running text (numerics inline are fine — it's the eye-jarring shift in width that we avoid for blocks).
- ❌ Don't justify text. Left-align everything.

---

## 3. Color

### Surfaces

We are committed to **flat true-black** for all surfaces. No layered grays. Hierarchy comes from borders, not fills.

| Token | Value | Use |
|---|---|---|
| `--bg-deep`     | `#0e0e0e` | Page background |
| `--bg-base`     | `#0e0e0e` | Same — alias |
| `--surface-1`   | `#0e0e0e` | Sidebars, toolbars, palette |
| `--surface-2`   | `#0e0e0e` | Floating chips, prompt bar |
| `--surface-3`   | `#0e0e0e` | Modals |
| `--backdrop`    | `rgba(0, 0, 0, 0.6)` | Modal scrim |

### Borders

The **only** way to denote elevation. 1px solid, never dashed in UI chrome (dashed lines are reserved for the constellation's "weak edge" treatment).

| Token | Value | Use |
|---|---|---|
| `--border-subtle`  | `rgba(255,255,255,0.06)` | Inner dividers, hairlines |
| `--border-default` | `rgba(255,255,255,0.10)` | Card edges, chip outlines, palette |
| `--border-strong`  | `rgba(255,255,255,0.18)` | Modal panels, focused inputs |

### Text

| Token | Value | Use |
|---|---|---|
| `--text-primary`   | `#e8e8f0` | Default body and headings |
| `--text-secondary` | `#8a8a9a` | Subtitles, metadata |
| `--text-muted`     | `#55556a` | Helper text, disabled, footnotes |

### Accent

A single accent color used for active states. **No accent gradients, ever.**

| Token | Value | Use |
|---|---|---|
| `--accent-cream` | `#e8e8f0` | Same as `--text-primary` — default "active" treatment is just bright white text |
| `--accent`       | `#7df9ff` | Reserved for genuinely interactive cyan moments (active tab underline, focus ring). Use sparingly. |

### Celestial palette (graph only)

Hues spaced ~50° apart. Used **only** in the constellation graph and small category dots in the UI. Never use these for buttons, links, or arbitrary highlights.

| Token | Value | Category |
|---|---|---|
| `--celestial-family`       | `#f5a25b` | Family (amber) |
| `--celestial-friend`       | `#f3d24d` | Friend (yellow) |
| `--celestial-coworker`     | `#5fd496` | Coworker (green) |
| `--celestial-classmate`    | `#7ea8ff` | Classmate (blue) |
| `--celestial-mentor`       | `#a884ff` | Mentor (violet) |
| `--celestial-romantic`     | `#f9a3c0` | Romantic (pink) |
| `--celestial-professional` | `#f06d6d` | Professional (coral red) |
| `--celestial-other`        | `#bdc1c6` | Other (neutral) |

### Strength colors (graph edges)

Stored as raw RGB triplets so they can be combined with any opacity in canvas:

```css
--strength-strong: 120, 220, 170;  /* close — green */
--strength-mid:    240, 210, 110;  /* warm — amber */
--strength-weak:   220, 130, 130;  /* dormant — coral */
```

---

## 4. Spacing

8-point base. No arbitrary pixel values in margins/paddings — pick a token.

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |
| `--space-24` | 96px |

**Rules of thumb:**
- Inside a chip/button: `--space-2` vertical, `--space-3` horizontal.
- Between sibling cards: `--space-4`.
- Between sections in a modal: `--space-6` to `--space-8`.
- Modal outer padding: `--space-8`.
- Landing page hero margin between title and constellation: `--space-12`.

---

## 5. Borders & radii

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 6px  | Chips, small icon buttons |
| `--radius-sm` | 8px  | Inputs, buttons, dropdowns |
| `--radius-md` | 12px | Cards, palette items |
| `--radius-lg` | 16px | Modals |
| `--radius-xl` | 24px | Hero cards, full-bleed gallery image |
| `--radius-full` | 9999px | Avatar circles, status dots |

**Don't** stack rounded radii inside rounded radii — pick one and commit. A `--radius-md` card with `--radius-sm` buttons inside is fine; a `--radius-lg` card with `--radius-md` cards inside its body is messy.

---

## 6. Iconography

**Library:** [`lucide-react`](https://lucide.dev). Already shadcn's default. Install with:

```bash
npm install lucide-react
```

### Rules

- Sizes: **14px** (in dense UI: chips, sidebar rows), **16px** (default in buttons), **20px** (toolbar primary actions).
- Stroke: 1.5 (default lucide). Never fill icons.
- Color: inherits `currentColor`. Default `--text-secondary` for passive icons, `--text-primary` for active/hovered.
- Always pair with a text label, or set `aria-label`.

### Emoji → Lucide migration table (Explorer dropdown + chrome)

| Emoji | Replace with | Notes |
|---|---|---|
| 🎉 | `Cake` | Birthday |
| 🔥 | `Zap` | Strength score |
| 🎓 | `GraduationCap` | School |
| 💼 | `Briefcase` | Work |
| ↗ | `ArrowUpRight` | "View Full Card" |
| 🎯 | `Target` | Nudge / goal |
| 📍 | `MapPin` | Location |
| ✨ | `Sparkles` | AI-generated content (use sparingly) |
| 🗓️ | `Calendar` | Date |
| 💬 | `MessageCircle` | Chat / conversation |

**Hard rule:** zero emojis in the UI chrome. Emojis remain allowed inside *user-generated content* (memory captions, chat messages) — but never in our own labels.

---

## 7. Motion

### Tokens

```css
--duration-fast: 120ms;   /* hovers, focus rings, instant feedback */
--duration-base: 200ms;   /* opens/closes, panel slides */
--duration-slow: 320ms;   /* modal in/out, page transitions */
--duration-cinematic: 800ms; /* landing → graph zoom, only here */

--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);   /* default for entrances */
--ease-in:     cubic-bezier(0.4, 0, 1, 1);       /* default for exits */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* playful, used for chip pops */
```

### Rules

- Default to `--duration-base` + `--ease-out` for any state change.
- Hover scale: max **1.04**, only on Memory Gallery cards. Never on UI chrome.
- Translate transitions never exceed 8px.
- Respect `prefers-reduced-motion: reduce` — already wired in `index.css`. Don't bypass it.

---

## 8. Elevation

We don't use shadows for elevation in chrome. They exist as escape hatches for two cases only:

```css
--elevation-sm: 0 1px 2px rgba(2, 2, 8, 0.4);   /* hovered chip / picked-up draggable */
--elevation-md: 0 8px 24px rgba(2, 2, 8, 0.5);  /* command palette open */
--elevation-lg: 0 24px 64px rgba(2, 2, 8, 0.55);/* modal open */
```

**Don't** put a shadow on a static element. If something looks "flat," that's the point.

---

## 9. Z-index layers

Document every `z-index`. Don't invent ad-hoc values.

| Layer | Value | Use |
|---|---|---|
| canvas         | 0     | Constellation graph |
| floating-pill  | 10    | Bottom-left filter pill |
| chat-dock      | 20    | Chat agent at bottom |
| toolbar        | 30    | Top-center view-mode toolbar |
| palette        | 40    | ⌘K command palette |
| modal-backdrop | 50    | Scrim |
| modal          | 60    | Modal content |
| toast          | 70    | Toasts (none yet — reserved) |

---

## 10. Component patterns

### Button — primary

```
border: 1px solid var(--border-strong)
background: transparent
color: var(--text-primary)
font: Geist 500, var(--text-md)
padding: var(--space-2) var(--space-4)
border-radius: var(--radius-sm)
transition: background var(--duration-fast) var(--ease-out)

&:hover { background: rgba(255,255,255,0.04) }
&:active { background: rgba(255,255,255,0.08) }
```

No filled buttons in chrome. Even the "sign in" CTA is outlined.

### Button — ghost (default for icon buttons)

```
border: none
background: transparent
color: var(--text-secondary)

&:hover { color: var(--text-primary); background: rgba(255,255,255,0.04) }
```

### Input

```
border: 1px solid var(--border-default)
background: transparent
color: var(--text-primary)
font: Geist 400, var(--text-md)
padding: var(--space-2) var(--space-3)
border-radius: var(--radius-sm)

&:focus { border-color: var(--border-strong); outline: none }
```

No focus rings except on interactive elements that aren't visually obvious (keyboard tab targets get a 2px `--accent` outline at 2px offset).

### Chip

```
border: 1px solid var(--border-default)
background: transparent
color: var(--text-secondary)
font: Geist 500, var(--text-sm)
padding: 4px 10px
border-radius: var(--radius-full)
```

### Card

```
border: 1px solid var(--border-default)
background: var(--surface-1)
border-radius: var(--radius-md)
padding: var(--space-5)
```

### Modal

```
background: var(--surface-3)
border: 1px solid var(--border-strong)
border-radius: var(--radius-lg)
box-shadow: var(--elevation-lg)
max-width: 640px (default), 880px (memory features)
padding: var(--space-8)
```

Backdrop: `var(--backdrop)`, fade in with `--duration-slow` `--ease-out`.

### Command Palette (⌘K)

shadcn `Command` component. Always centered horizontally, top: 20vh. Width: 560px. Closes on `Esc`. Items use `--text-md` Geist 400, with `Geist Mono` for keyboard hint badges on the right.

### Sidebar (the *new* model)

We do not have a persistent sidebar. The Explorer becomes a **filter panel** invoked from the floating pill (bottom-left). When open, it slides up from the bottom-left as a 320px-wide floating panel with `--elevation-md`. Contains the same category tree and search, just floating instead of docked.

---

## 11. Constellation graph specifics

### Node sizing

Node radius is a function of relationship strength. Use **size** to encode strength, not glow.

| Strength | Radius | Notes |
|---|---|---|
| 0–20 (acquaintance) | 3px | |
| 21–50 (familiar)    | 5px | |
| 51–75 (close)       | 7px | |
| 76–100 (inner)      | 10px | |

The "You" node is **12px** and rendered in `--text-primary` white. It has a 1px white outer ring at radius 16px to mark it as the anchor. No bloom in the in-app graph; the landing keeps a soft NorthStar bloom.

### Edges

Stroke width encodes strength. **Use thickness, not opacity.**

| Strength bucket | Stroke width | Color (with alpha) |
|---|---|---|
| Strong (>70) | 1.5px | `rgba(var(--strength-strong), 0.8)` |
| Mid (30–70)  | 1.0px | `rgba(var(--strength-mid), 0.7)` |
| Weak (<30)   | 0.5px | `rgba(var(--strength-weak), 0.6)` |

No gradient edges. No glow. No animated dashes by default — pulses only on hover or scoring events.

### Layout

Force-directed with **higher repulsion** than the library default. Aim for: average node-to-node distance ≥ 80px at viewport center, and category clusters separated by ≥ 160px of empty space. Spread nodes; don't crowd.

### Labels

Person names: Geist 400, 12px, `--text-primary`, offset 12px below node center.
Category headers: Geist 500 uppercase, 11px, letterSpacing 0.22em, `--text-secondary`, offset 16px above cluster centroid.

### The "You" node lockup (cross-screen alignment)

The "You" node lives at viewport center: `(50%, 50%)`. **Both** the landing page constellation and the in-app graph render it at this exact location at zoom level 1.0. Don't offset it on either screen. The landing → app transition is purely a zoom + crossfade; there is no positional movement of the You node.

Pixel-equivalence checklist when implementing:
- [ ] Landing canvas viewport center → You node center
- [ ] Landing You-node radius at zoom 1.0 == in-app radius at zoom 1.0 (12px)
- [ ] No CSS `transform: translateY(...)` differences between the two views
- [ ] Background color identical: `#0e0e0e`

---

## 12. Page-level patterns

### Landing

```
[ canvas: full-bleed constellation, dim opacity 0.55 ]
[ centered overlay group, vertical stack ]:
   "Inner Circle"           (Geist 300, --text-4xl, --text-primary, tracking -0.025em)
   "Stay in touch with the  (Geist 400, --text-lg, --text-secondary)
    people that matter most"
   [Sign in →]              (outlined button, Geist 500, --text-md)
```

The constellation behind shows the user's actual graph data (read-only, dimmed, no labels) for returning users. New users get a default decorative pattern. On sign-in, opacity transitions to 1.0, labels fade in, the You node brightens.

### Memory Gallery (Netflix rows)

```
[ sticky top: page header — Geist 500 "Memories", --text-3xl, tracking -0.02em ]

[ row per person, vertical gap of --space-12 ]:
  Row layout:
    [ left column, sticky: 200px wide ]
       Person name           (Geist 500, --text-2xl)
       N memories            (Geist Mono, --text-sm, --text-muted)
       [colored dot]         (relationship category color)
    [ right: horizontal scroll of cards ]
       16:10 image cards, --radius-md, gap --space-4
       hover: scale 1.04, neighbors stay still
       click: opens lightbox
```

Empty state per person: a single ghost card outlined in `--border-subtle` with text "No memories yet" and an `Upload` icon button.

### Person modal

```
[ Geist 500 --text-3xl name, tracking -0.02em ]
[ Geist --text-sm secondary line: "Friend · since 2024 · UCLA" ]

[ horizontal rule, 1px --border-subtle ]

[ stat strip ]:
   Closeness  73/100   (label Geist --text-xs --text-muted, value Geist Mono --text-xl)
   Last seen  3d ago
   Memories   12
```

### Toolbar (top-center)

Floating, no background fill. Just outlined icon buttons separated by hairline dividers. Persistent across views.

### Floating filter pill (bottom-left)

```
[ ⊕ Filter · Friends ⌄ ]
border: 1px solid var(--border-default)
background: var(--surface-1)
font: Geist 500, --text-sm
padding: var(--space-2) var(--space-3)
border-radius: var(--radius-full)
```

Click opens the floating Explorer panel above it.

---

## 13. Accessibility

- Body text contrast ratio against `#0e0e0e` is at minimum 7:1 (`--text-primary` is `#e8e8f0`, which is ~14:1). Don't go below `--text-secondary` (`#8a8a9a`, ~5:1) for any reading content.
- All interactive elements have a visible focus indicator (2px `--accent` outline, 2px offset).
- Icons must have `aria-label` when they have no adjacent text.
- All animations respect `prefers-reduced-motion`.
- Keyboard nav: ⌘K palette covers all primary navigation. `Esc` closes any overlay. `Tab` order follows visual order.

---

## 14. Don'ts (the smell test)

If your change does any of these, stop and reconsider.

- ❌ Adds a gradient (background, button, text).
- ❌ Adds a `box-shadow` to a non-elevated element.
- ❌ Uses an emoji in chrome.
- ❌ Uses a hex color not in this doc.
- ❌ Uses a font weight that isn't 400 / 500 / 600.
- ❌ Introduces a sidebar that occupies a fixed left or right rail >0px wide.
- ❌ Animates anything for longer than `--duration-slow` outside the landing transition.
- ❌ Uses opacity to convey hierarchy where thickness or size could.
- ❌ Renames a token or creates a parallel one (`--my-button-blue`). Use existing tokens.
- ❌ Embeds copy in a component that should live as a constant (page titles, taglines).

---

## 15. Adding to this doc

If you add a token, color, or pattern: PR it here first. The README of every UI PR should reference the section of this doc that governs the change. If a needed pattern doesn't exist, propose it as a new subsection rather than freelancing.

The doc lives at `docs/design-system.md`. The companion brainstorm at `docs/ui-brainstorm.md` records the *why* behind aesthetic direction; this doc records the *what* and *how* devs apply it.
