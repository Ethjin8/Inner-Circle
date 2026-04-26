import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmDialog.css';

let pushDialog = null;

export function confirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
} = {}) {
  return new Promise((resolve) => {
    if (!pushDialog) {
      resolve(false);
      return;
    }
    pushDialog({ title, message, confirmLabel, cancelLabel, destructive, resolve });
  });
}

export default function ConfirmDialogHost() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    pushDialog = setDialog;
    return () => { pushDialog = null; };
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  function close(value) {
    if (!dialog) return;
    dialog.resolve(value);
    setDialog(null);
  }

  if (!dialog) return null;

  return createPortal(
    <div
      className="confirm-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}
    >
      <div className="confirm-modal" role="dialog" aria-modal="true">
        {dialog.title && <div className="confirm-title">{dialog.title}</div>}
        <div className="confirm-message">{dialog.message}</div>
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn confirm-btn-cancel"
            onClick={() => close(false)}
          >
            {dialog.cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-btn ${dialog.destructive ? 'confirm-btn-danger' : 'confirm-btn-primary'}`}
            onClick={() => close(true)}
            autoFocus
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
