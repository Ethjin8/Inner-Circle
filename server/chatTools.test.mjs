// server/chatTools.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPersonDetails, findPeopleByAttribute, semanticSearch, draftEmail, createCalendarEvent } from './chatTools.mjs';

const PEOPLE = [
  { id: '1', name: 'Mom', relationship: { type: 'family' },
    context: { hobbies: ['gardening', 'cooking'], school: null, work: 'teacher' },
    history: { memories_together: ['road trip'] } },
  { id: '2', name: 'Jake', relationship: { type: 'friend' },
    context: { hobbies: ['gaming', 'skateboarding'], school: 'UCLA', work: null } },
  { id: '3', name: 'Dad', relationship: { type: 'family' },
    context: { hobbies: ['hiking', 'woodworking'], work: 'engineer' } },
];

test('getPersonDetails returns full person on hit', () => {
  const r = getPersonDetails({ id: '2' }, { people: PEOPLE });
  assert.equal(r.name, 'Jake');
  assert.equal(r.context.school, 'UCLA');
});

test('getPersonDetails returns error on miss', () => {
  const r = getPersonDetails({ id: '999' }, { people: PEOPLE });
  assert.deepEqual(r, { error: 'not found' });
});

test('findPeopleByAttribute filters by category', () => {
  const r = findPeopleByAttribute({ category: 'family' }, { people: PEOPLE });
  assert.deepEqual(r.map((p) => p.id).sort(), ['1', '3']);
});

test('findPeopleByAttribute filters by hobby (case-insensitive substring)', () => {
  const r = findPeopleByAttribute({ hobby: 'HIKING' }, { people: PEOPLE });
  assert.deepEqual(r.map((p) => p.id), ['3']);
});

test('findPeopleByAttribute filters by school', () => {
  const r = findPeopleByAttribute({ school: 'UCLA' }, { people: PEOPLE });
  assert.deepEqual(r.map((p) => p.id), ['2']);
});

test('findPeopleByAttribute combines filters as AND', () => {
  const r = findPeopleByAttribute(
    { category: 'family', hobby: 'gardening' },
    { people: PEOPLE },
  );
  assert.deepEqual(r.map((p) => p.id), ['1']);
});

test('findPeopleByAttribute returns minimal {id, name} only', () => {
  const r = findPeopleByAttribute({ category: 'friend' }, { people: PEOPLE });
  assert.deepEqual(r, [{ id: '2', name: 'Jake' }]);
});

test('semanticSearch returns top-N by cosine similarity with excerpt', async () => {
  const fakeCache = {
    getOrEmbedMany: async () => new Map([
      ['1', Float32Array.from([1, 0, 0])],
      ['2', Float32Array.from([0, 1, 0])],
      ['3', Float32Array.from([0.9, 0.1, 0])],
    ]),
    embedQuery: async () => Float32Array.from([1, 0, 0]),
  };
  const r = await semanticSearch(
    { query: 'something', limit: 2 },
    { people: PEOPLE, embedCache: fakeCache },
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].id, '1');
  assert.equal(r[1].id, '3');
  assert.ok(r[0].score > r[1].score);
  assert.ok(typeof r[0].matched_excerpt === 'string');
});

test('semanticSearch defaults limit to 5', async () => {
  const vecs = new Map();
  for (let i = 0; i < 8; i++) vecs.set(String(i), Float32Array.from([i / 10, 0, 0]));
  const fakeCache = {
    getOrEmbedMany: async () => vecs,
    embedQuery: async () => Float32Array.from([1, 0, 0]),
  };
  const people = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `P${i}` }));
  const r = await semanticSearch({ query: 'x' }, { people, embedCache: fakeCache });
  assert.equal(r.length, 5);
});

test('draftEmail echoes a structured email payload', () => {
  const r = draftEmail({ to: 'mom@example.com', subject: 'Hi', body: 'Hey!', summary: 'sent hi' });
  assert.equal(r.kind, 'email');
  assert.equal(r.to, 'mom@example.com');
  assert.equal(r.subject, 'Hi');
  assert.equal(r.body, 'Hey!');
  assert.equal(r.summary, 'sent hi');
});

test('draftEmail rejects empty body', () => {
  const r = draftEmail({ to: 'a@b.com', subject: 'hi', body: '   ' });
  assert.deepEqual(r, { error: 'body is required' });
});

test('draftEmail defaults missing optional fields to empty strings / sane subject', () => {
  const r = draftEmail({ body: 'hello' });
  assert.equal(r.to, '');
  assert.equal(r.subject, 'Catching up');
});

test('createCalendarEvent normalizes ISO dates and defaults endDate', () => {
  const r = createCalendarEvent({
    title: 'Coffee with Jake',
    description: 'catching up',
    startDate: '2026-05-01T15:00:00Z',
    attendeeName: 'Jake',
  });
  assert.equal(r.kind, 'calendar');
  assert.equal(r.title, 'Coffee with Jake');
  assert.equal(r.startDate, '2026-05-01T15:00:00.000Z');
  assert.equal(r.endDate, '2026-05-01T16:00:00.000Z');
  assert.equal(r.attendeeName, 'Jake');
});

test('createCalendarEvent rejects missing title', () => {
  const r = createCalendarEvent({ startDate: '2026-05-01T15:00:00Z' });
  assert.deepEqual(r, { error: 'title is required' });
});

test('createCalendarEvent rejects bad startDate', () => {
  const r = createCalendarEvent({ title: 'x', startDate: 'not a date' });
  assert.deepEqual(r, { error: 'startDate must be ISO 8601' });
});
