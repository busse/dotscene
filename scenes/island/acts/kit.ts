/**
 * Staging helpers for the island, on top of the EDI kit's generic ones.
 *
 * What is generic — a message flying an arc, a camera shot, a pose cycle — comes from the
 * EDI kit unchanged. What is the island's own is here: the keeper at the island's scale, a
 * plane crossing at altitude, a wire strung to a socket, a bubble said by the chatbot, the
 * sun's arc, and nightfall.
 */

import { definePose, easings, lerpPoints, posePoints, type Beat, type PartKeyframe, type Pose, type Vec2 } from 'dotscene'
import { at as project } from '../../edi/projection.ts'
import { keeper } from '../figures/keeper.ts'
import { strung, wire } from '../figures/fixtures.ts'
import { NIGHT } from '../timing.ts'

export { between, camera, cycle, flight, flightSpan, look, report, type Shot } from '../../edi/acts/kit.ts'

export type Cell = readonly [number, number]

const roundTo = (n: number, places = 2): number => Math.round(n * 10 ** places) / 10 ** places
export const vec = (v: Vec2): Vec2 => [roundTo(v[0]), roundTo(v[1])]

/** Paint order for something standing at a cell: `x + y`, larger nearer. */
export const depthOf = (cell: Cell): number => cell[0] + cell[1]

/** Depth for anything in the air, over every solid. */
export const SKY = 1000
/** Behind the island: the sun and the moon paint before the land. */
export const BEHIND = -1002

// ---------------------------------------------------------------------------------------------
// The keeper

/** The keeper figure is 64 tall; the keeper stands about seven and a half units. */
export const KEEPER_SCALE = 0.2
const FEET = 64 * KEEPER_SCALE

/** The part position that puts the keeper's feet on a cell. */
export const feetAt = (cell: Cell, z = 0): Vec2 => {
  const [x, y] = project([cell[0], cell[1], z])
  return [x, y - FEET]
}

/** The mug is oversized on purpose; it has to read at the width of a whole island. */
export const MUG_SCALE = KEEPER_SCALE * 1.15

const handOf = (pose: string | Pose): Vec2 => {
  const points = typeof pose === 'string' ? (keeper.poses[pose] ?? {}) : pose.points
  return (points.handL ?? keeper.points.handL) as Vec2
}

/** The mug, hanging from the keeper's left hand in whatever pose the keeper is in. */
export const mugAt = (state: PartKeyframe, pose: string | Pose): PartKeyframe => {
  const [hx, hy] = handOf(pose)
  const at = state.at!
  const flip = state.flipX ? -1 : 1
  return { at: [roundTo(at[0] + hx * flip * KEEPER_SCALE, 2), roundTo(at[1] + hy * KEEPER_SCALE, 2)], depth: roundTo((state.depth ?? 0) + 0.25, 3) }
}

/** Standing on a cell. The keeper's mug comes along; anything else stands alone. */
export const standAt = (part: string, cell: Cell, pose: string, flipX = false, z = 0, carry = true): Record<string, PartKeyframe> => {
  const state: PartKeyframe = { at: feetAt(cell, z), pose, flipX, rotate: 0, depth: roundTo(depthOf(cell) + 0.4, 3) }
  return part === 'keeper' && carry ? { [part]: state, mug: mugAt(state, pose) } : { [part]: state }
}

const HIP_LIE = keeper.poses.lie!.hip as Vec2

/**
 * In the hammock: lying, sitting up, or sipping — all anchored at the hip on the cell, so
 * the tween between them is a body sitting up rather than a figure swinging round.
 */
export const restAt = (cell: Cell, z: number, pose: 'lie' | 'sitUp' | 'reachSit' | 'sipSit', carry = true): Record<string, PartKeyframe> => {
  const [x, y] = project([cell[0], cell[1], z])
  const state: PartKeyframe = {
    at: [roundTo(x - HIP_LIE[0] * KEEPER_SCALE, 2), roundTo(y - HIP_LIE[1] * KEEPER_SCALE, 2)],
    pose,
    flipX: false,
    rotate: 0,
    depth: roundTo(depthOf(cell) + 0.3, 3),
  }
  return carry ? { keeper: state, mug: mugAt(state, pose) } : { keeper: state }
}

/** Lying in the hammock, mug on its stump. */
export const lyingAt = (cell: Cell, z: number): Record<string, PartKeyframe> => restAt(cell, z, 'lie', false)

