/**
 * Scene resolution: a scene graph in, flat positioned geometry out.
 *
 * Keeping this separate from rendering is what lets the SVG and ASCII renderers — and any
 * future one — share a single source of truth, and lets tests assert on coordinates rather
 * than on markup.
 */

import type { AnimateMode, CameraKeyframe, CameraSpec, EasingName, Keyframe, Part, PointId, Pose, Scene, Vec2 } from './model.ts'
import { partId } from './model.ts'
import { applyTransform, bounds, distance, padBounds, round, roundVec, unionBounds, type Bounds } from './geometry.ts'
import { posePoints } from './poses.ts'
import { issueError, validateScene } from './validate.ts'
import {
  buildTracks,
  packFrame,
  sampleAt,
  unpackFrame,
  type Frame,
  type Sample,
  type SceneFrame,
  type Sparse,
  type TimelineConfig,
  type ViewBox,
} from './timeline.ts'

export type { Frame, SceneFrame, ViewBox } from './timeline.ts'

export interface ResolvedDot {
  readonly part: string
  readonly point: PointId
  readonly at: Vec2
  readonly kind?: string
  /** Paint layer within the part. Absent means the first. */
  readonly layer?: number
}

export interface ResolvedLine {
  readonly part: string
  readonly from: PointId
  readonly to: PointId
  readonly a: Vec2
  readonly b: Vec2
  readonly kind?: string
  readonly layer?: number
}

export interface ResolvedFace {
  readonly part: string
  /** Point names around the rim, kept so the runtime can move the polygon. */
  readonly names: readonly PointId[]
  readonly at: readonly Vec2[]
  readonly kind?: string
  readonly layer?: number
}

/** Part id -> paint order at one step. */
export type SceneDepths = Readonly<Record<string, number>>

export interface FrameTiming {
  readonly duration: number
  readonly hold: number
  readonly easing: EasingName
}

export interface ResolvedScene {
  readonly name: string
  readonly title?: string
  readonly version?: number
  readonly viewBox: ViewBox
  /** Dot radius in scene units, so the same figure reads the same at any authoring scale. */
  readonly dotRadius: number
  readonly lineWidth: number
  /** Scene-specific CSS, to be scoped to this scene by the renderer. */
  readonly css?: string
  /** Fill for a rect covering the viewBox, for scenes used outside a styled page. */
  readonly background?: string
  readonly dots: readonly ResolvedDot[]
  readonly lines: readonly ResolvedLine[]
  readonly faces: readonly ResolvedFace[]
  /** Part ids in paint order: by `depth` where given, otherwise declaration order. */
  readonly partOrder: readonly string[]
  /** Parts drawn at less than full opacity, and how much. Absent parts are opaque. */
  readonly opacities?: Readonly<Record<string, number>>
  /** Present only for animated scenes: the cycling part and its poses in scene space. */
  readonly animation?: ResolvedAnimation
}

export interface ResolvedAnimation {
  /** Keyframe names, in playing order. */
  readonly cycle: readonly string[]
  /** Point names for each moving part, in the order its frames list coordinates. */
  readonly points: Readonly<Record<string, readonly string[]>>
  /**
   * Keyframe name -> part id -> flat coordinates, `x, y, x, y…` in `points` order.
   *
   * Sparse: a keyframe carries only the parts it moves. The runtime interpolates every part
   * between the keyframes that mention it, so nothing has to be restated at every step —
   * which is what keeps a long, busy scene's payload proportional to what actually happens.
   */
  readonly frames: Readonly<Record<string, SceneFrame>>
  /** Per-keyframe pacing, so one step can linger while another snaps past. */
  readonly timings: Readonly<Record<string, FrameTiming>>
  /** Easings parts asked for that differ from their keyframe's. Sparse. */
  readonly easings?: Readonly<Record<string, Readonly<Record<string, EasingName>>>>
  /**
   * Paint order, present only when a scene animates depth.
   *
   * Split deliberately: `base` carries every part once, and `byFrame` carries only the parts
   * a keyframe actually moves. Sending the whole stack at every step is the obvious shape and
   * it is ruinous — a scene with thirty-odd parts spends more on restating still ones than on
   * all its geometry put together.
   */
  readonly depths?: Sparse<number>
  /** Opacity per part, in the same sparse shape. Present only when something fades. */
  readonly opacity?: Sparse<number>
  /** The camera's viewBox at rest and at every keyframe that moves it. */
  readonly camera?: {
    readonly base: ViewBox
    readonly byFrame: Readonly<Record<string, ViewBox>>
    readonly easings?: Readonly<Record<string, EasingName>>
  }
  readonly sizing?: 'scene' | 'screen'
  readonly easing: EasingName
  readonly mode: AnimateMode
  /** The parts this animation moves. */
  readonly parts: readonly string[]
  /** Length of one lap in milliseconds, for anything that wants to sample the timeline. */
  readonly duration: number
}

