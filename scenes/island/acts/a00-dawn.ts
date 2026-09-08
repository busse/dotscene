/**
 * Dawn. The sun comes up out of the sea. The keeper wakes in the hammock, sits up, and a mug
 * of coffee arrives — steaming — for two slow sips before anything else happens. Then down
 * onto the grass, a stretch, and off to the dock, mug in hand. The mug stays in hand all day.
 */

import type { Beat } from 'dotscene'
import { defineAct } from './act.ts'
import { arcAcross, lyingAt, restAt, standAt, steamOver, walk } from './kit.ts'
import { HAMMOCK, MOON, SUN, WORK } from '../world.ts'
import { START } from '../timing.ts'

const K = 'keeper'
const lying = lyingAt(HAMMOCK.cell, HAMMOCK.z)
const sitting = restAt(HAMMOCK.cell, HAMMOCK.z, 'sitUp')
const sipping = restAt(HAMMOCK.cell, HAMMOCK.z, 'sipSit')

const WALK_AT = 5500
const wake: Beat[] = [
  { at: 0, parts: lying },
  { at: 1400, parts: lying },
  // Sits up — the hip stays put, the torso rises.
  { at: 2000, parts: sitting, easing: 'easeInOut' },
  // Coffee appears in the left hand, steaming.
  { at: 2200, parts: { mug: { ...sitting.mug, opacity: 0 }, steam: steamOver(sitting, 'a', 0) } },
  { at: 2500, parts: { mug: { ...sitting.mug, opacity: 1 }, steam: steamOver(sitting, 'a', 1) }, easing: 'easeOut' },
  // First sip.
  { at: 2800, parts: { ...sipping, steam: steamOver(sipping, 'a', 1) }, easing: 'easeInOut' },
  { at: 3050, parts: { steam: steamOver(sipping, 'b', 1) } },
  { at: 3250, parts: { ...sipping, steam: steamOver(sipping, 'a', 1) } },
  { at: 3550, parts: { ...sitting, steam: steamOver(sitting, 'a', 1) }, easing: 'easeInOut' },
  // Second sip.
  { at: 3850, parts: { ...sipping, steam: steamOver(sipping, 'b', 1) }, easing: 'easeInOut' },
  { at: 4100, parts: { steam: steamOver(sipping, 'a', 1) } },
  { at: 4300, parts: { ...sipping, steam: steamOver(sipping, 'b', 1) } },
  { at: 4550, parts: { ...sitting, steam: steamOver(sitting, 'a', 0.6) }, easing: 'easeInOut' },
  { at: 4800, parts: { steam: steamOver(sitting, 'a', 0) }, easing: 'easeIn' },
  // Down onto the grass, a stretch, and away.
  { at: 4650, parts: sitting },
  { at: 5000, parts: standAt(K, HAMMOCK.stand, 'idle'), easing: 'easeOut' },
  { at: 5100, parts: standAt(K, HAMMOCK.stand, 'stretch'), easing: 'easeInOut' },
  { at: 5350, parts: standAt(K, HAMMOCK.stand, 'stretch') },
  { at: WALK_AT - 100, parts: standAt(K, HAMMOCK.stand, 'idle'), easing: 'easeInOut' },
  ...walk(K, HAMMOCK.stand, WORK.mainframe, WALK_AT, START.mainframe + 200 - WALK_AT),
]

/** The sun's whole day: up out of the sea past the point at dawn, down on the far side at dusk. */
const sun = arcAcross('sun', SUN.rise, SUN.set, SUN.height, 0, START.dusk + 6500, [0, 1, 0])
/** And the moon's night, the other way. */
const moon = arcAcross('moon', MOON.rise, MOON.set, MOON.height, START.night + 1000, 60000 - START.night - 1000 - 400, [0, 1, 0])

export const act = defineAct('islandDawn', 'Dawn on the island', [...wake, ...sun, ...moon])
