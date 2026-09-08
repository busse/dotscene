/**
 * The lighthouse keeper: the shared person with the poses a day on the island needs — lying
 * in the hammock, sitting up in it, sipping coffee sitting and standing, a stretch — and the
 * mug that goes everywhere with them, steam and all.
 *
 * The lying and sitting poses share one hip position, so the tween between them pivots at
 * the hip: a body sitting up, not a plank swinging round its head.
 */

import { defineFigure, type PoseOverride, type Vec2 } from 'dotscene'
import { person } from '../../person.ts'

/** Screen direction of the hammock's length (grid +x): down and to the right. */
const ALONG: Vec2 = [Math.cos(Math.atan2(4, 8)), Math.sin(Math.atan2(4, 8))]
/** Screen direction across it (grid +y): down and to the left, flattened. */
const ACROSS: Vec2 = [-ALONG[0] * 0.55, ALONG[1] * 0.55]

const lie: PoseOverride = Object.fromEntries(
  Object.entries(person.points).map(([name, [x, y]]) => [name, [round(x * ACROSS[0] + y * ALONG[0]), round(x * ACROSS[1] + y * ALONG[1])] as Vec2]),
)

function round(n: number): number {
  return Math.round(n * 100) / 100
}

const HIP = lie.hip as Vec2
const add = (a: Vec2, b: Vec2): Vec2 => [round(a[0] + b[0]), round(a[1] + b[1])]

/** Sitting on the hammock's near edge, legs dangling toward the viewer, torso upright. */
const sitUp = ((): PoseOverride => {
  const hip = HIP
  const chest = add(hip, [0, -12])
  const neck = add(hip, [0, -21])
  const head = add(hip, [0, -31])
  const shoulderL = add(neck, [-7, 2])
  const shoulderR = add(neck, [7, 2])
  const elbowL = add(shoulderL, [-3, 10])
  const elbowR = add(shoulderR, [3, 10])
  const hipL = add(hip, [-4, 1])
  const hipR = add(hip, [4, 1])
  const kneeL = add(hipL, [-9, 6])
  const kneeR = add(hipR, [-9, 6])
  return {
    head, neck, chest, hip, shoulderL, shoulderR, elbowL, elbowR,
    handL: add(elbowL, [2, 8]), handR: add(elbowR, [-2, 8]),
    hipL, hipR, kneeL, kneeR,
    footL: add(kneeL, [-1, 13]), footR: add(kneeR, [-1, 13]),
  }
})()

/** The same, reaching out with the left hand for the mug on its stump. */
const reachSit: PoseOverride = {
  ...sitUp,
  elbowL: add(sitUp.shoulderL as Vec2, [-11, 8]),
  handL: add(sitUp.shoulderL as Vec2, [-21, 17]),
}

/** The same, with the mug up to the mouth. */
const sipSit: PoseOverride = {
  ...sitUp,
  elbowL: add(sitUp.shoulderL as Vec2, [-9, 5]),
  handL: add(sitUp.head as Vec2, [-3, 6]),
}

export const keeper = defineFigure('keeper', {
  title: 'The lighthouse keeper',
  points: person.points,
  edges: person.edges,
  poses: {
    ...person.poses,
    lie,
    sitUp,
    reachSit,
    sipSit,
    /** Standing, mug to the mouth. */
    sip: { elbowL: [-11, 20], handL: [-3, 11], head: [0, 2] },
    /** Both arms up, a good morning. */
    stretch: { elbowL: [-11, 6], handL: [-13, -6], elbowR: [11, 6], handR: [13, -6], head: [0, 2], neck: [0, 12] },
  },
})

/** A mug, held by its handle: the hand is at the origin, inside the handle's loop, and the cup is to the left. */
export const mug = defineFigure('mug', {
  title: 'A mug of coffee',
  points: { tl: [-13, -5], tr: [-3, -5], br: [-4, 6], bl: [-12, 6], hA: [-3, -2], hB: [1.5, -1], hC: [1.5, 4], hD: [-4, 5] },
  edges: [
    { from: 'tl', to: 'tr', kind: 'mug' },
    { from: 'tr', to: 'br', kind: 'mug' },
    { from: 'br', to: 'bl', kind: 'mug' },
    { from: 'bl', to: 'tl', kind: 'mug' },
    { from: 'hA', to: 'hB', kind: 'mug' },
    { from: 'hB', to: 'hC', kind: 'mug' },
    { from: 'hC', to: 'hD', kind: 'mug' },
  ],
  faces: [{ points: ['tl', 'tr', 'br', 'bl'], kind: 'mug' }],
  pointKinds: { tl: 'mug', tr: 'mug', br: 'mug', bl: 'mug', hA: 'mug', hB: 'mug', hC: 'mug', hD: 'mug' },
})

/** Two wisps rising from the mug; `a` and `b` alternate to make them waver. */
export const steam = defineFigure('steam', {
  title: 'Steam',
  points: { s0: [-10, -7], s1: [-11.5, -12], s2: [-9.5, -17], t0: [-6, -7], t1: [-4.5, -12], t2: [-6.5, -17] },
  edges: [
    { from: 's0', to: 's1', kind: 'steam' },
    { from: 's1', to: 's2', kind: 'steam' },
    { from: 't0', to: 't1', kind: 'steam' },
    { from: 't1', to: 't2', kind: 'steam' },
  ],
  pointKinds: { s0: 'steam', s1: 'steam', s2: 'steam', t0: 'steam', t1: 'steam', t2: 'steam' },
  poses: { a: {}, b: { s1: [-9, -12], s2: [-11.5, -17], t1: [-7, -12], t2: [-4.5, -17] } },
})
