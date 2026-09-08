/**
 * 214 — dispatched
 *
 * The first status message, and the first freight-side movement: the rig runs the road
 * back to the shipper, over the bridge, and backs onto the dock. The dock worker waves it in.
 */

import { defineAct } from './act.ts'
import { cycle, dock, drive, flight, look, roadAtDoor, stand } from './kit.ts'
import { DOCKING, HOP } from '../timing.ts'
import { nodeOf, RIG_LANE, sites, WORKER_HOME } from '../world.ts'

const status = flight({ id: 'dispatch', from: nodeOf('carrier'), to: nodeOf('shipper'), at: 0, duration: HOP, label: '214', badge: 'pin' })

/** From the road in front of the rig's bay, back down the route to the shipper's dock. */
export const RUN_START = roadAtDoor(sites.hub.doors[3]!)
export const RUN_END = roadAtDoor(sites.shipper.doors[1]!)
export const DRIVE_AT = 200
export const DRIVE_MS = 7000
export const DOCK_AT = DRIVE_AT + DRIVE_MS

const run = drive({ part: 'rig', from: RUN_START, to: RUN_END, at: DRIVE_AT, duration: DRIVE_MS, lane: RIG_LANE, easeStart: true, easeStop: true })
const backIn = dock({ part: 'rig', door: sites.shipper.doors[1]!, at: DOCK_AT, duration: DOCKING, direction: 'in', lane: RIG_LANE, facing: 'back' })

/** The worker waves the rig in, then stands back. */
const wave = [
  { at: DOCK_AT - 400, parts: stand('worker', WORKER_HOME, 'idle') },
  ...cycle('worker', ['idle', 'wave', 'idle', 'wave'], 1600, DOCK_AT, DOCK_AT + DOCKING + 600, 'easeInOut').map((b) => ({
    ...b,
    parts: { worker: { ...stand('worker', WORKER_HOME, 'idle').worker, ...b.parts!.worker } },
  })),
]

export const act = defineAct({
  id: 'edi05Dispatch',
  title: '214 — dispatched',
  parts: status.parts,
  beats: [...status.beats, ...run, ...backIn, ...wave],
  focus: { at: look(sites.shipper.cell, 1), width: 260 },
  tail: 300,
})

export const scene = act.scene
