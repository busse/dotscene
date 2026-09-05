/**
 * The world the EDI hero is set in: where everything stands, and the road between.
 *
 * Three stops on one road — the shipper's plant, the carrier's crossdock with its office
 * tower behind, and the consignee's warehouse — with the two parties the freight never
 * reaches, the broker and the bank, standing off the road at the back. A river cuts the
 * ground between the shipper and the carrier, and the road crosses it on a bridge.
 *
 * Everything is placed in grid coordinates and projected once. Depth is `gx + gy`: larger
 * is nearer, and it is what the paint order is sorted by. Every anchor an act needs — where
 * a message leaves a building, where a rig backs onto a door, where a forklift waits — is
 * computed here from the placement, so moving a building moves everything that happens at it.
 */

import type { Figure, Part, Vec2, Vec3 } from 'dotscene'
import { at, box, edge } from './projection.ts'
import { figureOf, merge, tag, type Shape } from '../iso.ts'
import {
  BANK_MAST_BASE,
  BROKER_MAST_BASE,
  CONSIGNEE_DOORS,
  HUB_DOORS,
  HUB_MAST_BASE,
  SHIPPER_DOORS,
  SHIPPER_STACK_TOP,
  bank,
  brokerOffice,
  consigneeStore,
  dockDoor,
  flag,
  hubCrossdock,
  hubOffice,
  mast,
  MAST_TOP,
  shipperPlant,
  smokePuff,
  tree,
  treeSmall,
  yard,
  type Slot,
} from './figures/places.ts'
import { FORK_CENTRE, forklift, pallet, rig, van } from './figures/vehicles.ts'
import { coinStack } from './figures/tokens.ts'
import { birds, cloud, ripples } from './figures/sky.ts'
import { person } from '../person.ts'

export type Cell = readonly [number, number]

const v3 = (cell: Cell, z = 0): Vec3 => [cell[0], cell[1], z]
const add = (a: Cell, b: Cell): Cell => [a[0] + b[0], a[1] + b[1]]

/** Paint order for something standing at a cell. */
export const depthOf = (cell: Cell): number => cell[0] + cell[1]

// ---------------------------------------------------------------------------------------------
// The camera

/** The frame's shape. Anamorphic: a hero strip, not a portrait. */
export const ASPECT = 2.4
/** The establishing shot: the whole world, both partners at the back included. */
export const WIDE = { at: [30, -66] as Vec2, width: 480 }

// ---------------------------------------------------------------------------------------------
// The road

/**
 * Waypoints, in grid cells. Every run is along one axis: +x falls down-right on screen, −y
 * rises up-right. The road zigzags so it can pass along the front of each dock (a dock faces
 * +y, so its road runs along x) while the whole thing still reads left to right.
 */
export const ROAD: readonly Cell[] = [
  [-46, 7.2],
  [-10, 7.2],
  [-10, -3.4],
  [3, -3.4],
  [3, -13.4],
  [12, -13.4],
  [12, -24],
  [42, -24],
]

const HALF_ROAD = 0.7

export interface Segment {
  readonly from: Cell
  readonly to: Cell
  readonly axis: 'x' | 'y'
  /** +1 when travel along the route increases the coordinate. */
  readonly dir: 1 | -1
  readonly length: number
}

export const segments: readonly Segment[] = ROAD.slice(0, -1).map((from, i) => {
  const to = ROAD[i + 1]!
  const axis = from[0] === to[0] ? 'y' : 'x'
  const delta = axis === 'x' ? to[0] - from[0] : to[1] - from[1]
  return { from, to, axis, dir: delta > 0 ? 1 : -1, length: Math.abs(delta) }
})

const TOTAL = segments.reduce((sum, s) => sum + s.length, 0)

/** Where a vehicle is when it is `t` of the way along the road, 0 to 1. */
export interface OnRoad {
  readonly cell: Cell
  readonly axis: 'x' | 'y'
  readonly dir: 1 | -1
  readonly depth: number
}

