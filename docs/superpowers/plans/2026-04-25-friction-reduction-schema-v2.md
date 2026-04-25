# Friction Reduction & Schema v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce intake friction by adding 7 tap-only structured fields under `relationship` that map 1:1 to the 5 scoring dimensions, while preserving backward compatibility for all existing person records.

**Architecture:** Single shared schema module (`src/constants/personSchema.js`) used by both the voice (`geminiLive.js`) and form (`AddPersonModal.jsx`) intake paths. Scorer (`scripts/score.mjs` and `server/scoringHandler.mjs`) reads new structured fields directly with high weight and falls back to the v1 inference rules (type-prior + notes prose) when fields are absent.

**Tech Stack:** React 19 + Vite (frontend), `@anthropic-ai/sdk` (scorer), Gemini Live WebSocket + REST (voice intake). Tests use Node 20 built-in `node --test` runner — no new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-04-25-friction-reduction-design.md`

---

## File Structure

**New files:**
- `src/constants/personSchema.js` — single source of truth for enums, `BLANK_PERSON`, `buildPersonFromForm`, `buildPersonFromExtraction`
- `src/constants/personSchema.test.mjs` — unit tests for builder functions
- `src/services/geminiLive.test.mjs` — unit tests for `parseLabeledSpeech`
- `data/validation/06_structured_only.json` — validation fixture exercising only the 7 new fields

**Modified files:**
- `src/services/geminiLive.js` — extend `EXTRACT_SCHEMA`, `EXTRACT_PROMPT`, `DEFAULT_SYSTEM_PROMPT`, `parseLabeledSpeech`; export `parseLabeledSpeech` for testing; route final JSON through `buildPersonFromExtraction`
- `src/components/AddPersonModal/AddPersonModal.jsx` — import from schema module; replace inline `BLANK`; insert "Connection" step at position 2; add 7 new tap-field UI groups; replace `handleFormSubmit` body with `buildPersonFromForm`; refactor voice `buildPerson` to use `buildPersonFromExtraction`
- `src/components/AddPersonModal/AddPersonModal.css` — pill-button group + multi-select chip styles
- `scripts/score.mjs` — extend `buildSystemPrompt` with structured-signal block
- `server/scoringHandler.mjs` — mirror the same structured-signal block, preserving its existing reasoning-style instructions
- `docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md` — append `Implied structured signals` block to each of the 15 anchors
- `package.json` — add `test` script

---

## Task 1: Schema module + builders

**Files:**
- Create: `src/constants/personSchema.js`
- Create: `src/constants/personSchema.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add `test` script to `package.json`**

In the `"scripts"` block, add the test entry. The full block becomes:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "node --test src/**/*.test.mjs",
  "score": "node scripts/score.mjs",
  "score:validate": "node scripts/score.mjs data/validation/01_acquaintance.json data/validation/02_classmate.json data/validation/03_friend.json data/validation/04_close_friend.json data/validation/05_inner_circle.json"
}
```

- [ ] **Step 2: Write `src/constants/personSchema.js`**

```js
// Single source of truth for the Person JSON contract (schema v2).
// Both intake paths (voice + form) import from here; the scorer
// consumes JSON shaped by the builders below.

export const RELATIONSHIP_TYPES = [
  { key: 'family',       label: 'Family',        color: '#e8b06b' },
  { key: 'friend',       label: 'Friend',        color: '#ffce5c' },
  { key: 'classmate',    label: 'School',        color: '#b9d0ff' },
  { key: 'coworker',     label: 'Work',          color: '#9be6c4' },
  { key: 'professional', label: 'Professional',  color: '#ff9c5a' },
  { key: 'romantic',     label: 'Romantic',      color: '#ffc8d6' },
  { key: 'mentor',       label: 'Mentor',        color: '#7df9ff' },
  { key: 'other',        label: 'Other',         color: '#cdc9c0' },
];

export const TENURE_OPTIONS = [
  { key: 'just_met',  label: 'Just met'      },
  { key: 'months',    label: 'A few months'  },
  { key: 'one_year',  label: 'About a year'  },
  { key: 'few_years', label: 'A few years'   },
  { key: 'five_plus', label: '5+ years'      },
  { key: 'lifetime',  label: 'A lifetime'    },
];

export const FREQUENCY_OPTIONS = [
  { key: 'daily',            label: 'Daily'           },
  { key: 'weekly',           label: 'Weekly'          },
  { key: 'monthly',          label: 'Monthly'         },
  { key: 'few_times_a_year', label: 'A few times/yr'  },
  { key: 'rarely',           label: 'Rarely'          },
];

export const LAST_INTERACTION_OPTIONS = [
  { key: 'today',       label: 'Today'       },
  { key: 'this_week',   label: 'This week'   },
  { key: 'this_month',  label: 'This month'  },
  { key: 'this_season', label: 'This season' },
  { key: 'this_year',   label: 'This year'   },
  { key: 'over_a_year', label: 'Over a year' },
];

export const CHANNEL_OPTIONS = [
  { key: 'in_person',  label: 'In person' },
  { key: 'text',       label: 'Text'      },
  { key: 'call',       label: 'Calls'     },
  { key: 'video_call', label: 'Video'     },
  { key: 'dm',         label: 'DMs'       },
  { key: 'email',      label: 'Email'     },
  { key: 'other',      label: 'Other'     },
];

export const SUPPORT_OPTIONS = [
  { key: 'yes',        label: 'Yes'        },
  { key: 'sometimes',  label: 'Sometimes'  },
  { key: 'not_really', label: 'Not really' },
  { key: 'not_sure',   label: 'Not sure'   },
];

export const KNOWS_OPTIONS = [
  { key: 'most_of_it', label: 'Most of it' },
  { key: 'some_of_it', label: 'Some of it' },
  { key: 'not_really', label: 'Not really' },
  { key: 'not_sure',   label: 'Not sure'   },
];

const keysOf = (opts) => opts.map((o) => o.key);
export const TENURE_KEYS           = keysOf(TENURE_OPTIONS);
export const FREQUENCY_KEYS        = keysOf(FREQUENCY_OPTIONS);
export const LAST_INTERACTION_KEYS = keysOf(LAST_INTERACTION_OPTIONS);
export const CHANNEL_KEYS          = keysOf(CHANNEL_OPTIONS);
export const SUPPORT_KEYS          = keysOf(SUPPORT_OPTIONS);
export const KNOWS_KEYS            = keysOf(KNOWS_OPTIONS);
export const RELATIONSHIP_TYPE_KEYS = keysOf(RELATIONSHIP_TYPES);

// Empty form state used by AddPersonModal.
export const BLANK_PERSON = {
  name: '',
  birthday: '',
  relType: 'friend',
  notes: '',

  // Connection (the 7 new structured fields)
  tenure: null,
  frequency: null,
  lastInteraction: null,
  channels: [],
  theyShowUpForMe: null,
  iShowUpForThem: null,
  knowsAboutMe: null,

  // Context
  howWeMet: '',
  school: '',
  work: '',
  hobbies: [],
  sports: [],
  favoritesFoods: [],
  favoritesMusic: [],

  // Memories
  memoriesTogether: [],
  importantEvents: [],
  thingsToLookForwardTo: [],
};

