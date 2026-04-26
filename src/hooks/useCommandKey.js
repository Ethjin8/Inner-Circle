import { useEffect } from 'react';

export function useCommandKey(handler, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;
    function onKeyDown(event) {
      if (event.key !== 'k' && event.key !== 'K') return;
      const isModified = event.metaKey || event.ctrlKey;
      if (!isModified) return;
      // Always intercept the chord — even from inputs — because plain "k" is unaffected.
      event.preventDefault();
      handler(event);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handler, enabled]);
}
