import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import SearchPill from './components/SearchPill/SearchPill';
import CommandPalette from './components/CommandPalette/CommandPalette';
import CategoryLegend from './components/CategoryLegend/CategoryLegend';
import AvatarMenu from './components/AvatarMenu/AvatarMenu';
import CmdKNudge from './components/CmdKNudge/CmdKNudge';
import { useRecentPeople } from './hooks/useRecentPeople';
import { useCommandKey } from './hooks/useCommandKey';
import StarField from './components/Graph/StarField';
import ConstellationGraph, { DEMO_PEOPLE } from './components/Graph/ConstellationGraph';
import PersonModal from './components/PersonModal/PersonModal';
import AddPersonModal from './components/AddPersonModal/AddPersonModal';
import MemoryCarousel from './components/MemoryCarousel/MemoryCarousel';
import Landing from './components/Landing/Landing';
import GmailDraftEditor from './components/GmailDraftEditor/GmailDraftEditor';
import CalendarEventCard from './components/CalendarEventCard/CalendarEventCard';
import { useAuth } from './contexts/AuthContext';
import { usePeople } from './hooks/usePeople';
import { usePhotos } from './hooks/usePhotos';
import { scorePerson } from './services/scoring';
import ChatModal from './components/Chat/ChatModal';
import { useChatHistory } from './hooks/useChatHistory';
import './App.css';
import './components/Chat/Chat.css';

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
  const [view, setView] = useState('landing');
  const [landingExiting, setLandingExiting] = useState(false);
  const landingExitTimerRef = useRef(null);
  const panRef = useRef({ x: 0, y: 0 });

  const handleEnterFromLanding = useCallback(() => {
    setView('app');
    setLandingExiting(true);
    clearTimeout(landingExitTimerRef.current);
    landingExitTimerRef.current = setTimeout(() => setLandingExiting(false), 1800);
  }, []);
  const { user, loading: authLoading, signOut } = useAuth();
  const { people, setPeople, addPerson, updatePerson, removePeople, restorePeople } = usePeople();
  const { photosByPerson, setPhotosForPerson } = usePhotos();


  const [activeFilters, setActiveFilters] = useState(() => new Set());
  const [attachedNodes, setAttachedNodes] = useState([]);
  const [promptText, setPromptText] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [zoomTarget, setZoomTarget] = useState(null);
  const [focusedCategory, setFocusedCategory] = useState(null);
  const [activeTool, setActiveTool] = useState(null); // null | 'snip'
  const [deletingIds, setDeletingIds] = useState([]); // ids being animated out
  const [deletedHistory, setDeletedHistory] = useState([]); // undo stack: [{type:'person'|'category', ids:[]}]
  const [showDemo, setShowDemo] = useState(false); // testing: show demo people without persisting
  const promptInputRef = useRef(null);
  const [autoExpanded, setAutoExpanded] = useState(false);
  const [interactionTick, setInteractionTick] = useState(0);
  const [autoCycles, setAutoCycles] = useState(0);
  const bumpInteraction = useCallback(() => {
    setInteractionTick((t) => t + 1);
    setAutoExpanded(false);
  }, []);
  const isPromptExpanded = promptText.length > 0 || attachedNodes.length > 0 || autoExpanded;

  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatInitialThread, setChatInitialThread] = useState(null);
  const [chatInitialPrompt, setChatInitialPrompt] = useState('');
  const [chatInitialAttachedIds, setChatInitialAttachedIds] = useState([]);
  const [activeDraft, setActiveDraft] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const { addThread: addChatThread } = useChatHistory();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const { recentIds, recordOpen } = useRecentPeople();

  const openPalette = useCallback(() => {
    if (selectedPerson) return;       // disallow during person modal
    if (landingExiting) return;       // disallow during cinematic transition
    setPaletteOpen(true);
  }, [selectedPerson, landingExiting]);

  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useCommandKey(openPalette, { enabled: !selectedPerson && !landingExiting });

  const handleChatAction = useCallback((payload) => {
    if (payload?.kind === 'email') setActiveDraft(payload);
    else if (payload?.kind === 'calendar') setActiveEvent(payload);
  }, []);

  const displayPeople = useMemo(() => (
    showDemo ? [...people, ...DEMO_PEOPLE.map(p => ({ ...p, isDemo: true }))] : people
  ), [people, showDemo]);

  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'gallery'
  const [modalPhase, setModalPhase] = useState(null); // null | 'zooming-in' | 'open' | 'zooming-out'
  const modalTimerRef = useRef(null);

  const allPhotos = useMemo(() => {
    const photos = [];
    Object.entries(photosByPerson).forEach(([personId, pList]) => {
      const person = displayPeople.find(p => p.id === personId);
      if (person) {
        pList.forEach(photo => photos.push({ ...photo, personName: person.name }));
      }
    });
    // Sort by upload date, newest first
    return photos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }, [photosByPerson, displayPeople]);

  const countsByCategory = useMemo(() => {
    const counts = {};
    displayPeople.forEach((p) => {
      const k = p.relationship?.type ?? 'other';
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return counts;
  }, [displayPeople]);

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

  const handlePaletteSelect = useCallback((person) => {
    setPaletteOpen(false);
    // Pass null screenPos — zoom origin defaults to viewport center.
    handleNodeClick(person, null);
  }, [handleNodeClick]);

  const handleNodeDoubleClick = useCallback((node) => {
    bumpInteraction();
    if (node.isCategory) return;
    setAttachedNodes((prev) => {
      if (prev.some((n) => n.id === node.id)) return prev;
      return [...prev, node];
    });
  }, [bumpInteraction]);

  const toggleBranchHighlight = useCallback((catKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(catKey)) next.delete(catKey);
      else next.add(catKey);
      return next;
    });
  }, []);

  const closeModal = useCallback(() => {
    clearTimeout(modalTimerRef.current);
    setModalPhase('zooming-out');
    modalTimerRef.current = setTimeout(() => {
      setSelectedPerson(null);
      setModalPhase(null);
      setZoomTarget(null);
    }, 240);
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
      snippedPeople = displayPeople.filter(p => p.relationship?.type === node.category);
      idsToDelete = [node.id, ...snippedPeople.map(p => p.id)];
    } else {
      snippedPeople = displayPeople.filter(p => p.id === node.id);
      idsToDelete = [node.id];
    }

    // Animate out
    setDeletingIds(prev => [...prev, ...idsToDelete]);
    // Push to undo stack (only persist real, non-demo people for restore)
    const realSnipped = snippedPeople.filter(p => !p.isDemo);
    setDeletedHistory(prev => [...prev, { ids: idsToDelete, snippedPeople: realSnipped, node }]);

    // Actually remove after animation (600ms) — demo people are visual-only, skip Firestore
    setTimeout(() => {
      removePeople(realSnipped.map((p) => p.id));
      setDeletingIds(prev => prev.filter(id => !idsToDelete.includes(id)));
    }, 600);
  }, [displayPeople, removePeople]);

  const handleUndo = useCallback(() => {
    if (deletedHistory.length === 0) return;
    const last = deletedHistory[deletedHistory.length - 1];
    restorePeople(last.snippedPeople);
    setDeletedHistory(prev => prev.slice(0, -1));
  }, [deletedHistory, restorePeople]);

  const handlePhotosChange = useCallback((personId, newPhotos) => {
    setPhotosForPerson(personId, newPhotos);
  }, [setPhotosForPerson]);

  const handlePersonUpdate = useCallback((updatedPerson) => {
    if (!updatedPerson.isDemo) updatePerson(updatedPerson);
    setSelectedPerson(updatedPerson);
    // Edits change the relationship signal, so rescore. README §AI Workflow point 5.
    scoreAndPatch(updatedPerson);
  // scoreAndPatch is a stable useCallback — safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark a person as scoring-pending, run the AI pipeline, then patch the
  // result back. Used by both onAdd (initial) and the sidebar Retry button.
  const scoreAndPatch = useCallback((person) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === person.id ? { ...p, scoring: { status: 'pending' } } : p)),
    );
    scorePerson(person)
      .then((scoring) => {
        const patched = {
          ...person,
          scoring,
          relationship: { ...(person.relationship || {}), strength: scoring.aggregate },
          updated_at: scoring.scored_at,
        };
        setPeople((prev) => prev.map((p) => (p.id === person.id ? { ...p, ...patched } : p)));
        updatePerson(patched);
      })
      .catch((err) => {
        console.error('Scoring failed for', person.name, err);
        setPeople((prev) =>
          prev.map((p) =>
            p.id === person.id
              ? { ...p, scoring: { status: 'failed', error: err.message } }
              : p,
          ),
        );
      });
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!promptText.trim() && attachedNodes.length === 0) return;
    setChatInitialThread(null);
    setChatInitialPrompt(promptText);
    setChatInitialAttachedIds(attachedNodes.map((n) => n.id));
    setChatModalOpen(true);
    setPromptText('');
    setAttachedNodes([]);
  }, [promptText, attachedNodes]);

  const stageStyle = zoomTarget
    ? { transformOrigin: `${zoomTarget.x}px ${zoomTarget.y}px` }
    : undefined;

  const isFirstExperience = people.length === 0 && !showDemo;

  useEffect(() => {
    if (isPromptExpanded) {
      promptInputRef.current?.focus();
    }
  }, [isPromptExpanded]);

  // Auto-expand the typing bar after 6.7s of no node interaction — first cycle only.
  useEffect(() => {
    if (isFirstExperience || autoCycles > 0) return;
    if (promptText.length > 0 || attachedNodes.length > 0 || autoExpanded) return;
    const t = setTimeout(() => setAutoExpanded(true), 6700);
    return () => clearTimeout(t);
  }, [interactionTick, promptText, attachedNodes, autoExpanded, isFirstExperience, autoCycles]);

  // Auto-collapse 6.7s after auto-expanding if no typing happened.
  useEffect(() => {
    if (!autoExpanded) return;
    if (promptText.length > 0 || attachedNodes.length > 0) return;
    const t = setTimeout(() => {
      setAutoExpanded(false);
      setAutoCycles((c) => c + 1);
    }, 6700);
    return () => clearTimeout(t);
  }, [autoExpanded, promptText, attachedNodes]);

  useEffect(() => {
    if (isFirstExperience || isPromptExpanded) return;
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const t = e.target;
      const tag = (t?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
      e.preventDefault();
      setPromptText(e.key);
      requestAnimationFrame(() => promptInputRef.current?.focus());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFirstExperience, isPromptExpanded]);
  const showModal = !!selectedPerson || modalPhase === 'zooming-out';
  // Pull the latest copy from `people` so async scoring updates flow into an
  // already-open modal. Falls back to the snapshot for the zooming-out frame.
  const livePerson = selectedPerson
    ? people.find((p) => p.id === selectedPerson.id) ?? selectedPerson
    : null;

  if (authLoading) return <div className="app" style={{ background: '#0a0a0f' }} />;

  return (
    <>
    {(view === 'landing' || landingExiting) && (
      <Landing user={user} onEnter={handleEnterFromLanding} />
    )}
    {view === 'app' && (
    <div className="app">
      <div className={`cosmos-stage ${showModal ? 'modal-open' : ''} ${viewMode === 'gallery' ? 'hidden-behind-gallery' : ''}`} style={stageStyle}>
        <StarField panRef={panRef} />
        <div className="graph-container">
          <ConstellationGraph
            panRef={panRef}
            activeFilters={activeFilters}
            focusedCategory={focusedCategory}
            onZoomOut={() => setFocusedCategory(null)}
            onZoomIn={(cat) => setFocusedCategory(cat)}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            activeTool={activeTool}
            onSnip={handleSnip}
            deletingIds={deletingIds}
            people={displayPeople}
            isFirstExperience={isFirstExperience}
            userName={(user?.displayName || user?.email?.split('@')[0] || '').split(' ')[0]}
            onCenterClick={() => setAddPersonOpen(true)}
          />
        </div>
      </div>

      {viewMode === 'gallery' && (
        <MemoryCarousel 
          photos={allPhotos} 
          onClose={() => setViewMode('graph')} 
        />
      )}

      {!isFirstExperience && <header className="header">
        <div className="header-slot header-slot-left">
          <SearchPill onClick={openPalette} disabled={!!selectedPerson} />
        </div>

        {/* Center Toolbar */}
        <div className="toolbar">
          <button
            className={`tool-btn ${viewMode === 'gallery' ? 'active' : ''}`}
            onClick={() => setViewMode(v => v === 'gallery' ? 'graph' : 'gallery')}
            title="Memory Gallery — view all uploaded photos"
          >
            <svg className="tool-icon" width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 5.5h2.2l1.1-1.6h4.4l1.1 1.6h2.2a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5V7a1.5 1.5 0 0 1 1.5-1.5z" />
              <circle cx="8" cy="10" r="2.8" />
            </svg>
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
            <svg className="tool-icon" width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="4" cy="13" r="2.2" />
              <circle cx="14" cy="13" r="2.2" />
              <line x1="5.6" y1="11.4" x2="15.5" y2="2.5" />
              <line x1="12.4" y1="11.4" x2="2.5" y2="2.5" />
              <line x1="9" y1="9" x2="11" y2="7" />
            </svg>
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

        <div className="header-slot header-slot-right">
          <AvatarMenu
            email={user?.email}
            demoOn={showDemo}
            onToggleDemo={() => setShowDemo((v) => !v)}
            onSignOut={async () => { await signOut(); window.location.reload(); }}
          />
        </div>
      </header>}

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

      {isFirstExperience && (
        <button
          className={`demo-toggle ${showDemo ? 'active' : ''}`}
          onClick={() => setShowDemo(s => !s)}
          title={showDemo ? 'Hide demo people' : 'Show demo people (not saved)'}
        >
          <span className="demo-toggle-dot" />
          {showDemo ? 'Demo on' : 'Demo'}
        </button>
      )}


      {showModal && (
        <PersonModal
          key={selectedPerson?.id}
          person={livePerson}
          originPoint={zoomTarget}
          phase={modalPhase}
          onClose={closeModal}
          photosByPerson={photosByPerson}
          onPhotosChange={handlePhotosChange}
          onUpdatePerson={handlePersonUpdate}
          onRescore={() => livePerson && scoreAndPatch(livePerson)}
        />
      )}

      {!isFirstExperience && <div className={`prompt-area ${isPromptExpanded ? 'is-expanded' : ''}`}>
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
        <div className="prompt-switcher">
          <button
            className="prompt-add-button"
            onClick={() => setAddPersonOpen(true)}
            aria-label="Add person"
            tabIndex={isPromptExpanded ? -1 : 0}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Add Person</span>
          </button>
          <form className="prompt-form" onSubmit={handleSubmit}>
            <input
              ref={promptInputRef}
              className="prompt-input"
              type="text"
              placeholder="Ask about your connections..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              tabIndex={isPromptExpanded ? 0 : -1}
            />
            <button
              className="prompt-submit"
              type="submit"
              disabled={!promptText.trim() && attachedNodes.length === 0}
              tabIndex={isPromptExpanded ? 0 : -1}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
        <div className="prompt-hint">Click a node to view details — double-click to attach as context</div>
      </div>}

      <ChatModal
        open={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        people={displayPeople}
        initialThread={chatInitialThread}
        initialPrompt={chatInitialPrompt}
        initialAttachedNodeIds={chatInitialAttachedIds}
        addThread={addChatThread}
        onAction={handleChatAction}
      />
      {activeDraft && (
        <GmailDraftEditor
          draft={activeDraft}
          onClose={() => setActiveDraft(null)}
        />
      )}
      {activeEvent && (
        <CalendarEventCard
          event={activeEvent}
          onClose={() => setActiveEvent(null)}
        />
      )}
      <AddPersonModal
        open={addPersonOpen}
        onClose={() => setAddPersonOpen(false)}
        onAdd={(person) => {
          // Optimistic local insert (renderer treats unscored nodes as
          // neutral grey) + Firestore persist. The AI pipeline runs async
          // via scoreAndPatch and fills in the score; updatePerson there
          // persists the score back to Firestore.
          const pending = { ...person, scoring: { status: 'pending' } };
          setPeople((prev) => [...prev, pending]);
          addPerson(pending);
          scoreAndPatch(person);
        }}
      />
    </div>
    )}
    </>
  );
}

export default App;
