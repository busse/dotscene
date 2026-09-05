/**
 * 990 — response to a load tender
 *
 * The carrier takes the load. This is the moment the freight becomes somebody's
 * responsibility.
 */

import { defineAct } from './kit.ts'
import { ACK, ACK_DELAY, HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi03Accept',
  title: '990 — response to a load tender',
  flights: [
    { shape: 'doc', from: 'hub', to: 'shipper', at: 0, duration: HOP },
    { shape: 'ack', from: 'shipper', to: 'hub', at: HOP + ACK_DELAY, duration: ACK },
  ],
})

export const scene = act.scene
