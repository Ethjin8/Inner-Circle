import {
  TENURE_KEYS,
  FREQUENCY_KEYS,
  LAST_INTERACTION_KEYS,
  CHANNEL_KEYS,
  SUPPORT_KEYS,
  KNOWS_KEYS,
  RELATIONSHIP_TYPE_KEYS,
} from '../constants/personSchema.js';

const LIVE_MODEL = 'models/gemini-3.1-flash-live-preview';
const EXTRACT_MODEL = 'models/gemini-2.5-flash';

// ─── Person extraction (REST fallback) ───────────────────────────────────────

const EXTRACT_SCHEMA = '{"name":null,"birthday":null,"notes":null,"relationship":{"type":"friend","tenure":null,"frequency":null,"last_interaction":null,"channels":[],"they_show_up_for_me":null,"i_show_up_for_them":null,"knows_about_me":null},"context":{"how_we_met":null,"school":null,"work":null,"hobbies":[],"sports":[],"favorites":{"foods":[],"music":[]}},"history":{"memories_together":[],"important_events":[],"things_to_look_forward_to":[]}}';

const EXTRACT_PROMPT = `You are extracting contact information from a voice onboarding conversation.

Transcript:
{{TRANSCRIPT}}

Fill in the JSON below using only details explicitly mentioned. Rules:
- null for text fields that were not mentioned
- [] for array fields that were not mentioned
- relationship.type: one of family | friend | classmate | coworker | professional | romantic | mentor | other
- relationship.tenure: one of just_met | months | one_year | few_years | five_plus | lifetime, else null
- relationship.frequency: one of daily | weekly | monthly | few_times_a_year | rarely, else null
- relationship.last_interaction: one of today | this_week | this_month | this_season | this_year | over_a_year, else null
- relationship.channels: array (subset) of in_person | text | call | video_call | dm | email | other; [] if unmentioned
- relationship.they_show_up_for_me / i_show_up_for_them: one of yes | sometimes | not_really | not_sure, else null
- relationship.knows_about_me: one of most_of_it | some_of_it | not_really | not_sure, else null
- Map free-form phrasings to the closest enum (e.g. "every week" → weekly, "since high school" → few_years, "yeah definitely" → yes, "kind of" → sometimes).
- birthday: YYYY-MM-DD if a date was mentioned, otherwise null
- notes: a 1-3 sentence prose summary of the relationship in the user's own framing (closeness, cadence, emotional tone). null if there's nothing to summarize.

${EXTRACT_SCHEMA}`;

export async function extractPersonFromTranscript(transcript, apiKey, { maxRetries = 2, onRetry } = {}) {
  const prompt = EXTRACT_PROMPT.replace('{{TRANSCRIPT}}', transcript);
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${EXTRACT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
    );

    if (res.status === 429) {
      const errBody = await res.json().catch(() => ({}));
      const googleMsg = errBody?.error?.message ?? '';
      if (attempt === maxRetries - 1) throw new Error(googleMsg || 'Quota exceeded.');
      const retryAfterMs = Number(res.headers.get('Retry-After') ?? 0) * 1000 || 1000 * 2 ** (attempt + 1);
      onRetry?.(attempt + 1);
      await new Promise((r) => setTimeout(r, retryAfterMs));
      continue;
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Extract API error ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    return JSON.parse(text);
  }
}

// ─── Live session ─────────────────────────────────────────────────────────────

const WS_BASE_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

