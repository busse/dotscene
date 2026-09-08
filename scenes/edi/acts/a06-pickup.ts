/**
 * 214 — picked up
 *
 * The door rolls up, the forklift puts the pallet in the trailer, and the rig pulls away.
 * The driver's device reports in, the carrier tells the shipper, the shipper acknowledges.
 * The one moment in the whole cycle where freight and data touch.
 */

import { defineAct } from './act.ts'
import { cabTop, dock, door, drive, flight, flightSpan, liftAt, liftCellFor, look, report, roadAtDoor } from './kit.ts'
import { ACK, ACK_DELAY, DOCKING, HOP } from '../timing.ts'
import { dockedAt, loadingSpotWest, nodeOf, RIG_LANE, SHIPPER_LIFT_YARD, SHIPPER_STAGING, sites } from '../world.ts'

const lift = 'shipperLift'
const pal = 'pallet'
const doorCell = sites.shipper.doors[1]!
const atStaging = liftCellFor(SHIPPER_STAGING, 'x')
const atTrailer = loadingSpotWest(doorCell)

/** The loading, along the yard's lane: fetch, lift, carry, and the pallet goes into the trailer. */
const LOAD_AT = 700
const loading = [
  { at: LOAD_AT, parts: liftAt(lift, SHIPPER_LIFT_YARD, 'x', false) },
  { at: LOAD_AT + 900, parts: liftAt(lift, atStaging, 'x', false), easing: 'easeInOut' as const },
  { at: LOAD_AT + 1400, parts: liftAt(lift, atStaging, 'x', true, pal), easing: 'easeInOut' as const },
  { at: LOAD_AT + 1600, parts: liftAt(lift, atStaging, 'x', true, pal) },
  { at: LOAD_AT + 3000, parts: liftAt(lift, atTrailer, 'x', true, pal), easing: 'easeInOut' as const },
  // Into the trailer: the pallet slides in and is gone.
  { at: LOAD_AT + 3600, parts: liftAt(lift, atTrailer, 'x', true, pal, 0, 0), easing: 'easeIn' as const },
  { at: LOAD_AT + 4100, parts: liftAt(lift, atTrailer, 'x', false), easing: 'easeInOut' as const },
  { at: LOAD_AT + 5300, parts: liftAt(lift, SHIPPER_LIFT_YARD, 'x', false), easing: 'easeInOut' as const },
]

export const LEAVE_AT = LOAD_AT + 4400
const pullOut = dock({ part: 'rig', door: doorCell, at: LEAVE_AT, duration: DOCKING, direction: 'out', lane: RIG_LANE })
/** Roll on a little, so the act hands the rig on already moving. */
export const RUN_END = roadAtDoor(doorCell) + 0.03
const rollOn = drive({ part: 'rig', from: roadAtDoor(doorCell), to: RUN_END, at: LEAVE_AT + DOCKING + 1, duration: 900, lane: RIG_LANE, easeStart: true })

/** The driver reports the pickup as the rig rolls; the carrier passes it on; the shipper acknowledges. */
const REPORT_AT = LEAVE_AT + 600
const ping = report('pickup', cabTop(dockedAt(doorCell), 'y'), nodeOf('carrier'), REPORT_AT)
const STATUS_AT = REPORT_AT + 900
const status = flight({ id: 'pickup', from: nodeOf('carrier'), to: nodeOf('shipper'), at: STATUS_AT, duration: HOP, label: '214', badge: 'pin' })
const ack = flight({ id: 'pickupAck', from: nodeOf('shipper'), to: nodeOf('carrier'), at: STATUS_AT + flightSpan(HOP) + ACK_DELAY, duration: ACK, badge: 'check', small: true })

export const act = defineAct({
  id: 'edi06Pickup',
  title: '214 — picked up',
  parts: [...ping.parts, ...status.parts, ...ack.parts],
  beats: [
    ...door('shipperDoor1', 0, true),
    ...loading,
    ...door('shipperDoor1', LOAD_AT + 4500, false),
    ...pullOut,
    ...rollOn,
    ...ping.beats,
    ...status.beats,
    ...ack.beats,
  ],
  focus: { at: look(dockedAt(doorCell), 1.5), width: 150 },
  tail: 200,
})

export const scene = act.scene
