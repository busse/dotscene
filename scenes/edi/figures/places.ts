/**
 * Places: what stands at each stop of the EDI hero, and the yard furniture around them.
 *
 * Every figure is authored centred on grid (0, 0) with its base at z = 0 and is placed by
 * translating the part. The road runs along the front of every building, and "front" is the
 * +y side — the wall between a box's `West` and `Near` corners, which lands lower-left on
 * screen — so that is where the door slots are.
 *
 * Doors, masts, flags and trees are separate figures so they can move (a door rolls up, a
 * pennant flutters, a canopy sways) without the building they stand on paying for a pose.
 */

import { defineFigure, type Vec2, type Vec3 } from 'dotscene'
import { at, box, edge, pad } from '../projection.ts'
import { figureOf, merge, tag, tone, type Shape } from '../../iso.ts'

/** A door slot: where a `dockDoor` part goes, in grid units from the building's origin. */
export type Slot = readonly [number, number]

// ---------------------------------------------------------------------------------------
// Helpers

/** Horizontal window rules on the two visible walls of a box, at the given heights. */
const windowRules = (prefix: string, from: Vec2, to: Vec2, heights: readonly number[], inset = 0.25): Shape => {
  const [x0, y0] = from
  const [x1, y1] = to
  return tag(
    merge(
      ...heights.flatMap((z, i) => [
        // East wall (x = x1) runs along y; south wall (y = y1) runs along x.
        edge(`${prefix}WinE${i}`, [x1, y0 + inset, z], [x1, y1 - inset, z]),
        edge(`${prefix}WinS${i}`, [x0 + inset, y1, z], [x1 - inset, y1, z]),
      ]),
    ),
    'soft',
  )
}

/** A flat slab with its own face kind — a canopy, a step — rather than an apron. */
const slab = (prefix: string, from: Vec2, to: Vec2, z: number, kind: string): Shape => {
  const flat = pad(prefix, from, to, z)
  return { ...flat, faces: (flat.faces ?? []).map((f) => ({ ...f, kind })) }
}

/** Evenly spaced door slots along a wall at `y`, centred on `centre`. */
const slots = (count: number, gap: number, y: number, centre = 0): readonly Slot[] =>
  Array.from({ length: count }, (_u, i) => [centre + (i - (count - 1) / 2) * gap, y] as const)

/**
 * A yard: an apron with faint bay lines ruled across it, spaced along x and running along y —
 * the way bays run out from a dock. Returns a Shape so a scene can merge it with more.
 */
export const yard = (prefix: string, w: number, d: number, rules = 4): Shape =>
  merge(
    tag(pad(prefix, [-w / 2, -d / 2], [w / 2, d / 2]), 'ground'),
    tag(
      merge(
        ...Array.from({ length: rules }, (_u, i) => {
          const x = -w / 2 + ((i + 1) * w) / (rules + 1)
          return edge(`${prefix}Rule${i}`, [x, -d / 2, 0], [x, d / 2, 0])
        }),
      ),
      'lot',
    ),
  )

// ---------------------------------------------------------------------------------------
// Buildings

/**
 * The shipper's plant: a shed with a taller head-house at its west end and a chimney on
 * that. Painted head-house first — the shed is nearer along their shared wall and hides the
 * lower part of it.
 */
export const shipperPlant = figureOf(
  'shipperPlant',
  merge(
    tone(box('block', [-4, -1.5], [-2, 0.5], 4.6), 'warm'),
    box('stack', [-3.55, -1.1], [-3.05, -0.6], 7, 4.6),
    tone(box('shed', [-2, -1.5], [4, 1.5], 3.2), 'shed'),
  ),
  'The shipper — a plant with a loading dock',
)
/** Three bays along the shed's front wall. */
export const SHIPPER_DOORS: readonly Slot[] = [
  [-0.5, 1.5],
  [0.8, 1.5],
  [2.1, 1.5],
]
export const SHIPPER_STACK_TOP: Vec3 = [-3.3, -0.85, 7]

/** The carrier's crossdock: a long shed, a ridge along its roof, a canopy over the doors. */
export const hubCrossdock = figureOf(
  'hubCrossdock',
  merge(
    box('dock', [-5, -1.8], [5, 1.8], 3.6),
    box('ridge', [-4.5, -0.6], [4.5, 0.6], 4.2, 3.6),
    slab('canopy', [-5, 1.8], [5, 2.6], 2.7, 'canopy'),
  ),
  'The carrier — a crossdock',
)
export const HUB_DOORS: readonly Slot[] = slots(5, 1.8, 1.8)
/** The far wall, for trailers backed onto the other side. Not drawn — it faces away. */
export const HUB_DOORS_NORTH: readonly Slot[] = slots(5, 1.8, -1.8)

/** The carrier's office: a tower in the palette's blue, with three floors of windows. */
export const hubOffice = figureOf(
  'hubOffice',
  merge(
    tone(box('hq', [-1.2, -1.2], [1.2, 1.2], 9), 'blue'),
    windowRules('hq', [-1.2, -1.2], [1.2, 1.2], [3, 5, 7]),
    tone(box('hqPlinth', [-1, -1], [1, 1], 9.3, 9), 'blue'),
  ),
  'The carrier — head office',
)
export const HUB_MAST_BASE: Vec3 = [0, 0, 9.3]

