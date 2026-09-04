/** Public API. */

export { defineFigure, definePose, defineScene, partId, withPose } from './model.ts'
export type {
  AnimateMode,
  AnimateSpec,
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

export { add, bounds, distance, lerpVec, mirrorX, rotateVec, round, roundVec, scaleVec, sub } from './geometry.ts'
export type { Bounds, MirrorOptions } from './geometry.ts'

export { easings, easingFor, lerpPoints, posePoints, poseOverride } from './poses.ts'
export type { Easing } from './poses.ts'

export { partPoints, resolve } from './layout.ts'
export type { Frame, ResolvedAnimation, ResolvedDot, ResolvedLine, ResolvedScene, ViewBox } from './layout.ts'

export { DEFAULT_CSS, renderSvg } from './render/svg.ts'
export type { SvgOptions } from './render/svg.ts'

export { renderAscii } from './render/ascii.ts'
export type { AsciiOptions } from './render/ascii.ts'

export { isIssueError, issueError, nearestName, validateFigureSpec, validatePoseOverride, validateScene } from './validate.ts'
export type { Issue, IssueCode, IssueError } from './validate.ts'
