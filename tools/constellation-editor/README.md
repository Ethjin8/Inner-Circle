# Constellation Editor

Standalone tool. Open `index.html` in a browser.

```
open tools/constellation-editor/index.html
```

## Controls
- click empty space → add star
- click star → select
- click second star → add edge (chains: stays selected for next edge)
- esc → deselect
- z → undo
- ⌫/del → delete selected star
- snap-to-grid checkbox for 20px grid

Drafts auto-save to `localStorage`.

## Output

Export emits one constellation in the shape used by
`src/components/Landing/constellations.js`:

```js
{
  name, pos: { cx, cy }, scale, stars: [[ux, uy], ...], edges: [[i, j], ...]
}
```

Coords are normalized: stars in unit box `[0..1]`, `pos` as fraction of viewport,
`scale` as fraction of `min(w, h)`. Drops straight into the `CONSTELLATIONS` array.
