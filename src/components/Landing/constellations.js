// Constellations traced from reference images. Stars in unit space [0..1].
// pos.{cx,cy} is the constellation center as a fraction of viewport (w, h).
// scale is the size of the unit box as a fraction of min(w, h).
export const CONSTELLATIONS = [
  {
    // Tall left-side shape: top quadrilateral + zig-zag chain trailing down.
    name: 'left-tower',
    pos: { cx: 0.18, cy: 0.42 },
    scale: 0.36,
    stars: [
      [0.30, 0.00],
      [0.62, 0.03],
      [0.18, 0.18],
      [0.55, 0.22],
      [0.45, 0.36],
      [0.32, 0.50],
      [0.42, 0.68],
      [0.30, 0.86],
      [0.30, 1.00],
    ],
    edges: [
      [0, 1], [1, 3], [3, 2], [2, 0],
      [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
    ],
  },
  {
    // Aries: 4 stars trending down-right, sharper drop at the tail.
    name: 'aries',
    pos: { cx: 0.42, cy: 0.32 },
    scale: 0.22,
    stars: [
      [0.05, 0.18],
      [0.42, 0.36],
      [0.78, 0.48],
      [0.94, 0.95],
    ],
    edges: [[0, 1], [1, 2], [2, 3]],
  },
  {
    // Big Dipper: 7 stars, bowl opening upward, handle curving up-left.
    name: 'big-dipper',
    pos: { cx: 0.68, cy: 0.40 },
    scale: 0.30,
    stars: [
      [0.99, 0.3],
      [0.92, 0.6],
      [0.64, 0.6],
      [0.58, 0.34],
      [0.38, 0.22],
      [0.20, 0.10],
      [0.02, 0.02],
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [3, 4], [4, 5], [5, 6],
    ],
  },
  {
    // Libra: kite/diamond of 4 stars.
    name: 'libra',
    pos: { cx: 0.88, cy: 0.32 },
    scale: 0.18,
    stars: [
      [0.50, 0.05],
      [0.08, 0.45],
      [0.95, 0.50],
      [0.55, 0.98],
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 3]],
  },
];
