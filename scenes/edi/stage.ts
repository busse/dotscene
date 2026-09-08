/**
 * The stage: everything that is there before anything moves, framed by the wide shot.
 *
 * Built and previewed on its own so the layout can be judged as a still — where the river
 * runs, whether the office tower clears the top of the frame, how much yard a dock has.
 */

import { defineScene } from 'dotscene'
import { ASPECT, RIPPLE_CELLS, WIDE, cast, stageParts } from './world.ts'
import { css, night, paper, GROUND_NIGHT, GROUND_PAPER } from './palette.ts'
import { EDI_VERSION } from './version.ts'

export const DOT_RADIUS = 0.62
export const LINE_WIDTH = 0.34

const layout = {
  version: EDI_VERSION,
  parts: [
    ...stageParts,
    ...RIPPLE_CELLS.map((cell, i) => cast.ripples(i, cell)),
    cast.rig(),
    cast.shipperLift(),
    cast.hubLift(),
    cast.consigneeLift(),
    cast.pallet(),
    cast.worker(),
    cast.receiver(),
    cast.cloudA(),
    cast.cloudB(),
  ],
  camera: { ...WIDE, aspect: ASPECT },
  dotRadius: DOT_RADIUS,
  lineWidth: LINE_WIDTH,
} as const

export const scene = defineScene('ediStage', {
  title: 'A carrier network, before anything moves',
  ...layout,
  background: GROUND_PAPER,
  css: css(paper),
})

export const stageNight = defineScene('ediStageNight', {
  title: 'A carrier network, before anything moves — dark',
  ...layout,
  background: GROUND_NIGHT,
  css: css(night),
})