/** The consignee: a receiving warehouse with a low office annex on its front corner. */
export const consigneeStore = figureOf(
  'consigneeStore',
  merge(
    box('store', [-2.5, -1.5], [2.5, 1.5], 3),
    tone(box('annex', [0.5, 1.5], [2.5, 2.7], 1.6), 'warm'),
  ),
  'The consignee — a receiving warehouse',
)
export const CONSIGNEE_DOORS: readonly Slot[] = [
  [-1.7, 1.5],
  [-0.4, 1.5],
]

/** The payer: a bank — columns along its front, a pediment over them, steps below. */
export const bank = figureOf(
  'bank',
  merge(
    slab('bankSteps', [-1.9, 1.3], [1.9, 2.0], 0.05, 'apron'),
    tone(box('bank', [-1.8, -1.3], [1.8, 1.3], 3), 'blue'),
    tag(
      merge(...[-1.35, -0.45, 0.45, 1.35].map((x, i) => edge(`bankCol${i}`, [x, 1.6, 0], [x, 1.6, 3]))),
      'soft',
    ),
    tone(box('pediment', [-1.9, 1.45], [1.9, 1.75], 3.4, 3), 'blue'),
  ),
  'The payer — a bank',
)
export const BANK_MAST_BASE: Vec3 = [0, 0, 3]

/** The broker: a modest office off the road, two floors of windows. */
export const brokerOffice = figureOf(
  'brokerOffice',
  merge(box('broker', [-1.2, -1], [1.2, 1], 4), windowRules('broker', [-1.2, -1], [1.2, 1], [1.4, 2.8])),
  'The broker — an office',
)
export const BROKER_MAST_BASE: Vec3 = [0, 0, 4]

// ---------------------------------------------------------------------------------------
// Furniture that moves

/**
 * One roller door in a wall that faces +y, standing in the plane y = 0 so a part can be
 * dropped onto a door slot. The bay in front of it is a small apron; the opening behind it
 * is a dark face that the door covers while closed and reveals as it rolls up.
 */
export const dockDoor = defineFigure('dockDoor', {
  title: 'A dock door',
  points: {
    doorFootW: at([-0.35, 0, 0]),
    doorFootE: at([0.35, 0, 0]),
    doorHeadE: at([0.35, 0, 1.5]),
    doorHeadW: at([-0.35, 0, 1.5]),
    bayFootW: at([-0.35, 0, 0]),
    bayFootE: at([0.35, 0, 0]),
    bayNear: at([0.35, 0.5, 0.02]),
    bayWest: at([-0.35, 0.5, 0.02]),
  },
  edges: [
    { from: 'bayFootE', to: 'bayNear', kind: 'lot' },
    { from: 'bayNear', to: 'bayWest', kind: 'lot' },
    { from: 'bayWest', to: 'bayFootW', kind: 'lot' },
    { from: 'doorFootW', to: 'doorFootE', kind: 'soft' },
    { from: 'doorFootE', to: 'doorHeadE', kind: 'soft' },
    { from: 'doorHeadE', to: 'doorHeadW', kind: 'soft' },
    { from: 'doorHeadW', to: 'doorFootW', kind: 'soft' },
  ],
  faces: [
    { points: ['bayFootW', 'bayFootE', 'bayNear', 'bayWest'], kind: 'apron' },
    { points: ['bayFootW', 'bayFootE', 'doorHeadE', 'doorHeadW'], kind: 'doorway' },
    { points: ['doorFootW', 'doorFootE', 'doorHeadE', 'doorHeadW'], kind: 'door' },
  ],
  pointKinds: {
    bayFootW: 'lot',
    bayFootE: 'lot',
    bayNear: 'lot',
    bayWest: 'lot',
    doorFootW: 'soft',
    doorFootE: 'soft',
    doorHeadE: 'soft',
    doorHeadW: 'soft',
  },
  poses: {
    closed: {},
    /** Rolled up to a short lintel; the doorway shows through. */
    open: { doorFootW: at([-0.35, 0, 1.3]), doorFootE: at([0.35, 0, 1.3]) },
  },
})

/** A network antenna for a roof: a mast with a cross-arm near its top. */
export const mast = figureOf(
  'mast',
  tag(merge(edge('mast', [0, 0, 0], [0, 0, 3.2]), edge('mastArm', [-0.3, 0, 2.8], [0.3, 0, 2.8])), 'net'),
  'An antenna mast',
)
export const MAST_TOP: Vec3 = [0, 0, 3.2]

