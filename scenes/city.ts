import { defineFigure, defineScene, isometric, type Vec2, type Vec3 } from 'dotscene'
import { figureOf, isoKit, merge, tag, type Shape } from './iso.ts'

/**
 * A nine-by-nine city block, drawn in the view every isometric city builder uses.
 *
 * Everything here is authored in grid coordinates — tiles across, tiles down, storeys up —
 * and projected once, when the figure is written. dotscene itself stays two-dimensional;
 * `isometric` is an authoring transform, not a renderer mode. That is the whole trick, and
 * it means depth costs nothing at runtime.
 */
const kit = isoKit(isometric({ tile: 8, squash: 0.5, rise: 5 }))
const { at: grid, box, edge: edge3, line } = kit

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
    faces: canopy.map((_unused, i) => ({
      points: [`${prefix}Top`, `${prefix}C${i}`, `${prefix}C${(i + 1) % 4}`],
      kind: 'foliage',
    })),
  }
}

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

/**
 * Roads run well past the block and are cropped by the viewBox, so they read as continuing
 * into the neighbouring blocks — and so a vehicle can arrive from off-frame rather than
 * appearing out of nothing at the boundary.
 */
const ROAD_FROM = -8
const ROAD_TO = 17
/** Down the middle of the east–west carriageway, between the gy = 4 and gy = 5 kerbs. */
const ROAD_LANE = 4.5

const roads = merge(
  line('roadNS1', [4, ROAD_FROM], [4, ROAD_TO]),
  line('roadNS2', [5, ROAD_FROM], [5, ROAD_TO]),
  line('roadEW1', [ROAD_FROM, 4], [ROAD_TO, 4]),
  line('roadEW2', [ROAD_FROM, 5], [ROAD_TO, 5]),
)

/**
 * Everything is its own part now, because parts paint in declaration order and that order is
 * what does the hiding. Ground first, then each solid from the back of the scene forwards:
 * a wall painted late covers the grid lines, roads and vehicle painted before it.
 *
 * Depth in this projection is x + y. The tower's nearest corner is at 6, the truck's lane is
 * at 4.5 rising to 21.5 as it drives, the office and works sit at 11, the park at 13 to 16.
 * The truck therefore passes behind the works building and in front of nothing — checked,
 * not assumed — so one fixed order holds for the whole journey.
 */
export const cityGround = figureOf(
  'cityGround',
  merge(tag(plate, 'ground'), tag(lots, 'lot'), tag(roads, 'road')),
  'Ground, lots and roads',
)

export const tower = figureOf('tower', box('tower', [1, 1], [3, 3], 6), 'A tower')
export const office = figureOf('office', box('office', [6, 1], [8, 3], 3), 'An office')
export const works = figureOf('works', box('works', [1, 6], [3, 8], 4), 'A works')

export const park = figureOf(
  'park',
  merge(
    tree('treeA', [6.6, 6.6], 1.5, 0.8),
    tree('treeB', [8.2, 7.4], 1.2, 0.7),
    tree('treeC', [6.9, 8.4], 1.8, 0.85),
  ),
  'A park',
)

/**
 * A truck, drawn at the grid origin and moved by translating the part.
 *
 * That works because the projection is affine: shifting a figure by whole cells in grid
 * space is exactly a shift in screen space, so `grid([gx, gy, 0])` doubles as the offset to
 * place it there. No per-frame pose needed — the truck is one figure that slides, faces and
 * all, because the runtime moves a polygon's rim the same way it moves a line's ends.
 *
 * Authored nose-first along +x, which is the direction it drives.
 */
const truckShape = merge(
  box('trailer', [0, -0.38], [1.2, 0.38], 0.95, 0.22),
  box('cab', [1.2, -0.36], [1.85, 0.36], 0.62, 0.22),
  edge3('wheelRear', [0.3, 0.38, 0.22], [0.3, 0.38, 0]),
  edge3('wheelFront', [1.45, 0.36, 0.22], [1.45, 0.36, 0]),
)

// Its own role, so its dots can be smaller: a vehicle's panels are shorter than a
// building's walls, and dots sized for the buildings turn it into a blob.
export const truck = figureOf('truck', tag(truckShape, 'vehicle'), 'A truck')

/** Where the truck sits when it is `gx` cells along the east–west road. */
const alongRoad = (gx: number): Vec2 => grid([gx, ROAD_LANE, 0])

