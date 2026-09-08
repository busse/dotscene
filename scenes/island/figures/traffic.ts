/**
 * Traffic, sky and creatures for the Island of Misfit Applications.
 *
 * The things that come and go: a biplane that never lands (the pilot that never ended),
 * the launch that brings and takes, and the sun, moon and stars that turn over the island.
 * And the small life that keeps a beach from ever being still — a crab, a gull, a turtle.
 *
 * Isometric things are authored centred on grid (0, 0) with their base at z 0 and moved by
 * the part. The vehicles carry one set of point names laid along either axis and either
 * way, so a heading change is a one-millisecond snap, as the EDI rig does it. Sky things
 * are flat, screen-facing sprites in plain scene units.
 */

import { defineFigure, ring, type EdgeSpec, type Figure, type PointMap, type PoseOverride, type Vec2, type Vec3 } from 'dotscene'
import { at, box, edge, pad } from '../../edi/projection.ts'
import { merge, tag, tone, type Shape } from '../../iso.ts'

type Axis = 'x' | 'y'
type Dir = 1 | -1

/** (along, across, z) → grid, for a thing travelling along `axis`, nose toward `dir`. */
const g =
  (axis: Axis, dir: Dir) =>
  (along: number, across: number, z: number): Vec3 =>
    axis === 'x' ? [along * dir, across, z] : [across, along * dir, z]

/** A footprint spanning `a0..a1` along the travel axis and `c0..c1` across it. */
const span =
  (axis: Axis, dir: Dir) =>
  (a0: number, c0: number, a1: number, c1: number): readonly [Vec2, Vec2] => {
    const lo = dir > 0 ? a0 : -a1
    const hi = dir > 0 ? a1 : -a0
    return axis === 'x'
      ? [
          [lo, c0],
          [hi, c1],
        ]
      : [
          [c0, lo],
          [c1, hi],
        ]
  }

/** Give a shape's faces one kind. */
const faced = (shape: Shape, kind: string): Shape => ({
  ...shape,
  faces: (shape.faces ?? []).map((f) => ({ ...f, kind })),
})

/** A figure from a shape, with poses. */
const figureWith = (name: string, title: string, shape: Shape, poses: Readonly<Record<string, PoseOverride>>): Figure =>
  defineFigure(name, {
    title,
    points: shape.points,
    edges: shape.edges,
    faces: shape.faces ?? [],
    ...(shape.kinds === undefined || Object.keys(shape.kinds).length === 0 ? {} : { pointKinds: shape.kinds }),
    ...(shape.layers === undefined || shape.layers.length < 2 ? {} : { layers: shape.layers.filter((l) => l.length > 0) }),
    poses,
  })

const kinded = (edges: readonly (readonly [string, string])[], kind: string): EdgeSpec[] =>
  edges.map(([from, to]) => ({ from, to, kind }))

const allKinds = (points: PointMap, kind: string): Record<string, string> =>
  Object.fromEntries(Object.keys(points).map((name) => [name, kind]))

const round2 = (n: number): number => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------------------------
// The plane

const FUSELAGE_HALF = 0.7
const FUSELAGE_ACROSS = 0.175
const FUSELAGE_TOP = 0.35
const WING_HALF = 0.9
const WING_ALONG: readonly [number, number] = [0.05, 0.3]
const LOWER_WING = 0.05
const UPPER_WING = 0.55
const NOSE = FUSELAGE_HALF + 0.05

interface PlaneOptions {
  readonly prop?: 'A' | 'B'
  /** 1 lifts the −across wingtips and drops the +across ones; −1 the reverse. */
  readonly bank?: 0 | 1 | -1
}

