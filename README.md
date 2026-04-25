# Inner Circle

An AI-powered personal relationship manager that helps you nurture the connections that matter most.

## What It Does

You are the center of an interactive graph network. Each person in your life is a node, connected to you by edges that reflect the strength of your relationship. An AI therapist learns about your relationships through natural voice conversations, tracks relationship health over time, and nudges you when a connection needs attention.

## Key Features

- **Voice-First Onboarding** — Talk to an AI therapist to add people to your graph. No forms, no typing. It asks about your relationships and extracts the details naturally.
- **Interactive Relationship Graph** — Force-directed graph with you at the center. Edge thickness = relationship strength. Node color = urgency (green/yellow/red). Filter by category (work, school, family) to focus on one area of your life.
- **Smart Nudges** — The app knows when you should reach out. Birthday reminders, fading relationship alerts, and context-aware suggestions ("Finals coming up — study session with Jake?").
- **Context-Aware AI Chat** — Drag nodes into the chat to give the AI context about specific people. Ask it to plan a group hangout, draft a message, or suggest a gift — it knows your relationship history.
- **Message Drafting** — AI drafts personalized messages matching the right tone for each relationship. Review, edit, copy-paste.

## Tech Stack

- **Frontend:** React, force-directed graph visualization, Cloudinary (profile photos)
- **Backend:** Firebase (Firestore, Cloud Functions, Hosting)
- **AI:** ElevenLabs (voice conversation), Claude API (relationship analysis, recommendations, chat)

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your API keys: ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, CLOUDINARY_URL, Firebase config

# Start development server
npm run dev
```

## Project Structure

```
src/
  components/
    Graph/          # Force-directed relationship graph
    Chat/           # AI chat interface
    NodeCard/       # Person info card overlay
    Onboarding/     # Voice-first onboarding flow
  services/
    ai.js           # Claude API integration
    elevenlabs.js   # ElevenLabs voice integration
    firebase.js     # Firestore data layer
    nudges.js       # Recommendation engine
  utils/
    scoring.js      # Relationship strength calculation
```

## Built For

LA Hacks 2026

## Team

Nathan So, Eric Le, Alex Xiao, Ethan Jin
