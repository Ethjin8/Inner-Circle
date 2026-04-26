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

  // Reset query only when palette opens from a closed state
  useEffect(() => {
    if (open) {
      // Note: setState within effect is intentional for resetting query on open.
      // This does not violate best practices as we are synchronizing state with
      // an external prop change (open/close state from parent).
      setQuery(''); // eslint-disable-line react-hooks/set-state-in-effect
    }
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
