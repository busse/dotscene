import { defineFigure, defineScene, isometric, type Vec2, type Vec3 } from 'dotscene'

/**
 * A nine-by-nine city block, drawn in the view every isometric city builder uses.
 *
 * Everything here is authored in grid coordinates — tiles across, tiles down, storeys up —
 * and projected once, when the figure is written. dotscene itself stays two-dimensional;
 * `isometric` is an authoring transform, not a renderer mode. That is the whole trick, and
 * it means depth costs nothing at runtime.
 */
const grid = isometric({ tile: 8, squash: 0.5, rise: 5 })

interface Shape {
  readonly points: Readonly<Record<string, Vec2>>
  readonly edges: readonly (readonly [string, string])[]
}

/**
 * A rectangular building, from one grid corner to another, `height` storeys tall.
 *
 * The far corner and the three edges meeting it are left out. In this view that corner is
 * always the one with the smallest x + y — the highest on screen — so dropping it turns a
 * transparent wireframe into a solid-looking box showing its three visible faces.
 */
const box = (prefix: string, from: Vec2, to: Vec2, height: number): Shape => {
  const [x0, y0] = from
  const [x1, y1] = to
  const at = (cell: Vec3) => grid(cell)
  return {
    points: {
      [`${prefix}Near`]: at([x1, y1, 0]),
      [`${prefix}East`]: at([x1, y0, 0]),
      [`${prefix}West`]: at([x0, y1, 0]),
      [`${prefix}TopFar`]: at([x0, y0, height]),
      [`${prefix}TopEast`]: at([x1, y0, height]),
      [`${prefix}TopNear`]: at([x1, y1, height]),
      [`${prefix}TopWest`]: at([x0, y1, height]),
    },
    edges: [
      [`${prefix}East`, `${prefix}Near`],
      [`${prefix}Near`, `${prefix}West`],
      [`${prefix}East`, `${prefix}TopEast`],
      [`${prefix}Near`, `${prefix}TopNear`],
      [`${prefix}West`, `${prefix}TopWest`],
      [`${prefix}TopFar`, `${prefix}TopEast`],
      [`${prefix}TopEast`, `${prefix}TopNear`],
      [`${prefix}TopNear`, `${prefix}TopWest`],
      [`${prefix}TopWest`, `${prefix}TopFar`],
    ],
  }
}

/** A tree: a trunk, and a canopy of four points splayed around its top. */
const tree = (prefix: string, [x, y]: Vec2, height = 1.7, spread = 1.15): Shape => {
  const canopy: Vec3[] = [
    [x + spread, y, height + 1.1],
    [x, y + spread, height + 1.1],
    [x - spread, y, height + 1.1],
    [x, y - spread, height + 1.1],
  ]
  const points: Record<string, Vec2> = {
    [`${prefix}Foot`]: grid([x, y, 0]),
    [`${prefix}Top`]: grid([x, y, height]),
  }
  canopy.forEach((cell, i) => {
    points[`${prefix}C${i}`] = grid(cell)
  })
  return {
    points,
    edges: [
      [`${prefix}Foot`, `${prefix}Top`],
      ...canopy.map((_unused, i) => [`${prefix}Top`, `${prefix}C${i}`] as const),
      ...canopy.map((_unused, i) => [`${prefix}C${i}`, `${prefix}C${(i + 1) % 4}`] as const),
    ],
  }
}

/** A straight run on the ground, corner to corner in grid coordinates. */
const line = (name: string, from: Vec2, to: Vec2): Shape => ({
  points: { [`${name}A`]: grid([from[0], from[1], 0]), [`${name}B`]: grid([to[0], to[1], 0]) },
  edges: [[`${name}A`, `${name}B`]],
})

const merge = (...shapes: readonly Shape[]): Shape => ({
  points: Object.assign({}, ...shapes.map((s) => s.points)),
  edges: shapes.flatMap((s) => s.edges),
})

// The block: a road cross splitting nine by nine into four four-by-four lots, three
// buildings of different heights, and a park in the fourth.
const plate = merge(
  line('plateN', [0, 0], [9, 0]),
  line('plateE', [9, 0], [9, 9]),
  line('plateS', [9, 9], [0, 9]),
  line('plateW', [0, 9], [0, 0]),
)

// Lot lines, so the block reads as nine tiles square rather than as an anonymous diamond.
// Only the endpoints become dots — a line's interior crossings draw nothing — so twelve
// lines cost twenty-four dots around the rim rather than a hundred in the middle.
const lots = merge(
  ...[1, 2, 3, 6, 7, 8].flatMap((i) => [
    line(`lotN${i}`, [i, 0], [i, 9]),
    line(`lotE${i}`, [0, i], [9, i]),
  ]),
)

const roads = merge(
  line('roadNS1', [4, 0], [4, 9]),
  line('roadNS2', [5, 0], [5, 9]),
  line('roadEW1', [0, 4], [9, 4]),
  line('roadEW2', [0, 5], [9, 5]),
)

const buildings = merge(
  box('tower', [1, 1], [3, 3], 6),
  box('office', [6, 1], [8, 3], 3),
  box('works', [1, 6], [3, 8], 4),
)

// Spread across the lot rather than clustered: a canopy is nearly two tiles wide, so trees
// any closer than that merge into one thicket.
const park = merge(
  tree('treeA', [6.6, 6.6], 1.5, 0.8),
  tree('treeB', [8.2, 7.4], 1.2, 0.7),
  tree('treeC', [6.9, 8.4], 1.8, 0.85),
)

export const block = defineFigure('block', {
  title: 'Nine tiles square',
  points: { ...plate.points, ...lots.points, ...roads.points, ...buildings.points, ...park.points },
  edges: [
    ...plate.edges.map(([from, to]) => ({ from, to, kind: 'ground' })),
    ...lots.edges.map(([from, to]) => ({ from, to, kind: 'lot' })),
    ...roads.edges.map(([from, to]) => ({ from, to, kind: 'road' })),
    ...buildings.edges,
    ...park.edges,
  ],
})

export const scene = defineScene('city', {
  title: 'A city block, nine tiles square',
  parts: [{ figure: block }],
  padding: 8,
  // The tree edges are far shorter than the buildings', so the median-edge default sizes
  // dots for the buildings and swallows the park. Set it against the smaller detail.
  dotRadius: 1.3,
  lineWidth: 0.6,
  // Depth in a wireframe has to come from weight, since nothing can be hidden behind
  // anything: the ground recedes, the roads come forward, and the lot grid is faint enough
  // to read as texture. Lot dots are matched to their lines by name — every lot point is
  // called `lot…`, and only line endpoints become dots, so this reaches all of them.
  css: [
    '.ds-line--lot{stroke-opacity:.28}',
    '.ds-line--ground{stroke-opacity:.55}',
    '.ds-line--road{stroke-width:1.15;stroke-opacity:.9}',
    'circle[data-p^="lot"]{r:.55;fill-opacity:.35}',
    'circle[data-p^="plate"]{fill-opacity:.6}',
  ].join(''),
})
