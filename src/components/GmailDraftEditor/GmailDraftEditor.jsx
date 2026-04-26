import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import './GmailDraftEditor.css';

/**
 * GmailDraftEditor
 * Props:
 *   draft    — { subject, to, body }
 *   onClose  — called when the editor is dismissed
 */
export default function GmailDraftEditor({ draft, onClose }) {
  const [subject, setSubject] = useState(draft.subject || '');
  const [to, setTo]           = useState(draft.to || '');
  const [body, setBody]       = useState(draft.body || '');
  const [opened, setOpened]   = useState(false);

  const handleOpenInGmail = () => {
    // Build a mailto: link — opens Gmail compose with everything pre-filled
    const params = new URLSearchParams({
      to,
      subject,
      body,
    });
    // Gmail web compose URL (works even if Gmail isn't the default mail client)
    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailComposeUrl, '_blank');
    setOpened(true);
  };

  const handleCopy = () => {
    const full = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(full);
  };

  return (
    <div className="gmail-editor-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gmail-editor-card">
        {/* Header */}
        <div className="gmail-editor-header">
          <div className="gmail-editor-header-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <span>Email Draft</span>
            {opened && (
              <span className="gmail-editor-draft-link">✓ Opened in Gmail</span>
            )}
          </div>
          <button className="gmail-editor-close" onClick={onClose}>×</button>
        </div>

        {/* To */}
        <div className="gmail-editor-field">
          <label className="gmail-editor-label">To</label>
          <input
            className="gmail-editor-input"
            type="email"
            placeholder="recipient@example.com"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
        </div>

        {/* Subject */}
        <div className="gmail-editor-field">
          <label className="gmail-editor-label">Subject</label>
          <input
            className="gmail-editor-input"
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>

        <div className="gmail-editor-divider" />

        {/* Body */}
        <textarea
          className="gmail-editor-body"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={10}
          placeholder="Email body..."
        />

        {/* Footer */}
        <div className="gmail-editor-footer">
          <button className="gmail-editor-btn-ghost" onClick={handleCopy} title="Copy to clipboard">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>

          <div className="gmail-editor-actions">
            <button className="gmail-editor-btn-send" onClick={handleOpenInGmail}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              <span>{opened ? 'Open Again' : 'Open in Gmail'}</span>
              <ArrowUpRight size={14} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
