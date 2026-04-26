# Sidebar Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the persistent left rail in `App.jsx` with four floating, design-doc-compliant surfaces (toolbar Search pill, ⌘K Command Palette, bottom Category Legend, top-right Avatar Menu) and refresh the past-chats row visuals — without touching `ChatModal`.

**Architecture:** All four surfaces are small React components in their own folders under `src/components/`. State that the rail used (`sidebarCollapsed`, `explorerOpen`, `pastChatsOpen`, `expandedCats`, `expandedPeople`) is deleted; `searchQuery` migrates into the palette and `activeFilters` continues to drive both legend chip state and graph highlighting. A global `keydown` listener mounted at the App level handles `⌘K`/`Ctrl+K`. Past-chats row visuals are restyled in `ChatHistory.jsx` directly; `ChatModal.jsx` is untouched.

**Tech Stack:** React 19, Vite, hand-rolled CSS (no Tailwind), `cmdk` for the palette, `lucide-react` for icons, Node `--test` for unit tests. Reuses existing design tokens in `src/index.css` (`--celestial-*`, `--surface-1`, `--text-primary`, `--text-secondary`, `--text-muted`, `--space-*`, `--text-*`, `--radius-*`, `--ease-*`, `--duration-*`, `--border-default`, `--border-subtle`, `--border-strong`).

**Spec:** `docs/superpowers/specs/2026-04-26-sidebar-replacement-design.md`

---

## File Map

**Create:**
- `src/components/SearchPill/SearchPill.jsx`
- `src/components/SearchPill/SearchPill.css`
- `src/components/CommandPalette/CommandPalette.jsx`
- `src/components/CommandPalette/CommandPalette.css`
- `src/components/CategoryLegend/CategoryLegend.jsx`
- `src/components/CategoryLegend/CategoryLegend.css`
- `src/components/AvatarMenu/AvatarMenu.jsx`
- `src/components/AvatarMenu/AvatarMenu.css`
- `src/components/CmdKNudge/CmdKNudge.jsx`
- `src/components/CmdKNudge/CmdKNudge.css`
- `src/hooks/useRecentPeople.js`
- `src/hooks/useRecentPeople.test.mjs`
- `src/hooks/useCommandKey.js`

**Modify:**
- `package.json` — add `cmdk` dependency
- `src/App.jsx` — delete `<aside class="sidebar">` block, mount the four new surfaces and the nudge, listen for ⌘K, drop unused state
- `src/App.css` — delete `.sidebar*`, `.tree-*`, `.node-cat`, `.node-person`, `.person-info-panel`, `.branch-toggle`, `.demo-row`, `.demo-toggle-dot`, `.collapsible-label`, `.chevron`, `.logo-glyph`, `.logo-text`, sidebar-related layout (e.g. `.app { padding-left: ... }`)
- `src/components/Chat/ChatHistory.jsx` — restyle rows, replace 🗑 emoji with `lucide-react` `Trash2`
- `src/components/Chat/Chat.css` — restyle `.chat-history-*` classes per spec §5.5

---

## Task 1: Add `cmdk` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install cmdk**

```bash
cd /Users/ethanjin/Inner-Circle && npm install cmdk@^1.0.0
```

Expected: `cmdk` added to `dependencies` in `package.json`. `package-lock.json` updated.

- [ ] **Step 2: Verify install**

```bash
cd /Users/ethanjin/Inner-Circle && node -e "console.log(require('cmdk/package.json').version)"
```
Expected: prints a `1.x.x` version.

- [ ] **Step 3: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add package.json package-lock.json && git commit -m "deps: add cmdk for command palette"
```

> ⚠️ Before staging, the implementer should `git status --short` first. The user has unrelated working-tree changes in `package.json` and `package-lock.json` already; if those exist, use `git add -p package.json package-lock.json` to stage only the cmdk-related hunks.

---

## Task 2: `useRecentPeople` hook

Tracks the last 12 person IDs the user opened, persisted to `localStorage` under `ic.recentPeople`.

**Files:**
- Create: `src/hooks/useRecentPeople.js`
- Test: `src/hooks/useRecentPeople.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useRecentPeople.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reduceRecents, MAX_RECENTS } from './useRecentPeople.js';

test('reduceRecents adds new id to front', () => {
  assert.deepEqual(reduceRecents([], 'a'), ['a']);
  assert.deepEqual(reduceRecents(['b', 'c'], 'a'), ['a', 'b', 'c']);
});

test('reduceRecents dedupes by moving existing id to front', () => {
  assert.deepEqual(reduceRecents(['b', 'a', 'c'], 'a'), ['a', 'b', 'c']);
  assert.deepEqual(reduceRecents(['a', 'b'], 'a'), ['a', 'b']);
});

test('reduceRecents caps length at MAX_RECENTS', () => {
  const long = Array.from({ length: MAX_RECENTS }, (_, i) => `id${i}`);
  const out = reduceRecents(long, 'new');
  assert.equal(out.length, MAX_RECENTS);
  assert.equal(out[0], 'new');
  assert.equal(out.includes(`id${MAX_RECENTS - 1}`), false);
});

