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

const SUGGESTIONS = [
  "Who haven't I been in touch with for a while?",
  "Who shares interests or a background with me?",
  "Who should I reach out to this week?",
];

export default function ChatModal({
  open, onClose, people,
  initialThread, initialPrompt = '', initialAttachedNodeIds = [],
  addThread, onAction,
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
          // Action tools (draft_email / create_calendar_event) carry a payload
          // the parent renders as a modal. Fire-and-forget — the chat stream
          // continues independently and the model still gets its tool_result.
          if (ev.output && !ev.output.error && (ev.output.kind === 'email' || ev.output.kind === 'calendar')) {
            try { onAction?.(ev.output); } catch (err) { console.error('onAction failed:', err); }
          }
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
  }, [messages, attachedNodeIds, people, threadId, addThread, onAction]);

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
    setStreaming(false);
    setErrorMsg(null);
    setStreaming(false);
    setErrorMsg(null);
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
    <div
      className="chat-modal-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="chat-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="chat-modal-header">
          {attachedNodeIds.length > 0 ? (
            <div className="chat-attached" style={{ border: 'none', padding: '0', flex: 1 }}>
              <span className="chat-attached-label">With:</span>
              {attachedNodeIds.map((id) => {
                const p = people.find((x) => x.id === id);
                return <span key={id} className="chat-attached-chip">{p?.name ?? id}</span>;
              })}
            </div>
          ) : (
            <span className="chat-modal-context-label">Constellation Chat</span>
          )}
          <div className="chat-modal-controls">
            <button className="chat-new-btn" onClick={handleNewChat} aria-label="Start a new chat">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New</span>
            </button>
            <button className="chat-close-btn" onClick={handleClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        <div className="chat-scroller" ref={scrollerRef}>
          <div className="chat-col">
            {messages.length === 0 && (
              <div className="chat-empty">
                <p className="chat-empty-headline">Your constellation.</p>
                <p className="chat-empty-sub">Ask about the people in your life — who to reach out to, what you know, who you might be forgetting.</p>
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" className="chat-suggestion" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                {/* Insert a visual break between each agent answer and the next user question */}
                {i > 0 && messages[i - 1].role === 'assistant' && m.role === 'user' && (
                  <div className="chat-sep" aria-hidden="true" />
                )}
                <MessageBubble message={m} />
              </div>
            ))}
            {errorMsg && <div className="chat-error">{errorMsg}</div>}
          </div>
        </div>

        <form className="chat-input-form" onSubmit={handleSubmit}>
          <div className="chat-input-pill">
            <input
              className="chat-input"
              type="text"
              placeholder={streaming ? 'Thinking…' : 'Ask about your constellation…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming}
              autoFocus
            />
            <button className="chat-send-btn" type="submit" disabled={streaming || !input.trim()} aria-label="Send">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function summarizeToolOutput(output) {
  if (!output) return '';
  if (output.error) return output.error;
  if (output.kind === 'email') return `draft ready${output.to ? ` for ${output.to}` : ''}`;
  if (output.kind === 'calendar') return `event ${output.title}`;
  if (Array.isArray(output)) return `${output.length} match${output.length === 1 ? '' : 'es'}`;
  if (output.name) return `${output.name}`;
  return 'done';
}
