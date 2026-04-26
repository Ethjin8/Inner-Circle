# Inner Circle

An AI-powered personal relationship manager wrapped in a cinematic constellation interface. Map the people who matter, score the strength of each connection through a rigorous AI pipeline, and explore your network as a living galaxy with you at the center.

## Overview

Inner Circle treats your social world as a deterministic, hierarchical radial graph. Every person becomes a node attached by category to a central "You," with edge thickness encoding relationship strength. Connections are added through a voice-first onboarding agent or a manual form, persisted per-user to Firestore, scored offline by an anchored Claude rubric pipeline, and surfaced again as nudges (birthdays, stale connections) on-graph and over email.

Part PRM, part visual playground: rigorous on the data side, expressive on the interaction side.

## Core Features

### Constellation graph
- Radial, category-branched layout built on `react-force-graph-2d` with custom canvas rendering (`StarField`, `ConstellationGraph`).
- Nodes "breathe" via custom `requestAnimationFrame` loops; each life category (family, friend, classmate, coworker, professional, romantic, mentor, other) has its own color and branch from the central "You" node.
- Edge thickness is driven by the AI-derived relationship strength score.
- Category legend, filter pills, and per-category toggles.

### Search and command palette
- `SearchPill` — always-on search affordance.
- `CommandPalette` (built on `cmdk`) — opens with ⌘K / Ctrl+K, closes with Escape, jumps to people, categories, and actions.
- `CmdKNudge` first-run hint and `useRecentPeople` MRU history.

### Person profile
- `PersonModal` — full editable profile card. Edit any field (name, category, birthday, hobbies, school, work, location, memories, milestones, score). Edits trigger an on-demand rescore.
- `AddPersonModal` — manual entry path that mirrors the onboarding agent's schema.
- `NodeCard` and `CategoryLegend` for in-graph context.

### Voice + manual onboarding
- `Onboarding` flow uses the Gemini Live API (`gemini-3.1-flash-live-preview`) for real-time speech-to-speech intake, then `gemini-2.5-flash` to extract a normalized Person JSON.
- The agent walks: name → category → optional birthday + category-specific facts (hobbies, school, sports, favorites) → shared history (events, memories, things to look forward to). Knows when to cut a thin-signal conversation short.
- Manual fallback through `AddPersonModal`.

### AI chat over your network
- `ChatModal` talks to Claude Sonnet 4.6 (`claude-sonnet-4-6`) via the Anthropic Messages API.
- Multi-turn tool use exposes five server-side tools:
  - `get_person_details` — fetch full Person JSON by id.
  - `find_people_by_attribute` — filter by category, hobby, or school.
  - `semantic_search` — fuzzy, meaning-based lookup powered by Voyage AI embeddings (cached in `server/embedCache.mjs`).
  - `draft_email` — produces a draft surfaced in `GmailDraftEditor`.
  - `create_calendar_event` — produces an event surfaced in `CalendarEventCard`.
- Conversation history persists in `useChatHistory`; @mentions attach specific people as context.

### Scoring pipeline (Anchored Rubric, v1)
- Runs offline via `npm run score <person.json>` (`scripts/score.mjs`) or on demand from the app via `POST /api/score` (`server/scoringHandler.mjs`).
- Model: Claude Opus 4.6 (`claude-opus-4-6`) with extended thinking (`effort: high`, 16k max tokens).
- Five dimensions, each graded against few-shot anchor exemplars in `docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md`:
  1. depth_of_knowledge
  2. emotional_intimacy
  3. recency_frequency
  4. shared_history_density
  5. reciprocity
- Self-consistency: 3 samples per person, median per dimension. High variance flags the node as "uncertain."
- Tool-call output (`submit_score`) returns per-dimension score (0–10) + reasoning.
- Validation set: `npm run score:validate` runs the full 6-fixture sweep.

### Memories
- `CloudinaryUpload` integrates `@cloudinary/react` and `@cloudinary/url-gen` for unsigned uploads scoped per person.
- `MemoryCarousel` — Apple-style 3D Coverflow gallery across every photo in your network: trackpad precision, mouse momentum, idle auto-play.
- `usePhotos` hook syncs photo metadata to Firestore.

### Nudges
- **On-graph:** `services/nudges.js` surfaces birthday and last-contacted prompts directly on the constellation.
- **Email:** Firebase Cloud Function `dailyNudge` (`functions/index.js`) runs at 03:00 America/Los_Angeles, scans every user's `people` subcollection, and emits two nudge types via Gmail/`nodemailer`:
  - `BIRTHDAY` — exact MM-DD match against `person.birthday`.
  - Stale connection — last interaction crosses a 31-day boundary.
  - Each email includes a relationship "Refresher" block (role, strength, location, work, hobbies, shared memories, milestones).

