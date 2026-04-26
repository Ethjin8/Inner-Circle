// src/components/Chat/MessageBubble.jsx
// Renders a single conversation entry. Three shapes:
//   { role: 'user',      text }
//   { role: 'assistant', text, toolEvents?: [{ name, status, summary? }] }
// `toolEvents` is an array of inline status rows captured during the assistant's turn.

export default function MessageBubble({ message }) {
  if (message.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="msg-bubble">{message.text}</div>
      </div>
    );
  }

  return (
    <div className="msg msg-assistant">
      {(message.toolEvents || []).map((ev, i) => (
        <div key={i} className={`tool-status ${ev.status}`}>
          {ev.status === 'running'
            ? <>🔍 {humanizeTool(ev.name)}…</>
            : <>✓ {humanizeTool(ev.name)} — {ev.summary}</>}
        </div>
      ))}
      <div className="msg-bubble">{message.text || (message.streaming ? '…' : '')}</div>
    </div>
  );
}

function humanizeTool(name) {
  if (name === 'get_person_details') return 'fetching person details';
  if (name === 'find_people_by_attribute') return 'filtering constellation';
  if (name === 'semantic_search') return 'searching constellation';
  return name;
}
