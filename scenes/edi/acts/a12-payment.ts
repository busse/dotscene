/**
 * 820 — payment order and remittance
 *
 * Money moves, and the file closes. The shipper is told, because the shipper is the
 * one who wanted to know what all this cost.
 */

import { defineAct } from './kit.ts'
import { ACK, ACK_DELAY, HOP, LONG_HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi12Payment',
  title: '820 — payment order and remittance',
  flights: [
    { shape: 'doc', from: 'payer', to: 'hub', at: 0, duration: LONG_HOP },
    { shape: 'ack', from: 'hub', to: 'payer', at: LONG_HOP + ACK_DELAY, duration: ACK },
    { shape: 'status', from: 'hub', to: 'shipper', at: LONG_HOP + ACK_DELAY, duration: HOP },
  ],
})

export const scene = act.scene
