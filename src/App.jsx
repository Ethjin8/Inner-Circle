import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import StarField from './components/Graph/StarField';
import ConstellationGraph, { DEMO_PEOPLE } from './components/Graph/ConstellationGraph';
import PersonModal from './components/PersonModal/PersonModal';
import AddPersonModal from './components/AddPersonModal/AddPersonModal';
import MemoryCarousel from './components/MemoryCarousel/MemoryCarousel';
import Landing from './components/Landing/Landing';
import SignIn from './components/SignIn/SignIn';
import GmailDraftEditor from './components/GmailDraftEditor/GmailDraftEditor';
import CalendarEventCard from './components/CalendarEventCard/CalendarEventCard';
import { useAuth } from './contexts/AuthContext';
import { usePeople } from './hooks/usePeople';
import { usePhotos } from './hooks/usePhotos';
import { scorePerson } from './services/scoring';
import ChatModal from './components/Chat/ChatModal';
import ChatHistory from './components/Chat/ChatHistory';
import { useChatHistory } from './hooks/useChatHistory';
import './App.css';
import './components/Chat/Chat.css';

function ScrollFadePicker({ children, activeIndex }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((p) => (p.top === top && p.bottom === bottom) ? p : { top, bottom });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [update, children]);
  useEffect(() => {
    const el = ref.current;
    if (!el || activeIndex == null) return;
    const item = el.children[activeIndex];
    if (item && item.scrollIntoView) item.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);
  const cls = `mention-picker${edges.top ? ' fade-top' : ''}${edges.bottom ? ' fade-bottom' : ''}`;
  return (
    <div className={cls}>
      <div className="mention-picker-list" role="listbox" ref={ref}>
        {children}
      </div>
    </div>
  );
}

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
  family: '#f5a25b',
  friend: '#f3d24d',
  coworker: '#5fd496',
  classmate: '#7ea8ff',
  mentor: '#a884ff',
  romantic: '#f9a3c0',
  professional: '#f06d6d',
  other: '#bdc1c6',
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
  const [addPersonInitialMode, setAddPersonInitialMode] = useState('voice');
  const [zoomTarget, setZoomTarget] = useState(null);
  const [focusedCategory, setFocusedCategory] = useState(null);
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [expandedPeople, setExpandedPeople] = useState(new Set());
  const [activeTool, setActiveTool] = useState(null); // null | 'snip'
  const [deletingIds, setDeletingIds] = useState([]); // ids being animated out
  const [deletedHistory, setDeletedHistory] = useState([]); // undo stack: [{type:'person'|'category', ids:[]}]
  const [searchQuery, setSearchQuery] = useState('');
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [pastChatsOpen, setPastChatsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [demoPeople, setDemoPeople] = useState(DEMO_PEOPLE.map(p => ({ ...p, isDemo: true })));
  const promptInputRef = useRef(null);
  const [mentionRange, setMentionRange] = useState(null); // { start, query } | null
  const [mentionIndex, setMentionIndex] = useState(0);
  const [slashRange, setSlashRange] = useState(null); // { query } | null
  const [slashIndex, setSlashIndex] = useState(0);
  const [autoExpanded, setAutoExpanded] = useState(false);
  const [interactionTick, setInteractionTick] = useState(0);
  const [autoCycles, setAutoCycles] = useState(0);
  const bumpInteraction = useCallback(() => {
    setInteractionTick((t) => t + 1);
    setAutoExpanded(false);
  }, []);
  const isPromptExpanded = true;

  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatInitialThread, setChatInitialThread] = useState(null);
  const [chatInitialPrompt, setChatInitialPrompt] = useState('');
  const [chatInitialAttachedIds, setChatInitialAttachedIds] = useState([]);
  const [activeDraft, setActiveDraft] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const { threads: chatThreads, addThread: addChatThread, deleteThread: deleteChatThread } = useChatHistory();

  const handleChatAction = useCallback((payload) => {
    if (payload?.kind === 'email') setActiveDraft(payload);
    else if (payload?.kind === 'calendar') setActiveEvent(payload);
  }, []);

  const displayPeople = useMemo(() => (
    showDemo ? [...people, ...demoPeople] : people
  ), [people, demoPeople, showDemo]);

  const NEW_MODE_OPTIONS = useMemo(() => ([
    { id: '__new_audio', name: 'audio', mode: 'voice', desc: 'Voice interview' },
    { id: '__new_text', name: 'text', mode: 'form', desc: 'Fill out the form' },
  ]), []);

  const mentionMatches = useMemo(() => {
    if (!mentionRange) return [];
    const q = mentionRange.query.toLowerCase();
    if (mentionRange.kind === 'newMode') {
      return NEW_MODE_OPTIONS.filter((o) => !q || o.name.startsWith(q));
    }
    const filtered = displayPeople.filter((p) => {
      if (!p?.name) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
    const score = (p) => p.relationship?.strength ?? p.scoring?.aggregate ?? 0;
    const sorted = filtered
      .sort((a, b) => {
        const an = a.name.toLowerCase();
        const bn = b.name.toLowerCase();
        if (q) {
          const aStarts = an.startsWith(q) ? 0 : 1;
          const bStarts = bn.startsWith(q) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
        }
        return score(b) - score(a);
      });
    if (mentionRange.kind === 'deletePerson') {
      const everyoneMatches = !q || 'everyone'.startsWith(q);
      if (everyoneMatches) {
        return [{ id: '__everyone__', name: 'everyone', isEveryone: true }, ...sorted];
      }
    }
    return sorted;
  }, [mentionRange, displayPeople, NEW_MODE_OPTIONS]);

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

  const peopleByCategory = useMemo(() => {
    const map = {};
    FILTERS.forEach(f => { if (f.key) map[f.key] = { label: f.label, color: f.color, people: [] }; });
    const q = searchQuery.trim().toLowerCase();
    displayPeople.forEach(p => {
      if (q && !p.name.toLowerCase().includes(q)) return;
      const c = p.relationship?.type;
      if (c && map[c]) map[c].people.push(p);
    });
    return map;
  }, [displayPeople, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

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
  }, [bumpInteraction]);

  const handleNodeDoubleClick = useCallback((node) => {
    bumpInteraction();
    if (node.isCategory) return;
    setAttachedNodes((prev) => {
      if (prev.some((n) => n.id === node.id)) return prev;
      return [...prev, node];
    });
    setPromptText((prev) => {
      const needsSpace = prev.length > 0 && !/\s$/.test(prev);
      return `${prev}${needsSpace ? ' ' : ''}@${node.name} `;
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

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key !== 'z' && e.key !== 'Z') return;
      if (e.shiftKey) return;
      const t = e.target;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      e.preventDefault();
      handleUndo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo]);

  const handlePhotosChange = useCallback((personId, newPhotos) => {
    setPhotosForPerson(personId, newPhotos);
  }, [setPhotosForPerson]);

  // Mark a person as scoring-pending, run the AI pipeline, then patch the
  // result back. Used by both onAdd (initial) and the sidebar Retry button.
  // NOTE: must be declared BEFORE handlePersonUpdate, which lists it in deps.
  const scoreAndPatch = useCallback((person) => {
    const setList = person.isDemo ? setDemoPeople : setPeople;
    setList((prev) =>
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
        setList((prev) => prev.map((p) => (p.id === person.id ? { ...p, ...patched } : p)));
        if (!person.isDemo) {
          updatePerson(patched).catch((err) =>
            console.error('Persist score failed for', person.name, err),
          );
        }
      })
      .catch((err) => {
        console.error('Scoring failed for', person.name, err);
        setList((prev) =>
          prev.map((p) =>
            p.id === person.id
              ? { ...p, scoring: { status: 'failed', error: err.message } }
              : p,
          ),
        );
      });
  }, [updatePerson]);

  const handlePersonUpdate = useCallback(async (updatedPerson) => {
    if (updatedPerson.isDemo) {
      setDemoPeople(prev => prev.map(p => p.id === updatedPerson.id ? updatedPerson : p));
    } else {
      try {
        await updatePerson(updatedPerson);
      } catch (err) {
        console.error('[updatePerson] Firestore rejected the write:', err);
        throw err;
      }
    }
    setSelectedPerson(updatedPerson);
    scoreAndPatch(updatedPerson);
  }, [updatePerson, scoreAndPatch]);

  const SLASH_COMMANDS = useMemo(() => ([
    { name: 'new', desc: 'Add a new connection' },
    { name: 'delete', desc: 'Remove @mentioned people' },
  ]), []);

  const slashMatches = useMemo(() => {
    if (!slashRange) return [];
    const q = slashRange.query.toLowerCase();
    return SLASH_COMMANDS.filter((c) => !q || c.name.startsWith(q));
  }, [slashRange, SLASH_COMMANDS]);

  const detectSlash = (value, caret) => {
    if (caret !== value.length) return null;
    const m = /^\/([a-z]*)$/i.exec(value);
    if (!m) return null;
    return { query: m[1] };
  };

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightTokens = useMemo(() => {
    if (!promptText) return null;
    if (!attachedNodes.length) return promptText;
    const sorted = [...attachedNodes].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
    const pattern = sorted.map((n) => escapeRegex(n.name)).join('|');
    if (!pattern) return promptText;
    const re = new RegExp(`(?:^|\\s)@(${pattern})(?=\\s|$)`, 'g');
    const parts = [];
    let last = 0;
    let m;
    while ((m = re.exec(promptText)) !== null) {
      const at = m.index + (m[0].length - m[1].length - 1);
      if (at > last) parts.push(promptText.slice(last, at));
      const node = sorted.find((n) => n.name === m[1]);
      const color = CATEGORY_COLORS[node?.relationship?.type] || '#cdc9c0';
      parts.push(<span key={parts.length} style={{ color }}>{`@${m[1]}`}</span>);
      last = at + 1 + m[1].length;
    }
    if (last < promptText.length) parts.push(promptText.slice(last));
    return parts;
  }, [promptText, attachedNodes]);

  const highlightRef = useRef(null);
  const syncHighlightScroll = useCallback(() => {
    if (highlightRef.current && promptInputRef.current) {
      highlightRef.current.scrollLeft = promptInputRef.current.scrollLeft;
    }
  }, []);
  useEffect(() => { syncHighlightScroll(); }, [promptText, syncHighlightScroll]);

  useEffect(() => {
    setAttachedNodes((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((n) => {
        if (!n?.name) return true;
        const re = new RegExp(`(?:^|\\s)@${escapeRegex(n.name)}(?=\\s|$)`);
        return re.test(promptText);
      });
      return next.length === prev.length ? prev : next;
    });
  }, [promptText]);

  const detectMention = (value, caret) => {
    const before = value.slice(0, caret);
    const m = /(?:^|\s)@([^\s@]*)$/.exec(before);
    if (!m) return null;
    const start = caret - m[1].length - 1;
    const prefix = value.slice(0, start);
    const kind = /^\/new\s+$/i.test(prefix)
      ? 'newMode'
      : (/^\/delete\s+$/i.test(prefix) ? 'deletePerson' : 'person');
    return { start, query: m[1], kind };
  };

  const handlePromptChange = useCallback((e) => {
    const value = e.target.value;
    const caret = e.target.selectionStart ?? value.length;
    setPromptText(value);
    setMentionRange(detectMention(value, caret));
    setMentionIndex(0);
    setSlashRange(detectSlash(value, caret));
    setSlashIndex(0);
  }, []);

  const insertMention = useCallback((item) => {
    if (!mentionRange) return;
    if (mentionRange.kind === 'newMode') {
      setAddPersonInitialMode(item.mode);
      setAddPersonOpen(true);
      setPromptText('');
      setAttachedNodes([]);
      setMentionRange(null);
      setMentionIndex(0);
      return;
    }
    setPromptText((prev) => {
      const before = prev.slice(0, mentionRange.start);
      const after = prev.slice(mentionRange.start + 1 + mentionRange.query.length);
      const inserted = `@${item.name} `;
      const next = before + inserted + after;
      const caret = before.length + inserted.length;
      requestAnimationFrame(() => {
        const el = promptInputRef.current;
        if (el) { el.focus(); el.setSelectionRange(caret, caret); }
      });
      return next;
    });
    if (!item.isEveryone) {
      setAttachedNodes((prev) => prev.some((n) => n.id === item.id) ? prev : [...prev, item]);
    }
    setMentionRange(null);
    setMentionIndex(0);
  }, [mentionRange]);

  const insertSlash = useCallback((cmd) => {
    const opensNewMode = cmd.name === 'new';
    const opensMention = cmd.name === 'delete';
    const next = (opensMention || opensNewMode) ? `/${cmd.name} @` : `/${cmd.name} `;
    setPromptText(next);
    setSlashRange(null);
    setSlashIndex(0);
    if (opensNewMode) {
      setMentionRange({ start: next.length - 1, query: '', kind: 'newMode' });
      setMentionIndex(0);
    } else if (opensMention) {
      setMentionRange({ start: next.length - 1, query: '', kind: 'person' });
      setMentionIndex(0);
    }
    requestAnimationFrame(() => {
      const el = promptInputRef.current;
      if (el) { el.focus(); el.setSelectionRange(next.length, next.length); }
    });
  }, []);

  const handlePromptKeyDown = useCallback((e) => {
    if (slashRange && slashMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % slashMatches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); insertSlash(slashMatches[slashIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setSlashRange(null); return; }
    }
    if (!mentionRange || mentionMatches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionMatches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(mentionMatches[mentionIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMentionRange(null);
    }
  }, [mentionRange, mentionMatches, mentionIndex, insertMention, slashRange, slashMatches, slashIndex, insertSlash]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const trimmed = promptText.trim();
    if (trimmed.startsWith('/')) {
      const [rawCmd] = trimmed.slice(1).split(/\s+/);
      const cmd = rawCmd.toLowerCase();
      if (cmd === 'new') {
        const sub = (trimmed.slice(1).split(/\s+/)[1] || '').replace(/^@/, '').toLowerCase();
        const mode = sub === 'text' ? 'form' : 'voice';
        setAddPersonInitialMode(mode);
        setAddPersonOpen(true);
        setPromptText('');
        setAttachedNodes([]);
        setSlashRange(null);
        return;
      }
      if (cmd === 'delete') {
        const isEveryone = /@everyone\b/i.test(trimmed);
        const targets = isEveryone
          ? displayPeople
          : attachedNodes.filter((n) => !n.isCategory);
        targets.forEach((n) => handleSnip(n));
        setPromptText('');
        setAttachedNodes([]);
        setSlashRange(null);
        return;
      }
    }
    if (!trimmed && attachedNodes.length === 0) return;
    setChatInitialThread(null);
    setChatInitialPrompt(promptText);
    setChatInitialAttachedIds(attachedNodes.map((n) => n.id));
    setChatModalOpen(true);
    setPromptText('');
    setAttachedNodes([]);
  }, [promptText, attachedNodes, handleSnip, displayPeople]);

  const handleOpenThread = useCallback((thread) => {
    setChatInitialThread(thread);
    setChatInitialPrompt('');
    setChatInitialAttachedIds([]);
    setChatModalOpen(true);
  }, []);

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
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setAddPersonOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (isFirstExperience) return;
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const t = e.target;
      const tag = (t?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
      e.preventDefault();
      setPromptText((prev) => prev + e.key);
      requestAnimationFrame(() => promptInputRef.current?.focus());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFirstExperience]);
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
        <div />

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

        <div />
      </header>}

      {!isFirstExperience && <aside className={`sidebar ${viewMode === 'gallery' ? 'hidden' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <svg className="logo-glyph" width="20" height="20" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="0.9" opacity="0.85" />
              <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
              <line x1="0.8" y1="7" x2="13.2" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
              <line x1="7" y1="0.8" x2="7" y2="13.2" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
              <circle cx="7" cy="7" r="1" fill="currentColor" />
            </svg>
            <span className="logo-text collapsible-label">Inner Circle</span>
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="9" y1="4" x2="9" y2="20" />
            </svg>
          </button>
        </div>

        <div className="sidebar-body">
        <button
          type="button"
          className="sidebar-section-header"
          onClick={() => { if (sidebarCollapsed) setSidebarCollapsed(false); setExplorerOpen(o => sidebarCollapsed ? true : !o); }}
          aria-expanded={explorerOpen}
          title="Explorer"
        >
          <svg className="sidebar-section-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          </svg>
          <span className={`chevron collapsible-label ${explorerOpen ? 'expanded' : ''}`}>›</span>
          <span className="collapsible-label">EXPLORER</span>
        </button>
        {!sidebarCollapsed && explorerOpen && (<>
        <div className="sidebar-search">
          <svg className="sidebar-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="sidebar-search-input"
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search nodes"
          />
          {searchQuery && (
            <button
              type="button"
              className="sidebar-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <div className="sidebar-tree">
          {isSearching && Object.values(peopleByCategory).every((d) => d.people.length === 0) && (
            <div className="sidebar-empty">No matches for "{searchQuery}"</div>
          )}
          {Object.entries(peopleByCategory).map(([catKey, data]) => {
            const isExpanded = isSearching || expandedCats.has(catKey);
            if (data.people.length === 0) return null;
            const isBranchActive = activeFilters.has(catKey);
            return (
              <div key={catKey} className="tree-group cat-group">
                <div
                  className="tree-item node-cat level-1"
                  style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                  onClick={() => toggleCat(catKey)}
                >
                  <div className={`chevron ${isExpanded ? 'expanded' : ''}`}>›</div>
                  <span className="filter-dot" style={{ background: data.color }} />
                  <span style={{ flex: 1 }}>{data.label}</span>
                  <button
                    type="button"
                    className={`branch-toggle ${isBranchActive ? 'active' : ''}`}
                    style={{
                      borderColor: data.color,
                      background: isBranchActive ? data.color : 'transparent',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBranchHighlight(catKey);
                    }}
                    title={isBranchActive ? 'Clear highlight' : `Highlight ${data.label}`}
                    aria-pressed={isBranchActive}
                  />
                </div>
                {isExpanded && (
                  <div className="tree-children">
                    {data.people.map(person => {
                      const isPersonExpanded = expandedPeople.has(person.id);
                      return (
                        <div key={person.id} className="tree-group person-group">
                          <div
                            className="tree-item node-person level-2"
                            style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                            onClick={() => togglePerson(person.id)}
                          >
                            <div className={`chevron ${isPersonExpanded ? 'expanded' : ''}`}>›</div>
                            <span style={{ flex: 1 }}>{person.name}</span>
                          </div>
                          {isPersonExpanded && (
                            <div className="person-info-panel level-3">
                              {person.birthday && <div>🎉 {person.birthday}</div>}
                              <div>
                                🔥 Strength:{' '}
                                {person.scoring?.status === 'pending' ? (
                                  <span className="scoring-pending">scoring…</span>
                                ) : person.relationship?.strength != null ? (
                                  <>
                                    {person.relationship.strength}/100
                                    {person.scoring?.variance === 'high' && (
                                      <span className="scoring-uncertain" title="High variance across samples"> · uncertain</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="scoring-pending">—</span>
                                )}
                              </div>
                              {person.scoring?.status === 'failed' && (
                                <div className="scoring-failed">
                                  ⚠ Scoring failed
                                  <button
                                    type="button"
                                    className="scoring-retry"
                                    onClick={(e) => { e.stopPropagation(); scoreAndPatch(person); }}
                                  >
                                    Retry
                                  </button>
                                </div>
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
        </>)}
        <button
          type="button"
          className="sidebar-section-header"
          onClick={() => { if (sidebarCollapsed) setSidebarCollapsed(false); setPastChatsOpen(o => sidebarCollapsed ? true : !o); }}
          aria-expanded={pastChatsOpen}
          title="Past chats"
        >
          <svg className="sidebar-section-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className={`chevron collapsible-label ${pastChatsOpen ? 'expanded' : ''}`}>›</span>
          <span className="collapsible-label">PAST CHATS</span>
          {chatThreads.length > 0 && <span className="sidebar-section-count collapsible-label">{chatThreads.length}</span>}
        </button>
        {!sidebarCollapsed && pastChatsOpen && (
          <ChatHistory
            threads={chatThreads}
            onOpenThread={handleOpenThread}
            onDeleteThread={deleteChatThread}
          />
        )}
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className={`sidebar-signout demo-row ${showDemo ? 'active' : ''}`}
            onClick={() => setShowDemo(s => !s)}
            title={showDemo ? 'Hide demo people' : 'Show demo people (not saved)'}
            aria-pressed={showDemo}
          >
            <span className="demo-toggle-dot" />
            <span className="collapsible-label">{showDemo ? 'Demo on' : 'Demo'}</span>
          </button>
          <button
            type="button"
            className="sidebar-signout"
            onClick={async () => { await signOut(); window.location.reload(); }}
            title={user?.email || 'Sign out'}
            aria-label="Sign out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="collapsible-label">Sign out</span>
          </button>
        </div>
      </aside>}

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
                style={{ borderColor: CATEGORY_COLORS[node.relationship?.type] || '#cdc9c0' }}
              >
                <span
                  className="attached-chip-dot"
                  style={{ background: CATEGORY_COLORS[node.relationship?.type] || '#cdc9c0' }}
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
            title="Add person"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <form className="prompt-form" onSubmit={handleSubmit}>
            {slashRange && slashMatches.length > 0 && (
              <ScrollFadePicker activeIndex={slashIndex}>
                {slashMatches.map((c, i) => (
                  <button
                    type="button"
                    key={c.name}
                    role="option"
                    aria-selected={i === slashIndex}
                    className={`mention-item ${i === slashIndex ? 'is-active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); insertSlash(c); }}
                    onMouseEnter={() => setSlashIndex(i)}
                  >
                    <span className="mention-name">/{c.name}</span>
                    <span className="mention-meta">{c.desc}</span>
                  </button>
                ))}
              </ScrollFadePicker>
            )}
            {mentionRange && mentionMatches.length > 0 && (
              <ScrollFadePicker activeIndex={mentionIndex}>
                {mentionMatches.map((p, i) => {
                  const isNewMode = mentionRange?.kind === 'newMode';
                  return (
                  <button
                    type="button"
                    key={p.id}
                    role="option"
                    aria-selected={i === mentionIndex}
                    className={`mention-item ${i === mentionIndex ? 'is-active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(p); }}
                    onMouseEnter={() => setMentionIndex(i)}
                  >
                    <span
                      className="mention-dot"
                      style={{ background: isNewMode ? '#cdc9c0' : (CATEGORY_COLORS[p.relationship?.type] || '#cdc9c0') }}
                    />
                    <span className="mention-name">{p.name}</span>
                    {isNewMode ? (
                      <span className="mention-meta">{p.desc}</span>
                    ) : p.relationship?.type && (
                      <span className="mention-meta">{p.relationship.type}</span>
                    )}
                  </button>
                  );
                })}
              </ScrollFadePicker>
            )}
            <div className="prompt-input-wrap">
              <div className="prompt-highlight" ref={highlightRef} aria-hidden="true">
                {highlightTokens}
              </div>
              <input
                ref={promptInputRef}
                className="prompt-input"
                type="text"
                placeholder="Ask about your connections..."
                value={promptText}
                onChange={handlePromptChange}
                onKeyDown={handlePromptKeyDown}
                onScroll={syncHighlightScroll}
                onSelect={(e) => {
                  const v = e.target.value;
                  const caret = e.target.selectionStart ?? v.length;
                  setMentionRange(detectMention(v, caret));
                  syncHighlightScroll();
                }}
                onBlur={() => setTimeout(() => { setMentionRange(null); setSlashRange(null); }, 120)}
                tabIndex={isPromptExpanded ? 0 : -1}
              />
            </div>
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
        initialMode={addPersonInitialMode}
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