const DEFAULT_SYSTEM_PROMPT = `You are Inner Circle's onboarding voice agent.
Collect enough context to add a person to the user's relationship graph.

Flow:
1) Ask for the person's name and the user's relationship category (family / friend / classmate / coworker / professional / romantic / mentor / other).
2) Ask the seven Connection questions in order — these are the load-bearing signals. Ask them naturally, one at a time, in plain language. Do NOT list options to the user; map their answer internally to the closest enum.
   a) How long have you known them? (just_met / months / one_year / few_years / five_plus / lifetime)
   b) How often do you interact? (daily / weekly / monthly / few_times_a_year / rarely)
   c) When did you last talk or hang out? (today / this_week / this_month / this_season / this_year / over_a_year)
   d) How do you usually connect? (in_person / text / call / video_call / dm / email / other — multi-OK)
   e) When you're going through something, do they show up for you? (yes / sometimes / not_really / not_sure)
   f) When they're going through something, do you show up for them? (yes / sometimes / not_really / not_sure)
   g) Do they know your big stuff — family, fears, goals? (most_of_it / some_of_it / not_really / not_sure)
3) If the user is engaged, ask optional context: birthday, how you met, school/work, hobbies, memories. If the signal is thin or the user wants to wrap up, end early and summarize.

Style:
- Warm, concise, one question at a time.
- Map free-form answers to the closest enum value internally — don't list options to the user unless they ask. ("every week" → weekly; "yeah, definitely" → yes; "since high school" → few_years or five_plus.)
- Never ask for sensitive private data.
- Keep turns short for spoken conversation.

When the user sends the text "EXTRACT_JSON", respond ONLY with these labeled sentences — no extra commentary, say "unknown" for anything not mentioned, and ALWAYS use exactly these labels in this exact order:
"Name is [full name]. Relationship type is [family|friend|classmate|coworker|professional|romantic|mentor|other]. Tenure is [just_met|months|one_year|few_years|five_plus|lifetime|unknown]. Frequency is [daily|weekly|monthly|few_times_a_year|rarely|unknown]. Last interaction is [today|this_week|this_month|this_season|this_year|over_a_year|unknown]. Channels are [comma list of in_person|text|call|video_call|dm|email|other, or unknown]. They show up for me is [yes|sometimes|not_really|not_sure|unknown]. I show up for them is [yes|sometimes|not_really|not_sure|unknown]. Knows about me is [most_of_it|some_of_it|not_really|not_sure|unknown]. Birthday is [YYYY-MM-DD or unknown]. Notes are [a 1-3 sentence prose summary of the relationship in the user's own framing — closeness, cadence, emotional tone — or unknown]. How we met is [value or unknown]. School is [value or unknown]. Work is [value or unknown]. Hobbies are [comma list or unknown]. Sports are [comma list or unknown]. Favorite foods are [comma list or unknown]. Favorite music is [comma list or unknown]. Memories are [comma list or unknown]. Important events are [comma list or unknown]. Future plans are [comma list or unknown]."`;