// Helper: validate enum-or-null. Returns the value if it's in `keys`,
// otherwise null. Use for fields where invalid input should be dropped.
function enumOrNull(value, keys) {
  return value && keys.includes(value) ? value : null;
}

function arrayFiltered(value, keys) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => keys.includes(v));
}

// Build canonical Person JSON from the form's local state.
// `formState` matches BLANK_PERSON shape.
export function buildPersonFromForm(formState) {
  const rawName = (formState.name || '').trim();
  if (!rawName) return null;

  const initials = rawName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const id = String(Date.now());

  return {
    id,
    name: rawName,
    initials,
    ...(formState.birthday ? { birthday: formState.birthday } : {}),
    ...(formState.notes?.trim() ? { notes: formState.notes.trim() } : {}),

    relationship: {
      type: enumOrNull(formState.relType, RELATIONSHIP_TYPE_KEYS) || 'friend',
      tenure:              enumOrNull(formState.tenure,           TENURE_KEYS),
      frequency:           enumOrNull(formState.frequency,        FREQUENCY_KEYS),
      last_interaction:    enumOrNull(formState.lastInteraction,  LAST_INTERACTION_KEYS),
      channels:            arrayFiltered(formState.channels,      CHANNEL_KEYS),
      they_show_up_for_me: enumOrNull(formState.theyShowUpForMe,  SUPPORT_KEYS),
      i_show_up_for_them:  enumOrNull(formState.iShowUpForThem,   SUPPORT_KEYS),
      knows_about_me:      enumOrNull(formState.knowsAboutMe,     KNOWS_KEYS),
    },

    context: {
      how_we_met: formState.howWeMet?.trim() || null,
      school:     formState.school?.trim()   || null,
      work:       formState.work?.trim()     || null,
      hobbies:    formState.hobbies    || [],
      sports:     formState.sports     || [],
      favorites:  {
        foods: formState.favoritesFoods || [],
        music: formState.favoritesMusic || [],
      },
    },

    history: {
      memories_together:         formState.memoriesTogether      || [],
      important_events:          formState.importantEvents       || [],
      things_to_look_forward_to: formState.thingsToLookForwardTo || [],
    },
  };
}

// Build canonical Person JSON from the Gemini extraction object.
// Tolerant of partial/missing fields — defaults to a coherent skeleton.
export function buildPersonFromExtraction(extracted) {
  if (!extracted) return null;
  const rawName = (extracted.name || '').trim();
  if (!rawName) return null;

  const initials = rawName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const id = String(Date.now());
  const rel = extracted.relationship || {};
  const ctx = extracted.context || {};
  const hist = extracted.history || {};

  return {
    id,
    name: rawName,
    initials,
    ...(extracted.birthday ? { birthday: extracted.birthday } : {}),
    ...(extracted.notes ? { notes: extracted.notes } : {}),

    relationship: {
      type: enumOrNull(rel.type, RELATIONSHIP_TYPE_KEYS) || 'friend',
      tenure:              enumOrNull(rel.tenure,              TENURE_KEYS),
      frequency:           enumOrNull(rel.frequency,           FREQUENCY_KEYS),
      last_interaction:    enumOrNull(rel.last_interaction,    LAST_INTERACTION_KEYS),
      channels:            arrayFiltered(rel.channels,         CHANNEL_KEYS),
      they_show_up_for_me: enumOrNull(rel.they_show_up_for_me, SUPPORT_KEYS),
      i_show_up_for_them:  enumOrNull(rel.i_show_up_for_them,  SUPPORT_KEYS),
      knows_about_me:      enumOrNull(rel.knows_about_me,      KNOWS_KEYS),
    },

    context: {
      how_we_met: ctx.how_we_met || null,
      school:     ctx.school     || null,
      work:       ctx.work       || null,
      hobbies:    ctx.hobbies    || [],
      sports:     ctx.sports     || [],
      favorites:  {
        foods: ctx.favorites?.foods || [],
        music: ctx.favorites?.music || [],
      },
    },

    history: {
      memories_together:         hist.memories_together         || [],
      important_events:          hist.important_events          || [],
      things_to_look_forward_to: hist.things_to_look_forward_to || [],
    },
  };
}
```

- [ ] **Step 3: Write `src/constants/personSchema.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLANK_PERSON,
  buildPersonFromForm,
  buildPersonFromExtraction,
} from './personSchema.js';

test('buildPersonFromForm returns null for blank name', () => {
  assert.equal(buildPersonFromForm({ ...BLANK_PERSON, name: '' }), null);
  assert.equal(buildPersonFromForm({ ...BLANK_PERSON, name: '   ' }), null);
});

test('buildPersonFromForm produces full v2 shape with all 7 connection fields', () => {
  const result = buildPersonFromForm({
    ...BLANK_PERSON,
    name: 'Theo',
    relType: 'friend',
    tenure: 'lifetime',
    frequency: 'weekly',
    lastInteraction: 'this_week',
    channels: ['in_person', 'text'],
    theyShowUpForMe: 'yes',
    iShowUpForThem: 'yes',
    knowsAboutMe: 'most_of_it',
  });
  assert.equal(result.name, 'Theo');
  assert.equal(result.initials, 'T');
  assert.equal(result.relationship.type, 'friend');
  assert.equal(result.relationship.tenure, 'lifetime');
  assert.equal(result.relationship.frequency, 'weekly');
  assert.equal(result.relationship.last_interaction, 'this_week');
  assert.deepEqual(result.relationship.channels, ['in_person', 'text']);
  assert.equal(result.relationship.they_show_up_for_me, 'yes');
  assert.equal(result.relationship.i_show_up_for_them, 'yes');
  assert.equal(result.relationship.knows_about_me, 'most_of_it');
});

test('buildPersonFromForm drops invalid enum values to null', () => {
  const result = buildPersonFromForm({
    ...BLANK_PERSON,
    name: 'Test',
    tenure: 'forever',          // invalid → null
    frequency: 'daily',         // valid
    channels: ['in_person', 'carrier_pigeon'],  // filtered to valid only
  });
  assert.equal(result.relationship.tenure, null);
  assert.equal(result.relationship.frequency, 'daily');
  assert.deepEqual(result.relationship.channels, ['in_person']);
});

test('buildPersonFromForm omits empty notes / birthday fields', () => {
  const result = buildPersonFromForm({ ...BLANK_PERSON, name: 'Test' });
  assert.equal('notes' in result, false);
  assert.equal('birthday' in result, false);
});

test('buildPersonFromExtraction returns null when name is missing', () => {
  assert.equal(buildPersonFromExtraction(null), null);
  assert.equal(buildPersonFromExtraction({}), null);
  assert.equal(buildPersonFromExtraction({ name: '' }), null);
});

