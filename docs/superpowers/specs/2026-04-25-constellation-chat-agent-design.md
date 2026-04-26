# Constellation Chat Agent — Design

**Date:** 2026-04-25
**Status:** Approved, ready for implementation plan
**Related specs:** `2026-04-25-relationship-copilot-design.md` (umbrella vision), `2026-04-25-friction-reduction-design.md` (schema v2 fields the agent reads)

## Purpose

Add an online chat agent that lets the user ask questions about people in their constellation — gift planning, conversation prep, "who else might enjoy X" — using the actual JSON data attached to each node as RAG context, plus tool use to pull in related people on the fly.

This is the **online** counterpart to the offline scoring agent (`scripts/score.mjs` / `server/scoringHandler.mjs`). Two-agent demo story for judges: *offline scoring agent (anchored rubric, self-consistency) + online chat agent (structured RAG + tool use over the constellation)*.

## Non-goals

- Write tools (no `update_person_memory` — read-only agent).
- Auth on `/api/chat` (matches scoring's posture; fine for hackathon).
- Embedding-cache persistence across server restarts.
- Server-side chat storage (chats live in Firestore, written directly from the client — same pattern as `usePeople` / `usePhotos`).

## Architecture

```
Browser (React)                Vite middleware                External APIs
─────────────────              ──────────────                 ─────────────
ChatModal.jsx     ─POST──►    /api/chat                ──►   Anthropic
  ├─ thread state             chatHandler.mjs                (Sonnet 4.6,
  ├─ input box                ├─ system prompt                tools, stream)
  └─ assistant bubbles        ├─ tool definitions
       ▲                      ├─ tool executor ──semantic──► Voyage
       │                      │                  search        (voyage-3)
  services/chat.js  ◄─SSE─────┘
                              ┌────────────────────────┐
                              │ embedCache (in-memory) │
                              └────────────────────────┘

ChatHistory.jsx ◄─── Firestore: users/{uid}/chats/{chatId}
  (right drawer,        (real-time onSnapshot, per-user scoped,
   collapsible)          mirrors usePeople / usePhotos pattern)
```

**Key decisions:**

- **Model:** Claude Sonnet 4.6, streaming. Sonnet beats Haiku on multi-tool reasoning over structured data; streaming hides Sonnet's latency disadvantage vs Haiku/Grok behind typewriter perception.
- **Embeddings:** Voyage `voyage-3` via batch endpoint. In-memory `Map<"id:hash", Vector>` cache on the server. No vector DB (n ≈ 15; cosine over a small `Map` is microseconds).
- **Stateless server:** every `/api/chat` POST sends `{messages, people, attachedNodeIds}`. The server doesn't hold any per-user state. Cache key includes a content hash, so edits invalidate per-person, not globally.
- **Persistence:** chat threads saved to Firestore at `users/{uid}/chats/{chatId}` on modal close (if thread has ≥1 user message). Per-user scoped via signed-in `user.uid`. Right-side `ChatHistory` drawer lists past threads via real-time `onSnapshot`, click to reopen, defaults collapsed on first load. Survives browser clears, syncs across the user's devices, offline writes queue automatically (Firestore SDK handles).
- **Modal flow:** modal opens with seeded `attachedNodes` + `initialPrompt` from the existing prompt area; multi-turn within session; close persists.

## Components

**Frontend (React):**

| File | Responsibility |
|---|---|
| `src/components/Chat/ChatModal.jsx` | Full-screen modal overlay. Owns active thread state, input box, scrolling transcript, "New Chat" + close buttons. Handles streaming token append. |
| `src/components/Chat/ChatHistory.jsx` | Right-side collapsible drawer listing past threads. Click to reopen, hover to delete. Toggle pill on right edge when collapsed. |
| `src/components/Chat/MessageBubble.jsx` | Renders one message. User right-aligned plain text; assistant left-aligned with markdown; tool calls render as inline status that collapses on tool result. |
| `src/hooks/useChatHistory.js` | Firestore adapter for `users/{uid}/chats/{chatId}`. Real-time list via `onSnapshot`; writes via `setDoc`; deletes via `deleteDoc`. Mirrors `usePhotos.js` shape. Exposes `{threads, addThread, deleteThread, getThread}`. Returns `{threads: []}` while no user is signed in. |
| `src/services/chat.js` | Thin streaming client. `streamChat({messages, people, attachedNodeIds}, onEvent)` — fetches `/api/chat`, parses SSE, dispatches `text-delta` / `tool-use` / `tool-result` / `done` / `error` events. |

**Server (Vite middleware):**

| File | Responsibility |
|---|---|
| `server/chatHandler.mjs` | Receives POST, builds system prompt (with attached people's full JSON), ensures embeddings cached for incoming people, runs Anthropic streaming call with tool use, executes tools server-side against the request's people array, loops until Claude stops requesting tools, streams SSE throughout. |
| `server/embedCache.mjs` | In-memory `Map`. Exports `getOrEmbedMany(people)` (batch missing only) and `embedQuery(text)`. Voyage SDK lives only in this file. |

**Wiring changes:**

| File | Change |
|---|---|
| `vite.config.js` | Mount `chatHandler` at `POST /api/chat`, mirroring the existing `/api/score` mount. |
| `src/App.jsx` | Replace stub `handleSubmit` with: open `ChatModal` seeded with `attachedNodes` and `promptText`. Render `<ChatHistory />` on right edge. |
| `src/components/Graph/ConstellationGraph.jsx` | In `onClick`, if `e.shiftKey` is true, fire `onNodeDoubleClick` immediately (skip the 250ms click-vs-doubleclick timer). |
| `.env`, `.gitignore`, `README.md` | Add `VOYAGE_API_KEY=…`. Ensure `.env` is gitignored. README setup section gains the Voyage key step. |

**Boundary properties:**

- `ChatModal` knows nothing about embeddings, Voyage, or tools — only consumes the SSE event stream.
- `embedCache` is the only file that imports the Voyage SDK. Swapping providers = one-file change.
- `useChatHistory` is the only file that touches Firestore. Schema migration or backend swap = one-file change.

## Data flow

End-to-end for one interaction. User has shift-clicked Mom and Dad → both are chips. Types *"plan a good anniversary gift"* → submits.

**1. Browser submits:** `App.jsx` opens `ChatModal` seeded with `attachedNodeIds: ['1', '7']` and `initialPrompt`. `ChatModal` mounts and via `services/chat.js` POSTs to `/api/chat`:

```json
{
  "messages": [{"role": "user", "content": "plan a good anniversary gift"}],
  "people": [/* full array of all displayPeople, ~12KB */],
  "attachedNodeIds": ["1", "7"]
}
```

**2. Server prepares context (`chatHandler.mjs`):**
- Walks `people`, hashes each one's content fields, calls `embedCache.getOrEmbedMany()` to fill cache misses (one Voyage batch call on first request of session; zero on subsequent).
- Builds system prompt: tool-use rules + an `attached_people` block containing the **full Person JSON** for ids `1` and `7`.
- Builds tool list: `get_person_details`, `find_people_by_attribute`, `semantic_search`.
- Opens Anthropic stream.

**3. Agent loop (server-side):**

```
loop:
  for each event from Anthropic stream:
    if text_delta:    → SSE "text-delta"   to browser
    if tool_use:      → SSE "tool-use"     {name, input}
                      → execute tool against request's people / cache
                      → SSE "tool-result"  {output}
                      → feed result into next Anthropic call
  if Claude stops requesting tools: → SSE "done", break
```

**4. Tool semantics:**

| Tool | Input | Output |
|---|---|---|
| `get_person_details` | `{id: string}` | Full Person JSON, or `{error: "not found"}` |
| `find_people_by_attribute` | `{category?, hobby?, school?}` (any subset) | `[{id, name}]` of exact-match filter results |
| `semantic_search` | `{query: string, limit?: number}` | `[{id, name, score, matched_excerpt}]` — top-`limit` by cosine similarity, with the highest-contributing field's first 80 chars as `matched_excerpt` so Claude knows *why* the match. Default `limit` is 5. |

**5. Browser renders stream events** (`ChatModal` via `services/chat.js`):
- `text-delta` → append to active assistant bubble.
- `tool-use` → insert inline status: *"🔍 searching constellation for 'outdoorsy people'…"*.
- `tool-result` → collapse status to one-line summary: *"found 4 matches"*.
- `done` → freeze bubble, re-enable input.

**6. Multi-turn:** follow-up reuses the open modal. `messages` includes prior turns; `people` re-sent (cheap, cache warm); zero new Voyage calls unless someone was edited between turns.

**7. Modal close:** if thread has ≥1 user message, `useChatHistory.addThread({id, title, createdAt, messages, attachedNodeIds})` writes to `users/{uid}/chats/{chatId}` via `setDoc`. Title is the user's first prompt, truncated to 60 chars. `chatId` is a client-generated UUID (or `crypto.randomUUID()`) — same approach as `usePeople`. `ChatHistory` drawer updates automatically via the open `onSnapshot` listener. Modal unmounts.

**8. Reopen from history:** click thread in drawer → modal opens with `messages` and `attachedNodeIds` restored. **No auto-send.** User can read or continue. Continuing a thread updates the existing Firestore doc on next close (same `chatId`, `setDoc` overwrites).

## Embedding details

**What gets embedded per person:** concatenation of `name`, `relationship.type`, `notes`, `context.hobbies` (joined), `context.work`, `history.memories_together` (joined). Skips numeric/structured fields (strength, dates, enums) since cosine over those is meaningless.

**Hash:** SHA-256 of the embedded-string above. Stable across requests, changes only when content changes.

**Cache shape:** `Map<string, Float32Array>` keyed `"${personId}:${hash}"`. Entries are never evicted within a server-process lifetime (n is small). Restarting `npm run dev` warms the cache fresh on the next chat.

**Voyage call shape:** `voyage-3` via the embeddings endpoint, batch input. Missing-only — server walks the people list, collects only those whose `(id, hash)` aren't cached, sends them as one batch.

**Query embedding:** `embedCache.embedQuery(text)` is a one-off Voyage call per `semantic_search` invocation. Not cached (queries are unique).

## Error handling

| Failure | Server behavior | User-facing |
|---|---|---|
| Anthropic API error (5xx, network, bad key) | Catch in `chatHandler`, send SSE `{type: 'error', message}`, close stream. | Red banner under last bubble: *"Reply failed: <message>. Try again."* Input stays enabled, thread preserved. |
| Anthropic rate limit (429) | Same envelope, message specialized. | *"Rate limited — give it a moment."* |
| Voyage call fails during `semantic_search` | Tool returns `{error: "search unavailable"}` to Claude. | None — Claude continues with other tools, degrades gracefully. |
| Voyage fails during initial batch embed | Omit `semantic_search` from tool list for this request. Log warning. | None — chat works with two tools instead of three. |
| Claude calls a tool with malformed input | Tool executor validates against schema; returns `{error: "invalid input: <reason>"}`. | None — Claude self-corrects on next turn. |
| Stream interrupted mid-reply | Client detects `close` without `done` event. | Banner: *"Connection lost — partial reply saved. Send to retry."* Partial bubble preserved. |
| Firestore offline / write fails | Firestore SDK queues writes locally and flushes on reconnect — handled automatically. `onSnapshot` keeps showing the cached list. | None — chat saves silently when connection returns. |
| User signed out | `useChatHistory` returns `{threads: []}`; drawer shows empty state. Modal still works in-session but won't persist. | Drawer empty; subtle hint *"Sign in to save chats."* |

**Deliberately NOT handled:**
- Concurrent submits (input disabled while stream open — simpler than queueing).
- Cross-tab sync of chat history.
- Tool execution timeouts (operations are O(n) over ~15 items).
- Prompt injection in node data (the user is the only author of their own data).

## Testing

Existing repo pattern: `node --test src/**/*.test.mjs` via `npm run test`.

**Unit tests:**

| File | Coverage |
|---|---|
| `server/embedCache.test.mjs` | Hash stability, cache hit/miss, batch missing-only, query embedding called separately. Stub Voyage client returns deterministic fake vectors — fully offline. |
| `server/tools.test.mjs` | `get_person_details` returns JSON or `{error}` on missing id. `find_people_by_attribute({hobby})` filters across `context.hobbies`. Cosine similarity ranking returns expected order on a hand-crafted vector set. |
| `src/hooks/useChatHistory.test.mjs` | Roundtrip add/get/delete via a stubbed Firestore `db` (in-memory `Map` mock honoring `setDoc` / `onSnapshot` / `deleteDoc` semantics). Verifies the path shape `users/{uid}/chats/{chatId}` and that signed-out users yield `{threads: []}`. |

**Manual smoke tests (golden path before declaring done):**

1. Shift-click Mom + Dad → ask anniversary gift question → confirm streaming reply references both Mom's hobbies (gardening/cooking) and Dad's hobbies (woodworking/hiking).
2. With no nodes attached, ask *"who in my life would enjoy hiking?"* → confirm `🔍 searching constellation…` status appears, then collapses, then Claude names matching people.
3. Attach Mom only → ask *"compare her to Dad"* → confirm Claude calls `get_person_details('7')` without Dad being attached.
4. Close modal → confirm thread appears in right drawer with sensible title → click → reopens with full transcript.
5. Open chat twice in quick succession → server logs show 1 Voyage batch call total.
6. Edit Mom's hobbies in PersonModal → reopen chat → server logs show only Mom re-embedded.

**Failure-path smoke tests:**

7. Unset `VOYAGE_API_KEY` mid-session → ask a semantic question → confirm chat still works (other tools), no user-facing error.
8. Unset `ANTHROPIC_API_KEY` → confirm modal shows red error banner with retry, thread preserved.

**Not tested:**
- React component rendering (no test infra in repo).
- End-to-end with real Anthropic/Voyage calls (cost + flake).
- Streaming SSE parsing (covered indirectly by smoke tests).

## Open dependencies

- `VOYAGE_API_KEY` env var must be set in `.env` before chat works. Anthropic key already present.
- Voyage access via raw `fetch` against `https://api.voyageai.com/v1/embeddings` (no SDK; avoids extra dep, the REST surface is two endpoints).
- No schema changes. Reads existing Person Schema v2.
- **Firestore security rules** must allow `users/{uid}/chats/{chatId}` reads and writes for the authenticated user. Confirm the rule set already in place for `users/{uid}/people/**` and `users/{uid}/photos/**` either covers chats via wildcard, or add an explicit rule. Example minimal rule:
  ```
  match /users/{uid}/chats/{chatId} {
    allow read, write: if request.auth.uid == uid;
  }
  ```
- **No Firebase Admin SDK.** All Firestore access is from the browser via the client SDK, scoped by the signed-in user's identity. No service-account JSON needed in this codebase.
