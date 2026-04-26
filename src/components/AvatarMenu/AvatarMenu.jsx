import { useEffect, useRef, useState } from 'react';
import { User, FlaskConical, LogOut } from 'lucide-react';
import './AvatarMenu.css';

export default function AvatarMenu({ email, demoOn, onToggleDemo, onSignOut }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (popoverRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="avatar-menu">
      <button
        ref={triggerRef}
        type="button"
        className="avatar-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User size={16} aria-hidden />
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="avatar-popover"
          role="menu"
        >
          {email && (
            <div className="avatar-email" title={email}>{email}</div>
          )}
          <button
            type="button"
            role="menuitem"
            className={`avatar-row ${demoOn ? 'avatar-row-active' : ''}`}
            onClick={() => onToggleDemo()}
          >
            <FlaskConical size={14} aria-hidden />
            <span className="avatar-row-label">Demo</span>
            <span className="avatar-row-value">{demoOn ? 'On' : 'Off'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="avatar-row"
            onClick={() => { setOpen(false); onSignOut(); }}
          >
            <LogOut size={14} aria-hidden />
            <span className="avatar-row-label">Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