export const along = (t: number): OnRoad => {
  let travelled = Math.min(Math.max(t, 0), 1) * TOTAL
  for (const seg of segments) {
    if (travelled > seg.length + 1e-9 && seg !== segments[segments.length - 1]) {
      travelled -= seg.length
      continue
    }
    const local = seg.length === 0 ? 0 : Math.min(travelled / seg.length, 1)
    const cell: Cell = [
      seg.from[0] + (seg.to[0] - seg.from[0]) * local,
      seg.from[1] + (seg.to[1] - seg.from[1]) * local,
    ]
    return { cell, axis: seg.axis, dir: seg.dir, depth: depthOf(cell) }
  }
  const last = segments[segments.length - 1]!
  return { cell: last.to, axis: last.axis, dir: last.dir, depth: depthOf(last.to) }
}

/** The route parameter of the point on the road nearest to a cell — for docks and stops. */
export const routeAt = (cell: Cell): number => {
  let best = 0
  let bestDistance = Infinity
  let run = 0
  for (const seg of segments) {
    const axis = seg.axis === 'x' ? 0 : 1
    const across = seg.axis === 'x' ? 1 : 0
    const lo = Math.min(seg.from[axis], seg.to[axis])
    const hi = Math.max(seg.from[axis], seg.to[axis])
    const clamped = Math.min(hi, Math.max(lo, cell[axis]))
    const distance = Math.hypot(clamped - cell[axis], seg.from[across] - cell[across])
    if (distance < bestDistance) {
      bestDistance = distance
      best = (run + Math.abs(clamped - seg.from[axis])) / TOTAL
    }
    run += seg.length
  }
  return best
}

/** Route parameters at every corner, so a drive only needs a keyframe where the road turns. */
export const corners: readonly number[] = (() => {
  const marks: number[] = [0]
  let run = 0
  for (const seg of segments) {
    run += seg.length
    marks.push(run / TOTAL)
  }
  return marks
})()

export const cornersBetween = (from: number, to: number): readonly number[] => {
  const low = Math.min(from, to)
  const high = Math.max(from, to)
  const inside = corners.filter((c) => c > low + 1e-9 && c < high - 1e-9)
  return from <= to ? inside : [...inside].reverse()
}

/**
 * Both kerbs, mitred at every corner, and the surface between them.
 *
 * Each kerb is one polyline offset from the centreline; at a right-angle corner the mitre
 * point is the vertex pushed out along both runs' normals at once, which is what stops the
 * old H-shaped gaps at every turn.
 */
const kerbPolyline = (side: 1 | -1): readonly Cell[] => {
  const normal = (seg: Segment): Cell => {
    // Left of the direction of travel, then flipped for the other side.
    const n: Cell = seg.axis === 'x' ? [0, -seg.dir] : [seg.dir, 0]
    return [n[0] * side * HALF_ROAD, n[1] * side * HALF_ROAD]
  }
  const points: Cell[] = []
  points.push(add(ROAD[0]!, normal(segments[0]!)))
  for (let i = 1; i < ROAD.length - 1; i++) {
    const before = normal(segments[i - 1]!)
    const after = normal(segments[i]!)
    points.push(add(ROAD[i]!, add(before, after)))
  }
  points.push(add(ROAD[ROAD.length - 1]!, normal(segments[segments.length - 1]!)))
  return points
}

const polyline = (prefix: string, cells: readonly Cell[], kind: string, z = 0): Shape => {
  const points: Record<string, Vec2> = {}
  const edges: (readonly [string, string])[] = []
  cells.forEach((cell, i) => {
    points[`${prefix}${i}`] = at(v3(cell, z))
    if (i > 0) edges.push([`${prefix}${i - 1}`, `${prefix}${i}`])
  })
  return tag({ points, edges }, kind)
}

