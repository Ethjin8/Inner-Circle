# Friction-Reduction & Structured-Signal Design (Schema v2)

**Date:** 2026-04-25
**Status:** Draft — pending user review
**Replaces in spirit:** the prose-heavy intake portion of the v1 contract used by `scripts/score.mjs`, `server/scoringHandler.mjs`, `src/services/geminiLive.js`, and `src/components/AddPersonModal/AddPersonModal.jsx`.

---

## 1. Problem

The current intake → scoring pipeline asks the user to do the scorer's job in prose. The system prompt in `scripts/score.mjs:62-77` instructs Claude to infer relationship dimensions from natural-language cues — "Known him since elementary school" → shared history ≥ 5; "We text every day" → recency 8+. Those cues live in the user-authored `notes` field and the free-text `history.*` arrays. The form has no structured place to record them, so the user is forced into open-ended summarization to feed the scorer.

Three of the four high-friction inputs (`notes`, `memories_together`, `important_events`) carry most of the scoring load yet require the user to recall, summarize, and articulate emotional and historical complexity — the exact "complex thinking" we've decided not to demand of them.

## 2. Goals

- **Same JSON contract** emitted by both intake paths (voice and form), so the scorer never works on ambiguous parameters.
- **Tap-only structured inputs** for every signal the scorer currently infers from prose.
- **Direct 1:1 mapping** between new fields and the 5 scoring dimensions, so each dimension has at least one unambiguous structured input.
- **Backward compatibility** — every existing person record (and the 5 validation JSONs) remains valid; new fields are optional.
- **Demote, don't delete** — keep `notes` and free-text history arrays as optional flavor; the scorer falls back to them only when the structured fields are absent.
- **Voice-friendly** — every new field maps cleanly to a spoken answer ("every week," "yeah," "since high school"), so the Gemini Live agent can ask in plain language and the labeled-speech parser can extract them like the existing fields.

## 3. Non-goals

- Importing messaging history (iMessage / WhatsApp / Instagram). Acknowledged as a future direction; out of scope for this spec.
- Photos, calendar, or contacts integration — likewise future work.
- Fetch AI / outreach automation — out of scope. Contact-info fields (email, phone) are also out of scope here; tracked separately.
- Changes to the constellation visualization, scoring aggregation math, or the 5-dimension definitions themselves.

## 4. Architecture

```
┌──────────────────┐                    ┌──────────────────┐
│  Voice (Gemini   │                    │  Form (Modal)    │
│  Live + REST     │                    │  5-step wizard   │
│  fallback)       │                    │  (was 4-step)    │
└────────┬─────────┘                    └────────┬─────────┘
         │ EXTRACT_JSON labeled-speech            │ structured state
         │   → parseLabeledSpeech() in            │   → handleFormSubmit()
         │     geminiLive.js                      │     in AddPersonModal.jsx
         ▼                                        ▼
         ┌──────────────────────────────────────────┐
         │   Person JSON v2 (single shared schema)  │
         │   src/constants/personSchema.js          │
         └─────────────────┬────────────────────────┘
                           ▼
         ┌──────────────────────────────────────────┐
         │  scripts/score.mjs / scoringHandler.mjs  │
         │  System prompt updated to read new       │
         │  structured fields directly; falls back  │
         │  to type-prior + notes when absent.      │
         └─────────────────┬────────────────────────┘
                           ▼
                  { aggregate, dimensions, ... }
```

### 4.1 Shared schema module (new)

Today the schema is replicated in three places:

- `src/services/geminiLive.js` — `EXTRACT_SCHEMA` constant and `EXTRACT_PROMPT` template
- `src/components/AddPersonModal/AddPersonModal.jsx` — `BLANK` constant and `handleFormSubmit` shape
- `scripts/score.mjs` — implicit (the scorer just consumes whatever it gets)

**Action:** create `src/constants/personSchema.js` exporting:

- `BLANK_PERSON` — the empty object both intake paths use as their base
- `RELATIONSHIP_TYPES` (existing) — 8 enum values
- `TENURE_OPTIONS`, `FREQUENCY_OPTIONS`, `LAST_INTERACTION_OPTIONS`, `CHANNEL_OPTIONS`, `SUPPORT_OPTIONS`, `KNOWS_OPTIONS` — new enums (see §5)
- `buildPersonFromForm(formState)` — pure function that takes the form's local state and returns the canonical Person JSON. Used by `handleFormSubmit`.
- `buildPersonFromExtraction(extracted)` — pure function that takes the raw Gemini extraction object and returns the canonical Person JSON. Used by both `requestExtraction()` and `extractPersonFromTranscript()` paths.

