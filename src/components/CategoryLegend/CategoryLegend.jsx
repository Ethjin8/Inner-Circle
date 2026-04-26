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