const planeShape = (axis: Axis, dir: Dir, options: PlaneOptions = {}): Shape => {
  const p = g(axis, dir)
  const s = span(axis, dir)
  const bank = (options.bank ?? 0) * 0.25

  const wing = (prefix: string, z: number): Shape => {
    const slab = faced(pad(prefix, ...s(WING_ALONG[0], -WING_HALF, WING_ALONG[1], WING_HALF), z), 'wing')
    if (bank === 0) return slab
    // Tips on the −across side rise by `bank`, tips on the +across side drop.
    const lifted: Record<string, Vec2> = {}
    for (const [name, [x, y]] of Object.entries(slab.points)) {
      // Recover the across coordinate to know which side a corner is on.
      const corner = name.slice(prefix.length)
      const side = axis === 'x' ? (corner === 'Far' || corner === 'East' ? -1 : 1) : dir > 0 ? (corner === 'Far' || corner === 'West' ? -1 : 1) : corner === 'East' || corner === 'Near' ? -1 : 1
      lifted[name] = [x, round2(y - side * -bank * 4)]
    }
    return { ...slab, points: lifted }
  }

  const strut = (name: string, across: number): Shape =>
    tag(
      edge(
        name,
        p((WING_ALONG[0] + WING_ALONG[1]) / 2, across, LOWER_WING + (across < 0 ? bank : -bank)),
        p((WING_ALONG[0] + WING_ALONG[1]) / 2, across, UPPER_WING + (across < 0 ? bank : -bank)),
      ),
      'soft',
    )

  const fin: Shape = tag(
    {
      points: {
        finFoot: at(p(-FUSELAGE_HALF, 0, FUSELAGE_TOP)),
        finTop: at(p(-FUSELAGE_HALF, 0, 0.8)),
        finLead: at(p(-FUSELAGE_HALF + 0.3, 0, FUSELAGE_TOP)),
      },
      edges: [
        ['finFoot', 'finTop'],
        ['finTop', 'finLead'],
      ],
    },
    'soft',
  )

  // A cross in the across–up plane at the nose; `B` is the same cross turned 45°.
  const r = 0.35
  const hub = FUSELAGE_TOP / 2
  const propPoints: Record<string, Vec2> =
    options.prop === 'B'
      ? {
          propUp: at(p(NOSE, r * 0.7, hub + r * 0.7)),
          propDown: at(p(NOSE, -r * 0.7, hub - r * 0.7)),
          propL: at(p(NOSE, -r * 0.7, hub + r * 0.7)),
          propR: at(p(NOSE, r * 0.7, hub - r * 0.7)),
        }
      : {
          propUp: at(p(NOSE, 0, hub + r)),
          propDown: at(p(NOSE, 0, hub - r)),
          propL: at(p(NOSE, -r, hub)),
          propR: at(p(NOSE, r, hub)),
        }
  const prop: Shape = tag(
    {
      points: propPoints,
      edges: [
        ['propUp', 'propDown'],
        ['propL', 'propR'],
      ],
    },
    'soft',
  )

  return merge(
    wing('wingLow', LOWER_WING),
    box('body', ...s(-FUSELAGE_HALF, -FUSELAGE_ACROSS, FUSELAGE_HALF, FUSELAGE_ACROSS), FUSELAGE_TOP, 0),
    fin,
    strut('strutL', -WING_HALF),
    strut('strutR', WING_HALF),
    wing('wingHigh', UPPER_WING),
    prop,
  )
}

const planeX = planeShape('x', 1)

/** Where a towed banner attaches: the tail, for the x heading. */
export const PLANE_TAIL: Vec3 = [-FUSELAGE_HALF - 0.05, 0, 0.3]

/**
 * The pilot that never ended. Headings `x`, `xr`, `y`, `yr`; on the x heading the propeller
 * can turn (`xPropB`) and the wings can bank (`xBankL`, `xBankR`). Fly it by `at`.
 */
export const plane = figureWith('plane', 'A biplane that never lands', planeX, {
  x: {},
  xr: planeShape('x', -1).points,
  y: planeShape('y', 1).points,
  yr: planeShape('y', -1).points,
  xPropB: planeShape('x', 1, { prop: 'B' }).points,
  xBankL: planeShape('x', 1, { bank: 1 }).points,
  xBankR: planeShape('x', 1, { bank: -1 }).points,
})

// ---------------------------------------------------------------------------------------------
// The banner it tows

const BANNER_W = 22
const BANNER_H = 5

const bannerPoints = (flap: number): Record<string, Vec2> => ({
  tl: [0, -BANNER_H / 2],
  bl: [0, BANNER_H / 2],
  tr: [BANNER_W, -BANNER_H / 2 + flap],
  mr: [BANNER_W + 0.6, -flap],
  br: [BANNER_W, BANNER_H / 2 + flap],
  ruleA1: [3, -1.3],
  ruleA2: [15, -1.3],
  ruleB1: [3, 0],
  ruleB2: [17, 0],
  ruleC1: [3, 1.3],
  ruleC2: [13, 1.3],
})

const trailing = (flap: number): PoseOverride => {
  const p = bannerPoints(flap)
  return { tr: p.tr!, mr: p.mr!, br: p.br! }
}

