/**
 * Dawn. The sun comes up over the sea, the keeper wakes in the hammock, stretches, and walks
 * down to the dock where the first misfit is waiting.
 */

import { defineAct } from './act.ts'
import { arcAcross, lyingAt, standAt, walk, walkTime } from './kit.ts'
import { HAMMOCK, MOON, SUN, WORK } from '../world.ts'
import { START } from '../timing.ts'

const K = 'keeper'

const wake = [
  { at: 0, parts: lyingAt(K, HAMMOCK.cell, HAMMOCK.z) },
  { at: 2400, parts: lyingAt(K, HAMMOCK.cell, HAMMOCK.z) },
  // Swings upright beside the hammock.
  { at: 3400, parts: standAt(K, HAMMOCK.stand, 'idle'), easing: 'easeInOut' as const },
  { at: 3700, parts: standAt(K, HAMMOCK.stand, 'wave') },
  { at: 4400, parts: standAt(K, HAMMOCK.stand, 'wave') },
  { at: 4700, parts: standAt(K, HAMMOCK.stand, 'idle') },
  ...walk(K, HAMMOCK.stand, WORK.mainframe, 4900, Math.max(walkTime(HAMMOCK.stand, WORK.mainframe), START.mainframe - 5400)),
]

/** The sun's whole day: up out of the sea past the point at dawn, down on the far side at dusk. */
const sun = arcAcross('sun', SUN.rise, SUN.set, SUN.height, 0, START.dusk + 6500, [0, 1, 0])
/** And the moon's night, the other way. */
const moon = arcAcross('moon', MOON.rise, MOON.set, MOON.height, START.night + 1000, 60000 - START.night - 1000 - 400, [0, 1, 0])

export const act = defineAct('islandDawn', 'Dawn on the island', [...wake, ...sun, ...moon])
