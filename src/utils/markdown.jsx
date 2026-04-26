// Lightweight markdown renderer for chat-style assistant messages.
// Supports: paragraphs, headings (# / ## / ###), bullet + ordered lists,
// fenced code blocks, inline code, bold, italic, links, horizontal rules.
// Deliberately small — extend here if a model output starts using something new.

import { Fragment } from 'react';

export function Markdown({ source = '' }) {
  const blocks = parseBlocks(source);
  return <>{blocks.map((b, i) => renderBlock(b, i))}</>;
}

// ────────────────────────── block parser ──────────────────────────

function parseBlocks(src) {
  const lines = src.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ``` fenced code block
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume closing fence (or EOF)
      blocks.push({ type: 'code', text: buf.join('\n') });
      continue;
    }

    // --- *** ___ → horizontal rule
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // # heading
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    // - / * / + → unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // 1. → ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // blank → block separator
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // paragraph: gather lines until blank or another block-starter
    const buf = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (
        /^\s*$/.test(next) ||
        /^```/.test(next) ||
        /^\s*(?:---|\*\*\*|___)\s*$/.test(next) ||
        /^#{1,3}\s+/.test(next) ||
        /^\s*[-*+]\s+/.test(next) ||
        /^\s*\d+\.\s+/.test(next)
      ) break;
      buf.push(next);
      i++;
    }
    blocks.push({ type: 'p', text: buf.join('\n') });
  }
  return blocks;
}

// ────────────────────────── block renderer ──────────────────────────

function renderBlock(block, key) {
  switch (block.type) {
    case 'p':
      return <p key={key} className="md-p">{renderInline(block.text)}</p>;
    case 'heading': {
      const Tag = `h${Math.min(6, block.level + 2)}`; // # → h3, ## → h4, ### → h5 visually
      return <Tag key={key} className={`md-h md-h${block.level}`}>{renderInline(block.text)}</Tag>;
    }
    case 'ul':
      return (
        <ul key={key} className="md-ul">
          {block.items.map((it, idx) => <li key={idx} className="md-li">{renderInline(it)}</li>)}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="md-ol">
          {block.items.map((it, idx) => <li key={idx} className="md-li">{renderInline(it)}</li>)}
        </ol>
      );
    case 'code':
      return (
        <pre key={key} className="md-pre">
          <code className="md-code-block">{block.text}</code>
        </pre>
      );
    case 'hr':
      return <hr key={key} className="md-hr" />;
    default:
      return null;
  }
}

// ────────────────────────── inline tokenizer ──────────────────────────
// Order matters: code first (opaque), then bold (** before *), then links, italics.

const INLINE_PATTERNS = [
  { type: 'code',   re: /`([^`]+)`/y },
  { type: 'bold',   re: /\*\*([^*]+)\*\*/y },
  { type: 'link',   re: /\[([^\]]+)\]\(([^)]+)\)/y },
  { type: 'italic', re: /\*([^*\s][^*]*)\*/y },
  { type: 'italic', re: /_([^_\s][^_]*)_/y },
];

function tokenizeInline(text) {
  const out = [];
  let i = 0;
  let buf = '';

  while (i < text.length) {
    let matched = null;
    for (const p of INLINE_PATTERNS) {
      p.re.lastIndex = i;
      const m = p.re.exec(text);
      if (m) { matched = { type: p.type, m }; break; }
    }
    if (matched) {
      if (buf) { out.push(buf); buf = ''; }
      const m = matched.m;
      if (matched.type === 'link') {
        out.push({ type: 'link', text: m[1], url: m[2] });
      } else {
        out.push({ type: matched.type, text: m[1] });
      }
      i += m[0].length;
    } else {
      buf += text[i];
      i++;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function renderInline(text) {
  const tokens = tokenizeInline(text);
  return tokens.map((t, i) => {
    if (typeof t === 'string') return <Fragment key={i}>{t}</Fragment>;
    if (t.type === 'code')   return <code key={i} className="md-code">{t.text}</code>;
    if (t.type === 'bold')   return <strong key={i} className="md-bold">{renderInline(t.text)}</strong>;
    if (t.type === 'italic') return <em key={i} className="md-italic">{renderInline(t.text)}</em>;
    if (t.type === 'link') {
      // Allow only http(s) and mailto. Anything else routes to "#" so we
      // never render javascript: URLs from a model.
      const safe = /^(https?:\/\/|mailto:)/i.test(t.url) ? t.url : '#';
      return (
        <a key={i} className="md-link" href={safe} target="_blank" rel="noreferrer noopener">
          {t.text}
        </a>
      );
    }
    return null;
  });
}
