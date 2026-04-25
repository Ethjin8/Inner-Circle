import { useEffect, useRef, useState } from 'react';
import './AddPersonModal.css';
import { GeminiLiveSession, extractPersonFromTranscript } from '../../services/geminiLive';
import {
  BLANK_PERSON,
  RELATIONSHIP_TYPES,
  TENURE_OPTIONS,
  FREQUENCY_OPTIONS,
  LAST_INTERACTION_OPTIONS,
  CHANNEL_OPTIONS,
  SUPPORT_OPTIONS,
  KNOWS_OPTIONS,
  buildPersonFromForm,
  buildPersonFromExtraction,
} from '../../constants/personSchema.js';

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

const STEPS = [
  { id: 'identity',   label: 'Who'        },
  { id: 'connection', label: 'Connection' },
  { id: 'context',    label: 'Context'    },
  { id: 'interests',  label: 'Interests'  },
  { id: 'memories',   label: 'Memories'   },
];

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

function PillGroup({ label, options, value, onChange }) {
  return (
    <div className="apm-field">
      <div className="apm-label">{label}</div>
      <div className="apm-pill-row">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`apm-pill ${value === opt.key ? 'active' : ''}`}
            onClick={() => onChange(opt.key)}
            aria-pressed={value === opt.key}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipMultiGroup({ label, options, values, onChange }) {
  const toggle = (key) => {
    if (values.includes(key)) onChange(values.filter((v) => v !== key));
    else onChange([...values, key]);
  };
  return (
    <div className="apm-field">
      <div className="apm-label">{label}</div>
      <div className="apm-pill-row">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`apm-pill ${values.includes(opt.key) ? 'active' : ''}`}
            onClick={() => toggle(opt.key)}
            aria-pressed={values.includes(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function AddPersonModal({ open, onClose, onAdd }) {
  const [mode, setMode] = useState('voice');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(BLANK_PERSON());

  // voice state
  const [listening, setListening]           = useState(false);
  const [bursting, setBursting]             = useState(false);
  const [particles, setParticles]           = useState([]);
  const [voiceStatus, setVoiceStatus]       = useState('Tap probe to start');
  const [liveStatus, setLiveStatus]         = useState('idle');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [conversation, setConversation]     = useState([]);
  const [voiceError, setVoiceError]         = useState('');

  const mediaStreamRef   = useRef(null);
  const audioContextRef  = useRef(null);
  const sourceNodeRef    = useRef(null);
  const processorNodeRef = useRef(null);
  const liveSessionRef   = useRef(null);
  const lastUserTextRef  = useRef(''); // tracks in-progress user utterance between agent turns

  const [extracting, setExtracting] = useState(false);

  // Stop only the microphone pipeline — leaves the WebSocket session open for extraction
  function stopMicInput() {
    processorNodeRef.current?.disconnect();
    if (processorNodeRef.current) { processorNodeRef.current.onaudioprocess = null; processorNodeRef.current = null; }
    sourceNodeRef.current?.disconnect(); sourceNodeRef.current = null;
    audioContextRef.current?.close(); audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null;
    setListening(false); setCurrentTranscript(''); setLiveStatus('idle');
  }

  // Full teardown including WebSocket session
  function stopVoiceFlow() {
    stopMicInput();
    liveSessionRef.current?.disconnect(); liveSessionRef.current = null;
  }

  const resetAll = () => {
    stopVoiceFlow();
    lastUserTextRef.current = '';
    setListening(false); setBursting(false); setParticles([]);
    setVoiceStatus('Tap probe to start'); setCurrentTranscript(''); setVoiceError('');
    setConversation([]); setExtracting(false);
    setStep(0); setForm(BLANK_PERSON());
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
      onUserTranscript: (text) => {
        setCurrentTranscript(text);
        lastUserTextRef.current = text; // keep the latest finalized user utterance
      },
      onMessage: (text) => {
        // Flush the completed user turn before adding the agent's reply
        const userText = lastUserTextRef.current;
        lastUserTextRef.current = '';
        setCurrentTranscript('');
        setConversation((prev) => {
          const next = [...prev];
          // Only add user entry if we have text and the last entry wasn't already user
          if (userText && next[next.length - 1]?.role !== 'user') {
            next.push({ role: 'user', text: userText });
          }
          next.push({ role: 'assistant', text });
          return next;
        });
        // Audio plays directly via GeminiLiveSession.playAudioChunk
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
      const pendingUser = lastUserTextRef.current;
      lastUserTextRef.current = '';
      const convSnapshot = pendingUser
        ? [...conversation, { role: 'user', text: pendingUser }]
        : [...conversation];

      // Stop mic, keep WebSocket alive for extraction
      stopMicInput();
      setParticles(generateParticles()); setBursting(true);
      setTimeout(() => { setBursting(false); setParticles([]); }, 720);

      const hasContent = convSnapshot.some((m) => m.role === 'user');
      if (!hasContent) {
        stopVoiceFlow();
        setVoiceStatus('Tap probe to start');
        return;
      }

      setExtracting(true);

      const buildPerson = buildPersonFromExtraction;

      const finish = (person) => {
        setVoiceStatus(`Adding ${person.name} to your constellation...`);
        onAdd?.(person);
        resetAll();
        onClose();
      };

      const fail = (msg) => {
        liveSessionRef.current?.disconnect();
        liveSessionRef.current = null;
        setVoiceError(msg);
        setVoiceStatus('Tap probe to start');
        setExtracting(false);
      };

      // ── Step 1: extract via the open Live session (no extra quota needed) ──
      setVoiceStatus('Requesting summary from agent...');
      liveSessionRef.current.requestExtraction()
        .then((extracted) => {
          liveSessionRef.current?.disconnect();
          liveSessionRef.current = null;
          const person = buildPerson(extracted);
          if (!person) { fail("Couldn't catch a name — try again."); return; }
          finish(person);
        })
        .catch((liveErr) => {
          console.warn('Live extraction failed, trying REST fallback:', liveErr.message);
          liveSessionRef.current?.disconnect();
          liveSessionRef.current = null;

          // ── Step 2: fallback to REST generateContent ──
          setVoiceStatus('Charting via REST...');
          const transcript = convSnapshot
            .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.text}`)
            .join('\n');
          extractPersonFromTranscript(transcript, import.meta.env.VITE_GEMINI_API_KEY, {
            maxRetries: 2,
            onRetry: (n) => setVoiceStatus(`Charting… retry ${n}`),
          })
            .then((extracted) => {
              const person = buildPerson(extracted);
              if (!person) { fail("Couldn't catch a name — try again."); return; }
              finish(person);
            })
            .catch((restErr) => {
              const msg = restErr.message || '';
              const isQuotaZero = msg.includes('limit: 0') || msg.includes('Quota exceeded');
              fail(isQuotaZero
                ? 'Free-tier quota exhausted for this model. Try again later or check aistudio.google.com/usage.'
                : msg || 'Could not chart person');
            });
        });
    } else {
      startVoiceFlow();
    }
  };

  // form helpers
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFormSubmit = () => {
    const person = buildPersonFromForm(form);
    if (!person) return;
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
                className={`apm-probe ${listening ? 'listening' : ''} ${extracting ? 'extracting' : ''}`}
                onClick={handleProbeToggle}
                disabled={extracting}
                aria-pressed={listening}
                aria-label={listening ? 'Stop listening' : 'Start listening'}
              >
                {extracting ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" className="apm-spin-icon" />
                  </svg>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19 L4 24" /><path d="M22 6 L26 4" /><path d="M22 6 L20 8" />
                    <path d="M9 19 a 9 9 0 0 1 0 -12.7 L21.7 19 a 9 9 0 0 1 -12.7 0 Z" />
                    <circle cx="22" cy="6" r="1.6" fill="currentColor" />
                  </svg>
                )}
              </button>
              <div className={`apm-status ${listening ? 'live' : ''} ${extracting ? 'live' : ''}`}>
                {listening
                  ? `${voiceStatus}${liveStatus === 'connected' ? '' : ' (connecting...)'}`
                  : voiceStatus}
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
                {STEPS[step].id === 'identity'   && 'Who are they?'}
                {STEPS[step].id === 'connection' && 'How connected are you?'}
                {STEPS[step].id === 'context'    && 'How do you know them?'}
                {STEPS[step].id === 'interests'  && "What are they into?"}
                {STEPS[step].id === 'memories'   && 'What do you remember?'}
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
              {STEPS[step].id === 'identity' && (
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
                      {RELATIONSHIP_TYPES.map((r) => (
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
                    <label className="apm-label" htmlFor="apm-bday">Birthday</label>
                    <input
                      id="apm-bday"
                      className="apm-text-input"
                      type="date"
                      value={form.birthday}
                      onChange={(e) => set('birthday', e.target.value)}
                    />
                  </div>

                  <div className="apm-field">
                    <label className="apm-label" htmlFor="apm-notes">
                      Quick note
                      <span className="apm-label-hint"> — your own words on this relationship (the AI weights this heavily)</span>
                    </label>
                    <textarea
                      id="apm-notes"
                      className="apm-text-input apm-textarea"
                      rows="4"
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)}
                      placeholder="e.g. We&apos;ve been close since freshman year. Hang out a few times a week, get coffee, study together — she was there for me when my grandma passed."
                    />
                  </div>
                </>
              )}

              {/* ── Step 1: Connection ── */}
              {STEPS[step].id === 'connection' && (
                <>
                  <PillGroup
                    label="How long have you known them?"
                    options={TENURE_OPTIONS}
                    value={form.tenure}
                    onChange={(v) => set('tenure', v)}
                  />
                  <PillGroup
                    label="How often do you interact?"
                    options={FREQUENCY_OPTIONS}
                    value={form.frequency}
                    onChange={(v) => set('frequency', v)}
                  />
                  <PillGroup
                    label="When did you last talk or hang out?"
                    options={LAST_INTERACTION_OPTIONS}
                    value={form.lastInteraction}
                    onChange={(v) => set('lastInteraction', v)}
                  />
                  <ChipMultiGroup
                    label="How do you usually connect?"
                    options={CHANNEL_OPTIONS}
                    values={form.channels}
                    onChange={(v) => set('channels', v)}
                  />
                  <PillGroup
                    label="When you're going through something, do they show up for you?"
                    options={SUPPORT_OPTIONS}
                    value={form.theyShowUpForMe}
                    onChange={(v) => set('theyShowUpForMe', v)}
                  />
                  <PillGroup
                    label="When they're going through something, do you show up for them?"
                    options={SUPPORT_OPTIONS}
                    value={form.iShowUpForThem}
                    onChange={(v) => set('iShowUpForThem', v)}
                  />
                  <PillGroup
                    label="Do they know your big stuff — family, fears, goals?"
                    options={KNOWS_OPTIONS}
                    value={form.knowsAboutMe}
                    onChange={(v) => set('knowsAboutMe', v)}
                  />
                </>
              )}

              {/* ── Step 2: Context ── */}
              {STEPS[step].id === 'context' && (
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

              {/* ── Step 3: Interests ── */}
              {STEPS[step].id === 'interests' && (
                <>
                  <p className="apm-step-hint">Press Enter or comma to add each item.</p>
                  <TagInput label="Hobbies"        items={form.hobbies}       onChange={(v) => set('hobbies', v)}       placeholder="gaming, reading…" />
                  <TagInput label="Sports"         items={form.sports}        onChange={(v) => set('sports', v)}        placeholder="basketball, running…" />
                  <TagInput label="Favorite foods" items={form.favoritesFoods} onChange={(v) => set('favoritesFoods', v)} placeholder="ramen, sushi…" />
                  <TagInput label="Favorite music" items={form.favoritesMusic} onChange={(v) => set('favoritesMusic', v)} placeholder="hip-hop, indie rock…" />
                </>
              )}

              {/* ── Step 4: Memories ── */}
              {STEPS[step].id === 'memories' && (
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
