// server/chatHandler.mjs
import Anthropic from '@anthropic-ai/sdk';
import { defaultEmbedCache } from './embedCache.mjs';
import { getPersonDetails, findPeopleByAttribute, semanticSearch, draftEmail, createCalendarEvent } from './chatTools.mjs';

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
  {
    name: 'draft_email',
    description: 'Open a Gmail compose draft pre-filled with a personalized email to someone in the constellation. Use when the user asks to write, draft, send, or message someone. Look up the person via the read tools first so the body can reference real shared memories, hobbies, or context. The user reviews and edits before sending.',
    input_schema: {
      type: 'object',
      required: ['body'],
      properties: {
        to: { type: 'string', description: "Recipient email address. Leave empty if unknown — the user will fill it in." },
        subject: { type: 'string', description: 'Short, warm subject line.' },
        body: { type: 'string', description: 'Full email body. Friendly, concrete, references specific shared context. Sign off naturally.' },
        summary: { type: 'string', description: 'One sentence describing the email for the chat reply.' },
      },
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Open an Add-to-Google-Calendar card for a meet-up, call, or coffee with someone in the constellation. Use when the user asks to schedule, plan, set up, meet, call, or grab coffee. If no time is specified, suggest a sensible time next week. The user reviews before adding to their calendar.',
    input_schema: {
      type: 'object',
      required: ['title', 'startDate'],
      properties: {
        title: { type: 'string', description: 'Event title, e.g. "Coffee with Jake".' },
        description: { type: 'string', description: 'What the event is about. Reference shared interests / what to talk about.' },
        startDate: { type: 'string', description: 'ISO 8601 start time, e.g. 2026-04-28T10:00:00Z.' },
        endDate: { type: 'string', description: 'ISO 8601 end time. Defaults to start+1h if omitted.' },
        location: { type: 'string', description: 'Where, if relevant.' },
        attendeeName: { type: 'string', description: "The person's name from the constellation." },
        summary: { type: 'string', description: 'One sentence describing the event for the chat reply.' },
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
    "- ACTION TOOLS: when the user asks to email/message/write someone, call draft_email. When they ask to schedule/plan/meet/call/coffee with someone, call create_calendar_event. Pull personalization signals first via the read tools — reference real shared memories, hobbies, and context in the draft. Today's date is " + new Date().toISOString().slice(0, 10) + "; pick a sensible near-future time if the user doesn't specify one.",
    "- After calling an action tool, give a one-line confirmation in your reply (e.g. 'Drafted a coffee invite to Jake — open the editor to tweak and send.'). The user sees the editable draft as a modal, so don't paste the full body into chat.",
    "- Keep answers concrete and actionable. Cite specific fields ('Mom's gardening hobby suggests...') rather than vague generalities.",
    "- The user's chat is informal. Match that tone; don't over-format.",
    "- NEVER use emoji in your replies (no 😊, 🎉, ✨, 🔥, etc.). The interface is editorial; emoji clash with the typography. Use plain words for emphasis instead.",
    "- CRITICAL SPACING RULES (HIGHEST PRIORITY — SPACING ERRORS MAKE TEXT UNREADABLE):",
    "  • MANDATORY: Put EXACTLY ONE SPACE after EVERY punctuation mark",
    "  • Period: 'word. Next' NOT 'word.Next'",
    "  • Exclamation: 'Great! Let' NOT 'Great!Let'",
    "  • Question: 'Why? Because' NOT 'Why?Because'",
    "  • Comma: 'Yes, I' NOT 'Yes,I'",
    "  • Colon: 'Note: This' NOT 'Note:This'",
    "  • ALWAYS put exactly ONE space between words",
    "  • NEVER concatenate words: 'Mom and Dad' NOT 'MomandDad'",
    "  • CHECK EVERY SENTENCE: If you write 'Jake!That's' it is WRONG — you MUST write 'Jake! That's'",
    "  • This is NOT optional. Missing spaces after punctuation is a critical error.",
    "- Use paragraph breaks (a literal blank line — two newline characters '\\n\\n') between distinct trains of thought. A single newline is NOT enough — your renderer treats it as the same paragraph. Required transitions that MUST get a blank-line break:",
    "  • after narrating a tool action, before commentary/recommendation",
    "  • after listing what you found, before how you'd interpret or act on it",
    "  • after a 'here's what I know' summary, before a follow-up suggestion or question",
    "  • whenever you shift from describing the past to suggesting the future",
    "  Example of CORRECT spacing (note the blank line):",
    "    Got it. Here is what I know about Ryan and Alex.",
    "",
    "    Both lean technical and have overlapping interest in ML, so a project bridging research and applied work would land well.",
    "  Example of WRONG output (one wall of text): 'Got it. Here is what I know about them and how I would think about organizing a project with both: ...' — fix this by breaking after the first sentence.",
    "  Default to MORE paragraph breaks rather than fewer. If a reply has 3+ sentences and shifts focus even once, break it.",
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
  if (name === 'draft_email') return draftEmail(input);
  if (name === 'create_calendar_event') return createCalendarEvent(input);
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
          let fixedText = event.delta.text;

          // Streaming-aware spacing fix: check if we need a space after previous chunk's punctuation
          if (last?.type === 'text' && last.text.length > 0) {
            const lastChar = last.text[last.text.length - 1];
            const firstChar = fixedText[0];

            // If previous chunk ended with punctuation and current chunk starts with a letter (no space)
            if (/[.!?:;,]/.test(lastChar) && firstChar && /[a-zA-Z]/.test(firstChar) && firstChar !== ' ') {
              fixedText = ' ' + fixedText;
            }
          }

          // Also fix spacing within the current chunk
          fixedText = fixedText.replace(/([.!?:;,])([A-Za-z])/g, '$1 $2');

          if (last?.type === 'text') last.text += fixedText;
          sseWrite(res, 'text-delta', { delta: fixedText });
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

      const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
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
