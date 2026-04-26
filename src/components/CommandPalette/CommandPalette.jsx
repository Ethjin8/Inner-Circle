import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Search, X } from 'lucide-react';
import './CommandPalette.css';

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

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

function categoryToken(cat) {
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

// Custom cmdk filter: match person.name (the part before "__"), case-insensitive
// substring. shouldFilter stays true the whole time so cmdk never resets state.
function paletteFilter(value, search) {
  if (!search) return 1;
  const name = (value.split('__')[0] || '').toLowerCase();
  const q = search.trim().toLowerCase();
  return name.includes(q) ? 1 : 0;
}

export default function CommandPalette({
  open,
  onClose,
  people,
  recentIds,
  countsByCategory,
  activeCategories,
  onToggleCategory,
  onClearCategories,
  onSelect,
  transitioning = false,
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setQuery(''); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const peopleById = useMemo(() => {
    const map = new Map();
    people.forEach((p) => map.set(p.id, p));
    return map;
  }, [people]);

  // Apply category filter at the data layer. cmdk handles text filtering on top.
  const peopleAfterCategoryFilter = useMemo(() => {
    if (!activeCategories || activeCategories.size === 0) return people;
    return people.filter((p) => {
      const cat = p.relationship?.type ?? 'other';
      return activeCategories.has(cat);
    });
  }, [people, activeCategories]);

  const isEmptyQuery = query.trim().length === 0;
  const noFilters = !activeCategories || activeCategories.size === 0;

  // Recents only show when query is empty AND no category filters are active.
  // Otherwise the user is intentionally narrowing — recents would be noise.
  const recentItems = useMemo(() => {
    if (!isEmptyQuery || !noFilters) return [];
    return recentIds
      .map((id) => peopleById.get(id))
      .filter(Boolean)
      .slice(0, 6);
  }, [isEmptyQuery, noFilters, recentIds, peopleById]);

  // Main list — exclude recents from this group when recents are shown,
  // to avoid showing the same person twice (and double cmdk values).
  const mainListItems = useMemo(() => {
    if (recentItems.length === 0) return peopleAfterCategoryFilter;
    const recentIdSet = new Set(recentItems.map((p) => p.id));
    return peopleAfterCategoryFilter.filter((p) => !recentIdSet.has(p.id));
  }, [peopleAfterCategoryFilter, recentItems]);

  if (!open) return null;

  const showRecentsHeading = recentItems.length > 0;
  const showMainHeading = isEmptyQuery && mainListItems.length > 0;

  return (
    <div
      className={`cmdp-backdrop ${transitioning ? 'is-transitioning' : ''}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`cmdp-shell ${transitioning ? 'is-transitioning' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Search people" filter={paletteFilter} shouldFilter>
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

          <div className="cmdp-categories" role="group" aria-label="Filter by category">
            {CATEGORIES.map((c) => {
              const count = countsByCategory?.[c.key] ?? 0;
              if (count === 0) return null;
              const active = activeCategories?.has(c.key) ?? false;
              return (
                <button
                  key={c.key}
                  type="button"
                  className={`cmdp-cat-chip ${active ? 'is-active' : ''}`}
                  style={{ '--chip-color': c.token }}
                  onClick={() => onToggleCategory(c.key)}
                  aria-pressed={active}
                  aria-label={`${c.label}, ${count} ${count === 1 ? 'person' : 'people'}, ${active ? 'on' : 'off'}`}
                >
                  <span className="cmdp-cat-dot" aria-hidden />
                  <span className="cmdp-cat-name">{c.label}</span>
                  <span className="cmdp-cat-count">{count}</span>
                </button>
              );
            })}
            {!noFilters && (
              <button
                type="button"
                className="cmdp-cat-clear"
                onClick={onClearCategories}
                aria-label="Clear category filters"
                title="Clear"
              >
                <X size={12} aria-hidden />
              </button>
            )}
          </div>

          <Command.List className="cmdp-list">
            <Command.Empty className="cmdp-empty">
              {isEmptyQuery
                ? 'No people in this category yet'
                : `No people match "${query}"`}
            </Command.Empty>

            {showRecentsHeading && (
              <Command.Group heading="RECENT" className="cmdp-group">
                {recentItems.map((p) => (
                  <PersonRow key={p.id} person={p} onSelect={onSelect} />
                ))}
              </Command.Group>
            )}

            <Command.Group
              heading={showMainHeading ? 'ALL' : undefined}
              className="cmdp-group"
            >
              {mainListItems.map((p) => (
                <PersonRow key={p.id} person={p} onSelect={onSelect} />
              ))}
            </Command.Group>
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
