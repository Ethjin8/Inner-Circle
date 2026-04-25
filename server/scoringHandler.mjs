// Server-side scoring handler. Mirrors scripts/score.mjs's pipeline but
// reads ANTHROPIC_API_KEY from process.env (NOT VITE_*), so the key never
// ships to the browser. Mounted as POST /api/score by vite.config.js.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-4-6';
const RUBRIC_VERSION = 'v1';
const ANCHORS_PATH = 'docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md';
const NUM_SAMPLES = 3;
const EFFORT = 'high';
const MAX_TOKENS = 16000;
const DIMENSIONS = [
  'depth_of_knowledge',
  'emotional_intimacy',
  'recency_frequency',
  'shared_history_density',
  'reciprocity',
];

const SUBMIT_SCORE_TOOL = {
  name: 'submit_score',
  description:
    'Submit the final 0-10 score and 1-2 sentence reasoning for each of the 5 relationship dimensions.',
  input_schema: {
    type: 'object',
    required: ['dimensions'],
    properties: {
      dimensions: {
        type: 'object',
        required: DIMENSIONS,
        properties: Object.fromEntries(
          DIMENSIONS.map((d) => [
            d,
            {
              type: 'object',
              required: ['score', 'reasoning'],
              properties: {
                score: { type: 'integer', minimum: 0, maximum: 10 },
                reasoning: { type: 'string' },
              },
            },
          ]),
        ),
      },
    },
  },
};

let _anchorsCache = null;
function loadAnchors() {
  if (_anchorsCache) return _anchorsCache;
  _anchorsCache = readFileSync(resolve(ANCHORS_PATH), 'utf8');
  return _anchorsCache;
}

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

// Strip UI-only fields before sending to Claude. Also strip
// `relationship.strength` — that's the value the AI is supposed to derive,
// so feeding the user's manual slider value back to Claude would bias the
// score (anchoring on whatever the form defaulted to).
function personPayload(person) {
  const { id, initials, scoring, relationship, ...rest } = person;
  const cleanedRel = relationship ? (() => {
    const { strength, ...relRest } = relationship;
    return relRest;
  })() : undefined;
  return cleanedRel ? { ...rest, relationship: cleanedRel } : rest;
}

async function scoreOnce(client, person, systemPrompt) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 1.0,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT },
    system: systemPrompt,
    tools: [SUBMIT_SCORE_TOOL],
    messages: [
      {
        role: 'user',
        content:
          'Score this person:\n\n```json\n' +
          JSON.stringify(personPayload(person), null, 2) +
          '\n```',
      },
    ],
  });

  const toolUse = resp.content.find((c) => c.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block — model did not call submit_score');
  const dims = toolUse.input.dimensions;
  const scores = DIMENSIONS.map((d) => dims[d].score);
  const sampleAggregate = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10);
  return { dimensions: dims, sampleAggregate };
}

async function withRetry(fn) {
  try { return await fn(); } catch { return await fn(); }
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set on the server');
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function scorePerson(person) {
  const client = getClient();
  const systemPrompt = buildSystemPrompt();

  const samples = await Promise.all(
    Array.from({ length: NUM_SAMPLES }, () =>
      withRetry(() => scoreOnce(client, person, systemPrompt)),
    ),
  );

  const finalDims = {};
  for (const d of DIMENSIONS) {
    const triple = samples.map((s) => s.dimensions[d].score);
    finalDims[d] = { score: median(triple) };
  }

  const sampleAggs = samples.map((s) => s.sampleAggregate);
  const aggregate = median(sampleAggs);

  const sortedByAgg = [...samples].sort((a, b) => a.sampleAggregate - b.sampleAggregate);
  const medianSample = sortedByAgg[1];
  for (const d of DIMENSIONS) {
    finalDims[d].reasoning = medianSample.dimensions[d].reasoning;
  }

  const variance = Math.max(...sampleAggs) - Math.min(...sampleAggs) <= 10 ? 'low' : 'high';

  return {
    aggregate,
    dimensions: finalDims,
    variance,
    samples: sampleAggs,
    scored_at: new Date().toISOString(),
    model: MODEL,
    rubric_version: RUBRIC_VERSION,
  };
}

// Connect-style middleware for Vite. Returns a function that handles
// POST /api/score and forwards everything else to `next`.
export function scoringMiddleware() {
  return async (req, res, next) => {
    if (req.method !== 'POST' || !req.url.startsWith('/api/score')) {
      return next();
    }
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const { person } = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (!person || typeof person !== 'object') {
        res.statusCode = 400;
        res.end('Missing `person` in request body');
        return;
      }
      const scoring = await scorePerson(person);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(scoring));
    } catch (err) {
      console.error('[/api/score] failed:', err);
      res.statusCode = 500;
      res.end(err?.message || 'Scoring failed');
    }
  };
}
