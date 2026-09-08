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

/**
 * A filled polygon, named by the points around its rim.
 *
 * Faces are what let a scene occlude: a wall painted over what is behind it hides those
 * lines, which a wireframe cannot do. Parts paint in declaration order, so put nearer things
 * later — see the note on draw order in the README.
 */
export interface FaceSpec {
  /** Point names in order around the rim. Three or more. */
  readonly points: readonly PointId[]
  readonly kind?: string
}

export type Face = FaceSpec

export type PointMap = Readonly<Record<PointId, Vec2>>

export type PoseOverride = Readonly<Partial<Record<PointId, Vec2>>>

export interface FigureSpec {
  /** Rest positions, in the figure's own local coordinate space (y grows downward). */
  readonly points: PointMap
  readonly edges: readonly EdgeSpec[]
  /** Filled polygons, painted under this figure's own edges. */
  readonly faces?: readonly FaceSpec[]
  /**
   * Role labels for points, mirroring an edge's `kind`.
   *
   * A dot gains a `ds-dot--<kind>` class, which is what lets a scene colour by role —
   * structure against content — rather than by matching point names.
   */
  readonly pointKinds?: Readonly<Record<PointId, string>>
  /** Named poses, each a partial override of `points`. */
  readonly poses?: Readonly<Record<string, PoseOverride>>
  /**
   * Paint order inside the figure, as groups of point names, back to front.
   *
   * A figure paints its faces, then its lines, then its dots — so in a compound figure a far
   * solid's lines would cross a near solid's walls. Layers paint solid by solid instead: each
   * layer's faces, lines and dots go down before the next layer starts. Points in no layer
   * paint first. An edge or face belongs to the layer of its first point.
   */
  readonly layers?: readonly (readonly PointId[])[]
  /** Human-readable description, used for the SVG <title>. */
  readonly title?: string
}

