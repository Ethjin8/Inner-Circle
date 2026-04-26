#!/usr/bin/env node
// Score a Person JSON against the v1 rubric using Claude with extended thinking,
// anchored exemplars, and self-consistency (3 samples). See spec:
// docs/superpowers/specs/2026-04-25-score-script-design.md

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

// Load .env into process.env (no extra dep — Node 20+ supports --env-file, but
// we parse manually so plain `node scripts/score.mjs ...` works everywhere).
loadDotenv(".env");

const MODEL = "claude-opus-4-6";
const RUBRIC_VERSION = "v1";
const ANCHORS_PATH = "docs/superpowers/specs/2026-04-25-scoring-rubric-anchors.md";
const NUM_SAMPLES = 3;
const EFFORT = "high"; // low | medium | high | max — controls adaptive-thinking depth
const MAX_TOKENS = 16000;
const DIMENSIONS = [
  "depth_of_knowledge",
  "emotional_intimacy",
  "recency_frequency",
  "shared_history_density",
  "reciprocity",
];

const SUBMIT_SCORE_TOOL = {
  name: "submit_score",
  description:
    "Submit the final 0-10 score and 1-2 sentence reasoning for each of the 5 relationship dimensions.",
  input_schema: {
    type: "object",
    required: ["dimensions"],
    properties: {
      dimensions: {
        type: "object",
        required: DIMENSIONS,
        properties: Object.fromEntries(
          DIMENSIONS.map((d) => [
            d,
            {
              type: "object",
              required: ["score", "reasoning"],
              properties: {
                score: { type: "integer", minimum: 0, maximum: 10 },
                reasoning: { type: "string" },
              },
            },
          ]),
        ),
      },
    },
  },
};

function loadAnchors() {
  return readFileSync(resolve(ANCHORS_PATH), "utf8");
}

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
    "Reasoning style (this text is shown directly to the user):",
    "- ONE short sentence per dimension, max ~18 words.",
    "- NEVER mention internal field names or enum values verbatim. No \"they_show_up_for_me\", \"knows_about_me\", \"last_interaction\", \"tenure\", \"frequency\", \"i_show_up_for_them\", \"channels\", \"five_plus\", \"this_week\", \"most_of_it\", \"not_really\", \"not_sure\", etc. Translate every signal into plain English.",
    "- Examples of the right style: instead of '\"knows_about_me\" is \"not_really\"', write \"you know surface facts but not the deeper stuff.\" Instead of '\"they_show_up_for_me\" is \"sometimes\"', write \"they're inconsistently there when things get hard.\" Instead of '\"frequency\" is \"daily\" with \"last_interaction\" today', write \"you see them every day, including today.\"",
    "- Cite what the user told you, paraphrased — a concrete fact, behavior pattern, or how-it-feels description. Reference notes/history phrasings directly when natural.",
    "- Do NOT mention \"anchors\", \"exemplars\", \"level 5\", \"the rubric\", calibration, scoring machinery, fields, JSON, or schema.",
    "- Plain conversational language. No backticks, no quoted enum tokens, no underscored identifiers.",
    "",
    "For each dimension give a 0-10 score and a brief plain-language reason. You MUST call the `submit_score` tool — text alone is not a valid response.",
    "",
    "=== ANCHOR REFERENCES ===",
    anchorsMarkdown,
  ].join("\n");
}

async function scoreOnce(client, person, systemPrompt) {
  // Strip the validation-only field before sending to Claude.
  const { _expected_aggregate, ...personForClaude } = person;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 1.0,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT },
    system: systemPrompt,
    tools: [SUBMIT_SCORE_TOOL],
    // Forced tool_choice is incompatible with extended thinking; we rely on
    // the system-prompt mandate + the no-tool-use guard below.
    messages: [
      {
        role: "user",
        content:
          "Score this person:\n\n```json\n" +
          JSON.stringify(personForClaude, null, 2) +
          "\n```",
      },
    ],
  });

  const toolUse = resp.content.find((c) => c.type === "tool_use");
  if (!toolUse) {
    throw new Error("No tool_use block in response — model did not call submit_score");
  }
  const dims = toolUse.input.dimensions;
  const scores = DIMENSIONS.map((d) => dims[d].score);
  const sampleAggregate = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10);
  return { dimensions: dims, sampleAggregate };
}

