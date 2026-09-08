/**
 * Card art for SingleStone: consulting — data, analytics and AI, architecture modernization.
 *
 * Nine systems and the connections between them. Tangled, they are what a client has; the
 * same nine, the same connections, laid out in three tiers, are what they leave with. The
 * edges never change — only where things sit — and then a request runs down the stack and
 * an answer comes back up, because a clean architecture is one you can trace a call through.
 */

import { defineFigure, defineScene, ring, type Vec2 } from 'dotscene'
import { themed, VIEWBOX } from './palette.ts'

/** Three tiers of three: clients at the top, services in the middle, data at the bottom. */
const TIERED: Record<string, Vec2> = {
  c0: [50, 16],
  c1: [145, 16],
  c2: [240, 16],
  s0: [50, 50],
  s1: [145, 50],
  s2: [240, 50],
  d0: [50, 84],
  d1: [145, 84],
  d2: [240, 84],
}

/** The same nine, as found: scattered so the same edges cross each other. */
const TANGLED: Record<string, Vec2> = {
  c0: [118, 62],
  c1: [252, 78],
  c2: [46, 30],
  s0: [206, 20],
  s1: [96, 88],
  s2: [150, 40],
  d0: [262, 44],
  d1: [36, 72],
  d2: [176, 86],
}

export const systems = defineFigure('systems', {
  title: 'Nine systems and how they connect',
  points: TIERED,
  edges: [
    ['c0', 's0'],
    ['c0', 's1'],
    ['c1', 's1'],
    ['c1', 's2'],
    ['c2', 's1'],
    ['c2', 's2'],
    ['s0', 'd0'],
    ['s1', 'd0'],
    ['s1', 'd1'],
    ['s2', 'd1'],
    ['s2', 'd2'],
    ['s0', 'd1'],
  ],
  poses: {
    tiered: {},
    tangled: TANGLED,
  },
})

/** A faint band behind each tier, so the order reads as tiers rather than as three rows. */
const band = (name: string, y: number) =>
  defineFigure(name, {
    points: { a: [22, y - 9], b: [268, y - 9], c: [268, y + 9], d: [22, y + 9] },
    edges: [
      { from: 'a', to: 'b', kind: 'hair' },
      { from: 'c', to: 'd', kind: 'hair' },
    ],
    faces: [{ points: ['a', 'b', 'c', 'd'], kind: 'blue' }],
    pointKinds: { a: 'hair', b: 'hair', c: 'hair', d: 'hair' },
  })

export const bandTop = band('bandTop', 16)
export const bandMid = band('bandMid', 50)
export const bandLow = band('bandLow', 84)

/** The call: a small ring that runs down the stack and back. */
const halo = ring('h', [0, 0], 4.5, 8)
export const signal = defineFigure('signal', {
  title: 'A request',
  points: { ...halo.points, core: [0, 0] },
  edges: halo.edges.map(([a, b]) => ({ from: a, to: b, kind: 'blue' })),
  pointKinds: Object.fromEntries([...Object.keys(halo.points), 'core'].map((p) => [p, 'blue'])),
})

const at = (name: string): Vec2 => TIERED[name]!
const hidden = { opacity: 0 }

export const scene = defineScene('artSinglestone', {
  title: 'Systems, from tangle to tiers, with a request traced through',
  parts: [
    { figure: bandTop, id: 'bandTop', opacity: 1 },
    { figure: bandMid, id: 'bandMid', opacity: 1 },
    { figure: bandLow, id: 'bandLow', opacity: 1 },
    { figure: systems, id: 'systems', pose: 'tiered' },
    { figure: signal, id: 'signal', at: at('c1'), opacity: 0 },
  ],
  viewBox: VIEWBOX,
  dotRadius: 2.1,
  lineWidth: 0.9,
  css: themed(),
  animate: {
    mode: 'loop',
    easing: 'easeInOut',
    keyframes: [
      // Rest on the clean picture — it is also what a reader who prefers reduced motion sees.
      { name: 'tiered', duration: 0, hold: 900, parts: { systems: { pose: 'tiered' }, bandTop: { opacity: 1 }, bandMid: { opacity: 1 }, bandLow: { opacity: 1 }, signal: { at: at('c1'), ...hidden } } },
      // A request enters at a client, drops through a service to the data, and returns.
      { name: 'ask', duration: 350, hold: 0, easing: 'easeOut', parts: { signal: { at: at('c1'), opacity: 1 } } },
      { name: 'service', duration: 550, hold: 120, parts: { signal: { at: at('s1') } } },
      { name: 'data', duration: 550, hold: 220, parts: { signal: { at: at('d0') } } },
      { name: 'back', duration: 550, hold: 120, parts: { signal: { at: at('s1') } } },
      { name: 'answered', duration: 550, hold: 0, parts: { signal: { at: at('c1') } } },
      { name: 'done', duration: 300, hold: 1100, easing: 'easeIn', parts: { signal: { at: at('c1'), ...hidden } } },
      // Then let it fall back into the tangle it came from, and gather it up again.
      { name: 'tangled', duration: 1500, hold: 1300, parts: { systems: { pose: 'tangled' }, bandTop: hidden, bandMid: hidden, bandLow: hidden } },
      { name: 'gathered', duration: 1500, hold: 0, parts: { systems: { pose: 'tiered' }, bandTop: { opacity: 1 }, bandMid: { opacity: 1 }, bandLow: { opacity: 1 } } },
    ],
  },
})