/**
 * Non-photo blue is the pencil a draughtsman laid out with, because the reproduction camera
 * could not see it: structure in blue, content inked in black on top. This block is that
 * drawing — the lot grid is the layout underlay, the buildings are what was inked.
 *
 * So the roles map straight onto the ramp. The lot grid is npb-300, which is 1.42:1 on
 * paper and *should* be barely there. The plate boundary and the roads have to be resolved,
 * so they step darker to npb-600 and npb-700, the lightest blues the system allows to carry
 * meaning. Everything standing up is gray-900 ink at 15.71:1.
 *
 * Hierarchy here is not carried by lightness alone — the roads are also the heaviest stroke,
 * and structure dots are smaller than ink ones — so it survives greyscale and colour-blind
 * readers, and blue never outweighs the content it sits under. This scene needs no categorical
 * colours: its three ground roles are a hierarchy, not a series.
 *
 * Literal hex, never custom properties: a standalone .svg, an `<img src>` or a rasterised
 * PNG inherits nothing from a page.
 */
const roles = (
  ink: string,
  lot: string,
  ground: string,
  road: string,
  faces: { readonly roof: string; readonly east: string; readonly south: string; readonly foliage: string },
): string =>
  [
    `.ds-face--roof{fill:${faces.roof}}`,
    `.ds-face--east{fill:${faces.east}}`,
    `.ds-face--south{fill:${faces.south}}`,
    `.ds-face--foliage{fill:${faces.foliage}}`,
    `.ds-line{stroke:${ink}}`,
    `.ds-dot{fill:${ink}}`,
    `.ds-line--lot{stroke:${lot}}`,
    `.ds-dot--lot{fill:${lot};r:.55}`,
    `.ds-line--ground{stroke:${ground}}`,
    `.ds-dot--ground{fill:${ground};r:.85}`,
    `.ds-line--road{stroke:${road};stroke-width:1.15}`,
    `.ds-dot--road{fill:${road};r:1}`,
    `.ds-line--vehicle{stroke:${ink};stroke-width:.5}`,
    `.ds-dot--vehicle{fill:${ink};r:.75}`,
  ].join('')

const layout = {
  parts: [
    { figure: cityGround },
    { figure: tower },
    { figure: truck, id: 'truck', at: alongRoad(-8) },
    { figure: office },
    { figure: works },
    { figure: park },
  ],
  // Explicit, because the roads deliberately overrun the block: a fitted box would zoom out
  // to include them and there would be no off-frame left to arrive from.
  viewBox: [-80, -30, 160, 110],
  padding: 8,
  // The tree edges are far shorter than the buildings', so the median-edge default sizes
  // dots for the buildings and swallows the park. Set it against the smaller detail.
  dotRadius: 1.3,
  lineWidth: 0.6,
  /**
   * The truck crosses the block on the east–west road, entering through the upper-left edge
   * and leaving through the lower-right.
   *
   * Two keyframes is the whole animation. A linear tween between them *is* constant speed,
   * so intermediate frames would add bytes and change nothing; the only reason the exchange
   * scene needs thirty-nine is that its figures change shape as they move. The hold at the
   * far end leaves the street empty for a beat before the cut sends it round again.
   */
  animate: {
    mode: 'loop',
    keyframes: [
      { name: 'enter', duration: 0, hold: 0, easing: 'linear', parts: { truck: { at: alongRoad(-8) } } },
      { name: 'exit', duration: 6500, hold: 1400, easing: 'linear', parts: { truck: { at: alongRoad(17) } } },
    ],
  },
} as const

export const scene = defineScene('city', {
  title: 'A city block, nine tiles square',
  ...layout,
  background: '#fbfaf7', // gray-050, paper
  // Walls take three neutral steps so a solid reads as having form: roof lightest, then the
  // two visible walls. All from the ramp — gray-000, gray-100, gray-200.
  css: roles('#1d2021', '#a4dded', '#1b7f9f', '#0b6580', {
    roof: '#ffffff',
    east: '#f2f1ec',
    south: '#e6e4dd',
    foliage: '#f2f1ec',
  }),
})

/**
 * The dark variant, emitted as its own file rather than hoping one works on both.
 *
 * The roles invert: ink becomes #edebe6, and npb-300 — unreadable on paper — is the legible
 * blue here at 11.99:1, so it takes the roads. The lot grid drops to the dark hairline, and
 * the boundary steps back down the ramp to npb-500 so it still sits between the two.
 */
export const night = defineScene('cityNight', {
  title: 'A city block, nine tiles square — dark',
  ...layout,
  background: '#16181a', // gray-950
  // The same three steps, taken up from the ground rather than down from paper, so a wall
  // never matches the ground it stands on: gray-700, gray-800, gray-900.
  css: roles('#edebe6', '#33383b', '#3d9fbf', '#a4dded', {
    roof: '#3b4042',
    east: '#262a2c',
    south: '#1d2021',
    foliage: '#262a2c',
  }),
})
