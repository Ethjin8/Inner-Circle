// src/services/chat.js
// Streams /api/chat. Calls onEvent({type, ...}) for each SSE event.
// Event types: 'text-delta' {delta}, 'tool-use' {name}, 'tool-result' {name, output},
// 'done' {}, 'error' {message}.

export async function streamChat({ messages, people, attachedNodeIds, signal }, onEvent) {
  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, people, attachedNodeIds }),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') return; // caller aborted; silent
    onEvent({ type: 'error', message: `network: ${err.message}` });
    return;
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    onEvent({ type: 'error', message: `http ${res.status}: ${text || res.statusText}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let sawDone = false;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE events are separated by blank lines. Parse complete events from buf.
      let sepIdx;
      while ((sepIdx = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, sepIdx);
        buf = buf.slice(sepIdx + 2);
        const lines = raw.split('\n');
        let evt = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) evt = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;
        try {
          const payload = JSON.parse(data);
          onEvent({ type: evt, ...payload });
          if (evt === 'done' || evt === 'error') sawDone = true;
        } catch {
          // skip malformed
        }
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) return; // caller aborted; silent
    onEvent({ type: 'error', message: `stream interrupted: ${err.message}` });
    return;
  }

  if (!sawDone) {
    onEvent({ type: 'error', message: 'stream closed without done event' });
  }
}
