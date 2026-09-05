/**
 * 204 — load tender
 *
 * The shipper offers a load. Nothing physical has happened yet, and nothing will
 * until somebody answers.
 */

import { defineAct } from './kit.ts'
import { HOP } from '../timing.ts'

export const act = defineAct({
  id: 'edi01Tender',
  title: '204 — load tender',
  flights: [{ shape: 'doc', from: 'shipper', to: 'hub', at: 0, duration: HOP }],
})

export const scene = act.scene
