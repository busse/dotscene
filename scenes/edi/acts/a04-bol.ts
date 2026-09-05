/**
 * 211 — bill of lading
 *
 * The contract of carriage: what is being shipped, and to whom. Shipper to carrier, and
 * acknowledged.
 */

import { defineAct } from './act.ts'
import { between, flight, flightSpan } from './kit.ts'
import { ACK, ACK_DELAY, HOP } from '../timing.ts'
import { nodeOf } from '../world.ts'

const bol = flight({ id: 'bol', from: nodeOf('shipper'), to: nodeOf('carrier'), at: 0, duration: HOP, label: '211', badge: 'doc' })
const ack = flight({ id: 'bolAck', from: nodeOf('carrier'), to: nodeOf('shipper'), at: flightSpan(HOP) + ACK_DELAY, duration: ACK, badge: 'check', small: true })

export const act = defineAct({
  id: 'edi04Bol',
  title: '211 — bill of lading',
  parts: [...bol.parts, ...ack.parts],
  beats: [...bol.beats, ...ack.beats],
  focus: { at: between(nodeOf('shipper'), nodeOf('carrier')), width: 300 },
  tail: 200,
})

export const scene = act.scene
