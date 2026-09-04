/**
 * Scene resolution: a scene graph in, flat positioned geometry out.
 *
 * Keeping this separate from rendering is what lets the SVG and ASCII renderers — and any
 * future one — share a single source of truth, and lets tests assert on coordinates rather
 * than on markup.
 */

import type { AnimateMode, EasingName, Part, PointId, Scene, Vec2 } from './model.ts'
import { partId } from './model.ts'
import { applyTransform, bounds, distance, padBounds, round, roundVec, unionBounds, type Bounds } from './geometry.ts'
import { posePoints } from './poses.ts'
import { issueError, validateScene } from './validate.ts'

export interface ResolvedDot {
  readonly part: string
  readonly point: PointId
  readonly at: Vec2
}

export interface ResolvedLine {
  readonly part: string
  readonly from: PointId
  readonly to: PointId
  readonly a: Vec2
  readonly b: Vec2
  readonly kind?: string
}

export type ViewBox = readonly [number, number, number, number]

/** Scene-space positions for one pose of one part, keyed by point name. */
export type Frame = Readonly<Record<PointId, Vec2>>

export interface ResolvedScene {
  readonly name: string
  readonly title?: string
  readonly viewBox: ViewBox
  /** Dot radius in scene units, so the same figure reads the same at any authoring scale. */
  readonly dotRadius: number
  readonly lineWidth: number
  readonly dots: readonly ResolvedDot[]
  readonly lines: readonly ResolvedLine[]
  /** Present only for animated scenes: the cycling part and its poses in scene space. */
  readonly animation?: ResolvedAnimation
}

export interface ResolvedAnimation {
  readonly part: string
  readonly cycle: readonly string[]
  readonly frames: Readonly<Record<string, Frame>>
  readonly duration: number
  readonly hold: number
  readonly easing: EasingName
  readonly mode: AnimateMode
}

/** Scene-space points for a part under a given pose. */
export const partPoints = (part: Part, pose: string | undefined): Record<PointId, Vec2> => {
  const local = posePoints(part.figure, pose ?? part.pose)
  const out: Record<PointId, Vec2> = {}
  for (const [name, at] of Object.entries(local)) {
    out[name] = roundVec(applyTransform(at, part))
  }
  return out
}

/** The part a scene's `animate` block targets, resolved from an explicit id or a lone part. */
const animatedPart = (scene: Scene): Part | undefined => {
  const animate = scene.animate
  if (animate === undefined) return undefined
  const target = animate.part ?? (scene.parts.length === 1 ? partId(scene.parts[0]!) : undefined)
  return scene.parts.find((part) => partId(part) === target)
}

/**
 * Flatten a scene into dots and lines.
 *
 * The viewBox spans every pose in the animation cycle, not just the resting one — otherwise
 * a raised arm would clip the moment it moved.
 */
export const resolve = (scene: Scene): ResolvedScene => {
  const issues = validateScene(scene)
  if (issues.length > 0) throw issueError(issues)

  const dots: ResolvedDot[] = []
  const lines: ResolvedLine[] = []
  let box: Bounds | undefined

  const grow = (points: Iterable<Vec2>): void => {
    const next = bounds(points)
    box = box === undefined ? next : unionBounds(box, next)
  }

  for (const part of scene.parts) {
    const id = partId(part)
    const points = partPoints(part, undefined)
    grow(Object.values(points))

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
      })
    }

    for (const [point, at] of Object.entries(points)) {
      dots.push({ part: id, point, at })
    }
  }

  const animate = scene.animate
  const target = animatedPart(scene)
  let animation: ResolvedAnimation | undefined

  if (animate !== undefined && target !== undefined) {
    const frames: Record<string, Frame> = {}
    for (const poseName of animate.cycle) {
      const framePoints = partPoints(target, poseName)
      frames[poseName] = framePoints
      grow(Object.values(framePoints))
    }
    animation = {
      part: partId(target),
      cycle: animate.cycle,
      frames,
      duration: animate.duration ?? 700,
      hold: animate.hold ?? 900,
      easing: animate.easing ?? 'easeInOut',
      mode: animate.mode ?? 'loop',
    }
  }

  const viewBox = scene.viewBox ?? fitViewBox(box ?? bounds([]), scene.padding)
  const dotRadius = scene.dotRadius ?? defaultDotRadius(lines, viewBox)

  return {
    name: scene.name,
    ...(scene.title === undefined ? {} : { title: scene.title }),
    viewBox,
    dotRadius,
    lineWidth: scene.lineWidth ?? round(Math.max(0.2, dotRadius * 0.45), 2),
    dots,
    lines,
    ...(animation === undefined ? {} : { animation }),
  }
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
