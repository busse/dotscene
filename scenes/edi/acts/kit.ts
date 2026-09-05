/**
 * What every act is made of.
 *
 * An act declares *what happens* — this message goes from here to there, the rig runs this
 * stretch of road — and this file turns that into beats. Keeping the two apart is what makes
 * an act file readable, and what lets the tempo, the arc shape or the way a token appears be
 * changed once rather than twelve times.
 */

import { compose, defineScene, easings, type Act, type Beat, type Part, type Vec2 } from 'dotscene'
import { along, joinsBetween } from '../route.ts'
import { nodeAt } from '../network.ts'
import { PARKED, shapes, type TokenShape } from '../tokens.ts'
import { HERO_VIEWBOX } from '../projection.ts'
import { css, paper, GROUND_PAPER } from '../palette.ts'
import { rigPart, stageParts, TOKEN_DEPTH } from '../stage.ts'

/** One message crossing the network. */
export interface Flight {
  readonly shape: TokenShape
  /** Network node ids. */
  readonly from: string
  readonly to: string
  /** Milliseconds from the act's start. */
  readonly at: number
  readonly duration: number
  /** How far the arc bows above the straight line, in screen units. */
  readonly lift?: number
}

/** The rig running a stretch of route, as a fraction of the whole journey. */
export interface Drive {
  readonly from: number
  readonly to: number
  readonly at: number
  readonly duration: number
  /** Snap back to the start of the route afterwards, so a loop's cut is invisible. */
  readonly parkAfter?: boolean
}

/**
 * A message's flight, baked as sample points along a bowed curve.
 *
 * Sampled rather than eased, deliberately. The compositor would happily subdivide an eased
 * segment, but a straight line eased is still a straight line — an arc has to be positions.
 * Since the samples are being generated anyway, the easing goes into *where* they sit rather
 * than into the timing, so the token accelerates away and settles without the runtime or the
 * compositor doing anything but walk straight lines between them.
 */
const flightBeats = (part: string, flight: Flight, samples = 4): Beat[] => {
  const from = nodeAt(flight.from)
  const to = nodeAt(flight.to)
  const lift = flight.lift ?? -Math.min(34, Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.22)
  // Control point of a quadratic, lifted above the midpoint.
  const control: Vec2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + lift]

  // Parked at both ends, one millisecond either side of the flight. Symmetry matters here:
  // a token that starts its life already at a node pops into existence when a loop cuts back
  // to the beginning, and one that ends at a node lingers there for the rest of the run.
  const beats: Beat[] = [{ at: flight.at, parts: { [part]: { at: PARKED } } }]
  for (let i = 0; i <= samples; i++) {
    const t = easings.easeInOut(i / samples)
    const inv = 1 - t
    const x = inv * inv * from[0] + 2 * inv * t * control[0] + t * t * to[0]
    const y = inv * inv * from[1] + 2 * inv * t * control[1] + t * t * to[1]
    beats.push({
      at: flight.at + 1 + Math.round((flight.duration * i) / samples),
      parts: { [part]: { at: [Math.round(x * 100) / 100, Math.round(y * 100) / 100] } },
    })
  }
  beats.push({ at: flight.at + flight.duration + 2, parts: { [part]: { at: PARKED } } })
  return beats
}

/**
 * The rig's beats along a stretch of route.
 *
 * Two things have to be right. Depth is sampled with position, so the rig crosses the paint
 * order where the road does. And at a corner the orientation flips over one millisecond
 * rather than tweening: the rig's two poses name the same corners in different places, so a
 * slow blend turns the solid inside out.
 */
const driveBeats = (drive: Drive): Beat[] => {
  const beats: Beat[] = []

  // An act's first beat must establish everything it will move, or the act is only correct
  // in sequence and not on its own. A drive that starts late needs the rig pinned where it
  // begins — which is also what makes a dwell at a dock explicit rather than implied.
  if (drive.at > 0) {
    const start = along(drive.from)
    beats.push({ at: 0, parts: { rig: { at: start.at, depth: start.depth, pose: start.axis } } })
  }

  const stops = [drive.from, ...joinsBetween(drive.from, drive.to), drive.to]
  const span = drive.to - drive.from
  let axis = along(drive.from).axis

  for (const t of stops) {
    const at = drive.at + Math.round((drive.duration * (t - drive.from)) / (span === 0 ? 1 : span))
    const here = along(t)
    if (here.axis !== axis) {
      // Hold the old orientation until the corner, then flip over a single millisecond. The
      // rig's poses name the same corners in different places, so a slow blend would turn
      // the solid inside out.
      beats.push({ at: at - 1, parts: { rig: { at: here.at, depth: here.depth, pose: axis } } })
      axis = here.axis
    }
    beats.push({ at, parts: { rig: { at: here.at, depth: here.depth, pose: here.axis } } })
  }
  if (drive.parkAfter === true) {
    const home = along(0)
    beats.push({
      at: drive.at + drive.duration + 1,
      parts: { rig: { at: home.at, depth: home.depth, pose: home.axis } },
    })
  }
  return beats
}

export interface EdiAct {
  readonly id: string
  readonly title: string
  readonly act: Act
  /** The token parts this act needs, on top of the stage and the rig. */
  readonly parts: readonly Part[]
  readonly duration: number
  /** The stretch of route this act drives, if any — how acts hand the rig on. */
  readonly drive?: Drive
  /** The act on its own, so it can be previewed and built without the rest. */
  readonly scene: ReturnType<typeof defineScene>
}

export const defineAct = (spec: {
  readonly id: string
  readonly title: string
  readonly flights?: readonly Flight[]
  readonly drive?: Drive
  /** A deliberate pause after the last beat, before whatever the hero places next. */
  readonly tail?: number
}): EdiAct => {
  const flights = spec.flights ?? []

  // One part per message, named for its act, so two acts can never think they own the same
  // token — the compositor treats that as an authoring mistake, and it would be one.
  const parts: Part[] = flights.map((flight, i) => ({
    figure: shapes[flight.shape](`${spec.id}m${i}`),
    id: `${spec.id}m${i}`,
    at: PARKED,
    depth: TOKEN_DEPTH,
  }))

  const beats: Beat[] = [
    ...flights.flatMap((flight, i) => flightBeats(`${spec.id}m${i}`, flight)),
    ...(spec.drive === undefined ? [] : driveBeats(spec.drive)),
  ].sort((a, b) => a.at - b.at)

  const act: Act = { name: spec.id, beats }
  // Measured, not declared. A hand-written duration drifts from the beats the moment either
  // changes, and the hero spaces acts by this number.
  const duration = Math.max(...beats.map((b) => b.at)) + (spec.tail ?? 0)

  const rigAt = spec.drive?.from ?? 0
  const cast = [...stageParts, rigPart(rigAt), ...parts]
  const { keyframes } = compose([{ act, at: 0 }], { parts: cast })

  const scene = defineScene(spec.id, {
    title: spec.title,
    parts: cast,
    viewBox: HERO_VIEWBOX,
    dotRadius: 0.95,
    lineWidth: 0.45,
    background: GROUND_PAPER,
    css: css(paper),
    animate: { mode: 'loop', keyframes },
  })

  return {
    id: spec.id,
    title: spec.title,
    act,
    parts,
    duration,
    ...(spec.drive === undefined ? {} : { drive: spec.drive }),
    scene,
  }
}
