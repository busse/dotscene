/**
 * 214 — arrived at terminal
 *
 * The long leg: over the bridge and up to the carrier's crossdock, where the rig checks in.
 * A copy of the status goes to the broker as well as the shipper — the same event, told to
 * two people who each need it for a different reason.
 */

import { defineAct } from './act.ts'
import { cabTop, drive, flight, look, report } from './kit.ts'
import { HOP } from '../timing.ts'
import { along, nodeOf, routeAt, sites } from '../world.ts'
import { RUN_END as FROM } from './a06-pickup.ts'

/** The check-in point: on the road, in front of the crossdock. */
export const STOP = routeAt([sites.hub.cell[0] + 1.5, sites.hub.cell[1] + 6])
export const DRIVE_MS = 7000
export const STOP_AT = DRIVE_MS
export const HOLD_MS = 2800

const run = drive({ part: 'rig', from: FROM, to: STOP, at: 0, duration: DRIVE_MS, lane: 0.25, easeStop: true })
const here = along(STOP)
const ping = report('terminal', cabTop([here.cell[0], here.cell[1] + 0.25], here.axis, here.dir), nodeOf('carrier'), STOP_AT + 300)
const toShipper = flight({ id: 'terminal', from: nodeOf('carrier'), to: nodeOf('shipper'), at: STOP_AT + 1200, duration: HOP, label: '214', badge: 'pin' })
const toBroker = flight({ id: 'terminalB', from: nodeOf('carrier'), to: nodeOf('broker'), at: STOP_AT + 1500, duration: HOP, label: '214', badge: 'pin' })

export const act = defineAct({
  id: 'edi08Terminal',
  title: '214 — arrived at terminal',
  parts: [...ping.parts, ...toShipper.parts, ...toBroker.parts],
  beats: [...run, ...ping.beats, ...toShipper.beats, ...toBroker.beats],
  focus: { at: look(sites.hub.cell, 4), width: 300 },
  tail: HOLD_MS,
})

export const scene = act.scene
