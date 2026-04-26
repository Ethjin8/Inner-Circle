import { useEffect, useState, useRef, useCallback } from 'react';
import { Camera, X, Gift } from 'lucide-react';
import './PersonModal.css';
import CloudinaryUpload from '../CloudinaryUpload/CloudinaryUpload';
import {
  RELATIONSHIP_TYPES,
  TENURE_OPTIONS,
  FREQUENCY_OPTIONS,
  LAST_INTERACTION_OPTIONS,
  CHANNEL_OPTIONS,
  SUPPORT_OPTIONS,
  KNOWS_OPTIONS,
} from '../../constants/personSchema';

const REL_BY_KEY = Object.fromEntries(RELATIONSHIP_TYPES.map((r) => [r.key, r]));
const OTHER_REL  = REL_BY_KEY.other;
const labelOf = (options, key) => options.find((o) => o.key === key)?.label ?? null;

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const PROFILE_PIC_WIDGET_STYLES = {
  palette: {
    window: '#0e0e0e', windowBorder: 'rgba(255,255,255,0.10)',
    tabIcon: '#e8e8f0', inactiveTabIcon: '#55556a', menuIcons: '#8a8a9a',
    textLight: '#e8e8f0', textDark: '#0e0e0e',
    link: '#7df9ff', action: '#7df9ff', inProgress: '#7df9ff',
    complete: '#5fd496', error: '#f06d6d', sourceBg: '#0e0e0e',
  },
  fonts: {
    default: null,
    "'Geist', sans-serif": {
      url: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap',
      active: true,
    },
  },
};

const CATEGORY_COLORS = {
  family: '#e8b06b',
  friend: '#ffce5c',
  classmate: '#b9d0ff',
  coworker: '#9be6c4',
  professional: '#ff9c5a',
  romantic: '#ffc8d6',
  mentor: '#7df9ff',
  other: '#cdc9c0',
};

const CATEGORY_LABELS = {
  family: 'Family',
  friend: 'Friend',
  classmate: 'School',
  coworker: 'Work',
  professional: 'Professional',
  romantic: 'Romantic',
  mentor: 'Mentor',
  other: 'Other',
};

const DIMENSION_LABELS = {
  depth_of_knowledge:     'Depth of knowledge',
  emotional_intimacy:     'Emotional intimacy',
  recency_frequency:      'Recency / frequency',
  shared_history_density: 'Shared history',
  reciprocity:            'Reciprocity',
};
const DIMENSION_ORDER = [
  'depth_of_knowledge',
  'emotional_intimacy',
  'recency_frequency',
  'shared_history_density',
  'reciprocity',
];

// Buckets per design-system.md §11 (graph edges): strong >70, mid 30-70, weak <30.
function strengthRingColor(s) {
  if (s > 70) return 'rgb(var(--strength-strong, 120, 220, 170))';
  if (s >= 30) return 'rgb(var(--strength-mid,    240, 210, 110))';
  return 'rgb(var(--strength-weak,   220, 130, 130))';
}

