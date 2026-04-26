import { useState, useMemo, useRef, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Check, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import './Explorer.css';

const DRAG_MIME = 'application/x-inner-circle-person';

export default function Explorer({
  open = true,
  onToggleOpen,
  people,
  categories,
  onSelectPerson,
  activeFilters,
  onToggleCategory,
  onCreateCategory,
  onDeleteCategory,
  onMovePerson,
  canAdd = true,
  nextColor,
}) {
  const hasAnyFilter = activeFilters && activeFilters.size > 0;
  const [expandedCategories, setExpandedCategories] = useState(() => new Set(['friend']));
  const [creating, setCreating] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [createError, setCreateError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // category key
  const [dragState, setDragState] = useState(null);
  // dragState: { personId, fromCat, overCat, overIndex } — overIndex
  // is the insertion slot (0 = before first, list.length = after last).

  const groupedPeople = useMemo(() => {
    const groups = {};
    people.forEach((p) => {
      const cat = p.relationship?.type || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    Object.keys(groups).forEach((cat) => {
      groups[cat].sort((a, b) => {
        const oa = a.order ?? Number.POSITIVE_INFINITY;
        const ob = b.order ?? Number.POSITIVE_INFINITY;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      });
    });
    return groups;
  }, [people]);

  const toggleCategory = useCallback((cat) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const existingNames = useMemo(
    () => new Set((categories || []).map((c) => c.label.trim().toLowerCase())),
    [categories]
  );

  const validateDraft = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return null;
    if (existingNames.has(trimmed.toLowerCase())) return 'A category with this name already exists.';
    return null;
  };

  const handleDraftChange = (e) => {
    const next = e.target.value;
    setDraftLabel(next);
    setCreateError(validateDraft(next));
  };

  const submitNew = () => {
    const label = draftLabel.trim();
    if (!label) { setCreating(false); setDraftLabel(''); setCreateError(null); return; }
    const err = validateDraft(label);
    if (err) { setCreateError(err); return; }
    const result = onCreateCategory?.(label);
    if (result && result.ok === false) {
      if (result.reason === 'duplicate') setCreateError('A category with this name already exists.');
      else if (result.reason === 'palette-full') setCreateError('No colors left — delete a category first.');
      else setCreateError('Could not create category.');
      return;
    }
    setDraftLabel('');
    setCreating(false);
    setCreateError(null);
  };

  const cancelNew = () => { setCreating(false); setDraftLabel(''); setCreateError(null); };

  // ----- Drag handlers -----------------------------------------------------

  // Snapshot of which categories were expanded *before* the drag started.
  // We auto-expand collapsed categories during a drag-over so the user can
  // see their target slot; on drop/cancel we revert anything we opened so
  // the panel doesn't stay sprawled out and force a long scroll afterward.
  // The destination category is kept open as confirmation of where the
  // person landed.
  const preDragExpandedRef = useRef(null);

  const handleDragStart = (e, person, fromCat) => {
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData(DRAG_MIME, person.id); } catch {}
    try { e.dataTransfer.setData('text/plain', person.name); } catch {}
    preDragExpandedRef.current = new Set(expandedCategories);
    setDragState({ personId: person.id, fromCat, overCat: fromCat, overIndex: null });
  };

  const restoreExpansion = useCallback((destCat) => {
    const before = preDragExpandedRef.current;
    if (!before) return;
    const next = new Set(before);
    if (destCat) next.add(destCat);
    setExpandedCategories(next);
    preDragExpandedRef.current = null;
  }, []);

  const handleDragEnd = () => {
    // dragend fires after drop; if the drop already restored expansion,
    // preDragExpandedRef is null and this is a no-op.
    setDragState((prev) => {
      restoreExpansion(prev?.overCat);
      return null;
    });
  };

  const handleCardDragOver = (e, catKey, index) => {
    if (!dragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Insert above or below depending on which half of the card the cursor is on
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    const slot = after ? index + 1 : index;
    setDragState((prev) => prev ? { ...prev, overCat: catKey, overIndex: slot } : prev);
  };

  const handleListDragOver = (e, catKey, count) => {
    if (!dragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState((prev) => {
      if (!prev) return prev;
      // If a card already set a slot for this category, keep it.
      if (prev.overCat === catKey && prev.overIndex != null) return prev;
      return { ...prev, overCat: catKey, overIndex: count };
    });
  };

  const handleListDragLeave = (e, catKey) => {
    // Only clear if we're leaving the children container entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragState((prev) => (prev && prev.overCat === catKey) ? { ...prev, overIndex: null } : prev);
    }
  };

  const handleDrop = (e) => {
    if (!dragState) return;
    e.preventDefault();
    const { personId, overCat, overIndex } = dragState;
    if (overCat && overIndex != null) {
      onMovePerson?.(personId, overCat, overIndex);
    }
    restoreExpansion(overCat);
    setDragState(null);
  };

  return (
    <>
      <button
        type="button"
        className={`explorer-reveal ${open ? 'is-hidden' : ''}`}
        onClick={onToggleOpen}
        aria-label="Show explorer"
        title="Show explorer"
        tabIndex={open ? -1 : 0}
      >
        <PanelLeftOpen size={14} />
      </button>
    <aside
      className={`explorer-panel ${open ? '' : 'is-collapsed'}`}
      role="navigation"
      aria-label="Connections explorer"
      aria-hidden={!open}
      onDragOver={(e) => { if (dragState) e.preventDefault(); }}
      onDrop={handleDrop}
    >
      <div className="explorer-header">
        <span className="explorer-title">EXPLORER</span>
        <span className="explorer-header-actions">
          <button
            type="button"
            className="explorer-add-btn"
            onClick={() => { if (canAdd) setCreating(true); }}
            disabled={!canAdd}
            title={canAdd ? 'New category' : 'All colors used'}
            aria-label="New category"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="explorer-add-btn"
            onClick={onToggleOpen}
            title="Hide explorer"
            aria-label="Hide explorer"
          >
            <PanelLeftClose size={14} />
          </button>
        </span>
      </div>

      {creating && (
        <div className={`explorer-new-row ${createError ? 'has-error' : ''}`}>
          <div className="explorer-new-row-main">
            <span className="explorer-dot solid" style={{ '--cat-color': nextColor || 'var(--text-muted)' }} />
            <input
              autoFocus
              className="explorer-new-input"
              placeholder="Category name…"
              value={draftLabel}
              maxLength={24}
              aria-invalid={!!createError}
              onChange={handleDraftChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNew();
                else if (e.key === 'Escape') cancelNew();
              }}
            />
            <button
              type="button"
              className="explorer-icon-btn confirm"
              onClick={submitNew}
              disabled={!draftLabel.trim() || !!createError}
              aria-label="Create category"
            >
              <Check size={12} />
            </button>
            <button type="button" className="explorer-icon-btn" onClick={cancelNew} aria-label="Cancel">
              <X size={12} />
            </button>
          </div>
          {createError && <div className="explorer-new-error">{createError}</div>}
        </div>
      )}

      <div className="explorer-content">
        {categories.map((cat) => {
          const catKey = cat.key;
          const catPeople = groupedPeople[catKey] || [];
          const isExpanded = expandedCategories.has(catKey);
          const isFocused = activeFilters?.has(catKey) ?? false;
          const isDimmed = hasAnyFilter && !isFocused;
          const isDeleteConfirm = confirmDelete === catKey;
          const dragHere = dragState?.overCat === catKey;

          return (
            <div key={catKey} className="explorer-section">
              <div
                className={`explorer-row category ${isExpanded ? 'expanded' : ''} ${isFocused ? 'focused' : ''} ${isDimmed ? 'dimmed' : ''}`}
                style={{ '--cat-color': cat.color }}
                onDragOver={(e) => {
                  if (dragState) {
                    e.preventDefault();
                    setDragState((prev) => prev ? { ...prev, overCat: catKey, overIndex: catPeople.length } : prev);
                    // Auto-expand only the hovered category; collapse any
                    // others we opened during this drag so the panel doesn't
                    // pile up. Keep the user's pre-drag expansions intact.
                    const before = preDragExpandedRef.current;
                    if (before) {
                      setExpandedCategories((prev) => {
                        const next = new Set(before);
                        next.add(catKey);
                        if (next.size === prev.size) {
                          let same = true;
                          for (const k of next) if (!prev.has(k)) { same = false; break; }
                          if (same) return prev;
                        }
                        return next;
                      });
                    }
                  }
                }}
              >
                <button
                  type="button"
                  className="explorer-row-main"
                  onClick={() => toggleCategory(catKey)}
                  aria-expanded={isExpanded}
                >
                  <span className="explorer-chev">
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <span className="explorer-dot solid" />
                  <span className="explorer-label">{cat.label}</span>
                  <span className="explorer-count">{catPeople.length}</span>
                </button>

                {isDeleteConfirm ? (
                  <span className="explorer-confirm-cluster">
                    <button
                      type="button"
                      className="explorer-icon-btn danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCategory?.(catKey);
                        setConfirmDelete(null);
                      }}
                      title="Confirm delete"
                      aria-label="Confirm delete"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      className="explorer-icon-btn"
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                      title="Cancel"
                      aria-label="Cancel"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ) : (
                  <>
                    {!cat.builtin && (
                      <button
                        type="button"
                        className="explorer-icon-btn delete"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(catKey); }}
                        title={`Delete ${cat.label}`}
                        aria-label={`Delete ${cat.label}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className={`explorer-isolate ${isFocused ? 'on' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCategory?.(catKey);
                      }}
                      title={isFocused ? 'Show all categories' : `Isolate ${cat.label}`}
                      aria-pressed={isFocused}
                      aria-label={isFocused ? 'Show all categories' : `Isolate ${cat.label}`}
                    >
                      <span className="explorer-dot ring" />
                    </button>
                  </>
                )}
              </div>

              {isExpanded && (
                <div
                  className={`explorer-children ${dragHere ? 'drag-target' : ''}`}
                  style={{ '--cat-color': cat.color }}
                  onDragOver={(e) => handleListDragOver(e, catKey, catPeople.length)}
                  onDragLeave={(e) => handleListDragLeave(e, catKey)}
                >
                  {catPeople.length === 0 && dragHere && (
                    <div className="explorer-drop-line" />
                  )}
                  {catPeople.map((person, idx) => {
                    const showLineBefore = dragHere && dragState?.overIndex === idx && dragState?.personId !== person.id;
                    const isDragging = dragState?.personId === person.id;
                    return (
                      <div key={person.id} className="explorer-card-wrap">
                        {showLineBefore && <div className="explorer-drop-line" />}
                        <div
                          role="button"
                          tabIndex={0}
                          draggable="true"
                          className={`explorer-person-card ${isDragging ? 'is-dragging' : ''}`}
                          style={{ '--cat-color': cat.color }}
                          onClick={() => onSelectPerson(person)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectPerson(person);
                            }
                          }}
                          onDragStart={(e) => handleDragStart(e, person, catKey)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleCardDragOver(e, catKey, idx)}
                        >
                          <span className="explorer-grip" aria-hidden>
                            <span /><span /><span /><span /><span /><span />
                          </span>
                          <span className="explorer-dot solid sm" />
                          <span className="explorer-label person-name">{person.name}</span>
                        </div>
                      </div>
                    );
                  })}
                  {dragHere && dragState?.overIndex === catPeople.length && (
                    <div className="explorer-drop-line" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
    </>
  );
}
