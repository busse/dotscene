/**
 * Pose resolution and interpolation.
 *
 * A pose is a partial override of a figure's points, so resolving one is a merge and
 * tweening two is a per-point lerp. Point identity is what makes that legal — see model.ts.
 */

import type { EasingName, Figure, PointMap, Pose, PoseOverride, Vec2 } from './model.ts'
import { lerpVec } from './geometry.ts'

export type Easing = (t: number) => number

export const easings: Readonly<Record<EasingName, Easing>> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
}

export const easingFor = (name: EasingName | undefined): Easing => easings[name ?? 'easeInOut']

/** The override behind whatever a part named — a pose name, a standalone Pose, or nothing. */
export const poseOverride = (figure: Figure, pose: string | Pose | undefined): PoseOverride => {
  if (pose === undefined) return {}
  if (typeof pose === 'string') return figure.poses[pose] ?? {}
  return pose.points
}

/** Merge a figure's rest points with a pose override. Points the pose omits keep their rest position. */
export const posePoints = (figure: Figure, pose: string | Pose | undefined): PointMap => {
  const override = poseOverride(figure, pose)
  if (Object.keys(override).length === 0) return figure.points
  const merged: Record<string, Vec2> = { ...figure.points }
  for (const [name, at] of Object.entries(override)) {
    if (at !== undefined && name in merged) merged[name] = at
  }
  return merged
}

/**
 * Interpolate between two point maps sharing the same keys.
 *
 * Note: this lerps positions, not joint angles, so an edge's length is not preserved through
 * the middle of a large swing. See the README on why that is acceptable for pose deltas.
 */
export const lerpPoints = (from: PointMap, to: PointMap, t: number): PointMap => {
  const out: Record<string, Vec2> = {}
  for (const [name, a] of Object.entries(from)) {
    const b = to[name]
    out[name] = b === undefined ? a : lerpVec(a, b, t)
  }
  return out
}
