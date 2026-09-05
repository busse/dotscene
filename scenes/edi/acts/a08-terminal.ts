/**
 * 214 — arrived at terminal
 *
 * The long leg, through the crossdock. A copy of the status goes to the broker as
 * well as the shipper — the same event, told to two people.
 */

import { defineAct } from './kit.ts'
import { HAUL, HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi08Terminal',
  title: '214 — arrived at terminal',
  flights: [
    { shape: 'status', from: 'hub', to: 'shipper', at: Math.round(HAUL * 0.4), duration: HOP },
    { shape: 'status', from: 'hub', to: 'broker', at: Math.round(HAUL * 0.4) + 260, duration: HOP },
  ],
  drive: { from: 0.33, to: 0.6, at: 0, duration: Math.round(HAUL * 1.4) },
})

export const scene = act.scene
