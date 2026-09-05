/**
 * 211 — bill of lading
 *
 * What is actually on the truck, in detail, before anyone drives anywhere.
 */

import { defineAct } from './kit.ts'
import { ACK, ACK_DELAY, HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi04Bol',
  title: '211 — bill of lading',
  flights: [
    { shape: 'doc', from: 'shipper', to: 'hub', at: 0, duration: HOP },
    { shape: 'ack', from: 'hub', to: 'shipper', at: HOP + ACK_DELAY, duration: ACK },
  ],
})

export const scene = act.scene
