/**
 * The dotscene data model.
 *
 * A Figure is a named set of points and the edges between them — a constellation.
 * A Pose is a partial override of those same point names. Because point identity is
 * stable across poses, interpolating between two poses is a per-point lerp.
 */

import { issueError, validateFigureSpec, validatePoseOverride } from './validate.ts'

export type Vec2 = readonly [number, number]

export type PointId = string

/** An edge, written either as a terse pair or as an object when it needs a style kind. */
export type EdgeSpec = readonly [PointId, PointId] | { readonly from: PointId; readonly to: PointId; readonly kind?: string }

export interface Edge {
  readonly from: PointId
  readonly to: PointId
  /** Free-form style hint. Emitted as `data-kind` and a `ds-line--<kind>` class. */
  readonly kind?: string
}

export type PointMap = Readonly<Record<PointId, Vec2>>

export type PoseOverride = Readonly<Partial<Record<PointId, Vec2>>>

export interface FigureSpec {
  /** Rest positions, in the figure's own local coordinate space (y grows downward). */
  readonly points: PointMap
  readonly edges: readonly EdgeSpec[]
  /** Named poses, each a partial override of `points`. */
  readonly poses?: Readonly<Record<string, PoseOverride>>
  /** Human-readable description, used for the SVG <title>. */
  readonly title?: string
}

export interface Figure {
  readonly kind: 'figure'
  readonly name: string
  readonly points: PointMap
  readonly edges: readonly Edge[]
  readonly poses: Readonly<Record<string, PoseOverride>>
  readonly title?: string
}

export interface Pose {
  readonly kind: 'pose'
  readonly name: string
  readonly figure: string
  readonly points: PoseOverride
}

export interface Transform {
  /** Translation applied last, in scene units. */
  readonly at?: Vec2
  readonly scale?: number | Vec2
  /** Clockwise rotation in degrees. */
  readonly rotate?: number
  readonly flipX?: boolean
}

export interface Part extends Transform {
  readonly figure: Figure
  /** Unique within the scene. Defaults to the figure name. */
  readonly id?: string
  /** A pose name from the figure, or a standalone Pose. */
  readonly pose?: string | Pose
}

export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export type AnimateMode = 'loop' | 'pingpong' | 'hover' | 'click'

/**
 * What one part is doing during one keyframe.
 *
 * Fields left out fall back to the part's own declaration, so a keyframe only states what
 * changes — a part that stays put needs no entry at all.
 */
export interface PartKeyframe extends Transform {
  readonly pose?: string
}

/** One step of a staged animation: where every moving part is, and how long it lingers. */
export interface Keyframe {
  readonly name: string
  readonly parts?: Readonly<Record<string, PartKeyframe>>
  /** Milliseconds to transition into this keyframe. Falls back to `animate.duration`. */
  readonly duration?: number
  /** Milliseconds held here before moving on. Falls back to `animate.hold`. */
  readonly hold?: number
  /**
   * Easing for the transition into this keyframe. Falls back to `animate.easing`.
   *
   * Continuous motion wants `linear` on every step of the run and easing only where it
   * actually starts or stops — an ease on each step makes travel pulse.
   */
  readonly easing?: EasingName
}

export interface AnimateSpec {
  /** Single-part shorthand: which part cycles. Defaults to the scene's only part. */
  readonly part?: string
  /** Single-part shorthand: pose names to cycle through, in order. */
  readonly cycle?: readonly string[]
  /**
   * Staged animation: every part's pose and position at each step. Use this instead of
   * `cycle` when more than one part moves, or when a part travels as well as poses.
   */
  readonly keyframes?: readonly Keyframe[]
  /** Default milliseconds per transition. */
  readonly duration?: number
  /** Default milliseconds held at each step. */
  readonly hold?: number
  readonly easing?: EasingName
  readonly mode?: AnimateMode
}

