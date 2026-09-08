/**
 * Small things the scene itself needs, rather than any one figure: nightfall, a wire that
 * can be strung between two points, a window's glow, a page for the fax.
 */

import { defineFigure, definePose, type Pose, type Vec2 } from 'dotscene'

/** A translucent dark face over the whole stage; its opacity is the time of day. */
export const nightfall = defineFigure('nightfall', {
  title: 'Night',
  points: { a: [-600, -400], b: [600, -400], c: [600, 300], d: [-600, 300] },
  edges: [
    { from: 'a', to: 'b', kind: 'night' },
    { from: 'b', to: 'c', kind: 'night' },
    { from: 'c', to: 'd', kind: 'night' },
    { from: 'd', to: 'a', kind: 'night' },
  ],
  faces: [{ points: ['a', 'b', 'c', 'd'], kind: 'night' }],
  pointKinds: { a: 'night', b: 'night', c: 'night', d: 'night' },
})

/**
 * A wire from the origin to wherever it is strung: both ends start at the origin, and a
 * computed pose puts the far end where the act wants it. Placing the part puts the near
 * end on its socket.
 */
export const wire = defineFigure('wire', {
  title: 'A wire',
  points: { near: [0, 0], far: [0, 0] },
  edges: [{ from: 'near', to: 'far', kind: 'blue' }],
  pointKinds: { near: 'blue', far: 'blue' },
  poses: { slack: {} },
})

/** The wire strung to a point given relative to its socket, in scene units. */
export const strung = (to: Vec2, name = `to${Math.round(to[0])}_${Math.round(to[1])}`): Pose =>
  definePose(wire, name, { far: [Math.round(to[0] * 100) / 100, Math.round(to[1] * 100) / 100] })

/** A lit window: a small square that fades in over a window's glass. */
export const glow = defineFigure('glow', {
  title: 'A lit window',
  points: { a: [-2.4, -2.2], b: [2.4, -2.2], c: [2.4, 2.2], d: [-2.4, 2.2] },
  edges: [],
  faces: [{ points: ['a', 'b', 'c', 'd'], kind: 'lamp' }],
  pointKinds: { a: 'night', b: 'night', c: 'night', d: 'night' },
})

/** A sheet of paper for the fax to send: a page with two rules, screen-facing. */
export const sheet = defineFigure('sheet', {
  title: 'A page',
  points: { tl: [-3, -4], tr: [3, -4], br: [3, 4], bl: [-3, 4], r1L: [-1.6, -1], r1R: [1.6, -1], r2L: [-1.6, 1.2], r2R: [1.6, 1.2] },
  edges: [
    { from: 'tl', to: 'tr', kind: 'soft' },
    { from: 'tr', to: 'br', kind: 'soft' },
    { from: 'br', to: 'bl', kind: 'soft' },
    { from: 'bl', to: 'tl', kind: 'soft' },
    { from: 'r1L', to: 'r1R', kind: 'soft' },
    { from: 'r2L', to: 'r2R', kind: 'soft' },
  ],
  faces: [{ points: ['tl', 'tr', 'br', 'bl'], kind: 'paper' }],
  pointKinds: { tl: 'soft', tr: 'soft', br: 'soft', bl: 'soft', r1L: 'soft', r1R: 'soft', r2L: 'soft', r2R: 'soft' },
})

/** A question mark, for the chatbot's one answer: a hook and a dot, screen-facing. */
export const query = defineFigure('query', {
  title: '?',
  points: { a: [-1.6, -1.6], b: [0, -2.6], c: [1.6, -1.4], d: [0.4, 0], e: [0.2, 1.2], f: [0.2, 2.6] },
  edges: [
    { from: 'a', to: 'b', kind: 'blue' },
    { from: 'b', to: 'c', kind: 'blue' },
    { from: 'c', to: 'd', kind: 'blue' },
    { from: 'd', to: 'e', kind: 'blue' },
  ],
  pointKinds: { a: 'blue', b: 'blue', c: 'blue', d: 'blue', e: 'blue', f: 'blue' },
})
