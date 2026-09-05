/**
 * The messages themselves, and the small things that travel with them.
 *
 * None of this is isometric. A message is information *about* the freight rather than part of
 * the world, so it is drawn flat and screen-facing, in plain scene units, centred on the
 * origin, and floats above the yards. Everything here is sized for a camera that zooms: an
 * envelope seven units wide is a speck in the wide shot and a clear icon at a hundred and
 * twenty units across, and dots keep their pixel size as the camera moves, so nothing may put
 * two points closer than about 1.2 units or they pile into a blob.
 */

import { defineFigure, ring, type EdgeSpec, type Figure, type PointMap, type Vec2 } from 'dotscene'

/** Every edge of a shape given one role, so a figure can be coloured by what it is. */
const kinded = (edges: readonly (readonly [string, string])[], kind: string): EdgeSpec[] =>
  edges.map(([from, to]) => ({ from, to, kind }))

const allKinds = (points: PointMap, kind: string): Record<string, string> =>
  Object.fromEntries(Object.keys(points).map((name) => [name, kind]))

// ---------------------------------------------------------------------------------------------
// Envelope

/** Width and height of the closed envelope, in scene units. */
export const ENVELOPE_SIZE: Vec2 = [7, 4.6]

const [EW, EH] = ENVELOPE_SIZE

const envelopePoints: PointMap = {
  topL: [-EW / 2, -EH / 2],
  topR: [EW / 2, -EH / 2],
  botR: [EW / 2, EH / 2],
  botL: [-EW / 2, EH / 2],
  /** Where the flap's point rests, 1.4 above the centre. */
  flap: [0, -1.4],
}

/**
 * A closed envelope: the rectangle, and the V of its flap.
 *
 * `open` lifts the flap point clear of the top edge, which is all it takes for the same six
 * points to read as an opened letter — the two flap edges fold up over the top.
 */
export const envelope = defineFigure('envelope', {
  title: 'A message',
  points: envelopePoints,
  edges: [
    ...kinded(
      [
        ['topL', 'topR'],
        ['topR', 'botR'],
        ['botR', 'botL'],
        ['botL', 'topL'],
      ],
      'token',
    ),
    ...kinded(
      [
        ['topL', 'flap'],
        ['topR', 'flap'],
      ],
      'soft',
    ),
  ],
  faces: [{ points: ['topL', 'topR', 'botR', 'botL'], kind: 'paper' }],
  pointKinds: allKinds(envelopePoints, 'token'),
  poses: {
    closed: {},
    open: { flap: [0, -3.6] },
  },
})

// ---------------------------------------------------------------------------------------------
// Badges — what kind of message this is, sitting on the envelope's lower-right corner

export type BadgeKind = 'check' | 'coin' | 'pin' | 'box' | 'doc'

interface Shape {
  readonly points: PointMap
  readonly edges: readonly (readonly [string, string])[]
  readonly faces?: readonly { readonly points: readonly string[]; readonly kind?: string }[]
}

/** A tick: short down-stroke, long up-stroke. */
const checkShape: Shape = {
  points: { a: [-1.2, 0.1], b: [-0.3, 1.0], c: [1.2, -1.0] },
  edges: [
    ['a', 'b'],
    ['b', 'c'],
  ],
}

/** A coin seen face on: a ring with a short bar, the way a currency sign is a stroke. */
const coinBadgeShape: Shape = (() => {
  const r = ring('r', [0, 0], 1.1, 8)
  return {
    points: { ...r.points, barT: [0, -0.5], barB: [0, 0.5] },
    edges: [...r.edges, ['barT', 'barB']],
    faces: [{ points: Object.keys(r.points), kind: 'coin' }],
  }
})()

/** A location pin: a ring resting on a point below it. */
const pinShape: Shape = (() => {
  const r = ring('r', [0, -0.6], 0.9, 6)
  return {
    points: { ...r.points, tip: [0, 1.6] },
    // Ring of six drawn from the top: r2 and r4 are the lower-right and lower-left shoulders.
    edges: [...r.edges, ['r2', 'tip'], ['r4', 'tip']],
  }
})()

