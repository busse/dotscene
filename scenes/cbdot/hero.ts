/**
 * The EDI meadow as the background of the site's intro block.
 *
 * The same scene as `ediHeroMeadow`, told to cover its box rather than letterbox in it, so
 * it fills the space between the masthead's rule and the one under the buttons at any
 * viewport. The page lays a paper wash over the left of it, where the copy sits, so the
 * drawing is fully itself on the right and a faint underlay under the words — the way the
 * site's non-photo-blue structure sits under its ink.
 */

import { defineScene } from 'dotscene'
import { cast, composed } from '../edi/hero.ts'
import { ASPECT, meadowParts, WIDE } from '../edi/world.ts'
import { meadow, meadowNight, themedCss, GROUND_MEADOW } from '../edi/palette.ts'
import { DOT_RADIUS, LINE_WIDTH } from '../edi/stage.ts'

export const scene = defineScene('artHero', {
  title: 'Freight moves. Data moves first.',
  parts: [...meadowParts, ...cast],
  camera: { ...WIDE, aspect: ASPECT },
  fit: 'slice',
  dotRadius: DOT_RADIUS,
  lineWidth: LINE_WIDTH,
  background: GROUND_MEADOW,
  css: themedCss(meadow, meadowNight),
  animate: { mode: 'loop', keyframes: composed.keyframes, sizing: 'screen', easing: 'linear' },
})
