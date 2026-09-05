/**
 * 997 — functional acknowledgment
 *
 * "Got it." The smallest message in the set, and the one sent most often: every document
 * that lands is answered with one of these.
 */

import { defineAct } from './act.ts'
import { between, flight } from './kit.ts'
import { ACK } from '../timing.ts'
import { nodeOf } from '../world.ts'

const ack = flight({ id: 'ack1', from: nodeOf('carrier'), to: nodeOf('shipper'), at: 0, duration: ACK, badge: 'check', small: true })

export const act = defineAct({
  id: 'edi02Ack',
  title: '997 — functional acknowledgment',
  parts: ack.parts,
  beats: ack.beats,
  focus: { at: between(nodeOf('shipper'), nodeOf('carrier')), width: 300 },
  tail: 200,
})

export const scene = act.scene
