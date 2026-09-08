/**
 * Card art for Eszett: a talent agency for visual artists who reject generative AI.
 *
 * A pencil draws the ß by hand. The letter is one figure whose points all start at the
 * pencil's tip; as the pencil moves along the stroke, each point is left behind where it
 * belongs, so the line is pulled out of the pencil rather than revealed. Then the pencil
 * lifts, the letter fades, and it is drawn again — the work is the drawing, not the drawn.
 */

import { defineFigure, defineScene, type PoseOverride, type Vec2 } from 'dotscene'
import { themed, VIEWBOX } from './palette.ts'

/** The stroke, as a constellation: up the stem, over the top, down and round the bowl. */
const STROKE: readonly Vec2[] = [
  [112, 88],
  [112, 66],
  [112, 44],
  [113, 26],
  [119, 15],
  [130, 11],
  [141, 15],
  [146, 25],
  [143, 36],
  [136, 42],
  [146, 49],
  [153, 60],
  [153, 73],
  [146, 84],
  [134, 88],
  [124, 84],
]

const names = STROKE.map((_p, i) => `p${i}`)

/** Every point at the tip: nothing drawn. */
const collapsed = (tip: Vec2): PoseOverride => Object.fromEntries(names.map((n) => [n, tip]))

/** The first `n` points where they belong, the rest gathered at the last one — the tip. */
const drawn = (n: number): PoseOverride =>
  Object.fromEntries(names.map((name, i) => [name, i < n ? STROKE[i]! : STROKE[n - 1]!]))

export const letter = defineFigure('eszett', {
  title: 'ß, drawn',
  points: Object.fromEntries(names.map((n, i) => [n, STROKE[i]!])),
  edges: names.slice(1).map((n, i) => [names[i]!, n] as const),
  poses: {
    whole: {},
    blank: collapsed(STROKE[0]!),
    ...Object.fromEntries(names.map((_n, i) => [`to${i}`, drawn(i + 1)])),
  },
})

/**
 * A pencil, tip at the origin, pointing down. Rotated by the part to lean into the stroke.
 */
export const pencil = defineFigure('pencil', {
  title: 'A pencil',
  points: {
    tip: [0, 0],
    coneL: [-2.4, -7.5],
    coneR: [2.4, -7.5],
    bandL: [-2.4, -30],
    bandR: [2.4, -30],
    endL: [-2.4, -36],
    endR: [2.4, -36],
  },
  edges: [
    ['tip', 'coneL'],
    ['tip', 'coneR'],
    ['coneL', 'coneR'],
    ['coneL', 'bandL'],
    ['coneR', 'bandR'],
    { from: 'bandL', to: 'bandR', kind: 'hair' },
    ['bandL', 'endL'],
    ['bandR', 'endR'],
    ['endL', 'endR'],
  ],
  faces: [
    { points: ['coneL', 'coneR', 'bandR', 'bandL'], kind: 'warm' },
    { points: ['bandL', 'bandR', 'endR', 'endL'], kind: 'soft' },
  ],
  pointKinds: { bandL: 'hair', bandR: 'hair' },
})

/** The pencil leans a little further as the hand comes round the bowl. */
const LEAN = -32
const leanAt = (i: number): number => LEAN + (i / (STROKE.length - 1)) * 10

/** Time to draw each segment: the curves take longer than the stem. */
const PACE = 170

const drawing = names.map((_n, i) => ({
  name: `draw${i}`,
  duration: i === 0 ? 300 : PACE,
  hold: 0,
  easing: 'linear' as const,
  parts: {
    letter: { pose: `to${i}`, opacity: 1 },
    pencil: { at: STROKE[i]!, rotate: leanAt(i), opacity: 1 },
  },
}))

/** Where the pencil rests, lifted, between letters. */
const REST: Vec2 = [140, 40]

export const scene = defineScene('artEszett', {
  title: 'A pencil drawing an eszett by hand',
  parts: [
    { figure: letter, id: 'letter', pose: 'whole' },
    { figure: pencil, id: 'pencil', at: STROKE[STROKE.length - 1]!, rotate: leanAt(STROKE.length - 1) },
  ],
  viewBox: VIEWBOX,
  dotRadius: 2.1,
  lineWidth: 0.9,
  css: themed(),
  animate: {
    mode: 'loop',
    easing: 'easeInOut',
    keyframes: [
      // Rest on the finished letter, which is also the still for reduced motion.
      { name: 'whole', duration: 0, hold: 1600, parts: { letter: { pose: 'whole', opacity: 1 }, pencil: { at: STROKE[STROKE.length - 1]!, rotate: leanAt(STROKE.length - 1), opacity: 1 } } },
      // The pencil lifts away and the letter fades.
      { name: 'lift', duration: 700, hold: 200, parts: { pencil: { at: REST, rotate: LEAN - 12, opacity: 1 }, letter: { pose: 'whole', opacity: 0 } } },
      // It comes down to the foot of the stem with nothing drawn yet.
      { name: 'down', duration: 600, hold: 150, parts: { pencil: { at: STROKE[0]!, rotate: LEAN, opacity: 1 }, letter: { pose: 'blank', opacity: 1 } } },
      ...drawing.slice(1),
      { name: 'finished', duration: 200, hold: 0, parts: { letter: { pose: 'whole', opacity: 1 } } },
    ],
  },
})
