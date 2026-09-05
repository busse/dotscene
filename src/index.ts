/** Public API. */

export { atKeyframe, defineFigure, definePose, defineScene, partId, withPose } from './model.ts'
export type {
  AnimateMode,
  AnimateSpec,
  Keyframe,
  PartKeyframe,
  EasingName,
  Edge,
  EdgeSpec,
  Figure,
  FigureSpec,
  Part,
  PointId,
  PointMap,
  Pose,
  PoseOverride,
  Scene,
  SceneSpec,
  Transform,
  Vec2,
} from './model.ts'

export {
  add,
  bounds,
  distance,
  isometric,
  jointBetween,
  lerpVec,
  mirrorX,
  ring,
  rotateVec,
  round,
  roundVec,
  scaleVec,
  sub,
} from './geometry.ts'
export type { Bounds, IsometricOptions, MirrorOptions, Ring, Vec3 } from './geometry.ts'

export { easings, easingFor, lerpPoints, posePoints, poseOverride } from './poses.ts'
export type { Easing } from './poses.ts'

export { partPoints, resolve } from './layout.ts'
export type { Frame, ResolvedAnimation, ResolvedDot, ResolvedLine, ResolvedScene, ViewBox } from './layout.ts'

export { compose, loopGaps } from './compose.ts'
export type { Act, Beat, Composed, ComposeOptions, Placement } from './compose.ts'

export { animationPayload, compile } from './compile.ts'
export type { CompiledScene, CompileOptions } from './compile.ts'

export { sceneFromJson, sceneToJson } from './serialize.ts'
export type { JsonFigure, JsonPart, JsonScene } from './serialize.ts'

export { DEFAULT_CSS, renderSvg } from './render/svg.ts'
export type { SvgOptions } from './render/svg.ts'

export { renderAscii } from './render/ascii.ts'
export type { AsciiOptions } from './render/ascii.ts'

export { isIssueError, issueError, nearestName, validateFigureSpec, validatePoseOverride, validateScene } from './validate.ts'
export type { Issue, IssueCode, IssueError } from './validate.ts'
