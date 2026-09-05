/**
 * 204 — load tender
 *
 * The shipper offers a load. Nothing physical has happened yet, and nothing will until
 * somebody answers.
 */

import { defineAct } from './act.ts'
import { between, flight } from './kit.ts'
import { HOP } from '../timing.ts'
import { nodeOf } from '../world.ts'

const tender = flight({ id: 'tender', from: nodeOf('shipper'), to: nodeOf('carrier'), at: 0, duration: HOP, label: '204', badge: 'doc' })

export const act = defineAct({
  id: 'edi01Tender',
  title: '204 — load tender',
  parts: tender.parts,
  beats: tender.beats,
  focus: { at: between(nodeOf('shipper'), nodeOf('carrier')), width: 300 },
  tail: 200,
})

export const scene = act.scene