test('reduceRecents ignores falsy id', () => {
  assert.deepEqual(reduceRecents(['a'], ''), ['a']);
  assert.deepEqual(reduceRecents(['a'], null), ['a']);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/ethanjin/Inner-Circle && node --test src/hooks/useRecentPeople.test.mjs
```

Expected: FAIL — module `./useRecentPeople.js` not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useRecentPeople.js`:

```js
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ic.recentPeople';
export const MAX_RECENTS = 12;

export function reduceRecents(prev, id) {
  if (!id) return prev;
  const filtered = prev.filter((existing) => existing !== id);
  return [id, ...filtered].slice(0, MAX_RECENTS);
}

function readInitial() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function useRecentPeople() {
  const [ids, setIds] = useState(readInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // storage full / disabled — silently ignore
    }
  }, [ids]);

  const recordOpen = useCallback((id) => {
    setIds((prev) => reduceRecents(prev, id));
  }, []);

  return { recentIds: ids, recordOpen };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/ethanjin/Inner-Circle && node --test src/hooks/useRecentPeople.test.mjs
```

Expected: 4 passing tests, 0 failing.

- [ ] **Step 5: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add src/hooks/useRecentPeople.js src/hooks/useRecentPeople.test.mjs && git commit -m "feat: useRecentPeople hook for command palette recents"
```

---

## Task 3: `useCommandKey` global keyboard hook

Listens at the document level for `⌘K` (Meta on macOS, Ctrl on others) and calls a handler. Skips when an input/textarea/contenteditable is focused so users can type `K` normally — the handler still fires for the actual `⌘K` chord because `metaKey`/`ctrlKey` is held.

**Files:**
- Create: `src/hooks/useCommandKey.js`

- [ ] **Step 1: Write the hook**

Create `src/hooks/useCommandKey.js`:

```js
import { useEffect } from 'react';

export function useCommandKey(handler, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;
    function onKeyDown(event) {
      if (event.key !== 'k' && event.key !== 'K') return;
      const isModified = event.metaKey || event.ctrlKey;
      if (!isModified) return;
      // Always intercept the chord — even from inputs — because plain "k" is unaffected.
      event.preventDefault();
      handler(event);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handler, enabled]);
}
```

- [ ] **Step 2: Smoke-check by mounting in a scratch component**

(No test runner for hooks yet — visual verification happens later when wired into App.jsx in Task 10. For now, just confirm the file parses by running ESLint:)

```bash
cd /Users/ethanjin/Inner-Circle && npx eslint src/hooks/useCommandKey.js
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add src/hooks/useCommandKey.js && git commit -m "feat: useCommandKey global ⌘K listener hook"
```

---

## Task 4: `SearchPill` component

The toolbar pill that shows `Search…` + a `⌘K` keyboard hint badge. Click → opens palette.

**Files:**
- Create: `src/components/SearchPill/SearchPill.jsx`
- Create: `src/components/SearchPill/SearchPill.css`

- [ ] **Step 1: Write the component**

Create `src/components/SearchPill/SearchPill.jsx`:

```jsx
import { Search } from 'lucide-react';
import './SearchPill.css';

function getModSymbol() {
  if (typeof navigator === 'undefined') return '⌘';
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
}

export default function SearchPill({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      className="search-pill"
      onClick={onClick}
      disabled={disabled}
      aria-label="Search people (Command-K)"
    >
      <Search size={14} aria-hidden className="search-pill-icon" />
      <span className="search-pill-label">Search…</span>
      <span className="search-pill-kbd" aria-hidden>
        <span className="search-pill-kbd-mod">{getModSymbol()}</span>
        <span className="search-pill-kbd-key">K</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Write the CSS**

Create `src/components/SearchPill/SearchPill.css`:

```css
.search-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: 280px;
  padding: var(--space-2) var(--space-3);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font: 400 var(--text-md, 14px)/1.4 var(--font-body, 'Geist', sans-serif);
  cursor: pointer;
  transition:
    background var(--duration-fast, 120ms) var(--ease-out, ease),
    border-color var(--duration-fast, 120ms) var(--ease-out, ease);
}

.search-pill:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--border-strong);
}

.search-pill:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.search-pill:disabled {
  opacity: 0.5;
  cursor: default;
}

.search-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.search-pill-icon {
  flex-shrink: 0;
}

.search-pill-label {
  flex: 1;
  text-align: left;
}

.search-pill-kbd {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: var(--text-xs, 11px);
  font-weight: 500;
  color: var(--text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .search-pill { transition: none; }
}
```

- [ ] **Step 3: Lint**

```bash
cd /Users/ethanjin/Inner-Circle && npx eslint src/components/SearchPill/SearchPill.jsx
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add src/components/SearchPill/ && git commit -m "feat: SearchPill toolbar component with ⌘K hint"
```

---

## Task 5: `CommandPalette` component

`cmdk`-based palette. Single fuzzy search across `displayPeople`. Recents pinned when input is empty. Enter calls `onSelect(person)` which the App wires to `handleNodeClick(person)` (existing zoom-in animation).

**Files:**
- Create: `src/components/CommandPalette/CommandPalette.jsx`
- Create: `src/components/CommandPalette/CommandPalette.css`

- [ ] **Step 1: Write the component**

Create `src/components/CommandPalette/CommandPalette.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import './CommandPalette.css';

const CATEGORY_LABEL = {
  family: 'Family',
  friend: 'Friend',
  classmate: 'Classmate',
  coworker: 'Coworker',
  professional: 'Professional',
  romantic: 'Romantic',
  mentor: 'Mentor',
  other: 'Other',
};

function categoryToken(cat) {
  // Maps person.relationship.type → CSS celestial token.
  if (!cat) return 'var(--celestial-other)';
  return `var(--celestial-${cat})`;
}

function PersonRow({ person, onSelect }) {
  const cat = person.relationship?.type;
  const strength = person.relationship?.strength;
  const isPending = person.scoring?.status === 'pending';
  const meta = `${CATEGORY_LABEL[cat] ?? 'Other'} · ${
    isPending ? '…' : strength != null ? `${strength}/100` : '—'
  }`;
  return (
    <Command.Item
      key={person.id}
      value={`${person.name}__${person.id}`}
      onSelect={() => onSelect(person)}
      className="cmdp-row"
    >
      <span
        className="cmdp-row-dot"
        style={{ background: categoryToken(cat) }}
        aria-hidden
      />
      <span className="cmdp-row-name">{person.name}</span>
      <span className="cmdp-row-meta">{meta}</span>
    </Command.Item>
  );
}

export default function CommandPalette({
  open,
  onClose,
  people,
  recentIds,
  onSelect,
}) {
  const [query, setQuery] = useState('');

  // Reset query each time the palette opens.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const peopleById = useMemo(() => {
    const map = new Map();
    people.forEach((p) => map.set(p.id, p));
    return map;
  }, [people]);

  const recents = useMemo(() => {
    if (recentIds.length === 0) return [];
    return recentIds.map((id) => peopleById.get(id)).filter(Boolean).slice(0, 6);
  }, [recentIds, peopleById]);

  const fallback = useMemo(() => {
    if (recents.length > 0) return [];
    return [...people]
      .sort((a, b) => (b.relationship?.strength ?? -1) - (a.relationship?.strength ?? -1))
      .slice(0, 12);
  }, [people, recents.length]);

  if (!open) return null;

  const isEmpty = query.trim().length === 0;

  return (
    <div
      className="cmdp-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="cmdp-shell"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="Search people"
          shouldFilter={!isEmpty}
        >
          <div className="cmdp-input-row">
            <Search size={16} aria-hidden className="cmdp-input-icon" />
            <Command.Input
              autoFocus
              placeholder="Search people…"
              value={query}
              onValueChange={setQuery}
              className="cmdp-input"
            />
          </div>

          <Command.List className="cmdp-list">
            <Command.Empty className="cmdp-empty">No people match "{query}"</Command.Empty>

            {isEmpty && recents.length > 0 && (
              <Command.Group heading="RECENT" className="cmdp-group">
                {recents.map((p) => (
                  <PersonRow key={p.id} person={p} onSelect={onSelect} />
                ))}
              </Command.Group>
            )}

            {isEmpty && recents.length === 0 && fallback.length > 0 && (
              <Command.Group heading="ALL" className="cmdp-group">
                {fallback.map((p) => (
                  <PersonRow key={p.id} person={p} onSelect={onSelect} />
                ))}
              </Command.Group>
            )}

            {!isEmpty && (
              <Command.Group className="cmdp-group">
                {people.slice(0, 50).map((p) => (
                  <PersonRow key={p.id} person={p} onSelect={onSelect} />
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="cmdp-footer">
            <span className="cmdp-hint"><span className="cmdp-key">↑↓</span> navigate</span>
            <span className="cmdp-hint"><span className="cmdp-key">↵</span> open</span>
            <span className="cmdp-hint"><span className="cmdp-key">esc</span> close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
```

> Note on `cmdk` filtering: when `shouldFilter` is true, `cmdk` filters items by their `value` prop (`name__id`). `value` includes the id so two same-named people remain distinct. Empty-state filtering is disabled when `query` is empty so we control which group to show.

- [ ] **Step 2: Write the CSS**

Create `src/components/CommandPalette/CommandPalette.css`:

```css
.cmdp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--backdrop, rgba(0, 0, 0, 0.6));
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20vh;
  animation: cmdp-fade-in var(--duration-base, 200ms) var(--ease-out, ease);
}

.cmdp-shell {
  position: relative;
  z-index: 60;
  width: min(560px, calc(100vw - var(--space-8) * 2));
  max-height: 60vh;
  background: var(--surface-3, #0e0e0e);
  border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.18));
  border-radius: var(--radius-lg, 16px);
  box-shadow: var(--elevation-md, 0 8px 24px rgba(2, 2, 8, 0.5));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cmdp-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

.cmdp-input-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.cmdp-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font: 400 var(--text-md, 14px)/1.5 var(--font-body, 'Geist', sans-serif);
}

.cmdp-input::placeholder {
  color: var(--text-muted);
}

.cmdp-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) 0;
}

.cmdp-empty {
  padding: var(--space-4) var(--space-4);
  font: 400 var(--text-sm, 12px)/1.5 var(--font-body, 'Geist', sans-serif);
  color: var(--text-muted);
}

.cmdp-group [cmdk-group-heading] {
  padding: var(--space-2) var(--space-4);
  font: 500 var(--text-xs, 11px)/1.4 var(--font-body, 'Geist', sans-serif);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--text-muted);
}

.cmdp-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
  user-select: none;
  transition: background var(--duration-fast, 120ms) var(--ease-out, ease);
}

.cmdp-row[data-selected='true'] {
  background: rgba(255, 255, 255, 0.04);
}

.cmdp-row-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.cmdp-row-name {
  flex: 1;
  font: 500 var(--text-md, 14px)/1.5 var(--font-body, 'Geist', sans-serif);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cmdp-row-meta {
  font: 400 var(--text-sm, 12px)/1.4 var(--font-mono, 'Geist Mono', monospace);
  color: var(--text-muted);
  flex-shrink: 0;
}

.cmdp-footer {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  font: 400 var(--text-xs, 11px)/1.4 var(--font-body, 'Geist', sans-serif);
  color: var(--text-muted);
}

.cmdp-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cmdp-key {
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  color: var(--text-secondary);
}

@keyframes cmdp-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .cmdp-backdrop { animation: none; }
}
```

- [ ] **Step 3: Lint**

```bash
cd /Users/ethanjin/Inner-Circle && npx eslint src/components/CommandPalette/CommandPalette.jsx
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add src/components/CommandPalette/ && git commit -m "feat: CommandPalette (cmdk) with recents and fuzzy search"
```

---

## Task 6: `CategoryLegend` component

Bottom-edge floating row of chips. Multi-select toggles `activeFilters`. `Clear` ✕ when ≥1 active.

**Files:**
- Create: `src/components/CategoryLegend/CategoryLegend.jsx`
- Create: `src/components/CategoryLegend/CategoryLegend.css`

- [ ] **Step 1: Write the component**

Create `src/components/CategoryLegend/CategoryLegend.jsx`:

```jsx
import { X } from 'lucide-react';
import './CategoryLegend.css';

const CATEGORIES = [
  { key: 'family',       label: 'Family',       token: 'var(--celestial-family)' },
  { key: 'friend',       label: 'Friend',       token: 'var(--celestial-friend)' },
  { key: 'coworker',     label: 'Coworker',     token: 'var(--celestial-coworker)' },
  { key: 'classmate',    label: 'Classmate',    token: 'var(--celestial-classmate)' },
  { key: 'mentor',       label: 'Mentor',       token: 'var(--celestial-mentor)' },
  { key: 'romantic',     label: 'Romantic',     token: 'var(--celestial-romantic)' },
  { key: 'professional', label: 'Pro',          token: 'var(--celestial-professional)' },
  { key: 'other',        label: 'Other',        token: 'var(--celestial-other)' },
];

export default function CategoryLegend({
  countsByCategory,
  activeFilters,
  onToggle,
  onClearAll,
  hidden = false,
}) {
  const visible = CATEGORIES.filter((c) => (countsByCategory[c.key] ?? 0) > 0);
  if (visible.length === 0) return null;

  const anyActive = activeFilters.size > 0;

  return (
    <div
      className={`legend ${hidden ? 'legend-hidden' : ''}`}
      role="group"
      aria-label="Highlight by category"
    >
      {visible.map((c) => {
        const count = countsByCategory[c.key] ?? 0;
        const active = activeFilters.has(c.key);
        return (
          <button
            key={c.key}
            type="button"
            className={`legend-chip ${active ? 'is-active' : ''}`}
            style={{ '--chip-color': c.token }}
            onClick={() => onToggle(c.key)}
            aria-pressed={active}
            aria-label={`${c.label}, ${count} ${count === 1 ? 'person' : 'people'}, ${active ? 'highlighted' : 'not highlighted'}`}
          >
            <span className="legend-chip-dot" aria-hidden />
            <span className="legend-chip-name">{c.label}</span>
            <span className="legend-chip-count">{count}</span>
          </button>
        );
      })}
      {anyActive && (
        <button
          type="button"
          className="legend-clear"
          onClick={onClearAll}
          aria-label="Clear all highlights"
          title="Clear"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the CSS**

Create `src/components/CategoryLegend/CategoryLegend.css`:

```css
.legend {
  position: fixed;
  left: 50%;
  bottom: var(--space-6, 24px);
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2, 8px);
  max-width: calc(100vw - var(--space-6, 24px) * 2);
  pointer-events: auto;
  transition: opacity var(--duration-slow, 320ms) var(--ease-out, ease);
}

.legend-hidden {
  opacity: 0;
  pointer-events: none;
}

.legend-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: 4px 10px;
  background: var(--surface-1, #0e0e0e);
  border: 1px solid var(--border-default, rgba(255, 255, 255, 0.10));
  border-radius: var(--radius-full, 9999px);
  color: var(--text-secondary);
  font: 500 var(--text-sm, 12px)/1.4 var(--font-body, 'Geist', sans-serif);
  cursor: pointer;
  transition:
    border-color var(--duration-fast, 120ms) var(--ease-out, ease),
    border-width var(--duration-fast, 120ms) var(--ease-out, ease),
    color var(--duration-fast, 120ms) var(--ease-out, ease);
}

.legend-chip:hover {
  border-color: var(--border-strong, rgba(255, 255, 255, 0.18));
  color: var(--text-primary);
}

.legend-chip.is-active {
  border-color: var(--chip-color);
  border-width: 1.5px;
  /* Keep padding visually identical despite border bump */
  padding: calc(4px - 0.5px) calc(10px - 0.5px);
  color: var(--text-primary);
}

.legend-chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.legend-chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: var(--chip-color);
  flex-shrink: 0;
}

.legend-chip-name {
  letter-spacing: 0;
}

.legend-chip-count {
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: var(--text-xs, 11px);
  font-weight: 400;
  color: var(--text-muted);
}

.legend-chip.is-active .legend-chip-count {
  color: var(--text-primary);
}

.legend-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: var(--space-2, 8px);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-xs, 6px);
  transition:
    color var(--duration-fast, 120ms) var(--ease-out, ease),
    background var(--duration-fast, 120ms) var(--ease-out, ease),
    opacity var(--duration-base, 200ms) var(--ease-out, ease);
}

