// server/chatTools.mjs
import { buildEmbedString } from './embedCache.mjs';

export function getPersonDetails({ id }, { people }) {
  const p = people.find((x) => x.id === id);
  return p ?? { error: 'not found' };
}

export function findPeopleByAttribute(args, { people }) {
  const { category, hobby, school } = args || {};
  const hobbyLc = hobby?.toLowerCase();
  const schoolLc = school?.toLowerCase();
  return people
    .filter((p) => {
      if (category && p.relationship?.type !== category) return false;
      if (hobbyLc) {
        const hobbies = (p.context?.hobbies || []).map((h) => h.toLowerCase());
        if (!hobbies.some((h) => h.includes(hobbyLc))) return false;
      }
      if (schoolLc) {
        const s = p.context?.school?.toLowerCase() || '';
        if (!s.includes(schoolLc)) return false;
      }
      return true;
    })
    .map((p) => ({ id: p.id, name: p.name }));
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Action tools. The server doesn't actually send mail or write a calendar —
// it validates the model's args and echoes a structured payload. The client
// reads the resulting tool-result event and opens the matching action modal
// (GmailDraftEditor / CalendarEventCard). Returning the same shape the model
// produced also lets it reference the action in its follow-up text.

export function draftEmail(args) {
  const { to = '', subject = '', body = '', summary = '' } = args || {};
  if (!body.trim()) return { error: 'body is required' };
  return {
    kind: 'email',
    to: String(to),
    subject: String(subject || 'Catching up'),
    body: String(body),
    summary: String(summary),
  };
}

export function createCalendarEvent(args) {
  const { title = '', description = '', startDate, endDate, location = '', attendeeName = '', summary = '' } = args || {};
  if (!title.trim()) return { error: 'title is required' };
  if (!startDate || isNaN(Date.parse(startDate))) return { error: 'startDate must be ISO 8601' };
  // Default endDate to 1h after start if missing/invalid.
  let end = endDate;
  if (!end || isNaN(Date.parse(end))) {
    end = new Date(Date.parse(startDate) + 60 * 60 * 1000).toISOString();
  }
  return {
    kind: 'calendar',
    title: String(title),
    description: String(description),
    startDate: new Date(startDate).toISOString(),
    endDate: new Date(end).toISOString(),
    location: String(location),
    attendeeName: String(attendeeName),
    summary: String(summary),
  };
}

export async function semanticSearch(args, { people, embedCache }) {
  const { query, limit = 5 } = args || {};
  const queryVec = await embedCache.embedQuery(query);
  const vecs = await embedCache.getOrEmbedMany(people);
  const ranked = people
    .map((p) => {
      const v = vecs.get(p.id);
      const score = v ? cosine(queryVec, v) : 0;
      return { id: p.id, name: p.name, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return ranked.map((r) => {
    const p = people.find((x) => x.id === r.id);
    const excerpt = (buildEmbedString(p) || '').slice(0, 80);
    return { ...r, matched_excerpt: excerpt };
  });
}