const bannerRest = bannerPoints(0)

/** A towed banner, its left edge at the origin so it hangs off a tail. Three rules as if text. */
export const banner = defineFigure('banner', {
  title: 'A banner towed behind the plane',
  points: bannerRest,
  edges: [
    ...kinded(
      [
        ['tl', 'tr'],
        ['tr', 'mr'],
        ['mr', 'br'],
        ['br', 'bl'],
        ['bl', 'tl'],
        ['ruleA1', 'ruleA2'],
        ['ruleB1', 'ruleB2'],
        ['ruleC1', 'ruleC2'],
      ],
      'soft',
    ),
  ],
  faces: [{ points: ['tl', 'tr', 'mr', 'br', 'bl'], kind: 'banner' }],
  pointKinds: allKinds(bannerRest, 'soft'),
  poses: {
    a: trailing(0.8),
    b: trailing(-0.8),
    c: trailing(0.2),
  },
})

// ---------------------------------------------------------------------------------------------
// The boat

const HULL_HALF = 1.5
const HULL_ACROSS = 0.55
const HULL_BASE = -0.3
const DECK = 0.3
const MAST_ALONG = -0.35
const MAST_TOP = 2.0

const boatShape = (dir: Dir): Shape => {
  const p = g('x', dir)
  const s = span('x', dir)
  const hull = box('hull', ...s(-HULL_HALF, -HULL_ACROSS, HULL_HALF, HULL_ACROSS), DECK, HULL_BASE)
  const sided = {
    ...hull,
    faces: (hull.faces ?? []).map((f) => ({ ...f, kind: f.kind === 'roof' ? 'roof' : 'hull' })),
  }
  const house = tone(box('house', ...s(0.35, -0.45, 1.25, 0.45), DECK + 0.7, DECK), 'blue')
  const mast = merge(
    tag(edge('mast', p(MAST_ALONG, 0, DECK), p(MAST_ALONG, 0, MAST_TOP)), 'soft'),
    tag(lanternRing(p, MAST_ALONG), 'blue'),
  )
  // The bow: its own two deck points (the hull's corners again, by another name) so the
  // edges hold whichever way the boat faces.
  const bow: Shape = {
    points: {
      bow: at(p(HULL_HALF + 0.35, 0, DECK)),
      bowL: at(p(HULL_HALF, -HULL_ACROSS, DECK)),
      bowR: at(p(HULL_HALF, HULL_ACROSS, DECK)),
    },
    edges: [
      ['bowL', 'bow'],
      ['bow', 'bowR'],
    ],
  }
  return merge(sided, bow, house, mast)
}

const lanternRing = (p: (a: number, c: number, z: number) => Vec3, along: number): Shape => {
  const names = Array.from({ length: 6 }, (_u, i) => `lamp${i}`)
  return {
    points: Object.fromEntries(
      names.map((n, i) => {
        const a = (i / 6) * Math.PI * 2
        return [n, at(p(along + Math.cos(a) * 0.15, Math.sin(a) * 0.15, MAST_TOP))]
      }),
    ),
    edges: names.map((n, i) => [n, names[(i + 1) % 6]!] as const),
    faces: [{ points: names, kind: 'lamp' }],
  }
}

const boatX = boatShape(1)

/** The lantern at the masthead, for the x heading — where a light comes on at dusk. */
export const BOAT_LANTERN: Vec3 = [MAST_ALONG, 0, MAST_TOP]

/** The launch. `x` bow to +x, `xr` bow to −x, one set of names. */
export const boat = figureWith('boat', 'The island launch', boatX, {
  x: {},
  xr: boatShape(-1).points,
})

/** Three dashes trailing a boat's stern (behind it for the x heading; `r` poses for `xr`). */
const wakePoints = (dir: Dir, step: number): Record<string, Vec2> => {
  const out: Record<string, Vec2> = {}
  ;[0, 1, 2].forEach((i) => {
    const along = -(HULL_HALF + 0.35 + i * 0.5 + step * 0.17) * dir
    const spread = 0.28 + i * 0.1 + (step === 1 ? 0.05 : 0)
    out[`wake${i}A`] = at([along, -spread, 0])
    out[`wake${i}B`] = at([along, spread, 0])
  })
  return out
}

