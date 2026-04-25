// Thin client for the Vite middleware at POST /api/score.
// The actual Anthropic call lives server-side in vite.config.js so the
// API key never ships to the browser. Returns the same `scoring` block
// shape that scripts/score.mjs writes.

export async function scorePerson(person) {
  const res = await fetch('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Scoring failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}
