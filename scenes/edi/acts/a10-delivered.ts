/**
 * 214 — delivered, with proof
 *
 * Arrival, and the rig carries on out of the frame. Three parties are told, because
 * this is the message the invoice will be argued about against.
 */

import { defineAct } from './kit.ts'
import { ACK, ACK_DELAY, DWELL, HAUL, HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi10Delivered',
  title: '214 — delivered, with proof',
  flights: [
    { shape: 'status', from: 'hub', to: 'shipper', at: DWELL, duration: HOP },
    { shape: 'status', from: 'hub', to: 'consignee', at: DWELL + 300, duration: HOP },
    { shape: 'ack', from: 'shipper', to: 'hub', at: DWELL + HOP + ACK_DELAY, duration: ACK },
  ],
  drive: { from: 0.8, to: 1, at: 0, duration: HAUL, parkAfter: true },
})

export const scene = act.scene
