// server/embedCache.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmbedCache, buildEmbedString } from './embedCache.mjs';

function fakeEmbed(call) {
  return async (texts) => {
    call.count++;
    call.lastBatch = texts;
    return texts.map((_, i) => Float32Array.from([i, 0, 0]));
  };
}

test('buildEmbedString concatenates relevant fields', () => {
  const p = {
    id: '1', name: 'Mom',
    relationship: { type: 'family' },
    notes: 'kind',
    context: { hobbies: ['gardening', 'cooking'], work: 'teacher' },
    history: { memories_together: ['road trip'] },
  };
  const s = buildEmbedString(p);
  assert.match(s, /Mom/);
  assert.match(s, /family/);
  assert.match(s, /kind/);
  assert.match(s, /gardening/);
  assert.match(s, /cooking/);
  assert.match(s, /teacher/);
  assert.match(s, /road trip/);
});

test('getOrEmbedMany batches missing only and reuses cache on repeat', async () => {
  const call = { count: 0, lastBatch: null };
  const cache = createEmbedCache({ embed: fakeEmbed(call) });
  const people = [
    { id: '1', name: 'A', relationship: { type: 'family' } },
    { id: '2', name: 'B', relationship: { type: 'friend' } },
  ];
  const v1 = await cache.getOrEmbedMany(people);
  assert.equal(call.count, 1);
  assert.equal(call.lastBatch.length, 2);
  assert.equal(v1.size, 2);

  const v2 = await cache.getOrEmbedMany(people);
  assert.equal(call.count, 1, 'no new embed calls on cache hit');
  assert.equal(v2.size, 2);
});

test('content change invalidates that one person only', async () => {
  const call = { count: 0, lastBatch: null };
  const cache = createEmbedCache({ embed: fakeEmbed(call) });
  const people = [
    { id: '1', name: 'A', relationship: { type: 'family' } },
    { id: '2', name: 'B', relationship: { type: 'friend' } },
  ];
  await cache.getOrEmbedMany(people);
  assert.equal(call.count, 1);

  people[0].notes = 'changed';
  await cache.getOrEmbedMany(people);
  assert.equal(call.count, 2);
  assert.equal(call.lastBatch.length, 1, 'only the changed person re-embeds');
});

test('embedQuery calls embed once with the query string', async () => {
  const call = { count: 0, lastBatch: null };
  const cache = createEmbedCache({ embed: fakeEmbed(call) });
  const v = await cache.embedQuery('outdoorsy');
  assert.ok(v instanceof Float32Array);
  assert.equal(call.count, 1);
  assert.deepEqual(call.lastBatch, ['outdoorsy']);
});
