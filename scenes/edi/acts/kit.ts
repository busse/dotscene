/**
 * What every act is made of.
 *
 * An act declares *what happens* — this message goes from here to there, the rig runs this
 * stretch of road, the camera pushes in on that dock — and this file turns each of those into
 * beats on the act's own clock. Keeping the two apart is what makes an act file readable,
 * and what lets the tempo, the arc of a flight or the way a message appears be changed once
 * rather than twelve times.
 *
 * Everything here is expressed in the timeline's own vocabulary: beats carry `at`, `pose`,
 * `depth`, `opacity`, `scale` and `camera`, and the compositor bakes eased segments. Nothing
 * is resampled: a beat is only ever written for the part it moves.
 */

import { definePose, easings, lerpPoints, posePoints, type Beat, type Figure, type Part, type PartKeyframe, type Vec2 } from 'dotscene'
import { at as project } from '../projection.ts'
import { badge, envelope, label as digits, pulseRing, spark, type BadgeKind } from '../figures/tokens.ts'
import { FORK_CENTRE, type Heading } from '../figures/vehicles.ts'
import { person } from '../../person.ts'
import {
  along,
  cornersBetween,
  depthOf,
  dockedAt,
  PERSON_FEET,
  PERSON_SCALE,
  routeAt,
  SKY,
  standingAt,
  type Cell,
} from '../world.ts'

export type { Beat }

const roundTo = (n: number, places = 2): number => Math.round(n * 10 ** places) / 10 ** places
const vec = (v: Vec2): Vec2 => [roundTo(v[0]), roundTo(v[1])]

/** Parts an act brings with it, on top of the stage. */
export interface ActParts {
  readonly parts: Part[]
  readonly beats: Beat[]
}