const roadShape: Shape = (() => {
  const left = kerbPolyline(1)
  const right = kerbPolyline(-1)
  const kerbs = merge(polyline('kerbL', left, 'kerb'), polyline('kerbR', right, 'kerb'))
  const rim = [...left.map((_c, i) => `kerbL${i}`), ...right.map((_c, i) => `kerbR${right.length - 1 - i}`)]
  return { ...kerbs, faces: [{ points: rim, kind: 'road' }] }
})()

export const road = figureOf('road', roadShape, 'The road')

// ---------------------------------------------------------------------------------------------
// The river and the bridge

/** The river's centreline, wandering from the far top of the frame to the near bottom. */
const RIVER: readonly Cell[] = [
  [-24, -14],
  [-20, -9],
  [-16, -5.5],
  [-13.5, -1.5],
  [-11, 1],
  [-8.5, 3.5],
  [-6.5, 6.5],
  [-4, 9],
  [-1.5, 12],
  [1.5, 15],
  [5, 18],
]

const RIVER_HALF = 0.85

const riverBank = (side: 1 | -1): readonly Cell[] =>
  RIVER.map((cell, i) => {
    const prev = RIVER[Math.max(0, i - 1)]!
    const next = RIVER[Math.min(RIVER.length - 1, i + 1)]!
    const dx = next[0] - prev[0]
    const dy = next[1] - prev[1]
    const length = Math.hypot(dx, dy) || 1
    return [cell[0] + (-dy / length) * RIVER_HALF * side, cell[1] + (dx / length) * RIVER_HALF * side]
  })

const riverShape: Shape = (() => {
  const left = riverBank(1)
  const right = riverBank(-1)
  const banks = merge(polyline('bankL', left, 'bank'), polyline('bankR', right, 'bank'))
  const rim = [...left.map((_c, i) => `bankL${i}`), ...right.map((_c, i) => `bankR${right.length - 1 - i}`)]
  return { ...banks, faces: [{ points: rim, kind: 'water' }] }
})()

export const river = figureOf('river', riverShape, 'The river')

/** Where the road crosses the river: on the first −y run, at the river's own crossing point. */
export const BRIDGE_CELL: Cell = [-10, 1]

const bridgeShape: Shape = (() => {
  const [bx, by] = BRIDGE_CELL
  const deck = box('deck', [bx - 0.95, by - 1.5], [bx + 0.95, by + 1.5], 0.16, 0.04)
  const slab = { ...deck, faces: (deck.faces ?? []).map((f) => ({ ...f, kind: f.kind === 'roof' ? 'bridge' : f.kind })) }
  const rail = (name: string, x: number) =>
    merge(
      edge(`${name}Rail`, [x, by - 1.5, 0.55], [x, by + 1.5, 0.55]),
      edge(`${name}PostA`, [x, by - 1.5, 0.16], [x, by - 1.5, 0.55]),
      edge(`${name}PostB`, [x, by + 1.5, 0.16], [x, by + 1.5, 0.55]),
    )
  return merge(tag(slab, 'kerb'), tag(merge(rail('railW', bx - 0.95), rail('railE', bx + 0.95)), 'soft'))
})()

export const bridge = figureOf('bridge', bridgeShape, 'The bridge')

// ---------------------------------------------------------------------------------------------
// Sites

/** A parked trailer, backed onto a +y door: laid along y, rear at the door, cab-less. */
const trailerShape: Shape = merge(
  tag(box('ptBox', [-0.55, 0], [0.55, 2.6], 2.9, 0.5), 'vehicle'),
  tag(edge('ptWheelA', [0.55, 0.45, 0], [0.55, 0.45, 0.5]), 'wheel'),
  tag(edge('ptWheelB', [0.55, 0.85, 0], [0.55, 0.85, 0.5]), 'wheel'),
  tag(edge('ptLeg', [0.55, 2.3, 0], [0.55, 2.3, 0.5]), 'soft'),
)
export const parkedTrailer = figureOf('parkedTrailer', trailerShape, 'A parked trailer')

