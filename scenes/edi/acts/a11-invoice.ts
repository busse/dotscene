/**
 * 210 — freight invoice
 *
 * The carrier bills. It goes to the payer, who is nowhere near the road and never
 * saw the freight.
 */

import { defineAct } from './kit.ts'
import { ACK, ACK_DELAY, LONG_HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi11Invoice',
  title: '210 — freight invoice',
  flights: [
    { shape: 'doc', from: 'hub', to: 'payer', at: 0, duration: LONG_HOP },
    { shape: 'ack', from: 'payer', to: 'hub', at: LONG_HOP + ACK_DELAY, duration: ACK },
  ],
})

export const scene = act.scene
