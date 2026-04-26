# Constellation Chat Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a streaming, multi-turn Claude Sonnet 4.6 chat agent that uses each user's constellation as RAG context (3 read tools, Voyage embeddings) and persists chat threads per-user in Firestore.

**Architecture:** Browser modal owns the live thread; thin streaming client posts to `/api/chat`; server-side handler holds the system prompt, tool definitions, Voyage-backed semantic search (in-memory cache), and the Anthropic tool-use loop; thread persistence is direct from the browser to `users/{uid}/chats/{chatId}` via the Firestore client SDK (mirrors `usePeople` / `usePhotos`).

**Tech Stack:** React 19, Vite 8, `@anthropic-ai/sdk` (already installed), `firebase` client SDK (already installed), raw `fetch` for Voyage embeddings, `node --test` for unit tests, Server-Sent Events for streaming.

**Spec reference:** `docs/superpowers/specs/2026-04-25-constellation-chat-agent-design.md`

---

## File map

**Create:**
- `server/embedCache.mjs` — Voyage client + content-hashed in-memory cache
- `server/embedCache.test.mjs`
- `server/chatTools.mjs` — `getPersonDetails`, `findPeopleByAttribute`, `semanticSearch`
- `server/chatTools.test.mjs`
- `server/chatHandler.mjs` — system prompt, tool definitions, Anthropic streaming loop, SSE response
- `src/services/chat.js` — browser SSE client
- `src/hooks/useChatHistory.js` — Firestore adapter
- `src/hooks/useChatHistory.test.mjs`
- `src/components/Chat/ChatModal.jsx` — full-screen modal, owns thread state
- `src/components/Chat/ChatHistory.jsx` — right-side collapsible drawer
- `src/components/Chat/MessageBubble.jsx` — single message renderer
- `src/components/Chat/Chat.css` — chat-only styles

**Modify:**
- `vite.config.js` — mount `/api/chat`
- `src/App.jsx` — replace stub `handleSubmit`, render `<ChatHistory />`
- `src/components/Graph/ConstellationGraph.jsx` — shift-click → immediate attach
- `.gitignore` — confirm `.env` ignored
- `README.md` — `VOYAGE_API_KEY` setup line

**Delete (stale stubs):**
- `src/components/Chat/Chat.jsx`
- `src/services/ai.js`
- `src/services/firebase.js` (real init is at `src/lib/firebase.js`)

---

## Task 1: Embedding cache

**Files:**
- Create: `server/embedCache.mjs`
- Test: `server/embedCache.test.mjs`

The cache exposes `getOrEmbedMany(people)` and `embedQuery(text)`. It hashes each person's embed-string so edits invalidate per-person. Voyage access goes through an injected `embed` function so tests can stub it.

- [ ] **Step 1: Write failing test for hash stability and cache reuse**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="embedCache|getOrEmbedMany|buildEmbedString|embedQuery"`
Expected: FAIL — `Cannot find module './embedCache.mjs'`

- [ ] **Step 3: Implement embedCache**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="embedCache|getOrEmbedMany|buildEmbedString|embedQuery"`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add server/embedCache.mjs server/embedCache.test.mjs
git commit -m "Chat agent: Voyage-backed embedding cache with content-hash invalidation"
```

---

## Task 2: Chat tools (the three agent tools)

**Files:**
- Create: `server/chatTools.mjs`
- Test: `server/chatTools.test.mjs`

Three pure-ish functions. `getPersonDetails` and `findPeopleByAttribute` are synchronous + zero-dep. `semanticSearch` takes `embedCache` as a dependency for testability.

- [ ] **Step 1: Write failing tests**

```js
// server/chatTools.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPersonDetails, findPeopleByAttribute, semanticSearch } from './chatTools.mjs';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="getPersonDetails|findPeopleByAttribute|semanticSearch"`
Expected: FAIL — `Cannot find module './chatTools.mjs'`

- [ ] **Step 3: Implement chat tools**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="getPersonDetails|findPeopleByAttribute|semanticSearch"`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add server/chatTools.mjs server/chatTools.test.mjs
git commit -m "Chat agent: three read tools (get details, attribute filter, semantic search)"
```

---

## Task 3: Chat handler (Anthropic streaming loop, SSE response)

**Files:**
- Create: `server/chatHandler.mjs`

Receives `{messages, people, attachedNodeIds}`, builds system prompt with attached people's full JSON, opens an Anthropic stream with the three tool definitions, executes tool calls server-side, streams SSE events back to the browser. No unit test (the value is in the integration; smoke tests in Task 13 cover it).

- [ ] **Step 1: Implement chatHandler**

