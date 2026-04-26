import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ChatGroq } from '@langchain/groq';
import { DynamicTool } from '@langchain/core/tools';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage } from '@langchain/core/messages';
import { createGmailDraft, sendGmailDraft, updateGmailDraft } from './gmail.mjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ─── 1. Firebase Admin ───────────────────────────────────────────────────────
const serviceAccountPath = path.join(__dirname, '../serviceAccount.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ─── 2. LangChain Tools ──────────────────────────────────────────────────────
const searchFirebaseTool = new DynamicTool({
  name: "search_relationships",
  description: "Search the Inner Circle database for relationship data, context, and history about a person. Input should be the person's first name.",
  func: async (name) => {
    console.log(`🔍 Searching Firebase for: ${name}`);
    const snapshot = await db.collection('people').where('name', '==', name).get();
    if (snapshot.empty) {
      const all = await db.collection('people').get();
      const match = all.docs.find(doc =>
        doc.data().name.toLowerCase().includes(name.toLowerCase())
      );
      if (match) return JSON.stringify(match.data());
      return `No data found for "${name}" in the database.`;
    }
    const results = [];
    snapshot.forEach(doc => results.push(doc.data()));
    return JSON.stringify(results);
  },
});

// ─── 3. LLM + Agent ──────────────────────────────────────────────────────────
const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0.2,
});

const tools = [searchFirebaseTool];

const systemPrompt = `
You are "Inner Circle Brain", an AI assistant that helps users nurture their personal relationships.
You have access to the user's relationship database.

IMPORTANT - always respond in this EXACT JSON format so the app can parse your response:

For EMAIL requests:
{
  "type": "email",
  "to": "<recipient email if known, else empty string>",
  "subject": "<email subject>",
  "body": "<full email body, friendly and personalized>",
  "summary": "<one sentence describing what you did>"
}

For CALENDAR EVENT requests:
{
  "type": "calendar",
  "title": "<event title>",
  "description": "<event description, mention what you plan to talk about>",
  "startDate": "<ISO 8601 date string, e.g. 2026-04-28T10:00:00>",
  "endDate": "<ISO 8601 date string, one hour after start by default>",
  "location": "<location if mentioned, else empty string>",
  "attendeeName": "<person's name>",
  "summary": "<one sentence describing what you did>"
}

Rules:
1. Use search_relationships to get full context about the person first.
2. Use their hobbies, memories, and relationship context to personalize your output.
3. Keep tone warm and natural, not generic.
4. If you don't know a recipient email, leave "to" as empty string.
5. For calendar events, if no date is specified, suggest a time next week.
6. Detect intent: words like "meet", "schedule", "plan", "coffee", "call" → calendar. Words like "email", "message", "write", "draft" → email.
`;

const agent = createReactAgent({
  llm,
  tools,
  messageModifier: systemPrompt,
});

// ─── 4. API Routes ────────────────────────────────────────────────────────────

// Main chat endpoint — calls the AI agent
app.post('/api/chat', async (req, res) => {
  const { prompt, contextNodes, accessToken } = req.body;

  try {
    const contextString = contextNodes?.map(n =>
      `${n.name} (${n.relationship?.type || 'connection'})`
    ).join(', ') || '';

    const fullPrompt = contextString
      ? `[User's attached context: ${contextString}] ${prompt}`
      : prompt;

    console.log(`🧠 Agent prompt: ${fullPrompt}`);

    const result = await agent.invoke({
      messages: [new HumanMessage(fullPrompt)],
    });

    const lastMessage = result.messages[result.messages.length - 1];
    let content = lastMessage.content;

    // Try to parse as JSON for structured response
    let parsed = null;
    try {
      // Strip markdown code fences if present
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // Not JSON, return as plain text
      parsed = { type: 'text', body: content, subject: '', to: '' };
    }

    // If we have an accessToken and it's an email, auto-create the Gmail draft
    let draftId = null;
    let draftLink = null;
    if (accessToken && parsed.type === 'email' && parsed.body) {
      try {
        const draft = await createGmailDraft(accessToken, {
          to: parsed.to || '',
          subject: parsed.subject || 'Catching up',
          body: parsed.body,
        });
        draftId = draft.draftId;
        draftLink = draft.draftLink;
        console.log(`✉️  Gmail draft created: ${draftLink}`);
      } catch (gmailErr) {
        console.warn('Gmail draft creation failed (continuing anyway):', gmailErr.message);
      }
    }

    res.json({ ...parsed, draftId, draftLink });

  } catch (error) {
    console.error('Agent Error:', error.message);
    // Rate limit fallback
    if (error.message.includes('429') || error.message.includes('Quota')) {
      return res.json({
        type: 'email',
        to: '',
        subject: 'Catching up ☕',
        body: `Hey!\n\nI was just thinking about you and wanted to check in. It's been a while since we last caught up.\n\nLet me know if you'd like to grab a coffee or hop on a call soon!\n\nBest,\nNathan`,
        summary: 'Drafted a catch-up email (fallback mode).',
        draftId: null,
        draftLink: null,
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// Send a draft via Gmail API
app.post('/api/gmail/send', async (req, res) => {
  const { draftId, accessToken } = req.body;
  if (!draftId || !accessToken) {
    return res.status(400).json({ error: 'draftId and accessToken required' });
  }
  try {
    const result = await sendGmailDraft(accessToken, draftId);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update a draft (user edited in-app)
app.post('/api/gmail/update', async (req, res) => {
  const { draftId, accessToken, to, subject, body } = req.body;
  if (!draftId || !accessToken) {
    return res.status(400).json({ error: 'draftId and accessToken required' });
  }
  try {
    const result = await updateGmailDraft(accessToken, draftId, { to, subject, body });
    res.json({ success: true, result });
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🧠 Inner Circle Server running at http://localhost:${PORT}`);
});
