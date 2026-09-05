/**
 * 214 — picked up
 *
 * Freight on board. The status goes out as the rig pulls away, and the shipper
 * acknowledges it.
 */

import { defineAct } from './kit.ts'
import { ACK, ACK_DELAY, DWELL, HAUL, HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi06Pickup',
  title: '214 — picked up',
  flights: [
    { shape: 'status', from: 'hub', to: 'shipper', at: DWELL, duration: HOP },
    { shape: 'ack', from: 'shipper', to: 'hub', at: DWELL + HOP + ACK_DELAY, duration: ACK },
  ],
  drive: { from: 0.16, to: 0.33, at: DWELL, duration: HAUL },
})

export const scene = act.scene
