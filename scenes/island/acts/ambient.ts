/**
 * Life that is not the story: palms in the breeze, the waves, a crab on the sand, a turtle
 * in the shallows, gulls over the sea, and stars when it is dark. Every loop ends on its
 * first pose, so the wrap holds rather than snaps.
 */

import type { Beat } from 'dotscene'
import { cycle } from './kit.ts'
import { LOOP, NIGHT } from '../timing.ts'
import { at as project } from '../../edi/projection.ts'
import { isl, STARS_AT } from '../world.ts'
import { depthOf, vec, type Cell } from './kit.ts'

const beats: Beat[] = []

// Palms, each on its own clock.
const PALM_PHASE = [0, 900, 1700, 400, 2300, 1200, 700]
PALM_PHASE.forEach((phase, i) => {
  const period = 3800 + (i % 3) * 500
  let t = phase
  let k = 0
  const poses = ['rest', 'swayA', 'rest', 'swayB']
  while (t < LOOP - period / 4) {
    beats.push({ at: Math.round(t), parts: { [`palm${i}`]: { pose: poses[k % 4]! } }, easing: 'easeInOut' })
    t += period / 4
    k++
  }
  beats.push({ at: LOOP, parts: { [`palm${i}`]: { pose: 'rest' } }, easing: 'easeInOut' })
})

// Waves: four patches of ripples, drifting and fading, on staggered clocks.
const WAVE = 3200
for (let i = 0; i < 4; i++) {
  const phase = i * 800
  const id = `waves${i}`
  beats.push({ at: 0, parts: { [id]: { pose: 'a', opacity: 0 } } })
  for (let t0 = phase; t0 + WAVE <= LOOP; t0 += WAVE) {
    beats.push({ at: t0, parts: { [id]: { pose: 'a', opacity: 0 } } })
    beats.push({ at: t0 + WAVE * 0.25, parts: { [id]: { pose: 'b', opacity: 0.9 } } })
    beats.push({ at: t0 + WAVE * 0.7, parts: { [id]: { pose: 'c', opacity: 0.8 } } })
    beats.push({ at: t0 + WAVE - 1, parts: { [id]: { pose: 'c', opacity: 0 } } })
  }
  beats.push({ at: LOOP, parts: { [id]: { pose: 'a', opacity: 0 } } })
}

// The crab, sideways along the sand and back, every few seconds.
const crabAt = (c: Cell, pose: string) => ({ crab: { at: vec(project([c[0], c[1], 0])), pose, depth: depthOf(c) + 0.2 } })
const CRAB_A = isl(4.5, 6.4)
const CRAB_B = isl(8, 6.6)
for (let t0 = 0; t0 + 5200 <= LOOP; t0 += 5200) {
  const out = (t0 / 5200) % 2 === 0
  const from = out ? CRAB_A : CRAB_B
  const to = out ? CRAB_B : CRAB_A
  for (let i = 0; i <= 8; i++) {
    const f = i / 8
    const c: Cell = [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f]
    beats.push({ at: t0 + Math.round(2400 * f), parts: crabAt(c, i % 2 === 0 ? 'a' : 'b') })
  }
}
beats.push({ at: LOOP, parts: crabAt(CRAB_A, 'a') })

// The turtle, a slow loop in the shallows off the dock.
const turtleAt = (c: Cell, pose: string) => ({ turtle: { at: vec(project([c[0], c[1], 0])), pose } })
const TURTLE_PATH: readonly Cell[] = [isl(9, 12), isl(12, 12.5), isl(14, 11), isl(11.5, 10), isl(9, 12)]
{
  const per = LOOP / 2
  for (let lap = 0; lap < 2; lap++) {
    TURTLE_PATH.forEach((c, i) => {
      const t0 = lap * per + Math.round((per * i) / (TURTLE_PATH.length - 1))
      for (let k = 0; k < 4 && i < TURTLE_PATH.length - 1; k++) {
        const next = TURTLE_PATH[i + 1]!
        const f = k / 4
        const cc: Cell = [c[0] + (next[0] - c[0]) * f, c[1] + (next[1] - c[1]) * f]
        beats.push({ at: Math.min(LOOP, t0 + Math.round((per / (TURTLE_PATH.length - 1)) * f)), parts: turtleAt(cc, k % 2 === 0 ? 'a' : 'b') })
      }
    })
  }
  beats.push({ at: LOOP, parts: turtleAt(TURTLE_PATH[0]!, 'a') })
}

// Stars: out in the deep of the night, twinkling, gone before dawn.
beats.push({ at: NIGHT.from + 3000, parts: { stars: { at: STARS_AT, pose: 'a', opacity: 0 } } })
beats.push({ at: NIGHT.deep, parts: { stars: { at: STARS_AT, pose: 'a', opacity: 1 } } })
beats.push(...cycle('stars', ['a', 'b'], 1600, NIGHT.deep, NIGHT.lift - 800).map((b) => ({ ...b, parts: { stars: { ...b.parts!.stars!, at: STARS_AT, opacity: 1 } } })))
beats.push({ at: NIGHT.lift + 1200, parts: { stars: { at: STARS_AT, pose: 'a', opacity: 0 } }, easing: 'easeIn' })

export const ambient = { name: 'islandAmbient', beats: beats.filter((b) => b.at <= LOOP).sort((a, b) => a.at - b.at) }
