# `scripts/score.mjs` — Design Spec

## Purpose

A Node script that scores a Person JSON against the v1 rubric using Claude Opus 4.6 with extended thinking, anchored exemplars, and self-consistency (3 samples). Used to iterate the rubric prompt against ~5 hand-written validation people until aggregates feel right. The logic ports to `src/services/scoring.js` later for in-app use.

## Technique (for the demo pitch)

- **LLM-as-judge with anchored rubric** — Claude grades 5 dimensions (depth_of_knowledge, emotional_intimacy, recency_frequency, shared_history_density, reciprocity) on a 0–10 scale, using user-written anchor exemplars (level 2 / 5 / 8) to keep the scale calibrated across people.
- **Self-consistency** (Wang et al. 2022) — same prompt run 3× at temperature 1.0; per-dimension final score is the median; aggregate is the median of the 3 sample aggregates; variance flag derived from spread.
- **Extended thinking** — Claude Opus 4.6's internal reasoning budget (4000 tokens) so the model deliberates against the anchors before committing.
- **Structured output via tool use** — a `submit_score` tool with a strict JSON schema forces well-formed responses; no text parsing.

## Architecture

Single file, ~200 LOC:

```
scripts/score.mjs
├── loadAnchors()          — read docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md
├── buildPrompt(person)    — system: rubric + anchors; user: Person JSON
├── scoreOnce(person)      — 1 API call, returns { dimensions, sampleAggregate }
├── scorePerson(person)    — runs scoreOnce 3× in parallel, aggregates
├── formatTable(results)   — comparison table for batch validation
└── main()                 — CLI: arg parsing, file IO, output
```

## API call shape (per sample)

- **Model:** `claude-opus-4-6`
- **Extended thinking:** enabled, `budget_tokens: 4000`
- **Temperature:** `1.0` (required with thinking; also provides the variation self-consistency depends on)
- **Tool use:** single `submit_score` tool, `tool_choice: { type: "tool", name: "submit_score" }` to force the model to call it
- **Tool input schema:**
  ```json
  {
    "type": "object",
    "required": ["dimensions"],
    "properties": {
      "dimensions": {
        "type": "object",
        "required": ["depth_of_knowledge", "emotional_intimacy", "recency_frequency", "shared_history_density", "reciprocity"],
        "properties": {
          "depth_of_knowledge":     { "type": "object", "required": ["score","reasoning"], "properties": { "score": { "type": "integer", "minimum": 0, "maximum": 10 }, "reasoning": { "type": "string" } } },
          "emotional_intimacy":     { "type": "object", "required": ["score","reasoning"], "properties": { "score": { "type": "integer", "minimum": 0, "maximum": 10 }, "reasoning": { "type": "string" } } },
          "recency_frequency":      { "type": "object", "required": ["score","reasoning"], "properties": { "score": { "type": "integer", "minimum": 0, "maximum": 10 }, "reasoning": { "type": "string" } } },
          "shared_history_density": { "type": "object", "required": ["score","reasoning"], "properties": { "score": { "type": "integer", "minimum": 0, "maximum": 10 }, "reasoning": { "type": "string" } } },
          "reciprocity":            { "type": "object", "required": ["score","reasoning"], "properties": { "score": { "type": "integer", "minimum": 0, "maximum": 10 }, "reasoning": { "type": "string" } } }
        }
      }
    }
  }
  ```
- **System prompt** (sketch):
  > You are scoring a relationship across 5 dimensions on a 0–10 scale. For each dimension you are given anchor exemplars at levels 2, 5, and 8. Score the given person against those anchors. Call the `submit_score` tool with your scores and a short reasoning per dimension (1–2 sentences citing specifics from the Person JSON).
  >
  > [full anchors markdown injected here]
- **User message:** the Person JSON, pretty-printed.

## Aggregation (after 3 samples)

For each sample, compute `sampleAggregate = round(mean(5 dimension scores) × 10)`, giving `samples = [a1, a2, a3]`.

- **Per-dimension final `score`** = median of the 3 sample scores for that dimension
- **Per-dimension `reasoning`** = the reasoning from the sample whose `sampleAggregate` is the median (preserves a single coherent voice — no stitching across runs)
- **`aggregate`** = median of `samples`
- **`variance`** = `"low"` if `max(samples) - min(samples) ≤ 10` else `"high"`
- **`scored_at`** = ISO timestamp at write
- **`model`** = `"claude-opus-4-6"`
- **`rubric_version`** = `"v1"`
- **`relationship.strength`** mirrors `aggregate`

