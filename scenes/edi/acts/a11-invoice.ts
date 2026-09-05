/**
 * 210 — freight invoice
 *
 * Carrier to payer. The bank never saw the freight and never will; it sees this.
 */

import { defineAct } from './act.ts'
import { between, flight } from './kit.ts'
import { HOP } from '../timing.ts'
import { nodeOf } from '../world.ts'

const invoice = flight({ id: 'invoice', from: nodeOf('carrier'), to: nodeOf('bank'), at: 0, duration: HOP + 300, label: '210', badge: 'coin' })

export const act = defineAct({
  id: 'edi11Invoice',
  title: '210 — freight invoice',
  parts: invoice.parts,
  beats: invoice.beats,
  focus: { at: between(nodeOf('carrier'), nodeOf('bank')), width: 320 },
  tail: 200,
})

export const scene = act.scene
