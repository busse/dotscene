/**
 * The clock an animated scene runs on, and how anything is read off it at an instant.
 *
 * Keyframes are sparse: a part appears only in the steps that move it. So a part is not
 * "at keyframe 7"; it is somewhere between the last step that mentioned it and the next one
 * that will. This module turns a keyframe list into absolute times and answers, for any
 * part, camera or paint-order value, *where is it at millisecond t*.
 *
 * Both the browser runtime and the terminal preview use it, so what `preview --at 12000`
 * draws is exactly what the page shows at twelve seconds. That is the whole reason it is a
 * separate, pure module rather than a detail of the runtime.
 */

import type { AnimateMode, EasingName, Vec2 } from './model.ts'
import { easingFor } from './poses.ts'

export interface Timing {
  /** Milliseconds to transition into the keyframe. Default 0. */
  readonly duration?: number
  /** Milliseconds held there. Default 0. */
  readonly hold?: number
  readonly easing?: EasingName
}

/** Every keyframe's place on one absolute clock. */
export interface Schedule {
  readonly names: readonly string[]
  /** Millisecond at which each keyframe is reached. The first is always 0. */
  readonly arrive: readonly number[]
  /** Millisecond at which each keyframe's hold ends. */
  readonly leave: readonly number[]
  /** Where the last hold ends — the far end of a pingpong. */
  readonly end: number
  /** One full lap of a loop: `end` plus the transition back into the first keyframe. */
  readonly total: number
  readonly easing: (index: number) => EasingName
}

export const schedule = (
  names: readonly string[],
  timings: Readonly<Record<string, Timing>>,
  fallbackEasing: EasingName = 'easeInOut',
): Schedule => {
  const arrive: number[] = []
  const leave: number[] = []
  let clock = 0
  names.forEach((name, index) => {
    const timing = timings[name] ?? { duration: 700, hold: 900 }
    if (index > 0) clock += Math.max(0, timing.duration ?? 0)
    arrive.push(clock)
    clock += Math.max(0, timing.hold ?? 0)
    leave.push(clock)
  })
  const end = leave[leave.length - 1] ?? 0
  const wrap = names.length > 0 ? Math.max(0, timings[names[0]!]?.duration ?? 0) : 0
  return {
    names,
    arrive,
    leave,
    end,
    total: end + wrap,
    easing: (index) => timings[names[index] ?? '']?.easing ?? fallbackEasing,
  }
}

/** The keyframes that mention one thing, and its value at each. */
export interface Track<T> {
  /** Keyframe indices, ascending. */
  readonly keys: readonly number[]
  readonly values: readonly T[]
  /** An easing of the track's own for the segment into each key, over the keyframe's. */
  readonly easings?: readonly (EasingName | undefined)[]
}

export type Lerp<T> = (from: T, to: T, t: number) => T

