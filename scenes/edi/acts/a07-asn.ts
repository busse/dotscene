/**
 * 856 — advance ship notice
 *
 * The one message that skips the carrier entirely: the shipper tells the consignee what is
 * coming, all the way across the frame, while the freight is still on the road. And it is
 * why the consignee is ready — the door goes up and the forklift comes out to wait.
 */

import { defineAct } from './act.ts'
import { between, door, flight, flightSpan, liftAt, type Beat } from './kit.ts'
import { LONG_HOP } from '../timing.ts'
import { CONSIGNEE_LIFT_HOME, CONSIGNEE_WAIT, depthOf, nodeOf, sites } from '../world.ts'

const asn = flight({ id: 'asn', from: nodeOf('shipper'), to: nodeOf('consignee'), at: 0, duration: LONG_HOP, label: '856', badge: 'box', lift: 60 })

const LANDED = flightSpan(LONG_HOP)
const lift = 'consigneeLift'
const doorCell = sites.consignee.doors[1]!
const inside = depthOf(CONSIGNEE_LIFT_HOME)
const through = depthOf(doorCell) + 0.3
const outside: readonly [number, number] = [doorCell[0], doorCell[1] + 1.6]

const withDepth = (states: Record<string, { depth?: number }>, depth: number) =>
  Object.fromEntries(Object.entries(states).map(([id, s]) => [id, { ...s, depth }]))

/** The consignee's forklift rolls out of its door and takes up position east of the rig's bay. */
const emerge: Beat[] = [
  { at: LANDED + 300, parts: withDepth(liftAt(lift, CONSIGNEE_LIFT_HOME, 'y', false), inside) },
  { at: LANDED + 700, parts: withDepth(liftAt(lift, [doorCell[0], doorCell[1] - 0.6], 'y', false), inside), easing: 'easeIn' },
  { at: LANDED + 701, parts: withDepth(liftAt(lift, [doorCell[0], doorCell[1] - 0.6], 'y', false), through) },
  { at: LANDED + 1700, parts: liftAt(lift, outside, 'y', false) },
  { at: LANDED + 2500, parts: liftAt(lift, CONSIGNEE_WAIT, 'y', false), easing: 'easeOut' },
  { at: LANDED + 2501, parts: liftAt(lift, CONSIGNEE_WAIT, 'xr', false) },
]

export const act = defineAct({
  id: 'edi07Asn',
  title: '856 — advance ship notice',
  parts: asn.parts,
  beats: [...asn.beats, ...door('consigneeDoor1', LANDED + 100, true), ...emerge],
  focus: { at: between(nodeOf('shipper'), nodeOf('consignee')), width: 440 },
  tail: 200,
})

export const scene = act.scene
