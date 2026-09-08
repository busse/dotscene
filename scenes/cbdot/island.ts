/**
 * The Island of Misfit Applications as the background of the site's intro block.
 *
 * The same scene as `islandHero`, told to cover its box rather than letterbox in it. The
 * island sits in the right half of the frame on purpose: the page lays its paper wash over
 * the left, where the copy is, and the drawing is fully itself where nothing has to be read.
 */

import { defineScene } from 'dotscene'
import { composed, DOT_RADIUS, LINE_WIDTH, players } from '../island/hero.ts'
import { ASPECT, WIDE } from '../island/world.ts'
import { dark, day, themedCss } from '../island/palette.ts'

export const scene = defineScene('artIsland', {
  title: 'The Island of Misfit Applications',
  parts: players,
  camera: { ...WIDE, aspect: ASPECT },
  fit: 'slice',
  dotRadius: DOT_RADIUS,
  lineWidth: LINE_WIDTH,
  background: day.bg,
  css: themedCss(day, dark),
  animate: { mode: 'loop', keyframes: composed.keyframes, sizing: 'screen', easing: 'linear' },
})