// Parse the labeled-sentence response spoken by the model (ASR-friendly,
// no JSON needed). Exported for unit tests.
export function parseLabeledSpeech(raw) {
  const t = raw.toLowerCase().replace(/["""]/g, '');

  const field = (pattern) => {
    const m = t.match(pattern);
    if (!m) return null;
    const v = m[1].trim().replace(/\.$/, '');
    return (v === 'unknown' || v === 'none' || v === '') ? null : v;
  };

  const list = (pattern) => {
    const m = t.match(pattern);
    if (!m) return [];
    const v = m[1].trim().replace(/\.$/, '');
    if (v === 'unknown' || v === 'none' || v === '') return [];
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  };

  const enumField = (pattern, allowed) => {
    const v = field(pattern);
    return v && allowed.includes(v) ? v : null;
  };

  const name = field(/name is ([^.]+)/);
  const relTypeRaw = field(/relationship type is ([^.]+)/);
  const relType = RELATIONSHIP_TYPE_KEYS.find((r) => relTypeRaw?.includes(r)) ?? 'friend';

  const tenure           = enumField(/tenure is ([^.]+)/,           TENURE_KEYS);
  const frequency        = enumField(/frequency is ([^.]+)/,        FREQUENCY_KEYS);
  const lastInteraction  = enumField(/last interaction is ([^.]+)/, LAST_INTERACTION_KEYS);
  const channels         = list(/channels are ([^.]+)/).filter((c) => CHANNEL_KEYS.includes(c));
  const theyShowUp       = enumField(/they show up for me is ([^.]+)/, SUPPORT_KEYS);
  const iShowUp          = enumField(/i show up for them is ([^.]+)/,  SUPPORT_KEYS);
  const knowsAboutMe     = enumField(/knows about me is ([^.]+)/,      KNOWS_KEYS);

  const birthday = field(/birthday is ([\d-]+)/);

  // Notes can span multiple sentences (and contain periods), so terminate
  // on the next labeled field instead of on the first period.
  const notesMatch = t.match(/notes are (.+?)\s+how we met is /);
  const notesRaw = notesMatch?.[1]?.trim().replace(/\.$/, '') ?? null;
  const notes = (notesRaw === 'unknown' || !notesRaw) ? null : notesRaw;

  return {
    name,
    birthday: birthday || null,
    ...(notes ? { notes } : {}),
    relationship: {
      type: relType,
      tenure,
      frequency,
      last_interaction: lastInteraction,
      channels,
      they_show_up_for_me: theyShowUp,
      i_show_up_for_them: iShowUp,
      knows_about_me: knowsAboutMe,
    },
    context: {
      how_we_met: field(/how we met is ([^.]+)/),
      school:     field(/school is ([^.]+)/),
      work:       field(/work is ([^.]+)/),
      hobbies:    list(/hobbies are ([^.]+)/),
      sports:     list(/sports are ([^.]+)/),
      favorites: {
        foods: list(/favorite foods are ([^.]+)/),
        music: list(/favorite music is ([^.]+)/),
      },
    },
    history: {
      memories_together:        list(/memories are ([^.]+)/),
      important_events:         list(/important events are ([^.]+)/),
      things_to_look_forward_to: list(/future plans are ([^.]+)/),
    },
  };
}

export class GeminiLiveSession {
  constructor({
    apiKey,
    onMessage,
    onUserTranscript,
    onStatus,
    onError,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  }) {
    this.apiKey = apiKey;
    this.onMessage = onMessage;
    this.onUserTranscript = onUserTranscript;
    this.onStatus = onStatus;
    this.onError = onError;
    this.systemPrompt = systemPrompt;
    this.socket = null;
    this.setupComplete = false;

    // Accumulate output transcription chunks; emit one message per completed turn
    this.outputTranscriptBuffer = '';

    // Extraction state
    this._extractResolve = null;
    this._extractReject = null;
    this._extractTimeout = null;
    this._extracting = false;

    // Audio playback
    this.playbackCtx = null;
    this.nextPlayTime = 0;
  }

  // ─── Connection ──────────────────────────────────────────────────────────────

  connect() {
    if (!this.apiKey) {
      this.onError?.(new Error('Missing VITE_GEMINI_API_KEY in environment variables.'));
      return;
    }

    const url = `${WS_BASE_URL}?key=${encodeURIComponent(this.apiKey)}`;
    this.socket = new WebSocket(url);
    this.socket.binaryType = 'arraybuffer';

    this.socket.addEventListener('open', () => {
      this.onStatus?.('connecting');
      this.send({
        setup: {
          model: LIVE_MODEL,
          generationConfig: { responseModalities: ['AUDIO'], temperature: 0.4 },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: { parts: [{ text: this.systemPrompt }] },
        },
      });
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const raw =
          event.data instanceof ArrayBuffer
            ? new TextDecoder().decode(event.data)
            : event.data;
        const payload = JSON.parse(raw);

        if (payload?.setupComplete) {
          this.setupComplete = true;
          this.onStatus?.('connected');
          return;
        }

        const sc = payload?.serverContent;
        if (!sc) return;

        // User audio → forward streaming transcript for the preview display
        const inputText = sc.inputTranscription?.text;
        if (typeof inputText === 'string' && inputText.trim()) {
          this.onUserTranscript?.(inputText.trim());
        }

        // Model audio → play chunks (muted during extraction so user doesn't hear spoken JSON)
        if (!this._extracting) {
          for (const part of sc.modelTurn?.parts ?? []) {
            const { mimeType, data } = part.inlineData ?? {};
            if (data) this.playAudioChunk(data, mimeType);
          }
        }

        // Accumulate transcription; emit one clean message per completed turn
        const outputText = sc.outputTranscription?.text;
        if (typeof outputText === 'string') this.outputTranscriptBuffer += outputText;

        if (sc.turnComplete) {
          const finalText = this.outputTranscriptBuffer.trim();
          this.outputTranscriptBuffer = '';

          if (this._extracting) {
            // Resolve the extraction promise with the raw transcription
            this._finishExtraction(finalText);
          } else if (finalText) {
            this.onMessage?.(finalText);
          }
        }
      } catch (error) {
        this.onError?.(error);
      }
    });

    this.socket.addEventListener('close', (event) => {
      this.onStatus?.('closed');
      this.socket = null;
      this._cancelExtraction('Session closed during extraction');
      if (!event.wasClean || event.code !== 1000) {
        const reason = event.reason || `code ${event.code}`;
        this.onError?.(new Error(`Gemini Live closed: ${reason}`));
      }
    });

    this.socket.addEventListener('error', () => {
      // No actionable detail; the close event that follows will have the reason.
    });
  }

  // ─── Extraction via the open session ─────────────────────────────────────────

  requestExtraction() {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('Session not connected'));
        return;
      }
      this._extracting = true;
      this.outputTranscriptBuffer = '';
      this._extractResolve = resolve;
      this._extractReject = reject;

      this._extractTimeout = setTimeout(() => {
        this._cancelExtraction('Timed out waiting for model response');
      }, 15000);

      // The system prompt teaches the model to output JSON when it sees this command
      this.sendUserTurn('EXTRACT_JSON');
    });
  }

  _finishExtraction(text) {
    clearTimeout(this._extractTimeout);
    this._extracting = false;
    const resolve = this._extractResolve;
    const reject = this._extractReject;
    this._extractResolve = null;
    this._extractReject = null;

    // Try JSON first (legacy / if model somehow returns it)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { resolve(JSON.parse(jsonMatch[0])); return; } catch { /* fall through */ }
    }

    // Primary: parse labeled-sentence format ("Name is X. Relationship type is Y. ...")
    const parsed = parseLabeledSpeech(text);
    if (parsed.name) {
      resolve(parsed);
      return;
    }

    reject(new Error(`Could not extract data from: "${text.slice(0, 120)}"`));
  }

  _cancelExtraction(reason) {
    if (!this._extracting) return;
    clearTimeout(this._extractTimeout);
    this._extracting = false;
    this._extractReject?.(new Error(reason));
    this._extractResolve = null;
    this._extractReject = null;
  }

  // ─── Sending ─────────────────────────────────────────────────────────────────

  sendAudioChunk(audioBuffer, mimeType = 'audio/pcm;rate=16000') {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.setupComplete) return;
    if (!(audioBuffer instanceof ArrayBuffer) || audioBuffer.byteLength === 0) return;
    this.send({
      realtimeInput: { audio: { mimeType, data: this.arrayBufferToBase64(audioBuffer) } },
    });
  }

  sendUserTurn(text) {
    const cleanText = (text || '').trim();
    if (!cleanText || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: cleanText }] }],
        turnComplete: true,
      },
    });
  }

  disconnect() {
    this._cancelExtraction('Disconnected');
    this.outputTranscriptBuffer = '';
    this.stopPlayback();
    this.send({ realtimeInput: { audioStreamEnd: true } });
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close(1000, 'Voice onboarding stopped');
    }
    this.socket = null;
    this.setupComplete = false;
  }

  send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(payload));
  }

  // ─── Audio playback ──────────────────────────────────────────────────────────

  playAudioChunk(base64Data, mimeType = 'audio/pcm;rate=24000') {
    try {
      const rateMatch = mimeType?.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

      if (!this.playbackCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.playbackCtx = new AudioCtx();
        this.nextPlayTime = this.playbackCtx.currentTime;
      }

      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;

      const buffer = this.playbackCtx.createBuffer(1, float32.length, sampleRate);
      buffer.copyToChannel(float32, 0);

      const source = this.playbackCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.playbackCtx.destination);

      const startAt = Math.max(this.nextPlayTime, this.playbackCtx.currentTime);
      source.start(startAt);
      this.nextPlayTime = startAt + buffer.duration;
    } catch (_) {
      // Non-fatal — skip bad audio chunk
    }
  }

  stopPlayback() {
    if (this.playbackCtx) {
      this.playbackCtx.close().catch(() => {});
      this.playbackCtx = null;
      this.nextPlayTime = 0;
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
    }
    return btoa(binary);
  }
}
