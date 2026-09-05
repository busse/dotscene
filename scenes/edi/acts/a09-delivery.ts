/**
 * 214 — out for delivery
 *
 * The last leg. Nothing new is being told, only where the freight has got to.
 */

import { defineAct } from './kit.ts'
import { HAUL, HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi09Delivery',
  title: '214 — out for delivery',
  flights: [{ shape: 'status', from: 'hub', to: 'shipper', at: 300, duration: HOP }],
  drive: { from: 0.6, to: 0.8, at: 0, duration: HAUL },
})

export const scene = act.scene
