import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ic.recentPeople';
export const MAX_RECENTS = 12;

export function reduceRecents(prev, id) {
  if (!id) return prev;
  const filtered = prev.filter((existing) => existing !== id);
  return [id, ...filtered].slice(0, MAX_RECENTS);
}

function readInitial() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function useRecentPeople() {
  const [ids, setIds] = useState(readInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // storage full / disabled — silently ignore
    }
  }, [ids]);

  const recordOpen = useCallback((id) => {
    setIds((prev) => reduceRecents(prev, id));
  }, []);

  return { recentIds: ids, recordOpen };
}
