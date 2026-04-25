import { useEffect, useState } from 'react';
import './PersonModal.css';
import CloudinaryUpload from '../CloudinaryUpload/CloudinaryUpload';

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

function strengthRingColor(s) {
  if (s >= 65) return '#34d399';
  if (s >= 40) return '#facc32';
  return '#f05050';
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

export default function PersonModal({ person, originPoint, phase, onClose, photosByPerson = {}, onPhotosChange }) {
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (!person) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [person, onClose]);

  if (!person) return null;

  const type = person.relationship?.type ?? 'other';
  const strength = person.relationship?.strength ?? 0;
  const ctx = person.context ?? {};
  const fav = ctx.favorites ?? {};
  const history = person.history ?? {};

  const hasContext = Boolean(
    ctx.how_we_met || ctx.school || ctx.work
    || ctx.hobbies?.length || ctx.sports?.length
    || fav.foods?.length || fav.music?.length
  );
  const hasMemoriesTogether = history.memories_together?.length > 0;
  const hasImportantEvents = history.important_events?.length > 0;
  const hasMemories = hasMemoriesTogether || hasImportantEvents;
  const hasForward = history.things_to_look_forward_to?.length > 0;
  const showSubLabels = hasMemoriesTogether && hasImportantEvents;

  const RING_R = 44;
  const RING_W = 3;
  const SIZE = (RING_R + RING_W) * 2;
  const CIRC = 2 * Math.PI * RING_R;
  const offset = CIRC * (1 - Math.max(0, Math.min(100, strength)) / 100);
  const ringColor = strengthRingColor(strength);

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
              className={`pm-tab ${activeTab === 'photos' ? 'active' : ''}`}
              onClick={() => setActiveTab('photos')}
            >
              Photos
              {photosByPerson[person.id]?.length > 0 && (
                <span className="pm-tab-badge">{photosByPerson[person.id].length}</span>
              )}
            </button>
          </div>
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
              <div className="pm-avatar">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="3.6" />
                  <path d="M4.5 20c0-3.9 3.4-6.8 7.5-6.8s7.5 2.9 7.5 6.8" />
                </svg>
              </div>
            </div>

            <div className="pm-name">{person.name}</div>

            <div className="pm-badge">
              <span className="pm-badge-dot" style={{ background: CATEGORY_COLORS[type] || CATEGORY_COLORS.other }} />
              <span>{CATEGORY_LABELS[type] || CATEGORY_LABELS.other}</span>
            </div>

            {person.birthday && (
              <div className="pm-birthday">{formatBirthday(person.birthday)}</div>
            )}
          </div>

          {/* Info tab content */}
          {activeTab === 'info' && (
            <>
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
