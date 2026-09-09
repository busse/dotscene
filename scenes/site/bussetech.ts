/**
 * Card art for Bussetech: one human, a workforce of agents, a receipt for every run.
 *
 * One person, a ring of agents, a ledger. The person hands out a brief; it fans out to the
 * agents; each one works, and sends back a receipt that files itself as a line in the
 * ledger. Then the ledger is signed off and the next round begins. The human is the only
 * figure with a face; the agents are rings; the receipts are what connect them.
 */

import { defineFigure, defineScene, ring, type Vec2 } from 'dotscene'
import { person } from '../person.ts'
import { themed, VIEWBOX } from './palette.ts'

/** Where the agents stand: an arc around the middle of the frame. */
const AGENTS: readonly Vec2[] = [
  [122, 24],
  [154, 16],
  [186, 24],
  [128, 60],
  [180, 60],
]

/** One agent: a ring of six with a centre, so it can pulse. */
const agentFigure = (name: string) => {
  const r = ring('r', [0, 0], 7, 6)
  return defineFigure(name, {
    title: 'An agent',
    points: { ...r.points, core: [0, 0] },
    edges: r.edges.map(([a, b]) => ({ from: a, to: b, kind: 'blue' })),
    faces: [{ points: Object.keys(r.points), kind: 'blue' }],
    pointKinds: Object.fromEntries([...Object.keys(r.points), 'core'].map((p) => [p, 'blue'])),
  })
}

export const agents = AGENTS.map((_p, i) => agentFigure(`agent${i}`))

/** A brief or a receipt: a small page with one line on it. */
export const page = defineFigure('page', {
  title: 'A page',
  points: { tl: [-4, -5], tr: [4, -5], br: [4, 5], bl: [-4, 5], ruleL: [-2, 0], ruleR: [2, 0] },
  edges: [
    ['tl', 'tr'],
    ['tr', 'br'],
    ['br', 'bl'],
    ['bl', 'tl'],
    { from: 'ruleL', to: 'ruleR', kind: 'hair' },
  ],
  faces: [{ points: ['tl', 'tr', 'br', 'bl'], kind: 'warm' }],
  pointKinds: { ruleL: 'hair', ruleR: 'hair' },
})

/** The ledger: a tall page whose entries appear one at a time, and a mark when it closes. */
const LEDGER: Vec2 = [250, 50]
const ENTRY_Y = [-22, -13, -4, 5, 14]
export const ledger = defineFigure('ledger', {
  title: 'The ledger',
  points: {
    tl: [-16, -34],
    tr: [16, -34],
    br: [16, 34],
    bl: [-16, 34],
    ...Object.fromEntries(ENTRY_Y.flatMap((y, i) => [[`e${i}L`, [-10, y]], [`e${i}R`, [10, y]]])),
    tickA: [-6, 24],
    tickB: [-1, 29],
    tickC: [8, 19],
  },
  edges: [
    ['tl', 'tr'],
    ['tr', 'br'],
    ['br', 'bl'],
    ['bl', 'tl'],
    ...ENTRY_Y.map((_y, i) => ({ from: `e${i}L`, to: `e${i}R`, kind: 'hair' })),
    { from: 'tickA', to: 'tickB', kind: 'blue' },
    { from: 'tickB', to: 'tickC', kind: 'blue' },
  ],
  faces: [{ points: ['tl', 'tr', 'br', 'bl'] }],
  pointKinds: {
    ...Object.fromEntries(ENTRY_Y.flatMap((_y, i) => [[`e${i}L`, 'hair'], [`e${i}R`, 'hair']])),
    tickA: 'blue',
    tickB: 'blue',
    tickC: 'blue',
  },
  poses: {
    // Entries not yet written sit folded on their left end; the tick is folded on its elbow.
    ...Object.fromEntries(
      ENTRY_Y.map((_y, n) => [
        `filled${n}`,
        {
          ...Object.fromEntries(ENTRY_Y.map((y, i) => [`e${i}R`, [i < n ? 10 : -10, y]])),
          tickA: [-1, 29],
          tickC: [-1, 29],
        },
      ]),
    ),
    signed: {},
  },
})

