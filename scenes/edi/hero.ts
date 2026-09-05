/**
 * The arrangement: which acts play, and when.
 *
 * Nothing here says what an act *looks* like — that is the act's own file. This decides only
 * the running order and the overlap, which is the whole reason acts keep their own clocks.
 * Drop an act, retime one, or slide the paperwork later against the freight, and everything
 * else is untouched.
 *
 * The rig is the spine. Its acts run back to back and their start times are computed rather
 * than written down, because a gap would show as the rig sliding along with its wheels still
 * and an overlap is rejected outright by the compositor. Everything else hangs off that.
 */

import { compose, defineScene, loopGaps, type Act } from 'dotscene'
import { acts } from './acts/index.ts'
import { along } from './route.ts'
import { HERO_VIEWBOX } from './projection.ts'
import { css, night, paper, themedCss, GROUND_NIGHT, GROUND_PAPER } from './palette.ts'
import { rigPart, stageParts } from './stage.ts'

/** When the first rig leaves. The paperwork before it has to fit in here. */
const RIG_START = 3600

const driving = acts.filter((a) => a.drive !== undefined)

const rigSchedule = (() => {
  const at = new Map<string, number>()
  let cursor = RIG_START
  for (const act of driving) {
    at.set(act.id, cursor)
    cursor += act.duration
  }
  return { at, ends: cursor }
})()

/**
 * When each message act starts.
 *
 * Read against the rig's schedule above: the tender and its answer land before anything
 * moves, the advance ship notice goes out mid-linehaul, and the invoice chases the delivery
 * rather than waiting politely for it.
 */
const MESSAGES: Readonly<Record<string, number>> = {
  edi01Tender: 0,
  edi02Ack: 1600,
  edi03Accept: 2400,
  edi04Bol: 4200,
  edi07Asn: 12000,
  edi11Invoice: 30500,
  edi12Payment: 34200,
}

/** A beat of empty street before the loop cuts, so the repeat is not felt as a jolt. */
const TAIL = 1800

const home = along(0)
const settle: Act = {
  name: 'settle',
  beats: [
    {
      at: Math.max(...Object.entries(MESSAGES).map(([id, at]) => at + acts.find((a) => a.id === id)!.duration), rigSchedule.ends) + TAIL,
      parts: { rig: { at: home.at, depth: home.depth, pose: home.axis } },
    },
  ],
}

export const placements = [
  ...acts.map((act) => ({
    act: act.act,
    at: rigSchedule.at.get(act.id) ?? MESSAGES[act.id] ?? 0,
  })),
  { act: settle, at: 0 },
]

const cast = [...stageParts, rigPart(0), ...acts.flatMap((a) => a.parts)]

export const composed = compose(placements, { parts: cast, maxStep: 200 })

/** Anything not ending where it started would jump when the loop cuts. Should be empty. */
export const seam = loopGaps(composed)

const layout = {
  parts: cast,
  viewBox: HERO_VIEWBOX,
  dotRadius: 0.95,
  lineWidth: 0.45,
  animate: { mode: 'loop', keyframes: composed.keyframes },
} as const

/**
 * The one to embed. Carries both palettes, so a page with a theme toggle needs one copy of
 * a payload that is mostly geometry rather than two.
 */
export const scene = defineScene('ediHero', {
  title: 'An EDI lifecycle, end to end',
  ...layout,
  background: GROUND_PAPER,
  css: themedCss(paper, night),
})

/** Fixed dark, for a standalone file or an `<img>` — neither can be reached by page CSS. */
export const heroNight = defineScene('ediHeroNight', {
  title: 'An EDI lifecycle, end to end — dark',
  ...layout,
  background: GROUND_NIGHT,
  css: css(night),
})
