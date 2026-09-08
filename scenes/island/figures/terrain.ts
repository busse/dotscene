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
 * A coconut palm: a trunk that curves as it climbs, a crown, and seven fronds drawn as leaf
 * shapes — each a thin face from the crown out to a drooping tip — so the crown reads as
 * foliage rather than a set of legs. Sway moves the crown and the fronds; the trunk's top
 * follows a little and its foot not at all.
 */
const palmFigure = (name: string, title: string, height: number, span: number) => {
  const lean = 0.11 * height
  const trunk: readonly [number, number, number][] = [
    [0, 0, 0],
    [lean * 0.18, 0, height * 0.28],
    [lean * 0.45, 0, height * 0.55],
    [lean * 0.75, 0, height * 0.8],
    [lean, 0, height],
  ]
  const crown = trunk[4]!
  const angles = [0.15, 1.05, 1.95, 2.85, 3.75, 4.65, 5.55]
  const frondPoints = (dx: number, dz: number): Record<string, Vec2> => {
    const out: Record<string, Vec2> = {}
    angles.forEach((a, i) => {
      const ux = Math.cos(a)
      const uy = Math.sin(a)
      const px = -uy
      const py = ux
      const mid = 0.5
      const half = 0.15
      out[`f${i}l`] = at([crown[0] + dx * 0.6 + ux * span * mid + px * span * half, crown[1] + uy * span * mid + py * span * half, crown[2] + dz * 0.6 + 0.42])
      out[`f${i}r`] = at([crown[0] + dx * 0.6 + ux * span * mid - px * span * half, crown[1] + uy * span * mid - py * span * half, crown[2] + dz * 0.6 + 0.42])
      out[`f${i}t`] = at([crown[0] + dx + ux * span, crown[1] + uy * span, crown[2] + dz - 0.9])
    })
    return out
  }
  const nuts = (dx: number): Record<string, Vec2> => ({
    nutA: at([crown[0] + dx + 0.16, crown[1] - 0.1, crown[2] - 0.4]),
    nutB: at([crown[0] + dx + 0.28, crown[1] + 0.1, crown[2] - 0.52]),
  })
  const base: Record<string, Vec2> = {
    t0: at(trunk[0]!),
    t1: at(trunk[1]!),
    t2: at(trunk[2]!),
    t3: at(trunk[3]!),
    crown: at(crown),
    ...nuts(0),
    ...frondPoints(0, 0),
  }
  const sway = (dx: number): PoseOverride => ({
    t3: at([trunk[3]![0] + dx * 0.4, 0, trunk[3]![2]]),
    crown: at([crown[0] + dx, crown[1], crown[2]]),
    ...nuts(dx),
    ...frondPoints(dx * 2.2, -0.1),
  })
  // Far fronds first, so the near ones paint over them.
  const order = angles.map((_a, i) => i).sort((i, j) => Math.cos(angles[i]!) + Math.sin(angles[i]!) - (Math.cos(angles[j]!) + Math.sin(angles[j]!)))
  return defineFigure(name, {
    title,
    points: base,
    edges: [
      { from: 't0', to: 't1', kind: 'trunk' },
      { from: 't1', to: 't2', kind: 'trunk' },
      { from: 't2', to: 't3', kind: 'trunk' },
      { from: 't3', to: 'crown', kind: 'trunk' },
      ...order.flatMap((i) => [
        { from: 'crown', to: `f${i}l`, kind: 'frond' },
        { from: `f${i}l`, to: `f${i}t`, kind: 'frond' },
        { from: `f${i}t`, to: `f${i}r`, kind: 'frond' },
        { from: `f${i}r`, to: 'crown', kind: 'frond' },
      ]),
    ],
    faces: order.map((i) => ({ points: ['crown', `f${i}l`, `f${i}t`, `f${i}r`], kind: 'foliage' })),
    pointKinds: {
      t0: 'trunk',
      t1: 'trunk',
      t2: 'trunk',
      t3: 'trunk',
      crown: 'frond',
      nutA: 'soft',
      nutB: 'soft',
      ...Object.fromEntries(angles.flatMap((_a, i) => [[`f${i}l`, 'frond'], [`f${i}r`, 'frond'], [`f${i}t`, 'frond']])),
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
