// src/components/Chat/MessageBubble.jsx
// Q&A editorial format — no bubbles, no role labels.
// User questions render as large light headings; agent answers as body text beneath.
import { useState } from 'react';
import { Markdown } from '../../utils/markdown';

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
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* unavailable */ }
  };
  return (
    <button
      type="button"
      className={`msg-copy ${copied ? 'copied' : ''}`}
      onClick={handle}
      aria-label={copied ? 'Copied' : 'Copy'}
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

// User question — rendered as a large editorial heading.
export function QuestionBubble({ message }) {
  const body = message.text ?? message.content ?? '';
  if (!body) return null;
  return (
    <div className="msg msg-q">
      <p className="msg-q-text">{body}</p>
    </div>
  );
}

// Agent answer — rendered as flowing body text with optional tool metadata.
export function AnswerBubble({ message }) {
  const body = message.text ?? message.content ?? '';
  const toolEvents = message.toolEvents || [];

  if (!body && !toolEvents.length && !message.streaming) return null;

  return (
    <div className="msg msg-a">
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
        <div className="msg-a-body md-root">
          {body ? <Markdown source={body} /> : <StreamingDots />}
        </div>
      )}
      {body && !message.streaming && (
        <div className="msg-actions">
          <CopyButton text={body} />
        </div>
      )}
    </div>
  );
}

// Default export dispatches to the correct component.
export default function MessageBubble({ message }) {
  if (message.role === 'user') return <QuestionBubble message={message} />;
  return <AnswerBubble message={message} />;
}

function humanizeTool(name) {
  if (name === 'get_person_details')        return 'Fetching profile';
  if (name === 'find_people_by_attribute')  return 'Searching constellation';
  if (name === 'semantic_search')           return 'Searching memories';
  return name;
}
