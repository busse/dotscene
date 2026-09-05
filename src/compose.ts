/**
 * Composing overlapping acts onto one keyframe timeline.
 *
 * A keyframe is a single global instant, so splicing keyframe arrays end to end can only
 * ever show one thing happening at a time. An animation with any density needs acts that
 * run *over* each other: a document still in flight while a truck is already loading.
 *
 * So an act declares beats on its own clock, and `compose` bakes a set of placed acts down
 * onto one shared list. Two rules make that correct, and both are easy to get wrong:
 *
 *   - **Resample whatever is mid-move.** A part missing from a keyframe is simply not
 *     repainted, so it freezes there and jumps at the next keyframe that does mention it.
 *     Any part travelling through an instant another act asked for has to be given its
 *     interpolated state at that instant too.
 *   - **Subdivide eased segments.** The runtime interpolates linearly between keyframes, so
 *     a curve has to be baked into samples here. That is a feature rather than a tax: an act
 *     can use any easing without the runtime knowing anything about it.
 */

import type { EasingName, Figure, Keyframe, Part, PartKeyframe, Pose, Vec2 } from './model.ts'
import { definePose, partId } from './model.ts'
import { easingFor, lerpPoints, posePoints } from './poses.ts'
import { lerpVec, round } from './geometry.ts'
import { issueError, type Issue } from './validate.ts'

/** One instant in an act's own clock: where some of its parts are, and how they got there. */
export interface Beat {
  /** Milliseconds from the act's start. */
  readonly at: number
  readonly parts: Readonly<Record<string, PartKeyframe>>
  /** How the parts in this beat travel *into* it. Baked here, not asked of the runtime. */
  readonly easing?: EasingName
}

export interface Act {
  readonly name: string
  readonly beats: readonly Beat[]
}

/** An act, and when it starts on the shared timeline. */
export interface Placement {
  readonly act: Act
  readonly at: number
}

export interface ComposeOptions {
  /** The scene's parts, so a segment that changes pose can be interpolated properly. */
  readonly parts?: readonly Part[]
  /** Longest gap left inside an eased segment. Smaller is smoother and heavier. Default 150. */
  readonly maxStep?: number
  /** Names the keyframe at a given millisecond. Default `t<ms>`. */
  readonly name?: (ms: number) => string
}

export interface Composed {
  readonly keyframes: readonly Keyframe[]
  /** Total length of the timeline in milliseconds. */
  readonly duration: number
  /** Keyframe name -> the acts contributing to it, for inspection. */
  readonly acts: Readonly<Record<string, readonly string[]>>
}

interface Moment {
  readonly at: number
  readonly state: PartKeyframe
  readonly easing: EasingName
  readonly act: string
}

const lerpNumber = (from: number, to: number, t: number): number => round(from + (to - from) * t, 3)

const lerpScale = (from: number | Vec2, to: number | Vec2, t: number): number | Vec2 => {
  if (typeof from === 'number' && typeof to === 'number') return lerpNumber(from, to, t)
  const a: Vec2 = typeof from === 'number' ? [from, from] : from
  const b: Vec2 = typeof to === 'number' ? [to, to] : to
  return [lerpNumber(a[0], b[0], t), lerpNumber(a[1], b[1], t)]
}

/**
 * A part's state part-way between two beats.
 *
 * Poses are the awkward one. Two keyframes naming different poses already tween correctly,
 * because the renderer turns each into points and the runtime moves the points — but a
 * *third* keyframe forced between them by another act would otherwise carry one end's pose
 * and make the change snap. So a resampled pose is built by interpolating the two, the same
 * trick the walk cycle uses for gait phase.
 */
const lerpState = (from: PartKeyframe, to: PartKeyframe, t: number, figure?: Figure): PartKeyframe => {
  const state: Record<string, unknown> = {}

  if (from.at !== undefined && to.at !== undefined) {
    const [x, y] = lerpVec(from.at, to.at, t)
    state.at = [round(x, 3), round(y, 3)]
  } else if ((from.at ?? to.at) !== undefined) {
    state.at = from.at ?? to.at
  }

  if (from.depth !== undefined && to.depth !== undefined) state.depth = lerpNumber(from.depth, to.depth, t)
  else if ((from.depth ?? to.depth) !== undefined) state.depth = from.depth ?? to.depth

  if (from.rotate !== undefined && to.rotate !== undefined) state.rotate = lerpNumber(from.rotate, to.rotate, t)
  else if ((from.rotate ?? to.rotate) !== undefined) state.rotate = from.rotate ?? to.rotate

  if (from.scale !== undefined && to.scale !== undefined) state.scale = lerpScale(from.scale, to.scale, t)
  else if ((from.scale ?? to.scale) !== undefined) state.scale = from.scale ?? to.scale

  // Neither of these can be halfway, so they change at the midpoint.
  const nearer = t < 0.5 ? from : to
  if (nearer.flipX !== undefined) state.flipX = nearer.flipX

  if (from.pose === to.pose || to.pose === undefined) {
    if (from.pose !== undefined) state.pose = from.pose
  } else if (from.pose === undefined || figure === undefined) {
    state.pose = nearer.pose
  } else {
    state.pose = definePose(
      figure,
      `mix${Math.round(t * 1000)}`,
      lerpPoints(posePoints(figure, from.pose), posePoints(figure, to.pose), t),
    )
  }

  return state as PartKeyframe
}

