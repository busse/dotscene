/**
 * Composing overlapping acts onto one keyframe timeline.
 *
 * A keyframe is a single global instant, so splicing keyframe arrays end to end can only
 * ever show one thing happening at a time. An animation with any density needs acts that
 * run *over* each other: a document still in flight while a truck is already loading.
 *
 * So an act declares beats on its own clock, and `compose` bakes a set of placed acts down
 * onto one shared list. Keyframes are sparse — a part appears only at the instants its own
 * act asked for — because the runtime interpolates every part between the keyframes that
 * mention it, easing each segment by the keyframe it is heading into.
 *
 * That last point is what keeps a busy timeline small. A beat's easing is written onto its
 * keyframe, and the runtime honours it; when two beats land on the same instant wanting
 * different easings, each part simply carries its own. Nothing is ever resampled or baked,
 * so an act can ease everything and pay nothing for it.
 *
 * The camera is a track like any other: an act may move it, and two acts moving it at once
 * is the same authoring mistake as two acts moving one part.
 */

import type { CameraKeyframe, EasingName, Keyframe, Part, PartKeyframe, Vec2 } from './model.ts'
import { partId } from './model.ts'
import { issueError, type Issue } from './validate.ts'

/** One instant in an act's own clock: where some of its parts are, and how they got there. */
export interface Beat {
  /** Milliseconds from the act's start. */
  readonly at: number
  readonly parts?: Readonly<Record<string, PartKeyframe>>
  /** Where the camera is at this beat. */
  readonly camera?: CameraKeyframe
  /** How the parts in this beat travel *into* it. */
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
  /** Accepted for compatibility; nothing is resampled any more, so nothing needs the figures. */
  readonly parts?: readonly Part[]
  /** Accepted for compatibility; nothing is baked any more. */
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

/** The reserved track the camera rides on. */
const CAMERA = '$camera'

interface Moment<T> {
  readonly at: number
  readonly state: T
  readonly easing: EasingName
  readonly act: string
}

/** Every track's own timeline, in order, with the act each moment came from. */
const timelines = (placements: readonly Placement[]): Map<string, Moment<PartKeyframe | CameraKeyframe>[]> => {
  const byTrack = new Map<string, Moment<PartKeyframe | CameraKeyframe>[]>()
  const push = (track: string, moment: Moment<PartKeyframe | CameraKeyframe>): void => {
    ;(byTrack.get(track) ?? byTrack.set(track, []).get(track)!).push(moment)
  }
  for (const { act, at: offset } of placements) {
    for (const beat of act.beats) {
      const easing = beat.easing ?? 'linear'
      for (const [part, state] of Object.entries(beat.parts ?? {})) {
        push(part, { at: offset + beat.at, state, easing, act: act.name })
      }
      if (beat.camera !== undefined) push(CAMERA, { at: offset + beat.at, state: beat.camera, easing, act: act.name })
    }
  }
  for (const list of byTrack.values()) list.sort((a, b) => a.at - b.at)
  return byTrack
}

/**
 * Two acts driving one track at the same time is an authoring mistake, not a blend.
 *
 * Touching at the ends is fine and is how a part is handed on; genuine overlap means two
 * acts each believe they own it, and whichever sorts later silently wins.
 */
const findOverlaps = (byTrack: Map<string, Moment<unknown>[]>): Issue[] => {
  const issues: Issue[] = []
  for (const [track, moments] of byTrack) {
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
        const what = track === CAMERA ? 'the camera' : `'${track}'`
        issues.push({
          code: 'ACT_OVERLAP',
          part: track,
          act: `${actA} / ${actB}`,
          message: `acts '${actA}' (${a.from}–${a.to}ms) and '${actB}' (${b.from}–${b.to}ms) both move ${what} at the same time`,
        })
      }
    }
  }
  return issues
}

