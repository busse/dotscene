/**
 * 856 — advance ship notice
 *
 * The one message that skips the carrier entirely: the shipper tells the consignee
 * what is coming, all the way across the frame, while the freight is still in
 * transit.
 */

import { defineAct } from './kit.ts'
import { ACK, ACK_DELAY, LONG_HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi07Asn',
  title: '856 — advance ship notice',
  flights: [
    { shape: 'doc', from: 'shipper', to: 'consignee', at: 0, duration: LONG_HOP },
    { shape: 'ack', from: 'consignee', to: 'shipper', at: LONG_HOP + ACK_DELAY, duration: ACK },
  ],
})

export const scene = act.scene
