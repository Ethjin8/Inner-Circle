import { useState } from 'react';

// Props:
//   threads: from useChatHistory
//   onOpenThread: (thread) => void
//   onDeleteThread: (id) => void

export default function ChatHistory({ threads, onOpenThread, onDeleteThread }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        className="chat-history-pill"
        onClick={() => setOpen(true)}
        title="Past chats"
        aria-label="Open chat history"
      >
        💬 {threads.length > 0 ? threads.length : ''}
      </button>
    );
  }

  return (
    <aside className="chat-history-drawer">
      <header className="chat-history-header">
        <span>Past chats</span>
        <button onClick={() => setOpen(false)} aria-label="Collapse">›</button>
      </header>
      <div className="chat-history-list">
        {threads.length === 0 && (
          <div className="chat-history-empty">No saved chats yet.</div>
        )}
        {threads.map((t) => (
          <div key={t.id} className="chat-history-item">
            <button
              className="chat-history-item-main"
              onClick={() => onOpenThread(t)}
              title={t.title}
            >
              <div className="chat-history-item-title">{t.title}</div>
              <div className="chat-history-item-time">{formatTime(t.createdAt)}</div>
            </button>
            <button
              className="chat-history-item-delete"
              onClick={(e) => { e.stopPropagation(); onDeleteThread(t.id); }}
              aria-label="Delete chat"
              title="Delete"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
