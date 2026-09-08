/**
 * Life that has nothing to do with the story.
 *
 * A pennant fluttering, smoke from the plant's stack, trees moving in the same wind, birds
 * crossing, a van going about its own business, a forklift at the crossdock working a door
 * all day. None of it means anything, and it is what keeps the frame from ever being still.
 * Every loop here runs for the whole lap and ends where it began, so the cut is invisible.
 */

import { easings, type Beat, type Vec2 } from 'dotscene'
import { cycle, drive, liftAt } from './kit.ts'
import { HUB_LIFT_HOME, HUB_LIFT_OUT, STACK_TOP } from '../world.ts'
import { LOOP } from '../timing.ts'

const beats: Beat[] = []

// The carrier's pennant, always moving.
beats.push(...cycle('officeFlag', ['a', 'b', 'c'], 1260, 0, LOOP, 'easeInOut').filter((b) => b.at <= LOOP))

// The trees the camera spends time near, swaying on slightly different clocks.
const swaying: readonly [string, number, number][] = [
  ['tree2', 4200, 0],
  ['tree3', 3800, 900],
  ['tree4', 4600, 1700],
  ['tree9', 4000, 500],
  ['tree0', 4400, 2300],
]
for (const [id, period, phase] of swaying) {
  let t = phase
  let up = false
  while (t < LOOP - period / 4) {
    beats.push({ at: Math.round(t), parts: { [id]: { pose: up ? 'sway' : 'rest' } } })
    up = !up
    t += period / 2
  }
  beats.push({ at: LOOP, parts: { [id]: { pose: 'rest' } } })
}

// Smoke: three puffs on one clock, each rising, spreading and thinning until it is gone.
const PUFF_PERIOD = 3900
const PUFF_LIFE = 3300
const puffBeats = (id: string, start: number): Beat[] => {
  const out: Beat[] = []
  for (let t0 = start; t0 < LOOP; t0 += PUFF_PERIOD) {
    const drift = 6 + ((t0 / PUFF_PERIOD) % 3) * 2
    const rise = (f: number): Vec2 => [
      Math.round((STACK_TOP[0] + drift * f) * 100) / 100,
      Math.round((STACK_TOP[1] - 28 * easings.easeOut(f)) * 100) / 100,
    ]
    out.push({ at: t0, parts: { [id]: { at: rise(0), scale: 0.5, opacity: 0 } } })
    out.push({ at: t0 + 300, parts: { [id]: { at: rise(0.1), scale: 0.7, opacity: 0.8 } } })
    out.push({ at: t0 + PUFF_LIFE * 0.5, parts: { [id]: { at: rise(0.5), scale: 1.4, opacity: 0.5 } } })
    out.push({ at: Math.min(LOOP - 1, t0 + PUFF_LIFE), parts: { [id]: { at: rise(1), scale: 2.2, opacity: 0 } } })
  }
  return out
}
beats.push(...puffBeats('smoke0', 0), ...puffBeats('smoke1', 1300), ...puffBeats('smoke2', 2600))

// Ripples on the river near the bridge: drift downstream, fade, and start again.
const RIPPLE_PERIOD = 3000
for (const id of ['ripples1', 'ripples2']) {
  const phase = id === 'ripples1' ? 0 : 1100
  for (let t0 = phase; t0 < LOOP; t0 += RIPPLE_PERIOD) {
    beats.push({ at: t0, parts: { [id]: { pose: 'a', opacity: 0 } } })
    beats.push({ at: t0 + RIPPLE_PERIOD * 0.25, parts: { [id]: { pose: 'b', opacity: 1 } } })
    beats.push({ at: t0 + RIPPLE_PERIOD * 0.7, parts: { [id]: { pose: 'c', opacity: 0.9 } } })
    beats.push({ at: Math.min(LOOP - 1, t0 + RIPPLE_PERIOD - 1), parts: { [id]: { pose: 'c', opacity: 0 } } })
  }
}

