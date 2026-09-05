/**
 * 214 — dispatched
 *
 * The first status message, and the first thing to move on the ground: a rig leaves
 * for the shipper's dock.
 */

import { defineAct } from './kit.ts'
import { HAUL, HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi05Dispatch',
  title: '214 — dispatched',
  flights: [{ shape: 'status', from: 'hub', to: 'shipper', at: 0, duration: HOP }],
  drive: { from: 0, to: 0.16, at: 0, duration: HAUL },
})

export const scene = act.scene
