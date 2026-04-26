# Sidebar Replacement — Design

**Date:** 2026-04-26
**Status:** Approved (brainstormed with Ethan, hackathon-scoped)
**Supersedes:** the persistent left rail (`<aside class="sidebar">`) introduced earlier in `App.jsx`.

---

## 1. Problem

The app currently ships a persistent left rail that bundles four jobs into one surface:

1. Logo + collapse control
2. Explorer (search input, category tree, per-person inline panel with birthday/strength/school/work + "View Full Card")
3. Past Chats list
4. Footer (Demo toggle, Sign out)

This violates `docs/design-system.md` directly:

- §1: "The canvas is the product" — a fixed left rail competes with the constellation.
- §10: "We do not have a persistent sidebar."
- §14: "Introduces a sidebar that occupies a fixed left or right rail >0px wide."

The rail also feels generic (the user described it as "GPT-ass"). It encodes hierarchy in a tree of disclosure triangles, encodes category-highlighting behind a tiny dot button nested inside that tree, and gives past chats equal real estate to the more-frequent jobs.

Ethan ranked the three exploration jobs by frequency: **categories ≈ search ≫ past chats**. The current layout does not reflect that priority.

## 2. Goals

- Delete the rail entirely. Replace it with floating, design-doc-compliant surfaces that each own a single job.
- Give category-highlighting and search top-shelf affordances, since both are top priority.
- Tuck past chats one click deeper, attached to the chat surface rather than the exploration surface.
- Preserve the existing zoom-in + Person modal animation when a person is selected from any new surface.
- Surface the `⌘K` keyboard shortcut visibly so users discover it.
- Touch up the past-chats visuals (`ChatHistory.jsx` row styling) to match design tokens, but **do not** change the chat interface itself — teammates own that.

## 3. Non-goals

- Building a persistent chat dock. Chat remains a modal (`ChatModal`) until a separate task converts it.
- Rebuilding `ChatModal` or its message rendering. Only `ChatHistory.jsx`'s own row visuals change.
- New animations beyond the design system's existing motion tokens.
- Adding a serif typeface, gradients, glow, or any token outside `docs/design-system.md`.

## 4. Architecture

The rail is replaced by four small floating surfaces. None of them ever covers the constellation canvas; the canvas remains "the product" per design doc §1.

| Surface | Position | z-index | Owns |
|---|---|---|---|
| Toolbar search pill | top-center (in existing toolbar row) | 30 (toolbar) | Discoverability + click affordance for `⌘K` |
| ⌘K command palette | centered overlay | 40 (palette) | Search/jump to any person |
| Bottom-edge category legend | bottom-center, above any chat surface | 10 (floating-pill) | Toggle category highlights (multi-select) |
| Toolbar avatar menu | top-right | 30 (toolbar) | Demo toggle + sign out |

Past chats remain accessible from inside the existing `ChatModal` (teammate-owned). `ChatHistory.jsx` gets a visual refresh only.

### State migration

Today's `App.jsx` state for the rail:

| State | Disposition |
|---|---|
| `sidebarCollapsed` | **Delete** — no rail to collapse |
| `explorerOpen` | **Delete** — no Explorer section header |
| `pastChatsOpen` | **Delete** — past chats live in chat modal |
| `expandedCats` | **Delete** — no tree |
| `expandedPeople` | **Delete** — no inline preview |
| `searchQuery` | **Move** — owned by palette, palette-local state |
| `activeFilters` | **Keep** — owned by `App.jsx`, drives both legend chip state and graph highlighting (already does the latter) |
| `showDemo` | **Keep** — moves into avatar menu |

