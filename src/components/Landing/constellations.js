// Constellations traced from reference image. Stars in unit space [0..1].
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
    // Mid-sky arrow / Y-shape.
    name: 'mid-arrow',
    pos: { cx: 0.45, cy: 0.28 },
    scale: 0.22,
    stars: [
      [0.65, 0.00],
      [0.00, 0.45],
      [0.30, 0.50],
      [0.62, 0.55],
      [0.78, 1.00],
    ],
    edges: [[1, 2], [2, 3], [3, 0], [3, 4]],
  },
  {
    // Smaller right-mid Y / branched shape.
    name: 'small-y',
    pos: { cx: 0.70, cy: 0.40 },
    scale: 0.13,
    stars: [
      [0.45, 0.00],
      [0.55, 0.38],
      [0.55, 0.65],
      [0.10, 0.95],
      [1.00, 0.90],
    ],
    edges: [[0, 1], [1, 2], [2, 3], [2, 4]],
  },
  {
    // Right-side cluster: closed top + extensions.
    name: 'right-cluster',
    pos: { cx: 0.88, cy: 0.30 },
    scale: 0.18,
    stars: [
      [0.40, 0.00],
      [0.78, 0.05],
      [0.50, 0.30],
      [0.92, 0.32],
      [0.05, 0.55],
      [0.65, 0.62],
    ],
    edges: [
      [0, 1], [1, 3], [3, 2], [2, 0],
      [2, 4], [3, 5],
    ],
  },
];