/** Scene-space points for a part under a given pose. */
export const partPoints = (part: Part, pose: string | Pose | undefined): Record<PointId, Vec2> => {
  const local = posePoints(part.figure, pose ?? part.pose)
  const out: Record<PointId, Vec2> = {}
  for (const [name, at] of Object.entries(local)) {
    out[name] = roundVec(applyTransform(at, part))
  }
  return out
}

/** The part the single-part `cycle` shorthand targets: an explicit id, or a lone part. */
export const animatedPart = (scene: Scene): Part | undefined => {
  const animate = scene.animate
  if (animate === undefined) return undefined
  const target = animate.part ?? (scene.parts.length === 1 ? partId(scene.parts[0]!) : undefined)
  return scene.parts.find((part) => partId(part) === target)
}

/**
 * Normalize both animation forms into keyframes.
 *
 * `cycle` is shorthand for the common case of one part running through its own poses; it
 * expands to a keyframe per pose so everything downstream has a single shape to handle.
 */
const expandKeyframes = (scene: Scene): readonly Keyframe[] => {
  const animate = scene.animate
  if (animate === undefined) return []
  if (animate.keyframes !== undefined) return animate.keyframes
  const target = animatedPart(scene)
  if (target === undefined || animate.cycle === undefined) return []
  const id = partId(target)
  return animate.cycle.map((pose) => ({ name: pose, parts: { [id]: { pose } } }))
}

/** The aspect ratio a scene's camera keeps: declared, else the viewBox's, else widescreen. */
export const cameraAspect = (scene: Scene): number => {
  if (scene.camera?.aspect !== undefined) return scene.camera.aspect
  if (scene.viewBox !== undefined && scene.viewBox[3] > 0) return scene.viewBox[2] / scene.viewBox[3]
  return 16 / 9
}

/** The window a camera describes, as a viewBox. */
export const cameraViewBox = (camera: CameraSpec, aspect: number): ViewBox => {
  const height = camera.width / aspect
  const [x, y] = roundVec([camera.at[0] - camera.width / 2, camera.at[1] - height / 2])
  return [x, y, round(camera.width), round(height)]
}

const cameraFrom = (rest: CameraSpec, step: CameraKeyframe): CameraSpec => ({
  at: step.at ?? rest.at,
  width: step.width ?? rest.width,
})

/**
 * Flatten a scene into dots and lines.
 *
 * The viewBox spans every pose in the animation cycle, not just the resting one — otherwise
 * a raised arm would clip the moment it moved. A scene with a camera is framed by the
 * camera instead, and the bounds only describe the stage.
 */