const partsAndBeats = (): { parts: Part[]; beats: Beat[]; push: (at: number, parts: Record<string, PartKeyframe>, easing?: Beat['easing']) => void } => {
  const parts: Part[] = []
  const beats: Beat[] = []
  return {
    parts,
    beats,
    push: (at, states, easing) => {
      beats.push({ at: Math.round(at), parts: states, ...(easing === undefined ? {} : { easing }) })
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Messages

export interface Flight {
  /** A prefix unique within the act, so several flights can share it. */
  readonly id: string
  readonly from: Vec2
  readonly to: Vec2
  readonly at: number
  readonly duration: number
  /** The transaction set, drawn as digits under the envelope. Omit for a bare acknowledgment. */
  readonly label?: string
  readonly badge?: BadgeKind
  /** Smaller and quicker: an acknowledgment. */
  readonly small?: boolean
  /** How far the arc bows above the straight line. Default: a fifth of the distance, capped. */
  readonly lift?: number
}

/** Where a message sits just before it leaves and just after it lands: above the mast tip. */
const HOVER = 7
const RISE = 260
const LAND = 280
const SAMPLES = 9

const arc = (from: Vec2, to: Vec2, lift: number, t: number): Vec2 => {
  const control: Vec2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - lift]
  const inv = 1 - t
  return [
    inv * inv * from[0] + 2 * inv * t * control[0] + t * t * to[0],
    inv * inv * from[1] + 2 * inv * t * control[1] + t * t * to[1],
  ]
}

/**
 * One message crossing the network.
 *
 * It rises out of the mast and fades in, arcs across with two sparks trailing it, and is
 * absorbed at the far mast as a ring of light spreads there. The envelope, its badge and its
 * digits are separate parts riding the same path — the digits are what the camera reveals
 * when it pushes in, and what makes a 204 a 204.
 */
export const flight = (flight: Flight): ActParts => {
  const { id, from, to, at, duration } = flight
  const scale = flight.small === true ? 0.62 : 1
  const start: Vec2 = [from[0], from[1] - HOVER]
  const end: Vec2 = [to[0], to[1] - HOVER]
  const distance = Math.hypot(end[0] - start[0], end[1] - start[1])
  const lift = flight.lift ?? Math.min(48, Math.max(14, distance * 0.2))

  const env = `${id}Env`
  const { parts, beats, push } = partsAndBeats()

  // Everything that rides with the envelope, and its offset from it.
  const riders: { id: string; figure: Figure; offset: Vec2; scale: number }[] = [
    { id: env, figure: envelope, offset: [0, 0], scale },
  ]
  if (flight.badge !== undefined) {
    riders.push({ id: `${id}Badge`, figure: badge(flight.badge, `${id}Badge`), offset: [3.5 * scale, 2.3 * scale], scale })
  }
  if (flight.label !== undefined) {
    riders.push({ id: `${id}Label`, figure: digits(`${id}Label`, flight.label), offset: [0, 5.6 * scale], scale: scale * 0.95 })
  }
  for (const rider of riders) {
    parts.push({ id: rider.id, figure: rider.figure, at: vec(start), scale: rider.scale, depth: SKY + 10, opacity: 0, pose: rider.figure === envelope ? 'closed' : undefined })
  }

  const ride = (position: Vec2, opacity: number, grow = 1, pose?: string): Record<string, PartKeyframe> => {
    const states: Record<string, PartKeyframe> = {}
    for (const rider of riders) {
      states[rider.id] = {
        at: vec([position[0] + rider.offset[0] * grow, position[1] + rider.offset[1] * grow]),
        opacity,
        scale: roundTo(rider.scale * grow, 3),
        ...(pose !== undefined && rider.figure === envelope ? { pose } : {}),
      }
    }
    return states
  }

  // Rise out of the mast: from the tip, growing and fading in.
  push(at, ride(from, 0, 0.5, 'open'))
  push(at + RISE, ride(start, 1, 1, 'closed'), 'easeOut')

  // The crossing. Eased in the parameter, so it leaves and arrives gently on straight steps.
  for (let i = 1; i <= SAMPLES; i++) {
    const t = easings.easeInOut(i / SAMPLES)
    push(at + RISE + (duration * i) / SAMPLES, ride(arc(start, end, lift, t), 1))
  }

  // Absorbed into the far mast.
  push(at + RISE + duration + LAND, ride(to, 0, 0.4, 'open'), 'easeIn')

  // Two sparks trailing, on the same path a beat behind, each fainter than the last.
  const sparks = [
    { id: `${id}S1`, lag: 0.09, opacity: 0.75 },
    { id: `${id}S2`, lag: 0.18, opacity: 0.45 },
  ]
  for (const s of sparks) {
    parts.push({ id: s.id, figure: spark, at: vec(start), depth: SKY + 9, opacity: 0 })
    const lag = duration * s.lag
    push(at + RISE + lag, { [s.id]: { at: vec(start), opacity: 0 } })
    push(at + RISE + lag + duration * 0.08, { [s.id]: { at: vec(arc(start, end, lift, easings.easeInOut(0.08))), opacity: s.opacity } })
    for (let i = 2; i <= SAMPLES; i++) {
      const t = easings.easeInOut(i / SAMPLES)
      push(at + RISE + lag + (duration * i) / SAMPLES, { [s.id]: { at: vec(arc(start, end, lift, t)), opacity: i === SAMPLES ? 0 : s.opacity } })
    }
  }

  // The landing: a ring spreading from the far mast's tip.
  const pulse = `${id}Pulse`
  parts.push({ id: pulse, figure: pulseRing, at: vec(to), depth: SKY + 8, opacity: 0, scale: 0.3 })
  const landed = at + RISE + duration
  push(landed, { [pulse]: { at: vec(to), scale: 0.3, opacity: 0.95 } })
  push(landed + 620, { [pulse]: { at: vec(to), scale: 4.2 * scale, opacity: 0 } }, 'easeOut')

  return { parts, beats }
}

/** How long a flight takes end to end, rise and landing included. */
export const flightSpan = (duration: number): number => RISE + duration + LAND

/**
 * A spark from the ground up to a mast: the driver's device reporting in. This is the
 * physical event becoming data — where every status message starts.
 */
export const report = (id: string, from: Vec2, to: Vec2, at: number, duration = 700): ActParts => {
  const { parts, beats, push } = partsAndBeats()
  const s = `${id}Report`
  parts.push({ id: s, figure: spark, at: vec(from), depth: SKY + 9, opacity: 0 })
  const lift = Math.max(10, Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.25)
  push(at, { [s]: { at: vec(from), opacity: 0 } })
  push(at + 80, { [s]: { at: vec(arc(from, to, lift, 0.06)), opacity: 1 } })
  for (let i = 2; i <= 6; i++) {
    push(at + (duration * i) / 6, { [s]: { at: vec(arc(from, to, lift, easings.easeIn(i / 6))), opacity: i === 6 ? 0 : 1 } })
  }
  const pulse = `${id}ReportPulse`
  parts.push({ id: pulse, figure: pulseRing, at: vec(to), depth: SKY + 8, opacity: 0, scale: 0.3 })
  push(at + duration, { [pulse]: { at: vec(to), scale: 0.3, opacity: 0.9 } })
  push(at + duration + 480, { [pulse]: { at: vec(to), scale: 2.6, opacity: 0 } }, 'easeOut')
  return { parts, beats }
}

// ---------------------------------------------------------------------------------------------
// Vehicles

/** The pose a vehicle needs on a run: its axis, and `r` when it travels against the axis. */
const heading = (axis: 'x' | 'y', dir: 1 | -1, forward: boolean): Heading => {
  const withAxis = forward ? dir > 0 : dir < 0
  return withAxis ? axis : (`${axis}r` as Heading)
}

const laneOffset = (axis: 'x' | 'y', lane: number): Cell => (axis === 'x' ? [0, lane] : [-lane, 0])

const onRoad = (t: number, lane: number, depthBias: number): { cell: Cell; depth: number; axis: 'x' | 'y'; dir: 1 | -1 } => {
  const spot = along(t)
  const offset = laneOffset(spot.axis, lane)
  const cell: Cell = [spot.cell[0] + offset[0], spot.cell[1] + offset[1]]
  return { cell, depth: depthOf(cell) + depthBias, axis: spot.axis, dir: spot.dir }
}

export interface Drive {
  readonly part: string
  /** Route parameters, 0 to 1. Driving from a larger to a smaller value is driving back. */
  readonly from: number
  readonly to: number
  readonly at: number
  readonly duration: number
  /** Offset across the road, in grid units. Positive is the near side. */
  readonly lane?: number
  readonly depthBias?: number
  /** Ease out of the start and into the stop. Default: linear, for a vehicle already rolling. */
  readonly easeStart?: boolean
  readonly easeStop?: boolean
}

/**
 * A vehicle running a stretch of road.
 *
 * Position and depth vary linearly along a straight run, so there is a beat only where the
 * road turns — and at a corner the heading snaps over a millisecond, because a box names
 * the same corners in different places when laid along the other axis, and a slow blend
 * between them turns the solid inside out.
 */
export const drive = (drive: Drive): Beat[] => {
  const beats: Beat[] = []
  const lane = drive.lane ?? 0
  const bias = drive.depthBias ?? 0.6
  const forward = drive.to >= drive.from
  const stops = [drive.from, ...cornersBetween(drive.from, drive.to), drive.to]
  const span = Math.abs(drive.to - drive.from) || 1
  let pose: Heading | undefined

  stops.forEach((t, i) => {
    const when = drive.at + Math.round((drive.duration * Math.abs(t - drive.from)) / span)
    const here = onRoad(t, lane, bias)
    const wanted = heading(here.axis, here.dir, forward)
    if (pose !== undefined && wanted !== pose) {
      // Hold the old heading until the corner, then turn in one millisecond.
      const before = onRoad(t, lane, bias)
      beats.push({ at: when - 1, parts: { [drive.part]: { at: project([before.cell[0], before.cell[1], 0]), depth: roundTo(before.depth, 3), pose } } })
    }
    pose = wanted
    const easing = i === stops.length - 1 && drive.easeStop === true ? 'easeOut' : i === 1 && drive.easeStart === true ? 'easeIn' : undefined
    beats.push({
      at: when,
      parts: { [drive.part]: { at: project([here.cell[0], here.cell[1], 0]), depth: roundTo(here.depth, 3), pose } },
      ...(easing === undefined ? {} : { easing }),
    })
  })
  return beats
}

/** The route parameter of the road in front of a door. */
export const roadAtDoor = (door: Cell): number => routeAt([door[0], door[1] + 3])

export interface Dock {
  readonly part: string
  readonly door: Cell
  readonly at: number
  readonly duration: number
  /** `in` backs onto the door from the road; `out` pulls away to the road. */
  readonly direction: 'in' | 'out'
  readonly lane?: number
  /** Which way along the road the rig is heading when on it. Default: with the route. */
  readonly facing?: 'forward' | 'back'
}

/**
 * Backing onto a door, or pulling off it.
 *
 * The rig is on the road in front of the door lying along x; it turns to lie along y — the
 * one-millisecond snap again — and reverses until its rear meets the door. Pulling out is
 * the same move played forwards, and the vehicle ends on the road ready to snap back along
 * the run.
 */
export const dock = (dock: Dock): Beat[] => {
  const lane = dock.lane ?? 0
  const roadSpot = onRoad(roadAtDoor(dock.door), lane, 0.6)
  const roadCell: Cell = [dock.door[0], roadSpot.cell[1]]
  const bay = dockedAt(dock.door)
  const onRoadState = (pose: Heading): PartKeyframe => ({ at: project([roadCell[0], roadCell[1], 0]), depth: roundTo(depthOf(roadCell) + 0.6, 3), pose })
  const inBay: PartKeyframe = { at: project([bay[0], bay[1], 0]), depth: roundTo(depthOf(bay) + 0.6, 3), pose: 'y' }
  const alongRoad = heading(roadSpot.axis, roadSpot.dir, dock.facing !== 'back')
  if (dock.direction === 'in') {
    return [
      { at: dock.at, parts: { [dock.part]: onRoadState(alongRoad) } },
      { at: dock.at + 1, parts: { [dock.part]: onRoadState('y') } },
      { at: dock.at + dock.duration, parts: { [dock.part]: inBay }, easing: 'easeInOut' },
    ]
  }
  return [
    { at: dock.at, parts: { [dock.part]: inBay } },
    { at: dock.at + dock.duration, parts: { [dock.part]: onRoadState('y') }, easing: 'easeInOut' },
    { at: dock.at + dock.duration + 1, parts: { [dock.part]: onRoadState(alongRoad) } },
  ]
}

/** Scene position of a vehicle's cab roof, for a spark to rise from. */
export const cabTop = (cell: Cell, axis: 'x' | 'y', dir: 1 | -1 = 1): Vec2 => {
  const nose: Cell = axis === 'x' ? [cell[0] + 1.35 * dir, cell[1]] : [cell[0], cell[1] + 1.35 * dir]
  return project([nose[0], nose[1], 2.4])
}

// ---------------------------------------------------------------------------------------------
// Forklifts and pallets

/** Which way the forks point: along +x, +y, or the reverse of either. */
export type LiftAxis = 'x' | 'y' | 'xr' | 'yr'

const liftPose = (axis: LiftAxis, high: boolean): string => `${axis}${high ? 'High' : 'Low'}`
const liftDir = (axis: LiftAxis): 1 | -1 => (axis.endsWith('r') ? -1 : 1)
const liftBase = (axis: LiftAxis): 'x' | 'y' => (axis[0] as 'x' | 'y')

/** A forklift's state at a cell, and the pallet's if it is carrying one. */
export const liftAt = (
  lift: string,
  cell: Cell,
  axis: LiftAxis,
  high: boolean,
  carrying?: string,
  depthBias = 0,
  palletOpacity = 1,
): Record<string, PartKeyframe> => {
  const depth = roundTo(depthOf(cell) + depthBias, 3)
  const states: Record<string, PartKeyframe> = {
    [lift]: { at: project([cell[0], cell[1], 0]), pose: liftPose(axis, high), depth },
  }
  if (carrying !== undefined) {
    const [fx, fy, fz] = FORK_CENTRE(liftBase(axis), high, liftDir(axis))
    states[carrying] = { at: project([cell[0] + fx, cell[1] + fy, fz]), depth: roundTo(depth + 0.3, 3), opacity: palletOpacity }
  }
  return states
}

/** The forklift cell that puts the fork centre on a target cell. */
export const liftCellFor = (target: Cell, axis: LiftAxis): Cell => {
  const [fx, fy] = FORK_CENTRE(liftBase(axis), false, liftDir(axis))
  return [target[0] - fx, target[1] - fy]
}

/** A pallet standing on the ground at a cell. */
export const palletAt = (pallet: string, cell: Cell, opacity = 1, depthBias = 0): Record<string, PartKeyframe> => ({
  [pallet]: { at: project([cell[0], cell[1], 0]), depth: roundTo(depthOf(cell) + depthBias, 3), opacity },
})

export interface Shuttle {
  readonly lift: string
  readonly pallet: string
  readonly axis: LiftAxis
  /** Where the forklift starts, empty. */
  readonly from: Cell
  /** Where the pallet stands, and where the forklift must be to have it on the forks. */
  readonly pickup: Cell
  /** Where the pallet is set down. */
  readonly dropoff: Cell
  /** Where the forklift retreats to, empty. Defaults to `from`. */
  readonly home?: Cell
  readonly at: number
  /** Pace: milliseconds to cross one grid unit. */
  readonly pace?: number
  readonly depthBias?: number
  /** Leave the pallet visible where it was dropped; otherwise it fades as it is set down. */
  readonly keepPallet?: boolean
}

/**
 * A forklift fetching a pallet and putting it somewhere else.
 *
 * Drive to the pallet with the forks low, lift, carry it high, lower it at the far end, back
 * away. The pallet is a separate part that rides on the fork centre for the carried beats and
 * stands on its own the rest of the time. Returns when the forklift is home again.
 */
export const shuttle = (s: Shuttle): { beats: Beat[]; end: number } => {
  const pace = s.pace ?? 900
  const bias = s.depthBias ?? 0
  const beats: Beat[] = []
  const push = (at: number, parts: Record<string, PartKeyframe>, easing?: Beat['easing']) =>
    beats.push({ at: Math.round(at), parts, ...(easing === undefined ? {} : { easing }) })
  const travel = (a: Cell, b: Cell): number => Math.max(300, pace * (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])))

  const atPickup = liftCellFor(s.pickup, s.axis)
  const atDrop = liftCellFor(s.dropoff, s.axis)
  const home = s.home ?? s.from
  let t = s.at

  push(t, { ...liftAt(s.lift, s.from, s.axis, false, undefined, bias), ...palletAt(s.pallet, s.pickup, 1, bias) })
  t += travel(s.from, atPickup)
  push(t, liftAt(s.lift, atPickup, s.axis, false, undefined, bias), 'easeInOut')
  // Lift.
  t += 450
  push(t, liftAt(s.lift, atPickup, s.axis, true, s.pallet, bias), 'easeInOut')
  t += 150
  // Carry.
  t += travel(atPickup, atDrop)
  push(t, liftAt(s.lift, atDrop, s.axis, true, s.pallet, bias), 'easeInOut')
  // Lower.
  t += 450
  push(t, liftAt(s.lift, atDrop, s.axis, false, s.pallet, bias), 'easeInOut')
  if (s.keepPallet !== true) {
    push(t + 1, palletAt(s.pallet, s.dropoff, 1, bias))
    push(t + 220, palletAt(s.pallet, s.dropoff, 0, bias))
  } else {
    push(t + 1, palletAt(s.pallet, s.dropoff, 1, bias))
  }
  t += 200
  // Back away.
  t += travel(atDrop, home)
  push(t, liftAt(s.lift, home, s.axis, false, undefined, bias), 'easeInOut')
  return { beats, end: t }
}

