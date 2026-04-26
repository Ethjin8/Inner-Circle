import { useCallback, useEffect, useMemo, useState } from 'react';
import { pickNextColor, MAX_CATEGORIES } from '../lib/categoryPalette';

const STORAGE_KEY = 'inner-circle:categories:v1';

// Default eight match what the rest of the app already understands.
// `builtin: true` means the category cannot be deleted (scoring + onboarding
// reference these keys directly).
const DEFAULTS = [
  { key: 'family',       label: 'Family',       color: '#f5a25b', builtin: true },
  { key: 'friend',       label: 'Friends',      color: '#f3d24d', builtin: true },
  { key: 'romantic',     label: 'Romantic',     color: '#f9a3c0', builtin: true },
  { key: 'coworker',     label: 'Work',         color: '#5fd496', builtin: true },
  { key: 'classmate',    label: 'School',       color: '#7ea8ff', builtin: true },
  { key: 'mentor',       label: 'Mentors',      color: '#a884ff', builtin: true },
  { key: 'professional', label: 'Professional', color: '#f06d6d', builtin: true },
  { key: 'other',        label: 'Other',        color: '#bdc1c6', builtin: true },
];

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULTS;
    // Merge: keep stored entries (preserving custom additions + label edits),
    // but ensure every built-in still exists (in case storage was tampered).
    const seen = new Set(parsed.map((c) => c.key));
    const missingBuiltins = DEFAULTS.filter((d) => !seen.has(d.key));
    return [...parsed, ...missingBuiltins];
  } catch {
    return DEFAULTS;
  }
}

function persist(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

function makeKey(label) {
  const base = (label || 'category')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'category';
  return `cat_${base}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useCategories() {
  const [categories, setCategories] = useState(loadInitial);

  useEffect(() => { persist(categories); }, [categories]);

  const usedColors = useMemo(() => categories.map((c) => c.color), [categories]);
  const nextColor = useMemo(() => pickNextColor(usedColors), [usedColors]);
  const canAdd = categories.length < MAX_CATEGORIES && nextColor != null;

  const addCategory = useCallback((rawLabel) => {
    const label = (rawLabel || '').trim();
    if (!label) return { ok: false, reason: 'empty' };
    let result = { ok: false, reason: 'unknown' };
    setCategories((prev) => {
      const norm = label.toLowerCase();
      if (prev.some((c) => c.label.trim().toLowerCase() === norm)) {
        result = { ok: false, reason: 'duplicate' };
        return prev;
      }
      const used = prev.map((c) => c.color);
      const color = pickNextColor(used);
      if (!color) {
        result = { ok: false, reason: 'palette-full' };
        return prev;
      }
      const cat = { key: makeKey(label), label, color, builtin: false };
      result = { ok: true, category: cat };
      return [...prev, cat];
    });
    return result;
  }, []);

  const removeCategory = useCallback((key) => {
    setCategories((prev) => prev.filter((c) => c.key !== key || c.builtin));
  }, []);

  return { categories, addCategory, removeCategory, canAdd, nextColor };
}
