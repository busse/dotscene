/**
 * The fax-to-email bridge.
 *
 * It prints a page every couple of seconds and flings it into the sea, where it sinks with
 * a small splash. The keeper strings a wire from the fax to the lighthouse, and the next page
 * rises up the wire as an envelope and lands at the lamp — the bridge, finally bridging.
 */

import { easings, type Beat, type Part, type PartKeyframe, type Vec2 } from 'dotscene'
import { defineAct, holdAt, stateBefore } from './act.ts'
import { flight, SKY, slackWire, standAt, stringWire, walk, walkTime, vec, wire } from './kit.ts'
import { sheet } from '../figures/fixtures.ts'
import { splash } from '../figures/traffic.ts'
import { FAX, LAMP, WORK } from '../world.ts'
import { FIXED, START } from '../timing.ts'

const K = 'keeper'
const F = 'fax'
const SHEETS = ['sheet0', 'sheet1', 'sheet2']
const SPLASHES = ['splash0', 'splash1', 'splash2']

const parts: Part[] = [
  ...SHEETS.map((id) => ({ id, figure: sheet, at: FAX.slot, opacity: 0, depth: SKY + 5, scale: 0.6 })),
  ...SPLASHES.map((id) => ({ id, figure: splash, at: FAX.splash, opacity: 0, depth: SKY + 4, scale: 0.4 })),
  { id: 'faxWire', figure: wire, at: FAX.slot, pose: 'slack', opacity: 0, depth: SKY - 1 },
]

/** A page arcs up out of the slot, over, and down into the water. */
const toss = (page: string, splashId: string, at: number): Beat[] => {
  const from = FAX.slot
  const to = FAX.splash
  const lift = 26
  const control: Vec2 = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - lift]
  const arc = (t: number): Vec2 => {
    const inv = 1 - t
    return vec([inv * inv * from[0] + 2 * inv * t * control[0] + t * t * to[0], inv * inv * from[1] + 2 * inv * t * control[1] + t * t * to[1]])
  }
  const beats: Beat[] = [
    { at, parts: { [page]: { at: from, opacity: 0, scale: 0.4 } } },
    { at: at + 200, parts: { [page]: { at: arc(0.08), opacity: 1, scale: 0.6 } }, easing: 'easeOut' },
  ]
  const steps = 6
  for (let i = 2; i <= steps; i++) {
    const t = easings.easeIn(i / steps)
    beats.push({ at: at + 200 + Math.round((1100 * (i - 1)) / (steps - 1)), parts: { [page]: { at: arc(t), opacity: i === steps ? 0 : 1, scale: 0.6 } } })
  }
  const hit = at + 1300
  beats.push({ at: hit, parts: { [splashId]: { at: to, opacity: 0.9, scale: 0.4 } } })
  beats.push({ at: hit + 520, parts: { [splashId]: { at: to, opacity: 0, scale: 1.8 } }, easing: 'easeOut' })
  return beats
}

const beats: Beat[] = []
const faxAt = (pose: string): PartKeyframe => ({ pose })

// Sending pages into the sea, from dawn until the wire is up.
let n = 0
for (let t = 600; t < FIXED.fax - 1800; t += 2300, n++) {
  beats.push({ at: t - 350, parts: { [F]: faxAt('sending') }, easing: 'easeOut' })
  beats.push({ at: t + 250, parts: { [F]: faxAt('rest') }, easing: 'easeIn' })
  beats.push(...toss(SHEETS[n % 3]!, SPLASHES[n % 3]!, t))
}

// The keeper arrives, and strings the wire up to the lamp.
beats.push({ at: START.fax + 2400, parts: standAt(K, WORK.fax, 'idle') })
beats.push({ at: START.fax + 2800, parts: standAt(K, WORK.fax, 'offerR') })
beats.push(...stringWire('faxWire', FAX.slot, LAMP.at, START.fax + 2800, FIXED.fax - (START.fax + 2800)))
beats.push({ at: FIXED.fax + 200, parts: standAt(K, WORK.fax, 'idle') })

// The next page goes up the wire as an envelope, and lands at the lamp.
const up = flight({ id: 'faxMail', from: FAX.slot, to: LAMP.at, at: FIXED.fax + 500, duration: 1800, badge: 'doc', lift: 6 })
parts.push(...up.parts)
beats.push({ at: FIXED.fax + 200, parts: { [F]: faxAt('sending') }, easing: 'easeOut' })
beats.push({ at: FIXED.fax + 900, parts: { [F]: faxAt('rest') }, easing: 'easeIn' })
beats.push(...up.beats)

// A second one for good measure, then the keeper walks on.
const again = flight({ id: 'faxMailB', from: FAX.slot, to: LAMP.at, at: FIXED.fax + 3600, duration: 1800, badge: 'doc', lift: 6 })
parts.push(...again.parts)
beats.push(...again.beats)
beats.push(...walk(K, WORK.fax, WORK.cron, FIXED.fax + 1300, Math.max(walkTime(WORK.fax, WORK.cron), START.cron + 2400 - (FIXED.fax + 1300))))

// Slack again under cover of night, for the next dawn.
beats.push({ at: holdAt(START.reset), parts: { faxWire: stateBefore(beats, 'faxWire', holdAt(START.reset)) } })
beats.push(...slackWire('faxWire', FAX.slot, START.reset + 40))

export const act = defineAct('islandFax', 'The fax-to-email bridge', beats, parts)