test('buildPersonFromExtraction passes the 7 connection fields through', () => {
  const result = buildPersonFromExtraction({
    name: 'Sarah',
    relationship: {
      type: 'friend',
      tenure: 'few_years',
      frequency: 'weekly',
      last_interaction: 'today',
      channels: ['in_person', 'call'],
      they_show_up_for_me: 'yes',
      i_show_up_for_them: 'sometimes',
      knows_about_me: 'most_of_it',
    },
  });
  assert.equal(result.relationship.tenure, 'few_years');
  assert.equal(result.relationship.frequency, 'weekly');
  assert.equal(result.relationship.last_interaction, 'today');
  assert.deepEqual(result.relationship.channels, ['in_person', 'call']);
  assert.equal(result.relationship.they_show_up_for_me, 'yes');
  assert.equal(result.relationship.i_show_up_for_them, 'sometimes');
  assert.equal(result.relationship.knows_about_me, 'most_of_it');
});

test('buildPersonFromExtraction defaults to coherent skeleton when fields are missing', () => {
  const result = buildPersonFromExtraction({ name: 'Bob' });
  assert.equal(result.relationship.type, 'friend');
  assert.equal(result.relationship.tenure, null);
  assert.deepEqual(result.relationship.channels, []);
  assert.deepEqual(result.context.hobbies, []);
  assert.deepEqual(result.history.memories_together, []);
});
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: 7 tests pass.

If a test fails, fix the implementation in `personSchema.js` until tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/constants/personSchema.js src/constants/personSchema.test.mjs package.json
git commit -m "Schema v2: add personSchema module with builders and tests"
```

---

## Task 2: Voice REST extractor — schema + prompt

**Files:**
- Modify: `src/services/geminiLive.js:1-54`

- [ ] **Step 1: Update `EXTRACT_SCHEMA`**

Replace the existing `EXTRACT_SCHEMA` constant (line 6) with the v2 shape:

```js
const EXTRACT_SCHEMA = '{"name":null,"birthday":null,"notes":null,"relationship":{"type":"friend","tenure":null,"frequency":null,"last_interaction":null,"channels":[],"they_show_up_for_me":null,"i_show_up_for_them":null,"knows_about_me":null},"context":{"how_we_met":null,"school":null,"work":null,"hobbies":[],"sports":[],"favorites":{"foods":[],"music":[]}},"history":{"memories_together":[],"important_events":[],"things_to_look_forward_to":[]}}';
```

- [ ] **Step 2: Update `EXTRACT_PROMPT` rules**

Replace the existing `EXTRACT_PROMPT` constant (lines 8-20) with:

```js
const EXTRACT_PROMPT = `You are extracting contact information from a voice onboarding conversation.

Transcript:
{{TRANSCRIPT}}

Fill in the JSON below using only details explicitly mentioned. Rules:
- null for text fields that were not mentioned
- [] for array fields that were not mentioned
- relationship.type: one of family | friend | classmate | coworker | professional | romantic | mentor | other
- relationship.tenure: one of just_met | months | one_year | few_years | five_plus | lifetime, else null
- relationship.frequency: one of daily | weekly | monthly | few_times_a_year | rarely, else null
- relationship.last_interaction: one of today | this_week | this_month | this_season | this_year | over_a_year, else null
- relationship.channels: array (subset) of in_person | text | call | video_call | dm | email | other; [] if unmentioned
- relationship.they_show_up_for_me / i_show_up_for_them: one of yes | sometimes | not_really | not_sure, else null
- relationship.knows_about_me: one of most_of_it | some_of_it | not_really | not_sure, else null
- Map free-form phrasings to the closest enum (e.g. "every week" → weekly, "since high school" → few_years, "yeah definitely" → yes, "kind of" → sometimes).
- birthday: YYYY-MM-DD if a date was mentioned, otherwise null
- notes: a 1-3 sentence prose summary of the relationship in the user's own framing (closeness, cadence, emotional tone). null if there's nothing to summarize.

${EXTRACT_SCHEMA}`;
```

- [ ] **Step 3: Sanity check the JSON shape**

Run a quick parse test inline (add a one-off scratch script if needed, then delete):

```bash
node -e "console.log(JSON.parse('$(grep -m1 EXTRACT_SCHEMA src/services/geminiLive.js | sed -E "s/.*= '(.+)';/\1/")'))"
```
Expected: prints the parsed object showing `relationship.tenure: null`, `channels: []`, etc.

- [ ] **Step 4: Commit**

```bash
git add src/services/geminiLive.js
git commit -m "Voice intake: extend REST extractor schema and prompt for schema v2"
```

---

## Task 3: Voice Live system prompt — flow + EXTRACT_JSON

**Files:**
- Modify: `src/services/geminiLive.js:60-77`

- [ ] **Step 1: Replace `DEFAULT_SYSTEM_PROMPT`**

Replace the existing `DEFAULT_SYSTEM_PROMPT` constant (the multi-line backtick string) with:

```js
const DEFAULT_SYSTEM_PROMPT = `You are Inner Circle's onboarding voice agent.
Collect enough context to add a person to the user's relationship graph.

Flow:
1) Ask for the person's name and the user's relationship category (family / friend / classmate / coworker / professional / romantic / mentor / other).
2) Ask the seven Connection questions in order — these are the load-bearing signals. Ask them naturally, one at a time, in plain language. Do NOT list options to the user; map their answer internally to the closest enum.
   a) How long have you known them? (just_met / months / one_year / few_years / five_plus / lifetime)
   b) How often do you interact? (daily / weekly / monthly / few_times_a_year / rarely)
   c) When did you last talk or hang out? (today / this_week / this_month / this_season / this_year / over_a_year)
   d) How do you usually connect? (in_person / text / call / video_call / dm / email / other — multi-OK)
   e) When you're going through something, do they show up for you? (yes / sometimes / not_really / not_sure)
   f) When they're going through something, do you show up for them? (yes / sometimes / not_really / not_sure)
   g) Do they know your big stuff — family, fears, goals? (most_of_it / some_of_it / not_really / not_sure)
3) If the user is engaged, ask optional context: birthday, how you met, school/work, hobbies, memories. If the signal is thin or the user wants to wrap up, end early and summarize.

Style:
- Warm, concise, one question at a time.
- Map free-form answers to the closest enum value internally — don't list options to the user unless they ask. ("every week" → weekly; "yeah, definitely" → yes; "since high school" → few_years or five_plus.)
- Never ask for sensitive private data.
- Keep turns short for spoken conversation.

When the user sends the text "EXTRACT_JSON", respond ONLY with these labeled sentences — no extra commentary, say "unknown" for anything not mentioned, and ALWAYS use exactly these labels in this exact order:
"Name is [full name]. Relationship type is [family|friend|classmate|coworker|professional|romantic|mentor|other]. Tenure is [just_met|months|one_year|few_years|five_plus|lifetime|unknown]. Frequency is [daily|weekly|monthly|few_times_a_year|rarely|unknown]. Last interaction is [today|this_week|this_month|this_season|this_year|over_a_year|unknown]. Channels are [comma list of in_person|text|call|video_call|dm|email|other, or unknown]. They show up for me is [yes|sometimes|not_really|not_sure|unknown]. I show up for them is [yes|sometimes|not_really|not_sure|unknown]. Knows about me is [most_of_it|some_of_it|not_really|not_sure|unknown]. Birthday is [YYYY-MM-DD or unknown]. Notes are [a 1-3 sentence prose summary of the relationship in the user's own framing — closeness, cadence, emotional tone — or unknown]. How we met is [value or unknown]. School is [value or unknown]. Work is [value or unknown]. Hobbies are [comma list or unknown]. Sports are [comma list or unknown]. Favorite foods are [comma list or unknown]. Favorite music is [comma list or unknown]. Memories are [comma list or unknown]. Important events are [comma list or unknown]. Future plans are [comma list or unknown]."`;
```

- [ ] **Step 2: Commit**

```bash
git add src/services/geminiLive.js
git commit -m "Voice intake: extend Live system prompt with 7 Connection questions"
```

---

## Task 4: Voice Live parser — `parseLabeledSpeech` + tests

**Files:**
- Modify: `src/services/geminiLive.js:78-131`
- Create: `src/services/geminiLive.test.mjs`

- [ ] **Step 1: Replace `parseLabeledSpeech` and export it**

Replace the entire existing `parseLabeledSpeech` function (lines 78-131) with the version below. The new fields appear between `relationship.type` and `birthday` in the response, matching the prompt order. The notes terminator (`how we met is`) is unchanged because notes still immediately precedes "How we met."

```js
import {
  TENURE_KEYS,
  FREQUENCY_KEYS,
  LAST_INTERACTION_KEYS,
  CHANNEL_KEYS,
  SUPPORT_KEYS,
  KNOWS_KEYS,
  RELATIONSHIP_TYPE_KEYS,
} from '../constants/personSchema.js';

