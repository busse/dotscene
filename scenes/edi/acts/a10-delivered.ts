/**
 * 214 — delivered, with proof
 *
 * The rig backs onto the consignee's dock. The forklift lifts the pallet out and sets it
 * down in the yard; the receiver walks up to the cab and signs for it. The driver reports,
 * and three parties are told — because this is the message the invoice will be argued
 * about against. Then the rig carries on out of the frame.
 */

import { defineAct } from './act.ts'
import { cabTop, dock, drive, flight, flightSpan, liftAt, look, report, roadAtDoor, stand, walk } from './kit.ts'
import { ACK, ACK_DELAY, DOCKING, HOP } from '../timing.ts'
import { CONSIGNEE_DROP, CONSIGNEE_LIFT_REST, CONSIGNEE_WAIT, dockedAt, loadingSpotEast, nodeOf, RECEIVER_HOME, RIG_LANE, sites } from '../world.ts'
import { RUN_END as ARRIVE } from './a09-delivery.ts'

const lift = 'consigneeLift'
const pal = 'pallet'
const doorCell = sites.consignee.doors[0]!
const bay = dockedAt(doorCell)
const atTrailer = loadingSpotEast(doorCell)

const backIn = dock({ part: 'rig', door: doorCell, at: 0, duration: DOCKING, direction: 'in', lane: RIG_LANE })

/** Unloading: reach into the trailer, the pallet appears on the forks, carry it east, set it down. */
const UNLOAD_AT = DOCKING + 500
const dropLift: readonly [number, number] = [CONSIGNEE_DROP[0] + 0.9, CONSIGNEE_DROP[1]]
const unloading = [
  { at: UNLOAD_AT, parts: liftAt(lift, CONSIGNEE_WAIT, 'xr', false) },
  { at: UNLOAD_AT + 500, parts: liftAt(lift, atTrailer, 'xr', true), easing: 'easeInOut' as const },
  { at: UNLOAD_AT + 900, parts: liftAt(lift, atTrailer, 'xr', true, pal, 0, 0) },
  { at: UNLOAD_AT + 1400, parts: liftAt(lift, atTrailer, 'xr', true, pal), easing: 'easeOut' as const },
  { at: UNLOAD_AT + 2800, parts: liftAt(lift, dropLift, 'xr', true, pal), easing: 'easeInOut' as const },
  { at: UNLOAD_AT + 3300, parts: liftAt(lift, dropLift, 'xr', false, pal), easing: 'easeInOut' as const },
  { at: UNLOAD_AT + 3301, parts: { pallet: { at: liftAt(lift, dropLift, 'xr', false, pal).pallet!.at, depth: liftAt(lift, dropLift, 'xr', false, pal).pallet!.depth, opacity: 1 } } },
  { at: UNLOAD_AT + 3500, parts: liftAt(lift, dropLift, 'xr', false) },
  { at: UNLOAD_AT + 4400, parts: liftAt(lift, CONSIGNEE_LIFT_REST, 'xr', false), easing: 'easeInOut' as const },
]

/** The receiver walks to the cab, hands over the paperwork, and walks back. */
const SIGN_AT = DOCKING + 300
const cabSide: readonly [number, number] = [bay[0] - 1.0, bay[1] + 1.5]
const signing = [
  ...walk('receiver', RECEIVER_HOME, cabSide, SIGN_AT, 1400),
  { at: SIGN_AT + 1800, parts: stand('receiver', cabSide, 'offerR') },
  { at: SIGN_AT + 3000, parts: stand('receiver', cabSide, 'offerR') },
  { at: SIGN_AT + 3400, parts: stand('receiver', cabSide, 'idle') },
  ...walk('receiver', cabSide, RECEIVER_HOME, SIGN_AT + 3800, 1400),
  { at: SIGN_AT + 5600, parts: stand('receiver', RECEIVER_HOME, 'wave') },
  { at: SIGN_AT + 6400, parts: stand('receiver', RECEIVER_HOME, 'idle') },
]

/** Signed for: the report, then the word goes out three ways, and the shipper acknowledges. */
const REPORT_AT = SIGN_AT + 3200
const ping = report('delivered', cabTop(bay, 'y'), nodeOf('carrier'), REPORT_AT)
const STATUS_AT = REPORT_AT + 900
const toShipper = flight({ id: 'delivered', from: nodeOf('carrier'), to: nodeOf('shipper'), at: STATUS_AT, duration: HOP, label: '214', badge: 'pin' })
const toConsignee = flight({ id: 'deliveredC', from: nodeOf('carrier'), to: nodeOf('consignee'), at: STATUS_AT + 250, duration: HOP, label: '214', badge: 'pin' })
const toBroker = flight({ id: 'deliveredB', from: nodeOf('carrier'), to: nodeOf('broker'), at: STATUS_AT + 500, duration: HOP, label: '214', badge: 'pin' })
const ack = flight({ id: 'deliveredAck', from: nodeOf('shipper'), to: nodeOf('carrier'), at: STATUS_AT + flightSpan(HOP) + ACK_DELAY, duration: ACK, badge: 'check', small: true })

/** And away: off the dock, along the road, and out of the frame. */
export const LEAVE_AT = UNLOAD_AT + 4200
const pullOut = dock({ part: 'rig', door: doorCell, at: LEAVE_AT, duration: DOCKING, direction: 'out', lane: RIG_LANE })
const away = drive({ part: 'rig', from: ARRIVE, to: 1, at: LEAVE_AT + DOCKING + 1, duration: 3200, lane: RIG_LANE, easeStart: true })

export const act = defineAct({
  id: 'edi10Delivered',
  title: '214 — delivered, with proof',
  parts: [...ping.parts, ...toShipper.parts, ...toConsignee.parts, ...toBroker.parts, ...ack.parts],
  beats: [
    ...backIn,
    ...unloading,
    ...signing,
    ...ping.beats,
    ...toShipper.beats,
    ...toConsignee.beats,
    ...toBroker.beats,
    ...ack.beats,
    ...pullOut,
    ...away,
  ],
  focus: { at: look(bay, 1.5), width: 160 },
  tail: 200,
})

export const scene = act.scene
