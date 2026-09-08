/**
 * Dusk. The keeper reaches the lighthouse as the sun goes behind the point and lights the
 * lamp. The beam swings out over the sea and the island. Later, home to the hut: a window
 * lights, the chimney smokes, and the keeper comes back out to sleep in the hammock.
 */

import { type Beat, type Part, type Vec2 } from 'dotscene'
import { pulseRing } from '../../edi/figures/tokens.ts'
import { smokePuff } from '../../edi/figures/places.ts'
import { glow } from '../figures/fixtures.ts'
import { defineAct } from './act.ts'
import { lyingAt, restAt, SKY, standAt, walk, walkTime, vec, type Cell } from './kit.ts'
import { HAMMOCK, HUT, LAMP, MUG_ON_STUMP, STUMP } from '../world.ts'
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

// Home to the hut for supper, mug and all; the window lights. Then out again — over to the
// stump beside the hammock, the mug set down on it, and into the hammock for the night, so the
// keeper the morning finds there is the one that went to bed.
/** Two straight legs by way of `mid`, with a beat between them; returns when the walk ends. */
const via = (from: Cell, mid: Cell, to: Cell, at: number, carry: boolean): number => {
  const first = walkTime(from, mid)
  const second = walkTime(mid, to)
  beats.push(...walk(K, from, mid, at, first, 'idle', carry))
  beats.push(...walk(K, mid, to, at + first + 60, second, 'idle', carry))
  return at + first + 60 + second
}

const HOME = LIT + 1800
// Round the hut's near corner rather than through it.
const IN = via(HUT.lighthouseDoor, HUT.corner, HUT.door, HOME, true)
beats.push({ at: IN + 300, parts: { [K]: { opacity: 1 }, mug: { opacity: 1 } } })
beats.push({ at: IN + 800, parts: { [K]: { opacity: 0 }, mug: { opacity: 0 } }, easing: 'easeIn' })
beats.push({ at: IN + 600, parts: { hutGlow: { opacity: 0 } } })
beats.push({ at: IN + 1100, parts: { hutGlow: { opacity: 1 } }, easing: 'easeOut' })
beats.push({ at: NIGHT.lift - 1500, parts: { hutGlow: { opacity: 1 } } })
beats.push({ at: NIGHT.lift, parts: { hutGlow: { opacity: 0 } }, easing: 'easeIn' })

const OUT = IN + 1000
const atDoor = standAt(K, HUT.door, 'idle')
beats.push({ at: OUT, parts: { [K]: { ...atDoor[K], opacity: 0 }, mug: { ...atDoor.mug, opacity: 0 } } })
beats.push({ at: OUT + 500, parts: { [K]: { opacity: 1 }, mug: { opacity: 1 } }, easing: 'easeOut' })
// Round the palm at the hammock's end to its near side, rather than through the hammock.
const AT_STUMP = via(HUT.door, HAMMOCK.around, STUMP.stand, OUT + 600, true)
beats.push({ at: AT_STUMP + 250, parts: standAt(K, STUMP.stand, 'offerL', true), easing: 'easeInOut' })
beats.push({ at: AT_STUMP + 550, parts: { mug: { ...MUG_ON_STUMP } }, easing: 'easeOut' })
beats.push({ at: AT_STUMP + 800, parts: standAt(K, STUMP.stand, 'idle', true, 0, false), easing: 'easeInOut' })
beats.push({ at: AT_STUMP + 1200, parts: restAt(HAMMOCK.cell, HAMMOCK.z, 'sitUp', false), easing: 'easeInOut' })
beats.push({ at: AT_STUMP + 1800, parts: lyingAt(HAMMOCK.cell, HAMMOCK.z), easing: 'easeInOut' })

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
puff('hutSmoke0', IN + 900, NIGHT.lift - 3000)
puff('hutSmoke1', IN + 2100, NIGHT.lift - 3000)
puff('hutSmoke2', IN + 3300, NIGHT.lift - 3000)

export const act = defineAct('islandDusk', 'Dusk, and the light', beats, parts)
