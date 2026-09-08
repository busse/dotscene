/**
 * The "temporary" cron job, twelve years on.
 *
 * It paces the beach with its beard trailing, ringing every few seconds because nobody
 * told it to stop. The keeper pins an owner's flag on it; the beard comes off; it walks to
 * the shade of a palm and sits down for the first time.
 */

import { type Beat, type Part, type PartKeyframe } from 'dotscene'
import { at as project } from '../../edi/projection.ts'
import { pulseRing } from '../../edi/figures/tokens.ts'
import { badgeFlag } from '../figures/misfits.ts'
import { defineAct } from './act.ts'
import { depthOf, sip, SKY, standAt, walk, walkTime, vec, type Cell } from './kit.ts'
import { CRON, WORK } from '../world.ts'
import { FIXED, START } from '../timing.ts'

const C = 'cron'
const K = 'keeper'

const bot = (cell: Cell, pose: string, flipX = false, z = 0): PartKeyframe => ({
  at: vec(project([cell[0], cell[1], z])),
  depth: depthOf(cell) + 0.5,
  pose,
  flipX,
})

/** The bot walking a straight run along the beach, legs alternating, facing its way. */
const pace = (from: Cell, to: Cell, at: number, duration: number, flipX: boolean): Beat[] => {
  const steps = Math.max(2, Math.round(duration / 280))
  const beats: Beat[] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const cell: Cell = [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f]
    beats.push({ at: at + Math.round(duration * f), parts: { [C]: bot(cell, i === steps ? 'rest' : i % 2 === 0 ? 'stepA' : 'stepB', flipX) } })
  }
  return beats
}

const parts: Part[] = [
  { id: 'cronRing', figure: pulseRing, at: project([CRON.a[0], CRON.a[1], 1]), opacity: 0, scale: 0.3, depth: SKY + 3 },
  { id: 'cronFlag', figure: badgeFlag, at: project([CRON.rest[0], CRON.rest[1], 0]), opacity: 0, depth: depthOf(CRON.rest) + 0.9 },
]

const beats: Beat[] = []

// Pacing between two spots on the sand, ringing at each turn, until the keeper comes.
const LEG = 2600
let t = 0
let here = CRON.a
let there = CRON.b
beats.push({ at: 0, parts: { [C]: bot(CRON.a, 'rest', false) } })
t = 400
while (t + LEG < FIXED.cron - 1400) {
  beats.push(...pace(here, there, t, LEG - 500, there[0] < here[0]))
  const ring = vec(project([there[0], there[1], 1.1]))
  beats.push({ at: t + LEG - 500, parts: { cronRing: { at: ring, opacity: 0.95, scale: 0.3 } } })
  beats.push({ at: t + LEG, parts: { cronRing: { at: ring, opacity: 0, scale: 3 } }, easing: 'easeOut' })
  ;[here, there] = [there, here]
  t += LEG
}
// It stops where it is when the keeper arrives.
const STOP = here
beats.push({ at: t, parts: { [C]: bot(STOP, 'rest', false) } })

// The keeper pins the flag, and the beard comes off.
beats.push(...sip(WORK.cron, START.cron + 2500))
beats.push({ at: START.cron + 3600, parts: standAt(K, WORK.cron, 'holdR') })
beats.push({ at: FIXED.cron - 600, parts: standAt(K, WORK.cron, 'offerR'), easing: 'easeInOut' })
const pin = vec(project([STOP[0] + CRON.badge[0], STOP[1] + CRON.badge[1], CRON.badge[2]]))
beats.push({ at: FIXED.cron - 600, parts: { cronFlag: { at: pin, opacity: 0, scale: 0.4, depth: depthOf(STOP) + 0.9 } } })
beats.push({ at: FIXED.cron - 300, parts: { cronFlag: { at: pin, opacity: 1, scale: 1, depth: depthOf(STOP) + 0.9 } }, easing: 'easeOut' })
beats.push({ at: FIXED.cron - 300, parts: { [C]: bot(STOP, 'rest', false) } })
beats.push({ at: FIXED.cron, parts: { [C]: bot(STOP, 'trim', false) }, easing: 'easeInOut' })
beats.push({ at: FIXED.cron + 200, parts: standAt(K, WORK.cron, 'wave') })
beats.push({ at: FIXED.cron + 800, parts: standAt(K, WORK.cron, 'idle') })

// Off to the shade, flag and all, and down it sits.
const SHADE = FIXED.cron + 600
const shadeMs = 1500
beats.push({ at: SHADE, parts: { [C]: bot(STOP, 'trim', false) } })
{
  const steps = 5
  for (let i = 1; i <= steps; i++) {
    const f = i / steps
    const cell: Cell = [STOP[0] + (CRON.rest[0] - STOP[0]) * f, STOP[1] + (CRON.rest[1] - STOP[1]) * f]
    const flag = vec(project([cell[0] + CRON.badge[0], cell[1] + CRON.badge[1], CRON.badge[2]]))
    beats.push({
      at: SHADE + Math.round(shadeMs * f),
      parts: {
        [C]: bot(cell, i === steps ? 'trim' : i % 2 === 0 ? 'stepA' : 'stepB', CRON.rest[0] < STOP[0]),
        cronFlag: { at: flag, opacity: 1, scale: 1, depth: depthOf(cell) + 0.9 },
      },
    })
  }
}
beats.push({ at: SHADE + shadeMs + 500, parts: { [C]: bot(CRON.rest, 'sit', false) }, easing: 'easeInOut' })
const sat = vec(project([CRON.rest[0] + CRON.badge[0], CRON.rest[1] + CRON.badge[1], CRON.badge[2] - 0.3]))
beats.push({ at: SHADE + shadeMs + 500, parts: { cronFlag: { at: sat, opacity: 1, scale: 1, depth: depthOf(CRON.rest) + 0.9 } }, easing: 'easeInOut' })

// The keeper walks on to the chatbot.
beats.push(...walk(K, WORK.cron, WORK.chatbot, FIXED.cron + 900, Math.max(walkTime(WORK.cron, WORK.chatbot), START.chatbot + 1600 - (FIXED.cron + 900))))

export const act = defineAct('islandCron', 'The temporary cron job', beats, parts)