export interface SceneSpec {
  readonly parts: readonly Part[]
  readonly title?: string
  /** Explicit viewBox. Omit to fit the content bounds plus `padding`. */
  readonly viewBox?: readonly [number, number, number, number]
  /** Scene units of breathing room around the content bounds. Default 6. */
  readonly padding?: number
  /** Dot radius in scene units. Defaults to a proportion of the viewBox — see `resolve`. */
  readonly dotRadius?: number
  /** Stroke width in scene units. Defaults to a proportion of the dot radius. */
  readonly lineWidth?: number
  readonly animate?: AnimateSpec
}

export interface Scene {
  readonly kind: 'scene'
  readonly name: string
  readonly parts: readonly Part[]
  readonly padding: number
  readonly title?: string
  readonly viewBox?: readonly [number, number, number, number]
  readonly dotRadius?: number
  readonly lineWidth?: number
  readonly animate?: AnimateSpec
}

const normalizeEdge = (edge: EdgeSpec): Edge => ('from' in edge ? edge : { from: edge[0], to: edge[1] })

/** Build a validated Figure. Throws an error carrying structured `issues` if the spec is inconsistent. */
export const defineFigure = (name: string, spec: FigureSpec): Figure => {
  const issues = validateFigureSpec(name, spec)
  if (issues.length > 0) throw issueError(issues)
  return {
    kind: 'figure',
    name,
    points: spec.points,
    edges: spec.edges.map(normalizeEdge),
    poses: spec.poses ?? {},
    ...(spec.title === undefined ? {} : { title: spec.title }),
  }
}

/** Build a standalone Pose — for poses derived in code rather than declared in the figure spec. */
export const definePose = (figure: Figure, name: string, points: PoseOverride): Pose => {
  const issues = validatePoseOverride(figure, name, points)
  if (issues.length > 0) throw issueError(issues)
  return { kind: 'pose', name, figure: figure.name, points }
}

/** Build a Scene. Composition only — geometry is computed later by `resolve`. */
export const defineScene = (name: string, spec: SceneSpec): Scene => ({
  kind: 'scene',
  name,
  parts: spec.parts,
  padding: spec.padding ?? 6,
  ...(spec.title === undefined ? {} : { title: spec.title }),
  ...(spec.viewBox === undefined ? {} : { viewBox: spec.viewBox }),
  ...(spec.dotRadius === undefined ? {} : { dotRadius: spec.dotRadius }),
  ...(spec.lineWidth === undefined ? {} : { lineWidth: spec.lineWidth }),
  ...(spec.animate === undefined ? {} : { animate: spec.animate }),
})

/** The id a part is addressed by: its explicit `id`, else the figure's name. */
export const partId = (part: Part): string => part.id ?? part.figure.name

/**
 * A copy of the scene staged at one keyframe — every part where that step puts it.
 *
 * This is what lets `dotscene preview --pose <keyframe>` show a step of a staged animation
 * as a still, so a multi-part animation stays correctable from the terminal.
 */
export const atKeyframe = (scene: Scene, name: string): Scene => {
  const keyframe = scene.animate?.keyframes?.find((candidate) => candidate.name === name)
  if (keyframe === undefined) return scene
  return {
    ...scene,
    parts: scene.parts.map((part) => {
      const state = keyframe.parts?.[partId(part)]
      return state === undefined ? part : { ...part, ...state }
    }),
  }
}

/**
 * A copy of the scene with one part put into a named pose.
 *
 * Used by `dotscene preview --pose` and by the compiler when emitting per-pose stills.
 * Defaults to the animated part, then to the scene's only part.
 */
export const withPose = (scene: Scene, pose: string, target?: string): Scene => {
  const id = target ?? scene.animate?.part ?? (scene.parts.length === 1 ? partId(scene.parts[0]!) : undefined)
  return {
    ...scene,
    parts: scene.parts.map((part) => (partId(part) === id ? { ...part, pose } : part)),
  }
}
