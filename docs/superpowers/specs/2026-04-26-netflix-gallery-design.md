# Netflix-Style Gallery Mode

**Date**: 2026-04-26
**Status**: Approved (pending user spec review)

## Summary

Add a second view inside the existing Memory Gallery overlay so the user can switch between the current 3D coverflow ("Album") and a Netflix-style shelf view ("Shelves") where each person is their own row of photos. Photos already exist per-person via `photosByPerson`, so this is a UI-only addition — no data model changes.

## Motivation

The current gallery flattens every photo from every person into one chronological coverflow. That's nostalgic for browsing but bad for finding "all photos with X." Per-person shelves give the user a Netflix-like organized browse mode while preserving the album as the default nostalgic experience.

## Scope

### In scope
- New "Shelves" view inside the existing gallery overlay
- Toggle control (Album | Shelves) in the overlay
- Per-person rows, alphabetical by person name
- Within each row: photos sorted by `uploadedAt` desc
- Click a tile → photo zoom modal (own modal, separate from existing carousel lightbox)
- Inside the zoom modal: outside-click closes; X button deletes the photo
- View-mode preference persisted to `localStorage`

### Out of scope
- Drag-to-reorder photos or rows
- User-customizable sort (by score, by category, by recency)
- Hero/featured rows, hover-preview, or auto-playing tiles
- New photo metadata or tagging
- Bulk actions

## UX

### Toggle
- Segmented control rendered in the gallery overlay, top-left area near the existing close button
- Two options: `Album` (default) and `Shelves`
- Active option styled per existing minimalist tokens (no gradients/glow per UI feedback memory)
- Selection persists to `localStorage` key `gallery-view-mode`

### Album mode
- No change. Existing `MemoryCarousel` 3D coverflow continues as today.

### Shelves mode
- Vertical scroll of horizontal rows
- Each row = one person who has ≥1 photo
- People with zero photos are hidden
- Rows sorted alphabetically by person name (case-insensitive)
- Row header (left): person's name in primary text
- Row header (right): muted photo count, e.g. `7 photos`
- Row body: horizontal-scrolling strip of poster-shaped tiles (~180×240, Cloudinary `fill` thumb with auto gravity), most recent first
- Horizontal scroll via mouse wheel and click-drag
- Click a tile → opens zoom modal

### Zoom modal
- A small, separate modal layered above the gallery overlay
- Shows the single photo at a comfortable size (Cloudinary `fit` ~900×700)
- X button in the corner: **deletes** the photo (calls `onPhotosChange` with that photo removed) and closes the modal
- Click on the dimmed backdrop outside the photo: **closes** the modal without deleting
- Escape key: closes the modal without deleting (matches outside-click semantics)
- No prev/next navigation inside this modal — it's a per-tile zoom, not a slideshow

## Architecture

### Component layout
- Keep `MemoryCarousel.jsx` as-is (it is the Album view body).
- Add `src/components/MemoryGallery/Shelves.jsx` (the Netflix view body).
- Add `src/components/MemoryGallery/PhotoZoomModal.jsx` (the zoom + delete modal).
- Wrap mode-switching inside `MemoryCarousel.jsx`'s overlay container: render the existing carousel track when mode is `album`, otherwise render `<Shelves />`. The toggle and close button live in the overlay chrome and are visible in both modes.

Rationale: the gallery overlay (dark backdrop, close button, fixed positioning) is already implemented in `MemoryCarousel.jsx`. Reusing that shell avoids overlay-nesting and z-index headaches. The carousel render path is a sibling branch under the same overlay.

### Data flow
- `App.jsx` already passes `allPhotos` (flat) into `MemoryCarousel`. Extend the props:
  - `photosByPerson` (already in scope upstream)
  - `people` (the `displayPeople` list, for name lookups and alphabetical sort)
  - `onPhotosChange(personId, nextPhotos)` so the zoom modal can delete a photo and bubble back up to `setPhotosForPerson`
- No new context, no new hook. View mode state is local to `MemoryCarousel` plus a `localStorage` read on mount.

### Sorting
- Build rows with `Object.entries(photosByPerson)`:
  1. Filter entries where the person has ≥1 photo and exists in `people`
  2. Map to `{ person, photos }`
  3. Sort by `person.name.toLowerCase()`
  4. For each row, sort `photos` by `new Date(uploadedAt)` desc

### Persistence
- On mount: read `localStorage.getItem('gallery-view-mode')`, default to `'album'`
- On toggle: write the new value

## Styling

- Match the existing dark, minimalist aesthetic (no gradients, no glow — per UI style memory)
- Toggle: shadcn-style segmented control, subtle border, active background uses a low-contrast surface token
- Row tiles: thin border, subtle hover lift via thickness change (not opacity, per UI style memory)
- Use existing CSS tokens from `src/App.css` (e.g. `--bg-deep`, `--border-default`, `--text-primary`, `--text-muted`, `--accent`)

## Error handling
- If `photosByPerson` is empty, Shelves shows the same empty-state copy as the current carousel ("Your Memory Gallery — Open a person's card and upload photos to see them here.")
- If a person referenced in `photosByPerson` no longer exists in `people`, skip that row (do not render it)
- If Cloudinary is not configured (`cld == null`), tiles fall back to `<img src={photo.secure_url} />`

## Testing plan
- Manual: open gallery, toggle to Shelves, verify rows render alphabetically with correct counts
- Manual: click a tile, verify zoom modal opens
- Manual: in zoom modal, click backdrop → modal closes, photo still present
- Manual: in zoom modal, press Escape → modal closes, photo still present
- Manual: in zoom modal, click X → modal closes AND photo is removed from that person's row and from disk via existing `onPhotosChange` path
- Manual: refresh page with mode=Shelves → opens gallery in Shelves mode
- Manual: empty state when no photos exist anywhere

## Files touched
- `src/App.jsx` — pass `photosByPerson`, `people`, and `onPhotosChange` into `MemoryCarousel`
- `src/components/MemoryCarousel/MemoryCarousel.jsx` — add view-mode toggle and conditional render
- `src/components/MemoryCarousel/MemoryCarousel.css` — toggle styles
- `src/components/MemoryGallery/Shelves.jsx` *(new)*
- `src/components/MemoryGallery/Shelves.css` *(new)*
- `src/components/MemoryGallery/PhotoZoomModal.jsx` *(new)*
- `src/components/MemoryGallery/PhotoZoomModal.css` *(new)*
