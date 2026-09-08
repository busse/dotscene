/**
 * Dusk. The keeper reaches the lighthouse as the sun goes behind the point and lights the
 * lamp. The beam swings out over the sea and the island. Later, home to the hut: a window
 * lights, the chimney smokes, and the keeper is done for the day.
 */

import { type Beat, type Part, type Vec2 } from 'dotscene'
import { pulseRing } from '../../edi/figures/tokens.ts'
import { smokePuff } from '../../edi/figures/places.ts'
import { glow } from '../figures/fixtures.ts'
import { defineAct } from './act.ts'
import { SKY, standAt, walk, walkTime, vec } from './kit.ts'
import { HUT, LAMP, MUG_ON_STUMP, STUMP } from '../world.ts'
import { NIGHT, START } from '../timing.ts'

const K = 'keeper'
const LIT = START.dusk + 4000

const parts: Part[] = [
  { id: 'lampPulse', figure: pulseRing, at: LAMP.at, opacity: 0, scale: 0.3, depth: SKY + 3 },
  { id: 'hutGlow', figure: glow, at: HUT.window, opacity: 0, depth: HUT.depth + 0.05 },
  ...[0, 1, 2].map((i) => ({ id: `hutSmoke${i}`, figure: smokePuff, at: HUT.chimney, opacity: 0, scale: 0.5, depth: HUT.depth + 0.6 })),
]

const beats: Beat[] = []

// At the door: a moment, then the lamp comes on and the beam begins to turn.
beats.push({ at: LIT - 800, parts: standAt(K, HUT.lighthouseDoor, 'idle') })
beats.push({ at: LIT - 400, parts: standAt(K, HUT.lighthouseDoor, 'offerR') })
beats.push({ at: LIT - 300, parts: { lamp: { opacity: 0 } } })
beats.push({ at: LIT, parts: { lamp: { opacity: 1 }, lampPulse: { at: LAMP.at, opacity: 0.95, scale: 0.3 } }, easing: 'easeOut' })
beats.push({ at: LIT + 900, parts: { lampPulse: { at: LAMP.at, opacity: 0, scale: 6 } }, easing: 'easeOut' })
beats.push({ at: LIT + 700, parts: standAt(K, HUT.lighthouseDoor, 'wave') })
beats.push({ at: LIT + 1500, parts: standAt(K, HUT.lighthouseDoor, 'idle') })

// The beam: a wedge sweeping the sky from over the left sea to over the right, and back,
// twenty degrees at a time, all night. It never points down into the island.
const SWEEP = { from: 200, to: 340, step: 20, every: 520 }
beats.push({ at: LIT + 300, parts: { beam: { at: LAMP.at, rotate: SWEEP.from, opacity: 0 } } })
beats.push({ at: LIT + 900, parts: { beam: { at: LAMP.at, rotate: SWEEP.from + SWEEP.step, opacity: 1 } }, easing: 'easeOut' })
for (let t = LIT + 900, a = SWEEP.from + SWEEP.step, dir = 1; t < NIGHT.lift - 600; t += SWEEP.every) {
  a += SWEEP.step * dir
  if (a >= SWEEP.to || a <= SWEEP.from) dir = -dir
  beats.push({ at: t + SWEEP.every, parts: { beam: { at: LAMP.at, rotate: a, opacity: 1 } } })
}
beats.push({ at: NIGHT.lift, parts: { beam: { at: LAMP.at, rotate: 0, opacity: 0 } }, easing: 'easeIn' })
beats.push({ at: NIGHT.lift + 1, parts: { lamp: { opacity: 0 } } })

// Home by way of the hammock: the mug goes back on its stump, then in to the hut.
const HOME = LIT + 1800
const toStump = walkTime(HUT.lighthouseDoor, STUMP.stand)
beats.push(...walk(K, HUT.lighthouseDoor, STUMP.stand, HOME, toStump))
const AT_STUMP = HOME + toStump
beats.push({ at: AT_STUMP + 250, parts: standAt(K, STUMP.stand, 'offerL', true), easing: 'easeInOut' })
beats.push({ at: AT_STUMP + 550, parts: { mug: { ...MUG_ON_STUMP } }, easing: 'easeOut' })
beats.push({ at: AT_STUMP + 800, parts: standAt(K, STUMP.stand, 'idle', true, 0, false), easing: 'easeInOut' })
const toHut = Math.max(walkTime(STUMP.stand, HUT.door), 1200)
const IN = AT_STUMP + 900 + toHut
beats.push(...walk(K, STUMP.stand, HUT.door, AT_STUMP + 900, toHut, 'idle', false))
beats.push({ at: IN + 400, parts: { [K]: { opacity: 1 } } })
beats.push({ at: IN + 900, parts: { [K]: { opacity: 0 } }, easing: 'easeIn' })
beats.push({ at: IN + 1100, parts: { hutGlow: { opacity: 0 } } })
beats.push({ at: IN + 1700, parts: { hutGlow: { opacity: 1 } }, easing: 'easeOut' })
beats.push({ at: NIGHT.lift - 1500, parts: { hutGlow: { opacity: 1 } } })
beats.push({ at: NIGHT.lift, parts: { hutGlow: { opacity: 0 } }, easing: 'easeIn' })

// Supper on: smoke from the chimney until the small hours.
const puff = (id: string, start: number, until: number): void => {
  for (let t0 = start; t0 < until; t0 += 3600) {
    const rise = (f: number): Vec2 => vec([HUT.chimney[0] + 5 * f, HUT.chimney[1] - 22 * f])
    beats.push({ at: t0, parts: { [id]: { at: rise(0), scale: 0.45, opacity: 0 } } })
    beats.push({ at: t0 + 300, parts: { [id]: { at: rise(0.1), scale: 0.6, opacity: 0.8 } } })
    beats.push({ at: t0 + 1600, parts: { [id]: { at: rise(0.5), scale: 1.2, opacity: 0.5 } } })
    beats.push({ at: t0 + 3000, parts: { [id]: { at: rise(1), scale: 1.9, opacity: 0 } } })
  }
}
puff('hutSmoke0', IN + 1300, NIGHT.lift - 3000)
puff('hutSmoke1', IN + 2500, NIGHT.lift - 3000)
puff('hutSmoke2', IN + 3700, NIGHT.lift - 3000)

export const act = defineAct('islandDusk', 'Dusk, and the light', beats, parts)
