# Inner Circle

An immersive, visual personal relationship manager designed to help you organize and cherish the connections that matter most.

## Overview

Inner Circle is a deterministic, hierarchical radial graph that lets you map out your entire social network (family, friends, mentors, etc.). With a focus on **visual excellence** and **interaction design**, you are placed at the center of your own constellation. The application goes beyond standard lists, utilizing camera-based zoom systems, particle effects, and 3D rendering to create an engaging experience.

## Key Features

- **Interactive Constellation Graph** — A fluid, beautifully styled constellation layout. Nodes organically "breathe" with subtle physics and emit glowing particles. Each category in your life receives a dedicated branch from the center "You" node.
- **Cinematic Zoom System** — Clicking a category or person invokes a camera-based pan-and-zoom, moving the focus point smoothly without scrambling the existing layout.
- **Explorer Sidebar** — A VS Code-style collapsible hierarchy tree. Easily scan your network by groups, view relationship strength scores, and click to immediately navigate across the galaxy to a specific person.
- **Node Manipulation & "Snip"** — Full drag-and-drop support for categories and individual people. Use the **Snip Tool ✂️** to cut connections from your graph and watch them gracefully dissolve into physics particles (fully undo-able).
- **Cloudinary Media Manager** — Integrated seamlessly with the official `@cloudinary/react` SDK. Users can open a person's card and drag-and-drop multiple memories into their profile.
- **3D Memory Carousel 📸** — Click the camera icon in the toolbar to fade the graph away and enter the Memory Gallery. It aggregates all photos across your network into an Apple-style, 3D hardware-accelerated Coverflow carousel. Supports precision trackpad scrolling, mouse momentum, and auto-play idle loops.

## Tech Stack

- **Frontend Core:** React + Vite
- **Styling & Physics:** Vanilla CSS + custom `requestAnimationFrame` loops (No Tailwind, no bulky physics engines)
- **Media Hosting & Transformation:** Cloudinary (`@cloudinary/react`, `@cloudinary/url-gen`)
- **Backend/State:** Currently frontend-state driven (Firebase / LocalStorage extensions planned)
- **AI (WIP):** Gemini 2.0 integration planned for voice-based onboarding and graph-population parsing.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Environment Variables:**
   Copy the example `.env` file to set up your keys.
   ```bash
   cp .env.example .env
   ```
   Provide your Cloudinary tracking details:
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```

## Project Structure

```text
src/
  components/
    Graph/              # Core constellation canvas and rendering logic
    PersonModal/        # Profile cards with tabs and info presentation
    CloudinaryUpload/   # SDK-integrated upload widgets and lightboxes
    MemoryCarousel/     # 3D cinematic physics-based photo gallery
  App.jsx               # Hub for application state, sidebar logic, and toolbars
  App.css               # Global theming, glassmorphism, and transitions
```

## Built For

**LA Hacks 2026**

## Team

Nathan So, Eric Le, Alex Xiao, Ethan Jin