/** A part's own timeline, in order, with the act each moment came from. */
const timelines = (placements: readonly Placement[]): Map<string, Moment[]> => {
  const byPart = new Map<string, Moment[]>()
  for (const { act, at: offset } of placements) {
    for (const beat of act.beats) {
      for (const [part, state] of Object.entries(beat.parts)) {
        const list = byPart.get(part) ?? []
        list.push({ at: offset + beat.at, state, easing: beat.easing ?? 'linear', act: act.name })
        byPart.set(part, list)
      }
    }
  }
  for (const list of byPart.values()) list.sort((a, b) => a.at - b.at)
  return byPart
}

/**
 * Two acts driving one part at the same time is an authoring mistake, not a blend.
 *
 * Touching at the ends is fine and is how a part is handed on; genuine overlap means two
 * acts each believe they own it, and whichever sorts later silently wins.
 */
const findOverlaps = (byPart: Map<string, Moment[]>): Issue[] => {
  const issues: Issue[] = []
  for (const [part, moments] of byPart) {
    const spans = new Map<string, { from: number; to: number }>()
    for (const moment of moments) {
      const span = spans.get(moment.act)
      if (span === undefined) spans.set(moment.act, { from: moment.at, to: moment.at })
      else span.to = Math.max(span.to, moment.at)
    }
    const entries = [...spans.entries()].sort((a, b) => a[1].from - b[1].from)
    for (let i = 1; i < entries.length; i++) {
      const [actA, a] = entries[i - 1]!
      const [actB, b] = entries[i]!
      if (b.from < a.to) {
        issues.push({
          code: 'ACT_OVERLAP',
          part,
          act: `${actA} / ${actB}`,
          message: `acts '${actA}' (${a.from}–${a.to}ms) and '${actB}' (${b.from}–${b.to}ms) both move '${part}' at the same time`,
        })
      }
    }
  }
  return issues
}

/** Bake a set of placed acts down onto one keyframe list. */
export const compose = (placements: readonly Placement[], options: ComposeOptions = {}): Composed => {
  const maxStep = options.maxStep ?? 150
  const name = options.name ?? ((ms: number) => `t${ms}`)
  const figures = new Map<string, Figure>()
  for (const part of options.parts ?? []) figures.set(partId(part), part.figure)

  const byPart = timelines(placements)
  const overlaps = findOverlaps(byPart)
  if (overlaps.length > 0) throw issueError(overlaps)

  // Every instant some act asked for, plus enough extra inside eased segments to bake them.
  const times = new Set<number>()
  for (const moments of byPart.values()) {
    for (const moment of moments) times.add(moment.at)
    for (let i = 1; i < moments.length; i++) {
      const from = moments[i - 1]!
      const to = moments[i]!
      if (to.easing === 'linear') continue
      const steps = Math.ceil((to.at - from.at) / maxStep)
      for (let step = 1; step < steps; step++) {
        times.add(Math.round(from.at + ((to.at - from.at) * step) / steps))
      }
    }
  }
  if (times.size === 0) return { keyframes: [], duration: 0, acts: {} }

  const ordered = [...times].sort((a, b) => a - b)
  const keyframes: Keyframe[] = []
  const acts: Record<string, string[]> = {}

  ordered.forEach((at, index) => {
    const parts: Record<string, PartKeyframe> = {}
    const contributing = new Set<string>()

    for (const [part, moments] of byPart) {
      const first = moments[0]!
      const last = moments[moments.length - 1]!
      // Outside its own span a part is left alone: it holds wherever it was last painted,
      // which is what parks a token off-frame between flights for free.
      if (at < first.at || at > last.at) continue

      let next = moments.findIndex((moment) => moment.at >= at)
      if (next < 0) next = moments.length - 1
      const to = moments[next]!
      contributing.add(to.act)

      if (to.at === at || next === 0) {
        parts[part] = to.state
        continue
      }
      const from = moments[next - 1]!
      const span = to.at - from.at
      const raw = span === 0 ? 1 : (at - from.at) / span
      parts[part] = lerpState(from.state, to.state, easingFor(to.easing)(raw), figures.get(part))
    }

    const label = name(at)
    acts[label] = [...contributing]
    keyframes.push({
      name: label,
      // The first keyframe is the loop's cut, so it takes no time at all.
      duration: index === 0 ? 0 : at - ordered[index - 1]!,
      hold: 0,
      // Everything is already baked, so the runtime only ever walks straight lines.
      easing: 'linear',
      parts,
    })
  })

  return { keyframes, duration: ordered[ordered.length - 1]! - ordered[0]!, acts }
}

/**
 * Parts whose state at the end of a timeline differs from their state at the start.
 *
 * A loop cuts from the last keyframe back to the first, so anything left somewhere else
 * jumps in full view. Run this over a timeline meant to loop; an empty list means the seam
 * is invisible.
 */
export const loopGaps = (composed: Composed): readonly string[] => {
  const first = composed.keyframes[0]
  const last = composed.keyframes[composed.keyframes.length - 1]
  if (first === undefined || last === undefined) return []
  const gaps: string[] = []
  for (const [part, state] of Object.entries(last.parts ?? {})) {
    const start = first.parts?.[part]
    if (start === undefined || start.at === undefined || state.at === undefined) continue
    if (start.at[0] !== state.at[0] || start.at[1] !== state.at[1]) gaps.push(part)
  }
  return gaps
}