function formatLastContact(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBirthday(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function Field({ label, value }) {
  return (
    <div className="pm-field">
      <div className="pm-field-label">{label}</div>
      <div className="pm-field-value">{value}</div>
    </div>
  );
}

function Pills({ label, items }) {
  return (
    <div className="pm-field">
      <div className="pm-field-label">{label}</div>
      <div className="pm-pills">
        {items.map((it, i) => <span key={i} className="pm-pill">{it}</span>)}
      </div>
    </div>
  );
}

function parseList(text) {
  return (text || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(items) {
  return Array.isArray(items) ? items.join('\n') : '';
}

function toDraft(person) {
  const rel = person.relationship ?? {};
  return {
    name: person.name || '',
    birthday: person.birthday || '',
    relationshipType: rel.type || 'other',
    notes: person.notes || '',
    // Connection (7 structured fields — schema v2)
    tenure:           rel.tenure              || '',
    frequency:        rel.frequency           || '',
    lastInteraction:  rel.last_interaction    || '',
    channels:         Array.isArray(rel.channels) ? [...rel.channels] : [],
    theyShowUpForMe:  rel.they_show_up_for_me || '',
    iShowUpForThem:   rel.i_show_up_for_them  || '',
    knowsAboutMe:     rel.knows_about_me      || '',
    // Context + history
    howWeMet:         person.context?.how_we_met || '',
    school:           person.context?.school || '',
    work:             person.context?.work || '',
    hobbies:          listToText(person.context?.hobbies),
    sports:           listToText(person.context?.sports),
    favoriteFoods:    listToText(person.context?.favorites?.foods),
    favoriteMusic:    listToText(person.context?.favorites?.music),
    memoriesTogether: listToText(person.history?.memories_together),
    importantEvents:  listToText(person.history?.important_events),
    forwardTo:        listToText(person.history?.things_to_look_forward_to),
  };
}

function fromDraft(person, draft) {
  const hobbies = parseList(draft.hobbies);
  const sports = parseList(draft.sports);
  const favoriteFoods = parseList(draft.favoriteFoods);
  const favoriteMusic = parseList(draft.favoriteMusic);
  const memoriesTogether = parseList(draft.memoriesTogether);
  const importantEvents = parseList(draft.importantEvents);
  const forwardTo = parseList(draft.forwardTo);

  return {
    ...person,
    name: draft.name.trim() || person.name,
    birthday: draft.birthday || null,
    notes: draft.notes.trim() || null,
    relationship: {
      ...(person.relationship || {}),
      type: draft.relationshipType || 'other',
      tenure:              draft.tenure              || null,
      frequency:           draft.frequency           || null,
      last_interaction:    draft.lastInteraction     || null,
      channels:            Array.isArray(draft.channels) ? draft.channels : [],
      they_show_up_for_me: draft.theyShowUpForMe     || null,
      i_show_up_for_them:  draft.iShowUpForThem      || null,
      knows_about_me:      draft.knowsAboutMe        || null,
    },
    context: {
      ...(person.context || {}),
      how_we_met: draft.howWeMet.trim() || null,
      school: draft.school.trim() || null,
      work: draft.work.trim() || null,
      hobbies,
      sports,
      favorites: {
        ...((person.context || {}).favorites || {}),
        foods: favoriteFoods,
        music: favoriteMusic,
      },
    },
    history: {
      ...(person.history || {}),
      memories_together: memoriesTogether,
      important_events: importantEvents,
      things_to_look_forward_to: forwardTo,
    },
    nudgeStatus: person.nudgeStatus || null,
  };
}

export default function PersonModal({ person, originPoint, phase, onClose, photosByPerson = {}, onPhotosChange, onUpdatePerson, onRescore }) {
  const [activeTab, setActiveTab] = useState('info');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(person));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showNudgePrompt, setShowNudgePrompt] = useState(false);
  const [daysAgo, setDaysAgo] = useState('');

  const startEdit = () => {
    setSaveError(null);
    setDraft(toDraft(person));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setSaveError(null);
    setDraft(toDraft(person));
    setIsEditing(false);
  };

  const saveEdit = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = fromDraft(person, draft || {});
      await onUpdatePerson?.(updated);
      setDraft(toDraft(updated));
      setIsEditing(false);
    } catch (err) {
      setSaveError(err?.message || 'Could not save — please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!person) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [person, onClose]);

  // Profile pic upload — Cloudinary widget, single image
  const profileWidgetRef = useRef(null);
  const personRef = useRef(person);
  useEffect(() => { personRef.current = person; }, [person]);
  const onUpdatePersonRef = useRef(onUpdatePerson);
  useEffect(() => { onUpdatePersonRef.current = onUpdatePerson; }, [onUpdatePerson]);

  const openProfilePicker = useCallback(() => {
    if (!CLOUD_NAME || !window.cloudinary) return;
    if (!profileWidgetRef.current) {
      profileWidgetRef.current = window.cloudinary.createUploadWidget(
        {
          cloudName: CLOUD_NAME,
          uploadPreset: UPLOAD_PRESET,
          multiple: false,
          maxFiles: 1,
          sources: ['local', 'camera', 'url'],
          showAdvancedOptions: false,
          cropping: false,
          defaultSource: 'local',
          showPoweredBy: false,
          styles: PROFILE_PIC_WIDGET_STYLES,
        },
        (error, result) => {
          if (!error && result?.event === 'success') {
            const { public_id, secure_url } = result.info;
            const current = personRef.current;
            onUpdatePersonRef.current?.({
              ...current,
              profilePic: { public_id, secure_url },
            });
          }
        }
      );
    }
    profileWidgetRef.current.open();
  }, []);

  const removeProfilePic = useCallback((e) => {
    e?.stopPropagation();
    const current = personRef.current;
    if (!current) return;
    const { profilePic, ...rest } = current;
    onUpdatePersonRef.current?.(rest);
  }, []);

  if (!person) return null;

  const rel = person.relationship ?? {};
  const type = rel.type ?? 'other';
  const strength = rel.strength ?? 0;
  const ctx = person.context ?? {};
  const fav = ctx.favorites ?? {};
  const history = person.history ?? {};

  const relMeta = REL_BY_KEY[type] ?? OTHER_REL;

  const hasContext = Boolean(
    ctx.how_we_met || ctx.school || ctx.work
    || ctx.hobbies?.length || ctx.sports?.length
    || fav.foods?.length || fav.music?.length
  );
  const hasConnection = Boolean(
    rel.tenure || rel.frequency || rel.last_interaction
    || rel.channels?.length
    || rel.they_show_up_for_me || rel.i_show_up_for_them || rel.knows_about_me
  );
  const hasMemoriesTogether = history.memories_together?.length > 0;
  const hasImportantEvents = history.important_events?.length > 0;
  const hasMemories = hasMemoriesTogether || hasImportantEvents;
  const hasForward = history.things_to_look_forward_to?.length > 0;
  const showSubLabels = hasMemoriesTogether && hasImportantEvents;

  const isScored = Boolean(person.scoring?.dimensions);

  // Stat strip (DS §12)
  const memoriesCount = (history.memories_together?.length ?? 0) + (history.important_events?.length ?? 0);
  const lastSeenLabel = labelOf(LAST_INTERACTION_OPTIONS, rel.last_interaction);
  const tenureLabel   = labelOf(TENURE_OPTIONS, rel.tenure);
  const hasStats = isScored || lastSeenLabel || memoriesCount > 0;
  // Subtitle: "Friend · A lifetime · UCLA"
  const subtitleParts = [
    relMeta.label,
    tenureLabel,
    ctx.school || null,
  ].filter(Boolean);
  const RING_R = 44;
  const RING_W = 3;
  const SIZE = (RING_R + RING_W) * 2;
  const CIRC = 2 * Math.PI * RING_R;
  // Until scored, the strength ring is neutral and shows no fill — avoids
  // implying a connection level the AI hasn't graded yet.
  const offset = isScored ? CIRC * (1 - Math.max(0, Math.min(100, strength)) / 100) : CIRC;
  const ringColor = isScored ? strengthRingColor(strength) : 'rgba(200,200,210,0.35)';

  return (
    <div className={`pm-backdrop ${phase || ''}`} onClick={onClose} role="presentation">
      <div
        className={`pm-panel ${phase || ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${person.name} details`}
        style={
          originPoint
            ? {
                '--origin-x': `${originPoint.x}px`,
                '--origin-y': `${originPoint.y}px`,
              }
            : undefined
        }
      >
        {/* Non-scrolling chrome: close button + tabs */}
        <div className="pm-chrome">
          <button className="pm-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          <div className="pm-tabs">
            <button
              className={`pm-tab ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >Info</button>
            <button
              className={`pm-tab ${activeTab === 'score' ? 'active' : ''}`}
              onClick={() => setActiveTab('score')}
            >
              Score
              {person.scoring?.status === 'pending' && (
                <span className="pm-tab-dot pm-tab-dot-pending" aria-label="scoring" />
              )}
              {person.scoring?.status === 'failed' && (
                <span className="pm-tab-dot pm-tab-dot-failed" aria-label="scoring failed" />
              )}
            </button>
            <button
              className={`pm-tab ${activeTab === 'photos' ? 'active' : ''}`}
              onClick={() => setActiveTab('photos')}
            >
              Photos
              {photosByPerson[person.id]?.length > 0 && (
                <span className="pm-tab-badge">{photosByPerson[person.id].length}</span>
              )}
            </button>
          </div>

          {activeTab === 'info' && (
            <div className="pm-edit-actions">
              {isEditing ? (
                <>
                  {saveError && <span className="pm-save-error" role="alert">{saveError}</span>}
                  <button
                    className="pm-edit-btn"
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="pm-edit-btn primary"
                    onClick={saveEdit}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : (
                <button className="pm-edit-btn primary" onClick={startEdit}>
                  Edit
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="pm-body">
          <div className="pm-header">
            <div className="pm-avatar-wrap" style={{ width: SIZE, height: SIZE }}>
              <svg className="pm-ring" width={SIZE} height={SIZE}>
                <circle
                  cx={SIZE / 2} cy={SIZE / 2} r={RING_R}
                  fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={RING_W}
                />
                <circle
                  cx={SIZE / 2} cy={SIZE / 2} r={RING_R}
                  fill="none" stroke={ringColor} strokeWidth={RING_W}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={offset}
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              </svg>
              <button
                type="button"
                className="pm-avatar"
                onClick={openProfilePicker}
                aria-label={person.profilePic ? 'Change profile picture' : 'Add profile picture'}
              >
                {person.profilePic?.secure_url ? (
                  <img
                    src={person.profilePic.secure_url}
                    alt={`${person.name} profile`}
                    className="pm-avatar-img"
                  />
                ) : (
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="3.6" />
                    <path d="M4.5 20c0-3.9 3.4-6.8 7.5-6.8s7.5 2.9 7.5 6.8" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="pm-avatar-edit"
                onClick={openProfilePicker}
                aria-label={person.profilePic ? 'Change profile picture' : 'Upload profile picture'}
              >
                <Camera size={12} strokeWidth={2} aria-hidden="true" />
              </button>

              {person.profilePic?.secure_url && (
                <button
                  type="button"
                  className="pm-avatar-remove"
                  onClick={removeProfilePic}
                  aria-label="Remove profile picture"
                >
                  <X size={11} strokeWidth={2.5} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="pm-name">{person.name}</div>

            {subtitleParts.length > 0 && (
              <div className="pm-subtitle">
                <span className="pm-subtitle-dot" style={{ background: relMeta.color }} />
                {subtitleParts.map((part, i) => (
                  <span key={i} className="pm-subtitle-part">
                    {i > 0 && <span className="pm-subtitle-sep">·</span>}
                    {part}
                  </span>
                ))}
              </div>
            )}

            {person.birthday && (
              <div className="pm-birthday">
                <Gift size={12} className="pm-birthday-icon" />
                {formatBirthday(person.birthday)}
              </div>
            )}

            {hasStats && (
              <div className="pm-stats">
                {isScored && (
                  <div className="pm-stat">
                    <div className="pm-stat-label">Closeness</div>
                    <div className="pm-stat-value">
                      {strength}<span className="pm-stat-suffix">/100</span>
                    </div>
                  </div>
                )}
                {lastSeenLabel && (
                  <div className="pm-stat">
                    <div className="pm-stat-label">Last seen</div>
                    <div className="pm-stat-value-text">{lastSeenLabel}</div>
                  </div>
                )}
                {memoriesCount > 0 && (
                  <div className="pm-stat">
                    <div className="pm-stat-label">Memories</div>
                    <div className="pm-stat-value">{memoriesCount}</div>
                  </div>
                )}
              </div>
            )}
            <div className="pm-last-contact">
              Last Contact: {formatLastContact(person.lastContactAt)}
            </div>

            {/* Nudge Interaction */}
            {(() => {
              const last = new Date(person.lastContactAt || 0);
              const diffDays = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
              const isStale = diffDays > 30 || person.nudgeStatus === 'red' || person.nudgeStatus === 'yellow';
              
              if (!isStale) return null;

              return (
                <div className="pm-nudge-box">
                  {!showNudgePrompt ? (
                    <>
                      <div className="pm-nudge-text">Have you reached out to this person recently?</div>
                      <div className="pm-nudge-btns">
                        <button 
                          className="pm-nudge-btn defer"
                          onClick={() => {
                            onUpdatePerson?.({ ...person, nudgeStatus: 'yellow' });
                            onClose();
                          }}
                        >
                          Not yet, but will do
                        </button>
                        <button 
                          className="pm-nudge-btn confirm"
                          onClick={() => setShowNudgePrompt(true)}
                        >
                          YES
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="pm-nudge-prompt">
                      <div className="pm-nudge-text">How many days ago?</div>
                      <div className="pm-nudge-input-row">
                        <input 
                          type="number" 
                          className="pm-nudge-input"
                          placeholder="0"
                          value={daysAgo}
                          onChange={(e) => setDaysAgo(e.target.value)}
                          autoFocus
                        />
                        <button 
                          className="pm-nudge-btn confirm"
                          onClick={() => {
                            const days = parseInt(daysAgo) || 0;
                            const newDate = new Date();
                            newDate.setHours(0,0,0,0); // start of day
                            newDate.setDate(newDate.getDate() - days);
                            
                            onUpdatePerson?.({ 
                              ...person, 
                              lastContactAt: newDate.toISOString(),
                              nudgeStatus: null 
                            });
                            setShowNudgePrompt(false);
                            setDaysAgo('');
                          }}
                        >
                          Update
                        </button>
                        <button className="pm-nudge-cancel" onClick={() => setShowNudgePrompt(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Info tab content */}
          {activeTab === 'info' && (
            <>
              {isEditing && draft && (
                <>
                  <div className="pm-divider" />
                  <section className="pm-section">
                    <div className="pm-section-label">Edit Basics</div>
                    <div className="pm-edit-grid">
                      <label className="pm-input-label">
                        Name
                        <input
                          className="pm-input"
                          value={draft.name}
                          onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </label>
                      <label className="pm-input-label">
                        Birthday
                        <input
                          className="pm-input"
                          type="date"
                          value={draft.birthday}
                          onChange={(e) => setDraft((prev) => ({ ...prev, birthday: e.target.value }))}
                        />
                      </label>
                      <label className="pm-input-label">
                        Category
                        <select
                          className="pm-input"
                          value={draft.relationshipType}
                          onChange={(e) => setDraft((prev) => ({ ...prev, relationshipType: e.target.value }))}
                        >
                          {RELATIONSHIP_TYPES.map((r) => (
                            <option key={r.key} value={r.key}>{r.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="pm-input-label pm-input-wide">
                        Notes
                        <textarea
                          className="pm-input pm-textarea"
                          value={draft.notes}
                          onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                          placeholder="Your own words on this relationship — closeness, cadence, tone."
                        />
                      </label>
                    </div>
                  </section>
                  <div className="pm-divider" />
                  <section className="pm-section">
                    <div className="pm-section-label">Edit Connection</div>
                    <div className="pm-edit-grid">
                      <label className="pm-input-label">Known for
                        <select className="pm-input" value={draft.tenure}
                          onChange={(e) => setDraft((prev) => ({ ...prev, tenure: e.target.value }))}>
                          <option value="">—</option>
                          {TENURE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                      </label>
                      <label className="pm-input-label">Frequency
                        <select className="pm-input" value={draft.frequency}
                          onChange={(e) => setDraft((prev) => ({ ...prev, frequency: e.target.value }))}>
                          <option value="">—</option>
                          {FREQUENCY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                      </label>
                      <label className="pm-input-label">Last interaction
                        <select className="pm-input" value={draft.lastInteraction}
                          onChange={(e) => setDraft((prev) => ({ ...prev, lastInteraction: e.target.value }))}>
                          <option value="">—</option>
                          {LAST_INTERACTION_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                      </label>
                      <div className="pm-input-label pm-input-wide">
                        <span>Channels</span>
                        <div className="pm-chip-row">
                          {CHANNEL_OPTIONS.map((o) => {
                            const on = draft.channels.includes(o.key);
                            return (
                              <button
                                key={o.key}
                                type="button"
                                className={`pm-chip ${on ? 'on' : ''}`}
                                aria-pressed={on}
                                onClick={() => setDraft((prev) => ({
                                  ...prev,
                                  channels: on
                                    ? prev.channels.filter((c) => c !== o.key)
                                    : [...prev.channels, o.key],
                                }))}
                              >
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <label className="pm-input-label">They show up for me
                        <select className="pm-input" value={draft.theyShowUpForMe}
                          onChange={(e) => setDraft((prev) => ({ ...prev, theyShowUpForMe: e.target.value }))}>
                          <option value="">—</option>
                          {SUPPORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                      </label>
                      <label className="pm-input-label">I show up for them
                        <select className="pm-input" value={draft.iShowUpForThem}
                          onChange={(e) => setDraft((prev) => ({ ...prev, iShowUpForThem: e.target.value }))}>
                          <option value="">—</option>
                          {SUPPORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                      </label>
                      <label className="pm-input-label">Knows about me
                        <select className="pm-input" value={draft.knowsAboutMe}
                          onChange={(e) => setDraft((prev) => ({ ...prev, knowsAboutMe: e.target.value }))}>
                          <option value="">—</option>
                          {KNOWS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                      </label>
                    </div>
                  </section>
                  <div className="pm-divider" />
                  <section className="pm-section">
                    <div className="pm-section-label">Edit Details</div>
                    <div className="pm-edit-grid">
                      <label className="pm-input-label">How we met
                        <input className="pm-input" value={draft.howWeMet} onChange={(e) => setDraft((prev) => ({ ...prev, howWeMet: e.target.value }))} />
                      </label>
                      <label className="pm-input-label">School
                        <input className="pm-input" value={draft.school} onChange={(e) => setDraft((prev) => ({ ...prev, school: e.target.value }))} />
                      </label>
                      <label className="pm-input-label">Work
                        <input className="pm-input" value={draft.work} onChange={(e) => setDraft((prev) => ({ ...prev, work: e.target.value }))} />
                      </label>
                      <label className="pm-input-label">Hobbies (one per line)
                        <textarea className="pm-input pm-textarea" value={draft.hobbies} onChange={(e) => setDraft((prev) => ({ ...prev, hobbies: e.target.value }))} />
                      </label>
                      <label className="pm-input-label">Sports (one per line)
                        <textarea className="pm-input pm-textarea" value={draft.sports} onChange={(e) => setDraft((prev) => ({ ...prev, sports: e.target.value }))} />
                      </label>
                      <label className="pm-input-label">Favorite foods (one per line)
                        <textarea className="pm-input pm-textarea" value={draft.favoriteFoods} onChange={(e) => setDraft((prev) => ({ ...prev, favoriteFoods: e.target.value }))} />
                      </label>
                      <label className="pm-input-label">Favorite music (one per line)
                        <textarea className="pm-input pm-textarea" value={draft.favoriteMusic} onChange={(e) => setDraft((prev) => ({ ...prev, favoriteMusic: e.target.value }))} />
                      </label>
                      <label className="pm-input-label">Memories together (one per line)
                        <textarea className="pm-input pm-textarea" value={draft.memoriesTogether} onChange={(e) => setDraft((prev) => ({ ...prev, memoriesTogether: e.target.value }))} />
                      </label>
                      <label className="pm-input-label">Important events (one per line)
                        <textarea className="pm-input pm-textarea" value={draft.importantEvents} onChange={(e) => setDraft((prev) => ({ ...prev, importantEvents: e.target.value }))} />
                      </label>
                      <label className="pm-input-label">Looking forward to (one per line)
                        <textarea className="pm-input pm-textarea" value={draft.forwardTo} onChange={(e) => setDraft((prev) => ({ ...prev, forwardTo: e.target.value }))} />
                      </label>
                    </div>
                  </section>
                </>
              )}

              {!isEditing && (
                <>
              {person.notes && (
                <>
                  <div className="pm-divider" />
                  <section className="pm-section">
                    <div className="pm-section-label">Notes</div>
                    <div className="pm-notes">{person.notes}</div>
                  </section>
                </>
              )}

              {hasConnection && (
                <>
                  <div className="pm-divider" />
                  <section className="pm-section">
                    <div className="pm-section-label">Connection</div>
                    {rel.tenure           && <Field label="Known for"           value={labelOf(TENURE_OPTIONS, rel.tenure)} />}
                    {rel.frequency        && <Field label="Frequency"           value={labelOf(FREQUENCY_OPTIONS, rel.frequency)} />}
                    {rel.last_interaction && <Field label="Last interaction"    value={labelOf(LAST_INTERACTION_OPTIONS, rel.last_interaction)} />}
                    {rel.channels?.length > 0 && (
                      <Pills label="Channels" items={rel.channels.map((c) => labelOf(CHANNEL_OPTIONS, c) ?? c)} />
                    )}
                    {rel.they_show_up_for_me && <Field label="They show up for me" value={labelOf(SUPPORT_OPTIONS, rel.they_show_up_for_me)} />}
                    {rel.i_show_up_for_them  && <Field label="I show up for them"  value={labelOf(SUPPORT_OPTIONS, rel.i_show_up_for_them)} />}
                    {rel.knows_about_me      && <Field label="Knows about me"      value={labelOf(KNOWS_OPTIONS, rel.knows_about_me)} />}
                  </section>
                </>
              )}

              {hasContext && (
                <>
                  <div className="pm-divider" />
                  <section className="pm-section">
                    <div className="pm-section-label">Context</div>
                    {ctx.how_we_met && <Field label="How we met" value={ctx.how_we_met} />}
                    {ctx.school && <Field label="School" value={ctx.school} />}
                    {ctx.work && <Field label="Work" value={ctx.work} />}
                    {ctx.hobbies?.length > 0 && <Pills label="Hobbies" items={ctx.hobbies} />}
                    {ctx.sports?.length > 0 && <Pills label="Sports" items={ctx.sports} />}
                    {fav.foods?.length > 0 && <Pills label="Favorite foods" items={fav.foods} />}
                    {fav.music?.length > 0 && <Pills label="Favorite music" items={fav.music} />}
                  </section>
                </>
              )}

              {hasMemories && (
                <>
                  <div className="pm-divider" />
                  <section className="pm-section">
                    <div className="pm-section-label">Memories</div>
                    {hasMemoriesTogether && (
                      <div className="pm-sublist">
                        {showSubLabels && <div className="pm-sublabel">Together</div>}
                        <ul className="pm-list">
                          {history.memories_together.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                      </div>
                    )}
                    {hasImportantEvents && (
                      <div className="pm-sublist">
                        {showSubLabels && <div className="pm-sublabel">Important events</div>}
                        <ul className="pm-list">
                          {history.important_events.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                      </div>
                    )}
                  </section>
                </>
              )}

              {hasForward && (
                <>
                  <div className="pm-divider" />
                  <section className="pm-section">
                    <div className="pm-section-label">Looking Forward</div>
                    <ul className="pm-list">
                      {history.things_to_look_forward_to.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </section>
                </>
              )}
                </>
              )}
            </>
          )}

          {/* Score tab content */}
          {activeTab === 'score' && (
            <>
              <div className="pm-divider" />
              <section className="pm-section">
                <div className="pm-score-header">
                  <div className="pm-section-label">Why this score?</div>
                  {onRescore && person.scoring?.status !== 'pending' && (
                    <button className="pm-rescore-btn" onClick={onRescore}>
                      Rescore
                    </button>
                  )}
                </div>

                {!person.scoring && (
                  <div className="pm-score-pending">Not scored yet.</div>
                )}

                {person.scoring?.status === 'pending' && (
                  <div className="pm-score-pending">
                    Scoring across 5 dimensions… (~25s)
                  </div>
                )}

                {person.scoring?.status === 'failed' && (
                  <div className="pm-score-failed">
                    ⚠ Scoring failed{person.scoring.error ? `: ${person.scoring.error}` : '.'}
                  </div>
                )}

                {person.scoring?.dimensions && (
                  <div className="pm-score-dims">
                    {DIMENSION_ORDER.map((key) => {
                      const dim = person.scoring.dimensions[key];
                      if (!dim) return null;
                      return (
                        <div key={key} className="pm-score-dim">
                          <div className="pm-score-dim-head">
                            <span className="pm-score-dim-name">{DIMENSION_LABELS[key]}</span>
                            <span className="pm-score-dim-num">{dim.score}/10</span>
                          </div>
                          <div className="pm-score-bar">
                            <div
                              className="pm-score-bar-fill"
                              style={{ width: `${(dim.score / 10) * 100}%` }}
                            />
                          </div>
                          {dim.reasoning && (
                            <div className="pm-score-dim-reason">{dim.reasoning}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Photos tab content */}
          {activeTab === 'photos' && (
            <>
              <div className="pm-divider" />
              <section className="pm-section">
                <div className="pm-section-label">Photos</div>
                <CloudinaryUpload
                  personId={person.id}
                  photos={photosByPerson[person.id] ?? []}
                  onPhotosChange={(newPhotos) => onPhotosChange?.(person.id, newPhotos)}
                />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
