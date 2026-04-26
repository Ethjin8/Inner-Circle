import { useEffect, useState } from 'react';
import './CmdKNudge.css';

const FLAG_KEY = 'ic.cmdkNudgeShown';

function getModSymbol() {
  if (typeof navigator === 'undefined') return '⌘';
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
}

export default function CmdKNudge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let alreadyShown;
    try {
      alreadyShown = window.localStorage.getItem(FLAG_KEY) === '1';
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) return undefined;

    const showTimer = setTimeout(() => setVisible(true), 1500);
    const hideTimer = setTimeout(() => setVisible(false), 1500 + 4000);

    function dismissOnInteraction() {
      setVisible(false);
      window.removeEventListener('keydown', dismissOnInteraction);
      window.removeEventListener('mousedown', dismissOnInteraction);
    }
    window.addEventListener('keydown', dismissOnInteraction);
    window.addEventListener('mousedown', dismissOnInteraction);

    try {
      window.localStorage.setItem(FLAG_KEY, '1');
    } catch {
      // ignore
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      window.removeEventListener('keydown', dismissOnInteraction);
      window.removeEventListener('mousedown', dismissOnInteraction);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="cmdk-nudge" role="status" aria-live="polite">
      Press
      <span className="cmdk-nudge-key">{getModSymbol()}</span>
      <span className="cmdk-nudge-key">K</span>
      to find anyone
    </div>
  );
}
