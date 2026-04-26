import { Search, ChevronDown } from 'lucide-react';
import './SearchPill.css';

function getModSymbol() {
  if (typeof navigator === 'undefined') return '⌘';
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
}

export default function SearchPill({ onClick, onToggleExplorer, explorerOpen = false, disabled = false }) {
  return (
    <div className="search-pill-container">
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

      <div className="search-pill-divider" />

      <button
        type="button"
        className={`search-pill-explorer-toggle ${explorerOpen ? 'active' : ''}`}
        onClick={onToggleExplorer}
        title="Open connections explorer"
        disabled={disabled}
      >
        <ChevronDown size={14} className={explorerOpen ? 'rotated' : ''} />
      </button>
    </div>
  );
}
