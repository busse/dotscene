/**
 * 997 — functional acknowledgment
 *
 * Not an answer, just a receipt: the message arrived and parsed. Every transaction
 * gets one, which is why the network is never quiet.
 */

import { defineAct } from './kit.ts'
import { ACK } from '../timing.ts'

export const act = defineAct({
  id: 'edi02Ack',
  title: '997 — functional acknowledgment',
  flights: [{ shape: 'ack', from: 'hub', to: 'shipper', at: 0, duration: ACK }],
})

export const scene = act.scene
