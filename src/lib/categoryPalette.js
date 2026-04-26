// Ordered palette of perceptually-distant hues. Order is chosen so that
// consecutive picks land on opposite sides of the hue wheel — adjacent
// custom categories never collide visually (e.g., orange next to yellow).
// First 8 entries match the built-in --celestial-* tokens so seeded
// categories have stable colors with the rest of the app.
export const CATEGORY_PALETTE = [
  { id: 'amber',        hex: '#f5a25b' }, // built-in: family
  { id: 'classmate',    hex: '#7ea8ff' }, // built-in: classmate (blue)
  { id: 'friend',       hex: '#f3d24d' }, // built-in: friend (yellow)
  { id: 'mentor',       hex: '#a884ff' }, // built-in: mentor (violet)
  { id: 'coworker',     hex: '#5fd496' }, // built-in: coworker (green)
  { id: 'romantic',     hex: '#f9a3c0' }, // built-in: romantic (pink)
  { id: 'professional', hex: '#f06d6d' }, // built-in: professional (coral)
  { id: 'other',        hex: '#bdc1c6' }, // built-in: other (neutral)
  // additional palette entries for user-created categories, ordered by
  // hue-wheel distance from the built-ins above
  { id: 'cyan',         hex: '#4dd2e0' },
  { id: 'magenta',      hex: '#d878e8' },
  { id: 'lime',         hex: '#b4e34a' },
  { id: 'orange',       hex: '#ff8a3d' },
  { id: 'indigo',       hex: '#7d6dff' },
  { id: 'teal',         hex: '#4ddcaa' },
  { id: 'rose',         hex: '#ff7591' },
  { id: 'gold',         hex: '#e8c14d' },
];

const norm = (h) => (h || '').toString().trim().toLowerCase();

// Pick the first palette color not already in use. Returns null when
// every color is taken — caller should disable the "add" affordance.
export function pickNextColor(usedHexes) {
  const used = new Set((usedHexes || []).map(norm));
  for (const entry of CATEGORY_PALETTE) {
    if (!used.has(norm(entry.hex))) return entry.hex;
  }
  return null;
}

export const MAX_CATEGORIES = CATEGORY_PALETTE.length;
