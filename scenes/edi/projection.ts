/**
 * The playfield the EDI scenes are laid out on.
 *
 * Two coordinate systems, because they are good at different things. Structures are built in
 * grid space — a box has to be aligned to the grid axes or it projects to a screen-aligned
 * rectangle instead of an isometric solid. But *placing* things across a wide hero frame is
 * far easier in screen-ish terms, so `cell` converts a (u, v) pair into a grid cell:
 *
 *   u  runs left to right across the frame
 *   v  runs far to near, which is also depth — larger v paints later
 *
 * That makes `v` do double duty: it is where a thing sits on screen *and* its place in the
 * paint order, which is what lets a truck weave behind one building and in front of the next.
 */

import { isometric, type Vec2 } from 'dotscene'
import { isoKit } from '../iso.ts'

export const TILE = 8
export const RISE = 4

export const kit = isoKit(isometric({ tile: TILE, squash: 0.5, rise: RISE }))
export const { at, box, edge, line, pad } = kit

/** A (u, v) position as a grid cell. */
export const cell = (u: number, v: number): Vec2 => [(u + v) / 2, (v - u) / 2]

/** Screen position of a (u, v, z) point — for placing things that are not grid solids. */
export const point = (u: number, v: number, z = 0): Vec2 => {
  const [gx, gy] = cell(u, v)
  return at([gx, gy, z])
}

/** A footprint `w` by `d` centred on (u, v), ready for `box` or `pad`. */
export const footprint = (u: number, v: number, w: number, d: number): readonly [Vec2, Vec2] => {
  const [gx, gy] = cell(u, v)
  return [
    [gx - w / 2, gy - d / 2],
    [gx + w / 2, gy + d / 2],
  ]
}

/** A straight run between two (u, v) positions, at height `z`. */
export const uvLine = (
  name: string,
  from: readonly [number, number],
  to: readonly [number, number],
  z = 0,
  zTo = z,
) => {
  const [ax, ay] = cell(from[0], from[1])
  const [bx, by] = cell(to[0], to[1])
  return edge(name, [ax, ay, z], [bx, by, zTo])
}

/**
 * The hero frame.
 *
 * Explicit, and wide: the route runs out past both sides and the mesh runs off the top, so a
 * fitted box would zoom out to include the overrun and leave nothing off-frame to arrive from.
 */
export const HERO_VIEWBOX = [-190, -78, 380, 132] as const
