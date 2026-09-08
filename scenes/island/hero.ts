/**
 * The Island of Misfit Applications, as a looping hero background.
 *
 * The arrangement: every act is placed at zero and speaks in the day's own times, plus the
 * ambient life, the camera and the reset. `seam` must stay empty.
 */

import { compose, defineScene, loopGaps } from 'dotscene'
import { act as dawn } from './acts/a00-dawn.ts'
import { act as mainframeAct } from './acts/a01-mainframe.ts'
import { act as spreadsheetAct } from './acts/a02-spreadsheet.ts'
import { act as faxAct } from './acts/a03-fax.ts'
import { act as cronAct } from './acts/a04-cron.ts'
import { act as chatbotAct } from './acts/a05-chatbot.ts'
import { act as dusk } from './acts/a06-dusk.ts'
import { act as landing } from './acts/a07-landing.ts'
import { act as boatAct } from './acts/a08-boat.ts'
import { act as reset } from './acts/reset.ts'
import { ambient } from './acts/ambient.ts'
import { cameraScript } from './acts/camera.ts'
import { nightBeats } from './acts/kit.ts'
import { ASPECT, cast, stageParts, WIDE } from './world.ts'
import { LOOP } from './timing.ts'
import { css, dark, day, themedCss } from './palette.ts'
import { ISLAND_VERSION } from './version.ts'

export const acts = [dawn, mainframeAct, spreadsheetAct, faxAct, cronAct, chatbotAct, dusk, landing, boatAct, reset] as const

const night = { name: 'islandNight', beats: nightBeats('nightfall', LOOP) }
const settle = { name: 'islandSettle', beats: [{ at: LOOP, parts: {} }] }

export const placements = [
  ...acts.map((a) => ({ act: a.act, at: 0 })),
  { act: ambient, at: 0 },
  { act: night, at: 0 },
  { act: cameraScript, at: 0 },
  { act: settle, at: 0 },
]

export const players = [...stageParts, ...cast(), ...acts.flatMap((a) => a.parts)]

export const composed = compose(placements, { parts: players })

/** Anything not ending where it started would jump when the loop cuts. Should be empty. */
export const seam = loopGaps(composed, players)

export const DOT_RADIUS = 0.62
export const LINE_WIDTH = 0.34

const layout = {
  version: ISLAND_VERSION,
  parts: players,
  camera: { ...WIDE, aspect: ASPECT },
  dotRadius: DOT_RADIUS,
  lineWidth: LINE_WIDTH,
  animate: { mode: 'loop', keyframes: composed.keyframes, sizing: 'screen', easing: 'linear' },
} as const

export const scene = defineScene('islandHero', {
  title: 'The Island of Misfit Applications',
  ...layout,
  background: day.bg,
  css: themedCss(day, dark),
})

export const heroNight = defineScene('islandHeroNight', {
  title: 'The Island of Misfit Applications — dark',
  ...layout,
  background: dark.bg,
  css: css(dark),
})

/** The stage, still, for judging the layout on its own. */
export const stage = defineScene('islandStage', {
  title: 'The island, before the day begins',
  version: ISLAND_VERSION,
  parts: [...stageParts, ...cast()],
  camera: { ...WIDE, aspect: ASPECT },
  dotRadius: DOT_RADIUS,
  lineWidth: LINE_WIDTH,
  background: day.bg,
  css: css(day),
})
