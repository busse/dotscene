/**
 * What lives in the sky and on the water: birds, ripples, a cloud.
 *
 * Ambient life, so the frame is never still. Flat, screen-facing sprites in plain scene units
 * like the tokens, centred on the origin; the scene places and drifts them.
 */

import { defineFigure, ring, type EdgeSpec, type PointMap, type Vec2 } from 'dotscene'

const kinded = (edges: readonly (readonly [string, string])[], kind: string): EdgeSpec[] =>
  edges.map(([from, to]) => ({ from, to, kind }))

const allKinds = (points: PointMap, kind: string): Record<string, string> =>
  Object.fromEntries(Object.keys(points).map((name) => [name, kind]))

// ---------------------------------------------------------------------------------------------
// Birds

/** Body positions of five birds in a loose V, unevenly spaced so it reads as a flock. */
const FLOCK: readonly Vec2[] = [
  [0, -4],
  [-5.5, -1.5],
  [5, -1],
  [-11, 2.5],
  [10.5, 4],
]

const WINGSPAN = 3.2

const birdPoints = (lift: number): Record<string, Vec2> => {
  const points: Record<string, Vec2> = {}
  FLOCK.forEach(([x, y], i) => {
    points[`b${i}L`] = [x - WINGSPAN / 2, y + lift]
    points[`b${i}`] = [x, y]
    points[`b${i}R`] = [x + WINGSPAN / 2, y + lift]
  })
  return points
}

/** Wings only: the poses move the tips, the bodies stay where they are. */
const wingTips = (lift: number): Record<string, Vec2> =>
  Object.fromEntries(Object.entries(birdPoints(lift)).filter(([name]) => name.endsWith('L') || name.endsWith('R')))

const upPoints = birdPoints(-1.0)

/** Five birds, each two strokes meeting at the body. `up` and `down` flap the wingtips. */
export const birds = defineFigure('birds', {
  title: 'A flock of birds',
  points: upPoints,
  edges: kinded(
    FLOCK.flatMap((_, i) => [
      [`b${i}L`, `b${i}`],
      [`b${i}`, `b${i}R`],
    ]),
    'bird',
  ),
  pointKinds: allKinds(upPoints, 'bird'),
  poses: {
    up: {},
    down: wingTips(0.8),
  },
})

// ---------------------------------------------------------------------------------------------
// Ripples

/** Left end of each dash, scattered over 16 by 6. */
const DASHES: readonly Vec2[] = [
  [-7.5, -2.6],
  [-2, -1.4],
  [4, -2.2],
  [-5, 0.8],
  [1.5, 1.6],
  [5.5, 2.6],
]

const DASH = 2.2

/** Each dash drifted `step` steps to the right, wobbling up and down alternately. */
const ripplePoints = (step: number): Record<string, Vec2> => {
  const points: Record<string, Vec2> = {}
  DASHES.forEach(([x, y], i) => {
    const wobble = step === 0 ? 0 : (i % 2 === 0 ? 1 : -1) * 0.15 * (step === 1 ? 1 : -1)
    const dx = x + step * 0.6
    const dy = Math.round((y + wobble) * 100) / 100
    points[`r${i}A`] = [Math.round(dx * 100) / 100, dy]
    points[`r${i}B`] = [Math.round((dx + DASH) * 100) / 100, dy]
  })
  return points
}

const restRipples = ripplePoints(0)

/** Six short strokes on the water. `a`, `b`, `c` drift them downstream a little at a time. */
export const ripples = defineFigure('ripples', {
  title: 'Ripples on the water',
  points: restRipples,
  edges: kinded(
    DASHES.map((_, i) => [`r${i}A`, `r${i}B`]),
    'water',
  ),
  pointKinds: allKinds(restRipples, 'water'),
  poses: {
    a: {},
    b: ripplePoints(1),
    c: ripplePoints(2),
  },
})

// ---------------------------------------------------------------------------------------------
// Cloud

/**
 * A cloud: a flattened ring of ten, with three of the upper points pushed up so the outline
 * is lumpy rather than an ellipse.
 */
const cloudRing = ring('c', [0, 0], 5, 10, -90)

const cloudPoints: Record<string, Vec2> = Object.fromEntries(
  Object.entries(cloudRing.points).map(([name, [x, y]]) => {
    // Points 9, 0, 1 are the top of the ring, drawn from -90 degrees clockwise.
    const lumpy = name === 'c0' || name === 'c1' || name === 'c9'
    return [name, [x, Math.round((y * 0.45 - (lumpy ? 1.5 : 0)) * 100) / 100]]
  }),
)

export const cloud = defineFigure('cloud', {
  title: 'A cloud',
  points: cloudPoints,
  edges: kinded(cloudRing.edges, 'soft'),
  faces: [{ points: Object.keys(cloudPoints), kind: 'cloud' }],
  pointKinds: allKinds(cloudPoints, 'soft'),
})