/** A tiny cube: a hexagon outline with the three visible edges meeting at its centre. */
const boxShape: Shape = (() => {
  const r = ring('h', [0, 0], 1.3, 6, -90)
  return {
    points: { ...r.points, c: [0, 0] },
    // Spokes to the top, lower-right and lower-left vertices: an isometric cube's inner edges.
    edges: [...r.edges, ['c', 'h0'], ['c', 'h2'], ['c', 'h4']],
  }
})()

/** A small page with one rule across it. */
const docShape: Shape = {
  points: {
    tl: [-0.9, -1.2],
    tr: [0.9, -1.2],
    br: [0.9, 1.2],
    bl: [-0.9, 1.2],
    ruleL: [-0.5, 0.3],
    ruleR: [0.5, 0.3],
  },
  edges: [
    ['tl', 'tr'],
    ['tr', 'br'],
    ['br', 'bl'],
    ['bl', 'tl'],
    ['ruleL', 'ruleR'],
  ],
}

const badgeShapes: Readonly<Record<BadgeKind, { readonly shape: Shape; readonly title: string }>> = {
  check: { shape: checkShape, title: 'Acknowledged' },
  coin: { shape: coinBadgeShape, title: 'Money' },
  pin: { shape: pinShape, title: 'A location' },
  box: { shape: boxShape, title: 'Freight' },
  doc: { shape: docShape, title: 'A document' },
}

const badgeName = (kind: BadgeKind): string => `badge${kind[0]!.toUpperCase()}${kind.slice(1)}`

/**
 * A badge about 2.4 units across, centred on the origin. Place it on the envelope's
 * lower-right corner — `ENVELOPE_SIZE` halved — and it reads as a mark on the letter.
 */
export const badge = (kind: BadgeKind, id = badgeName(kind)): Figure => {
  const { shape, title } = badgeShapes[kind]
  return defineFigure(id, {
    title,
    points: shape.points,
    edges: kinded(shape.edges, 'token'),
    faces: shape.faces ?? [],
    pointKinds: allKinds(shape.points, 'token'),
  })
}

export const badgeCheck = badge('check')
export const badgeCoin = badge('coin')
export const badgePin = badge('pin')
export const badgeBox = badge('box')
export const badgeDoc = badge('doc')

// ---------------------------------------------------------------------------------------------
// Digits

/** Cell of one digit, in scene units. */
export const DIGIT_SIZE: Vec2 = [2, 3.6]

/**
 * The six points a digit can use, named by row and side: `tl tr ml mr bl br`.
 *
 * Seven-segment digits, but drawn as a constellation: only the points a digit actually uses
 * exist, so a `1` is a bare column with no stray dots beside it.
 */
const CELL: Readonly<Record<string, Vec2>> = {
  tl: [0, 0],
  tr: [2, 0],
  ml: [0, 1.8],
  mr: [2, 1.8],
  bl: [0, 3.6],
  br: [2, 3.6],
}

type Segment = readonly [string, string]

/** Which segments each digit lights. Points are implied by the segments. */
const DIGITS: Readonly<Record<string, readonly Segment[]>> = {
  '0': [['tl', 'tr'], ['tr', 'br'], ['br', 'bl'], ['bl', 'tl']],
  '1': [['tr', 'br']],
  '2': [['tl', 'tr'], ['tr', 'mr'], ['mr', 'ml'], ['ml', 'bl'], ['bl', 'br']],
  '3': [['tl', 'tr'], ['tr', 'mr'], ['mr', 'ml'], ['mr', 'br'], ['br', 'bl']],
  '4': [['tl', 'ml'], ['ml', 'mr'], ['tr', 'br']],
  '5': [['tr', 'tl'], ['tl', 'ml'], ['ml', 'mr'], ['mr', 'br'], ['br', 'bl']],
  '6': [['tr', 'tl'], ['tl', 'bl'], ['bl', 'br'], ['br', 'mr'], ['mr', 'ml']],
  '7': [['tl', 'tr'], ['tr', 'br']],
  '8': [['tl', 'tr'], ['tr', 'br'], ['br', 'bl'], ['bl', 'tl'], ['ml', 'mr']],
  '9': [['mr', 'ml'], ['ml', 'tl'], ['tl', 'tr'], ['tr', 'br'], ['br', 'bl']],
}

