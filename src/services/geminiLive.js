const LIVE_MODEL = 'models/gemini-2.0-flash-live-001';
const WS_BASE_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

const DEFAULT_SYSTEM_PROMPT = `You are Inner Circle's onboarding voice agent.
Collect enough context to add a person to the user's relationship graph.

Flow:
1) Ask for name + relationship category.
2) Ask optional birthday + category-relevant facts.
3) Ask shared history (memories, milestones, future plans).
4) If signal is thin, end early and summarize clearly.

Style:
- Warm, concise, one question at a time.
- Never ask for sensitive private data.
- Keep turns short for spoken conversation.`;

function readTextParts(parts = []) {
  return parts
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text;
      return '';
    })
    .join('')
    .trim();
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
  }

  connect() {
    if (!this.apiKey) {
      this.onError?.(new Error('Missing VITE_GEMINI_API_KEY in environment variables.'));
      return;
    }

    const url = `${WS_BASE_URL}?key=${encodeURIComponent(this.apiKey)}`;
    this.socket = new WebSocket(url);

    this.socket.addEventListener('open', () => {
      this.onStatus?.('connecting');
      this.send({
        setup: {
          model: LIVE_MODEL,
          generationConfig: {
            responseModalities: ['TEXT'],
            temperature: 0.4,
          },
          inputAudioTranscription: {},
          systemInstruction: {
            parts: [{ text: this.systemPrompt }],
          },
        },
      });
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.setupComplete) {
          this.setupComplete = true;
          this.onStatus?.('connected');
          return;
        }

        const inputTranscript = payload?.serverContent?.inputTranscription?.text;
        if (typeof inputTranscript === 'string' && inputTranscript.trim()) {
          this.onUserTranscript?.(inputTranscript.trim());
        }

        const parts = payload?.serverContent?.modelTurn?.parts;
        const text = readTextParts(parts);
        if (text) this.onMessage?.(text);
      } catch (error) {
        this.onError?.(error);
      }
    });

    this.socket.addEventListener('close', () => {
      this.onStatus?.('closed');
      this.socket = null;
    });

    this.socket.addEventListener('error', () => {
      this.onError?.(new Error('Gemini Live websocket error.'));
    });
  }

  sendUserTurn(text) {
    const cleanText = (text || '').trim();
    if (!cleanText || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    this.send({
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: cleanText }],
          },
        ],
        turnComplete: true,
      },
    });
  }

  disconnect() {
    this.send({ realtimeInput: { audioStreamEnd: true } });
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close(1000, 'Voice onboarding stopped');
    }
    this.socket = null;
    this.setupComplete = false;
  }

  sendAudioChunk(audioBuffer, mimeType = 'audio/pcm;rate=16000') {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.setupComplete) return;
    if (!(audioBuffer instanceof ArrayBuffer) || audioBuffer.byteLength === 0) return;

    const base64Audio = this.arrayBufferToBase64(audioBuffer);
    this.send({
      realtimeInput: {
        audio: {
          mimeType,
          data: base64Audio,
        },
      },
    });
  }

  send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(payload));
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      for (let j = 0; j < chunk.length; j += 1) {
        binary += String.fromCharCode(chunk[j]);
      }
    }
    return btoa(binary);
  }
}
