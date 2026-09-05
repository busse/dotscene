/**
 * Prologue — the goods are ready
 *
 * Before any message moves, the shipper's forklift carries a pallet across the yard and
 * sets it down by the dock. Freight exists first; everything after is about telling people
 * where it is.
 */

import { defineAct } from './act.ts'
import { liftAt, liftCellFor, look, palletAt, type Beat } from './kit.ts'
import { SHIPPER_LIFT_WEST, SHIPPER_LIFT_YARD, SHIPPER_STAGING, sites } from '../world.ts'

const lift = 'shipperLift'
const pal = 'pallet'
const atStaging = liftCellFor(SHIPPER_STAGING, 'x')

const beats: Beat[] = [
  { at: 0, parts: liftAt(lift, SHIPPER_LIFT_WEST, 'x', true, pal) },
  { at: 500, parts: liftAt(lift, SHIPPER_LIFT_WEST, 'x', true, pal) },
  { at: 2300, parts: liftAt(lift, atStaging, 'x', true, pal), easing: 'easeInOut' },
  { at: 2800, parts: liftAt(lift, atStaging, 'x', false, pal), easing: 'easeInOut' },
  { at: 2801, parts: palletAt(pal, SHIPPER_STAGING) },
  { at: 3000, parts: liftAt(lift, atStaging, 'x', false) },
  { at: 4000, parts: liftAt(lift, SHIPPER_LIFT_YARD, 'x', false), easing: 'easeInOut' },
]

export const act = defineAct({
  id: 'edi00Prologue',
  title: 'The goods are ready',
  beats,
  focus: { at: look(sites.shipper.cell, 1), width: 220 },
})

export const scene = act.scene
