# Relationship Copilot — Design Spec

**Project:** LA Hacks 2026
**Date:** 2026-04-24

---

## Overview

A personal relationship management app built around an interactive graph network. You are the central node, surrounded by the people in your life. An AI therapist learns about each relationship through natural conversation, computes relationship strength, and proactively nudges you to maintain and deepen your connections. The graph is the home screen — visual, interactive, and always up to date.

---

## Core Concepts

### The Relationship Graph

- **You** are the central node.
- Each person you add becomes a node connected to you by an edge.
- **Edge thickness** represents relationship strength (0–100 score).
- **Node color** represents urgency: green (healthy), yellow (needs attention), red (at risk of fading).
- **Exclamation badge** appears on nodes flagged by the recommendation engine (birthday coming up, haven't talked in a while, etc.).
- The graph uses a force-directed layout — close relationships cluster near you, weaker ones drift outward.

### Person Data Model

Each person node stores:

**User-provided (extracted from conversation):**
- Name
- Birthday
- How you met / how long you've known them
- Relationship category: friend, family, classmate, coworker, professional contact, romantic partner, mentor, etc.
- Favorite memories together
- Shared interests and hobbies
- What the user values about them
- Any tensions or areas for improvement
- Communication frequency (how often they actually talk)

**AI-computed:**
- **Relationship strength score (0–100):** derived from emotional depth signals in conversation, communication frequency, recency of last interaction
- **Urgency level (green/yellow/red):** based on time decay since last interaction, upcoming events (birthdays), and strength score trajectory
- **Relationship type tags:** e.g., "mentor," "close friend," "want to reconnect," "professional network"

---

## Feature Breakdown

### 1. Conversational Onboarding (Voice-First)

The AI therapist guides you through adding each person via voice conversation powered by ElevenLabs.

**Phase 1 — Quick capture (~30 seconds per person):**
- "Who's someone important in your life?"
- Name → birthday → how do you know them?
- Node appears on graph immediately with basic data.

**Phase 2 — Deepening (~2–3 minutes per person):**
- AI transitions naturally: "Tell me more about your relationship with Jake."
- "What's a favorite memory you two share?"
- "How often do you guys hang out?"
- "Is there anything you wish was different about the friendship?"
- AI extracts structured data from natural language — no forms.

**Phase 3 — Ongoing check-ins (periodic):**
- "You mentioned things were tense with your roommate last month — how's that going?"
- Refresher conversations keep the graph accurate and strength scores fresh.
- Triggered when the app detects a relationship hasn't been discussed in a while.

**Key design choice:** You don't onboard everyone at once. Start with 3–5 people, then the AI suggests additions organically: "You mentioned Jake's friend Marcus — want to add him too?"

### 2. Graph UI & Interaction

The graph is the home screen.

**Filtering & grouping:**
- Category filters (work, school, family, etc.) highlight matching nodes and fade the rest.
- Lets you focus on one area of your life at a time.

**Node interactions:**
- **Tap a node** → a card slides up showing: name, birthday, relationship strength bar, last interaction date, AI-generated summary ("Close friend from freshman year, shares your interest in hiking, you mentioned wanting to hang out more").
- **Exclamation badge** → tapping shows the specific AI recommendation.
- **Drag nodes into AI chat** → loads their relationship data as context for the prompt.

**Context-aware AI prompting:**
- Select one or more nodes and bring them into the chat.
- The AI has all relationship context for those people loaded.
- Examples:
  - Select mom + brother → "Plan a family dinner idea based on what you know about them"
  - Select a professional contact → "Draft a message to ask about internship opportunities"
  - Select a friend group → "Suggest a group hangout this weekend"

### 3. Smart Nudges & Notifications

**Time-based:**
- "You haven't talked to Sarah in 3 weeks — your relationship strength is dropping."
- "Mom's birthday is in 4 days. Want to plan something?"
- Frequency thresholds are personalized per relationship type (weekly for close friends, monthly for professional contacts).

**Context-aware:**
- "Finals are coming up — Jake is in your CS class, maybe set up a study session?"
- "You mentioned wanting to reconnect with Marcus. It's been a quiet week — good time to reach out?"

**Refresher prompts:**
- "It's been a while since we talked about your relationship with your roommate. Quick check-in?"
- Feeds back into Phase 3 of the onboarding conversation.

**Rate limiting:**
- 1–3 nudges per day max.
- Prioritized by: strength score decay rate, upcoming events, number of nudges already sent today.

### 4. Message Drafting

When the AI recommends reaching out, it drafts a message tailored to the relationship context. The user reviews, edits, and copy-pastes it themselves.

**Tone matching:**
- Close friend → casual
- Professional contact → polished
- Family → warm

**Examples:**
- Casual: "Hey Marcus! It's been a minute. You still playing pickup basketball on Thursdays?"
- Professional: "Hi Kevin, hope the new role at Google is going well! I'm looking at summer internships and would love to hear about your experience."
- Birthday: "Happy birthday Sarah!! Hope you have an amazing day. We need to get dinner soon and catch up."

### 5. Social Planning

When nodes are dragged into the AI chat, the AI can plan social activities using its knowledge of each person's interests, your shared history, and relationship dynamics.

- Group hangout suggestions based on mutual interests
- Date/activity ideas tailored to what the AI knows
- Conflict-aware: won't suggest putting people together if tensions were mentioned

---

## Tech Stack

### Frontend
- **React** with a component-based architecture
- **Force-directed graph library** (e.g., react-force-graph, D3-force, or vis-network) for the interactive relationship graph
- **Cloudinary React SDK** for contact profile photos — upload, storage, and optimized delivery (sponsor track integration)
- Responsive design — works on desktop for demo, mobile-friendly as a stretch goal

### Backend
- **Firebase:**
  - **Firestore** for storing user profiles, person nodes, relationship data, conversation history
  - **Cloud Functions** for proxying AI API calls and running the recommendation/nudge engine
  - **Firebase Hosting** for deploying the frontend
- No auth for the hackathon — single-user mode, data stored under a default user document

### AI Layer
- **ElevenLabs Conversational AI** for the voice onboarding experience. ElevenLabs acts as the conversation host — it handles mic input, speech-to-text, text-to-speech, and voice output. It calls Claude as the backend LLM to generate responses and extract data.
- **Claude API (Anthropic)** is the brain behind all AI features:
  - Conversation engine (conducting therapist-style interviews, called by ElevenLabs during voice sessions)
  - Data extraction (pulling structured relationship data from natural conversation via tool use / structured output)
  - Strength scoring (computing relationship scores from conversation signals)
  - Recommendation engine (generating nudges, social plans, draft messages)
  - Context-aware chat (when nodes are dragged in, their data is injected as system context)
- Single LLM with different system prompts per responsibility — no need for separate models
- Text chat mode also available as a fallback (typed input → Claude → text response), bypassing ElevenLabs

### Data Flow (Voice Onboarding)

```
User speaks → ElevenLabs handles STT → sends transcript to Claude (as backend LLM)
→ Claude generates therapist response + structured data extraction (via tool use)
→ Structured data written to Firestore (person node updated)
→ Frontend re-renders graph (edge thickness, node color update in real-time)
→ Claude's text response sent back through ElevenLabs TTS → spoken to user
```

### Data Flow (Text Chat)

```
User types message (optionally with nodes dragged in as context)
→ Node relationship data injected into Claude system prompt
→ Claude generates response (recommendation, draft message, social plan, etc.)
→ Response displayed in chat UI
→ Any data updates written to Firestore
```

### Nudge/Recommendation Flow

```
Cloud Function runs on schedule (or on Firestore trigger)
→ Reads all person nodes for the user
→ Computes time decay on strength scores
→ Checks for upcoming events (birthdays within 7 days)
→ Generates prioritized nudge list via Claude
→ Writes top 1–3 nudges to Firestore
→ Frontend displays exclamation badges on flagged nodes
```

---

## Scope for Hackathon

### Must-have (demo-ready):
- Interactive force-directed graph with you at center
- Voice-first onboarding: add 3–5 people via AI conversation
- Relationship strength scores displayed as edge thickness
- Urgency coloring (green/yellow/red) on nodes
- Tap node → info card with AI summary
- Category filtering (highlight/fade)
- Drag nodes into AI chat for context-aware prompting
- Draft message generation (copy-paste)
- At least one working nudge demo (birthday or decay-based)

### Nice-to-have (if time permits):
- Exclamation badge animations
- Profile photos via Cloudinary
- Periodic check-in conversation flow
- Social planning suggestions
- Mobile-responsive layout

### Out of scope:
- Multi-user / social features
- Auto-sending messages (SMS/iMessage integration)
- Authentication
- Wearable integration
