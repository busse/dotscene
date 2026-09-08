/**
 * The arrangement: which acts play, and when.
 *
 * Nothing here says what an act *looks* like — that is the act's own file — and nothing
 * here says where the camera looks — that is the camera script. This decides only the
 * running order and the overlap, which is the whole reason acts keep their own clocks.
 * Slide an act in `timing.ts` and everything else is untouched.
 */

import { compose, defineScene, loopGaps } from 'dotscene'
import { acts } from './acts/index.ts'
import { ambient } from './acts/ambient.ts'
import { cameraScript } from './acts/camera.ts'
import { reset } from './acts/reset.ts'
import { standingCast } from './acts/act.ts'
import { ASPECT, stageParts, WIDE } from './world.ts'
import { LOOP, START } from './timing.ts'
import { css, night, paper, themedCss, GROUND_NIGHT, GROUND_PAPER } from './palette.ts'
import { DOT_RADIUS, LINE_WIDTH } from './stage.ts'
import { EDI_VERSION } from './version.ts'

const startOf: Readonly<Record<string, number>> = {
  edi00Prologue: START.prologue,
  edi01Tender: START.tender,
  edi02Ack: START.ack,
  edi03Accept: START.accept,
  edi04Bol: START.bol,
  edi05Dispatch: START.dispatch,
  edi06Pickup: START.pickup,
  edi07Asn: START.asn,
  edi08Terminal: START.terminal,
  edi09Delivery: START.out,
  edi10Delivered: START.delivered,
  edi11Invoice: START.invoice,
  edi12Payment: START.payment,
}

/** A beat of stillness at the very end, so the loop's cut lands on a settled frame. */
const settle = { name: 'settle', beats: [{ at: LOOP, parts: {} }] }

export const placements = [
  ...acts.map((act) => ({ act: act.act, at: startOf[act.id] ?? 0 })),
  { act: ambient, at: 0 },
  { act: cameraScript, at: 0 },
  { act: reset, at: START.reset },
  { act: settle, at: 0 },
]

export const cast = [...stageParts, ...standingCast(), ...acts.flatMap((a) => a.parts)]

export const composed = compose(placements, { parts: cast, maxStep: 120 })

/** Anything not ending where it started would jump when the loop cuts. Should be empty. */
export const seam = loopGaps(composed, cast)

const layout = {
  version: EDI_VERSION,
  parts: cast,
  camera: { ...WIDE, aspect: ASPECT },
  dotRadius: DOT_RADIUS,
  lineWidth: LINE_WIDTH,
  animate: { mode: 'loop', keyframes: composed.keyframes, sizing: 'screen', easing: 'linear' },
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
