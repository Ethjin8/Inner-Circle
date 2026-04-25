# Person Card Modal — Design Spec

## Overview

A centered overlay modal that appears when clicking a graph node, displaying detailed information about a person. The modal blurs the background graph so the user can focus on the card content. Empty/null fields are hidden entirely to keep the card clean and adaptive to how much is known about each person.

## Trigger & Dismissal

- **Single click** on a graph node opens the modal for that person
- **Double click** remains unchanged (attaches node to prompt as context)
- Single click requires distinguishing from double click — use a short delay (~250ms) before firing the single-click handler; cancel it if a second click arrives
- **Close via:** X button (top-right corner), clicking the blurred backdrop, or pressing Escape
- Opening a new node while a modal is open replaces the current modal content

## Backdrop

- Fixed overlay covering the full viewport
- `background: rgba(5, 5, 16, 0.6)` with `backdrop-filter: blur(12px)`
- z-index above the graph and sidebar/prompt UI (z-index: 50)
- Clicking the backdrop closes the modal

## Modal Panel

- Centered vertically and horizontally in the viewport
- `max-width: 440px`, `width: calc(100% - 48px)` for mobile
- `max-height: 80vh` with `overflow-y: auto` for long content
- Background: `rgba(10, 10, 30, 0.95)` with `border: 1px solid var(--border-bright)`
- Border radius: `var(--radius-lg)` (16px)
- Padding: 32px
- No glow, no gradients on the modal chrome
- X close button: top-right corner, subtle ghost style

## Content Layout

### 1. Header

- **Profile image placeholder:** 80px circle, centered, `rgba(255, 255, 255, 0.06)` fill with a user icon silhouette
  - Future: Cloudinary-hosted images will replace the placeholder
- **Circular progress ring** around the profile image:
  - SVG circle with stroke-dasharray proportional to `strength` (0-100)
  - Ring color uses existing edge thresholds: green `#34d399` (strength >= 65), yellow `#facc32` (40-64), red `#f05050` (< 40)
  - Unfilled track: `rgba(255, 255, 255, 0.08)`
  - Ring stroke width: 3px, radius slightly larger than the image (44px)
- **Name:** Space Grotesk 600, 22px, `var(--text-primary)`, centered below the image
- **Category badge:** Small pill below the name — category color dot (6px) + label text, `rgba(255,255,255,0.06)` background, rounded
- **Birthday:** If present, formatted as "May 14, 1998", `var(--text-secondary)`, 13px, below the badge

### 2. Context Section

Shown only if at least one context field is non-null and non-empty.

- **Section label:** "Context", 11px uppercase, `var(--text-muted)`, letter-spacing 0.8px
- **Fields** (each shown only if non-null/non-empty):
  - `how_we_met` — label "How we met", value as body text
  - `school` — label "School", value as body text
  - `work` — label "Work", value as body text
  - `hobbies` — label "Hobbies", values as inline pills
  - `sports` — label "Sports", values as inline pills
  - `favorites.foods` — label "Favorite foods", values as inline pills
  - `favorites.music` — label "Favorite music", values as inline pills
- **Inline pills:** `rgba(255, 255, 255, 0.06)` background, `var(--radius-sm)` rounded, 12px text, `var(--text-secondary)`
- **Label style:** 11px, `var(--text-muted)`, margin-bottom 4px
- **Value style:** 13px, `var(--text-primary)` for text values

### 3. Memories Section

Shown only if `memories_together` or `important_events` has at least one entry.

- **Section label:** "Memories"
- **memories_together:** Each memory as a list item with a subtle bullet or dash prefix
- **important_events:** Each event as a list item, same style
- Sub-labels ("Together", "Important events") shown in `var(--text-muted)` 11px if both sub-arrays are present
- List item style: 13px, `var(--text-primary)`, 6px vertical gap between items

### 4. Looking Forward Section

Shown only if `things_to_look_forward_to` has at least one entry.

- **Section label:** "Looking Forward"
- Each item as a list item, same style as memories

### Section Separators

- 1px `var(--border)` horizontal line between sections (header, context, memories, looking forward)
- 20px vertical spacing between sections

## Demo Data Updates

Expand `DEMO_PEOPLE` to use the full JSON structure. Rich data for 3 people to demonstrate full cards, sparse data for the rest to demonstrate hide-empty behavior:

**Mom (rich):**
```json
{
  "id": "1",
  "name": "Mom",
  "initials": "MO",
  "birthday": "1972-03-18",
  "relationship": { "type": "family", "strength": 92 },
  "context": {
    "how_we_met": null,
    "school": null,
    "work": "Retired teacher",
    "hobbies": ["gardening", "cooking", "reading"],
    "sports": [],
    "favorites": {
      "foods": ["pasta", "chocolate cake"],
      "music": ["classical", "oldies"]
    }
  },
  "history": {
    "memories_together": ["Family road trip to Grand Canyon 2019", "Teaching me to cook her pasta recipe", "Movie nights every Sunday"],
    "important_events": ["Parents' 30th anniversary in June"],
    "things_to_look_forward_to": ["Planning a family reunion this summer"]
  }
}
```

**Jake (rich):**
```json
{
  "id": "2",
  "name": "Jake",
  "initials": "JK",
  "birthday": "2003-11-02",
  "relationship": { "type": "friend", "strength": 78 },
  "context": {
    "how_we_met": "Freshman orientation at UCLA",
    "school": "UCLA",
    "work": null,
    "hobbies": ["gaming", "skateboarding"],
    "sports": ["basketball"],
    "favorites": {
      "foods": ["ramen", "burritos"],
      "music": ["hip-hop", "electronic"]
    }
  },
  "history": {
    "memories_together": ["Late-night study sessions for CS 31", "Beach day at Santa Monica"],
    "important_events": ["His birthday party in November"],
    "things_to_look_forward_to": ["LA Hacks 2026 together"]
  }
}
```

**Lily (rich):**
```json
{
  "id": "9",
  "name": "Lily",
  "initials": "LI",
  "birthday": "2004-08-21",
  "relationship": { "type": "romantic", "strength": 88 },
  "context": {
    "how_we_met": "Met at a coffee shop near campus",
    "school": "UCLA",
    "work": "Part-time at the campus bookstore",
    "hobbies": ["painting", "yoga", "film photography"],
    "sports": [],
    "favorites": {
      "foods": ["sushi", "matcha"],
      "music": ["indie rock", "R&B"]
    }
  },
  "history": {
    "memories_together": ["First date at Griffith Observatory", "Painting together at her apartment", "Surprise birthday picnic"],
    "important_events": ["One year anniversary in September"],
    "things_to_look_forward_to": ["Trip to San Francisco next month", "Meeting her parents"]
  }
}
```

**All other people:** Keep minimal data — just `name`, `initials`, `relationship` (type + strength), and maybe one or two context fields to show sparse cards.

## Click Handling

Since single click opens the modal and double click attaches to prompt, use a click delay pattern:
- On click, set a 250ms timer
- On second click within 250ms, cancel the timer and fire double-click (attach to prompt)
- If timer expires without a second click, fire single-click (open modal)
- This replaces the current raw `dblclick` event listener approach

## New Files

- `src/components/PersonModal/PersonModal.jsx` — modal component
- `src/components/PersonModal/PersonModal.css` — modal styles

## Interaction with Existing Components

- `App.jsx` — holds `selectedPerson` state, renders `PersonModal` when non-null
- `ConstellationGraph.jsx` — emits `onNodeClick` (new) in addition to existing `onNodeDoubleClick`, handles click/double-click disambiguation internally
- Sidebar, prompt area, header — all remain visible but behind the backdrop blur
