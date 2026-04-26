import { useState, useEffect, useRef, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import { streamChat } from '../../services/chat';
import { makeThread } from '../../hooks/useChatHistory';

// Props:
//   open: boolean
//   onClose: () => void
//   people: full displayPeople array (for RAG + tool execution)
//   initialThread: { id?, messages?, attachedNodeIds? } | null  (for resuming from history)
//   initialPrompt: string                                       (seed text for first send)
//   initialAttachedNodeIds: string[]                            (chips at modal open)
//   addThread: (thread) => Promise<void>                        (from useChatHistory)

export default function ChatModal({
  open, onClose, people,
  initialThread, initialPrompt = '', initialAttachedNodeIds = [],
  addThread,
}) {
  const [messages, setMessages] = useState([]);
  const [attachedNodeIds, setAttachedNodeIds] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const scrollerRef = useRef(null);
  const abortRef = useRef(null);
  // Ref-backed streaming guard so send() can decide whether to early-return
  // without depending on a stale `streaming` closure.
  const streamingRef = useRef(false);

  // Auto-scroll to bottom on new content.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  // `priorMessagesOverride` and `threadIdOverride` let callers (notably the
  // auto-send effect right after a state reset) pass an explicit base instead
  // of inheriting the closure's stale state.
  const send = useCallback(async (text, attachedIdsOverride, priorMessagesOverride, threadIdOverride) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (streamingRef.current) return;
    streamingRef.current = true;
    setErrorMsg(null);

    // Abort any prior in-flight stream (defensive — should already be done).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const priorMessages = priorMessagesOverride ?? messages;
    const userMsg = { role: 'user', text: trimmed, content: trimmed };
    const assistantMsg = { role: 'assistant', text: '', toolEvents: [], streaming: true, content: '' };
    const baseMessages = [...priorMessages, userMsg];
    const draftMessages = [...baseMessages, assistantMsg];
    setMessages(draftMessages);
    setInput('');
    setStreaming(true);

    // Persist immediately so the thread shows up in history with a real title
    // even if the network fails or the user closes the modal mid-stream.
    let activeThreadId = threadIdOverride !== undefined ? threadIdOverride : threadId;
    if (!activeThreadId) {
      const seed = makeThread({
        messages: baseMessages.map((m) => ({ role: m.role, content: m.content ?? m.text ?? '' })),
        attachedNodeIds: attachedIdsOverride ?? attachedNodeIds,
      });
      activeThreadId = seed.id;
      setThreadId(activeThreadId);
      try { await addThread(seed); } catch (err) { console.error('Save thread (seed) failed:', err); }
    }

    // Build the wire shape for the server: only role + content for prior turns.
    const wireMessages = baseMessages.map((m) => ({
      role: m.role,
      content: m.content ?? m.text ?? '',
    }));

    let buffered = '';
    let localToolEvents = [];
    const idsForRequest = attachedIdsOverride ?? attachedNodeIds;
    await streamChat(
      { messages: wireMessages, people, attachedNodeIds: idsForRequest, signal: controller.signal },
      (ev) => {
        // Drop late events from an aborted stream.
        if (controller.signal.aborted) return;
        if (ev.type === 'text-delta') {
          buffered += ev.delta;
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.text = buffered;
            last.content = buffered;
            next[next.length - 1] = last;
            return next;
          });
        } else if (ev.type === 'tool-use') {
          localToolEvents = [...localToolEvents, { name: ev.name, status: 'running' }];
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.toolEvents = localToolEvents;
            next[next.length - 1] = last;
            return next;
          });
        } else if (ev.type === 'tool-result') {
          const idx = localToolEvents.findLastIndex((e) => e.name === ev.name && e.status === 'running');
          const summary = summarizeToolOutput(ev.output);
          if (idx >= 0) {
            localToolEvents = [...localToolEvents];
            localToolEvents[idx] = { name: ev.name, status: 'done', summary };
          }
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.toolEvents = localToolEvents;
            next[next.length - 1] = last;
            return next;
          });
        } else if (ev.type === 'done') {
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.streaming = false;
            next[next.length - 1] = last;
            return next;
          });
        } else if (ev.type === 'error') {
          setErrorMsg(ev.message || 'Reply failed.');
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.streaming = false;
            next[next.length - 1] = last;
            return next;
          });
        }
      },
    );
    setStreaming(false);
    streamingRef.current = false;

    // After the stream settles (success or error), persist the final transcript
    // so reload / history shows the assistant's response too. Skip the
    // assistant turn entirely if it produced nothing (no text and no tools) —
    // otherwise we'd save a ghost empty bubble.
    if (!controller.signal.aborted) {
      try {
        const wireBase = baseMessages.map((m) => ({
          role: m.role,
          content: m.content ?? m.text ?? '',
        }));
        const finalMessages = [...wireBase];
        if (buffered || localToolEvents.length) {
          const assistantEntry = { role: 'assistant', content: buffered };
          if (localToolEvents.length) assistantEntry.toolEvents = localToolEvents;
          finalMessages.push(assistantEntry);
        }
        const thread = makeThread({ messages: finalMessages, attachedNodeIds: idsForRequest });
        thread.id = activeThreadId;
        await addThread(thread);
      } catch (err) {
        console.error('Save thread (final) failed:', err);
      }
    }
  }, [messages, attachedNodeIds, people, threadId, addThread]);

  // Reset state on modal open, then auto-send if there's a seed prompt.
  // Crucially we pass an explicit empty base + null threadId into send() so
  // it can't inherit the previous chat's queued-but-unflushed state.
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      streamingRef.current = false;
      setStreaming(false);
      return;
    }
    streamingRef.current = false;
    setStreaming(false);
    setErrorMsg(null);
    if (initialThread) {
      setThreadId(initialThread.id ?? null);
      setMessages(initialThread.messages ?? []);
      setAttachedNodeIds(initialThread.attachedNodeIds ?? []);
      setInput('');
      return;
    }
    setThreadId(null);
    setMessages([]);
    setAttachedNodeIds(initialAttachedNodeIds);
    setInput('');
    if (initialPrompt && initialPrompt.trim()) {
      send(initialPrompt, initialAttachedNodeIds, [], null);
    }
  // Only on open transition. Caller is responsible for changing initialThread
  // / initialPrompt / initialAttachedNodeIds before flipping `open` to true.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    // send() already upserts on first message and on stream completion. Fire
    // a final flush in the background — never block the close on Firestore.
    const hasUser = messages.some((m) => (m.role === 'user') && (m.content || m.text));
    if (hasUser && threadId) {
      const wireMessages = messages
        .map((m) => {
          const content = m.content ?? m.text ?? '';
          if (m.role === 'user') return content ? { role: 'user', content } : null;
          if (!content && !(m.toolEvents && m.toolEvents.length)) return null;
          const out = { role: 'assistant', content };
          if (m.toolEvents && m.toolEvents.length) out.toolEvents = m.toolEvents;
          return out;
        })
        .filter(Boolean);
      const thread = makeThread({ messages: wireMessages, attachedNodeIds });
      thread.id = threadId;
      addThread(thread).catch((err) => console.error('Save thread failed:', err));
    }
    onClose?.();
  }, [messages, attachedNodeIds, threadId, addThread, onClose]);

  const handleNewChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    setStreaming(false);
    setThreadId(null);
    setMessages([]);
    setAttachedNodeIds([]);
    setInput('');
    setErrorMsg(null);
  };

  if (!open) return null;
  return (
    <div className="chat-modal-overlay" role="dialog" aria-modal="true">
      <div className="chat-modal">
        <header className="chat-modal-header">
          <button className="chat-new-btn" onClick={handleNewChat}>+ New Chat</button>
          <span className="chat-modal-title">Constellation Chat</span>
          <button className="chat-close-btn" onClick={handleClose} aria-label="Close">×</button>
        </header>

        {attachedNodeIds.length > 0 && (
          <div className="chat-attached">
            <span className="chat-attached-label">Context:</span>
            {attachedNodeIds.map((id) => {
              const p = people.find((x) => x.id === id);
              return <span key={id} className="chat-attached-chip">{p?.name ?? id}</span>;
            })}
          </div>
        )}

        <div className="chat-scroller" ref={scrollerRef}>
          {messages.length === 0 && (
            <div className="chat-empty">Ask anything about the people in your constellation.</div>
          )}
          {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
          {errorMsg && <div className="chat-error">{errorMsg}</div>}
        </div>

        <form className="chat-input-form" onSubmit={handleSubmit}>
          <input
            className="chat-input"
            type="text"
            placeholder={streaming ? 'Streaming…' : 'Ask a follow-up…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            autoFocus
          />
          <button className="chat-send-btn" type="submit" disabled={streaming || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function summarizeToolOutput(output) {
  if (!output) return '';
  if (output.error) return output.error;
  if (Array.isArray(output)) return `${output.length} match${output.length === 1 ? '' : 'es'}`;
  if (output.name) return `${output.name}`;
  return 'done';
}