const lastAtOrBefore = (keys: readonly number[], arrive: readonly number[], t: number): number => {
  let low = 0
  let high = keys.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (arrive[keys[mid]!]! <= t) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

const ease = <T>(sched: Schedule, track: Track<T>, j: number): EasingName => track.easings?.[j] ?? sched.easing(track.keys[j]!)

/**
 * Where one track is at time `t`.
 *
 * Before its first step a track holds `rest` — what the static scene drew — and travels
 * from there during the transition into that step, the same way a keyframe reads for a
 * part that is in every step: "it gets here during the move into this one". Between steps
 * it interpolates, eased by the step it is heading into. After its last step it holds, and
 * in a loop the wrap carries it back to its opening state over the first keyframe's
 * duration: a duration of 0 there is the cut.
 */
export const sampleTrack = <T>(sched: Schedule, track: Track<T>, rest: T, t: number, lerp: Lerp<T>, mode: AnimateMode): T => {
  const { keys, values } = track
  if (keys.length === 0) return rest
  const opening = keys[0] === 0 ? values[0]! : rest

  const j = lastAtOrBefore(keys, sched.arrive, t)
  if (j < 0) {
    const first = keys[0]!
    const from = sched.leave[first - 1] ?? 0
    if (t <= from) return rest
    const span = sched.arrive[first]! - from
    const raw = span <= 0 ? 1 : (t - from) / span
    return lerp(rest, values[0]!, easingFor(ease(sched, track, 0))(Math.min(1, Math.max(0, raw))))
  }

  const key = keys[j]!
  if (t <= sched.leave[key]!) return values[j]!

  if (j + 1 < keys.length) {
    const nextKey = keys[j + 1]!
    const span = sched.arrive[nextKey]! - sched.leave[key]!
    const raw = span <= 0 ? 1 : (t - sched.leave[key]!) / span
    return lerp(values[j]!, values[j + 1]!, easingFor(ease(sched, track, j + 1))(Math.min(1, Math.max(0, raw))))
  }

  // Past the last step. Held until the lap ends; then, in a loop, tweened home.
  if (mode !== 'loop' || t <= sched.end) return values[j]!
  const wrap = sched.total - sched.end
  const raw = wrap <= 0 ? 1 : (t - sched.end) / wrap
  return lerp(values[j]!, opening, easingFor(sched.easing(0))(Math.min(1, Math.max(0, raw))))
}

/**
 * One part's points at one keyframe: a flat run of coordinates, `x, y, x, y…`, in the order
 * of that part's `points` table. Names are sent once per part rather than once per point
 * per keyframe, which for a long scene is most of the payload.
 */
export type Frame = readonly number[]

/** Every moving part at one keyframe, keyed by part id. */
export type SceneFrame = Readonly<Record<string, Frame>>

export type ViewBox = readonly [number, number, number, number]

/** A sparse per-keyframe table with a resting value for every part: depths, opacities. */
export interface Sparse<T> {
  readonly base: Readonly<Record<string, T>>
  readonly byFrame: Readonly<Record<string, Readonly<Record<string, T>>>>
}

/** The payload an animated scene ships, and the shape the runtime and the preview read. */
export interface TimelineConfig {
  readonly cycle: readonly string[]
  /** Point names for each moving part, in the order its frames list coordinates. */
  readonly points: Readonly<Record<string, readonly string[]>>
  readonly frames: Readonly<Record<string, SceneFrame>>
  readonly timings: Readonly<Record<string, Timing>>
  /** Per-part easings that differ from their keyframe's. Sparse. */
  readonly easings?: Readonly<Record<string, Readonly<Record<string, EasingName>>>>
  readonly easing: EasingName
  readonly mode: AnimateMode
  readonly depths?: Sparse<number>
  readonly opacity?: Sparse<number>
  readonly camera?: {
    readonly base: ViewBox
    readonly byFrame: Readonly<Record<string, ViewBox>>
    /** The camera's own easing into a keyframe, where it differs from the keyframe's. */
    readonly easings?: Readonly<Record<string, EasingName>>
  }
  readonly sizing?: 'scene' | 'screen'
}

export const lerpNumber: Lerp<number> = (a, b, t) => a + (b - a) * t

/** Coordinates `from` has that `to` lacks hold still, so a short frame never drags a point to 0. */
export const lerpFrame: Lerp<Frame> = (from, to, t) => {
  if (t <= 0) return from
  if (t >= 1 && to.length >= from.length) return to
  const out: number[] = new Array(from.length)
  for (let i = 0; i < from.length; i++) {
    const a = from[i]!
    const b = to[i] ?? a
    out[i] = a + (b - a) * t
  }
  return out
}

/**
 * A camera move interpolates its centre and its width separately, so a pan and a zoom can
 * share one segment without the frame's corners taking curved paths.
 */
export const lerpViewBox: Lerp<ViewBox> = (a, b, t) => {
  if (t <= 0) return a
  if (t >= 1) return b
  const cx = a[0] + a[2] / 2 + (b[0] + b[2] / 2 - a[0] - a[2] / 2) * t
  const cy = a[1] + a[3] / 2 + (b[1] + b[3] / 2 - a[1] - a[3] / 2) * t
  const w = a[2] + (b[2] - a[2]) * t
  const h = a[3] + (b[3] - a[3]) * t
  return [cx - w / 2, cy - h / 2, w, h]
}

/** Every track a config carries, built once so sampling is a lookup rather than a scan. */
export interface Tracks {
  readonly schedule: Schedule
  readonly parts: ReadonlyMap<string, Track<Frame>>
  readonly depths: ReadonlyMap<string, Track<number>>
  readonly opacity: ReadonlyMap<string, Track<number>>
  readonly camera?: Track<ViewBox>
}

const tracksFrom = <T>(
  names: readonly string[],
  byFrame: Readonly<Record<string, Readonly<Record<string, T>>>>,
  easings?: Readonly<Record<string, Readonly<Record<string, EasingName>>>>,
): Map<string, Track<T>> => {
  const keys = new Map<string, number[]>()
  const values = new Map<string, T[]>()
  const eased = new Map<string, (EasingName | undefined)[]>()
  names.forEach((name, index) => {
    for (const [id, value] of Object.entries(byFrame[name] ?? {})) {
      ;(keys.get(id) ?? keys.set(id, []).get(id)!).push(index)
      ;(values.get(id) ?? values.set(id, []).get(id)!).push(value)
      ;(eased.get(id) ?? eased.set(id, []).get(id)!).push(easings?.[name]?.[id])
    }
  })
  const out = new Map<string, Track<T>>()
  for (const [id, k] of keys) {
    const e = eased.get(id)!
    out.set(id, { keys: k, values: values.get(id)!, ...(e.some((x) => x !== undefined) ? { easings: e } : {}) })
  }
  return out
}

export const buildTracks = (config: TimelineConfig): Tracks => {
  const names = config.cycle.length > 0 ? config.cycle : Object.keys(config.frames)
  const sched = schedule(names, config.timings, config.easing)
  let camera: Track<ViewBox> | undefined
  if (config.camera !== undefined) {
    const keys: number[] = []
    const values: ViewBox[] = []
    const easings: (EasingName | undefined)[] = []
    names.forEach((name, index) => {
      const view = config.camera!.byFrame[name]
      if (view === undefined) return
      keys.push(index)
      values.push(view)
      easings.push(config.camera!.easings?.[name])
    })
    if (keys.length > 0) camera = { keys, values, ...(easings.some((x) => x !== undefined) ? { easings } : {}) }
  }
  return {
    schedule: sched,
    parts: tracksFrom(names, config.frames, config.easings),
    depths: tracksFrom(names, config.depths?.byFrame ?? {}, config.easings),
    opacity: tracksFrom(names, config.opacity?.byFrame ?? {}, config.easings),
    ...(camera === undefined ? {} : { camera }),
  }
}

/** Everything that can differ from the static drawing at one instant. */
export interface Sample {
  /** Only the parts that have a track. Others are wherever the static scene put them. */
  readonly frame: SceneFrame
  readonly depths?: Readonly<Record<string, number>>
  readonly opacity?: Readonly<Record<string, number>>
  readonly camera?: ViewBox
}

/**
 * The scene at millisecond `t`.
 *
 * `rest` is what the static drawing shows for each moving part — the state a track holds
 * before its first step, and returns to at the wrap when its first step is not keyframe 0.
 */
export const sampleAt = (
  tracks: Tracks,
  config: TimelineConfig,
  t: number,
  rest: { readonly frame: SceneFrame; readonly opacity?: Readonly<Record<string, number>> },
): Sample => {
  const sched = tracks.schedule
  const mode = config.mode
  const frame: Record<string, Frame> = {}
  for (const [part, track] of tracks.parts) {
    frame[part] = sampleTrack(sched, track, rest.frame[part] ?? [], t, lerpFrame, mode)
  }

  let depths: Record<string, number> | undefined
  if (config.depths !== undefined) {
    depths = { ...config.depths.base }
    for (const [part, track] of tracks.depths) {
      depths[part] = sampleTrack(sched, track, config.depths.base[part] ?? 0, t, lerpNumber, mode)
    }
  }

  let opacity: Record<string, number> | undefined
  if (config.opacity !== undefined) {
    opacity = { ...config.opacity.base }
    for (const [part, track] of tracks.opacity) {
      opacity[part] = sampleTrack(sched, track, rest.opacity?.[part] ?? config.opacity.base[part] ?? 1, t, lerpNumber, mode)
    }
  }

  const camera =
    config.camera === undefined || tracks.camera === undefined
      ? config.camera?.base
      : sampleTrack(sched, tracks.camera, config.camera.base, t, lerpViewBox, mode)

  return {
    frame,
    ...(depths === undefined ? {} : { depths }),
    ...(opacity === undefined ? {} : { opacity }),
    ...(camera === undefined ? {} : { camera }),
  }
}

/** One lap of the clock: a loop's `total`, or out to the end and back for a pingpong. */
export const lapOf = (sched: Schedule, mode: AnimateMode): number => {
  if (mode === 'pingpong') {
    const last = sched.arrive[sched.arrive.length - 1] ?? 0
    return sched.end + last
  }
  return sched.total
}

/**
 * The clock position for elapsed wall time under each automatic mode.
 *
 * A pingpong turns round at the far end without holding there twice: it runs out to the
 * end of the last hold, then back from the last keyframe's arrival to zero.
 */
export const clockAt = (sched: Schedule, mode: AnimateMode, elapsed: number): number => {
  const lap = lapOf(sched, mode)
  if (lap <= 0) return 0
  const v = ((elapsed % lap) + lap) % lap
  if (mode === 'pingpong') {
    if (v <= sched.end) return v
    const last = sched.arrive[sched.arrive.length - 1] ?? 0
    return Math.max(0, last - (v - sched.end))
  }
  return v
}

/** A named-point frame as a flat run, in the order of a points table. */
export const packFrame = (names: readonly string[], points: Readonly<Record<string, Vec2>>): Frame => {
  const out: number[] = []
  for (const name of names) {
    const at = points[name] ?? [0, 0]
    out.push(at[0], at[1])
  }
  return out
}

/** A flat run back into named points. */
export const unpackFrame = (names: readonly string[], frame: Frame): Record<string, Vec2> => {
  const out: Record<string, Vec2> = {}
  names.forEach((name, i) => {
    const x = frame[i * 2]
    const y = frame[i * 2 + 1]
    if (x !== undefined && y !== undefined) out[name] = [x, y]
  })
  return out
}
