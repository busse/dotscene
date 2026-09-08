/**
 * The island itself, and what grows on it.
 *
 * The land is drawn in (u, v) — u across the frame, v far to near — because a coastline is
 * not a grid thing; `point` projects it. Everything else is authored at the grid origin with
 * its base at z = 0 and placed by translating the part. Whimsy is the register: a lumpy
 * tropical island with a bay on the left and a rocky point on the right, palms that lean,
 * bushes like scoops of ice cream.
 */

import { defineFigure, type PoseOverride, type Vec2 } from 'dotscene'
import { at, point } from '../../edi/projection.ts'
import { figureOf, merge, tag, type Shape } from '../../iso.ts'

export type UV = readonly [number, number]

// ---------------------------------------------------------------------------------------------
// The land: three lumpy polygons, shelf under beach under grass

/** The beach's outline, clockwise from the top-left, with the bay notched into the left. */
const BEACH_RIM: readonly UV[] = [
  [-14, -5],
  [-8, -8.5],
  [-1, -10],
  [6, -9],
  [12, -7],
  [16.5, -4],
  [17.2, 0],
  [14, 4],
  [9, 7.5],
  [2, 9.5],
  [-5, 9],
  [-11, 6.5],
  [-15, 3.5],
  [-11.5, 1.6],
  [-10.5, 0],
  [-11.5, -1.6],
  [-15, -3.2],
]

const centroid = (rim: readonly UV[]): UV => [
  rim.reduce((s, p) => s + p[0], 0) / rim.length,
  rim.reduce((s, p) => s + p[1], 0) / rim.length,
]

/** The rim scaled about its centroid, with a little jitter so the layers are not concentric. */
const scaled = (rim: readonly UV[], k: number, wobble: number): readonly UV[] => {
  const [cu, cv] = centroid(rim)
  return rim.map(([u, v], i) => {
    const w = Math.sin(i * 2.399) * wobble
    return [Math.round((cu + (u - cu) * (k + w)) * 100) / 100, Math.round((cv + (v - cv) * (k + w)) * 100) / 100]
  })
}

const polygon = (prefix: string, rim: readonly UV[], edgeKind: string, faceKind: string): Shape => {
  const names = rim.map((_p, i) => `${prefix}${i}`)
  const points: Record<string, Vec2> = {}
  rim.forEach(([u, v], i) => {
    points[names[i]!] = point(u, v)
  })
  return tag(
    {
      points,
      edges: names.map((n, i) => [n, names[(i + 1) % names.length]!] as const),
      faces: [{ points: names, kind: faceKind }],
    },
    edgeKind,
  )
}

/** Shallow water round the shore, the beach, the green interior — painted in that order. */
export const island = figureOf(
  'island',
  merge(
    polygon('shelf', scaled(BEACH_RIM, 1.14, 0.03), 'sea', 'sea'),
    polygon('beach', BEACH_RIM, 'sand', 'sand'),
    polygon('grass', scaled(BEACH_RIM, 0.72, 0.04), 'foliage', 'grass'),
  ),
  'The island',
)

/** The bay's water edge, on the left, where the dock goes. */
export const BAY: UV = [-12.5, 0]
/** The rocky point on the right, where the lighthouse stands. */
export const POINT: UV = [14.5, -2]
/** Four places on the beach where something can stand, from the bay toward the point. */
export const BEACH: readonly UV[] = [
  [-10.5, 4.6],
  [-4, 8.2],
  [4, 8.3],
  [12, 5.2],
]
/** Inland, between two palms. */
export const HAMMOCK_SPOT: UV = [2, -3]

// ---------------------------------------------------------------------------------------------
// Rocks

/** A boulder: a lumpy footprint and a low summit, faced so it reads as a mound. */
const boulder = (prefix: string, cx: number, cy: number, r: number, top: number, seed: number): Shape => {
  const sides = 5
  const rim: string[] = []
  const points: Record<string, Vec2> = {}
  for (let i = 0; i < sides; i++) {
    const a = ((i + 0.5) / sides) * Math.PI * 2
    const k = r * (0.75 + 0.35 * Math.abs(Math.sin(seed + i * 1.7)))
    const name = `${prefix}${i}`
    rim.push(name)
    points[name] = at([cx + Math.cos(a) * k, cy + Math.sin(a) * k * 0.9, 0])
  }
  points[`${prefix}Top`] = at([cx + 0.1, cy + 0.05, top])
  // Rim order runs anticlockwise in grid space; the visible summit spokes go to the near
  // three rim points (largest x + y).
  const near = [...rim].sort((a, b) => points[b]![0] + points[b]![1] * 2 - (points[a]![0] + points[a]![1] * 2)).slice(0, 3)
  return {
    points,
    edges: [
      ...rim.map((n, i) => [n, rim[(i + 1) % sides]!] as const),
      ...near.map((n) => ({ from: `${prefix}Top`, to: n, kind: 'soft' })),
    ],
    faces: [
      { points: rim, kind: 'rock' },
      ...rim.map((n, i) => ({ points: [`${prefix}Top`, n, rim[(i + 1) % sides]!], kind: 'rock' })),
    ],
  }
}