// ---------------------------------------------------------------------------------------------
// People

const GAIT = ['stepA', 'passA', 'stepB', 'passB'] as const
/** Half a stride in the person's own units — the foot separation in the contact poses. */
const HALF_STRIDE = 10

const gaitCache = new Map<string, ReturnType<typeof definePose>>()
const gaitPose = (phase: number) => {
  const wrapped = ((phase % 4) + 4) % 4
  const key = wrapped.toFixed(2)
  const cached = gaitCache.get(key)
  if (cached !== undefined) return cached
  const index = Math.floor(wrapped)
  const pose = definePose(
    person,
    `gait${key}`,
    lerpPoints(posePoints(person, GAIT[index]!), posePoints(person, GAIT[(index + 1) % 4]!), wrapped - index),
  )
  gaitCache.set(key, pose)
  return pose
}

/**
 * A person walking from one cell to another, planting every step.
 *
 * The figure faces +x in its own frame, so it is flipped when the screen direction is
 * leftward. The body advances exactly half a stride per half-cycle, which is what keeps the
 * planted foot still on the ground.
 */
export const walk = (part: string, from: Cell, to: Cell, at: number, duration: number): Beat[] => {
  const a = standingAt(from)
  const b = standingAt(to)
  const distance = Math.hypot(b[0] - a[0], b[1] - a[1])
  const stride = HALF_STRIDE * PERSON_SCALE
  const halfSteps = Math.max(2, Math.round(distance / stride))
  const flipX = b[0] < a[0]
  const beats: Beat[] = []
  beats.push({ at, parts: { [part]: { at: a, pose: 'idle', flipX: false, depth: roundTo(depthOf(from) + 0.4, 3) } } })
  for (let i = 1; i <= halfSteps; i++) {
    const t = i / halfSteps
    const cell: Cell = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
    beats.push({
      at: at + Math.round((duration * i) / halfSteps),
      parts: { [part]: { at: vec([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]), pose: gaitPose(i), flipX, depth: roundTo(depthOf(cell) + 0.4, 3) } },
    })
  }
  beats.push({ at: at + duration + 200, parts: { [part]: { at: b, pose: 'idle', flipX: false, depth: roundTo(depthOf(to) + 0.4, 3) } } })
  return beats
}

