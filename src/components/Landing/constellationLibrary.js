// Loaded constellation shapes from the editor tool. Sorted by star count.
const modules = import.meta.glob(
  '../../../tools/constellation-editor/constellations/*.json',
  { eager: true, import: 'default' },
);

const prettyName = (raw) => raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const LIBRARY = Object.values(modules)
  .map((c) => ({
    name: prettyName(c.name || 'unnamed'),
    starCount: c.stars.length,
    stars: c.stars,
    edges: c.edges,
  }))
  .sort((a, b) => a.starCount - b.starCount);