```js
// server/chatHandler.mjs
import Anthropic from '@anthropic-ai/sdk';
import { defaultEmbedCache } from './embedCache.mjs';
import { getPersonDetails, findPeopleByAttribute, semanticSearch } from './chatTools.mjs';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

const TOOLS = [
  {
    name: 'get_person_details',
    description: 'Fetch the full Person JSON for a given id. Use when the user references a person not in the attached set, or when you need fields beyond what the attached people show.',
    input_schema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'The person id from the constellation.' } },
    },
  },
  {
    name: 'find_people_by_attribute',
    description: 'Filter people by exact attribute match. Use for structured questions like "who in my family" or "who likes hiking" or "who goes to UCLA". Returns a minimal {id, name} list.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'e.g. family, friend, classmate, coworker, professional, romantic, mentor.' },
        hobby: { type: 'string', description: 'A single hobby keyword to substring-match against context.hobbies.' },
        school: { type: 'string', description: 'A school name to substring-match against context.school.' },
      },
    },
  },
  {
    name: 'semantic_search',
    description: 'Find people by meaning, not exact match. Use for fuzzy queries like "outdoorsy people", "good gift-givers", "creative types". Returns top matches with a short excerpt of why they matched.',
    input_schema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Natural-language description of the kind of person to find.' },
        limit: { type: 'integer', description: 'Max results (default 5).', minimum: 1, maximum: 10 },
      },
    },
  },
];

function buildSystemPrompt(people, attachedNodeIds) {
  const attached = people.filter((p) => attachedNodeIds.includes(p.id));
  return [
    "You are an assistant helping the user reason about their personal relationships.",
    "The user maintains a 'constellation' of people they know, each with structured fields (relationship type, hobbies, work, school, history of shared memories, etc.) and free-text notes.",
    "",
    "RULES:",
    "- Treat the attached_people block below as the user's current focus. Reference these people by name in your answer when relevant.",
    "- Missing or null fields mean 'unknown', not 'zero'. Do not invent facts.",
    "- When a question implies people not in attached_people (e.g. 'who else might like this', 'compare to X'), use the tools.",
    "- Use semantic_search for fuzzy/free-text matches, find_people_by_attribute for structured filters, get_person_details to pull full data on someone you found.",
    "- Keep answers concrete and actionable. Cite specific fields ('Mom's gardening hobby suggests...') rather than vague generalities.",
    "- The user's chat is informal. Match that tone; don't over-format.",
    "",
    "ATTACHED PEOPLE (full JSON):",
    JSON.stringify({ attached_people: attached }, null, 2),
  ].join('\n');
}

function sseWrite(res, type, data) {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function executeTool(name, input, ctx) {
  if (name === 'get_person_details') return getPersonDetails(input, ctx);
  if (name === 'find_people_by_attribute') return findPeopleByAttribute(input, ctx);
  if (name === 'semantic_search') {
    try {
      return await semanticSearch(input, ctx);
    } catch (err) {
      return { error: `search unavailable: ${err.message}` };
    }
  }
  return { error: `unknown tool: ${name}` };
}

async function runAgentLoop({ client, system, messages, tools, ctx, res }) {
  const convo = [...messages];
  // Soft cap to prevent infinite tool loops in case the model misbehaves.
  for (let turn = 0; turn < 8; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools,
      messages: convo,
    });

    const assistantBlocks = [];
    let currentToolUse = null;
    let currentToolJson = '';

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolUse = { ...event.content_block, input: {} };
          currentToolJson = '';
          sseWrite(res, 'tool-use', { name: currentToolUse.name });
        } else if (event.content_block.type === 'text') {
          assistantBlocks.push({ type: 'text', text: '' });
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          const last = assistantBlocks[assistantBlocks.length - 1];
          if (last?.type === 'text') last.text += event.delta.text;
          sseWrite(res, 'text-delta', { delta: event.delta.text });
        } else if (event.delta.type === 'input_json_delta') {
          currentToolJson += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolUse) {
          try { currentToolUse.input = currentToolJson ? JSON.parse(currentToolJson) : {}; }
          catch { currentToolUse.input = {}; }
          assistantBlocks.push({ ...currentToolUse });
          currentToolUse = null;
          currentToolJson = '';
        }
      }
    }

    convo.push({ role: 'assistant', content: assistantBlocks });

    const toolUses = assistantBlocks.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0) {
      sseWrite(res, 'done', {});
      return;
    }

    const toolResultsContent = [];
    for (const tu of toolUses) {
      const output = await executeTool(tu.name, tu.input, ctx);
      sseWrite(res, 'tool-result', { name: tu.name, output });
      toolResultsContent.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(output),
      });
    }
    convo.push({ role: 'user', content: toolResultsContent });
  }

  sseWrite(res, 'error', { message: 'Tool loop exceeded 8 turns' });
}

export function chatMiddleware() {
  return async (req, res, next) => {
    if (req.method !== 'POST' || !req.url.startsWith('/api/chat')) return next();
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const { messages, people, attachedNodeIds = [] } = body;
      if (!Array.isArray(messages) || !Array.isArray(people)) {
        res.statusCode = 400;
        res.end('Missing or invalid `messages` / `people`');
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        sseWrite(res, 'error', { message: 'ANTHROPIC_API_KEY not set' });
        res.end();
        return;
      }
      const client = new Anthropic({ apiKey });

      const ctx = { people, embedCache: defaultEmbedCache };
      const system = buildSystemPrompt(people, attachedNodeIds);

      // Pre-warm the embedding cache so semantic_search is fast on first use.
      // Failure is non-fatal — semantic_search will surface its own error.
      try { await defaultEmbedCache.getOrEmbedMany(people); }
      catch (err) { console.warn('[/api/chat] embed pre-warm failed:', err.message); }

      await runAgentLoop({ client, system, messages, tools: TOOLS, ctx, res });
      res.end();
    } catch (err) {
      console.error('[/api/chat] failed:', err);
      try { sseWrite(res, 'error', { message: err?.message || 'chat failed' }); res.end(); }
      catch { /* socket already closed */ }
    }
  };
}
```