export const resolve = (scene: Scene): ResolvedScene => {
  const issues = validateScene(scene)
  if (issues.length > 0) throw issueError(issues)

  const dots: ResolvedDot[] = []
  const lines: ResolvedLine[] = []
  const faces: ResolvedFace[] = []
  const partOrder: string[] = []
  const opacities: Record<string, number> = {}
  let box: Bounds | undefined

  const grow = (points: Iterable<Vec2>): void => {
    const next = bounds(points)
    box = box === undefined ? next : unionBounds(box, next)
  }

  const baseDepth = new Map<string, number>()
  scene.parts.forEach((part, index) => baseDepth.set(partId(part), part.depth ?? index))

  for (const part of scene.parts) {
    const id = partId(part)
    partOrder.push(id)
    if (part.opacity !== undefined && part.opacity !== 1) opacities[id] = part.opacity
    const points = partPoints(part, undefined)
    grow(Object.values(points))

    // Points in no layer paint first; a layered point carries its layer's index plus one.
    const layerOf = new Map<PointId, number>()
    part.figure.layers.forEach((layer, index) => {
      for (const name of layer) layerOf.set(name, index + 1)
    })
    const layered = (name: PointId): { layer?: number } => {
      const layer = layerOf.get(name)
      return layer === undefined ? {} : { layer }
    }

    for (const face of part.figure.faces) {
      const at = face.points.map((name) => points[name]).filter((p): p is Vec2 => p !== undefined)
      if (at.length < 3) continue
      faces.push({ part: id, names: face.points, at, ...(face.kind === undefined ? {} : { kind: face.kind }), ...layered(face.points[0]!) })
    }

    for (const line of part.figure.edges) {
      const a = points[line.from]
      const b = points[line.to]
      if (a === undefined || b === undefined) continue
      lines.push({
        part: id,
        from: line.from,
        to: line.to,
        a,
        b,
        ...(line.kind === undefined ? {} : { kind: line.kind }),
        ...layered(line.from),
      })
    }

    for (const [point, at] of Object.entries(points)) {
      const kind = part.figure.pointKinds[point]
      dots.push({ part: id, point, at, ...(kind === undefined ? {} : { kind }), ...layered(point) })
    }
  }

  const aspect = cameraAspect(scene)
  const restCamera = scene.camera === undefined ? undefined : cameraViewBox(scene.camera, aspect)

  const animate = scene.animate
  let animation: ResolvedAnimation | undefined

  if (animate !== undefined) {
    const keyframes = expandKeyframes(scene)
    const frames: Record<string, SceneFrame> = {}
    const timings: Record<string, FrameTiming> = {}
    const depths: Record<string, SceneDepths> = {}
    const opacity: Record<string, Record<string, number>> = {}
    const cameras: Record<string, ViewBox> = {}
    const cameraEasings: Record<string, EasingName> = {}
    const easings: Record<string, Record<string, EasingName>> = {}
    const pointTable: Record<string, readonly string[]> = {}
    const moving = new Set<string>()
    const reorders = keyframes.some((keyframe) =>
      Object.values(keyframe.parts ?? {}).some((state) => state.depth !== undefined),
    )
    const fades = keyframes.some((keyframe) =>
      Object.values(keyframe.parts ?? {}).some((state) => state.opacity !== undefined),
    )

    for (const keyframe of keyframes) {
      const frame: Record<string, Frame> = {}
      const keyEasing = keyframe.easing ?? animate.easing ?? 'easeInOut'
      for (const part of scene.parts) {
        const id = partId(part)
        const state = keyframe.parts?.[id]
        if (state === undefined) continue
        // Fields the keyframe omits fall back to the part's own declaration.
        const posed: Part = { ...part, ...state }
        const framePoints = partPoints(posed, state.pose)
        pointTable[id] ??= Object.keys(part.figure.points)
        frame[id] = packFrame(pointTable[id]!, framePoints)
        moving.add(id)
        grow(Object.values(framePoints))
        if (state.easing !== undefined && state.easing !== keyEasing) (easings[keyframe.name] ??= {})[id] = state.easing
      }
      frames[keyframe.name] = frame
      if (reorders) {
        // Only what this step changes. Everything else is in `base`, which the runtime keeps.
        const moved: Record<string, number> = {}
        for (const [id, state] of Object.entries(keyframe.parts ?? {})) {
          if (state.depth !== undefined) moved[id] = state.depth
        }
        depths[keyframe.name] = moved
      }
      if (fades) {
        const faded: Record<string, number> = {}
        for (const [id, state] of Object.entries(keyframe.parts ?? {})) {
          if (state.opacity !== undefined) faded[id] = round(state.opacity, 3)
        }
        opacity[keyframe.name] = faded
      }
      if (keyframe.camera !== undefined && scene.camera !== undefined) {
        cameras[keyframe.name] = cameraViewBox(cameraFrom(scene.camera, keyframe.camera), aspect)
        if (keyframe.camera.easing !== undefined && keyframe.camera.easing !== keyEasing) cameraEasings[keyframe.name] = keyframe.camera.easing
      }
      timings[keyframe.name] = {
        duration: keyframe.duration ?? animate.duration ?? 700,
        hold: keyframe.hold ?? animate.hold ?? 900,
        easing: keyframe.easing ?? animate.easing ?? 'easeInOut',
      }
    }

    const cycle = keyframes.map((keyframe) => keyframe.name)
    let lap = 0
    cycle.forEach((name, index) => {
      const timing = timings[name]!
      lap += (index === 0 ? 0 : timing.duration) + timing.hold
    })
    if (cycle.length > 0) lap += timings[cycle[0]!]!.duration

    animation = {
      cycle,
      points: pointTable,
      frames,
      timings,
      ...(Object.keys(easings).length === 0 ? {} : { easings }),
      easing: animate.easing ?? 'easeInOut',
      mode: animate.mode ?? 'loop',
      parts: [...moving],
      duration: lap,
      ...(animate.sizing === undefined ? {} : { sizing: animate.sizing }),
      ...(reorders
        ? { depths: { base: Object.fromEntries(partOrder.map((id) => [id, baseDepth.get(id)!])), byFrame: depths } }
        : {}),
      ...(fades
        ? {
            opacity: {
              base: Object.fromEntries(partOrder.filter((id) => id in opacities).map((id) => [id, opacities[id]!])),
              byFrame: opacity,
            },
          }
        : {}),
      ...(restCamera !== undefined && Object.keys(cameras).length > 0
        ? { camera: { base: restCamera, byFrame: cameras, ...(Object.keys(cameraEasings).length === 0 ? {} : { easings: cameraEasings }) } }
        : {}),
    }
  }

  // Paint order: depth where the scene gave one, declaration order otherwise.
  const declared = new Map(partOrder.map((id, index) => [id, index]))
  partOrder.sort(
    (a, b) => baseDepth.get(a)! - baseDepth.get(b)! || declared.get(a)! - declared.get(b)!,
  )

  const viewBox = restCamera ?? scene.viewBox ?? fitViewBox(box ?? bounds([]), scene.padding)
  const dotRadius = scene.dotRadius ?? defaultDotRadius(lines, viewBox)

  return {
    name: scene.name,
    ...(scene.title === undefined ? {} : { title: scene.title }),
    ...(scene.version === undefined ? {} : { version: scene.version }),
    viewBox,
    dotRadius,
    lineWidth: scene.lineWidth ?? round(Math.max(0.2, dotRadius * 0.45), 2),
    ...(scene.css === undefined ? {} : { css: scene.css }),
    ...(scene.background === undefined ? {} : { background: scene.background }),
    dots,
    lines,
    faces,
    partOrder,
    ...(Object.keys(opacities).length === 0 ? {} : { opacities }),
    ...(animation === undefined ? {} : { animation }),
  }
}

