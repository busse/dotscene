/**
 * 214 — out for delivery
 *
 * The last leg. The rig pulls away from the crossdock and runs the road to the consignee,
 * and the consignee is told it is coming.
 */

import { defineAct } from './act.ts'
import { drive, flight, look, roadAtDoor } from './kit.ts'
import { HOP } from '../timing.ts'
import { nodeOf, RIG_LANE, sites } from '../world.ts'
import { STOP } from './a08-terminal.ts'

export const RUN_END = roadAtDoor(sites.consignee.doors[0]!)
export const DRIVE_MS = 5000

const run = drive({ part: 'rig', from: STOP, to: RUN_END, at: 0, duration: DRIVE_MS, lane: RIG_LANE, easeStart: true, easeStop: true })
const status = flight({ id: 'outFor', from: nodeOf('carrier'), to: nodeOf('consignee'), at: 600, duration: HOP, label: '214', badge: 'pin' })

export const act = defineAct({
  id: 'edi09Delivery',
  title: '214 — out for delivery',
  parts: status.parts,
  beats: [...run, ...status.beats],
  focus: { at: look(sites.consignee.cell, 2), width: 320 },
  tail: 200,
})

export const scene = act.scene