const HUMAN: Vec2 = [40, 12]
const HAND: Vec2 = [55, 41]
const hidden = { opacity: 0 }

/** A brief goes from the hand to the agents; a receipt comes back to the ledger. */
const briefTo = (i: number) => ({ at: AGENTS[i]!, opacity: 1 })
const receiptFrom = (i: number) => ({ at: AGENTS[i]!, opacity: 1 })
const inLedger = (n: number): Vec2 => [LEDGER[0], LEDGER[1] + ENTRY_Y[n]!]

/** The rounds: which agents take the brief, and in what order they report. */
const ROUND = [1, 3, 4]

export const scene = defineScene('artBussetech', {
  title: 'One person, a workforce of agents, and a receipt for every run',
  parts: [
    { figure: ledger, id: 'ledger', at: LEDGER, pose: 'filled3' },
    ...agents.map((figure, i) => ({ figure, id: `agent${i}`, at: AGENTS[i]! })),
    { figure: person, id: 'human', at: HUMAN, scale: 1.05, pose: 'holdR' },
    { figure: page, id: 'brief', at: HAND, opacity: 1 },
    ...ROUND.map((_a, i) => ({ figure: page, id: `receipt${i}`, at: LEDGER, opacity: 0 })),
  ],
  viewBox: VIEWBOX,
  dotRadius: 2.1,
  lineWidth: 0.9,
  css: themed(),
  animate: {
    mode: 'loop',
    easing: 'easeInOut',
    keyframes: [
      // Rest: three entries in the ledger, a brief in hand.
      { name: 'rest', duration: 0, hold: 700, parts: { ledger: { pose: 'filled3' }, brief: { at: HAND, opacity: 1 }, human: { pose: 'holdR' } } },
      // The brief is offered, and goes to the first agent.
      { name: 'offer', duration: 400, hold: 100, parts: { human: { pose: 'offerR' }, brief: { at: [64, 32], opacity: 1 } } },
      { name: 'brief0', duration: 550, hold: 0, parts: { brief: briefTo(ROUND[0]!) } },
      { name: 'brief1', duration: 350, hold: 0, parts: { brief: briefTo(ROUND[1]!) } },
      { name: 'brief2', duration: 350, hold: 150, parts: { brief: briefTo(ROUND[2]!) } },
      { name: 'taken', duration: 250, hold: 0, parts: { brief: { at: AGENTS[ROUND[2]!]!, opacity: 0 }, human: { pose: 'idle' } } },
      // The agents work: each pulses in turn.
      ...ROUND.flatMap((a, i) => [
        { name: `work${i}`, duration: 260, hold: 0, easing: 'easeOut' as const, parts: { [`agent${a}`]: { scale: 1.35 } } },
        { name: `worked${i}`, duration: 300, hold: 0, easing: 'easeIn' as const, parts: { [`agent${a}`]: { scale: 1 } } },
      ]),
      // Each sends a receipt to the ledger, and a line appears as it lands.
      ...ROUND.flatMap((a, i) => [
        { name: `send${i}`, duration: 200, hold: 0, parts: { [`receipt${i}`]: receiptFrom(a) } },
        { name: `land${i}`, duration: 650, hold: 0, easing: 'easeInOut' as const, parts: { [`receipt${i}`]: { at: inLedger(i), opacity: 1 } } },
        { name: `filed${i}`, duration: 200, hold: 120, parts: { [`receipt${i}`]: { at: inLedger(i), opacity: 0 }, ledger: { pose: `filled${i + 1}` } } },
      ]),
      // Signed off, held, then a new brief in hand and the ledger cleared for the next round.
      { name: 'signed', duration: 350, hold: 1400, easing: 'easeOut', parts: { ledger: { pose: 'signed' } } },
      { name: 'next', duration: 500, hold: 0, parts: { ledger: { pose: 'filled3' }, brief: { at: HAND, opacity: 1 }, human: { pose: 'holdR' } } },
    ],
  },
})