Both intake paths call into this module. The scorer reads JSON shaped by it. One source of truth.

## 5. Schema v2

```jsonc
{
  "id": "<string>",
  "name": "<string>",
  "initials": "<string>",
  "birthday": "<YYYY-MM-DD> | null",

  "notes": "<string> | null",                       // KEPT, optional flavor

  "relationship": {
    "type": "family | friend | classmate | coworker | professional | romantic | mentor | other",

    // ─── 7 NEW structured signals — all tap-or-pick, all optional ───
    "tenure":              "just_met | months | one_year | few_years | five_plus | lifetime | null",
    "frequency":           "daily | weekly | monthly | few_times_a_year | rarely | null",
    "last_interaction":    "today | this_week | this_month | this_season | this_year | over_a_year | null",
    "channels":            ["in_person" | "text" | "call" | "video_call" | "dm" | "email" | "other"],
    "they_show_up_for_me": "yes | sometimes | not_really | not_sure | null",
    "i_show_up_for_them":  "yes | sometimes | not_really | not_sure | null",
    "knows_about_me":      "most_of_it | some_of_it | not_really | not_sure | null"
  },

  "context": {                                      // unchanged
    "how_we_met": "<string> | null",
    "school":     "<string> | null",
    "work":       "<string> | null",
    "hobbies":    ["<string>"],
    "sports":     ["<string>"],
    "favorites":  { "foods": ["<string>"], "music": ["<string>"] }
  },

  "history": {                                      // KEPT, all fields now optional
    "memories_together":         ["<string>"],
    "important_events":          ["<string>"],
    "things_to_look_forward_to": ["<string>"]
  }
}
```

### 5.1 Field-by-field semantics

| Field | Type | Voice question | UI | Maps to dimension(s) |
|---|---|---|---|---|
| `relationship.tenure` | enum | "How long have you known them?" | 6 buttons | `shared_history_density` |
| `relationship.frequency` | enum | "How often do you interact?" | 5 buttons | `recency_frequency` |
| `relationship.last_interaction` | enum | "When did you last talk or hang out?" | 6 buttons | `recency_frequency` |
| `relationship.channels` | enum[] | "How do you usually connect — in person, text, calls?" | 6 chips, multi-select | `recency_frequency`, `emotional_intimacy` |
| `relationship.they_show_up_for_me` | enum | "When you're going through something, does X show up for you?" | 4 buttons | `emotional_intimacy` |
| `relationship.i_show_up_for_them` | enum | "When X is going through something, do you show up for them?" | 4 buttons | `reciprocity` |
| `relationship.knows_about_me` | enum | "Does X know your big stuff — family, fears, goals?" | 4 buttons | `depth_of_knowledge` |

### 5.2 Enum value definitions

```js
TENURE_OPTIONS = [
  { key: 'just_met',    label: 'Just met'    },
  { key: 'months',      label: 'A few months'},
  { key: 'one_year',    label: 'About a year'},
  { key: 'few_years',   label: 'A few years' },
  { key: 'five_plus',   label: '5+ years'    },
  { key: 'lifetime',    label: 'A lifetime'  },
];

FREQUENCY_OPTIONS = [
  { key: 'daily',              label: 'Daily'          },
  { key: 'weekly',             label: 'Weekly'         },
  { key: 'monthly',            label: 'Monthly'        },
  { key: 'few_times_a_year',   label: 'A few times/yr' },
  { key: 'rarely',             label: 'Rarely'         },
];

LAST_INTERACTION_OPTIONS = [
  { key: 'today',         label: 'Today'        },
  { key: 'this_week',     label: 'This week'    },
  { key: 'this_month',    label: 'This month'   },
  { key: 'this_season',   label: 'This season'  },
  { key: 'this_year',     label: 'This year'    },
  { key: 'over_a_year',   label: 'Over a year'  },
];

CHANNEL_OPTIONS = [
  { key: 'in_person',   label: 'In person'  },
  { key: 'text',        label: 'Text'       },
  { key: 'call',        label: 'Calls'      },
  { key: 'video_call',  label: 'Video'      },
  { key: 'dm',          label: 'DMs'        },
  { key: 'email',       label: 'Email'      },
  { key: 'other',       label: 'Other'      },
];

SUPPORT_OPTIONS = [
  { key: 'yes',          label: 'Yes'        },
  { key: 'sometimes',    label: 'Sometimes'  },
  { key: 'not_really',   label: 'Not really' },
  { key: 'not_sure',     label: 'Not sure'   },
];

KNOWS_OPTIONS = [
  { key: 'most_of_it',   label: 'Most of it' },
  { key: 'some_of_it',   label: 'Some of it' },
  { key: 'not_really',   label: 'Not really' },
  { key: 'not_sure',     label: 'Not sure'   },
];
```