.legend-clear:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.04);
}

.legend-clear:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .legend, .legend-chip, .legend-clear { transition: none; }
}
```

- [ ] **Step 3: Lint**

```bash
cd /Users/ethanjin/Inner-Circle && npx eslint src/components/CategoryLegend/CategoryLegend.jsx
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add src/components/CategoryLegend/ && git commit -m "feat: CategoryLegend bottom-edge highlight chips"
```

---

## Task 7: `AvatarMenu` component

Top-right ghost button + popover with email, demo toggle, sign-out.

**Files:**
- Create: `src/components/AvatarMenu/AvatarMenu.jsx`
- Create: `src/components/AvatarMenu/AvatarMenu.css`

- [ ] **Step 1: Write the component**

Create `src/components/AvatarMenu/AvatarMenu.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';
import { User, FlaskConical, LogOut } from 'lucide-react';
import './AvatarMenu.css';

export default function AvatarMenu({ email, demoOn, onToggleDemo, onSignOut }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (popoverRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="avatar-menu">
      <button
        ref={triggerRef}
        type="button"
        className="avatar-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User size={16} aria-hidden />
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="avatar-popover"
          role="menu"
        >
          {email && (
            <div className="avatar-email" title={email}>{email}</div>
          )}
          <button
            type="button"
            role="menuitem"
            className={`avatar-row ${demoOn ? 'avatar-row-active' : ''}`}
            onClick={() => onToggleDemo()}
          >
            <FlaskConical size={14} aria-hidden />
            <span className="avatar-row-label">Demo</span>
            <span className="avatar-row-value">{demoOn ? 'On' : 'Off'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="avatar-row"
            onClick={() => { setOpen(false); onSignOut(); }}
          >
            <LogOut size={14} aria-hidden />
            <span className="avatar-row-label">Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the CSS**

Create `src/components/AvatarMenu/AvatarMenu.css`:

```css
.avatar-menu {
  position: relative;
  display: inline-block;
}

.avatar-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border-default, rgba(255, 255, 255, 0.10));
  border-radius: var(--radius-sm, 8px);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color var(--duration-fast, 120ms) var(--ease-out, ease),
    background var(--duration-fast, 120ms) var(--ease-out, ease),
    border-color var(--duration-fast, 120ms) var(--ease-out, ease);
}

.avatar-trigger:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--border-strong);
}

.avatar-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.avatar-popover {
  position: absolute;
  top: calc(100% + var(--space-2, 8px));
  right: 0;
  min-width: 220px;
  background: var(--surface-1, #0e0e0e);
  border: 1px solid var(--border-default, rgba(255, 255, 255, 0.10));
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--elevation-md, 0 8px 24px rgba(2, 2, 8, 0.5));
  padding: var(--space-2, 8px);
  z-index: 30;
  animation: avatar-pop-in var(--duration-fast, 120ms) var(--ease-out, ease);
}

.avatar-email {
  padding: var(--space-2, 8px) var(--space-3, 12px);
  font: 400 var(--text-sm, 12px)/1.4 var(--font-body, 'Geist', sans-serif);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  margin-bottom: var(--space-2, 8px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-row {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  width: 100%;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm, 8px);
  color: var(--text-secondary);
  font: 500 var(--text-sm, 12px)/1.4 var(--font-body, 'Geist', sans-serif);
  text-align: left;
  cursor: pointer;
  transition:
    background var(--duration-fast, 120ms) var(--ease-out, ease),
    color var(--duration-fast, 120ms) var(--ease-out, ease);
}

.avatar-row:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
}

.avatar-row-label {
  flex: 1;
}

.avatar-row-value {
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: var(--text-xs, 11px);
  padding: 2px 6px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-xs, 6px);
  color: var(--text-muted);
}

.avatar-row-active .avatar-row-value {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

@keyframes avatar-pop-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .avatar-popover { animation: none; }
  .avatar-trigger, .avatar-row { transition: none; }
}
```

- [ ] **Step 3: Lint**

```bash
cd /Users/ethanjin/Inner-Circle && npx eslint src/components/AvatarMenu/AvatarMenu.jsx
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add src/components/AvatarMenu/ && git commit -m "feat: AvatarMenu top-right popover (demo, sign out)"
```

---

## Task 8: First-run `⌘K` nudge toast

Shows "Press ⌘K to find anyone" once, 1500ms after canvas settles. Persisted via `localStorage` flag `ic.cmdkNudgeShown`.

**Files:**
- Create: `src/components/CmdKNudge/CmdKNudge.jsx`
- Create: `src/components/CmdKNudge/CmdKNudge.css`

- [ ] **Step 1: Write the component**

Create `src/components/CmdKNudge/CmdKNudge.jsx`:

```jsx
import { useEffect, useState } from 'react';
import './CmdKNudge.css';

const FLAG_KEY = 'ic.cmdkNudgeShown';

function getModSymbol() {
  if (typeof navigator === 'undefined') return '⌘';
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
}

export default function CmdKNudge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let alreadyShown = false;
    try {
      alreadyShown = window.localStorage.getItem(FLAG_KEY) === '1';
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) return undefined;

    const showTimer = setTimeout(() => setVisible(true), 1500);
    const hideTimer = setTimeout(() => setVisible(false), 1500 + 4000);

    function dismissOnInteraction() {
      setVisible(false);
      window.removeEventListener('keydown', dismissOnInteraction);
      window.removeEventListener('mousedown', dismissOnInteraction);
    }
    window.addEventListener('keydown', dismissOnInteraction);
    window.addEventListener('mousedown', dismissOnInteraction);

    try {
      window.localStorage.setItem(FLAG_KEY, '1');
    } catch {
      // ignore
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      window.removeEventListener('keydown', dismissOnInteraction);
      window.removeEventListener('mousedown', dismissOnInteraction);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="cmdk-nudge" role="status" aria-live="polite">
      Press
      <span className="cmdk-nudge-key">{getModSymbol()}</span>
      <span className="cmdk-nudge-key">K</span>
      to find anyone
    </div>
  );
}
```

- [ ] **Step 2: Write the CSS**

Create `src/components/CmdKNudge/CmdKNudge.css`:

```css
.cmdk-nudge {
  position: fixed;
  top: var(--space-12, 48px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 70;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-4, 16px);
  background: var(--surface-1, #0e0e0e);
  border: 1px solid var(--border-default, rgba(255, 255, 255, 0.10));
  border-radius: var(--radius-full, 9999px);
  color: var(--text-secondary);
  font: 400 var(--text-sm, 12px)/1.4 var(--font-body, 'Geist', sans-serif);
  box-shadow: var(--elevation-sm, 0 1px 2px rgba(2, 2, 8, 0.4));
  animation: cmdk-nudge-in var(--duration-base, 200ms) var(--ease-out, ease);
}

.cmdk-nudge-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  padding: 0 4px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-xs, 6px);
  font-family: var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  font-size: var(--text-xs, 11px);
  color: var(--text-primary);
}

@keyframes cmdk-nudge-in {
  from { opacity: 0; transform: translate(-50%, -4px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .cmdk-nudge { animation: none; }
}
```

- [ ] **Step 3: Lint**

```bash
cd /Users/ethanjin/Inner-Circle && npx eslint src/components/CmdKNudge/CmdKNudge.jsx
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add src/components/CmdKNudge/ && git commit -m "feat: first-run ⌘K nudge toast"
```

---

## Task 9: `ChatHistory.jsx` visual refresh

**Scope:** Visuals of chat-history rows only. Do NOT modify `ChatModal.jsx` or the message-rendering files. Replace the 🗑 emoji (violates design doc §6) with `lucide-react` `Trash2`. Restyle row chrome to use design tokens.

**Files:**
- Modify: `src/components/Chat/ChatHistory.jsx`
- Modify: `src/components/Chat/Chat.css` (only the `.chat-history-*` classes)

- [ ] **Step 1: Replace `ChatHistory.jsx`**

Overwrite `src/components/Chat/ChatHistory.jsx` with:

```jsx
import { Trash2 } from 'lucide-react';

// Renders inside ChatModal (or anywhere the threads list is needed).
// Props:
//   threads: from useChatHistory
//   onOpenThread: (thread) => void
//   onDeleteThread: (id) => void

export default function ChatHistory({ threads, onOpenThread, onDeleteThread }) {
  if (threads.length === 0) {
    return <div className="chat-history-empty">No past chats yet</div>;
  }
  return (
    <div className="chat-history-list">
      {threads.map((t) => {
        const title = t.title?.trim() ? t.title : '(Untitled)';
        return (
          <div key={t.id} className="chat-history-item">
            <button
              type="button"
              className="chat-history-item-main"
              onClick={() => onOpenThread(t)}
              title={title}
            >
              <span className="chat-history-item-title">{title}</span>
              <span className="chat-history-item-time">{formatTime(t.createdAt)}</span>
            </button>
            <button
              type="button"
              className="chat-history-item-delete"
              onClick={(e) => { e.stopPropagation(); onDeleteThread(t.id); }}
              aria-label={`Delete chat "${title}"`}
              title="Delete"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const dayMs = 86_400_000;
  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / 3_600_000));
    if (hours < 24) return `${hours}h`;
  }
  const days = Math.floor(diffMs / dayMs);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
```

- [ ] **Step 2: Replace `.chat-history-*` styles in `Chat.css`**

Find the existing `.chat-history-*` rules in `src/components/Chat/Chat.css` and replace them with:

```css
.chat-history-list {
  padding: var(--space-2, 8px) 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chat-history-empty {
  padding: var(--space-4, 16px);
  text-align: center;
  font: 400 var(--text-sm, 12px)/1.4 var(--font-body, 'Geist', sans-serif);
  color: var(--text-muted);
}

.chat-history-item {
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm, 8px);
  transition: background var(--duration-fast, 120ms) var(--ease-out, ease);
}

.chat-history-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.chat-history-item-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  min-width: 0;
}

.chat-history-item-title {
  flex: 1;
  font: 500 var(--text-sm, 12px)/1.4 var(--font-body, 'Geist', sans-serif);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-history-item-time {
  font: 400 var(--text-xs, 11px)/1.3 var(--font-mono, 'Geist Mono', ui-monospace, monospace);
  color: var(--text-muted);
  flex-shrink: 0;
}

.chat-history-item-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-right: 4px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-xs, 6px);
  opacity: 0;
  transition:
    opacity var(--duration-fast, 120ms) var(--ease-out, ease),
    color var(--duration-fast, 120ms) var(--ease-out, ease),
    background var(--duration-fast, 120ms) var(--ease-out, ease);
}

.chat-history-item:hover .chat-history-item-delete,
.chat-history-item-delete:focus-visible {
  opacity: 1;
}

.chat-history-item-delete:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.chat-history-item-delete:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .chat-history-item, .chat-history-item-delete { transition: none; }
}
```

- [ ] **Step 3: Lint**

```bash
cd /Users/ethanjin/Inner-Circle && npx eslint src/components/Chat/ChatHistory.jsx
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add src/components/Chat/ChatHistory.jsx src/components/Chat/Chat.css && git commit -m "design: chat history rows match design tokens (replace emoji with lucide)"
```

---

## Task 10: Wire surfaces into `App.jsx` and delete the sidebar

This task makes the new surfaces functional and removes the dead rail.

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add new imports**

In `src/App.jsx`, top of file (after the existing `lucide-react` import line, around line 2), keep the existing imports and add:

```jsx
import SearchPill from './components/SearchPill/SearchPill';
import CommandPalette from './components/CommandPalette/CommandPalette';
import CategoryLegend from './components/CategoryLegend/CategoryLegend';
import AvatarMenu from './components/AvatarMenu/AvatarMenu';
import CmdKNudge from './components/CmdKNudge/CmdKNudge';
import { useRecentPeople } from './hooks/useRecentPeople';
import { useCommandKey } from './hooks/useCommandKey';
```

After Step 8 deletes the inline person panel, the existing `lucide-react` import (`Cake, Zap, GraduationCap, Briefcase, ArrowUpRight`) becomes unused inside `App.jsx` — those icons were used only by the panel. Delete that import line. Verify with `npx eslint src/App.jsx` (will surface any unused imports).

- [ ] **Step 2: Delete dead state**

Inside `function App()` near the top (around lines 67–75), delete these lines:

```jsx
const [expandedCats, setExpandedCats] = useState(new Set());
const [expandedPeople, setExpandedPeople] = useState(new Set());
const [explorerOpen, setExplorerOpen] = useState(true);
const [pastChatsOpen, setPastChatsOpen] = useState(false);
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
```

Also delete the `toggleCat` and `togglePerson` callbacks (around lines 134–150).

- [ ] **Step 3: Add palette state and recents hook**

Inside `function App()`, after the `useChatHistory()` line (around line 93), add:

```jsx
const [paletteOpen, setPaletteOpen] = useState(false);
const { recentIds, recordOpen } = useRecentPeople();

const openPalette = useCallback(() => {
  if (selectedPerson) return;       // disallow during person modal
  if (landingExiting) return;       // disallow during cinematic transition
  setPaletteOpen(true);
}, [selectedPerson, landingExiting]);

const closePalette = useCallback(() => setPaletteOpen(false), []);

useCommandKey(openPalette, { enabled: !selectedPerson && !landingExiting });
```

- [ ] **Step 4: Wrap `handleNodeClick` to record recents**

Find the existing `handleNodeClick` (around line 152) and replace its body so it records the open:

```jsx
const handleNodeClick = useCallback((node, screenPos) => {
  bumpInteraction();
  if (node.isCategory) {
    setFocusedCategory(node.category);
    return;
  }
  clearTimeout(modalTimerRef.current);
  setZoomTarget(screenPos ?? null);
  setSelectedPerson(node);
  setModalPhase('zooming-in');
  modalTimerRef.current = setTimeout(() => setModalPhase('open'), 380);
  recordOpen(node.id);
}, [bumpInteraction, recordOpen]);
```

- [ ] **Step 5: Compute `countsByCategory` for the legend**

After the `peopleByCategory` useMemo (around line 130), add:

```jsx
const countsByCategory = useMemo(() => {
  const counts = {};
  displayPeople.forEach((p) => {
    const k = p.relationship?.type ?? 'other';
    counts[k] = (counts[k] ?? 0) + 1;
  });
  return counts;
}, [displayPeople]);
```

- [ ] **Step 6: Add `handlePaletteSelect`**

After `closePalette`:

```jsx
const handlePaletteSelect = useCallback((person) => {
  setPaletteOpen(false);
  // Pass null screenPos — zoom origin defaults to viewport center.
  handleNodeClick(person, null);
}, [handleNodeClick]);
```

- [ ] **Step 7: Replace the `<header>` slots**

Find the `{!isFirstExperience && <header className="header">` block (around line 382). Replace its left empty `<div />` and right empty `<div />` slots:

```jsx
{!isFirstExperience && <header className="header">
  <div className="header-slot header-slot-left">
    <SearchPill onClick={openPalette} disabled={!!selectedPerson} />
  </div>

  {/* Center Toolbar — unchanged, keep existing children */}
  <div className="toolbar">
    {/* … existing tool-btn buttons stay … */}
  </div>

  <div className="header-slot header-slot-right">
    <AvatarMenu
      email={user?.email}
      demoOn={showDemo}
      onToggleDemo={() => setShowDemo((v) => !v)}
      onSignOut={async () => { await signOut(); window.location.reload(); }}
    />
  </div>
</header>}
```

- [ ] **Step 8: Delete the `<aside class="sidebar">` block entirely**

Delete the entire block beginning at `{!isFirstExperience && <aside className={\`sidebar ...\`}>` (around line 427) through its closing `</aside>}` (around line 654). Replace it with **nothing** — the canvas will reflow to full-bleed.

- [ ] **Step 9: Mount the new surfaces below the canvas**

After the existing `viewMode === 'gallery'` block (around line 380, before the `<header>` block) is fine, OR — cleaner — at the very bottom of the JSX returned from `App()`, just before the closing wrapper element, add:

```jsx
{!isFirstExperience && viewMode === 'graph' && (
  <>
    <CategoryLegend
      countsByCategory={countsByCategory}
      activeFilters={activeFilters}
      onToggle={toggleBranchHighlight}
      onClearAll={() => setActiveFilters(new Set())}
      hidden={landingExiting || !!selectedPerson}
    />
    <CommandPalette
      open={paletteOpen}
      onClose={closePalette}
      people={displayPeople}
      recentIds={recentIds}
      onSelect={handlePaletteSelect}
    />
    <CmdKNudge />
  </>
)}
```

If you cannot easily find "the very bottom of the JSX returned from App()", search for the final `</div>` before `);` at the end of `function App()` and place the block immediately above it.

- [ ] **Step 10: Lint and run dev server for visual verification**

```bash
cd /Users/ethanjin/Inner-Circle && npx eslint src/App.jsx
```

Expected: 0 errors.

```bash
cd /Users/ethanjin/Inner-Circle && npm run dev
```

Open `http://localhost:5173` (or whatever Vite reports). Sign in as an existing user. Verify in browser:

1. The left rail is gone; the canvas extends full-width.
2. The Search pill is visible at top-left of the header, showing `Search… ⌘K`.
3. The avatar icon is visible at top-right.
4. The category legend appears centered along the bottom edge.
5. After ~1.5s on first load (in a fresh browser profile or after `localStorage.removeItem('ic.cmdkNudgeShown')`), the nudge toast appears top-center.
6. Pressing ⌘K opens the palette. Esc closes it.
7. Clicking the Search pill opens the palette.
8. Typing a name filters; pressing Enter opens the person modal with the existing zoom-in animation.
9. Clicking a legend chip toggles its category highlight in the graph (multi-select). The clear ✕ appears when ≥1 active.
10. Clicking the avatar opens the menu; Demo toggle works; Sign out works.

Stop dev server (`Ctrl+C`).

- [ ] **Step 11: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add src/App.jsx && git commit -m "feat: replace sidebar with floating surfaces (palette, legend, avatar)"
```

---

## Task 11: Sweep dead CSS

Remove sidebar-related rules from `src/App.css`. The exact selectors below are confirmed dead after Task 10.

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Identify dead rules**

Run:

```bash
cd /Users/ethanjin/Inner-Circle && grep -n -E "^\.(sidebar|tree-|node-cat|node-person|person-info-panel|branch-toggle|demo-row|demo-toggle-dot|chevron|logo-glyph|logo-text|collapsible-label|sidebar-)" src/App.css
```

This lists every rule whose selector starts with a dead class. Note the line ranges — rules typically span until the next selector or `}`.

- [ ] **Step 2: Verify each is unused elsewhere**

For each dead class identified, confirm it's not referenced from JSX that still ships:

```bash
cd /Users/ethanjin/Inner-Circle && grep -rn "className.*\(sidebar\|tree-\|node-cat\|node-person\|person-info-panel\|branch-toggle\|demo-row\|demo-toggle-dot\|logo-glyph\|logo-text\|collapsible-label\)" src/ --include="*.jsx"
```

Expected: no matches in any file. (`PersonModal.jsx` may legitimately still use `.scoring-pending`/`.scoring-uncertain`/`.scoring-failed`/`.scoring-retry`/`.info-row` — those are NOT in the kill list above. Leave them alone.)

If any match is found, the implementer must trace it and decide whether to keep that rule or update the consumer. Do not delete a rule that's still used.

- [ ] **Step 3: Delete the dead rules**

In `src/App.css`, delete every rule whose selector list consists entirely of the kill-list classes from Step 1. Also delete:

- Any `.app` rule that reserves left padding for the rail (e.g. `.app { padding-left: 280px }`). The canvas should be full-bleed.
- Any media query that adjusts `.sidebar` widths.
- The `.header` rule may need tweaking: if it currently uses `grid-template-columns: <sidebar-width> 1fr <gutter>` or similar, simplify to `1fr auto 1fr` so left/center/right slots distribute evenly.

Then add minimal slot styles at the bottom of `App.css`:

```css
.header-slot {
  display: flex;
  align-items: center;
}

.header-slot-left {
  justify-self: start;
  padding-left: var(--space-6, 24px);
}

.header-slot-right {
  justify-self: end;
  padding-right: var(--space-6, 24px);
}
```

- [ ] **Step 4: Run dev server, smoke-check visuals**

```bash
cd /Users/ethanjin/Inner-Circle && npm run dev
```

In the browser, confirm:

- No layout regression — the canvas is still full-width, header still has search-pill on the left and avatar on the right.
- No console warnings about unknown CSS properties.
- The Person modal still styles strength rows correctly (i.e. `.scoring-*` and `.info-row` rules survived the sweep).

Stop dev server.

- [ ] **Step 5: Commit**

```bash
cd /Users/ethanjin/Inner-Circle && git add src/App.css && git commit -m "chore: sweep dead sidebar CSS, slot left/right header"
```

---

## Task 12: End-to-end manual QA

Final pass. No code changes; just verify the spec checklist.

- [ ] **Step 1: Run dev server**

```bash
cd /Users/ethanjin/Inner-Circle && npm run dev
```

- [ ] **Step 2: Walk the spec §11 checklist**

In a clean browser (incognito / new profile, or after `localStorage.clear()` for the app origin):

1. [ ] Sidebar gone; canvas is full-bleed.
2. [ ] `⌘K` opens palette from anywhere except landing-transition and modal-open states.
3. [ ] Click on toolbar Search pill opens palette.
4. [ ] Typing in palette filters fuzzily; ↑↓ navigates; Enter opens person modal with the same zoom-in animation as a canvas click.
5. [ ] Palette empty state shows recents (or strength-sorted fallback if no recents).
6. [ ] Recents list updates after opening a person — close, reopen palette, the just-opened person is at the top of `RECENT`.
7. [ ] Esc closes palette without selecting.
8. [ ] Each legend chip toggles its category's highlight in the graph; multi-select works.
9. [ ] Clear-all appears only when ≥1 chip is active and clears all.
10. [ ] Active chip's border is 1.5px in the category color; idle is 1px subtle.
11. [ ] Avatar menu opens, Demo toggles, Sign out works.
12. [ ] First-run nudge appears once, never again. Verify `localStorage.getItem('ic.cmdkNudgeShown') === '1'` after dismissal.
13. [ ] Toggle macOS System Preferences → Accessibility → Reduce Motion (or `prefers-reduced-motion` Chrome devtools rendering emulation) — translate/scale animations disabled, fades become instant.
14. [ ] Resize the viewport to ~600px wide — legend wraps to two rows without horizontal scroll.
15. [ ] `ChatHistory` rows look design-doc compliant — open `ChatModal`, view past chats, hover reveals trash icon, no 🗑 emoji visible.

- [ ] **Step 3: Run all unit tests**

```bash
cd /Users/ethanjin/Inner-Circle && npm test
```

Expected: all `.test.mjs` files pass, including `useRecentPeople.test.mjs`.

- [ ] **Step 4: Run a production build**

```bash
cd /Users/ethanjin/Inner-Circle && npm run build
```

Expected: build succeeds with no errors. Warnings about chunk size are acceptable.

- [ ] **Step 5: Commit any QA fixes (if needed)**

If the QA pass surfaced bugs, fix them in targeted commits with messages like `fix: <component>: <bug>`. Otherwise no commit.

- [ ] **Step 6: Report completion**

Report which checklist items passed/failed back to the user. List any deferred items.

---

## Notes

- **Reduced motion respected throughout:** every `transition` and `animation` rule has a `@media (prefers-reduced-motion: reduce)` override.
- **Z-index hierarchy:** legend (10) < toolbar (30) < palette (50/60) < nudge (70). Matches design doc §9.
- **No new colors introduced:** all colors come from `src/index.css` tokens. The `--celestial-*` tokens used by the legend already exist (verified in spec).
- **Z-index of `--backdrop` is 50; `cmdp-shell` is 60.** Design doc §9 reserves 50 for "modal-backdrop" and 60 for "modal" — palette acts as a modal here, which is consistent.
- **Person modal interaction:** when `selectedPerson` is set, the palette is disabled (Search pill disabled, ⌘K listener no-ops). Closing the modal re-enables both.
