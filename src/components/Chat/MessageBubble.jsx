// src/components/Chat/MessageBubble.jsx
// Renders a single conversation entry. Two shapes:
//   { role: 'user',      content }
//   { role: 'assistant', content, toolEvents?: [{ name, status, summary? }] }
// During streaming the in-memory message also carries `text` (live buffer) and
// `streaming: true`; reloaded threads only have `content`.
import { useState } from 'react';
import { Markdown } from '../../utils/markdown';

// DS §6: no emoji in chrome — inline SVGs at 12-14px, stroke 1.5, currentColor.
function ToolIcon({ status }) {
  const common = {
    width: 12, height: 12, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    className: 'tool-status-icon', 'aria-hidden': true,
  };
  if (status === 'done') {
    return <svg {...common}><polyline points="20 6 9 17 4 12" /></svg>;
  }
  return <svg {...common}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}

function StreamingDots() {
  return (
    <span className="msg-streaming" aria-label="thinking">
      <span /><span /><span />
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button
      type="button"
      className={`msg-copy ${copied ? 'copied' : ''}`}
      onClick={onCopy}
      aria-label={copied ? 'Copied' : 'Copy message'}
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

export default function MessageBubble({ message }) {
  const body = message.text ?? message.content ?? '';
  const toolEvents = message.toolEvents || [];

  if (message.role === 'user') {
    if (!body) return null;
    return (
      <div className="msg msg-user">
        <span className="msg-role">You</span>
        <div className="msg-bubble">{body}</div>
      </div>
    );
  }

  // Assistant: skip entirely if there's nothing to show.
  if (!body && !toolEvents.length && !message.streaming) return null;

  return (
    <div className="msg msg-assistant">
      <span className="msg-role">Agent</span>
      {toolEvents.map((ev, i) => (
        <div key={i} className={`tool-status ${ev.status}`}>
          <ToolIcon status={ev.status} />
          <span className="tool-status-name">
            {ev.status === 'running'
              ? `${humanizeTool(ev.name)}…`
              : `${humanizeTool(ev.name)} — ${ev.summary}`}
          </span>
        </div>
      ))}
      {(body || message.streaming) && (
        <div className="msg-bubble md-root">
          {body ? <Markdown source={body} /> : <StreamingDots />}
          {body && !message.streaming && <CopyButton text={body} />}
        </div>
      )}
    </div>
  );
}

function humanizeTool(name) {
  if (name === 'get_person_details')        return 'Fetching person details';
  if (name === 'find_people_by_attribute')  return 'Filtering constellation';
  if (name === 'semantic_search')           return 'Searching constellation';
  return name;
}