export interface Site {
  readonly id: string
  readonly label: string
  /** The building's origin. */
  readonly cell: Cell
  /** Where messages leave and arrive: the top of the mast, in scene units. */
  readonly mast: Vec2
  /** Door slots, as absolute cells on the +y wall. */
  readonly doors: readonly Cell[]
}

const site = (id: string, label: string, cell: Cell, mastBase: Vec3, doors: readonly Slot[]): Site => ({
  id,
  label,
  cell,
  mast: at([cell[0] + mastBase[0] + MAST_TOP[0], cell[1] + mastBase[1] + MAST_TOP[1], mastBase[2] + MAST_TOP[2]]),
  doors: doors.map((slot) => add(cell, slot)),
})

/** The head-house roof, where the shipper's mast stands. */
const SHIPPER_MAST_BASE: Vec3 = [-3, -0.6, 4.6]
const CONSIGNEE_MAST_BASE: Vec3 = [-1.6, -0.6, 3]

export const sites = {
  shipper: site('shipper', 'The shipper', [-16, 1], SHIPPER_MAST_BASE, SHIPPER_DOORS),
  hub: site('hub', 'The carrier', [-4, -9.8], [0, 0, 0], HUB_DOORS),
  office: site('office', 'The carrier — head office', [-11.5, -13.2], HUB_MAST_BASE, []),
  consignee: site('consignee', 'The consignee', [7, -19.5], CONSIGNEE_MAST_BASE, CONSIGNEE_DOORS),
  bank: site('bank', 'The payer', [3.5, -27.5], BANK_MAST_BASE, []),
  broker: site('broker', 'The broker', [-27, -5.5], BROKER_MAST_BASE, []),
} as const

export type SiteId = keyof typeof sites

/** The network node a message flies from or to. The carrier's node is on the office tower. */
export const nodeOf = (id: SiteId | 'carrier'): Vec2 => (id === 'carrier' || id === 'hub' ? sites.office.mast : sites[id].mast)

/**
 * A docked rig stops short of the wall by a gap the forklift can work in, and its origin sits
 * half its trailer's length beyond that. So the loading happens in view, at the trailer's
 * side, rather than inside the building where nothing can be seen.
 */
export const DOCK_GAP = 0.8
export const DOCKED_OFFSET = DOCK_GAP + 1.8

/** The cell a rig's origin occupies when it is backed onto a door. */
export const dockedAt = (door: Cell): Cell => [door[0], door[1] + DOCKED_OFFSET]

/** The cell a forklift stands on to reach into a docked trailer from its west side. */
export const loadingSpotWest = (door: Cell): Cell => [door[0] - 1.9, door[1] + DOCK_GAP + 0.9]
export const loadingSpotEast = (door: Cell): Cell => [door[0] + 1.9, door[1] + DOCK_GAP + 0.9]

/** Where the rig starts and returns: backed onto a bay of the carrier's crossdock. */
export const RIG_BAY = dockedAt(sites.hub.doors[3]!)

/**
 * The loading lane: one row across each yard, a forklift's reach in front of the docked
 * trailers' rears, so every forklift move is a straight run along x.
 */
const LANE = DOCK_GAP + 0.9

/** The shipper's yard: the pallet is staged west of the rig's door, its forklift further west. */
export const SHIPPER_STAGING: Cell = add(sites.shipper.doors[0]!, [-1.0, LANE])
export const SHIPPER_LIFT_YARD: Cell = add(sites.shipper.doors[0]!, [-2.6, LANE])
export const SHIPPER_LIFT_WEST: Cell = add(sites.shipper.doors[0]!, [-3.6, LANE])