const wakeRest = wakePoints(1, 0)
export const wake = defineFigure('wake', {
  title: 'A wake',
  points: wakeRest,
  edges: kinded(
    [0, 1, 2].map((i) => [`wake${i}A`, `wake${i}B`] as const),
    'sea',
  ),
  pointKinds: allKinds(wakeRest, 'sea'),
  poses: {
    a: {},
    b: wakePoints(1, 1),
    c: wakePoints(1, 2),
    ra: wakePoints(-1, 0),
    rb: wakePoints(-1, 1),
    rc: wakePoints(-1, 2),
  },
})

// ---------------------------------------------------------------------------------------------
// Sky

const sunDisc = ring('s', [0, 0], 9, 10)
const rays: Record<string, Vec2> = {}
const rayEdges: (readonly [string, string])[] = []
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2
  rays[`ray${i}A`] = [round2(Math.cos(a) * 12), round2(Math.sin(a) * 12)]
  rays[`ray${i}B`] = [round2(Math.cos(a) * 14), round2(Math.sin(a) * 14)]
  rayEdges.push([`ray${i}A`, `ray${i}B`])
}

/** The sun: a filled disc and eight short rays. */
export const sun = defineFigure('sun', {
  title: 'The sun',
  points: { ...sunDisc.points, ...rays },
  edges: kinded([...sunDisc.edges, ...rayEdges], 'sun'),
  faces: [{ points: Object.keys(sunDisc.points), kind: 'sun' }],
  pointKinds: allKinds({ ...sunDisc.points, ...rays }, 'sun'),
})

/** A crescent: the left of a ring of 8, closed by an inner arc pushed to the right. */
const moonPoints: Record<string, Vec2> = (() => {
  const out: Record<string, Vec2> = {}
  const outer = [-90, -135, 180, 135, 90]
  outer.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180
    out[`o${i}`] = [round2(Math.cos(a) * 7), round2(Math.sin(a) * 7)]
  })
  const inner = [-100, -140, 180, 140, 100]
  inner.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180
    out[`i${i}`] = [round2(2.6 + Math.cos(a) * 5.4), round2(Math.sin(a) * 5.4)]
  })
  return out
})()

export const moon = defineFigure('moon', {
  title: 'The moon',
  points: moonPoints,
  edges: kinded(
    [
      ['o0', 'o1'],
      ['o1', 'o2'],
      ['o2', 'o3'],
      ['o3', 'o4'],
      ['o4', 'i4'],
      ['i4', 'i3'],
      ['i3', 'i2'],
      ['i2', 'i1'],
      ['i1', 'i0'],
      ['i0', 'o0'],
    ],
    'soft',
  ),
  faces: [{ points: ['o0', 'o1', 'o2', 'o3', 'o4', 'i4', 'i3', 'i2', 'i1', 'i0'], kind: 'moon' }],
  pointKinds: allKinds(moonPoints, 'soft'),
})

const STAR_FIELD: readonly Vec2[] = [
  [-28, -10],
  [-19, 4],
  [-12, -9],
  [-3, 8],
  [2, -11],
  [9, 2],
  [16, -6],
  [23, 10],
  [29, -2],
]
const starPoints = (twinkle: boolean): Record<string, Vec2> =>
  Object.fromEntries(
    STAR_FIELD.map(([x, y], i) => [`star${i}`, twinkle && i % 3 === 1 ? [round2(x + 0.4), round2(y - 0.4)] : [x, y]]),
  )

/** Nine stars over sixty by twenty-four. Three of them twinkle between `a` and `b`. */
export const stars = defineFigure('stars', {
  title: 'Stars',
  points: starPoints(false),
  edges: [],
  pointKinds: allKinds(starPoints(false), 'star'),
  poses: { a: {}, b: starPoints(true) },
})

// ---------------------------------------------------------------------------------------------
// Creatures

/** A beach crab, scuttling along x. Front is +y. */
const crabPoints = (step: 0 | 1): Record<string, Vec2> => {
  const out: Record<string, Vec2> = {}
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    out[`shell${i}`] = at([Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.15])
  }
  const open = step === 0 ? 0.08 : 0
  out.clawLBase = at([-0.15, 0.2, 0.15])
  out.clawLTip = at([-0.22 - open, 0.46, 0.2])
  out.clawRBase = at([0.15, 0.2, 0.15])
  out.clawRTip = at([0.22 + open, 0.46, 0.2])
  ;[-0.14, 0, 0.14].forEach((y, i) => {
    const swing = (i % 2 === 0 ? 1 : -1) * (step === 0 ? 0.06 : -0.06)
    out[`legL${i}Base`] = at([-0.16, y, 0.12])
    out[`legL${i}Tip`] = at([-0.42, y + swing, 0])
    out[`legR${i}Base`] = at([0.16, y, 0.12])
    out[`legR${i}Tip`] = at([0.42, y - swing, 0])
  })
  return out
}

