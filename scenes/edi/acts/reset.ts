/**
 * Putting things back while nobody is looking.
 *
 * The rig has driven out of the frame and the pallet stands in the consignee's yard; the
 * next lap needs the rig on its bay and the pallet on the shipper's forks. Both jumps happen
 * while the camera is close on the office tower, well away from either place — a cut nobody
 * sees is not a cut.
 */

import { dock, liftAt, type Beat } from './kit.ts'
import { CONSIGNEE_LIFT_HOME, depthOf, SHIPPER_LIFT_WEST, sites } from '../world.ts'

const withDepth = (states: Record<string, { depth?: number }>, depth: number) =>
  Object.fromEntries(Object.entries(states).map(([id, s]) => [id, { ...s, depth }]))

const home = dock({ part: 'rig', door: sites.hub.doors[3]!, at: 0, duration: 1, direction: 'out' })[0]!

export const RESET_MS = 1200

export const reset: { name: string; beats: Beat[] } = {
  name: 'reset',
  beats: [
    // The rig, straight onto its bay.
    { at: 0, parts: home.parts! },
    // The shipper's forklift picks up a fresh pallet, out of sight at the far end of its yard.
    { at: 1, parts: liftAt('shipperLift', SHIPPER_LIFT_WEST, 'x', true, 'pallet') },
    // The consignee's forklift goes back inside, and its door comes down after it.
    { at: 2, parts: withDepth(liftAt('consigneeLift', CONSIGNEE_LIFT_HOME, 'y', false), depthOf(CONSIGNEE_LIFT_HOME)) },
    { at: 400, parts: { consigneeDoor1: { pose: 'open' } } },
    { at: RESET_MS, parts: { consigneeDoor1: { pose: 'closed' } }, easing: 'easeInOut' },
  ],
}