/** The consignee's yard: its forklift comes out of the second door and works east of the rig. */
export const CONSIGNEE_LIFT_HOME: Cell = add(sites.consignee.doors[1]!, [0, -1.4])
export const CONSIGNEE_WAIT: Cell = loadingSpotEast(sites.consignee.doors[0]!)
export const CONSIGNEE_DROP: Cell = add(sites.consignee.doors[0]!, [3.6, LANE])
export const CONSIGNEE_LIFT_REST: Cell = add(sites.consignee.doors[0]!, [5.3, LANE])

/** The carrier's yard forklift shuttles in and out of an open door all day. */
export const HUB_LIFT_HOME: Cell = add(sites.hub.doors[2]!, [0, 0.7])
export const HUB_LIFT_OUT: Cell = add(sites.hub.doors[2]!, [0, 3.3])

/** The person's figure is 64 tall; at this scale a worker stands about five units. */
export const PERSON_SCALE = 0.085
export const PERSON_FEET = 64 * PERSON_SCALE

/** A worker's part position for standing on a cell. */
export const standingAt = (cell: Cell): Vec2 => {
  const [x, y] = at(v3(cell))
  return [x, y - PERSON_FEET]
}

export const WORKER_HOME: Cell = add(sites.shipper.doors[2]!, [0.9, 1.2])
export const RECEIVER_HOME: Cell = add(sites.consignee.doors[0]!, [-1.1, 1.3])

// ---------------------------------------------------------------------------------------------
// The network's faint links, between the masts

const LINKS: readonly (readonly [SiteId, SiteId])[] = [
  ['shipper', 'office'],
  ['office', 'consignee'],
  ['office', 'bank'],
  ['office', 'broker'],
  ['shipper', 'consignee'],
]

export const links: Figure = figureOf(
  'links',
  merge(
    ...LINKS.map(([a, b], i) => ({
      points: { [`link${i}A`]: sites[a].mast, [`link${i}B`]: sites[b].mast },
      edges: [[`link${i}A`, `link${i}B`] as const],
    })),
  ),
  'The trading-partner network',
  'link',
)

// ---------------------------------------------------------------------------------------------
// Placing things

const placed = (id: string, figure: Figure, cell: Cell, extra: Partial<Part> & { z?: number } = {}): Part => {
  const { z = 0, ...rest } = extra
  return { id, figure, at: at(v3(cell, z)), depth: depthOf(cell), ...rest }
}

/** A yard as a figure, so it can have its own id and depth. */
const yardFigure = (id: string, w: number, d: number, rules: number): Figure =>
  figureOf(id, yard(id, w, d, rules), 'A yard')

const treeAt = (id: string, cell: Cell, small = false): Part => placed(id, small ? treeSmall : tree, cell, { pose: 'rest' })

/** The far ground everything stands on: painted first, well behind anything else. */
const FAR = -1000

/**
 * Everything on the stage before anything moves, in one list. Depths come from cells, so the
 * list is not itself in paint order — `resolve` sorts it.
 */