/** Steam over the mug in `state`, which must carry a mug. */
export const steamOver = (state: Record<string, PartKeyframe>, pose: 'a' | 'b', opacity: number): PartKeyframe => ({
  at: state.mug!.at,
  pose,
  opacity,
  depth: roundTo((state.mug!.depth ?? 0) + 0.01, 3),
})

/** A sip on arrival: idle, mug up with steam, two beats, and down again. 900 ms. */
export const sip = (cell: Cell, at: number, flipX = false): Beat[] => {
  const idle = standAt('keeper', cell, 'idle', flipX)
  const sipping = standAt('keeper', cell, 'sip', flipX)
  return [
    { at, parts: { ...idle, steam: steamOver(idle, 'a', 0) } },
    { at: at + 200, parts: { ...sipping, steam: steamOver(sipping, 'a', 1) }, easing: 'easeInOut' },
    { at: at + 450, parts: { steam: steamOver(sipping, 'b', 1) } },
    { at: at + 700, parts: { ...sipping, steam: steamOver(sipping, 'a', 1) } },
    { at: at + 900, parts: { ...idle, steam: steamOver(idle, 'a', 0) }, easing: 'easeInOut' },
  ]
}

const GAIT = ['stepA', 'passA', 'stepB', 'passB'] as const
const HALF_STRIDE = 10
const gaitCache = new Map<string, ReturnType<typeof definePose>>()
const gaitPose = (phase: number) => {
  const wrapped = ((phase % 4) + 4) % 4
  const key = wrapped.toFixed(2)
  const cached = gaitCache.get(key)
  if (cached !== undefined) return cached
  const index = Math.floor(wrapped)
  const pose = definePose(keeper, `gait${key}`, lerpPoints(posePoints(keeper, GAIT[index]!), posePoints(keeper, GAIT[(index + 1) % 4]!), wrapped - index))
  gaitCache.set(key, pose)
  return pose
}

/** The keeper walking from one cell to another, planting every step; ends standing. */
export const walk = (part: string, from: Cell, to: Cell, at: number, duration: number, endPose = 'idle', carry = true): Beat[] => {
  const a = feetAt(from)
  const b = feetAt(to)
  const distance = Math.hypot(b[0] - a[0], b[1] - a[1])
  const stride = HALF_STRIDE * KEEPER_SCALE
  const halfSteps = Math.max(2, Math.round(distance / stride))
  const flipX = b[0] < a[0]
  // The steps take all but the last 180 ms; the settle into `endPose` lands exactly at
  // `at + duration`, so an act that hands the keeper on at that instant does not overlap.
  const stepping = Math.max(240, duration - 180)
  const beats: Beat[] = [{ at, parts: standAt(part, from, 'idle', false, 0, carry) }]
  for (let i = 1; i <= halfSteps; i++) {
    const t = i / halfSteps
    const cell: Cell = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
    const pose = gaitPose(i)
    const state: PartKeyframe = { at: vec([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]), pose, flipX, rotate: 0, depth: roundTo(depthOf(cell) + 0.4, 3) }
    beats.push({
      at: at + Math.round((stepping * i) / halfSteps),
      parts: part === 'keeper' && carry ? { [part]: state, mug: mugAt(state, pose) } : { [part]: state },
    })
  }
  beats.push({ at: at + stepping + 180, parts: standAt(part, to, endPose, false, 0, carry) })
  return beats
}

/** How long a walk between two cells takes at the keeper's pace. */
export const walkTime = (from: Cell, to: Cell, pace = 2.2): number =>
  Math.max(500, Math.round((Math.hypot(to[0] - from[0], to[1] - from[1]) / pace) * 1000))

// ---------------------------------------------------------------------------------------------
// Things in the air

/**
 * A straight pass at altitude with a gentle bob, for the plane: beats along the line with a
 * heading pose held throughout, propeller alternating, and anything trailing it — a banner —
 * riding a fixed screen offset behind.
 */
