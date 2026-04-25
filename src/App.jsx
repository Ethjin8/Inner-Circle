import { useState, useCallback, useMemo } from 'react';
import StarField from './components/Graph/StarField';
import ConstellationGraph, { DEMO_PEOPLE } from './components/Graph/ConstellationGraph';
import PersonModal from './components/PersonModal/PersonModal';
import AddPersonModal from './components/AddPersonModal/AddPersonModal';
import MemoryCarousel from './components/MemoryCarousel/MemoryCarousel';
import './App.css';

const FILTERS = [
  { key: null, label: 'All' },
  { key: 'family', label: 'Family', color: '#e8b06b' },
  { key: 'friend', label: 'Friends', color: '#ffce5c' },
  { key: 'classmate', label: 'School', color: '#b9d0ff' },
  { key: 'coworker', label: 'Work', color: '#9be6c4' },
  { key: 'professional', label: 'Professional', color: '#ff9c5a' },
  { key: 'romantic', label: 'Romantic', color: '#ffc8d6' },
  { key: 'mentor', label: 'Mentors', color: '#7df9ff' },
];

const CATEGORY_COLORS = {
  family: '#e8b06b',
  friend: '#ffce5c',
  classmate: '#b9d0ff',
  coworker: '#9be6c4',
  professional: '#ff9c5a',
  romantic: '#ffc8d6',
  mentor: '#7df9ff',
};