### 5.3 Relationship to existing `last_interaction_at` field

The validation JSONs contain a top-level `last_interaction_at` field (ISO date, e.g., `"last_interaction_at": null`). It stays unchanged at the top level and remains optional precision data — useful when the user happens to know an exact date. The new `relationship.last_interaction` bucket enum is the load-bearing signal; `last_interaction_at` is supplementary. The scorer prefers the bucket; date is read only when bucket is absent.

### 5.4 `not_sure` and `null` semantics

`not_sure` is offered on every yes/maybe/no field as an explicit escape hatch — the user is never forced into a stance they don't have. The scorer treats `not_sure` and `null` identically: both mean "no signal in this field, fall back to other inputs and the type prior."

## 6. Form intake changes (`AddPersonModal.jsx`)

### 6.1 Wizard structure (5 steps)

| Step | Label | Fields | Status |
|---|---|---|---|
| 1 | Who | name, relationship.type, birthday | unchanged |
| **2** | **Connection** | **all 7 new fields** | **NEW** |
| 3 | Context | how_we_met, school, work | unchanged (renumbered) |
| 4 | Interests | hobbies, sports, favorites.* | unchanged (renumbered) |
| 5 | Memories | memories_together, important_events, things_to_look_forward_to | unchanged (renumbered) |

Connection step is inserted at position 2 — the load-bearing scoring data goes in immediately after identity, before the optional flavor steps. Steps 3–5 become entirely optional; the user can submit after step 2 and the scorer will still produce a calibrated score.

### 6.2 Connection step UI

Vertical stack of 7 question groups. Each group:

- Question label (matches the voice question phrasing in §5.1)
- Row of pill buttons for the enum (or chip multi-select for `channels`)
- Selected button is highlighted in the existing accent color
- No keyboard input required for any field — pure tap

Estimated time-to-complete for an engaged user: ~20–30 seconds for all 7 fields.

### 6.3 `BLANK` and `handleFormSubmit`

- `BLANK` extends with the 7 new keys, all initialized to `null` or `[]`.
- `handleFormSubmit` is replaced by a call to `buildPersonFromForm(form)` from `personSchema.js`.

### 6.4 Step-progress affordance

The 4-step progress indicator at the top of the modal becomes 5-step. No other visual changes to the modal chrome.

## 7. Voice intake changes (`geminiLive.js`)

### 7.1 System prompt update (`DEFAULT_SYSTEM_PROMPT`)

Replace the current 4-step flow with:

```
Flow:
1) Ask for name + relationship category.
2) Ask the seven Connection questions in order — these are the load-bearing
   signals. Ask them naturally, one at a time:
   a) How long known
   b) How often you interact
   c) When you last talked or hung out
   d) How you usually connect (in person, text, calls — multi-OK)
   e) When you're going through something, do they show up
   f) When they're going through something, do you show up
   g) Do they know your big stuff (family, fears, goals)
3) If signal is rich, ask optional context: birthday, how you met,
   school/work, hobbies, memories. If thin, end early and summarize.

Style:
- Warm, concise, one question at a time.
- Map free-form answers to the closest enum value internally — don't
  list options to the user unless they ask. ("every week" → weekly;
  "yeah, definitely" → yes; "since high school" → few_years or five_plus.)
- Never ask for sensitive private data.
- Keep turns short for spoken conversation.
```

### 7.2 Labeled-speech extraction grammar

The `EXTRACT_JSON` instruction in `DEFAULT_SYSTEM_PROMPT` is extended to emit the new fields. Append (in this order, before "Birthday is..."):

```
Tenure is [just_met|months|one_year|few_years|five_plus|lifetime|unknown].
Frequency is [daily|weekly|monthly|few_times_a_year|rarely|unknown].
Last interaction is [today|this_week|this_month|this_season|this_year|over_a_year|unknown].
Channels are [comma list of in_person|text|call|video_call|dm|email|other, or unknown].
They show up for me is [yes|sometimes|not_really|not_sure|unknown].
I show up for them is [yes|sometimes|not_really|not_sure|unknown].
Knows about me is [most_of_it|some_of_it|not_really|not_sure|unknown].
```

