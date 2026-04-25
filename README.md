# Inner Circle

An AI-powered personal relationship manager wrapped in a cinematic constellation interface. Map the people who matter, score the strength of each connection through a rigorous AI pipeline, and explore your network as a living galaxy with you at the center.

## Overview

Inner Circle treats your social world as a deterministic, hierarchical radial graph. Every person becomes a node attached by category to a central "You," with edge thickness encoding relationship strength. New connections enter through a conversational AI agent (or manual entry if you prefer), get persisted to Firebase, and are scored offline by a separate AI grading pipeline before landing on-screen.

The result is part PRM, part visual playground: rigorous on the data side, expressive on the interaction side.

## AI Workflow

1. **Intake — voice or manual.** The user can either speak with a Gemini Live conversational agent or fill out a manual form. The agent walks a smooth, progressive flow:
   - Name and category (friend, professor, family, coworker, etc.)
   - Optional birthday and category-specific facts (hobbies, school, sports, favorite things)
   - Shared history — important events, favorite memories, and things to look forward to
   - The agent knows when to cut off. Thin signal ("met this prof once at a research meeting") closes the conversation early instead of forcing depth.
2. **Persist.** Conversation output is normalized into structured JSON and stored in Firebase as the source of truth.
3. **Score.** A separate Claude grading agent (Opus 4.6 with extended thinking) runs the **Anchored Rubric Pipeline**:
   - Five scoring dimensions: *depth of knowledge*, *emotional intimacy*, *recency / frequency*, *shared history density*, *reciprocity*
   - Each dimension is graded against few-shot anchor exemplars (a "2" looks like X, a "7" looks like Y) so the scale stays consistent across people
   - Self-consistency: the score runs three times and the median is taken; high variance flags the node as "uncertain" in the UI
   - Final 0–10 strength score plus per-dimension justifications
4. **Place.** The pipeline auto-attaches the node to its inferred category branch (or *Miscellaneous* if none was provided), positions it on the constellation, and renders the edge thickness from the score.
5. **Edit.** Every card is fully editable — override the score, revise hobbies, add memories. Edits trigger a rescore on demand.

## Visual & Interaction Features

- **Interactive Constellation Graph** — A fluid, beautifully styled radial layout. Nodes "breathe" with subtle physics and emit glowing particles. Each life category gets a dedicated branch from the center "You" node.
- **Cinematic Zoom System** — Clicking a category or person triggers a camera-based pan-and-zoom that moves the focus point smoothly without scrambling the existing layout.
- **Explorer Sidebar** — A VS Code-style collapsible hierarchy tree. Scan your network by category, view relationship strength scores, and click to jump across the galaxy to a specific person.
- **Node Manipulation & Snip Tool ✂️** — Drag-and-drop categories and people freely. Use the Snip Tool to cut connections and watch them dissolve into physics particles (fully undoable).
- **Cloudinary Media Manager** — Integrated with the official `@cloudinary/react` SDK. Open a card and drag-and-drop multiple memories into a person's profile.
- **3D Memory Carousel 📸** — The camera icon fades the graph and opens the Memory Gallery: every photo across your network in an Apple-style 3D Coverflow carousel with trackpad precision, mouse momentum, and idle auto-play.

## Tech Stack

- **Frontend:** React + Vite, vanilla CSS with custom `requestAnimationFrame` loops (no Tailwind, no heavyweight physics engine)
- **Backend / Persistence:** Firebase (Firestore for relationship data; Cloud Functions for the scoring pipeline)
- **Conversational AI:** Gemini Live API — real-time speech-to-speech onboarding agent
- **Scoring AI:** Claude Opus 4.6 with extended thinking — anchored rubric pipeline with self-consistency
- **Media:** Cloudinary (`@cloudinary/react`, `@cloudinary/url-gen`)

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Fill in:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_key
   VITE_ANTHROPIC_API_KEY=your_anthropic_key
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
   VITE_FIREBASE_CONFIG=your_firebase_config_json
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

## Project Structure

```text
src/
  components/
    Graph/              # Constellation canvas and rendering logic
    PersonModal/        # Profile cards with editable fields
    CloudinaryUpload/   # SDK-integrated upload widgets and lightboxes
    MemoryCarousel/     # 3D cinematic photo gallery
    Onboarding/         # Voice + manual intake flows
  services/
    gemini.js           # Gemini Live voice client (intake)
    claude.js           # Claude Opus 4.6 client (scoring)
    firebase.js         # Firestore data layer
    scoring.js          # Anchored rubric pipeline + self-consistency
  App.jsx               # Application state, sidebar, toolbars
  App.css               # Global theming and transitions
```

## Built For

**LA Hacks 2026**

## Team

Nathan So, Eric Le, Alex Xiao, Ethan Jin
