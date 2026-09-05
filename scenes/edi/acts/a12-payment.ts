/**
 * 820 — payment order and remittance advice
 *
 * Money moves — a run of coins from the bank to the carrier — and the shipper is told what
 * it all cost. The file closes.
 */

import { defineAct } from './act.ts'
import { between, flight, flightSpan, type Beat } from './kit.ts'
import { coin, pulseRing } from '../figures/tokens.ts'
import { HOP } from '../timing.ts'
import { nodeOf, SKY } from '../world.ts'
import { easings, type Part, type Vec2 } from 'dotscene'

const from = nodeOf('bank')
const to = nodeOf('carrier')
const HOVER = 7

/** Four coins on the same arc, a third of a second apart, each spinning as it goes. */
const COINS = 4
const GAP = 320
const FLY = 1500

const arc = (t: number): Vec2 => {
  const a: Vec2 = [from[0], from[1] - HOVER]
  const b: Vec2 = [to[0], to[1] - HOVER]
  const lift = Math.min(48, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.22)
  const c: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - lift]
  const inv = 1 - t
  return [
    Math.round((inv * inv * a[0] + 2 * inv * t * c[0] + t * t * b[0]) * 100) / 100,
    Math.round((inv * inv * a[1] + 2 * inv * t * c[1] + t * t * b[1]) * 100) / 100,
  ]
}

const parts: Part[] = []
const beats: Beat[] = []
for (let i = 0; i < COINS; i++) {
  const id = `coin${i}`
  parts.push({ id, figure: coin, at: arc(0), depth: SKY + 10, opacity: 0, scale: 0.9 })
  const start = i * GAP
  beats.push({ at: start, parts: { [id]: { at: from, opacity: 0, scale: 0.4 } } })
  beats.push({ at: start + 220, parts: { [id]: { at: arc(0), opacity: 1, scale: 0.9 } }, easing: 'easeOut' })
  const steps = 8
  for (let s = 1; s <= steps; s++) {
    const t = easings.easeInOut(s / steps)
    // A coin turning over as it flies: its width breathes between full and edge-on.
    const spin = 0.9 * (0.35 + 0.65 * Math.abs(Math.cos((s / steps) * Math.PI * 2)))
    beats.push({ at: start + 220 + (FLY * s) / steps, parts: { [id]: { at: arc(t), opacity: 1, scale: [Math.round(spin * 100) / 100, 0.9] } } })
  }
  beats.push({ at: start + 220 + FLY + 200, parts: { [id]: { at: to, opacity: 0, scale: 0.3 } }, easing: 'easeIn' })
}

/** Each coin landing rings the carrier's mast. */
for (let i = 0; i < COINS; i++) {
  const id = `coinPulse${i}`
  parts.push({ id, figure: pulseRing, at: to, depth: SKY + 8, opacity: 0, scale: 0.3 })
  const landed = i * GAP + 220 + FLY
  beats.push({ at: landed, parts: { [id]: { at: to, scale: 0.3, opacity: 0.9 } } })
  beats.push({ at: landed + 500, parts: { [id]: { at: to, scale: 3, opacity: 0 } }, easing: 'easeOut' })
}

const REMIT_AT = (COINS - 1) * GAP + 220 + FLY + 500
const remit = flight({ id: 'remit', from: nodeOf('carrier'), to: nodeOf('shipper'), at: REMIT_AT, duration: HOP, label: '820', badge: 'coin' })

export const PAYMENT_MS = REMIT_AT + flightSpan(HOP)

export const act = defineAct({
  id: 'edi12Payment',
  title: '820 — payment and remittance',
  parts: [...parts, ...remit.parts],
  beats: [...beats, ...remit.beats],
  focus: { at: between(nodeOf('bank'), nodeOf('carrier')), width: 320 },
  tail: 300,
})

export const scene = act.scene