/** The timeline payload of a resolved scene, in the shape the runtime and the sampler read. */
export const timelineOf = (resolved: ResolvedScene): TimelineConfig | undefined => {
  const animation = resolved.animation
  if (animation === undefined) return undefined
  // A composed timeline has thousands of steps, so a timing carries only what differs from
  // the defaults: no hold, and the animation's own easing.
  const timings: Record<string, { duration?: number; hold?: number; easing?: EasingName }> = {}
  for (const [name, timing] of Object.entries(animation.timings)) {
    timings[name] = {
      ...(timing.duration === 0 ? {} : { duration: timing.duration }),
      ...(timing.hold === 0 ? {} : { hold: timing.hold }),
      ...(timing.easing === animation.easing ? {} : { easing: timing.easing }),
    }
  }
  return {
    cycle: animation.cycle,
    points: animation.points,
    frames: animation.frames,
    timings,
    ...(animation.easings === undefined ? {} : { easings: animation.easings }),
    easing: animation.easing,
    mode: animation.mode,
    ...(animation.depths === undefined ? {} : { depths: animation.depths }),
    ...(animation.opacity === undefined ? {} : { opacity: animation.opacity }),
    ...(animation.camera === undefined ? {} : { camera: animation.camera }),
    ...(animation.sizing === undefined ? {} : { sizing: animation.sizing }),
  }
}

/** What the static drawing shows for every moving part — the state a track starts from. */
const restOf = (resolved: ResolvedScene): { frame: SceneFrame; opacity: Record<string, number> } => {
  const named: Record<string, Record<string, Vec2>> = {}
  for (const dot of resolved.dots) (named[dot.part] ??= {})[dot.point] = dot.at
  const frame: Record<string, Frame> = {}
  const table = resolved.animation?.points ?? {}
  for (const [part, names] of Object.entries(table)) frame[part] = packFrame(names, named[part] ?? {})
  return { frame, opacity: { ...(resolved.opacities ?? {}) } }
}

