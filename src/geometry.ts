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