export const rocks = figureOf(
  'rocks',
  merge(
    boulder('rockA', -1.2, -0.4, 0.75, 0.55, 1),
    boulder('rockB', 0.3, -0.9, 0.9, 0.75, 4),
    boulder('rockC', 1.1, 0.5, 0.65, 0.5, 7),
    boulder('rockD', -0.3, 0.9, 0.55, 0.4, 2),
  ),
  'Rocks on the point',
)

// ---------------------------------------------------------------------------------------------
// Palms

/**
 * A coconut palm: a trunk that leans a little as it climbs, a crown, five fronds that rise
 * and droop, two coconuts. Sway moves the crown and the fronds; the trunk's top follows a
 * little and its foot not at all.
 */
const palmFigure = (name: string, title: string, height: number, span: number) => {
  const lean = 0.11 * height
  const trunk: readonly [number, number, number][] = [
    [0, 0, 0],
    [lean * 0.25, 0, height * 0.36],
    [lean * 0.65, 0, height * 0.7],
    [lean, 0, height],
  ]
  const crown: [number, number, number] = [lean, 0, height]
  // Five fronds fanning round the crown; each rises to a mid point and droops to a tip.
  const angles = [-0.35, 0.95, 2.2, 3.5, 4.75]
  const frondPoints = (dx: number, dz: number): Record<string, Vec2> => {
    const out: Record<string, Vec2> = {}
    angles.forEach((a, i) => {
      const ux = Math.cos(a)
      const uy = Math.sin(a)
      out[`f${i}m`] = at([crown[0] + dx + ux * span * 0.45, crown[1] + uy * span * 0.45, crown[2] + dz + 0.35])
      out[`f${i}t`] = at([crown[0] + dx + ux * span, crown[1] + uy * span, crown[2] + dz - 0.55])
    })
    return out
  }
  const base: Record<string, Vec2> = {
    t0: at(trunk[0]!),
    t1: at(trunk[1]!),
    t2: at(trunk[2]!),
    crown: at(crown),
    nutA: at([crown[0] + 0.18, crown[1] - 0.12, crown[2] - 0.45]),
    nutB: at([crown[0] + 0.32, crown[1] + 0.1, crown[2] - 0.6]),
    ...frondPoints(0, 0),
  }
  const sway = (dx: number): PoseOverride => ({
    t2: at([trunk[2]![0] + dx * 0.4, 0, trunk[2]![2]]),
    crown: at([crown[0] + dx, crown[1], crown[2]]),
    nutA: at([crown[0] + dx + 0.18, crown[1] - 0.12, crown[2] - 0.45]),
    nutB: at([crown[0] + dx + 0.32, crown[1] + 0.1, crown[2] - 0.6]),
    ...frondPoints(dx * 2.2, -0.08),
  })
  return defineFigure(name, {
    title,
    points: base,
    edges: [
      { from: 't0', to: 't1', kind: 'trunk' },
      { from: 't1', to: 't2', kind: 'trunk' },
      { from: 't2', to: 'crown', kind: 'trunk' },
      ...angles.flatMap((_a, i) => [
        { from: 'crown', to: `f${i}m`, kind: 'foliage' },
        { from: `f${i}m`, to: `f${i}t`, kind: 'foliage' },
      ]),
    ],
    pointKinds: {
      t0: 'trunk',
      t1: 'trunk',
      t2: 'trunk',
      crown: 'foliage',
      nutA: 'soft',
      nutB: 'soft',
      ...Object.fromEntries(angles.flatMap((_a, i) => [[`f${i}m`, 'foliage'], [`f${i}t`, 'foliage']])),
    },
    poses: { rest: {}, swayA: sway(0.09), swayB: sway(-0.09) },
  })
}

export const palm = palmFigure('palm', 'A coconut palm', 5, 2)
export const palmSmall = palmFigure('palmSmall', 'A young palm', 3.5, 1.5)

// ---------------------------------------------------------------------------------------------
// Bushes

const bushShape = (prefix: string, r = 0.6): Shape => {
  const names: string[] = []
  const points: Record<string, Vec2> = {}
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * Math.PI * 2
    const name = `${prefix}${i}`
    names.push(name)
    points[name] = at([Math.cos(a) * r, Math.sin(a) * r, 0.5])
  }
  points[`${prefix}Top`] = at([0, 0, 0.9])
  // Far faces first so the near ones paint over them.
  const order = [3, 4, 5, 0, 1, 2]
  return tag(
    {
      points,
      edges: [
        ...names.map((n, i) => [n, names[(i + 1) % 6]!] as const),
        [`${prefix}Top`, names[0]!],
        [`${prefix}Top`, names[1]!],
        [`${prefix}Top`, names[5]!],
      ],
      faces: order.map((i) => ({ points: [`${prefix}Top`, names[i]!, names[(i + 1) % 6]!], kind: 'foliage' })),
    },
    'foliage',
  )
}

export const bush = figureOf('bush', bushShape('b'), 'A bush')

export const flowers = figureOf(
  'flowers',
  merge(
    bushShape('b'),
    tag(
      {
        points: {
          flA: at([0.25, -0.2, 0.95]),
          flB: at([-0.3, 0.15, 0.85]),
          flC: at([0.05, 0.4, 0.8]),
        },
        edges: [],
      },
      'soft',
    ),
  ),
  'A flowering bush',
)