If two of the three sample aggregates tie for the median, pick the first by index (stable; no astrology around tie-breaking).

## CLI

```
node scripts/score.mjs <path-to-person.json>            # print scoring block to stdout
node scripts/score.mjs --write <path-to-person.json>    # also write back into file
node scripts/score.mjs data/validation/*.json           # batch + comparison table
```

**Single-file output:** prints the full `scoring` block as pretty JSON, followed by a one-line summary:
```
jen_acquaintance: aggregate=18  variance=low  samples=[16,18,20]
```

**Batch output:** comparison table. Each validation person JSON has an optional `_expected_aggregate` top-level field (stripped before sending to Claude). Table:
```
name                  expected  actual  variance  samples
jen_acquaintance      ~2        18      low       [16,18,20]
sam_classmate         ~4        42      low       [40,42,44]
maya_friend           ~6        61      low       [58,61,64]
ben_close_friend      ~8        82      low       [80,82,84]
mom                   ~9-10     94      low       [92,94,96]
```

**`--write` flag:** when set on a single file, the script also updates `scoring`, `relationship.strength`, and `updated_at` in the input JSON in place. Not applied in batch mode (validation runs are read-only by default — you don't want to clobber the canonical validation set).

## Failure handling

- If a single API call fails (network, schema validation, rate limit), retry once with the same parameters.
- If it fails again, abort the whole person with a non-zero exit code and a clear error message naming the person and the failing sample. No partial scoring written.
- Schema violations should be vanishingly rare given tool-use enforcement; surface them loudly if they happen so the prompt can be tightened.

## File / data layout

```
scripts/
  score.mjs                      # this script
data/
  validation/
    01_acquaintance.json         # ~2
    02_classmate.json            # ~4
    03_friend.json               # ~6
    04_close_friend.json         # ~8
    05_inner_circle.json         # ~9-10
docs/superpowers/specs/
  2026-04-25-scoring-rubric-anchors.md  # rubric + anchors (already exists, Ethan-filled)
```

Each validation file is a Person JSON conforming to the v1 schema, plus an optional top-level `_expected_aggregate` (string like `"~6"` or `"~9-10"`) used only for the batch comparison table.

## Environment

- `ANTHROPIC_API_KEY` — read from environment. Script aborts with a clear message if unset.
- Node 18+ (for native `fetch` and top-level await). Glob expansion is handled by the shell — the script just receives a list of file path arguments.
- SDK: `@anthropic-ai/sdk` ^0.91.1, already in `package.json`.

## Iteration loop

1. Edit anchors in the rubric markdown file.
2. Run `node scripts/score.mjs data/validation/*.json`.
3. Read the comparison table. If a dimension drifts on a specific person, look at that person's per-dimension reasoning to see *why* Claude scored it that way.
4. Sharpen the anchor on the drifting dimension — usually the level-5 anchor needs the most work.
5. Repeat until all 5 validation people land within ±1 point of expected aggregate, with `variance: low`.

## Explicitly out of scope

- **Firestore writes** — happens later in `src/services/scoring.js`.
- **Prompt caching** — static rubric is a natural fit, but with ~$3000 credits and 5 validation people the savings aren't worth the plumbing yet. Easy to add later if iteration speed becomes annoying.
- **Streaming** — scoring is offline; latency isn't user-facing.
- **Concurrency limits / rate-limit backoff** — 3 parallel calls per person is well under any tier limit. If batch validation grows past ~20 people, revisit.
- **Multi-rubric versioning logic** — `rubric_version` is hardcoded to `"v1"` for now. When the rubric changes meaningfully, bump the constant; old scores stay tagged.

## Two-agent demo story

This script implements the **offline scoring agent**. The chat agent (separate, online) will use **structured RAG** over the constellation: when the user double-clicks nodes into the chat, those Person JSONs are retrieved by id and injected into Claude's context, optionally augmented with tool use (`get_person_details`, `find_people_by_interest`, `update_person_memory`). Pitch line for judges:

> *"Two Claude agents — an offline scoring agent using anchored-rubric LLM judging with self-consistency, and an online chat agent using structured RAG over the constellation with tool use to read and update relationships."*
