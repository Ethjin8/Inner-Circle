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
  const autoSentRef = useRef(false);
  const abortRef = useRef(null);

  // Initialize / reset when modal opens.
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }
    autoSentRef.current = false;
    if (initialThread) {
      setThreadId(initialThread.id ?? null);
      setMessages(initialThread.messages ?? []);
      setAttachedNodeIds(initialThread.attachedNodeIds ?? []);
      setInput('');
    } else {
      setThreadId(null);
      setMessages([]);
      setAttachedNodeIds(initialAttachedNodeIds);
      setInput(initialPrompt);
    }
    setErrorMsg(null);
  // We intentionally only reset on `open` flipping true.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll to bottom on new content.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setErrorMsg(null);

    // Abort any prior in-flight stream (defensive — should already be done).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg = { role: 'user', text: trimmed, content: trimmed };
    const assistantMsg = { role: 'assistant', text: '', toolEvents: [], streaming: true, content: '' };
    const baseMessages = [...messages, userMsg];
    const draftMessages = [...baseMessages, assistantMsg];
    setMessages(draftMessages);
    setInput('');
    setStreaming(true);

    // Build the wire shape for the server: only role + content for prior turns.
    const wireMessages = baseMessages.map((m) => ({
      role: m.role,
      content: m.content ?? m.text ?? '',
    }));

    let buffered = '';
    await streamChat(
      { messages: wireMessages, people, attachedNodeIds, signal: controller.signal },
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
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.toolEvents = [...(last.toolEvents || []), { name: ev.name, status: 'running' }];
            next[next.length - 1] = last;
            return next;
          });
        } else if (ev.type === 'tool-result') {
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            const events = [...(last.toolEvents || [])];
            const idx = events.findLastIndex((e) => e.name === ev.name && e.status === 'running');
            const summary = summarizeToolOutput(ev.output);
            if (idx >= 0) events[idx] = { name: ev.name, status: 'done', summary };
            last.toolEvents = events;
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
  }, [messages, attachedNodeIds, people, streaming]);

  // Auto-send the seed prompt once when modal opens with initial input.
  useEffect(() => {
    if (!open || autoSentRef.current) return;
    if (!initialThread && initialPrompt && initialPrompt.trim()) {
      autoSentRef.current = true;
      send(initialPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const handleClose = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    // Persist if we have at least one user message.
    const hasUser = messages.some((m) => m.role === 'user');
    if (hasUser) {
      const wireMessages = messages.map((m) => ({
        role: m.role,
        content: m.content ?? m.text ?? '',
      }));
      const thread = makeThread({ messages: wireMessages, attachedNodeIds });
      if (threadId) thread.id = threadId;
      try { await addThread(thread); } catch (err) { console.error('Save thread failed:', err); }
    }
    onClose?.();
  }, [messages, attachedNodeIds, threadId, addThread, onClose]);

  const handleNewChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setThreadId(null);
    setMessages([]);
    setAttachedNodeIds([]);
    setInput('');
    setErrorMsg(null);
    autoSentRef.current = true; // don't auto-send the initial prompt again
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