const crabRest = crabPoints(0)
export const crab = defineFigure('crab', {
  title: 'A crab',
  points: crabRest,
  edges: kinded(
    [
      ...Array.from({ length: 6 }, (_u, i) => [`shell${i}`, `shell${(i + 1) % 6}`] as const),
      ['clawLBase', 'clawLTip'],
      ['clawRBase', 'clawRTip'],
      ...[0, 1, 2].flatMap((i) => [[`legL${i}Base`, `legL${i}Tip`] as const, [`legR${i}Base`, `legR${i}Tip`] as const]),
    ],
    'soft',
  ),
  faces: [{ points: Array.from({ length: 6 }, (_u, i) => `shell${i}`), kind: 'shell' }],
  pointKinds: allKinds(crabRest, 'soft'),
  poses: { a: {}, b: crabPoints(1) },
})

/** One gull: two strokes meeting at the body. */
export const gull = defineFigure('gull', {
  title: 'A gull',
  points: { wingL: [-1.7, -0.7], body: [0, 0], wingR: [1.7, -0.7] },
  edges: kinded(
    [
      ['wingL', 'body'],
      ['body', 'wingR'],
    ],
    'soft',
  ),
  pointKinds: { wingL: 'soft', body: 'soft', wingR: 'soft' },
  poses: {
    up: {},
    down: { wingL: [-1.7, 0.6], wingR: [1.7, 0.6] },
  },
})

const splashRing = ring('sp', [0, 0], 2, 8)
const splashPoints: Record<string, Vec2> = {
  ...splashRing.points,
  drop0: [-2.4, -3],
  drop1: [-0.8, -4.2],
  drop2: [0.8, -4.4],
  drop3: [2.4, -3.2],
}

/** A splash: a ring on the water and four droplets over it. Scale and fade it. */
export const splash = defineFigure('splash', {
  title: 'A splash',
  points: splashPoints,
  edges: kinded(splashRing.edges, 'sea'),
  pointKinds: allKinds(splashPoints, 'sea'),
})

/** A sea turtle from above, head to +x. Flippers sweep between `a` and `b`. */
const turtlePoints = (sweep: boolean): Record<string, Vec2> => {
  const out: Record<string, Vec2> = {}
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    out[`carapace${i}`] = at([Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.05])
  }
  out.head = at([0.44, 0, 0.05])
  const front = sweep ? [0.12, 0.34] : [0.46, 0.5]
  const rear = sweep ? [-0.32, 0.42] : [-0.45, 0.36]
  out.flipFLBase = at([0.18, -0.26, 0.05])
  out.flipFLTip = at([front[0]!, -front[1]!, 0.05])
  out.flipFRBase = at([0.18, 0.26, 0.05])
  out.flipFRTip = at([front[0]!, front[1]!, 0.05])
  out.flipRLBase = at([-0.2, -0.24, 0.05])
  out.flipRLTip = at([rear[0]!, -rear[1]!, 0.05])
  out.flipRRBase = at([-0.2, 0.24, 0.05])
  out.flipRRTip = at([rear[0]!, rear[1]!, 0.05])
  return out
}

const turtleRest = turtlePoints(false)
export const turtle = defineFigure('turtle', {
  title: 'A turtle',
  points: turtleRest,
  edges: kinded(
    [
      ...Array.from({ length: 6 }, (_u, i) => [`carapace${i}`, `carapace${(i + 1) % 6}`] as const),
      ['carapace0', 'head'],
      ['flipFLBase', 'flipFLTip'],
      ['flipFRBase', 'flipFRTip'],
      ['flipRLBase', 'flipRLTip'],
      ['flipRRBase', 'flipRRTip'],
    ],
    'soft',
  ),
  faces: [{ points: Array.from({ length: 6 }, (_u, i) => `carapace${i}`), kind: 'shell' }],
  pointKinds: allKinds(turtleRest, 'soft'),
  poses: { a: {}, b: turtlePoints(true) },
})