function App() {
  const [activeFilter, setActiveFilter] = useState(null);
  const [attachedNodes, setAttachedNodes] = useState([]);
  const [promptText, setPromptText] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [zoomTarget, setZoomTarget] = useState(null);
  const [cinematicState, setCinematicState] = useState('idle');
  const [focusedCategory, setFocusedCategory] = useState(null);
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [expandedPeople, setExpandedPeople] = useState(new Set());
  const [activeTool, setActiveTool] = useState(null); // null | 'snip'
  const [deletingIds, setDeletingIds] = useState([]); // ids being animated out
  const [deletedHistory, setDeletedHistory] = useState([]); // undo stack: [{type:'person'|'category', ids:[]}]
  const [photosByPerson, setPhotosByPerson] = useState({}); // { personId: [ { public_id, secure_url, ... }, ... ] }
  const [people, setPeople] = useState(DEMO_PEOPLE);
  
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'gallery'

  const allPhotos = useMemo(() => {
    const photos = [];
    Object.entries(photosByPerson).forEach(([personId, pList]) => {
      const person = people.find(p => p.id === personId);
      if (person) {
        pList.forEach(photo => photos.push({ ...photo, personName: person.name }));
      }
    });
    // Sort by upload date, newest first
    return photos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }, [photosByPerson, people]);

  const peopleByCategory = useMemo(() => {
    const map = {};
    FILTERS.forEach(f => { if (f.key) map[f.key] = { label: f.label, color: f.color, people: [] }; });
    people.forEach(p => {
      const c = p.relationship?.type;
      if (c && map[c]) map[c].people.push(p);
    });
    return map;
  }, [people]);

  const toggleCat = (cat) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const togglePerson = (id) => {
    setExpandedPeople(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNodeClick = useCallback((node) => {
    if (node.isCategory) {
      setFocusedCategory(node.category);
      setExpandedCats(prev => new Set(prev).add(node.category)); // Ensure sidebar folder opens
      return;
    }
    setZoomTarget({ x: node.x, y: node.y });
    setCinematicState('zooming-in');
    setSelectedPerson(node);
    setTimeout(() => setCinematicState('open'), 380);
  }, []);

  const handleNodeDoubleClick = useCallback((node) => {
    setAttachedNodes((prev) => {
      if (prev.some((n) => n.id === node.id)) return prev;
      return [...prev, node];
    });
  }, []);

  const closeModal = useCallback(() => {
    setCinematicState('zooming-out');
    setTimeout(() => {
      setSelectedPerson(null);
      setZoomTarget(null);
      setCinematicState('idle');
    }, 280);
  }, []);

  const removeAttachedNode = useCallback((nodeId) => {
    setAttachedNodes((prev) => prev.filter((n) => n.id !== nodeId));
  }, []);

  const handleSnip = useCallback((node) => {
    // Determine which IDs to delete
    let idsToDelete;
    let snippedPeople = [];

    if (node.isCategory) {
      // snipping a cat line: delete the cat + all its people
      snippedPeople = people.filter(p => p.relationship?.type === node.category);
      idsToDelete = [node.id, ...snippedPeople.map(p => p.id)];
    } else {
      snippedPeople = people.filter(p => p.id === node.id);
      idsToDelete = [node.id];
    }

    // Animate out
    setDeletingIds(prev => [...prev, ...idsToDelete]);
    // Push to undo stack
    setDeletedHistory(prev => [...prev, { ids: idsToDelete, snippedPeople, node }]);

    // Actually remove after animation (600ms)
    setTimeout(() => {
      setPeople(prev => prev.filter(p => !idsToDelete.includes(p.id)));
      setDeletingIds(prev => prev.filter(id => !idsToDelete.includes(id)));
    }, 600);
  }, [people]);

  const handleUndo = useCallback(() => {
    if (deletedHistory.length === 0) return;
    const last = deletedHistory[deletedHistory.length - 1];
    setPeople(prev => [...prev, ...last.snippedPeople]);
    setDeletedHistory(prev => prev.slice(0, -1));
  }, [deletedHistory]);

  const handlePhotosChange = useCallback((personId, newPhotos) => {
    setPhotosByPerson(prev => ({
      ...prev,
      [personId]: newPhotos
    }));
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!promptText.trim() && attachedNodes.length === 0) return;
    setPromptText('');
    setAttachedNodes([]);
  }, [promptText, attachedNodes]);

  const stageStyle = zoomTarget
    ? { transformOrigin: `${zoomTarget.x}px ${zoomTarget.y}px` }
    : undefined;

  const showModal = cinematicState !== 'idle' && selectedPerson;

  return (
    <div className="app">
      <div className={`cosmos-stage ${cinematicState} ${viewMode === 'gallery' ? 'hidden-behind-gallery' : ''}`} style={stageStyle}>
        <StarField />
        <div className="graph-container">
          <ConstellationGraph
            activeFilter={activeFilter}
            focusedCategory={focusedCategory}
            onZoomOut={() => setFocusedCategory(null)}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            activeTool={activeTool}
            onSnip={handleSnip}
            deletingIds={deletingIds}
            people={people}
          />
        </div>
      </div>

      {viewMode === 'gallery' && (
        <MemoryCarousel 
          photos={allPhotos} 
          onClose={() => setViewMode('graph')} 
        />
      )}

      <header className="header">
        <div className="logo">
          <svg className="logo-glyph" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="0.9" opacity="0.85" />
            <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
            <line x1="0.8" y1="7" x2="13.2" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
            <line x1="7" y1="0.8" x2="7" y2="13.2" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
            <circle cx="7" cy="7" r="1" fill="currentColor" />
          </svg>
          <span className="logo-text">Inner Circle</span>
        </div>

        {/* Center Toolbar */}
        <div className="toolbar">
          <button
            className={`tool-btn ${viewMode === 'gallery' ? 'active' : ''}`}
            onClick={() => setViewMode(v => v === 'gallery' ? 'graph' : 'gallery')}
            title="Memory Gallery — view all uploaded photos"
          >
            📸
          </button>
          <div className="toolbar-divider" />
          <button
            className={`tool-btn ${activeTool === 'snip' ? 'active' : ''}`}
            onClick={() => {
              setActiveTool(t => t === 'snip' ? null : 'snip');
              setViewMode('graph'); // exit gallery if entering snip tool
            }}
            title="Snip tool — cut a connection to delete a node"
          >
            ✂️
          </button>
          <button
            className={`tool-btn ${deletedHistory.length === 0 ? 'disabled' : ''}`}
            onClick={handleUndo}
            disabled={deletedHistory.length === 0}
            title="Undo last snip"
          >
            ↩
          </button>
        </div>

        <div className="header-actions">
          <button className="btn-primary" onClick={() => setAddPersonOpen(true)}>+ Add Person</button>
        </div>
      </header>

      <aside className={`sidebar ${viewMode === 'gallery' ? 'hidden' : ''}`}>
        <div className="sidebar-label">EXPLORER</div>
        <div className="sidebar-tree">
          <div className="tree-group">
            <div
              className="tree-item node-cat level-1"
              style={{ background: 'rgba(232, 232, 240, 0.12)', marginBottom: '2px' }}
              onClick={() => setFocusedCategory(null)}
            >
              <span className="filter-dot" style={{ background: '#e8e8f0', marginLeft: '12px' }} />
              You
            </div>
          </div>
          {Object.entries(peopleByCategory).map(([catKey, data]) => {
            const isExpanded = expandedCats.has(catKey);
            if (data.people.length === 0) return null;
            const isCatFocused = focusedCategory === catKey;
            return (
              <div key={catKey} className="tree-group">
                <div
                  className="tree-item node-cat level-1"
                  style={{ background: `${data.color}22`, marginBottom: '2px' }}
                  onClick={() => toggleCat(catKey)}
                >
                  <div className={`chevron ${isExpanded ? 'expanded' : ''}`}>›</div>
                  <span className="filter-dot" style={{ background: data.color }} />
                  <span style={{ flex: 1 }}>{data.label}</span>
                  <div
                    className={`zoom-icon ${isCatFocused ? 'zoom-out' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setFocusedCategory(isCatFocused ? null : catKey); }}
                    title={isCatFocused ? 'Back to Galaxy' : 'Focus Category'}
                  >
                    {isCatFocused ? '🔎' : '🔍'}
                  </div>
                </div>
                {isExpanded && (
                  <div className="tree-children">
                    {data.people.map(person => {
                      const isPersonExpanded = expandedPeople.has(person.id);
                      return (
                        <div key={person.id} className="tree-group">
                          <div
                            className="tree-item node-person level-2"
                            style={{ background: `${data.color}15`, marginBottom: '1px' }}
                            onClick={() => togglePerson(person.id)}
                          >
                            <div className={`chevron ${isPersonExpanded ? 'expanded' : ''}`}>›</div>
                            <span style={{ flex: 1 }}>{person.name}</span>
                            <div
                              className="zoom-icon"
                              onClick={(e) => { e.stopPropagation(); handleNodeClick(person); }}
                              title="View Card"
                            >
                              🔍
                            </div>
                          </div>
                          {isPersonExpanded && (
                            <div className="person-info-panel level-3">
                              {person.birthday && <div>🎉 {person.birthday}</div>}
                              {person.relationship?.strength && (
                                <div>🔥 Strength: {person.relationship.strength}/100</div>
                              )}
                              {person.context?.school && <div>🎓 {person.context.school}</div>}
                              {person.context?.work && <div>💼 {person.context.work}</div>}
                              <div className="open-card-btn" onClick={() => handleNodeClick(person)}>
                                View Full Card ↗
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {focusedCategory && (
        <button className="back-to-galaxy-btn" onClick={() => setFocusedCategory(null)}>
          ← Back to Galaxy
        </button>
      )}

      {cinematicState !== 'idle' && (
        <div className={`bokeh-overlay ${cinematicState}`} />
      )}

      {showModal && (
        <PersonModal
          person={selectedPerson}
          originPoint={zoomTarget}
          phase={cinematicState}
          onClose={closeModal}
          photosByPerson={photosByPerson}
          onPhotosChange={handlePhotosChange}
        />
      )}

      <div className="prompt-area">
        {attachedNodes.length > 0 && (
          <div className="attached-nodes">
            {attachedNodes.map((node) => (
              <span
                key={node.id}
                className="attached-chip"
                style={{ borderColor: CATEGORY_COLORS[node.category] || '#cdc9c0' }}
              >
                <span
                  className="attached-chip-dot"
                  style={{ background: CATEGORY_COLORS[node.category] || '#cdc9c0' }}
                />
                {node.name}
                <button
                  className="attached-chip-remove"
                  onClick={() => removeAttachedNode(node.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <form className="prompt-form" onSubmit={handleSubmit}>
          <input
            className="prompt-input"
            type="text"
            placeholder="Ask about your connections..."
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
          />
          <button
            className="prompt-submit"
            type="submit"
            disabled={!promptText.trim() && attachedNodes.length === 0}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        <div className="prompt-hint">Click a node to view details — double-click to attach as context</div>
      </div>

      <AddPersonModal open={addPersonOpen} onClose={() => setAddPersonOpen(false)} />
    </div>
  );
}

export default App;
