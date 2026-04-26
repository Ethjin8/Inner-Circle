// src/components/Chat/MessageBubble.jsx
// Renders a single conversation entry. Two shapes:
//   { role: 'user',      content }
//   { role: 'assistant', content, toolEvents?: [{ name, status, summary? }] }
// During streaming the in-memory message also carries `text` (live buffer) and
// `streaming: true`; reloaded threads only have `content`.

export default function MessageBubble({ message }) {
  const body = message.text ?? message.content ?? '';
  const toolEvents = message.toolEvents || [];

  if (message.role === 'user') {
    if (!body) return null;
    return (
      <div className="msg msg-user">
        <div className="msg-bubble">{body}</div>
      </div>
    );
  }

  // Assistant: skip entirely if there's nothing to show (no text, no tools,
  // not actively streaming) — otherwise we'd render a ghost empty bubble.
  if (!body && !toolEvents.length && !message.streaming) return null;

  return (
    <div className="msg msg-assistant">
      {toolEvents.map((ev, i) => (
        <div key={i} className={`tool-status ${ev.status}`}>
          {ev.status === 'running'
            ? <>🔍 {humanizeTool(ev.name)}…</>
            : <>✓ {humanizeTool(ev.name)} — {ev.summary}</>}
        </div>
      ))}
      {(body || message.streaming) && (
        <div className="msg-bubble">{body || '…'}</div>
      )}
    </div>
  );
}

function humanizeTool(name) {
  if (name === 'get_person_details') return 'fetching person details';
  if (name === 'find_people_by_attribute') return 'filtering constellation';
  if (name === 'semantic_search') return 'searching constellation';
  return name;
}
