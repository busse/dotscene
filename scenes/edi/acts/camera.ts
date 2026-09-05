/**
 * The camera script: every shot, on the hero's clock.
 *
 * The one rule is that the camera never stops. Even a "hold" is a slow push or a drift, so
 * the picture always has intent; the moves start and stop on eases, and the tracking shots
 * run linear between the road's corners on the rig's own clock, so the two never fight.
 *
 * Two altitudes matter here. The yards, docks and road are low in the frame; the masts and
 * the arcs the messages fly are high, up to sixty units above them. A shot about a message
 * is framed on the masts; a shot about freight is framed on a dock; and the moves between
 * them are the tilts that keep the camera alive.
 *
 * Framing is in scene units. Widths: 480 is the whole world, 260 a yard and its neighbour,
 * 150 one dock close enough to read a message's number.
 */

import type { Vec2 } from 'dotscene'
import { between, camera, look, type Shot } from './kit.ts'
import { along, cornersBetween, dockedAt, nodeOf, sites, WIDE } from '../world.ts'
import { LOOP, START } from '../timing.ts'
import { DRIVE_AT, DRIVE_MS, RUN_END as TO_SHIPPER, RUN_START as FROM_BAY } from './a05-dispatch.ts'
import { LEAVE_AT as PICKUP_LEAVE, RUN_END as PICKUP_END } from './a06-pickup.ts'
import { DRIVE_MS as TERMINAL_MS, STOP } from './a08-terminal.ts'
import { DRIVE_MS as DELIVERY_MS, RUN_END as AT_CONSIGNEE } from './a09-delivery.ts'
import { LEAVE_AT as DELIVERED_LEAVE } from './a10-delivered.ts'
import { PAYMENT_MS } from './a12-payment.ts'

/** Points of interest, in scene units. */
const shipperMast = nodeOf('shipper')
const officeMast = nodeOf('carrier')
const consigneeMast = nodeOf('consignee')
const bankMast = nodeOf('bank')
const shipperDock = look(dockedAt(sites.shipper.doors[1]!), 1.6)
const hubYard = look([sites.hub.cell[0] + 0.5, sites.hub.cell[1] + 3.6], 1.5)
const consigneeDock = look(dockedAt(sites.consignee.doors[0]!), 1.6)
const consigneeYard = look([sites.consignee.cell[0] + 1, sites.consignee.cell[1] + 3.4], 1.5)

const lift = (p: Vec2, dy: number): Vec2 => [p[0], p[1] + dy]

/**
 * A shot that holds two masts and the arc between them: centred between the masts and
 * raised a little, since the arc bows upward.
 */
const flightShot = (a: Vec2, b: Vec2, width: number, t = 0.5): Vec2 => lift(between(a, b, t), -18)

/**
 * Following the rig along a stretch of road, on the drive's own clock: a camera beat at every
 * corner the rig turns, so the two run on the same linear segments. The frame sits a little
 * above the rig, the way a tracking shot gives a vehicle room to drive into.
 */
const track = (from: number, to: number, at: number, duration: number, width: number, aim: Vec2 = [0, -18]): Shot[] => {
  const stops = [from, ...cornersBetween(from, to), to]
  const span = Math.abs(to - from) || 1
  return stops.map((t) => {
    const here = along(t)
    const p = look(here.cell, 1)
    return { at: at + (duration * Math.abs(t - from)) / span, to: [p[0] + aim[0], p[1] + aim[1]], width }
  })
}

/** Where along a drive the vehicle is at a given moment, so a shot can pick it up mid-run. */
const paramAt = (from: number, to: number, at: number, duration: number, time: number): number =>
  from + (to - from) * Math.min(1, Math.max(0, (time - at) / duration))

/** A tracking shot joined from wherever the camera was: the first corner is eased into. */
const trackFrom = (from: number, to: number, at: number, duration: number, width: number, joinAt: number): Shot[] => {
  const start = paramAt(from, to, at, duration, joinAt)
  const shots = track(start, to, joinAt, at + duration - joinAt, width)
  return shots.map((shot, i) => (i === 0 ? { ...shot, easing: 'easeInOut' as const } : shot))
}

