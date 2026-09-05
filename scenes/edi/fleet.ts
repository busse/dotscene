/**
 * The rig that runs the route.
 *
 * A vehicle has to be a grid-aligned solid or it reads as a crate sliding sideways, and the
 * two grid axes point in different directions on screen. So the rig carries the same points
 * in two poses — laid along x, and laid along y — and an act picks whichever matches the run
 * of road it is on. Turning a corner is then just a tween between them.
 *
 * Drawn at the grid origin and moved by translating the part, which works because the
 * projection is affine: shifting by whole cells in grid space is exactly a shift on screen.
 *
 * One caveat for whoever animates this. A box names its corners by grid position, so the
 * east and west corners swap roles between the two orientations — tween slowly between the
 * poses and the solid turns inside out on the way. Change orientation over a short interval
 * so it reads as a snap, which is what isometric games have always done at a corner anyway.
 */

import { defineFigure } from 'dotscene'
import { box } from './projection.ts'
import { merge, tag, type Shape } from '../iso.ts'

const LENGTH = 1.5
const WIDTH = 0.34
const DECK = 0.22
const HEIGHT = 1.05

/** The rig laid along one axis: a trailer, and a lower cab in front of it. */
const rig = (axis: 'x' | 'y'): Shape => {
  const span = (a: number, b: number): readonly [[number, number], [number, number]] =>
    axis === 'x'
      ? [
          [a, -WIDTH],
          [b, WIDTH],
        ]
      : [
          [-WIDTH, a],
          [WIDTH, b],
        ]
  return merge(
    box('rigBox', ...span(-LENGTH, LENGTH * 0.35), HEIGHT, DECK),
    box('rigCab', ...span(LENGTH * 0.35, LENGTH), HEIGHT * 0.62, DECK),
  )
}

const alongX = rig('x')
const alongY = rig('y')

export const truck = defineFigure('ediTruck', {
  title: 'A rig on the route',
  points: alongX.points,
  edges: tag(alongX, 'vehicle').edges,
  faces: alongX.faces ?? [],
  pointKinds: Object.fromEntries(Object.keys(alongX.points).map((n) => [n, 'vehicle'])),
  poses: {
    // Named for the grid axis, which is also the direction of travel on that run.
    x: {},
    y: alongY.points,
  },
})