/** A person standing at a cell in a pose. */
export const stand = (part: string, cell: Cell, pose: string, flipX = false): Record<string, PartKeyframe> => ({
  [part]: { at: standingAt(cell), pose, flipX, depth: roundTo(depthOf(cell) + 0.4, 3) },
})

// ---------------------------------------------------------------------------------------------
// Doors, fades, cycles

export const door = (part: string, at: number, open: boolean, duration = 500): Beat[] => [
  { at, parts: { [part]: { pose: open ? 'closed' : 'open' } } },
  { at: at + duration, parts: { [part]: { pose: open ? 'open' : 'closed' } }, easing: 'easeInOut' },
]

/** A pose cycle repeated between two times, back on its first pose by the end. */
export const cycle = (part: string, poses: readonly string[], period: number, from: number, to: number, easing?: Beat['easing']): Beat[] => {
  const beats: Beat[] = []
  const step = period / poses.length
  let t = from
  let i = 0
  while (t < to - step / 2) {
    beats.push({ at: Math.round(t), parts: { [part]: { pose: poses[i % poses.length]! } }, ...(easing === undefined ? {} : { easing }) })
    t += step
    i++
  }
  beats.push({ at: Math.round(to), parts: { [part]: { pose: poses[0]! } }, ...(easing === undefined ? {} : { easing }) })
  return beats
}

// ---------------------------------------------------------------------------------------------
// The camera

export interface Shot {
  readonly at: number
  readonly to: Vec2
  readonly width: number
  readonly easing?: Beat['easing']
}

/** A run of camera positions, each reached at its own time. The first is where it starts. */
export const camera = (shots: readonly Shot[]): Beat[] =>
  shots.map((shot) => ({
    at: Math.round(shot.at),
    camera: { at: vec(shot.to), width: roundTo(shot.width) },
    ...(shot.easing === undefined ? {} : { easing: shot.easing }),
  }))

/** Scene coordinates of a cell at a height — for aiming the camera at a place. */
export const look = (cell: Cell, z = 0): Vec2 => project([cell[0], cell[1], z])

/** A point between two, for framing two things at once. */
export const between = (a: Vec2, b: Vec2, t = 0.5): Vec2 => vec([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])

/** The person's feet, so a standing figure can be aimed at. */
export const FEET = PERSON_FEET
