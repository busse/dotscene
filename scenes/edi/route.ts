/**
 * The waypoints and the road between them.
 *
 * Everything downstream reads positions from here: move a terminal and its buildings, its
 * network node, the road and the truck's path all follow.
 *
 * Legs run along the grid axes rather than straight from stop to stop, so every stretch of
 * road is one of the two isometric diagonals and an L-turn joins them. That is what a yard
 * actually looks like, and it is also the only way a vehicle can be a grid-aligned solid:
 * a box laid along a diagonal path would read as a crate sliding sideways.
 *
 * The zigzag has a second job. A route at constant depth never passes behind anything; this
 * one crosses the paint order at every turn, which is what makes the scene read as solid.
 */

import type { Vec2 } from 'dotscene'
import { cell, edge, point, uvLine } from './projection.ts'
import { merge, type Shape } from '../iso.ts'

export interface Waypoint {
  readonly id: string
  readonly label: string
  /** Left to right across the frame. */
  readonly u: number
  /** Far to near — also the paint order at this waypoint. */
  readonly v: number
}

export const waypoints = [
  { id: 'shipper', label: 'Shipper', u: -18, v: -3 },
  { id: 'originTerm', label: 'Origin terminal', u: -10, v: 6 },
  { id: 'relay', label: 'Relay', u: -2, v: -5 },
  { id: 'hub', label: 'Crossdock hub', u: 5, v: 5 },
  { id: 'destTerm', label: 'Destination terminal', u: 13, v: -4 },
  { id: 'consignee', label: 'Consignee', u: 19, v: 4 },
] as const satisfies readonly Waypoint[]

export type WaypointId = (typeof waypoints)[number]['id']

export const waypoint = (id: WaypointId): Waypoint => waypoints.find((w) => w.id === id)!

/** The road overruns both ends of the frame, so traffic arrives from somewhere. */
const APPROACH = { id: 'approach', label: 'off frame', u: -28, v: 2 } as const
const DEPARTURE = { id: 'departure', label: 'off frame', u: 28, v: 0 } as const

/** One straight run along a single grid axis. */
export interface Segment {
  readonly from: Vec2
  readonly to: Vec2
  /** Which grid axis it runs along: 'x' falls to the right on screen, 'y' to the left. */
  readonly axis: 'x' | 'y'
  readonly length: number
}

const between = (a: Waypoint, b: Waypoint): Segment[] => {
  const [ax, ay] = cell(a.u, a.v)
  const [bx, by] = cell(b.u, b.v)
  const corner: Vec2 = [bx, ay]
  const runs: Segment[] = []
  if (bx !== ax) runs.push({ from: [ax, ay], to: corner, axis: 'x', length: Math.abs(bx - ax) })
  if (by !== ay) runs.push({ from: corner, to: [bx, by], axis: 'y', length: Math.abs(by - ay) })
  return runs
}

const stops: readonly Waypoint[] = [APPROACH, ...waypoints, DEPARTURE]

/** Every straight run of the route, in order, including the two that leave the frame. */
export const segments: readonly Segment[] = stops
  .slice(0, -1)
  .flatMap((from, i) => between(from, stops[i + 1]!))

const TOTAL = segments.reduce((sum, s) => sum + s.length, 0)

/**
 * The route parameter at every segment join, plus 0 and 1.
 *
 * Position and depth both vary linearly *within* a straight run, so a vehicle only needs a
 * keyframe where the road turns. Sampling uniformly instead is both less accurate and much
 * heavier — this is what keeps the rig cheap.
 */
export const joins: readonly number[] = (() => {
  const marks: number[] = [0]
  let run = 0
  for (const seg of segments) {
    run += seg.length
    marks.push(run / TOTAL)
  }
  return marks
})()

/** The joins strictly inside a stretch of route, in order of travel. */
export const joinsBetween = (from: number, to: number): readonly number[] => {
  const low = Math.min(from, to)
  const high = Math.max(from, to)
  const inside = joins.filter((j) => j > low + 1e-9 && j < high - 1e-9)
  return from <= to ? inside : [...inside].reverse()
}

export interface OnRoute {
  readonly at: Vec2
  /** Paint order: grid x + y, the same number that decides how far up the frame it is. */
  readonly depth: number
  /** Which axis the road runs along here, so a vehicle can be laid the right way. */
  readonly axis: 'x' | 'y'
}

/** Where a vehicle sits when it is `t` of the way along the whole route, 0 to 1. */
export const along = (t: number): OnRoute => {
  let travelled = Math.min(Math.max(t, 0), 1) * TOTAL
  for (const seg of segments) {
    if (travelled > seg.length && seg !== segments[segments.length - 1]) {
      travelled -= seg.length
      continue
    }
    const local = seg.length === 0 ? 0 : Math.min(travelled / seg.length, 1)
    const gx = seg.from[0] + (seg.to[0] - seg.from[0]) * local
    const gy = seg.from[1] + (seg.to[1] - seg.from[1]) * local
    return { at: point(gx - gy, gx + gy, 0), depth: gx + gy, axis: seg.axis }
  }
  const last = segments[segments.length - 1]!
  return { at: point(last.to[0] - last.to[1], last.to[0] + last.to[1], 0), depth: last.to[0] + last.to[1], axis: last.axis }
}

const HALF_WIDTH = 0.55

/** Both kerbs of every run, offset across the axis the run travels along. */
export const road: Shape = merge(
  ...segments.flatMap((seg, i) => {
    const across: Vec2 = seg.axis === 'x' ? [0, HALF_WIDTH] : [HALF_WIDTH, 0]
    return [-1, 1].map((side) =>
      edge(
        `kerb${i}${side > 0 ? 'N' : 'F'}`,
        [seg.from[0] + across[0] * side, seg.from[1] + across[1] * side, 0],
        [seg.to[0] + across[0] * side, seg.to[1] + across[1] * side, 0],
      ),
    )
  }),
)

/** Kept for anything that wants to draw in (u, v) rather than grid cells. */
export { uvLine }
