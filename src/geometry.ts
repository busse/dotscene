/** Vector and transform math. Everything here is pure and coordinate-space agnostic. */

import type { PointMap, Transform, Vec2 } from './model.ts'

export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]]

export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]]

export const scaleVec = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k]

export const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

export const distance = (a: Vec2, b: Vec2): number => Math.hypot(b[0] - a[0], b[1] - a[1])

/** Rotate clockwise by `degrees` about the origin (y grows downward, so this reads clockwise on screen). */
export const rotateVec = (a: Vec2, degrees: number): Vec2 => {
  if (degrees === 0) return a
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return [a[0] * cos - a[1] * sin, a[0] * sin + a[1] * cos]
}

/** Round to `places` decimals. Used to keep emitted output byte-stable across rebuilds. */
export const round = (n: number, places = 2): number => {
  const factor = 10 ** places
  const rounded = Math.round(n * factor) / factor
  // Normalize -0 so two runs never differ by a sign that renders identically.
  return rounded === 0 ? 0 : rounded
}

export const roundVec = (a: Vec2, places = 2): Vec2 => [round(a[0], places), round(a[1], places)]

/** Apply a part transform: scale, then flip, then rotate, then translate. */
export const applyTransform = (point: Vec2, transform: Transform): Vec2 => {
  const scale = transform.scale ?? 1
  const [sx, sy] = typeof scale === 'number' ? [scale, scale] : scale
  const flip = transform.flipX === true ? -1 : 1
  const scaled: Vec2 = [point[0] * sx * flip, point[1] * sy]
  const rotated = rotateVec(scaled, transform.rotate ?? 0)
  return add(rotated, transform.at ?? [0, 0])
}

export interface Bounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export const bounds = (points: Iterable<Vec2>): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 0, maxY: 0 }
}

export const unionBounds = (a: Bounds, b: Bounds): Bounds => ({
  minX: Math.min(a.minX, b.minX),
  minY: Math.min(a.minY, b.minY),
  maxX: Math.max(a.maxX, b.maxX),
  maxY: Math.max(a.maxY, b.maxY),
})

export const padBounds = (box: Bounds, padding: number): Bounds => ({
  minX: box.minX - padding,
  minY: box.minY - padding,
  maxX: box.maxX + padding,
  maxY: box.maxY + padding,
})

export interface MirrorOptions {
  /** Key suffix identifying the source side. Default 'L'. */
  readonly from?: string
  /** Key suffix written on the mirrored copy. Default 'R'. */
  readonly to?: string
  /** Vertical line to mirror about. Default 0. */
  readonly axis?: number
}

/**
 * Mirror suffixed points across a vertical axis — `handL` becomes `handR` at the negated x.
 * Halves the coordinates you have to author for anything bilateral.
 */
export const mirrorX = (points: PointMap, options: MirrorOptions = {}): PointMap => {
  const from = options.from ?? 'L'
  const to = options.to ?? 'R'
  const axis = options.axis ?? 0
  const mirrored: Record<string, Vec2> = {}
  for (const [name, [x, y]] of Object.entries(points)) {
    if (!name.endsWith(from)) continue
    mirrored[`${name.slice(0, -from.length)}${to}`] = [axis * 2 - x, y]
  }
  return mirrored
}

export interface Ring {
  readonly points: PointMap
  readonly edges: readonly (readonly [string, string])[]
}

/**
 * A closed ring of evenly spaced points — wheels, hubs, anything round.
 *
 * Returns both the points and the edges closing the loop, so a figure spec can spread one in
 * without hand-writing eight coordinates and eight pairs.
 */
export const ring = (prefix: string, center: Vec2, radius: number, count = 8, startDegrees = -90): Ring => {
  const points: Record<string, Vec2> = {}
  const edges: (readonly [string, string])[] = []
  for (let i = 0; i < count; i++) {
    const degrees = startDegrees + (360 / count) * i
    const radians = (degrees * Math.PI) / 180
    points[`${prefix}${i}`] = roundVec([center[0] + Math.cos(radians) * radius, center[1] + Math.sin(radians) * radius])
    edges.push([`${prefix}${i}`, `${prefix}${(i + 1) % count}`])
  }
  return { points, edges }
}

/**
 * The middle joint of a two-bone limb — the elbow between a shoulder and a hand, or the
 * knee between a hip and a foot.
 *
 * Placing a hand where a scene needs it and solving for the elbow keeps a limb's segments
 * their proper length, instead of the straight, over-extended look you get from guessing
 * the joint and letting the hand fall where it may. `bend` selects which of the two
 * solutions to take: the joint sits on one side of the shoulder-to-hand line or the other.
 *
 * When the target is out of reach the limb simply straightens towards it, which is what a
 * real arm does rather than failing.
 */
export const jointBetween = (from: Vec2, to: Vec2, lenFrom: number, lenTo: number, bend: 1 | -1 = 1): Vec2 => {
  const span = distance(from, to)
  if (span === 0) return [from[0] + lenFrom, from[1]]

  const ux = (to[0] - from[0]) / span
  const uy = (to[1] - from[1]) / span

  // Out of reach, or so close the limb folds past itself: straighten along the line.
  if (span >= lenFrom + lenTo || span <= Math.abs(lenFrom - lenTo)) {
    return [from[0] + ux * lenFrom, from[1] + uy * lenFrom]
  }

  const along = (lenFrom * lenFrom - lenTo * lenTo + span * span) / (2 * span)
  const off = Math.sqrt(Math.max(0, lenFrom * lenFrom - along * along)) * bend
  return [from[0] + ux * along - uy * off, from[1] + uy * along + ux * off]
}