/**
 * A run of digits laid out left to right and centred on the origin — '204', '856'.
 *
 * Point names are prefixed with the digit's index (`d0tl`, `d1br`) so a label of any length
 * is one figure with unique names. Only the digits themselves are supported.
 */
export const label = (id: string, text: string, gap = 0.9): Figure => {
  const [w, h] = DIGIT_SIZE
  const total = text.length * w + (text.length - 1) * gap
  const points: Record<string, Vec2> = {}
  const edges: (readonly [string, string])[] = []

  ;[...text].forEach((char, index) => {
    const segments = DIGITS[char]
    if (segments === undefined) throw new Error(`label '${id}': no glyph for '${char}' — digits only`)
    const left = -total / 2 + index * (w + gap)
    const name = (point: string) => `d${index}${point}`
    for (const [a, b] of segments) {
      for (const point of [a, b]) {
        const [x, y] = CELL[point]!
        points[name(point)] = [Math.round((left + x) * 100) / 100, Math.round((y - h / 2) * 100) / 100]
      }
      edges.push([name(a), name(b)])
    }
  })

  return defineFigure(id, {
    title: text,
    points,
    edges: kinded(edges, 'glyph'),
    pointKinds: allKinds(points, 'glyph'),
  })
}

// ---------------------------------------------------------------------------------------------
// Coins

const coinRing = ring('c', [0, 0], 1.6, 8)

/** A coin for flying: a ring with a bar through it, filled. */
export const coin = defineFigure('coin', {
  title: 'A coin',
  points: { ...coinRing.points, barT: [0, -0.7], barB: [0, 0.7] },
  edges: kinded([...coinRing.edges, ['barT', 'barB']], 'coin'),
  faces: [{ points: Object.keys(coinRing.points), kind: 'coin' }],
  pointKinds: allKinds({ ...coinRing.points, barT: [0, 0], barB: [0, 0] }, 'coin'),
})

/** Three coins lying flat, one on the next: ellipses stacked 0.7 apart, lowest painted first. */
export const coinStack = defineFigure('coinStack', {
  title: 'A stack of coins',
  ...(() => {
    const points: Record<string, Vec2> = {}
    const edges: (readonly [string, string])[] = []
    const faces: { points: string[]; kind: string }[] = []
    // Bottom coin first so each one above paints over the one below.
    ;[2, 1, 0].forEach((level) => {
      const r = ring(`s${level}`, [0, 0], 1.6, 8)
      for (const [name, [x, y]] of Object.entries(r.points)) {
        points[name] = [Math.round(x * 100) / 100, Math.round((y * 0.5 - level * 0.7) * 100) / 100]
      }
      edges.push(...r.edges)
      faces.push({ points: Object.keys(r.points), kind: 'coin' })
    })
    return { points, edges: kinded(edges, 'coin'), faces, pointKinds: allKinds(points, 'coin') }
  })(),
})

// ---------------------------------------------------------------------------------------------
// Pulse and spark

const pulse = ring('p', [0, 0], 1, 12)

/** A ring of unit radius, for the scene to scale up and fade as a message lands. */
export const pulseRing = defineFigure('pulseRing', {
  title: 'A pulse',
  points: pulse.points,
  edges: kinded(pulse.edges, 'pulse'),
  pointKinds: allKinds(pulse.points, 'pulse'),
})

/** One dot and nothing else, for trailing behind a message in flight. */
export const spark = defineFigure('spark', {
  title: 'A spark',
  points: { p: [0, 0] },
  edges: [],
  pointKinds: { p: 'pulse' },
})
