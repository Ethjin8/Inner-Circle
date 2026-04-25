import { useEffect, useRef, useState } from 'react';
import './AddPersonModal.css';
import { GeminiLiveSession } from '../../services/geminiLive';

// ─── voice helpers ────────────────────────────────────────────────────────────
const STARDUST_PARTICLES = 28;
const TARGET_SAMPLE_RATE = 16000;

function generateParticles() {
  return Array.from({ length: STARDUST_PARTICLES }, (_, i) => {
    const angle = (i / STARDUST_PARTICLES) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 60 + Math.random() * 60;
    return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, delay: Math.random() * 60 };
  });
}

function downsampleFloatBuffer(floatBuffer, inputRate, outputRate) {
  if (outputRate >= inputRate) return floatBuffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(floatBuffer.length / ratio);
  const result = new Float32Array(newLength);
  let outOff = 0; let inOff = 0;
  while (outOff < result.length) {
    const nextIn = Math.round((outOff + 1) * ratio);
    let accum = 0; let count = 0;
    for (let i = inOff; i < nextIn && i < floatBuffer.length; i++) { accum += floatBuffer[i]; count++; }
    result[outOff] = count > 0 ? accum / count : 0;
    outOff++; inOff = nextIn;
  }
  return result;
}

function floatTo16BitPCM(floatBuffer) {
  const pcm16 = new Int16Array(floatBuffer.length);
  for (let i = 0; i < floatBuffer.length; i++) {
    const s = Math.max(-1, Math.min(1, floatBuffer[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

// ─── form constants ───────────────────────────────────────────────────────────
const REL_TYPES = [
  { key: 'family',       label: 'Family',       color: '#e8b06b' },
  { key: 'friend',       label: 'Friend',        color: '#ffce5c' },
  { key: 'classmate',    label: 'School',        color: '#b9d0ff' },
  { key: 'coworker',     label: 'Work',          color: '#9be6c4' },
  { key: 'professional', label: 'Professional',  color: '#ff9c5a' },
  { key: 'romantic',     label: 'Romantic',      color: '#ffc8d6' },
  { key: 'mentor',       label: 'Mentor',        color: '#7df9ff' },
  { key: 'other',        label: 'Other',         color: '#cdc9c0' },
];

const STEPS = [
  { id: 'identity',  label: 'Who'      },
  { id: 'context',   label: 'Context'  },
  { id: 'interests', label: 'Interests'},
  { id: 'memories',  label: 'Memories' },
];

const BLANK = {
  name: '', birthday: '', relType: 'friend', strength: 60,
  howWeMet: '', school: '', work: '',
  hobbies: [], sports: [], favoritesFoods: [], favoritesMusic: [],
  memoriesTogether: [], importantEvents: [], thingsToLookForwardTo: [],
};

// ─── small reusable form pieces ───────────────────────────────────────────────
function TagInput({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim().replace(/,$/, '');
    if (t && !items.includes(t)) onChange([...items, t]);
    setDraft('');
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    else if (e.key === 'Backspace' && draft === '' && items.length > 0) remove(items.length - 1);
  };
  return (
    <div className="apm-field">
      <div className="apm-label">{label}</div>
      <div className="apm-tag-input">
        {items.map((item, i) => (
          <span key={i} className="apm-tag">
            {item}<button type="button" className="apm-tag-x" onClick={() => remove(i)}>×</button>
          </span>
        ))}
        <input
          className="apm-tag-draft"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
          placeholder={items.length === 0 ? placeholder : ''}
        />
      </div>
    </div>
  );
}

function ListInput({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => { if (draft.trim()) { onChange([...items, draft.trim()]); setDraft(''); } };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const onKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
  return (
    <div className="apm-field">
      <div className="apm-label">{label}</div>
      {items.length > 0 && (
        <ul className="apm-list-items">
          {items.map((item, i) => (
            <li key={i} className="apm-list-item">
              <span>{item}</span>
              <button type="button" className="apm-tag-x" onClick={() => remove(i)}>×</button>
            </li>
          ))}
        </ul>
      )}
      <div className="apm-list-row">
        <input
          className="apm-text-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
        />
        <button type="button" className="apm-add-btn" onClick={add} disabled={!draft.trim()}>+</button>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function AddPersonModal({ open, onClose, onAdd }) {
  const [mode, setMode] = useState('voice');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(BLANK);

  // voice state
  const [listening, setListening]           = useState(false);
  const [bursting, setBursting]             = useState(false);
  const [particles, setParticles]           = useState([]);
  const [voiceStatus, setVoiceStatus]       = useState('Tap probe to start');
  const [liveStatus, setLiveStatus]         = useState('idle');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [conversation, setConversation]     = useState([]);
  const [voiceError, setVoiceError]         = useState('');

  const mediaStreamRef  = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef   = useRef(null);
  const processorNodeRef = useRef(null);
  const liveSessionRef  = useRef(null);

  function stopVoiceFlow() {
    processorNodeRef.current?.disconnect();
    if (processorNodeRef.current) { processorNodeRef.current.onaudioprocess = null; processorNodeRef.current = null; }
    sourceNodeRef.current?.disconnect(); sourceNodeRef.current = null;
    audioContextRef.current?.close(); audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null;
    liveSessionRef.current?.disconnect(); liveSessionRef.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setListening(false); setCurrentTranscript(''); setLiveStatus('idle');
  }

  const resetAll = () => {
    stopVoiceFlow();
    setListening(false); setBursting(false); setParticles([]);
    setVoiceStatus('Tap probe to start'); setCurrentTranscript(''); setVoiceError('');
    setConversation([]);
    setStep(0); setForm(BLANK);
  };

  const handleClose = () => { resetAll(); onClose(); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => stopVoiceFlow(), []);

  // voice flow
  const startVoiceFlow = async () => {
    const live = new GeminiLiveSession({
      apiKey: import.meta.env.VITE_GEMINI_API_KEY,
      onStatus: (status) => {
        setLiveStatus(status);
        if (status === 'connected') {
          setVoiceStatus('Listening...');
          setConversation((prev) => prev.concat({ role: 'assistant', text: "I'm here. Who would you like to add?" }));
        } else if (status === 'connecting') {
          setVoiceStatus('Connecting to Gemini Live...');
        } else if (status === 'closed') {
          setVoiceStatus('Tap probe to start');
        }
      },
      onUserTranscript: (text) => setCurrentTranscript(text),
      onMessage: (text) => {
        setConversation((prev) => prev.concat({ role: 'assistant', text }));
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.rate = 1.02; u.pitch = 1;
          window.speechSynthesis.speak(u);
        }
      },
      onError: (err) => { setVoiceError(err.message || 'Gemini Live failed.'); setVoiceStatus('Connection issue'); },
    });
    live.connect();
    liveSessionRef.current = live;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('Web Audio API not available.');
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;
      const processorNode = audioContext.createScriptProcessor(2048, 1, 1);
      processorNodeRef.current = processorNode;
      processorNode.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const down = downsampleFloatBuffer(input, audioContext.sampleRate, TARGET_SAMPLE_RATE);
        liveSessionRef.current?.sendAudioChunk(floatTo16BitPCM(down).buffer);
      };
      sourceNode.connect(processorNode);
      processorNode.connect(audioContext.destination);
      setListening(true); setVoiceError(''); setVoiceStatus('Listening...');
    } catch (err) {
      setVoiceError(err?.message || 'Microphone access failed.');
      setVoiceStatus('Mic unavailable');
      stopVoiceFlow();
    }
  };

  const handleProbeToggle = () => {
    if (listening) {
      stopVoiceFlow();
      setParticles(generateParticles()); setBursting(true);
      setTimeout(() => { setBursting(false); setParticles([]); }, 720);
      setVoiceStatus('Charting...');
    } else {
      startVoiceFlow();
    }
  };

  // form helpers
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFormSubmit = () => {
    if (!form.name.trim()) return;
    const rawName = form.name.trim();
    const initials = rawName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const person = {
      id: String(Date.now()),
      name: rawName,
      initials,
      ...(form.birthday ? { birthday: form.birthday } : {}),
      relationship: { type: form.relType, strength: Number(form.strength) },
      context: {
        how_we_met: form.howWeMet.trim() || null,
        school:     form.school.trim()   || null,
        work:       form.work.trim()     || null,
        hobbies:    form.hobbies,
        sports:     form.sports,
        favorites: { foods: form.favoritesFoods, music: form.favoritesMusic },
      },
      history: {
        memories_together:        form.memoriesTogether,
        important_events:         form.importantEvents,
        things_to_look_forward_to: form.thingsToLookForwardTo,
      },
    };
    onAdd?.(person);
    resetAll();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="apm-backdrop" onClick={handleClose} role="presentation">
      <div
        className="apm-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add a person"
      >
        <button className="apm-close" onClick={handleClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* ── mode toggle ── */}
        <div className="apm-mode-toggle">
          <button
            className={`apm-mode-btn ${mode === 'voice' ? 'active' : ''}`}
            onClick={() => setMode('voice')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            Voice
          </button>
          <button
            className={`apm-mode-btn ${mode === 'form' ? 'active' : ''}`}
            onClick={() => setMode('form')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Form
          </button>
        </div>

        {/* ══════════════ VOICE VIEW ══════════════ */}
        {mode === 'voice' && (
          <>
            <div className="apm-header">
              <div className="apm-eyebrow">Voice onboarding</div>
              <h2 className="apm-title">Tell me about someone</h2>
              <p className="apm-subtitle">
                Just talk — who they are, how you know them, anything you want to remember. I'll add them to your graph.
              </p>
            </div>

            <div className="apm-mic-wrap">
              {listening && (
                <svg className="apm-flares" width="220" height="220" viewBox="0 0 220 220" aria-hidden>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <circle key={i} cx="110" cy="110" r={70 + i * 8}
                      fill="none" stroke="rgba(232, 232, 240, 0.5)" strokeWidth="1"
                      strokeDasharray="6 380" strokeLinecap="round"
                      className="apm-flare-arc" style={{ animationDelay: `${i * 0.18}s` }}
                    />
                  ))}
                </svg>
              )}
              {bursting && (
                <div className="apm-stardust" aria-hidden>
                  {particles.map((p, i) => (
                    <span key={i} className="apm-stardust-particle"
                      style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, animationDelay: `${p.delay}ms` }}
                    />
                  ))}
                </div>
              )}
              <button
                className={`apm-probe ${listening ? 'listening' : ''}`}
                onClick={handleProbeToggle}
                aria-pressed={listening}
                aria-label={listening ? 'Stop listening' : 'Start listening'}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19 L4 24" /><path d="M22 6 L26 4" /><path d="M22 6 L20 8" />
                  <path d="M9 19 a 9 9 0 0 1 0 -12.7 L21.7 19 a 9 9 0 0 1 -12.7 0 Z" />
                  <circle cx="22" cy="6" r="1.6" fill="currentColor" />
                </svg>
              </button>
              <div className={`apm-status ${listening ? 'live' : ''}`}>
                {listening ? `${voiceStatus}${liveStatus === 'connected' ? '' : ' (connecting...)'}` : voiceStatus}
              </div>
            </div>

            {voiceError && <div className="apm-error">{voiceError}</div>}

            {conversation.length > 0 && (
              <div className="apm-transcript">
                {conversation.slice(-8).map((line, idx) => (
                  <div key={`${line.role}-${idx}`} className={`apm-transcript-line ${line.role}`}>
                    <span className="apm-transcript-role">{line.role === 'assistant' ? 'Agent' : 'You'}</span>
                    <span>{line.text}</span>
                  </div>
                ))}
                {currentTranscript && (
                  <div className="apm-transcript-line user preview">
                    <span className="apm-transcript-role">You</span>
                    <span>{currentTranscript}</span>
                  </div>
                )}
              </div>
            )}

            <div className="apm-hints">
              <div className="apm-hint-label">Try saying</div>
              <ul className="apm-hint-list">
                <li>"My friend Jake from CS 31 — we've known each other since freshman year."</li>
                <li>"Add my mom. Her birthday is March 18th and she loves gardening."</li>
                <li>"Lily, my girlfriend. We met at a coffee shop near campus."</li>
              </ul>
            </div>
          </>
        )}

        {/* ══════════════ FORM VIEW ══════════════ */}
        {mode === 'form' && (
          <>
            <div className="apm-header">
              <div className="apm-eyebrow">Manual entry</div>
              <h2 className="apm-title">
                {step === 0 && 'Who are they?'}
                {step === 1 && 'How do you know them?'}
                {step === 2 && "What are they into?"}
                {step === 3 && 'What do you remember?'}
              </h2>
            </div>

            {/* step dots */}
            <div className="apm-step-dots" role="list" aria-label="Steps">
              {STEPS.map((s, i) => (
                <div
                  key={s.id}
                  role="listitem"
                  className={`apm-step-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
                  title={s.label}
                />
              ))}
            </div>

            <div className="apm-form-body">

              {/* ── Step 0: Identity ── */}
              {step === 0 && (
                <>
                  <div className="apm-field">
                    <label className="apm-label" htmlFor="apm-name">Name <span className="apm-required">*</span></label>
                    <input
                      id="apm-name"
                      className="apm-text-input"
                      type="text"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder="e.g. Lily Chen"
                      autoFocus
                    />
                  </div>

                  <div className="apm-field">
                    <div className="apm-label">Relationship</div>
                    <div className="apm-rel-grid">
                      {REL_TYPES.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          className={`apm-rel-btn ${form.relType === r.key ? 'active' : ''}`}
                          style={{ '--rel-color': r.color }}
                          onClick={() => set('relType', r.key)}
                        >
                          <span className="apm-rel-dot" />
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="apm-field">
                    <div className="apm-label">
                      Connection strength
                      <span className="apm-strength-val"> — {form.strength}</span>
                    </div>
                    <input
                      className="apm-slider"
                      type="range"
                      min="0" max="100" step="1"
                      value={form.strength}
                      onChange={(e) => set('strength', e.target.value)}
                    />
                    <div className="apm-slider-labels">
                      <span>Distant</span><span>Close</span>
                    </div>
                  </div>

                  <div className="apm-field">
                    <label className="apm-label" htmlFor="apm-bday">Birthday</label>
                    <input
                      id="apm-bday"
                      className="apm-text-input"
                      type="date"
                      value={form.birthday}
                      onChange={(e) => set('birthday', e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* ── Step 1: Context ── */}
              {step === 1 && (
                <>
                  <div className="apm-field">
                    <label className="apm-label" htmlFor="apm-met">How you met</label>
                    <input
                      id="apm-met"
                      className="apm-text-input"
                      type="text"
                      value={form.howWeMet}
                      onChange={(e) => set('howWeMet', e.target.value)}
                      placeholder="e.g. Freshman orientation at UCLA"
                      autoFocus
                    />
                  </div>
                  <div className="apm-field">
                    <label className="apm-label" htmlFor="apm-school">School</label>
                    <input
                      id="apm-school"
                      className="apm-text-input"
                      type="text"
                      value={form.school}
                      onChange={(e) => set('school', e.target.value)}
                      placeholder="e.g. UCLA"
                    />
                  </div>
                  <div className="apm-field">
                    <label className="apm-label" htmlFor="apm-work">Work</label>
                    <input
                      id="apm-work"
                      className="apm-text-input"
                      type="text"
                      value={form.work}
                      onChange={(e) => set('work', e.target.value)}
                      placeholder="e.g. Software engineer at Anthropic"
                    />
                  </div>
                </>
              )}

              {/* ── Step 2: Interests ── */}
              {step === 2 && (
                <>
                  <p className="apm-step-hint">Press Enter or comma to add each item.</p>
                  <TagInput label="Hobbies"        items={form.hobbies}       onChange={(v) => set('hobbies', v)}       placeholder="gaming, reading…" />
                  <TagInput label="Sports"         items={form.sports}        onChange={(v) => set('sports', v)}        placeholder="basketball, running…" />
                  <TagInput label="Favorite foods" items={form.favoritesFoods} onChange={(v) => set('favoritesFoods', v)} placeholder="ramen, sushi…" />
                  <TagInput label="Favorite music" items={form.favoritesMusic} onChange={(v) => set('favoritesMusic', v)} placeholder="hip-hop, indie rock…" />
                </>
              )}

              {/* ── Step 3: Memories ── */}
              {step === 3 && (
                <>
                  <p className="apm-step-hint">Press Enter or + to add each item.</p>
                  <ListInput label="Memories together"       items={form.memoriesTogether}       onChange={(v) => set('memoriesTogether', v)}       placeholder="Beach day at Santa Monica…" />
                  <ListInput label="Important events"        items={form.importantEvents}         onChange={(v) => set('importantEvents', v)}         placeholder="Birthday in November…" />
                  <ListInput label="Things to look forward to" items={form.thingsToLookForwardTo} onChange={(v) => set('thingsToLookForwardTo', v)} placeholder="LA Hacks 2026 together…" />
                </>
              )}
            </div>

            {/* step navigation */}
            <div className="apm-step-nav">
              {step > 0 ? (
                <button type="button" className="apm-nav-btn secondary" onClick={() => setStep(step - 1)}>
                  ← Back
                </button>
              ) : (
                <div />
              )}

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  className="apm-nav-btn primary"
                  onClick={() => setStep(step + 1)}
                  disabled={step === 0 && !form.name.trim()}
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  className="apm-nav-btn primary"
                  onClick={handleFormSubmit}
                  disabled={!form.name.trim()}
                >
                  Add to Inner Circle
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