export interface Figure {
  readonly kind: 'figure'
  readonly name: string
  readonly points: PointMap
  readonly edges: readonly Edge[]
  readonly faces: readonly Face[]
  readonly pointKinds: Readonly<Record<PointId, string>>
  readonly poses: Readonly<Record<string, PoseOverride>>
  readonly layers: readonly (readonly PointId[])[]
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

/**
 * What the viewer sees: a window onto scene space, given as its centre and width.
 *
 * Height follows from the scene's aspect ratio, so a camera move never changes the shape of
 * the frame — only where it looks and how close. Animating this is what turns a diagram into
 * a shot: the same geometry read as a wide establishing view, then a push in on one dock.
 */
export interface CameraSpec {
  readonly at: Vec2
  readonly width: number
}

/** A camera in a keyframe. Fields left out hold the scene's resting camera. */
export interface CameraKeyframe {
  readonly at?: Vec2
  readonly width?: number
  /** The camera's own easing into this step, when it differs from the keyframe's. */
  readonly easing?: EasingName
}

export interface Part extends Transform {
  readonly figure: Figure
  /** Unique within the scene. Defaults to the figure name. */
  readonly id?: string
  /** 0 to 1. Anything a scene has to make appear or vanish fades rather than teleporting. */
  readonly opacity?: number
  /**
   * Paint order. Lower paints first, so higher sits in front.
   *
   * Defaults to the part's position in `parts`, which means declaration order is depth order
   * until you say otherwise. Give a scene explicit depths when something has to move through
   * the stack — a vehicle passing behind one building and in front of the next.
   */
  readonly depth?: number
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
  /** Paint order at this step, interpolated between keyframes like any other number. */
  readonly depth?: number
  /** 0 to 1, interpolated. The way a thing enters or leaves without a cut. */
  readonly opacity?: number
  /**
   * This part's own easing into the step, when it differs from the keyframe's.
   *
   * Two things arriving at one instant need not arrive the same way: a composed timeline
   * puts a forklift's eased stop and a bird's straight flap on the same keyframe.
   */
  readonly easing?: EasingName
  /**
   * A pose name from the figure, or a `Pose` built at runtime.
   *
   * The second form is what lets a scene place a figure at an arbitrary point between two
   * poses — a gait phase halfway through a stride, say — instead of being limited to the
   * poses that happen to be named.
   */
  readonly pose?: string | Pose
}

/** One step of a staged animation: where every moving part is, and how long it lingers. */
export interface Keyframe {
  readonly name: string
  readonly parts?: Readonly<Record<string, PartKeyframe>>
  /** Where the camera is at this step. Interpolated like a part; omitted, it holds. */
  readonly camera?: CameraKeyframe
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
  /**
   * How dots and strokes respond to the camera. `scene` keeps them in scene units, so a
   * push-in enlarges them with everything else; `screen` keeps them a constant size on the
   * page, the way a pen line stays a pen line however close the drawing is held.
   */
  readonly sizing?: 'scene' | 'screen'
}

export interface SceneSpec {
  readonly parts: readonly Part[]
  readonly title?: string
  /** Explicit viewBox. Omit to fit the content bounds plus `padding`. */
  readonly viewBox?: readonly [number, number, number, number]
  /**
   * A version number for the scene's output.
   *
   * `build` keeps a frozen, self-contained copy of every versioned scene under `versions/`
   * and never overwrites one, so a revision can be judged against what came before it.
   * Bump it when the scene's output changes in a way worth keeping the old one of.
   */
  readonly version?: number
  /**
   * The resting camera. Its `aspect` (width over height) fixes the frame's shape for every
   * camera move; it defaults to the `viewBox` aspect, or 16:9. When set, the camera decides
   * the viewBox and `viewBox` only describes the stage.
   */
  readonly camera?: CameraSpec & { readonly aspect?: number }
  /** Scene units of breathing room around the content bounds. Default 6. */
  readonly padding?: number
  /** Dot radius in scene units. Defaults to a proportion of the viewBox — see `resolve`. */
  readonly dotRadius?: number
  /** Stroke width in scene units. Defaults to a proportion of the dot radius. */
  readonly lineWidth?: number
  /**
   * Extra CSS for this scene, nested inside a selector for it.
   *
   * This is what makes an edge's `kind` useful in a block that has to stand on its own: the
   * class is emitted either way, but without somewhere to write the rule only an outside
   * stylesheet could reach it. Write bare selectors — `.ds-line--road { … }` — and they are
   * scoped to this scene, so two scenes on a page cannot style each other.
   */
  readonly css?: string
  /**
   * Fill for a rect covering the whole viewBox.
   *
   * Worth setting whenever a scene will be used as a standalone `.svg`, an `<img src>`, or
   * rasterised: none of those inherit a page's background, and assuming white is how a
   * carefully chosen paper colour gets lost.
   */
  readonly background?: string
  readonly animate?: AnimateSpec
}

export interface Scene {
  readonly kind: 'scene'
  readonly name: string
  readonly parts: readonly Part[]
  readonly padding: number
  readonly title?: string
  readonly viewBox?: readonly [number, number, number, number]
  readonly version?: number
  readonly camera?: CameraSpec & { readonly aspect?: number }
  readonly dotRadius?: number
  readonly lineWidth?: number
  readonly css?: string
  readonly background?: string
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
    faces: spec.faces ?? [],
    pointKinds: spec.pointKinds ?? {},
    poses: spec.poses ?? {},
    layers: spec.layers ?? [],
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
  ...(spec.version === undefined ? {} : { version: spec.version }),
  ...(spec.camera === undefined ? {} : { camera: spec.camera }),
  ...(spec.dotRadius === undefined ? {} : { dotRadius: spec.dotRadius }),
  ...(spec.lineWidth === undefined ? {} : { lineWidth: spec.lineWidth }),
  ...(spec.css === undefined ? {} : { css: spec.css }),
  ...(spec.background === undefined ? {} : { background: spec.background }),
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