- [ ] **Step 2: Commit (no test for this file — covered by smoke tests)**

```bash
git add server/chatHandler.mjs
git commit -m "Chat agent: server handler with Anthropic streaming, tool loop, SSE response"
```

---

## Task 4: Mount chat handler in Vite

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: Update vite.config.js**

Replace the existing file with:

```js
// vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { scoringMiddleware } from './server/scoringHandler.mjs'
import { chatMiddleware } from './server/chatHandler.mjs'

// Custom plugin: mount /api/score and /api/chat on the dev server. Handlers
// read API keys from process.env (NOT VITE_*) so they stay server-side.
function apiPlugin() {
  return {
    name: 'inner-circle-api',
    configureServer(server) {
      server.middlewares.use(scoringMiddleware())
      server.middlewares.use(chatMiddleware())
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Pull ALL env vars (not just VITE_*) into process.env so server-side
  // handlers can see ANTHROPIC_API_KEY and VOYAGE_API_KEY from .env.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v
  }

  return {
    plugins: [react(), apiPlugin()],
  }
})
```

- [ ] **Step 2: Verify dev server starts**

Run: `npm run dev` (in a background terminal or quick start/stop). Expected: starts without error, no missing-import warnings.

- [ ] **Step 3: Commit**

```bash
git add vite.config.js
git commit -m "Chat agent: mount /api/chat alongside /api/score"
```

---

## Task 5: Browser streaming client

**Files:**
- Create: `src/services/chat.js`

Thin SSE parser. No test — covered by smoke tests; mocking SSE properly is high-effort low-yield.

- [ ] **Step 1: Implement services/chat.js**

