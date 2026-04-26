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