export const stageParts: readonly Part[] = [
  { id: 'river', figure: river, depth: FAR + 1 },
  { id: 'road', figure: road, depth: FAR + 2 },
  { id: 'bridge', figure: bridge, depth: FAR + 3 },

  // Yards, flat on the ground in front of each dock.
  placed('shipperYard', yardFigure('shipperYard', 8.4, 4.2, 5), add(sites.shipper.cell, [0, 3.7]), { depth: FAR + 10 }),
  placed('hubYard', yardFigure('hubYard', 10, 4.2, 6), add(sites.hub.cell, [0, 3.95]), { depth: FAR + 11 }),
  placed('consigneeYard', yardFigure('consigneeYard', 7.4, 3.6, 4), add(sites.consignee.cell, [0.8, 3.4]), { depth: FAR + 12 }),

  // The broker and the bank, off the road at the back.
  placed('broker', brokerOffice, sites.broker.cell),
  placed('brokerMast', mast, add(sites.broker.cell, [BROKER_MAST_BASE[0], BROKER_MAST_BASE[1]]), { z: BROKER_MAST_BASE[2], depth: depthOf(sites.broker.cell) + 0.1 }),
  placed('bank', bank, sites.bank.cell),
  placed('bankMast', mast, add(sites.bank.cell, [BANK_MAST_BASE[0], BANK_MAST_BASE[1]]), { z: BANK_MAST_BASE[2], depth: depthOf(sites.bank.cell) + 0.1 }),
  placed('bankCoins', coinStack, add(sites.bank.cell, [2.4, 2.2]), { z: 0, depth: depthOf(sites.bank.cell) + 5, scale: 0.55 }),

  // The shipper.
  placed('shipper', shipperPlant, sites.shipper.cell),
  placed('shipperMast', mast, add(sites.shipper.cell, [SHIPPER_MAST_BASE[0], SHIPPER_MAST_BASE[1]]), { z: SHIPPER_MAST_BASE[2], depth: depthOf(sites.shipper.cell) + 0.1 }),
  ...sites.shipper.doors.map((door, i) => placed(`shipperDoor${i}`, dockDoor, door, { pose: 'closed', depth: depthOf(door) + 0.2 })),
  placed('shipperTrailer', parkedTrailer, add(sites.shipper.doors[2]!, [0, DOCK_GAP]), { depth: depthOf(sites.shipper.doors[2]!) + 0.5 }),

  // The carrier: the office tower behind, the crossdock on the road.
  placed('office', hubOffice, sites.office.cell),
  placed('officeMast', mast, add(sites.office.cell, [HUB_MAST_BASE[0], HUB_MAST_BASE[1]]), { z: HUB_MAST_BASE[2], depth: depthOf(sites.office.cell) + 0.1 }),
  placed('officeFlag', flag, add(sites.office.cell, [-1.9, 1.6]), { pose: 'a', depth: depthOf(sites.office.cell) + 0.3 }),
  placed('hub', hubCrossdock, sites.hub.cell),
  ...sites.hub.doors.map((door, i) => placed(`hubDoor${i}`, dockDoor, door, { pose: i === 2 ? 'open' : 'closed', depth: depthOf(door) + 0.2 })),
  ...[0, 1, 4].map((i) =>
    placed(`hubTrailer${i}`, parkedTrailer, add(sites.hub.doors[i]!, [0, DOCK_GAP]), { depth: depthOf(sites.hub.doors[i]!) + 0.5 }),
  ),

  // The consignee.
  placed('consignee', consigneeStore, sites.consignee.cell),
  placed('consigneeMast', mast, add(sites.consignee.cell, [CONSIGNEE_MAST_BASE[0], CONSIGNEE_MAST_BASE[1]]), { z: CONSIGNEE_MAST_BASE[2], depth: depthOf(sites.consignee.cell) + 0.1 }),
  ...sites.consignee.doors.map((door, i) => placed(`consigneeDoor${i}`, dockDoor, door, { pose: 'closed', depth: depthOf(door) + 0.2 })),

  // Trees: a stand along the river, a few by the back offices, a pair at the consignee.
  treeAt('tree0', [-19.5, -7.5]),
  treeAt('tree1', [-17.5, -8.5], true),
  treeAt('tree2', [-12.5, -3]),
  treeAt('tree3', [-8.5, 4.6]),
  treeAt('tree4', [-6.5, 8.5], true),
  treeAt('tree5', [-3, 11]),
  treeAt('tree6', [-1.5, 13.5], true),
  treeAt('tree7', [-24.5, -2.5]),
  treeAt('tree8', [-29.5, -3], true),
  treeAt('tree9', [11.5, -22.5]),
  treeAt('tree10', [0, -29.5], true),
  treeAt('tree11', [-8, -16], true),

  // The network, drawn over the ground but under everything in the air.
  { id: 'links', figure: links, depth: 900 },
]