/** A flagpole with a pennant. Cycle a → b → c → a to flutter it. */
export const flag = defineFigure('flag', {
  title: 'A flag',
  points: {
    poleFoot: at([0, 0, 0]),
    poleTop: at([0, 0, 2.4]),
    pennantLow: at([0, 0, 2.05]),
    pennantMid: at([0.35, 0, 2.24]),
    pennantTip: at([0.7, 0, 2.22]),
  },
  edges: [
    { from: 'poleFoot', to: 'poleTop', kind: 'soft' },
    ['poleTop', 'pennantMid'],
    ['pennantMid', 'pennantTip'],
    ['pennantTip', 'pennantLow'],
  ],
  faces: [{ points: ['poleTop', 'pennantMid', 'pennantTip', 'pennantLow'], kind: 'flag' }],
  pointKinds: { poleFoot: 'soft', poleTop: 'soft' },
  poses: {
    a: { pennantMid: at([0.35, 0, 2.34]), pennantTip: at([0.7, 0, 2.1]) },
    b: { pennantMid: at([0.35, 0, 2.14]), pennantTip: at([0.7, 0, 2.34]) },
    c: { pennantMid: at([0.35, 0.04, 2.22]), pennantTip: at([0.7, 0.12, 2.22]) },
  },
})

/**
 * A tree: a trunk into a low-poly crown — a ring of four turned 45° so it reads as a diamond
 * on screen, an apex above it and the trunk top below, faced on all eight sides. The spoke
 * from the apex to the far ring point is left out, the way a box drops its far corner.
 */
/**
 * A tree: a trunk into a low-poly crown of two rings and an apex — the wider ring low, a
 * narrower one above it — so the silhouette bulges the way a crown does rather than
 * tapering straight from the ground to a point. Sway leans the whole crown a little.
 */
const treeFigure = (name: string, title: string, trunk: number, ring: number, apex: number, spread: number) => {
  const s = spread / Math.SQRT2
  const upper = ring + (apex - ring) * 0.55
  const u = s * 0.62
  // Ring order on screen: bottom, left, top, right.
  const lowCells: Vec3[] = [
    [s, s, ring],
    [-s, s, ring],
    [-s, -s, ring],
    [s, -s, ring],
  ]
  const highCells: Vec3[] = [
    [u, u, upper],
    [-u, u, upper],
    [-u, -u, upper],
    [u, -u, upper],
  ]
  const cells = { ...Object.fromEntries(lowCells.map((c, i) => [`c${i}`, c])), ...Object.fromEntries(highCells.map((c, i) => [`d${i}`, c])) } as Record<string, Vec3>
  const rest = Object.fromEntries(Object.entries(cells).map(([n, c]) => [n, at(c)])) as Record<string, Vec2>
  const lean = (c: Vec3, k: number): Vec2 => at([c[0] + 0.12 * k, c[1], c[2]])
  const sway = {
    ...Object.fromEntries(lowCells.map((c, i) => [`c${i}`, lean(c, 0.8)])),
    ...Object.fromEntries(highCells.map((c, i) => [`d${i}`, lean(c, 1.3)])),
    apex: at([0.2, 0, apex]),
  } as Record<string, Vec2>
  const low = ['c0', 'c1', 'c2', 'c3']
  const high = ['d0', 'd1', 'd2', 'd3']
  // Far faces first, so the near ones paint over them.
  const order = [1, 2, 3, 0]
  return defineFigure(name, {
    title,
    points: { foot: at([0, 0, 0]), top: at([0, 0, trunk]), apex: at([0, 0, apex]), ...rest },
    edges: [
      ['foot', 'top'],
      ...low.map((c, i) => [c, low[(i + 1) % 4]!] as const),
      ...high.map((c, i) => [c, high[(i + 1) % 4]!] as const),
      ['c0', 'd0'],
      ['c1', 'd1'],
      ['c3', 'd3'],
      ['apex', 'd0'],
      ['apex', 'd1'],
      ['apex', 'd3'],
    ],
    faces: [
      ...order.map((i) => ({ points: ['top', low[i]!, low[(i + 1) % 4]!], kind: 'foliage' })),
      ...order.map((i) => ({ points: [low[i]!, low[(i + 1) % 4]!, high[(i + 1) % 4]!, high[i]!], kind: 'foliage' })),
      ...order.map((i) => ({ points: ['apex', high[i]!, high[(i + 1) % 4]!], kind: 'foliage' })),
    ],
    pointKinds: Object.fromEntries(['apex', ...low, ...high].map((c) => [c, 'foliage'])),
    poses: { rest: {}, sway },
  })
}

// Taller than wide: a crown that is broader than it is high reads as a kite from this angle.
export const tree = treeFigure('tree', 'A tree', 0.9, 1.5, 3.6, 0.55)
export const treeSmall = treeFigure('treeSmall', 'A small tree', 0.55, 1.05, 2.5, 0.4)

/** A ring of smoke lying flat at the origin; translate, scale and fade it to make it rise. */
export const smokePuff = figureOf(
  'smokePuff',
  (() => {
    const names = Array.from({ length: 6 }, (_u, i) => `puff${i}`)
    return {
      points: Object.fromEntries(
        names.map((n, i) => {
          const a = (i / 6) * Math.PI * 2
          return [n, at([Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0])]
        }),
      ),
      edges: names.map((n, i) => [n, names[(i + 1) % 6]!] as const),
      faces: [{ points: names, kind: 'smoke' }],
    }
  })(),
  'A puff of smoke',
  'soft',
)