/** Bake a set of placed acts down onto one keyframe list. */
export const compose = (placements: readonly Placement[], options: ComposeOptions = {}): Composed => {
  const name = options.name ?? ((ms: number) => `t${ms}`)

  const byTrack = timelines(placements)
  const overlaps = findOverlaps(byTrack)
  if (overlaps.length > 0) throw issueError(overlaps)

  // What each instant's keyframe will ease by: the easing most of the beats there want. Any
  // beat that wants something else carries its own, and the runtime honours it per part.
  const wanted = new Map<number, Map<EasingName, number>>()
  for (const moments of byTrack.values()) {
    moments.forEach((moment, i) => {
      // The first beat of a track has nothing to ease from, so it has no opinion.
      if (i === 0) return
      const tally = wanted.get(moment.at) ?? wanted.set(moment.at, new Map()).get(moment.at)!
      tally.set(moment.easing, (tally.get(moment.easing) ?? 0) + 1)
    })
  }
  const easingAt = (at: number): EasingName => {
    const tally = wanted.get(at)
    if (tally === undefined) return 'linear'
    let best: EasingName = 'linear'
    let count = -1
    for (const [easing, n] of tally) {
      if (n > count) {
        best = easing
        count = n
      }
    }
    return best
  }

  const times = [...new Set([...byTrack.values()].flatMap((moments) => moments.map((m) => m.at)))].sort((a, b) => a - b)
  if (times.length === 0) return { keyframes: [], duration: 0, acts: {} }

  const keyframes: Keyframe[] = []
  const acts: Record<string, string[]> = {}

  // Each track in order, with a cursor, so building the list is one pass rather than a search.
  const cursors = new Map<string, number>()
  for (const track of byTrack.keys()) cursors.set(track, 0)

  times.forEach((at, index) => {
    const parts: Record<string, PartKeyframe> = {}
    let camera: CameraKeyframe | undefined
    const contributing = new Set<string>()
    const easing = easingAt(at)

    for (const [track, moments] of byTrack) {
      let cursor = cursors.get(track)!
      let moment = moments[cursor]
      if (moment === undefined || moment.at !== at) continue
      // Two beats of one act at the same instant: the later one written wins.
      while (moments[cursor + 1]?.at === at) {
        cursor++
        moment = moments[cursor]!
      }
      cursors.set(track, cursor + 1)
      contributing.add(moment.act)
      // The first beat of a track carries no easing; later ones only when they differ.
      const own = cursor > 0 && moment.easing !== easing ? { easing: moment.easing } : {}
      if (track === CAMERA) camera = { ...(moment.state as CameraKeyframe), ...own }
      else parts[track] = { ...(moment.state as PartKeyframe), ...own }
    }

    const label = name(at)
    acts[label] = [...contributing]
    keyframes.push({
      name: label,
      // The first keyframe is the loop's cut, so it takes no time at all.
      duration: index === 0 ? 0 : at - times[index - 1]!,
      hold: 0,
      easing,
      parts,
      ...(camera === undefined ? {} : { camera }),
    })
  })

  return { keyframes, duration: times[times.length - 1]! - times[0]!, acts }
}

/**
 * Whether two states put a part in the same place. A field one side leaves out means "as
 * declared", so only fields both sides state are compared.
 */
const sameState = (a: PartKeyframe, b: PartKeyframe): boolean => {
  const both = <T>(p: T | undefined, q: T | undefined, same: (x: T, y: T) => boolean): boolean =>
    p === undefined || q === undefined || same(p, q)
  if (!both(a.at, b.at, (p, q) => p[0] === q[0] && p[1] === q[1])) return false
  if (!both(a.depth, b.depth, (p, q) => Math.abs(p - q) <= 1e-6)) return false
  if (!both(a.opacity, b.opacity, (p, q) => p === q)) return false
  if (!both(a.rotate, b.rotate, (p, q) => p === q)) return false
  if (!both(a.flipX, b.flipX, (p, q) => p === q)) return false
  if (!both(a.scale, b.scale, (p, q) => JSON.stringify(p) === JSON.stringify(q))) return false
  const pose = (p: NonNullable<PartKeyframe['pose']>): string => (typeof p === 'string' ? p : JSON.stringify(p.points))
  return both(a.pose, b.pose, (p, q) => pose(p) === pose(q))
}

/**
 * Parts whose state at the end of a timeline differs from their state at the start.
 *
 * A loop cuts from the last keyframe back to the first, so anything left somewhere else
 * jumps in full view. Each part is judged on its own last mention against its opening
 * state — its first keyframe if that is keyframe 0, otherwise how the scene declares it,
 * which is what the timeline shows before a part's first step. Pass the scene's parts for
 * that second case. An empty list means the seam is invisible.
 */
export const loopGaps = (composed: Composed, parts: readonly Part[] = []): readonly string[] => {
  const declared = new Map<string, PartKeyframe>()
  for (const part of parts) {
    declared.set(partId(part), {
      ...(part.at === undefined ? {} : { at: part.at }),
      ...(part.depth === undefined ? {} : { depth: part.depth }),
      ...(part.opacity === undefined ? {} : { opacity: part.opacity }),
      ...(part.scale === undefined ? {} : { scale: part.scale }),
      ...(part.rotate === undefined ? {} : { rotate: part.rotate }),
      ...(part.flipX === undefined ? {} : { flipX: part.flipX }),
      ...(part.pose === undefined ? {} : { pose: part.pose }),
    })
  }
  const opening = new Map<string, PartKeyframe>()
  const last = new Map<string, PartKeyframe>()
  composed.keyframes.forEach((keyframe, index) => {
    for (const [part, state] of Object.entries(keyframe.parts ?? {})) {
      if (!opening.has(part)) opening.set(part, index === 0 ? state : (declared.get(part) ?? state))
      last.set(part, state)
    }
  })
  const gaps: string[] = []
  for (const [part, start] of opening) {
    const end = last.get(part)!
    // Something invisible at both ends can be anywhere at both ends.
    if ((start.opacity ?? 1) <= 0 && (end.opacity ?? 1) <= 0) continue
    if (!sameState(start, end)) gaps.push(part)
  }
  return gaps
}