const shots: Shot[] = [
  // Establishing, then a slow push toward the shipper: its mast above, its yard below.
  { at: 0, to: WIDE.at, width: WIDE.width },
  { at: START.tender + 300, to: between(shipperMast, shipperDock, 0.45), width: 250, easing: 'easeInOut' },

  // Tilt up and follow the tender across to the office; settle there as the ack comes back.
  { at: START.tender + 1500, to: flightShot(shipperMast, officeMast, 300, 0.4), width: 300, easing: 'easeInOut' },
  { at: START.ack + 100, to: lift(officeMast, 22), width: 250, easing: 'easeInOut' },

  // Pull out so the accept and its ack can be seen whole — and the rig leaving its bay below.
  { at: START.accept + 500, to: lift(between(shipperMast, officeMast, 0.55), 30), width: 370, easing: 'easeInOut' },
  { at: START.accept + 2600, to: lift(hubYard, -22), width: 300, easing: 'easeInOut' },

  // The bill of lading, and the rig setting off: wide enough for both.
  { at: START.bol + 700, to: lift(between(shipperMast, hubYard, 0.5), 10), width: 400, easing: 'easeInOut' },

  // Tracking shot: the rig home to the shipper, over the bridge, joined from the wide.
  ...trackFrom(FROM_BAY, TO_SHIPPER, START.dispatch + DRIVE_AT, DRIVE_MS, 230, START.dispatch + DRIVE_AT + 2200),

  // Close on the dock for the backing-in and the loading.
  { at: START.pickup + 500, to: shipperDock, width: 150, easing: 'easeInOut' },
  { at: START.pickup + PICKUP_LEAVE - 300, to: lift(shipperDock, -5), width: 138, easing: 'easeInOut' },

  // Ease back as the rig pulls out, up to the mast for the pickup status, then open wide.
  { at: START.asn - 400, to: between(shipperDock, shipperMast, 0.55), width: 280, easing: 'easeInOut' },
  { at: START.asn + 900, to: flightShot(shipperMast, consigneeMast, 430, 0.3), width: 430, easing: 'easeInOut' },
  { at: START.asn + 3200, to: flightShot(shipperMast, consigneeMast, 400, 0.72), width: 400, easing: 'easeInOut' },

  // The consignee gets ready: door up, forklift out.
  { at: START.asn + 4400, to: lift(consigneeYard, -16), width: 250, easing: 'easeInOut' },

  // Whip back to the rig on its climb to the crossdock, and hold on the check-in.
  ...trackFrom(PICKUP_END, STOP, START.terminal, TERMINAL_MS, 250, START.asn + 6100),
  { at: START.terminal + TERMINAL_MS + 700, to: lift(between(hubYard, officeMast, 0.55), -6), width: 320, easing: 'easeInOut' },

  // Out for delivery: track the last leg.
  ...trackFrom(STOP, AT_CONSIGNEE, START.out, DELIVERY_MS, 235, START.out + 900),

  // Close on the consignee's dock: the unloading, the signature.
  { at: START.delivered + 900, to: consigneeDock, width: 160, easing: 'easeInOut' },
  { at: START.delivered + 6200, to: lift(consigneeDock, -6), width: 148, easing: 'easeInOut' },

  // Pull out and tilt up as the rig leaves and the word goes out three ways.
  { at: START.delivered + DELIVERED_LEAVE + 1800, to: lift(between(consigneeMast, officeMast, 0.45), -4), width: 340, easing: 'easeInOut' },

  // The invoice to the bank, then the coins back to the office.
  { at: START.invoice + 2300, to: lift(between(officeMast, bankMast, 0.6), 12), width: 320, easing: 'easeInOut' },
  { at: START.payment + 1500, to: lift(officeMast, 18), width: 240, easing: 'easeInOut' },

  // And home: the establishing shot, so the loop lands where it began.
  { at: START.payment + PAYMENT_MS - 600, to: between(lift(officeMast, 40), WIDE.at, 0.5), width: 360, easing: 'easeInOut' },
  { at: LOOP, to: WIDE.at, width: WIDE.width, easing: 'easeInOut' },
]

export const cameraScript = { name: 'camera', beats: camera(shots) }
