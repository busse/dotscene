/**
 * Dawn. The sun comes up out of the sea. The keeper wakes in the hammock, sits up, and reaches
 * for the mug of coffee waiting on the stump — steaming — for two slow sips before anything
 * else happens. Then down onto the grass, a stretch, and off to the dock, mug in hand. The mug
 * stays in hand all day, until it goes back on the stump at dusk.
 */

import type { Beat, PartKeyframe } from 'dotscene'
import { defineAct } from './act.ts'
import { arcAcross, lyingAt, restAt, standAt, steamOver, walk } from './kit.ts'
import { HAMMOCK, MOON, MUG_ON_STUMP, SUN, WORK } from '../world.ts'
import { START } from '../timing.ts'

const K = 'keeper'
const H = HAMMOCK
const lying = lyingAt(H.cell, H.z)
const sitting = restAt(H.cell, H.z, 'sitUp', false)
const reaching = restAt(H.cell, H.z, 'reachSit', false)
/** Where the mug lands when picked up: the reaching hand. */
const inReach = restAt(H.cell, H.z, 'reachSit').mug!
const held = restAt(H.cell, H.z, 'sitUp')
const sipping = restAt(H.cell, H.z, 'sipSit')
const onStump = (pose: 'a' | 'b', opacity: number): PartKeyframe => ({ at: MUG_ON_STUMP.at, pose, opacity, depth: MUG_ON_STUMP.depth + 0.01 })

const WALK_AT = 5450
const wake: Beat[] = [
  { at: 0, parts: lying },
  { at: 1200, parts: lying },
  // Sits up — the hip stays put, the torso rises. The coffee on the stump is already steaming.
  { at: 1800, parts: { ...sitting, steam: onStump('a', 0) }, easing: 'easeInOut' },
  { at: 2150, parts: { ...reaching, steam: onStump('a', 1) }, easing: 'easeInOut' },
  // The mug hops the last of the way into the hand.
  { at: 2450, parts: { mug: inReach, steam: steamOver({ mug: inReach }, 'b', 1) }, easing: 'easeInOut' },
  { at: 2700, parts: { ...held, steam: steamOver(held, 'a', 1) }, easing: 'easeInOut' },
  // First sip.
  { at: 2950, parts: { ...sipping, steam: steamOver(sipping, 'a', 1) }, easing: 'easeInOut' },
  { at: 3150, parts: { steam: steamOver(sipping, 'b', 1) } },
  { at: 3350, parts: { ...sipping, steam: steamOver(sipping, 'a', 1) } },
  { at: 3600, parts: { ...held, steam: steamOver(held, 'a', 1) }, easing: 'easeInOut' },
  // Second sip.
  { at: 3850, parts: { ...sipping, steam: steamOver(sipping, 'b', 1) }, easing: 'easeInOut' },
  { at: 4050, parts: { steam: steamOver(sipping, 'a', 1) } },
  { at: 4250, parts: { ...sipping, steam: steamOver(sipping, 'b', 1) } },
  { at: 4500, parts: { ...held, steam: steamOver(held, 'a', 0.6) }, easing: 'easeInOut' },
  { at: 4700, parts: { steam: steamOver(held, 'a', 0) }, easing: 'easeIn' },
  // Down onto the grass, a stretch, and away.
  { at: 4600, parts: held },
  { at: 4900, parts: standAt(K, H.stand, 'idle'), easing: 'easeOut' },
  { at: 5000, parts: standAt(K, H.stand, 'stretch'), easing: 'easeInOut' },
  { at: 5250, parts: standAt(K, H.stand, 'stretch') },
  { at: WALK_AT - 50, parts: standAt(K, H.stand, 'idle'), easing: 'easeInOut' },
  ...walk(K, H.stand, WORK.mainframe, WALK_AT, START.mainframe + 200 - WALK_AT),
]

/** The sun's whole day: up out of the sea past the point at dawn, down on the far side at dusk. */
const sun = arcAcross('sun', SUN.rise, SUN.set, SUN.height, 0, START.dusk + 6500, [0, 1, 0])
/** And the moon's night, the other way. */
const moon = arcAcross('moon', MOON.rise, MOON.set, MOON.height, START.night + 1000, 60000 - START.night - 1000 - 400, [0, 1, 0])

export const act = defineAct('islandDawn', 'Dawn on the island', [...wake, ...sun, ...moon])
