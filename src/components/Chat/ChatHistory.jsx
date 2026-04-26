// Sidebar section listing saved chat threads.
// Props:
//   threads: from useChatHistory
//   onOpenThread: (thread) => void
//   onDeleteThread: (id) => void

export default function ChatHistory({ threads, onOpenThread, onDeleteThread }) {
  if (threads.length === 0) {
    return <div className="sidebar-empty">No saved chats yet.</div>;
  }
  return (
    <div className="chat-history-list">
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
