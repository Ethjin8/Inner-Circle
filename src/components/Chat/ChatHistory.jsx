import { Trash2 } from 'lucide-react';

// Renders inside ChatModal (or anywhere the threads list is needed).
// Props:
//   threads: from useChatHistory
//   onOpenThread: (thread) => void
//   onDeleteThread: (id) => void

export default function ChatHistory({ threads, onOpenThread, onDeleteThread }) {
  if (threads.length === 0) {
    return <div className="chat-history-empty">No past chats yet</div>;
  }
  return (
    <div className="chat-history-list">
      {threads.map((t) => {
        const title = t.title?.trim() ? t.title : '(Untitled)';
        return (
          <div key={t.id} className="chat-history-item">
            <button
              type="button"
              className="chat-history-item-main"
              onClick={() => onOpenThread(t)}
              title={title}
            >
              <span className="chat-history-item-title">{title}</span>
              <span className="chat-history-item-time">{formatTime(t.createdAt)}</span>
            </button>
            <button
              type="button"
              className="chat-history-item-delete"
              onClick={(e) => { e.stopPropagation(); onDeleteThread(t.id); }}
              aria-label={`Delete chat "${title}"`}
              title="Delete"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const dayMs = 86_400_000;
  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / 3_600_000));
    if (hours < 24) return `${hours}h`;
  }
  const days = Math.floor(diffMs / dayMs);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