// Birds: two crossings, high and slow, flapping as they go.
const crossing = (start: number, from: Vec2, to: Vec2, duration: number): Beat[] => {
  const out: Beat[] = []
  const flaps = Math.round(duration / 320)
  for (let i = 0; i <= flaps; i++) {
    const f = i / flaps
    const at: Vec2 = [
      Math.round((from[0] + (to[0] - from[0]) * f) * 100) / 100,
      Math.round((from[1] + (to[1] - from[1]) * f + Math.sin(f * Math.PI * 3) * 4) * 100) / 100,
    ]
    const opacity = i === 0 || i === flaps ? 0 : 1
    out.push({ at: Math.round(start + duration * f), parts: { birds: { at, pose: i % 2 === 0 ? 'up' : 'down', opacity } } })
  }
  return out
}
beats.push(...crossing(29200, [-260, -176], [240, -160], 6200))
beats.push(...crossing(51200, [320, -188], [-40, -168], 6400))

// Clouds drift, and fade at the edges so the cut never shows a jump.
const cloudDrift = (id: string, from: Vec2, to: Vec2, scale: number, opacity: number): Beat[] => [
  { at: 0, parts: { [id]: { at: from, scale, opacity: 0 } } },
  { at: 2500, parts: { [id]: { at: [from[0] + 6, from[1]], scale, opacity } } },
  { at: LOOP - 2500, parts: { [id]: { at: [to[0] - 6, to[1]], scale, opacity } } },
  { at: LOOP - 1, parts: { [id]: { at: to, scale, opacity: 0 } } },
]
beats.push(...cloudDrift('cloudA', [-260, -158], [-40, -152], 1.6, 0.9))
beats.push(...cloudDrift('cloudB', [40, -142], [250, -136], 1.1, 0.8))

// A van with somewhere else to be: once each way, timed to pass the rig in the other lane.
const vanRun = (from: number, to: number, at: number): Beat[] =>
  drive({ part: 'van', from, to, at, duration: 11000, lane: 0.3 }).map((b) => ({
    ...b,
    parts: { van: { ...b.parts!.van!, opacity: 1 } },
  }))
beats.push({ at: 400, parts: { van: { at: [-2000, -2000], opacity: 0 } } })
beats.push(...vanRun(0, 1, 500))
beats.push({ at: 11501, parts: { van: { at: [-2000, -2000], opacity: 0 } } })
beats.push({ at: 29999, parts: { van: { at: [-2000, -2000], opacity: 0 } } })
beats.push(...vanRun(1, 0, 30000))
beats.push({ at: 41001, parts: { van: { at: [-2000, -2000], opacity: 0 } } })

// The crossdock's own forklift, in and out of its open door all day.
const SHUTTLE = 7200
const clamp = (t: number) => Math.min(LOOP - 1, t)
for (let t0 = 0; t0 < LOOP; t0 += SHUTTLE) {
  beats.push({ at: clamp(t0), parts: liftAt('hubLift', HUB_LIFT_HOME, 'y', false, undefined, 0.3) })
  beats.push({ at: clamp(t0 + 1900), parts: liftAt('hubLift', HUB_LIFT_OUT, 'y', false, undefined, 0.3), easing: 'easeInOut' })
  beats.push({ at: clamp(t0 + 2400), parts: liftAt('hubLift', HUB_LIFT_OUT, 'y', true, undefined, 0.3), easing: 'easeInOut' })
  beats.push({ at: clamp(t0 + 3600), parts: liftAt('hubLift', HUB_LIFT_OUT, 'y', true, undefined, 0.3) })
  beats.push({ at: clamp(t0 + 4100), parts: liftAt('hubLift', HUB_LIFT_OUT, 'y', false, undefined, 0.3), easing: 'easeInOut' })
  beats.push({ at: clamp(t0 + 6000), parts: liftAt('hubLift', HUB_LIFT_HOME, 'y', false, undefined, 0.3), easing: 'easeInOut' })
}

/** Everything ambient, as one act placed at zero. */
export const ambient = { name: 'ambient', beats: beats.filter((b) => b.at <= LOOP).sort((a, b) => a.at - b.at) }
