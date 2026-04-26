import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reduceRecents, MAX_RECENTS } from './useRecentPeople.js';

test('reduceRecents adds new id to front', () => {
  assert.deepEqual(reduceRecents([], 'a'), ['a']);
  assert.deepEqual(reduceRecents(['b', 'c'], 'a'), ['a', 'b', 'c']);
});

test('reduceRecents dedupes by moving existing id to front', () => {
  assert.deepEqual(reduceRecents(['b', 'a', 'c'], 'a'), ['a', 'b', 'c']);
  assert.deepEqual(reduceRecents(['a', 'b'], 'a'), ['a', 'b']);
});

test('reduceRecents caps length at MAX_RECENTS', () => {
  const long = Array.from({ length: MAX_RECENTS }, (_, i) => `id${i}`);
  const out = reduceRecents(long, 'new');
  assert.equal(out.length, MAX_RECENTS);
  assert.equal(out[0], 'new');
  assert.equal(out.includes(`id${MAX_RECENTS - 1}`), false);
});

test('reduceRecents ignores falsy id', () => {
  assert.deepEqual(reduceRecents(['a'], ''), ['a']);
  assert.deepEqual(reduceRecents(['a'], null), ['a']);
});