### 7.3 `parseLabeledSpeech()` updates

Add seven new field/list extractors mirroring the existing pattern, with enum validation:

```js
const enumField = (pattern, allowed) => {
  const v = field(pattern);
  return v && allowed.includes(v) ? v : null;
};

relationship: {
  type: ...,
  tenure:           enumField(/tenure is ([^.]+)/, TENURE_KEYS),
  frequency:        enumField(/frequency is ([^.]+)/, FREQUENCY_KEYS),
  last_interaction: enumField(/last interaction is ([^.]+)/, LAST_INTERACTION_KEYS),
  channels:         list(/channels are ([^.]+)/).filter((c) => CHANNEL_KEYS.includes(c)),
  they_show_up_for_me: enumField(/they show up for me is ([^.]+)/, SUPPORT_KEYS),
  i_show_up_for_them:  enumField(/i show up for them is ([^.]+)/, SUPPORT_KEYS),
  knows_about_me:      enumField(/knows about me is ([^.]+)/, KNOWS_KEYS),
}
```

`enumField` rejects malformed model output (e.g., the model says "kind of" instead of `sometimes`) by returning `null` rather than polluting the JSON. The scorer treats null as "no signal" and falls back to the type prior.

### 7.4 REST extractor (`extractPersonFromTranscript`)

Update `EXTRACT_SCHEMA` to include the seven new fields with `null`/`[]` defaults, and update `EXTRACT_PROMPT` rules:

```
- relationship.tenure: one of just_met | months | one_year | few_years | five_plus | lifetime, else null
- relationship.frequency: one of daily | weekly | monthly | few_times_a_year | rarely, else null
- relationship.last_interaction: one of today | this_week | this_month | this_season | this_year | over_a_year, else null
- relationship.channels: array of in_person | text | call | video_call | dm | email | other (subset, [] if unmentioned)
- relationship.they_show_up_for_me / i_show_up_for_them: one of yes | sometimes | not_really | not_sure, else null
- relationship.knows_about_me: one of most_of_it | some_of_it | not_really | not_sure, else null
- Map free-form phrasings to the closest enum (e.g., "every week" → weekly, "since high school" → few_years).
```

## 8. Scoring agent changes

### 8.1 System prompt (`scripts/score.mjs:62-77` and `server/scoringHandler.mjs`)

Add a new "Direct structured signals" block to the inference rules:

```
Direct structured signals (when present, weight these heavily — they
are the user's literal answer, not your inference):

- relationship.tenure → primary input for shared_history_density.
  lifetime ≈ 8-10, five_plus ≈ 6-8, few_years ≈ 5-7, one_year ≈ 3-5,
  months ≈ 2-4, just_met ≈ 1-2.

- relationship.frequency + relationship.last_interaction → primary
  inputs for recency_frequency. daily/today ≈ 9-10, weekly/this_week
  ≈ 7-8, monthly/this_month ≈ 5-6, few_times_a_year/this_season
  ≈ 3-4, rarely/over_a_year ≈ 1-2. Combine the two: a daily
  frequency with last_interaction=over_a_year is contradictory —
  trust the more recent signal but flag through reasoning.

- relationship.channels → modifier on recency_frequency and
  emotional_intimacy. in_person + call signals stronger ties than
  text/dm-only at the same frequency.

- relationship.they_show_up_for_me → primary input for
  emotional_intimacy. "yes" puts the floor at 6 unless directly
  contradicted; "sometimes" at 4; "not_really" caps at 4;
  "not_sure" / null = no signal.

- relationship.i_show_up_for_them → primary input for reciprocity,
  same scaling as above.

- relationship.knows_about_me → primary input for depth_of_knowledge.
  most_of_it floor at 6; some_of_it at 4; not_really caps at 4;
  not_sure / null = no signal.

When any of these structured fields is present for a dimension,
weight it MORE than free-text inference for that dimension. When
absent, fall back to the existing rules: type-prior, notes, and
natural-language cues from history fields.
```

### 8.2 Anchor calibration blocks

