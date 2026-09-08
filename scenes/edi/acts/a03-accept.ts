/**
 * 990 — response to a load tender
 *
 * The carrier says yes, and the yes is acknowledged. Then, and only then, a rig pulls off its
 * bay at the crossdock — data moves first.
 */

import { defineAct } from './act.ts'
import { dock, flight, flightSpan, look } from './kit.ts'
import { ACK, ACK_DELAY, DOCKING, HOP } from '../timing.ts'
import { nodeOf, RIG_LANE, sites } from '../world.ts'

const accept = flight({ id: 'accept', from: nodeOf('carrier'), to: nodeOf('shipper'), at: 0, duration: HOP, label: '990', badge: 'check' })
const ack = flight({ id: 'accept', from: nodeOf('shipper'), to: nodeOf('carrier'), at: flightSpan(HOP) + ACK_DELAY, duration: ACK, badge: 'check', small: true })

/** The rig leaves its bay while the paperwork is still in the air, heading back up the road. */
const pullOut = dock({ part: 'rig', door: sites.hub.doors[3]!, at: 900, duration: DOCKING, direction: 'out', facing: 'back', lane: RIG_LANE })

export const act = defineAct({
  id: 'edi03Accept',
  title: '990 — response to tender',
  parts: [...accept.parts, ...ack.parts.map((p) => ({ ...p, id: `${p.id}B` }))],
  beats: [...accept.beats, ...ack.beats.map((b) => ({ ...b, parts: Object.fromEntries(Object.entries(b.parts ?? {}).map(([k, v]) => [`${k}B`, v])) })), ...pullOut],
  focus: { at: look(sites.hub.cell, 3), width: 260 },
  tail: 200,
})

export const scene = act.scene