`peopleByCategory`, `toggleCat`, `togglePerson`, `toggleBranchHighlight` (currently used by the rail's branch toggle) are evaluated for reuse:

- `toggleBranchHighlight(catKey)` → reused verbatim by legend chip click handler.
- `peopleByCategory` → still produces the per-category counts the legend chips display; reuse the count, drop the people list traversal.
- `toggleCat`, `togglePerson` → **delete** (no tree).

### Component layout

New components in `src/components/`:

- `CategoryLegend/CategoryLegend.jsx` + `.css` — bottom-edge chip row.
- `CommandPalette/CommandPalette.jsx` + `.css` — shadcn `Command`-based palette.
- `SearchPill/SearchPill.jsx` + `.css` — toolbar pill that opens the palette.
- `AvatarMenu/AvatarMenu.jsx` + `.css` — top-right avatar popover.

`App.jsx` shrinks: the entire `<aside>` block (lines ~427–650) is deleted; the four new components are rendered as siblings of the existing toolbar/canvas. `ChatHistory.jsx` is updated in place (visual-only).

## 5. Surface specifications

### 5.1 Toolbar search pill (`SearchPill`)

**Visual.**

```
[ 🔍  Search…                              ⌘K ]
```

- Container: 280px wide, `--surface-1`, 1px `--border-default`, `--radius-sm`, padding `var(--space-2) var(--space-3)`. Aligns with the existing top-center toolbar row.
- Icon: lucide `Search` 14px, `--text-secondary`.
- Placeholder text: Geist 400 `--text-md` `--text-secondary` reading "Search…".
- Right side: keyboard-hint chip `⌘K` — Geist Mono 500 `--text-xs` `--text-secondary`, padding `2px 6px`, 1px `--border-subtle`, `--radius-xs`.
- Hover: `background: rgba(255,255,255,0.04)`, border thickens to `--border-strong`. 120ms `--ease-out`.
- Active/pressed: `background: rgba(255,255,255,0.08)`.

**Behavior.**

- Click → opens palette (`setPaletteOpen(true)`).
- `⌘K` (or `Ctrl+K` on non-Mac) anywhere in the app → opens palette. Bound at the `App.jsx` level via a `keydown` listener.
- Pill is hidden during the cinematic landing → app dolly-zoom and fades in 320ms after the graph settles.

**A11y.** `<button type="button" aria-label="Search people (Cmd+K)">`. Keyboard-tab focus shows the design doc's 2px `--accent` outline at 2px offset.

### 5.2 ⌘K command palette (`CommandPalette`)

**Library.** shadcn/ui `Command` component (`cmdk` under the hood). Already shadcn's default; no new dep beyond `cmdk` and `lucide-react` (already required by design doc §6).

**Visual.**

- Container: `--surface-3` (#0e0e0e), 1px `--border-strong`, `--radius-lg`, `var(--elevation-md)`. Width 560px, max-height 60vh. Positioned `top: 20vh`, horizontally centered.
- Backdrop: `var(--backdrop)` (`rgba(0,0,0,0.6)`). Fades in 200ms `--ease-out`.
- Input row: 1px `--border-subtle` bottom hairline. Padding `var(--space-3) var(--space-4)`. Lucide `Search` 16px `--text-secondary`, then input (Geist 400 `--text-md` `--text-primary`, no border, no fill, autofocused on open).
- Result list: scrollable, padding `var(--space-2)` vertical.

**Result row.**

```
●  Lily Chen                          Friend · 73/100
●  Marcus Reyes                       Family · 88/100
```

- Height 40px, padding `var(--space-2) var(--space-4)`.
- Left: 6px `--celestial-*` dot (matches the person's category).
- Center: name in Geist 500 `--text-md` `--text-primary`.
- Right: `<category> · <strength>/100` — Geist Mono 400 `--text-sm` `--text-muted`. If `person.scoring.status === 'pending'`, show `…` instead of the score.
- Hover/keyboard-focused row: `background: rgba(255,255,255,0.04)`. No border change. 120ms `--ease-out`.

**Behavior.**

- Default state (empty input): show up to 6 "Recent" rows — people the user most recently opened (track in a `useRef` + `localStorage` key `ic.recentPeople`, last 12 IDs).
  - If no recents yet, show all people sorted by `relationship.strength` desc, capped at 12.
  - Section header above results: `RECENT` or `ALL` — Geist 500 uppercase `--text-xs` `--text-muted`, letterSpacing `0.18em`, padding `var(--space-2) var(--space-4)`.
- Typing: fuzzy match against `name`. cmdk handles the fuzzy filter natively. Limit to 50 results (we don't expect more, but cap for safety).
- ↑/↓ navigate, Enter activates focused row.
- Activation calls `handleNodeClick(person)` from `App.jsx` (passed in as prop). Existing handler already triggers `setZoomTarget` + `modalPhase: 'zooming-in'` (App.jsx:65, 161) → palette closes synchronously, zoom plays, modal opens.
- Esc closes the palette without selection.
- Click on backdrop closes.

**A11y.** `role="dialog"`, `aria-modal="true"`, `aria-label="Search people"`. cmdk handles roving tabindex on rows.

### 5.3 Bottom-edge category legend (`CategoryLegend`)

**Position.** Floating, horizontally centered, `bottom: var(--space-6)` (24px). `z-index: 10`. Width: shrink-wraps content.

**Visual (one chip).**

```
[ ●  Friend  12 ]
```

- Outer: 1px `--border-default`, `--surface-1`, `--radius-full`, padding `4px 10px` (matches design doc chip spec §10).
- Dot: 6px circle in the category's `--celestial-*` token.
- Name: Geist 500 `--text-sm` `--text-secondary`.
- Count: Geist Mono 400 `--text-xs` `--text-muted`.
- Inner gap (dot/name/count): `var(--space-2)`.
- Inter-chip gap: `var(--space-2)`.
- Categories with 0 people are not rendered.

**States.**

| State | Border | Name color | Count color | Dot |
|---|---|---|---|---|
| Idle | 1px `--border-default` | `--text-secondary` | `--text-muted` | category color |
| Hover | 1px `--border-strong` | `--text-primary` | `--text-muted` | category color |
| Active (highlight on) | **1.5px** category color | `--text-primary` | `--text-primary` | category color |

Thickness encodes activation, per design doc §1 ("thickness, not opacity"). No fill-color change on the chip background. No glow.

**Clear-all `✕`.**

- Appears as the rightmost element with `var(--space-3)` gap, only when `activeFilters.size > 0`.
- 24px square ghost button, lucide `X` 14px `--text-secondary`, hover → `--text-primary`.
- Click → `setActiveFilters(new Set())`.
- Fades in/out 200ms `--ease-out`.

**Behavior.**

- Click chip → `toggleBranchHighlight(catKey)` (existing handler, unchanged). Multi-select: `activeFilters` is a `Set`.
- Highlight semantics in the graph are unchanged from today: matching nodes/edges stay full thickness; non-matching fade in stroke thickness (not opacity) per design doc §11.
- Legend is hidden during the cinematic landing → app dolly-zoom; fades in 320ms after the graph settles.

**Responsive.** If the chip row exceeds `100vw - 2 * var(--space-6)`, wraps to two centered rows with `var(--space-2)` row gap. No horizontal scroll.

**Conflict with chat surface.** Chat is a full-screen modal today; when open, it covers the legend (legend's `z-index: 10` < modal's `z: 60`). That is correct — when you're chatting you don't need the legend.

### 5.4 Toolbar avatar menu (`AvatarMenu`)

**Trigger.** Top-right toolbar slot. 32px square ghost button, lucide `User` 16px `--text-secondary`. Hover → `--text-primary`, `background: rgba(255,255,255,0.04)`.

**Popover.**

- Container: `--surface-1`, 1px `--border-default`, `--radius-md`, `var(--elevation-md)`, ~220px wide, padding `var(--space-2)`.
- Anchored top-right of the trigger, opens downward, `var(--space-2)` offset.
- Fades + translates 4px down on open, 120ms `--ease-out`.

**Rows.**

1. Email row: Geist 400 `--text-sm` `--text-secondary`, padding `var(--space-2) var(--space-3)`. Non-interactive. Truncates with ellipsis. 1px `--border-subtle` bottom hairline.
2. Demo toggle row: lucide `FlaskConical` 14px + "Demo" label (Geist 500 `--text-sm`) + a small pill on the right showing `On`/`Off` in Geist Mono `--text-xs`. Click toggles `showDemo`. Active state: pill border becomes `--border-strong`, text `--text-primary`.
3. Sign out row: lucide `LogOut` 14px + "Sign out" label. Click triggers existing sign-out flow (`await signOut(); window.location.reload()`).

Rows: padding `var(--space-2) var(--space-3)`, `--radius-sm`, hover background `rgba(255,255,255,0.04)`.

**A11y.** Menu is a `<div role="menu">`; rows are `<button role="menuitem">`. Esc closes. Click-outside closes.

### 5.5 Past chats visual refresh (`ChatHistory.jsx`)

**Scope.** This file's row visuals only. **Do not** touch:

- `ChatModal.jsx` (teammate work)
- The chat input form, message bubbles, attached-chip layout
- How threads are stored or loaded

**Today (sidebar-shaped).** `ChatHistory` renders inside the rail as a flat list of clickable thread rows. Visual style relies on opacity for dim text and lacks design-token usage.

**After.**

- Container: `padding: var(--space-2) 0`.
- Thread row: full-width button, padding `var(--space-2) var(--space-3)`, `--radius-sm`. Layout: title (1 line, ellipsis) + last-updated timestamp on the right.
  - Title: Geist 500 `--text-sm` `--text-primary`. If untitled, show first message snippet truncated to 40 chars in Geist 400 `--text-secondary` instead.
  - Timestamp: Geist Mono 400 `--text-xs` `--text-muted`, right-aligned, format `Apr 24` or `3d`.
- Hover: `background: rgba(255,255,255,0.04)`. Reveals a small lucide `Trash2` 14px ghost button (right of timestamp) wired to existing `onDeleteThread`. Without hover: trash hidden.
- Empty state: Geist 400 `--text-sm` `--text-muted` "No past chats yet" centered with `var(--space-4)` vertical padding.

No structural changes — same `<button>` per thread, same callbacks. CSS + Geist Mono timestamp + lucide trash icon are the only changes. Teammates can render `<ChatHistory>` anywhere they want inside `ChatModal`.

## 6. Removals

In `src/App.jsx`:

- Lines ~427–650: the entire `<aside class="sidebar">` block.
- State: `sidebarCollapsed`, `explorerOpen`, `pastChatsOpen`, `expandedCats`, `expandedPeople`.
- Handlers: `toggleCat`, `togglePerson`. (The branch-highlight toggle handler `toggleBranchHighlight` is preserved — legend chips call it.)

In `src/App.css`:

- All `.sidebar*`, `.tree-*`, `.node-cat`, `.node-person`, `.person-info-panel`, `.branch-toggle`, `.open-card-btn`, `.scoring-pending`, `.scoring-uncertain`, `.scoring-failed`, `.scoring-retry`, `.info-row`, `.demo-row`, `.demo-toggle-dot` rules. (Some of these — `.scoring-*`, `.info-row` — may be reused inside the Person modal; verify before deleting. If reused, leave them alone.)
- Layout rule that reserves left-rail width for the canvas. Canvas becomes truly full-bleed.

In `src/components/`:

- No new deletions; `ChatHistory.jsx` stays, just restyled.

## 7. Discoverability of `⌘K`

Three reinforcing affordances, ordered by visibility:

1. **Toolbar search pill** literally shows `⌘K` on its right side, every frame.
2. **First-run nudge:** the first time a user lands on the constellation after sign-in (`localStorage` flag `ic.cmdkNudgeShown`), a small toast appears 1500ms after canvas settles: "Press ⌘K to find anyone." Auto-dismiss after 4s. Dismiss on first user interaction. Toast layer (`z: 70`) is reserved per design doc §9 — this is its first concrete use.
3. **Empty palette state:** when palette is open and empty, a faint Geist 400 `--text-xs` `--text-muted` line at the bottom reads `↑↓ navigate · ↵ open · esc close` (with `Geist Mono` for the key glyphs).

## 8. Motion

All transitions use existing tokens from design doc §7:

| Transition | Duration | Easing |
|---|---|---|
| Pill hover | `--duration-fast` (120ms) | `--ease-out` |
| Chip activation | `--duration-fast` (120ms) | `--ease-out` |
| Palette open/close | `--duration-base` (200ms) | `--ease-out` |
| Palette backdrop fade | `--duration-base` (200ms) | `--ease-out` |
| Avatar menu open | `--duration-fast` (120ms) | `--ease-out` |
| Legend / pill fade-in after canvas settle | `--duration-slow` (320ms) | `--ease-out` |
| Toast fade in/out | `--duration-base` (200ms) | `--ease-out` |
| First-run nudge auto-dismiss delay | 4000ms | n/a |

Respects `prefers-reduced-motion: reduce` — fades become instant, translate disabled. (Already wired in `index.css` per design doc §7.)

## 9. Accessibility

- `⌘K` pill: `aria-label="Search people (Cmd+K)"`. Keyboard-focusable.
- Palette: `role="dialog"`, `aria-modal="true"`, `aria-label="Search people"`. Focus trap inside while open. Focus returns to pill on close.
- Legend chips: `<button aria-pressed={isActive}>`. Each chip has accessible name `{categoryLabel}, {count} people, {active ? "highlighted" : "not highlighted"}`.
- Avatar menu: `role="menu"`, items `role="menuitem"`. Esc closes. Focus returns to trigger.
- `Tab` order across the constellation view: search pill → toolbar buttons → avatar → category legend chips → clear-all → (canvas, focusable for keyboard pan) → chat trigger.
- Color contrast: all chip text (`--text-secondary` / `--text-primary` on `--surface-1`) meets the design doc §13 ratios.

## 10. Edge cases

- **0 people in the graph (empty constellation):** legend hides entirely (no chips to show); palette opens but shows an empty-state "No people yet — add someone from the toolbar".
- **All people in one category:** legend still shows the single chip; clear-all only appears once that one chip is active.
- **Very long person names in palette:** truncate with ellipsis at row width minus right metadata. Tooltip on hover shows full name.
- **Palette open while a Person modal is open:** disallow. Pill is disabled / palette doesn't open if `selectedPerson` is set. (Or close the palette when a row is activated, since activation opens a modal anyway — which is the natural flow.)
- **Demo toggle while palette is open:** demo toggle is in avatar menu; opening the avatar menu does not close the palette by default, but pressing `Esc` closes whichever was opened most recently first. Acceptable.
- **Palette open during cinematic landing→app dolly-zoom:** disallow. `⌘K` listener no-ops while `viewMode === 'landing-transition'` (or whatever the current flag is — verify in `App.jsx`).

## 11. Testing

Manual QA checklist for the implementer:

- [ ] Sidebar gone; canvas is full-bleed.
- [ ] `⌘K` opens palette from anywhere except landing-transition and modal-open states.
- [ ] Click on toolbar search pill opens palette.
- [ ] Typing in palette filters fuzzily; ↑↓ navigates; Enter opens person modal with the same zoom-in animation as a canvas click.
- [ ] Palette empty state shows recents (or strength-sorted fallback if no recents).
- [ ] Recents list updates after opening a person.
- [ ] Esc closes palette without selecting.
- [ ] Each legend chip toggles its category's highlight in the graph; multi-select works.
- [ ] Clear-all appears only when ≥1 chip is active and clears all.
- [ ] Active chip's border is 1.5px in the category color; idle is 1px subtle.
- [ ] Avatar menu opens, demo toggles, sign-out works.
- [ ] First-run nudge appears once, never again (check `localStorage` flag).
- [ ] `prefers-reduced-motion: reduce` removes all translate/scale and fades become instant.
- [ ] On a small viewport, legend wraps to two rows without horizontal scroll.
- [ ] `ChatHistory` rows look design-doc compliant inside `ChatModal` (visual-only check).

## 12. Open questions

None at design time. All scope decisions resolved with Ethan during brainstorming on 2026-04-26.

## 13. References

- `docs/design-system.md` — source of truth for tokens, colors, typography, motion.
- `docs/ui-brainstorm.md` — historical aesthetic direction.
- `src/App.jsx` lines 65, 105, 161 — existing zoom-in animation hooks (`zoomTarget`, `modalPhase`, `handleNodeClick`) reused as-is.
- `src/components/Chat/ChatHistory.jsx` — visual refresh target.
- shadcn/ui `Command` — palette base.
- lucide-react — icons throughout (already required by design doc §6).