### Auth
- Google sign-in via Firebase Auth (`AuthContext`, `SignIn`).
- All Firestore reads/writes are scoped to `users/{uid}/people` and `users/{uid}/photos`.
- `Landing` page with animated constellation precedes sign-in / app entry.

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite 8, vanilla CSS, custom `requestAnimationFrame` animation |
| Graph | `react-force-graph-2d` + custom canvas |
| UI primitives | `cmdk`, `lucide-react` |
| Auth + DB | Firebase Auth (Google), Cloud Firestore |
| Cloud Functions | Firebase Functions v2 (`onSchedule`), `nodemailer` (Gmail SMTP) |
| Voice intake | Google Gemini Live (`gemini-3.1-flash-live-preview`) + `gemini-2.5-flash` extractor |
| Chat agent | Anthropic Claude Sonnet 4.6 with tool use |
| Scoring | Anthropic Claude Opus 4.6 with extended thinking, anchored rubric, self-consistency |
| Embeddings | Voyage AI (cached on disk via `server/embedCache.mjs`) |
| Media | Cloudinary (`@cloudinary/react`, `@cloudinary/url-gen`, server SDK `cloudinary`) |
| Dev API | Custom Vite middleware mounts `/api/score` and `/api/chat` so server keys never reach the browser |

## Project Structure

```text
src/
  App.jsx                 # Top-level state, view routing, toolbar
  components/
    Graph/                # ConstellationGraph, StarField, Graph wrappers
    PersonModal/          # Editable profile card
    AddPersonModal/       # Manual intake form
    Onboarding/           # Voice-first intake flow
    Chat/                 # ChatModal, ChatHistory, MessageBubble
    CommandPalette/       # cmdk-powered ⌘K palette
    SearchPill/           # Search affordance
    CmdKNudge/            # First-run ⌘K hint
    AvatarMenu/           # Account menu
    CategoryLegend/       # Color/category legend
    NodeCard/             # In-graph hover card
    CloudinaryUpload/     # Per-person upload widget
    MemoryCarousel/       # 3D Coverflow gallery
    GmailDraftEditor/     # Surfaces chat-tool email drafts
    CalendarEventCard/    # Surfaces chat-tool calendar events
    Landing/              # Animated landing constellation
    SignIn/               # Google sign-in
  services/
    geminiLive.js         # Gemini Live + extractor client
    scoring.js            # Browser → /api/score wrapper
    chat.js               # Browser → /api/chat wrapper
    nudges.js             # On-graph birthday / stale-connection nudges
  hooks/
    usePeople.js          # Firestore CRUD for users/{uid}/people
    usePhotos.js          # Firestore + Cloudinary photo state
    useChatHistory.js     # Persisted chat threads
    useRecentPeople.js    # MRU person list
    useCommandKey.js      # ⌘K binding
  contexts/AuthContext.jsx
  lib/firebase.js
  constants/personSchema.js
  utils/{markdown.jsx,scoring.js}

server/                   # Vite middleware (dev) — server-side keys
  scoringHandler.mjs      # POST /api/score → Claude Opus 4.6
  chatHandler.mjs         # POST /api/chat → Claude Sonnet 4.6 + tools
  chatTools.mjs           # get_person_details, find_people_by_attribute,
                          # semantic_search, draft_email, create_calendar_event
  embedCache.mjs          # Voyage embedding cache

scripts/score.mjs         # CLI scorer (anchored rubric, self-consistency)

functions/                # Firebase Cloud Functions
  index.js                # dailyNudge — birthdays + stale connections
  setup-demo.js, setup-global.js, list-users.js, cleanup.js, test-*.js

data/validation/          # 6 fixture personas for rubric validation
docs/superpowers/specs/   # Rubric anchors + design specs
```

## Getting Started

1. **Install:**
   ```bash
   npm install
   (cd functions && npm install)
   ```

2. **Environment** (`.env` at repo root):
   ```env
   # Client (exposed via Vite)
   VITE_GEMINI_API_KEY=...
   VITE_CLOUDINARY_CLOUD_NAME=...
   VITE_CLOUDINARY_UPLOAD_PRESET=...
   VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...", ...}

   # Server-only (read by Vite middleware, never shipped to browser)
   ANTHROPIC_API_KEY=sk-ant-...
   VOYAGE_API_KEY=pa-...
   ```

   Cloud Functions secrets (set via `firebase functions:secrets:set` or env):
   ```env
   GMAIL_USER=...
   GMAIL_PASS=...   # Gmail app password
   ```

3. **Run:**
   ```bash
   npm run dev            # Vite dev server with /api/score and /api/chat mounted
   npm run build          # production build
   npm run lint           # ESLint
   npm test               # node --test across src/**/*.test.mjs
   npm run score <file>   # CLI rubric scorer
   npm run score:validate # 6-fixture rubric sweep
   ```

4. **Deploy Cloud Functions:**
   ```bash
   firebase deploy --only functions
   ```

## Built For

LA Hacks 2026

## Team

Nathan So, Eric Le, Alex Xiao, Ethan Jin