async function withRetry(fn, label) {
  try {
    return await fn();
  } catch (err) {
    console.error(`  ! ${label} failed (${err.message}); retrying once...`);
    return await fn();
  }
}

async function scorePerson(client, person) {
  const systemPrompt = buildSystemPrompt(loadAnchors());

  const samples = await Promise.all(
    Array.from({ length: NUM_SAMPLES }, (_, i) =>
      withRetry(() => scoreOnce(client, person, systemPrompt), `${person.name} sample ${i + 1}`),
    ),
  );

  // Per-dimension median across the 3 samples.
  const finalDims = {};
  for (const d of DIMENSIONS) {
    const triple = samples.map((s) => s.dimensions[d].score);
    finalDims[d] = { score: median(triple) };
  }

  // Aggregate = median of the 3 sample aggregates.
  const sampleAggs = samples.map((s) => s.sampleAggregate);
  const aggregate = median(sampleAggs);

  // Use reasoning from the sample whose aggregate equals the median (preserves a
  // single coherent voice instead of stitching reasoning across runs).
  const sortedByAgg = [...samples].sort((a, b) => a.sampleAggregate - b.sampleAggregate);
  const medianSample = sortedByAgg[1]; // index 1 of 3 sorted = median
  for (const d of DIMENSIONS) {
    finalDims[d].reasoning = medianSample.dimensions[d].reasoning;
  }

  const variance = Math.max(...sampleAggs) - Math.min(...sampleAggs) <= 10 ? "low" : "high";

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

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function formatTable(rows) {
  const headers = ["name", "expected", "actual", "variance", "samples"];
  const data = rows.map((r) => [
    r.name,
    r.expected ?? "",
    String(r.scoring.aggregate),
    r.scoring.variance,
    "[" + r.scoring.samples.join(",") + "]",
  ]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...data.map((row) => String(row[i]).length)),
  );
  const fmt = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  return [fmt(headers), fmt(widths.map((w) => "-".repeat(w))), ...data.map(fmt)].join("\n");
}

function loadDotenv(path) {
  try {
    const text = readFileSync(resolve(path), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (!m) continue;
      const [, key, rawVal] = m;
      if (process.env[key]) continue; // don't overwrite real env
      process.env[key] = rawVal.replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env optional
  }
}

async function main() {
  const args = process.argv.slice(2);
  const writeFlag = args.includes("--write");
  const files = args.filter((a) => a !== "--write");

  if (files.length === 0) {
    console.error("Usage: node scripts/score.mjs [--write] <person.json> [more.json ...]");
    process.exit(2);
  }
  if (writeFlag && files.length > 1) {
    console.error("--write only supported for a single file (validation runs are read-only)");
    process.exit(2);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set (add it to .env or your shell).");
    process.exit(2);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const results = [];
  for (const file of files) {
    const path = resolve(file);
    const person = JSON.parse(readFileSync(path, "utf8"));
    const label = person.name || basename(file);
    console.error(`Scoring ${label}...`);
    const scoring = await scorePerson(client, person);
    results.push({
      file: path,
      name: label,
      expected: person._expected_aggregate,
      person,
      scoring,
    });
    console.error(
      `  ${label}: aggregate=${scoring.aggregate}  variance=${scoring.variance}  samples=[${scoring.samples.join(",")}]`,
    );
  }

  if (files.length === 1) {
    const r = results[0];
    console.log(JSON.stringify(r.scoring, null, 2));
    if (writeFlag) {
      const updated = {
        ...r.person,
        scoring: r.scoring,
        relationship: { ...(r.person.relationship || {}), strength: r.scoring.aggregate },
        updated_at: r.scoring.scored_at,
      };
      writeFileSync(r.file, JSON.stringify(updated, null, 2) + "\n");
      console.error(`Wrote scoring back to ${r.file}`);
    }
  } else {
    console.log("\n" + formatTable(results));
  }
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
