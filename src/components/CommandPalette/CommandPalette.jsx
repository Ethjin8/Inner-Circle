import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
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

function PersonRow({ person, onSelect, categoryLabelMap }) {
  const cat = person.relationship?.type;
  const strength = person.relationship?.strength;
  const isPending = person.scoring?.status === 'pending';
  const label = (cat && categoryLabelMap?.[cat]) || CATEGORY_LABEL[cat] || 'Other';
  const meta = `${label} · ${
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
  categories,
  recentIds,
  onSelect,
  transitioning = false,
}) {
  const categoryLabelMap = useMemo(
    () => Object.fromEntries((categories || []).map((c) => [c.key, c.label])),
    [categories]
  );
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

  const isEmptyQuery = query.trim().length === 0;

  const recentItems = useMemo(() => {
    if (!isEmptyQuery) return [];
    return recentIds
      .map((id) => peopleById.get(id))
      .filter(Boolean)
      .slice(0, 6);
  }, [isEmptyQuery, recentIds, peopleById]);

  const mainListItems = useMemo(() => {
    if (recentItems.length === 0) return people;
    const recentIdSet = new Set(recentItems.map((p) => p.id));
    return people.filter((p) => !recentIdSet.has(p.id));
  }, [people, recentItems]);

  if (!open) return null;

  const showRecentsHeading = recentItems.length > 0;

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

          <Command.List className="cmdp-list">
            <Command.Empty className="cmdp-empty">
              {isEmptyQuery
                ? 'No people yet'
                : `No people match "${query}"`}
            </Command.Empty>

            {showRecentsHeading && (
              <Command.Group heading="RECENT" className="cmdp-group">
                {recentItems.map((p) => (
                  <PersonRow key={p.id} person={p} onSelect={onSelect} categoryLabelMap={categoryLabelMap} />
                ))}
              </Command.Group>
            )}

            <Command.Group
              heading={isEmptyQuery && mainListItems.length > 0 ? 'ALL' : undefined}
              className="cmdp-group"
            >
              {mainListItems.map((p) => (
                <PersonRow key={p.id} person={p} onSelect={onSelect} categoryLabelMap={categoryLabelMap} />
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