export const fly = (spec: {
  readonly part: string
  readonly from: Cell
  readonly to: Cell
  readonly z: number
  readonly zTo?: number
  readonly at: number
  readonly duration: number
  readonly pose: string
  readonly propPoses?: readonly [string, string]
  readonly trail?: { readonly part: string; readonly offset: Vec2; readonly poses?: readonly string[] }
  readonly opacity?: readonly [number, number]
  readonly steps?: number
  readonly bob?: number
}): Beat[] => {
  const steps = spec.steps ?? Math.max(4, Math.round(spec.duration / 450))
  const beats: Beat[] = []
  const [o0, o1] = spec.opacity ?? [1, 1]
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const cell: Cell = [spec.from[0] + (spec.to[0] - spec.from[0]) * f, spec.from[1] + (spec.to[1] - spec.from[1]) * f]
    const z = spec.z + ((spec.zTo ?? spec.z) - spec.z) * easings.easeInOut(f) + (spec.bob ?? 0.25) * Math.sin(f * Math.PI * 4)
    const p = project([cell[0], cell[1], z])
    const pose = spec.propPoses === undefined ? spec.pose : spec.propPoses[i % 2]!
    const parts: Record<string, PartKeyframe> = {
      [spec.part]: { at: vec(p), pose, opacity: i === 0 ? o0 : i === steps ? o1 : 1, depth: SKY + 2 },
    }
    if (spec.trail !== undefined) {
      parts[spec.trail.part] = {
        at: vec([p[0] + spec.trail.offset[0], p[1] + spec.trail.offset[1]]),
        opacity: i === 0 ? o0 : i === steps ? o1 : 1,
        depth: SKY + 1,
        ...(spec.trail.poses === undefined ? {} : { pose: spec.trail.poses[i % spec.trail.poses.length]! }),
      }
    }
    beats.push({ at: spec.at + Math.round(spec.duration * f), parts })
  }
  return beats
}

/** The sun or moon along a half-ellipse from one horizon point to another, in scene units. */
export const arcAcross = (part: string, from: Vec2, to: Vec2, rise: number, at: number, duration: number, opacity: readonly [number, number, number] = [0, 1, 0]): Beat[] => {
  const steps = 10
  const beats: Beat[] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const x = from[0] + (to[0] - from[0]) * f
    const y = from[1] + (to[1] - from[1]) * f - Math.sin(f * Math.PI) * rise
    const o = i === 0 ? opacity[0] : i === steps ? opacity[2] : opacity[1]
    beats.push({ at: at + Math.round(duration * f), parts: { [part]: { at: vec([x, y]), opacity: o, depth: BEHIND } } })
  }
  return beats
}

// ---------------------------------------------------------------------------------------------
// Wires, bubbles, nightfall

/** String a wire from its socket to a point over `duration`, or drop it slack. */
export const stringWire = (part: string, socket: Vec2, to: Vec2, at: number, duration: number): Beat[] => [
  { at, parts: { [part]: { at: socket, pose: 'slack', opacity: 1 } } },
  { at: at + duration, parts: { [part]: { at: socket, pose: strung([to[0] - socket[0], to[1] - socket[1]]), opacity: 1 } }, easing: 'easeInOut' },
]

export const slackWire = (part: string, socket: Vec2, at: number): Beat[] => [
  { at, parts: { [part]: { at: socket, pose: 'slack', opacity: 0 } } },
]

/** The wire figure, exported here so acts and the world agree on one. */
export { wire }

/**
 * A speech bubble with something in it: pops up over the mouth, holds, and shrinks away.
 * The bubble and its contents are separate parts riding one position.
 */
export const speak = (bubble: string, glyph: string | undefined, mouth: Vec2, at: number, hold = 1100): Beat[] => {
  const up: Vec2 = vec([mouth[0] + 7, mouth[1] - 9])
  const state = (o: number, s: number): Record<string, PartKeyframe> => ({
    [bubble]: { at: up, opacity: o, scale: s, depth: SKY + 20 },
    ...(glyph === undefined ? {} : { [glyph]: { at: vec([up[0] + 0.6, up[1] - 0.4]), opacity: o, scale: s, depth: SKY + 21 } }),
  })
  return [
    { at, parts: state(0, 0.3) },
    { at: at + 220, parts: state(1, 1), easing: 'easeOut' },
    { at: at + 220 + hold, parts: state(1, 1) },
    { at: at + 220 + hold + 200, parts: state(0, 0.5), easing: 'easeIn' },
  ]
}

/** Nightfall: the overlay darkens from dusk, holds through the night, and lifts before the cut. */
export const nightBeats = (part: string, loop: number): Beat[] => [
  { at: 0, parts: { [part]: { opacity: 0 } } },
  { at: NIGHT.from, parts: { [part]: { opacity: 0 } } },
  { at: NIGHT.deep, parts: { [part]: { opacity: NIGHT.opacity } }, easing: 'easeInOut' },
  { at: NIGHT.lift, parts: { [part]: { opacity: NIGHT.opacity } } },
  { at: loop, parts: { [part]: { opacity: 0 } }, easing: 'easeInOut' },
]