// ---------------------------------------------------------------------------------------------
// The cast that moves

/** Depth for anything in the air: over every building. */
export const SKY = 1000

export const cast = {
  rig: (): Part => ({ id: 'rig', figure: rig, at: at(v3(RIG_BAY)), pose: 'y', depth: depthOf(RIG_BAY) + 0.6 }),
  van: (): Part => ({ id: 'van', figure: van, at: at(v3(along(0).cell)), pose: 'x', depth: along(0).depth, opacity: 0 }),
  shipperLift: (): Part => ({ id: 'shipperLift', figure: forklift, at: at(v3(SHIPPER_LIFT_WEST)), pose: 'xHigh', depth: depthOf(SHIPPER_LIFT_WEST) }),
  hubLift: (): Part => ({ id: 'hubLift', figure: forklift, at: at(v3(HUB_LIFT_HOME)), pose: 'yLow', depth: depthOf(HUB_LIFT_HOME) + 0.3 }),
  consigneeLift: (): Part => ({ id: 'consigneeLift', figure: forklift, at: at(v3(CONSIGNEE_LIFT_HOME)), pose: 'yLow', depth: depthOf(CONSIGNEE_LIFT_HOME) }),
  pallet: (): Part => {
    const [fx, fy, fz] = FORK_CENTRE('x', true)
    const cell: Cell = [SHIPPER_LIFT_WEST[0] + fx, SHIPPER_LIFT_WEST[1] + fy]
    return { id: 'pallet', figure: pallet, at: at([cell[0], cell[1], fz]), depth: depthOf(SHIPPER_LIFT_WEST) + 0.3 }
  },
  worker: (): Part => ({ id: 'worker', figure: person, at: standingAt(WORKER_HOME), scale: PERSON_SCALE, pose: 'idle', depth: depthOf(WORKER_HOME) + 0.4 }),
  receiver: (): Part => ({ id: 'receiver', figure: person, at: standingAt(RECEIVER_HOME), scale: PERSON_SCALE, pose: 'idle', depth: depthOf(RECEIVER_HOME) + 0.4 }),
  birds: (): Part => ({ id: 'birds', figure: birds, at: [-320, -150], pose: 'up', depth: SKY + 5, opacity: 0 }),
  cloudA: (): Part => ({ id: 'cloudA', figure: cloud, at: [-140, -156], scale: 1.6, depth: SKY - 50, opacity: 0.9 }),
  cloudB: (): Part => ({ id: 'cloudB', figure: cloud, at: [120, -140], scale: 1.1, depth: SKY - 50, opacity: 0.8 }),
  smoke: (i: number): Part => ({
    id: `smoke${i}`,
    figure: smokePuff,
    at: at([sites.shipper.cell[0] + SHIPPER_STACK_TOP[0], sites.shipper.cell[1] + SHIPPER_STACK_TOP[1], SHIPPER_STACK_TOP[2]]),
    depth: depthOf(sites.shipper.cell) + 0.5,
    opacity: 0,
    scale: 0.6,
  }),
  ripples: (i: number, cell: Cell): Part => ({ id: `ripples${i}`, figure: ripples, at: at(v3(cell)), pose: 'a', scale: 0.7, depth: FAR + 1.5 + i * 0.01, opacity: 0 }),
} as const

/** Where the ripple patches lie on the river. */
export const RIPPLE_CELLS: readonly Cell[] = [
  [-18, -7.2],
  [-12.2, -0.2],
  [-5.2, 7.8],
  [0, 13.5],
]

/** Where the smoke rises from, in scene units. */
export const STACK_TOP: Vec2 = at([
  sites.shipper.cell[0] + SHIPPER_STACK_TOP[0],
  sites.shipper.cell[1] + SHIPPER_STACK_TOP[1],
  SHIPPER_STACK_TOP[2],
])