/** The static drawing with one sample painted onto it: moved points, re-stacked, re-framed. */
export const paintSample = (resolved: ResolvedScene, sample: Sample): ResolvedScene => {
  const table = resolved.animation?.points ?? {}
  const moved: Record<string, Record<string, Vec2>> = {}
  for (const [part, frame] of Object.entries(sample.frame)) moved[part] = unpackFrame(table[part] ?? [], frame)
  const position = (part: string, point: PointId, was: Vec2): Vec2 => moved[part]?.[point] ?? was
  const visible = (part: string): boolean => (sample.opacity?.[part] ?? resolved.opacities?.[part] ?? 1) > 0.05

  const dots = resolved.dots
    .filter((dot) => visible(dot.part))
    .map((dot) => ({ ...dot, at: roundVec(position(dot.part, dot.point, dot.at)) }))
  const lines = resolved.lines
    .filter((line) => visible(line.part))
    .map((line) => ({ ...line, a: roundVec(position(line.part, line.from, line.a)), b: roundVec(position(line.part, line.to, line.b)) }))
  const faces = resolved.faces
    .filter((face) => visible(face.part))
    .map((face) => ({ ...face, at: face.names.map((name, i) => roundVec(position(face.part, name, face.at[i] ?? [0, 0]))) }))

  let partOrder = resolved.partOrder
  if (sample.depths !== undefined) {
    const depths = sample.depths
    const declared = new Map(resolved.partOrder.map((id, index) => [id, index]))
    partOrder = [...resolved.partOrder].sort(
      (a, b) => (depths[a] ?? 0) - (depths[b] ?? 0) || declared.get(a)! - declared.get(b)!,
    )
  }

  const opacities = { ...(resolved.opacities ?? {}), ...(sample.opacity ?? {}) }
  for (const [part, value] of Object.entries(opacities)) if (value === 1) delete opacities[part]

  return {
    ...resolved,
    ...(sample.camera === undefined ? {} : { viewBox: sample.camera.map((n) => round(n)) as unknown as ViewBox }),
    dots,
    lines,
    faces,
    partOrder,
    ...(Object.keys(opacities).length === 0 ? {} : { opacities }),
  }
}

/**
 * The scene as it looks `ms` into its animation — camera, paint order and fades included.
 *
 * This is the terminal's window onto a running animation: the same sampler the browser
 * runtime uses, applied to the same resolved geometry, so a frame checked here is the frame
 * the page will show.
 */
export const resolveAt = (scene: Scene, ms: number): ResolvedScene => {
  const resolved = resolve(scene)
  const config = timelineOf(resolved)
  if (config === undefined) return resolved
  const tracks = buildTracks(config)
  return paintSample(resolved, sampleAt(tracks, config, ms, restOf(resolved)))
}

/** The millisecond at which a named keyframe is reached, or undefined if there is none. */
export const keyframeTime = (resolved: ResolvedScene, name: string): number | undefined => {
  const config = timelineOf(resolved)
  if (config === undefined) return undefined
  const index = config.cycle.indexOf(name)
  if (index < 0) return undefined
  return buildTracks(config).schedule.arrive[index]
}

/**
 * Dots sized from the scene's own detail level, not from fixed units.
 *
 * The basis is the median edge length rather than the viewBox: a wide scene can still hold
 * fine detail — a driver inside a car — and sizing dots off the overall extent turns that
 * detail into a blob. The median tracks the strokes the dots actually sit on, so a figure
 * reads the same alone as it does composed into something larger.
 */
const defaultDotRadius = (lines: readonly ResolvedLine[], viewBox: ViewBox): number => {
  if (lines.length === 0) return round(Math.max(0.4, Math.max(viewBox[2], viewBox[3]) * 0.02), 2)
  const lengths = lines.map((line) => distance(line.a, line.b)).sort((a, b) => a - b)
  const median = lengths[Math.floor(lengths.length / 2)] ?? 1
  return round(Math.max(0.4, median * 0.16), 2)
}

const fitViewBox = (box: Bounds, padding: number): ViewBox => {
  const padded = padBounds(box, padding)
  const [minX, minY] = roundVec([padded.minX, padded.minY])
  const [maxX, maxY] = roundVec([padded.maxX, padded.maxY])
  return [minX, minY, Math.max(maxX - minX, 1), Math.max(maxY - minY, 1)]
}