```js
// src/services/chat.js
// Streams /api/chat. Calls onEvent({type, ...}) for each SSE event.
// Event types: 'text-delta' {delta}, 'tool-use' {name}, 'tool-result' {name, output},
// 'done' {}, 'error' {message}.

export async function streamChat({ messages, people, attachedNodeIds }, onEvent) {
  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, people, attachedNodeIds }),
    });
  } catch (err) {
    onEvent({ type: 'error', message: `network: ${err.message}` });
    return;
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    onEvent({ type: 'error', message: `http ${res.status}: ${text || res.statusText}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let sawDone = false;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE events are separated by blank lines. Parse complete events from buf.
      let sepIdx;
      while ((sepIdx = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, sepIdx);
        buf = buf.slice(sepIdx + 2);
        const lines = raw.split('\n');
        let evt = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) evt = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;
        try {
          const payload = JSON.parse(data);
          onEvent({ type: evt, ...payload });
          if (evt === 'done' || evt === 'error') sawDone = true;
        } catch {
          // skip malformed
        }
      }
    }
  } catch (err) {
    onEvent({ type: 'error', message: `stream interrupted: ${err.message}` });
    return;
  }

  if (!sawDone) {
    onEvent({ type: 'error', message: 'stream closed without done event' });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/chat.js
git commit -m "Chat agent: browser SSE client"
```

---

## Task 6: Chat history hook (Firestore)

**Files:**
- Create: `src/hooks/useChatHistory.js`
- Test: `src/hooks/useChatHistory.test.mjs`

Mirrors `usePhotos.js` shape. Path: `users/{uid}/chats/{chatId}`. Test uses an in-memory stub of the Firestore primitives.

- [ ] **Step 1: Write failing test**

```js
// src/hooks/useChatHistory.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChatPath, makeThread } from './useChatHistory.js';

test('buildChatPath returns the expected per-user path segments', () => {
  assert.deepEqual(buildChatPath('uid-123'), ['users', 'uid-123', 'chats']);
});

test('makeThread builds a thread with id, createdAt, and a truncated title', () => {
  const t = makeThread({
    messages: [
      { role: 'user', content: 'help me plan a good gift for mom and dad for their anniversary in june please' },
    ],
    attachedNodeIds: ['1', '7'],
  });
  assert.ok(t.id);
  assert.ok(t.createdAt);
  assert.equal(t.attachedNodeIds.length, 2);
  assert.ok(t.title.length <= 60, 'title truncated to 60 chars');
  assert.ok(t.title.startsWith('help me plan'));
});

test('makeThread falls back to a generic title when no user message present', () => {
  const t = makeThread({ messages: [], attachedNodeIds: [] });
  assert.equal(t.title, 'New chat');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="buildChatPath|makeThread"`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useChatHistory**

```js
// src/hooks/useChatHistory.js
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

// Real-time subcollection: users/{uid}/chats/{chatId}
// Each chat doc stores { title, createdAt, messages, attachedNodeIds }.

export function buildChatPath(uid) {
  return ['users', uid, 'chats'];
}

export function makeThread({ messages, attachedNodeIds }) {
  const firstUser = (messages || []).find((m) => m.role === 'user');
  const raw = typeof firstUser?.content === 'string' ? firstUser.content : '';
  const title = raw.trim().slice(0, 60) || 'New chat';
  return {
    id: (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)),
    title,
    createdAt: new Date().toISOString(),
    messages: messages || [],
    attachedNodeIds: attachedNodeIds || [],
  };
}

export function useChatHistory() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);

  useEffect(() => {
    if (!user) { setThreads([]); return; }
    const ref = collection(db, ...buildChatPath(user.uid));
    return onSnapshot(ref, (snap) => {
      const next = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setThreads(next);
    });
  }, [user]);

  const chatRef = (id) => doc(db, ...buildChatPath(user.uid), id);

  const addThread = async (thread) => {
    if (!user) return;
    const { id, ...rest } = thread;
    await setDoc(chatRef(id), rest);
  };

  const deleteThread = async (id) => {
    if (!user) return;
    await deleteDoc(chatRef(id));
  };

  const getThread = (id) => threads.find((t) => t.id === id) ?? null;

  return { threads, addThread, deleteThread, getThread };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="buildChatPath|makeThread"`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useChatHistory.js src/hooks/useChatHistory.test.mjs
git commit -m "Chat agent: useChatHistory Firestore hook with title + id helpers"
```

---

## Task 7: MessageBubble component

**Files:**
- Create: `src/components/Chat/MessageBubble.jsx`

Renders one message. User messages right-aligned plain text; assistant messages left-aligned plain text (no markdown lib for now — keep deps minimal); tool calls render as a subtle inline status row.

- [ ] **Step 1: Implement MessageBubble**

```jsx
// src/components/Chat/MessageBubble.jsx
// Renders a single conversation entry. Three shapes:
//   { role: 'user',      text }
//   { role: 'assistant', text, toolEvents?: [{ name, status, summary? }] }
// `toolEvents` is an array of inline status rows captured during the assistant's turn.

export default function MessageBubble({ message }) {
  if (message.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="msg-bubble">{message.text}</div>
      </div>
    );
  }

  return (
    <div className="msg msg-assistant">
      {(message.toolEvents || []).map((ev, i) => (
        <div key={i} className={`tool-status ${ev.status}`}>
          {ev.status === 'running'
            ? <>🔍 {humanizeTool(ev.name)}…</>
            : <>✓ {humanizeTool(ev.name)} — {ev.summary}</>}
        </div>
      ))}
      <div className="msg-bubble">{message.text || (message.streaming ? '…' : '')}</div>
    </div>
  );
}

function humanizeTool(name) {
  if (name === 'get_person_details') return 'fetching person details';
  if (name === 'find_people_by_attribute') return 'filtering constellation';
  if (name === 'semantic_search') return 'searching constellation';
  return name;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Chat/MessageBubble.jsx
git commit -m "Chat agent: MessageBubble component"
```

---

## Task 8: ChatModal component

**Files:**
- Create: `src/components/Chat/ChatModal.jsx`

Owns the active thread state. Streams via `services/chat.js`. On close, persists via `useChatHistory.addThread` if there's at least one user message.

- [ ] **Step 1: Implement ChatModal**

```jsx
// src/components/Chat/ChatModal.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import { streamChat } from '../../services/chat';
import { makeThread } from '../../hooks/useChatHistory';

// Props:
//   open: boolean
//   onClose: () => void
//   people: full displayPeople array (for RAG + tool execution)
//   initialThread: { id?, messages?, attachedNodeIds? } | null  (for resuming from history)
//   initialPrompt: string                                       (seed text for first send)
//   initialAttachedNodeIds: string[]                            (chips at modal open)
//   addThread: (thread) => Promise<void>                        (from useChatHistory)

export default function ChatModal({
  open, onClose, people,
  initialThread, initialPrompt = '', initialAttachedNodeIds = [],
  addThread,
}) {
  const [messages, setMessages] = useState([]);
  const [attachedNodeIds, setAttachedNodeIds] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const scrollerRef = useRef(null);
  const autoSentRef = useRef(false);

  // Initialize / reset when modal opens.
  useEffect(() => {
    if (!open) return;
    autoSentRef.current = false;
    if (initialThread) {
      setThreadId(initialThread.id ?? null);
      setMessages(initialThread.messages ?? []);
      setAttachedNodeIds(initialThread.attachedNodeIds ?? []);
      setInput('');
    } else {
      setThreadId(null);
      setMessages([]);
      setAttachedNodeIds(initialAttachedNodeIds);
      setInput(initialPrompt);
    }
    setErrorMsg(null);
  // We intentionally only reset on `open` flipping true.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll to bottom on new content.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setErrorMsg(null);

    const userMsg = { role: 'user', text: trimmed, content: trimmed };
    const assistantMsg = { role: 'assistant', text: '', toolEvents: [], streaming: true, content: '' };
    const baseMessages = [...messages, userMsg];
    const draftMessages = [...baseMessages, assistantMsg];
    setMessages(draftMessages);
    setInput('');
    setStreaming(true);

    // Build the wire shape for the server: only role + content for prior turns.
    const wireMessages = baseMessages.map((m) => ({
      role: m.role,
      content: m.content ?? m.text ?? '',
    }));

    let buffered = '';
    await streamChat(
      { messages: wireMessages, people, attachedNodeIds },
      (ev) => {
        if (ev.type === 'text-delta') {
          buffered += ev.delta;
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.text = buffered;
            last.content = buffered;
            next[next.length - 1] = last;
            return next;
          });
        } else if (ev.type === 'tool-use') {
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.toolEvents = [...(last.toolEvents || []), { name: ev.name, status: 'running' }];
            next[next.length - 1] = last;
            return next;
          });
        } else if (ev.type === 'tool-result') {
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            const events = [...(last.toolEvents || [])];
            const idx = events.findLastIndex?.((e) => e.name === ev.name && e.status === 'running')
              ?? events.map((e) => e.name === ev.name && e.status === 'running').lastIndexOf(true);
            const summary = summarizeToolOutput(ev.output);
            if (idx >= 0) events[idx] = { name: ev.name, status: 'done', summary };
            last.toolEvents = events;
            next[next.length - 1] = last;
            return next;
          });
        } else if (ev.type === 'done') {
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.streaming = false;
            next[next.length - 1] = last;
            return next;
          });
        } else if (ev.type === 'error') {
          setErrorMsg(ev.message || 'Reply failed.');
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.streaming = false;
            next[next.length - 1] = last;
            return next;
          });
        }
      },
    );
    setStreaming(false);
  }, [messages, attachedNodeIds, people, streaming]);

  // Auto-send the seed prompt once when modal opens with initial input.
  useEffect(() => {
    if (!open || autoSentRef.current) return;
    if (!initialThread && initialPrompt && initialPrompt.trim()) {
      autoSentRef.current = true;
      send(initialPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const handleClose = useCallback(async () => {
    // Persist if we have at least one user message.
    const hasUser = messages.some((m) => m.role === 'user');
    if (hasUser) {
      const wireMessages = messages.map((m) => ({
        role: m.role,
        content: m.content ?? m.text ?? '',
      }));
      const thread = makeThread({ messages: wireMessages, attachedNodeIds });
      if (threadId) thread.id = threadId;
      try { await addThread(thread); } catch (err) { console.error('Save thread failed:', err); }
    }
    onClose?.();
  }, [messages, attachedNodeIds, threadId, addThread, onClose]);

  const handleNewChat = () => {
    setThreadId(null);
    setMessages([]);
    setAttachedNodeIds([]);
    setInput('');
    setErrorMsg(null);
    autoSentRef.current = true; // don't auto-send the initial prompt again
  };

  if (!open) return null;
  return (
    <div className="chat-modal-overlay" role="dialog" aria-modal="true">
      <div className="chat-modal">
        <header className="chat-modal-header">
          <button className="chat-new-btn" onClick={handleNewChat}>+ New Chat</button>
          <span className="chat-modal-title">Constellation Chat</span>
          <button className="chat-close-btn" onClick={handleClose} aria-label="Close">×</button>
        </header>

        {attachedNodeIds.length > 0 && (
          <div className="chat-attached">
            <span className="chat-attached-label">Context:</span>
            {attachedNodeIds.map((id) => {
              const p = people.find((x) => x.id === id);
              return <span key={id} className="chat-attached-chip">{p?.name ?? id}</span>;
            })}
          </div>
        )}

        <div className="chat-scroller" ref={scrollerRef}>
          {messages.length === 0 && (
            <div className="chat-empty">Ask anything about the people in your constellation.</div>
          )}
          {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
          {errorMsg && <div className="chat-error">{errorMsg}</div>}
        </div>

        <form className="chat-input-form" onSubmit={handleSubmit}>
          <input
            className="chat-input"
            type="text"
            placeholder={streaming ? 'Streaming…' : 'Ask a follow-up…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            autoFocus
          />
          <button className="chat-send-btn" type="submit" disabled={streaming || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function summarizeToolOutput(output) {
  if (!output) return '';
  if (output.error) return output.error;
  if (Array.isArray(output)) return `${output.length} match${output.length === 1 ? '' : 'es'}`;
  if (output.name) return `${output.name}`;
  return 'done';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Chat/ChatModal.jsx
git commit -m "Chat agent: ChatModal — multi-turn streaming, attached chips, save on close"
```

---

## Task 9: ChatHistory drawer

**Files:**
- Create: `src/components/Chat/ChatHistory.jsx`

Right-side collapsible drawer. Lists past threads from `useChatHistory`. Click reopens a thread. Hover shows delete.

- [ ] **Step 1: Implement ChatHistory**

```jsx
// src/components/Chat/ChatHistory.jsx
import { useState } from 'react';

// Props:
//   threads: from useChatHistory
//   onOpenThread: (thread) => void
//   onDeleteThread: (id) => void

export default function ChatHistory({ threads, onOpenThread, onDeleteThread }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        className="chat-history-pill"
        onClick={() => setOpen(true)}
        title="Past chats"
        aria-label="Open chat history"
      >
        💬 {threads.length > 0 ? threads.length : ''}
      </button>
    );
  }

  return (
    <aside className="chat-history-drawer">
      <header className="chat-history-header">
        <span>Past chats</span>
        <button onClick={() => setOpen(false)} aria-label="Collapse">›</button>
      </header>
      <div className="chat-history-list">
        {threads.length === 0 && (
          <div className="chat-history-empty">No saved chats yet.</div>
        )}
        {threads.map((t) => (
          <div key={t.id} className="chat-history-item">
            <button
              className="chat-history-item-main"
              onClick={() => onOpenThread(t)}
              title={t.title}
            >
              <div className="chat-history-item-title">{t.title}</div>
              <div className="chat-history-item-time">{formatTime(t.createdAt)}</div>
            </button>
            <button
              className="chat-history-item-delete"
              onClick={(e) => { e.stopPropagation(); onDeleteThread(t.id); }}
              aria-label="Delete chat"
              title="Delete"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Chat/ChatHistory.jsx
git commit -m "Chat agent: ChatHistory right-side collapsible drawer"
```

---

## Task 10: Chat-only styles

**Files:**
- Create: `src/components/Chat/Chat.css`
- Modify: `src/App.jsx` (single `import './components/Chat/Chat.css';` line at the top)

Minimalist styles consistent with the rest of the app (dark cosmic background, no gradients/glow, thin borders).

- [ ] **Step 1: Create Chat.css**

```css
/* src/components/Chat/Chat.css */

/* Modal overlay */
.chat-modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(10, 10, 15, 0.78);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px);
}
.chat-modal {
  width: min(720px, 92vw); height: min(80vh, 800px);
  background: #0e1018; color: #e8e8f0;
  border: 1px solid rgba(232, 232, 240, 0.14);
  border-radius: 10px;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.chat-modal-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(232, 232, 240, 0.1);
}
.chat-modal-title { flex: 1; font-size: 13px; opacity: 0.7; letter-spacing: 0.04em; }
.chat-new-btn, .chat-close-btn {
  background: transparent; color: #e8e8f0;
  border: 1px solid rgba(232, 232, 240, 0.18);
  border-radius: 6px; padding: 4px 10px;
  font-size: 12px; cursor: pointer;
}
.chat-close-btn { font-size: 18px; line-height: 1; padding: 2px 10px; }
.chat-new-btn:hover, .chat-close-btn:hover { background: rgba(232, 232, 240, 0.06); }

/* Attached chips inside modal */
.chat-attached {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 10px 16px; border-bottom: 1px solid rgba(232, 232, 240, 0.08);
  font-size: 12px;
}
.chat-attached-label { opacity: 0.5; margin-right: 4px; }
.chat-attached-chip {
  border: 1px solid rgba(232, 232, 240, 0.22);
  border-radius: 999px; padding: 2px 10px;
}

/* Scrolling transcript */
.chat-scroller {
  flex: 1; overflow-y: auto; padding: 16px 20px;
  display: flex; flex-direction: column; gap: 12px;
}
.chat-empty { opacity: 0.4; font-size: 13px; text-align: center; margin-top: 40px; }

/* Message bubbles */
.msg { display: flex; flex-direction: column; gap: 4px; }
.msg-user { align-items: flex-end; }
.msg-assistant { align-items: flex-start; }
.msg-bubble {
  max-width: 85%; padding: 10px 14px; border-radius: 10px;
  font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;
}
.msg-user .msg-bubble {
  background: rgba(125, 249, 255, 0.12);
  border: 1px solid rgba(125, 249, 255, 0.25);
}
.msg-assistant .msg-bubble {
  background: rgba(232, 232, 240, 0.05);
  border: 1px solid rgba(232, 232, 240, 0.1);
}

/* Inline tool status */
.tool-status {
  font-size: 11px; opacity: 0.55; padding: 2px 0;
  font-family: 'SF Mono', Menlo, monospace;
}
.tool-status.done { opacity: 0.4; }

.chat-error {
  color: #ff8c78; font-size: 12px; padding: 8px 12px;
  border: 1px solid rgba(255, 140, 120, 0.4); border-radius: 6px;
  background: rgba(255, 140, 120, 0.08);
}

/* Input */
.chat-input-form {
  display: flex; gap: 8px; padding: 12px 16px;
  border-top: 1px solid rgba(232, 232, 240, 0.1);
}
.chat-input {
  flex: 1; background: transparent; color: #e8e8f0;
  border: 1px solid rgba(232, 232, 240, 0.2);
  border-radius: 6px; padding: 8px 12px; font-size: 14px;
  outline: none;
}
.chat-input:focus { border-color: rgba(232, 232, 240, 0.4); }
.chat-send-btn {
  background: rgba(232, 232, 240, 0.12); color: #e8e8f0;
  border: 1px solid rgba(232, 232, 240, 0.2);
  border-radius: 6px; padding: 8px 16px; font-size: 13px;
  cursor: pointer;
}
.chat-send-btn:disabled { opacity: 0.4; cursor: default; }
.chat-send-btn:not(:disabled):hover { background: rgba(232, 232, 240, 0.2); }

/* History drawer pill (collapsed) */
.chat-history-pill {
  position: fixed; right: 16px; top: 50%; transform: translateY(-50%);
  background: rgba(14, 16, 24, 0.92); color: #e8e8f0;
  border: 1px solid rgba(232, 232, 240, 0.18);
  border-radius: 999px; padding: 8px 12px;
  font-size: 13px; cursor: pointer; z-index: 50;
  display: flex; align-items: center; gap: 6px;
}
.chat-history-pill:hover { background: rgba(232, 232, 240, 0.08); }

/* History drawer (expanded) */
.chat-history-drawer {
  position: fixed; right: 0; top: 0; bottom: 0;
  width: 280px; z-index: 50;
  background: rgba(14, 16, 24, 0.96);
  border-left: 1px solid rgba(232, 232, 240, 0.1);
  display: flex; flex-direction: column;
}
.chat-history-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(232, 232, 240, 0.08);
  font-size: 12px; opacity: 0.7; letter-spacing: 0.04em;
}
.chat-history-header button {
  background: transparent; color: #e8e8f0; border: none;
  font-size: 18px; cursor: pointer; opacity: 0.6;
}
.chat-history-header button:hover { opacity: 1; }
.chat-history-list { flex: 1; overflow-y: auto; padding: 8px; }
.chat-history-empty { padding: 16px; opacity: 0.4; font-size: 12px; text-align: center; }
.chat-history-item {
  display: flex; align-items: center;
  border-radius: 6px; margin-bottom: 4px;
}
.chat-history-item:hover { background: rgba(232, 232, 240, 0.04); }
.chat-history-item-main {
  flex: 1; background: transparent; color: #e8e8f0; border: none;
  text-align: left; padding: 8px 10px; cursor: pointer;
}
.chat-history-item-title { font-size: 13px; line-height: 1.3; }
.chat-history-item-time { font-size: 11px; opacity: 0.45; margin-top: 2px; }
.chat-history-item-delete {
  background: transparent; border: none; color: #e8e8f0; opacity: 0;
  padding: 6px 10px; cursor: pointer;
}
.chat-history-item:hover .chat-history-item-delete { opacity: 0.5; }
.chat-history-item-delete:hover { opacity: 1 !important; }
```

- [ ] **Step 2: Add CSS import to App.jsx**

In `src/App.jsx`, just below the existing `import './App.css';` line, add:

```js
import './components/Chat/Chat.css';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Chat/Chat.css src/App.jsx
git commit -m "Chat agent: chat styles (modal, bubbles, history drawer)"
```

---

## Task 11: Wire chat into App.jsx

**Files:**
- Modify: `src/App.jsx`

Replace stub `handleSubmit`. Open `ChatModal` seeded with current `attachedNodes` and `promptText`. Render `<ChatHistory />`. Support reopening past threads.

- [ ] **Step 1: Update App.jsx**

At the top of `src/App.jsx`, alongside the existing imports, add:

```js
import ChatModal from './components/Chat/ChatModal';
import ChatHistory from './components/Chat/ChatHistory';
import { useChatHistory } from './hooks/useChatHistory';
```

Inside the `App` function body, alongside the other `useState` calls (around line 49), add:

```js
const [chatModalOpen, setChatModalOpen] = useState(false);
const [chatInitialThread, setChatInitialThread] = useState(null);
const [chatInitialPrompt, setChatInitialPrompt] = useState('');
const [chatInitialAttachedIds, setChatInitialAttachedIds] = useState([]);
const { threads: chatThreads, addThread: addChatThread, deleteThread: deleteChatThread } = useChatHistory();
```

Replace the existing `handleSubmit` (around line 226-231) with:

```js
const handleSubmit = useCallback((e) => {
  e.preventDefault();
  if (!promptText.trim() && attachedNodes.length === 0) return;
  setChatInitialThread(null);
  setChatInitialPrompt(promptText);
  setChatInitialAttachedIds(attachedNodes.map((n) => n.id));
  setChatModalOpen(true);
  setPromptText('');
  setAttachedNodes([]);
}, [promptText, attachedNodes]);

const handleOpenThread = useCallback((thread) => {
  setChatInitialThread(thread);
  setChatInitialPrompt('');
  setChatInitialAttachedIds([]);
  setChatModalOpen(true);
}, []);
```

Just above the closing `</div>` of the top-level App `<div className="app">` (just before `<AddPersonModal ... />` near line 543), insert:

```jsx
<ChatHistory
  threads={chatThreads}
  onOpenThread={handleOpenThread}
  onDeleteThread={deleteChatThread}
/>
<ChatModal
  open={chatModalOpen}
  onClose={() => setChatModalOpen(false)}
  people={displayPeople}
  initialThread={chatInitialThread}
  initialPrompt={chatInitialPrompt}
  initialAttachedNodeIds={chatInitialAttachedIds}
  addThread={addChatThread}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "Chat agent: wire ChatModal + ChatHistory into App"
```

---

## Task 12: Shift-click as fast-attach gesture

**Files:**
- Modify: `src/components/Graph/ConstellationGraph.jsx`

In the existing `onClick` handler, when `e.shiftKey` is true, fire `onNodeDoubleClick` immediately and skip the 250ms timer.

- [ ] **Step 1: Patch onClick**

Find the `onClick` function (around line 515). Replace it with:

```js
const onClick = (e) => {
  if (dragState.active) return;
  if (dragState.suppressClick) { dragState.suppressClick = false; return; }
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
  if (activeTool === 'snip') { const edge = hitTestEdge(mx, my); if (edge) onSnip?.(edge); return; }
  const node = hitTest(mx, my);
  if (!node || node.isCenter) return;

  // Shift-click is a fast alias for double-click: skip the 250ms wait.
  if (e.shiftKey) {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    onNodeDoubleClick?.(node);
    return;
  }

  if (clickTimerRef.current) {
    clearTimeout(clickTimerRef.current); clickTimerRef.current = null;
    onNodeDoubleClick?.(node);
  } else {
    const cx = e.clientX; const cy = e.clientY;
    clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; onNodeClick?.(node, { x: cx, y: cy }); }, 250);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Graph/ConstellationGraph.jsx
git commit -m "Chat agent: shift-click as fast alias for double-click attach"
```

---

## Task 13: Env vars, README, delete stale stubs

**Files:**
- Modify: `.gitignore`, `README.md`
- Delete: `src/components/Chat/Chat.jsx`, `src/services/ai.js`, `src/services/firebase.js`

- [ ] **Step 1: Confirm `.gitignore` covers `.env`**

Run: `grep -n '^\.env' .gitignore`
Expected: line matching `.env` (or `.env*`). If not present, append:

```
.env
.env.local
```

- [ ] **Step 2: Add `VOYAGE_API_KEY` to README setup**

Find the section in `README.md` that documents `ANTHROPIC_API_KEY` (search: `ANTHROPIC_API_KEY`). Add a sibling line for Voyage. Example block to look for and extend:

```
ANTHROPIC_API_KEY=sk-ant-…   # offline scoring + online chat agent
VOYAGE_API_KEY=pa-…          # embeddings for the chat agent's semantic_search tool
```

If the README has no env-var section yet, add a small one near the install/dev instructions:

```markdown
## Environment

Create a `.env` at the repo root with:

```
ANTHROPIC_API_KEY=sk-ant-…   # offline scoring + online chat agent
VOYAGE_API_KEY=pa-…          # embeddings for the chat agent's semantic_search tool
```

These are read server-side by the Vite middleware in `vite.config.js` and never reach the browser.
```

- [ ] **Step 3: Delete stale stubs**

Run:
```bash
rm src/components/Chat/Chat.jsx src/services/ai.js src/services/firebase.js
```

(`src/lib/firebase.js` is the real Firebase init and stays.)

- [ ] **Step 4: Commit**

```bash
git add .gitignore README.md src/components/Chat/Chat.jsx src/services/ai.js src/services/firebase.js
git commit -m "Chat agent: env-var docs, .gitignore check, delete stale stubs"
```

---

## Task 14: Manual smoke test pass

No code. Walk the golden path with the dev server running. Stop and file fixes for anything broken.

- [ ] **Step 1: Start dev server with both keys set**

Run: `npm run dev`
Expected: starts cleanly, no missing-import or missing-env warnings. Open http://localhost:5173 (or the port shown).

- [ ] **Step 2: Smoke test — Demo flow**

Sign in. Toggle "Demo" on (top-right) so the demo people are visible. Shift-click Mom → confirm a chip appears in the bottom prompt area. Shift-click Dad → second chip. Type *"plan a good anniversary gift"* → press Enter.

Expected: ChatModal opens; assistant bubble fills via streaming; final answer references both Mom's hobbies (gardening, cooking) and Dad's hobbies (woodworking, hiking).

- [ ] **Step 3: Smoke test — Tool use visible**

In the same modal (or a new one), without any chips attached, type *"who in my life would enjoy hiking?"* and submit.

Expected: a `🔍 searching constellation…` status appears in the assistant bubble, then collapses to a one-line summary, then the assistant names matching people.

- [ ] **Step 4: Smoke test — `get_person_details` triggers**

Open chat with Mom attached only. Ask *"compare her to Dad"*.

Expected: a `🔍 fetching person details…` status appears (Claude pulls Dad on its own), then a comparison answer.

- [ ] **Step 5: Smoke test — History persistence**

Close the modal. Click the `💬` pill on the right edge → drawer opens.

Expected: the closed thread appears with a sensible title (the user's first prompt, truncated). Click it → modal reopens with full transcript visible. Type a follow-up → confirm streaming continues; close again; confirm the thread updates in place (same id), not duplicated.

- [ ] **Step 6: Smoke test — Cache reuse**

Open the chat modal twice in quick succession (close + reopen, ask a semantic question each time). Watch the dev-server terminal logs.

Expected: only one Voyage embed batch call across both opens. (Voyage SDK output isn't logged by default; if you don't see anything, that's the success signal — no extra request was made.)

- [ ] **Step 7: Smoke test — Cache invalidation on edit**

Open a person's modal, edit their hobbies, save. Reopen chat, ask a semantic question.

Expected: server logs (or behavior) consistent with re-embedding only that one person, not all 12+.

- [ ] **Step 8: Failure path — bad Voyage key**

Stop the dev server. Comment out or rename `VOYAGE_API_KEY` in `.env`. Restart. Open chat, ask a semantic question.

Expected: the modal still opens and Claude still responds (using the other two tools or just the attached context). The `semantic_search` tool may surface as an inline error or simply not be called. No red banner.

- [ ] **Step 9: Failure path — bad Anthropic key**

Stop the dev server. Comment out or rename `ANTHROPIC_API_KEY` in `.env`. Restart. Open chat, send any message.

Expected: red banner under the bubble: *"ANTHROPIC_API_KEY not set"* (or similar). Input stays usable; no crash.

- [ ] **Step 10: Restore keys, final clean-state run**

Restore both keys in `.env`. Restart dev server. Run the demo flow (Step 2) one more time end-to-end with no errors.

- [ ] **Step 11: Commit smoke-test pass note (optional)**

If everything passed, no code changes — skip the commit. If any step required fixes, commit those fixes with focused messages.

---

## Summary of what ships

- Streaming Sonnet 4.6 chat agent with three read tools (`get_person_details`, `find_people_by_attribute`, `semantic_search`).
- Voyage `voyage-3` embeddings, in-memory content-hash cache, batch-only-when-missing.
- Modal-based multi-turn UX with attached-chip context and inline tool-use status.
- Firestore-backed per-user chat history (`users/{uid}/chats/{chatId}`), real-time via `onSnapshot`, collapsible right-side drawer.
- Shift-click as fast alias for double-click attach.
- Server stays stateless; same Vite middleware pattern as `/api/score`; no Firebase Admin SDK, no service account.
