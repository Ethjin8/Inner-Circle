// server/embedCache.mjs
import { createHash } from 'node:crypto';

export function buildEmbedString(person) {
  const parts = [];
  if (person.name) parts.push(person.name);
  if (person.relationship?.type) parts.push(person.relationship.type);
  if (person.notes) parts.push(person.notes);
  const c = person.context || {};
  if (c.hobbies?.length) parts.push(c.hobbies.join(', '));
  if (c.work) parts.push(c.work);
  if (c.school) parts.push(c.school);
  const h = person.history || {};
  if (h.memories_together?.length) parts.push(h.memories_together.join('. '));
  return parts.join(' | ');
}

function hashString(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

// Real Voyage embed function. Batch endpoint takes up to 128 strings.
async function voyageEmbed(texts) {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error('VOYAGE_API_KEY not set');
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'voyage-3', input: texts }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Voyage embed failed (${res.status}): ${text || res.statusText}`);
  }
  const json = await res.json();
  return json.data.map((d) => Float32Array.from(d.embedding));
}

// Factory: pass `{ embed }` (defaults to real Voyage) so tests can stub it.
export function createEmbedCache({ embed = voyageEmbed } = {}) {
  const cache = new Map(); // key: `${id}:${hash}`, value: Float32Array

  async function getOrEmbedMany(people) {
    const result = new Map(); // id -> Float32Array
    const missing = []; // [{ index, id, key, text }]
    for (const p of people) {
      const text = buildEmbedString(p);
      const key = `${p.id}:${hashString(text)}`;
      const cached = cache.get(key);
      if (cached) result.set(p.id, cached);
      else missing.push({ id: p.id, key, text });
    }
    if (missing.length > 0) {
      const vectors = await embed(missing.map((m) => m.text));
      missing.forEach((m, i) => {
        cache.set(m.key, vectors[i]);
        result.set(m.id, vectors[i]);
      });
    }
    return result;
  }

  async function embedQuery(text) {
    const [v] = await embed([text]);
    return v;
  }

  return { getOrEmbedMany, embedQuery };
}

// Default singleton wired to real Voyage.
export const defaultEmbedCache = createEmbedCache();