For each of the 15 anchors in `2026-04-25-scoring-rubric-anchors.md` (5 dimensions × 3 levels), append a compact `Implied structured signals` block (typically 5–6 lines — only include the fields that are load-bearing for the anchor's dimension and adjacent dimensions). Example for the level-8 depth-of-knowledge anchor (Theo):

```markdown
**Implied structured signals:**
- tenure: lifetime
- frequency: weekly
- last_interaction: this_week
- they_show_up_for_me: yes
- i_show_up_for_them: yes
- knows_about_me: most_of_it
```

This gives the scorer concrete structured-field calibration alongside the prose anchor, so pattern-matching works for both old (prose-rich) and new (structure-rich) records.

### 8.3 Missing-field handling

Behavior when the new fields are absent (`null` or omitted entirely): scorer behaves exactly as today — relies on `relationship.type` prior, `notes` prose, and free-text cues. This is the backward-compatibility guarantee. Validation JSONs `01_acquaintance.json` through `05_inner_circle.json` will continue to score within their existing expected ranges without modification.

### 8.4 Self-consistency and aggregation

No changes. `scoreOnce` still runs 3 samples; per-dimension median; aggregate is the median of the 3 sample aggregates. Variance and reasoning selection unchanged.

## 9. Backwards compatibility

- **Existing person records** (any persisted by the running app to date) lack the 7 new fields. They remain valid; the scorer falls back to the v1 inference rules.
- **Validation JSONs** (`data/validation/0[1-5]_*.json`) stay untouched in their original form. After this spec ships, additional validation JSONs that exercise the new fields directly should be added (see §11).
- **`notes` and `history.*`** remain in the schema and are still extracted by the voice agent and writable in the form. They no longer carry the load but continue to enrich the scorer's reasoning.

## 10. File-level change list

- **NEW** `src/constants/personSchema.js` — single source of truth for enums, `BLANK_PERSON`, `buildPersonFromForm`, `buildPersonFromExtraction`.
- **EDIT** `src/components/AddPersonModal/AddPersonModal.jsx` — import from schema module; replace inline `BLANK`; insert "Connection" as step 2; add 7 new tap-field UI groups; replace `handleFormSubmit` with `buildPersonFromForm`.
- **EDIT** `src/components/AddPersonModal/AddPersonModal.css` — styles for the new pill-button groups and chip multi-select if not already present.
- **EDIT** `src/services/geminiLive.js` — extend `EXTRACT_SCHEMA`, `EXTRACT_PROMPT`, `DEFAULT_SYSTEM_PROMPT` (flow + EXTRACT_JSON template); extend `parseLabeledSpeech` with the 7 new extractors and enum validation; route final JSON through `buildPersonFromExtraction`.
- **EDIT** `scripts/score.mjs` — extend `buildSystemPrompt` with the §8.1 structured-signal block.
- **EDIT** `server/scoringHandler.mjs` — mirror the system-prompt change.
- **EDIT** `docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md` — append `Implied structured signals` blocks to all 15 anchors.
- **NEW** `data/validation/06_structured_only.json` — a validation case that uses ONLY the new structured fields (no `notes`, no `history`) to verify the scorer can score from structure alone (see §11).

## 11. Validation plan

After implementation:

1. Re-run all 5 existing validation JSONs through `scripts/score.mjs`. Expected: aggregates remain within ±10 of their `_expected_aggregate` band (the field stores tilde-prefixed strings like `"~4"` indicating an approximate score on a 0–10 dimension scale; the aggregate is on the 0–100 product scale, so a "~4" anchor implies an aggregate around 40). This is an informal eyeball check, not an automated assertion. Goal: prove backward compatibility.
2. Run the new `06_structured_only.json` (a "close friend" profile with only the 7 new fields filled, no prose). Expected: aggregate ≥ 65 — proves the new fields alone can produce a calibrated score.
3. Run a "contradictory" case (e.g., `frequency: rarely` but `notes: "we hang out every day"`) to verify the scorer trusts the structured field and reflects the contradiction in reasoning text.
4. Manually run both the form and voice intake paths end-to-end. Verify both emit the same JSON shape (matching keys, matching enum values) for an identical person.

## 12. Open questions

None blocking. Implementation can proceed once this spec is approved.

## 13. Out-of-scope follow-ups (for future specs)

- Messaging-history ingestion (iMessage SQLite read, WhatsApp `.txt` parse, Instagram JSON archive) feeding the same Person JSON v2.
- Contact info (`email`, `phone`) field additions.
- Photos / Calendar / Contacts passive sync.
- Spatial-drag or pairwise-comparison alternative scoring UX.