// Parse the labeled-sentence response spoken by the model (ASR-friendly,
// no JSON needed). Exported for unit tests.
export function parseLabeledSpeech(raw) {
  const t = raw.toLowerCase().replace(/["""]/g, '');

  const field = (pattern) => {
    const m = t.match(pattern);
    if (!m) return null;
    const v = m[1].trim().replace(/\.$/, '');
    return (v === 'unknown' || v === 'none' || v === '') ? null : v;
  };

  const list = (pattern) => {
    const m = t.match(pattern);
    if (!m) return [];
    const v = m[1].trim().replace(/\.$/, '');
    if (v === 'unknown' || v === 'none' || v === '') return [];
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  };

  const enumField = (pattern, allowed) => {
    const v = field(pattern);
    return v && allowed.includes(v) ? v : null;
  };

  const name = field(/name is ([^.]+)/);
  const relTypeRaw = field(/relationship type is ([^.]+)/);
  const relType = RELATIONSHIP_TYPE_KEYS.find((r) => relTypeRaw?.includes(r)) ?? 'friend';

  const tenure           = enumField(/tenure is ([^.]+)/,           TENURE_KEYS);
  const frequency        = enumField(/frequency is ([^.]+)/,        FREQUENCY_KEYS);
  const lastInteraction  = enumField(/last interaction is ([^.]+)/, LAST_INTERACTION_KEYS);
  const channels         = list(/channels are ([^.]+)/).filter((c) => CHANNEL_KEYS.includes(c));
  const theyShowUp       = enumField(/they show up for me is ([^.]+)/, SUPPORT_KEYS);
  const iShowUp          = enumField(/i show up for them is ([^.]+)/,  SUPPORT_KEYS);
  const knowsAboutMe     = enumField(/knows about me is ([^.]+)/,      KNOWS_KEYS);

  const birthday = field(/birthday is ([\d-]+)/);

  // Notes can span multiple sentences (and contain periods), so terminate
  // on the next labeled field instead of on the first period.
  const notesMatch = t.match(/notes are (.+?)\s+how we met is /);
  const notesRaw = notesMatch?.[1]?.trim().replace(/\.$/, '') ?? null;
  const notes = (notesRaw === 'unknown' || !notesRaw) ? null : notesRaw;

  return {
    name,
    birthday: birthday || null,
    ...(notes ? { notes } : {}),
    relationship: {
      type: relType,
      tenure,
      frequency,
      last_interaction: lastInteraction,
      channels,
      they_show_up_for_me: theyShowUp,
      i_show_up_for_them: iShowUp,
      knows_about_me: knowsAboutMe,
    },
    context: {
      how_we_met: field(/how we met is ([^.]+)/),
      school:     field(/school is ([^.]+)/),
      work:       field(/work is ([^.]+)/),
      hobbies:    list(/hobbies are ([^.]+)/),
      sports:     list(/sports are ([^.]+)/),
      favorites: {
        foods: list(/favorite foods are ([^.]+)/),
        music: list(/favorite music is ([^.]+)/),
      },
    },
    history: {
      memories_together:        list(/memories are ([^.]+)/),
      important_events:         list(/important events are ([^.]+)/),
      things_to_look_forward_to: list(/future plans are ([^.]+)/),
    },
  };
}
```

- [ ] **Step 2: Write parser tests**

Create `src/services/geminiLive.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLabeledSpeech } from './geminiLive.js';

const FULL_RESPONSE =
  'Name is Theo Lee. Relationship type is friend. Tenure is lifetime. ' +
  'Frequency is weekly. Last interaction is this_week. ' +
  'Channels are in_person, text. They show up for me is yes. ' +
  'I show up for them is yes. Knows about me is most_of_it. ' +
  'Birthday is 2003-08-14. Notes are Close friend since elementary school. ' +
  'How we met is unknown. School is unknown. Work is unknown. ' +
  'Hobbies are unknown. Sports are unknown. Favorite foods are unknown. ' +
  'Favorite music is unknown. Memories are unknown. ' +
  'Important events are unknown. Future plans are unknown.';

test('parseLabeledSpeech extracts all 7 connection fields', () => {
  const parsed = parseLabeledSpeech(FULL_RESPONSE);
  assert.equal(parsed.name, 'theo lee');
  assert.equal(parsed.relationship.type, 'friend');
  assert.equal(parsed.relationship.tenure, 'lifetime');
  assert.equal(parsed.relationship.frequency, 'weekly');
  assert.equal(parsed.relationship.last_interaction, 'this_week');
  assert.deepEqual(parsed.relationship.channels, ['in_person', 'text']);
  assert.equal(parsed.relationship.they_show_up_for_me, 'yes');
  assert.equal(parsed.relationship.i_show_up_for_them, 'yes');
  assert.equal(parsed.relationship.knows_about_me, 'most_of_it');
  assert.equal(parsed.birthday, '2003-08-14');
  assert.equal(parsed.notes, 'close friend since elementary school');
});

test('parseLabeledSpeech rejects invalid enum values to null', () => {
  const response =
    'Name is Test. Relationship type is friend. Tenure is forever. ' +
    'Frequency is sometimes. Last interaction is unknown. ' +
    'Channels are carrier_pigeon, text. They show up for me is unknown. ' +
    'I show up for them is unknown. Knows about me is unknown. ' +
    'Birthday is unknown. Notes are unknown. How we met is unknown. ' +
    'School is unknown. Work is unknown. Hobbies are unknown. ' +
    'Sports are unknown. Favorite foods are unknown. Favorite music is unknown. ' +
    'Memories are unknown. Important events are unknown. Future plans are unknown.';
  const parsed = parseLabeledSpeech(response);
  assert.equal(parsed.relationship.tenure, null);
  assert.equal(parsed.relationship.frequency, null);  // 'sometimes' is not a frequency
  assert.deepEqual(parsed.relationship.channels, ['text']);  // pigeon filtered
});

test('parseLabeledSpeech treats "unknown" as null', () => {
  const response =
    'Name is Bob. Relationship type is friend. Tenure is unknown. ' +
    'Frequency is unknown. Last interaction is unknown. Channels are unknown. ' +
    'They show up for me is unknown. I show up for them is unknown. ' +
    'Knows about me is unknown. Birthday is unknown. Notes are unknown. ' +
    'How we met is unknown. School is unknown. Work is unknown. ' +
    'Hobbies are unknown. Sports are unknown. Favorite foods are unknown. ' +
    'Favorite music is unknown. Memories are unknown. Important events are unknown. ' +
    'Future plans are unknown.';
  const parsed = parseLabeledSpeech(response);
  assert.equal(parsed.name, 'bob');
  assert.equal(parsed.relationship.tenure, null);
  assert.deepEqual(parsed.relationship.channels, []);
  assert.equal(parsed.relationship.they_show_up_for_me, null);
});

test('parseLabeledSpeech still parses legacy fields (notes, hobbies, etc.)', () => {
  const response =
    'Name is Maya. Relationship type is classmate. Tenure is months. ' +
    'Frequency is weekly. Last interaction is this_week. Channels are in_person. ' +
    'They show up for me is sometimes. I show up for them is sometimes. ' +
    'Knows about me is some_of_it. Birthday is unknown. ' +
    'Notes are Met through UPE. We had a long 1-on-1 conversation. ' +
    'How we met is UPE 1-on-1. School is UCLA. Work is unknown. ' +
    'Hobbies are reading, hiking. Sports are unknown. ' +
    'Favorite foods are unknown. Favorite music is unknown. ' +
    'Memories are unknown. Important events are unknown. Future plans are unknown.';
  const parsed = parseLabeledSpeech(response);
  assert.equal(parsed.notes, 'met through upe. we had a long 1-on-1 conversation');
  assert.equal(parsed.context.how_we_met, 'upe 1-on-1');
  assert.equal(parsed.context.school, 'ucla');
  assert.deepEqual(parsed.context.hobbies, ['reading', 'hiking']);
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 4 new parser tests pass + the 7 existing schema tests still pass = 11 total passing.

Fix `parseLabeledSpeech` until all pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/geminiLive.js src/services/geminiLive.test.mjs
git commit -m "Voice intake: parse 7 new Connection fields in labeled speech"
```

---

## Task 5: Wire voice intake to `buildPersonFromExtraction`

**Files:**
- Modify: `src/services/geminiLive.js:22-54` (the `extractPersonFromTranscript` function)
- Modify: `src/components/AddPersonModal/AddPersonModal.jsx:288-301` (the inline `buildPerson` helper)

- [ ] **Step 1: Update `extractPersonFromTranscript` to return canonical shape**

In `src/services/geminiLive.js`, after the JSON.parse line, route through the canonical builder. Replace the function body so the final lines become:

```js
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const raw = JSON.parse(text);
    return raw;  // canonical shape produced downstream by buildPersonFromExtraction
  }
}
```

(Keep the function returning the raw extracted object — the modal calls `buildPersonFromExtraction` on the result. This keeps the function single-purpose: extraction.)

If the function already does this, no edit needed — just verify.

- [ ] **Step 2: Replace the inline `buildPerson` helper in `AddPersonModal.jsx`**

In `src/components/AddPersonModal/AddPersonModal.jsx`, find the `buildPerson` function (around line 288, inside `handleProbeToggle`):

```js
const buildPerson = (extracted) => {
  const rawName = (extracted?.name ?? '').trim();
  if (!rawName) return null;
  return {
    id: String(Date.now()),
    name: rawName,
    initials: rawName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    ...(extracted.birthday ? { birthday: extracted.birthday } : {}),
    ...(extracted.notes ? { notes: extracted.notes } : {}),
    relationship: extracted.relationship ?? { type: 'friend' },
    context: extracted.context ?? {},
    history: extracted.history ?? {},
  };
};
```

Replace the entire `buildPerson` definition with a one-line alias:

```js
const buildPerson = buildPersonFromExtraction;
```

Add the import at the top of the file:

```js
import { buildPersonFromExtraction } from '../../constants/personSchema.js';
```

(The existing import block at the top of the file is around line 1-3. Append this import.)

- [ ] **Step 3: Sanity check by running the dev server**

Run: `npm run dev`
Expected: server starts, no module-resolution errors. Open http://localhost:5173 and verify the modal still opens (don't need to test voice flow yet — just that the import resolves).

Stop the dev server (Ctrl-C).

- [ ] **Step 4: Commit**

```bash
git add src/services/geminiLive.js src/components/AddPersonModal/AddPersonModal.jsx
git commit -m "Voice intake: route extractions through buildPersonFromExtraction"
```

---

## Task 6: Form intake — Connection step UI

**Files:**
- Modify: `src/components/AddPersonModal/AddPersonModal.jsx`

- [ ] **Step 1: Update the imports and replace `BLANK` + `STEPS`**

At the top of `AddPersonModal.jsx`, extend the existing import from `personSchema.js` to include everything we need:

```js
import {
  BLANK_PERSON,
  RELATIONSHIP_TYPES,
  TENURE_OPTIONS,
  FREQUENCY_OPTIONS,
  LAST_INTERACTION_OPTIONS,
  CHANNEL_OPTIONS,
  SUPPORT_OPTIONS,
  KNOWS_OPTIONS,
  buildPersonFromForm,
  buildPersonFromExtraction,
} from '../../constants/personSchema.js';
```

Then **delete** the local `REL_TYPES` constant (around line 43-52) and the local `BLANK` constant (around line 61-66). Use `RELATIONSHIP_TYPES` and `BLANK_PERSON` from the schema module instead.

Update the `STEPS` constant (around line 54-59) to include the Connection step at position 2:

```js
const STEPS = [
  { id: 'identity',   label: 'Who'        },
  { id: 'connection', label: 'Connection' },
  { id: 'context',    label: 'Context'    },
  { id: 'interests',  label: 'Interests'  },
  { id: 'memories',   label: 'Memories'   },
];
```

Update `useState(BLANK)` calls to `useState(BLANK_PERSON)` (find `setForm(BLANK)` and `useState(BLANK)` references — there are two: one in the initial state, one in `resetAll`).

- [ ] **Step 2: Add a `PillGroup` helper component**

After the existing `ListInput` helper component (around line 104-135), add a new helper for the Connection step's tap-button rows:

```jsx
function PillGroup({ label, options, value, onChange }) {
  return (
    <div className="apm-field">
      <div className="apm-label">{label}</div>
      <div className="apm-pill-row">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`apm-pill ${value === opt.key ? 'active' : ''}`}
            onClick={() => onChange(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipMultiGroup({ label, options, values, onChange }) {
  const toggle = (key) => {
    if (values.includes(key)) onChange(values.filter((v) => v !== key));
    else onChange([...values, key]);
  };
  return (
    <div className="apm-field">
      <div className="apm-label">{label}</div>
      <div className="apm-pill-row">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`apm-pill ${values.includes(opt.key) ? 'active' : ''}`}
            onClick={() => toggle(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Render the Connection step body**

Find the form-rendering section that switches on `STEPS[step].id`. Add the Connection case. The exact location depends on the existing render structure — look for where `'identity'`, `'context'`, `'interests'`, `'memories'` are rendered (likely a chain of conditional blocks).

Insert this block, where the others render:

```jsx
{STEPS[step].id === 'connection' && (
  <>
    <PillGroup
      label="How long have you known them?"
      options={TENURE_OPTIONS}
      value={form.tenure}
      onChange={(v) => set('tenure', v)}
    />
    <PillGroup
      label="How often do you interact?"
      options={FREQUENCY_OPTIONS}
      value={form.frequency}
      onChange={(v) => set('frequency', v)}
    />
    <PillGroup
      label="When did you last talk or hang out?"
      options={LAST_INTERACTION_OPTIONS}
      value={form.lastInteraction}
      onChange={(v) => set('lastInteraction', v)}
    />
    <ChipMultiGroup
      label="How do you usually connect?"
      options={CHANNEL_OPTIONS}
      values={form.channels}
      onChange={(v) => set('channels', v)}
    />
    <PillGroup
      label="When you're going through something, do they show up for you?"
      options={SUPPORT_OPTIONS}
      value={form.theyShowUpForMe}
      onChange={(v) => set('theyShowUpForMe', v)}
    />
    <PillGroup
      label="When they're going through something, do you show up for them?"
      options={SUPPORT_OPTIONS}
      value={form.iShowUpForThem}
      onChange={(v) => set('iShowUpForThem', v)}
    />
    <PillGroup
      label="Do they know your big stuff — family, fears, goals?"
      options={KNOWS_OPTIONS}
      value={form.knowsAboutMe}
      onChange={(v) => set('knowsAboutMe', v)}
    />
  </>
)}
```

- [ ] **Step 4: Replace `handleFormSubmit` body to use `buildPersonFromForm`**

Find `handleFormSubmit` (around line 363-391). Replace the entire function body with:

```jsx
const handleFormSubmit = () => {
  const person = buildPersonFromForm(form);
  if (!person) return;
  onAdd?.(person);
  resetAll();
  onClose();
};
```

- [ ] **Step 5: Verify the modal renders end-to-end**

Run: `npm run dev`
Expected: server starts. Open http://localhost:5173, click "Add Person," switch to form mode, and step through all 5 steps. The Connection step should display 7 question groups; tapping pills should highlight them. Submit a person with all 7 connection fields filled and verify it appears in the constellation.

Stop the dev server (Ctrl-C).

- [ ] **Step 6: Commit**

```bash
git add src/components/AddPersonModal/AddPersonModal.jsx
git commit -m "Form intake: add Connection step with 7 tap-only fields"
```

---

## Task 7: Form CSS — pill groups and chip multi-select

**Files:**
- Modify: `src/components/AddPersonModal/AddPersonModal.css`

- [ ] **Step 1: Append pill-row styles to the CSS file**

At the end of `AddPersonModal.css`, append:

```css
/* Connection step — pill button groups */
.apm-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.apm-pill {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.78);
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.apm-pill:hover {
  border-color: rgba(255, 255, 255, 0.32);
  color: rgba(255, 255, 255, 0.95);
}

.apm-pill.active {
  border-color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`
Expected: server starts. Navigate to the Connection step in the form. Pills should render as rounded buttons in a wrapping row, with a clear visual distinction between active and inactive states. Hover should subtly brighten the border.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/AddPersonModal/AddPersonModal.css
git commit -m "Form intake: pill-button styles for Connection step"
```

---

## Task 8: Scorer — system-prompt structured-signal block (both files)

**Files:**
- Modify: `scripts/score.mjs:62-77` (`buildSystemPrompt`)
- Modify: `server/scoringHandler.mjs:62-100` (`buildSystemPrompt`)

The same structured-signal block is added to both files. The two `buildSystemPrompt` functions diverge in surrounding instructions (the server file has additional "reasoning style" rules) — only the inner inference rules are shared.

- [ ] **Step 1: Update `scripts/score.mjs` `buildSystemPrompt`**

Replace the existing function (lines 61-78) with:

```js
function buildSystemPrompt(anchorsMarkdown) {
  return [
    "You are scoring a relationship across 5 dimensions on a 0-10 scale.",
    "Anchors at levels 2, 5, and 8 are pattern references — match the overall feel, don't require the same density of detail.",
    "",
    "Direct structured signals (when present, weight these heavily — they are the user's literal answer, not your inference):",
    "- relationship.tenure → primary input for shared_history_density. lifetime ≈ 8-10, five_plus ≈ 6-8, few_years ≈ 5-7, one_year ≈ 3-5, months ≈ 2-4, just_met ≈ 1-2.",
    "- relationship.frequency + relationship.last_interaction → primary inputs for recency_frequency. daily/today ≈ 9-10, weekly/this_week ≈ 7-8, monthly/this_month ≈ 5-6, few_times_a_year/this_season ≈ 3-4, rarely/over_a_year ≈ 1-2. Combine the two: a daily frequency with last_interaction=over_a_year is contradictory — trust the more recent signal but flag through reasoning.",
    "- relationship.channels → modifier on recency_frequency and emotional_intimacy. in_person + call signals stronger ties than text/dm-only at the same frequency.",
    "- relationship.they_show_up_for_me → primary input for emotional_intimacy. \"yes\" puts the floor at 6 unless directly contradicted; \"sometimes\" at 4; \"not_really\" caps at 4; \"not_sure\" / null = no signal.",
    "- relationship.i_show_up_for_them → primary input for reciprocity, same scaling as above.",
    "- relationship.knows_about_me → primary input for depth_of_knowledge. most_of_it floor at 6; some_of_it at 4; not_really caps at 4; not_sure / null = no signal.",
    "- When any of these structured fields is present for a dimension, weight it MORE than free-text inference for that dimension. When absent, fall back to the rules below.",
    "",
    "How to infer (fallback when structured fields absent):",
    "- `relationship.type` is a strong prior. Family ('mother', 'father', 'sibling'), partner, and 'close friend'/'best friend' carry a strong floor on intimacy, reciprocity, and shared history — sparse data on these types should still land in the upper half (≥ 6) unless the JSON actively contradicts. 'acquaintance', 'met once', 'coworker' cap the upper end the same way.",
    "- `notes` is the user's own prose summary of the relationship — read it as the most direct signal and weight it heavily.",
    "- Missing fields are unknown, not zero. If a dimension has no direct signal, lean on the type prior and adjacent fields rather than scoring low.",
    "- Read natural-language cues at face value. 'Known him since elementary school' → shared history at least 5. 'See him once a year' → recency ~2-3. 'We text every day' / 'eat lunch together' → recency 8+. 'She was there for me through X' → intimacy 6+.",
    "- The user is intentionally giving minimal info. Be generous when evidence points toward closeness; reserve low scores for cases where the data actively suggests distance.",
    "",
    "For each dimension give a 0-10 score and 1-2 sentences citing what drove it. You MUST call the `submit_score` tool — text alone is not a valid response.",
    "",
    "=== ANCHOR REFERENCES ===",
    anchorsMarkdown,
  ].join("\n");
}
```

- [ ] **Step 2: Update `server/scoringHandler.mjs` `buildSystemPrompt`**

Replace the existing function (lines 62-100) with:

```js
function buildSystemPrompt() {
  return [
    'You are scoring a relationship across 5 dimensions on a 0-10 scale.',
    'The reference exemplars below at levels 2, 5, and 8 are pattern guides for calibration only — match their overall feel, do not require the same density of detail.',
    '',
    'Direct structured signals (when present, weight these heavily — they are the user\'s literal answer, not your inference):',
    '- relationship.tenure → primary input for shared_history_density. lifetime ≈ 8-10, five_plus ≈ 6-8, few_years ≈ 5-7, one_year ≈ 3-5, months ≈ 2-4, just_met ≈ 1-2.',
    '- relationship.frequency + relationship.last_interaction → primary inputs for recency_frequency. daily/today ≈ 9-10, weekly/this_week ≈ 7-8, monthly/this_month ≈ 5-6, few_times_a_year/this_season ≈ 3-4, rarely/over_a_year ≈ 1-2. Combine the two: a daily frequency with last_interaction=over_a_year is contradictory — trust the more recent signal but flag through reasoning.',
    '- relationship.channels → modifier on recency_frequency and emotional_intimacy. in_person + call signals stronger ties than text/dm-only at the same frequency.',
    '- relationship.they_show_up_for_me → primary input for emotional_intimacy. "yes" puts the floor at 6 unless directly contradicted; "sometimes" at 4; "not_really" caps at 4; "not_sure" / null = no signal.',
    '- relationship.i_show_up_for_them → primary input for reciprocity, same scaling as above.',
    '- relationship.knows_about_me → primary input for depth_of_knowledge. most_of_it floor at 6; some_of_it at 4; not_really caps at 4; not_sure / null = no signal.',
    '- When any of these structured fields is present for a dimension, weight it MORE than free-text inference for that dimension. When absent, fall back to the rules below.',
    '',
    'How to infer (fallback when structured fields absent):',
    "- `relationship.type` is a strong prior. Family ('mother', 'father', 'sibling'), partner, and 'close friend'/'best friend' carry a strong floor on intimacy, reciprocity, and shared history — sparse data on these types should still land in the upper half (≥ 6) unless the JSON actively contradicts. 'acquaintance', 'met once', 'coworker' cap the upper end the same way.",
    "- `notes` is the user's own prose summary of the relationship — read it as the most direct signal and weight it heavily.",
    '- Missing fields are unknown, not zero. If a dimension has no direct signal, lean on the type prior and adjacent fields rather than scoring low.',
    "- Read natural-language cues at face value. 'Known him since elementary school' → shared history at least 5. 'See him once a year' → recency ~2-3. 'We text every day' / 'eat lunch together' → recency 8+. 'She was there for me through X' → intimacy 6+.",
    '- The user is intentionally giving minimal info. Be generous when evidence points toward closeness; reserve low scores for cases where the data actively suggests distance.',
    '',
    'Reasoning style (this text is shown directly to the user):',
    '- ONE short sentence per dimension, max ~18 words.',
    '- Cite the concrete signal that drove the score (a phrase from notes, a fact from history, or a structured-field value like "weekly" or "yes").',
    '- Do NOT mention "anchors", "exemplars", "level 5", "the rubric", calibration, or any internal scoring machinery — the user does not know those exist.',
    '- Plain language. No quoted jargon. No meta-commentary about scoring.',
    '',
    'You MUST call the `submit_score` tool — text alone is not a valid response.',
    '',
    '=== REFERENCE EXEMPLARS (internal calibration only — never mention these in reasoning) ===',
    loadAnchors(),
  ].join('\n');
}
```

- [ ] **Step 3: Sanity-check both prompts have the same structured-signal block**

Run:
```bash
diff <(grep -A 8 "Direct structured signals" scripts/score.mjs) <(grep -A 8 "Direct structured signals" server/scoringHandler.mjs)
```
Expected: minor whitespace/quote differences only (single vs. double quotes), no missing rules.

- [ ] **Step 4: Commit**

```bash
git add scripts/score.mjs server/scoringHandler.mjs
git commit -m "Scoring agent: weight structured signals over free-text inference"
```

---

## Task 9: Anchor calibration blocks

**Files:**
- Modify: `docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md`

The file has 5 dimensions, each with 3 anchors (levels 2, 5, 8), totaling 15 anchors. Append a compact `Implied structured signals` block to each one, including only the load-bearing fields for that anchor's dimension and any clear adjacent dimensions.

- [ ] **Step 1: Read the full anchors file to ground the field selections**

Run: `cat docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md`

For each anchor, decide which structured-signal values the prose implies. Use these guidelines:

- **Depth of Knowledge** anchors: focus on `knows_about_me` (primary), plus `tenure` and `frequency`.
- **Emotional Intimacy** anchors: focus on `they_show_up_for_me` (primary), plus `i_show_up_for_them`, `knows_about_me`.
- **Recency / Frequency** anchors: focus on `frequency` and `last_interaction` (primary), plus `channels`.
- **Shared History Density** anchors: focus on `tenure` (primary), plus `frequency`.
- **Reciprocity** anchors: focus on `i_show_up_for_them` (primary) plus `they_show_up_for_me`.

- [ ] **Step 2: Append calibration blocks**

Below each anchor's existing prose, before the next anchor begins, insert a block of this form (the example below is for the level-8 depth-of-knowledge anchor "Theo"):

```markdown

  > **Implied structured signals:**
  > - tenure: lifetime
  > - frequency: weekly
  > - last_interaction: this_week
  > - they_show_up_for_me: yes
  > - i_show_up_for_them: yes
  > - knows_about_me: most_of_it
```

The blockquote prefix matches the existing anchor formatting in the file.

For each of the 15 anchors, draft 5–6 lines that match the anchor's implied level. Use these as a starting frame — adjust based on what the prose actually says:

| Dimension | Level | Suggested values |
|---|---|---|
| Depth of Knowledge | 2 (Maya) | tenure: just_met, frequency: rarely, knows_about_me: not_really |
| Depth of Knowledge | 5 (Ryan) | tenure: months, frequency: weekly, knows_about_me: some_of_it |
| Depth of Knowledge | 8 (Theo) | tenure: lifetime, frequency: weekly, last_interaction: this_week, they_show_up_for_me: yes, i_show_up_for_them: yes, knows_about_me: most_of_it |
| Emotional Intimacy | 2 (Lena) | tenure: months, frequency: weekly, they_show_up_for_me: not_really, i_show_up_for_them: not_really, knows_about_me: not_really |
| Emotional Intimacy | 5 (Marco) | tenure: months, frequency: weekly, they_show_up_for_me: yes, i_show_up_for_them: sometimes, knows_about_me: some_of_it |
| Emotional Intimacy | 8 (Arjun) | tenure: few_years, frequency: weekly, they_show_up_for_me: yes, i_show_up_for_them: yes, knows_about_me: most_of_it |
| Recency / Frequency | 2 | frequency: rarely, last_interaction: this_year or over_a_year, channels: [in_person] (sporadic) |
| Recency / Frequency | 5 | frequency: monthly, last_interaction: this_month, channels: [in_person, text] |
| Recency / Frequency | 8 | frequency: daily, last_interaction: today, channels: [in_person, text, call] |
| Shared History Density | 2 | tenure: just_met or months, frequency: rarely |
| Shared History Density | 5 | tenure: few_years, frequency: weekly |
| Shared History Density | 8 | tenure: lifetime or five_plus, frequency: weekly |
| Reciprocity | 2 | they_show_up_for_me: not_really, i_show_up_for_them: not_really |
| Reciprocity | 5 | they_show_up_for_me: yes, i_show_up_for_them: sometimes (or vice versa — bilateral but uneven) |
| Reciprocity | 8 | they_show_up_for_me: yes, i_show_up_for_them: yes |

For dimensions/levels where the original anchor's prose doesn't name a person (or the table above doesn't cover it), read the prose and pick values that match the *feel* described.

- [ ] **Step 3: Verify the file is well-formed**

Run: `wc -l docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md`
Expected: line count grew by ~90–100 lines (15 anchors × ~6 lines each).

Run: `head -100 docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md`
Expected: visually inspect — calibration block appears under at least one anchor with proper blockquote formatting.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md
git commit -m "Scoring rubric: add structured-signal calibration to all 15 anchors"
```

---

## Task 10: New validation fixture — structured-only

**Files:**
- Create: `data/validation/06_structured_only.json`
- Modify: `package.json` (the `score:validate` script)

- [ ] **Step 1: Create the fixture**

`data/validation/06_structured_only.json`:

```json
{
  "_expected_aggregate": "~7",
  "id": "val_06_structured_only",
  "name": "Jordan",
  "relationship": {
    "type": "friend",
    "tenure": "few_years",
    "frequency": "weekly",
    "last_interaction": "this_week",
    "channels": ["in_person", "text", "call"],
    "they_show_up_for_me": "yes",
    "i_show_up_for_them": "yes",
    "knows_about_me": "most_of_it"
  },
  "context": {
    "how_we_met": null,
    "school": null,
    "work": null,
    "hobbies": [],
    "sports": [],
    "favorites": { "foods": [], "music": [] }
  },
  "history": {
    "memories_together": [],
    "important_events": [],
    "things_to_look_forward_to": []
  }
}
```

This profile has zero prose — no notes, no how_we_met, no memories — but all 7 connection fields filled at "close friend" levels. The expected aggregate is ~70 (close friend territory). If the scorer can't produce ≥ 65 here, the structured-signal block isn't being weighted heavily enough.

- [ ] **Step 2: Update the validation script**

In `package.json`, update the `score:validate` script to include the new file:

```json
"score:validate": "node scripts/score.mjs data/validation/01_acquaintance.json data/validation/02_classmate.json data/validation/03_friend.json data/validation/04_close_friend.json data/validation/05_inner_circle.json data/validation/06_structured_only.json"
```

- [ ] **Step 3: Commit**

```bash
git add data/validation/06_structured_only.json package.json
git commit -m "Validation: structured-only fixture exercising the 7 new fields"
```

---

## Task 11: End-to-end validation pass

**Files:** none (this task verifies the system; no code changes unless calibration is off)

- [ ] **Step 1: Run all validation fixtures**

Run: `npm run score:validate`
Expected: a table prints with rows for all 6 fixtures. Each row shows expected aggregate, actual aggregate, variance, and the 3 sample scores.

Capture the output to a file for the commit message:

```bash
npm run score:validate 2>&1 | tee /tmp/validation-output.txt
```

- [ ] **Step 2: Eyeball the results**

For each fixture, check:
- `01_acquaintance.json` — expected ~10, actual should be ≤ 25
- `02_classmate.json` — expected ~40, actual should be 30–50
- `03_friend.json` — expected ~50, actual should be 40–60
- `04_close_friend.json` — expected ~70, actual should be 60–80
- `05_inner_circle.json` — expected ~85, actual should be 75–95
- `06_structured_only.json` — expected ~70, actual should be ≥ 65

If any fixture lands more than 10 points outside its expected band, the structured-signal block in Task 8 may need tuning (the per-field anchor ranges are a starting point, not gospel). Adjust the ranges and re-run.

- [ ] **Step 3: Run a contradictory case (manual, optional)**

Create a temporary fixture in `/tmp/contradictory.json`:

```json
{
  "name": "Contradiction Test",
  "relationship": {
    "type": "friend",
    "frequency": "rarely",
    "last_interaction": "over_a_year"
  },
  "notes": "We hang out every single day, basically inseparable.",
  "context": {},
  "history": {}
}
```

Run: `node scripts/score.mjs /tmp/contradictory.json`
Expected: `recency_frequency` score is low (≤ 4), reflecting the structured fields. Reasoning text should mention the contradiction or cite the structured value (e.g., "rarely" / "over a year ago"), not the prose.

- [ ] **Step 4: Verify form ↔ voice JSON parity (manual)**

Run: `npm run dev`

In two browser tabs, add the same person via the form once and via voice once (using the same answers). Inspect the resulting Person JSON in browser devtools (the Inner Circle store / Firestore writes). Confirm the two records have:
- Identical `relationship.type`
- Identical 7 connection-field values (when both intake paths captured the same answers)
- Identical `context.*` and `history.*` shapes (lists may differ in order but should have the same values)

Stop the dev server.

- [ ] **Step 5: Commit the validation result note**

```bash
git commit --allow-empty -m "Validation: end-to-end pass for schema v2

$(cat /tmp/validation-output.txt | tail -20)"
```

---

## Self-Review Notes

**Spec coverage check:** Each section of the spec maps to a task:
- §4.1 (shared schema module) → Task 1
- §5 (schema v2 + enums) → Task 1
- §6 (form intake) → Tasks 6, 7
- §7 (voice intake) → Tasks 2, 3, 4, 5
- §8.1 (scorer system prompt) → Task 8
- §8.2 (anchor calibration) → Task 9
- §10 (file-level changes) → fully covered
- §11 (validation plan) → Tasks 10, 11

**Type consistency check:** `BLANK_PERSON` field names (`tenure`, `frequency`, `lastInteraction` in form-state camelCase) map to `relationship.tenure`, `relationship.frequency`, `relationship.last_interaction` (snake_case in canonical JSON) via `buildPersonFromForm`. Voice extraction emits snake_case directly. Schema-module exports (`TENURE_KEYS`, `FREQUENCY_KEYS`, etc.) used by both `buildPersonFromForm` and `parseLabeledSpeech` for validation — consistent across files.

**Placeholder scan:** No "TBD" / "TODO" / "fill in details" remaining. Every step shows the actual code or command. Anchor calibration (Task 9 Step 2) provides a starter table covering all 15 anchor positions plus guidance for any positions where the table is partial.
