/**
 * An act: a titled bundle of parts and beats that plays on its own clock.
 *
 * Each act is also its own scene, so a step of the lifecycle can be previewed and built
 * without the other eleven — which is the whole reason for the file-per-act layout.
 */

import { compose, defineScene, type Act, type Beat, type Part, type Scene, type Vec2 } from 'dotscene'
import { ASPECT, WIDE, cast, RIPPLE_CELLS, stageParts } from '../world.ts'
import { css, paper, GROUND_PAPER } from '../palette.ts'
import { DOT_RADIUS, LINE_WIDTH } from '../stage.ts'

export interface EdiAct {
  readonly id: string
  readonly title: string
  readonly act: Act
  /** Parts this act brings, on top of the stage and the standing cast. */
  readonly parts: readonly Part[]
  readonly duration: number
  readonly scene: Scene
}

/** The standing cast: everything that moves and is always there. */
export const standingCast = (): Part[] => [
  ...RIPPLE_CELLS.map((cell, i) => cast.ripples(i, cell)),
  cast.rig(),
  cast.van(),
  cast.shipperLift(),
  cast.hubLift(),
  cast.consigneeLift(),
  cast.pallet(),
  cast.worker(),
  cast.receiver(),
  cast.birds(),
  cast.cloudA(),
  cast.cloudB(),
  cast.smoke(0),
  cast.smoke(1),
  cast.smoke(2),
]

export const defineAct = (spec: {
  readonly id: string
  readonly title: string
  readonly parts?: readonly Part[]
  readonly beats: readonly Beat[]
  /** Where the standalone scene looks, and how wide. Defaults to the establishing shot. */
  readonly focus?: { readonly at: Vec2; readonly width: number }
  /** A pause after the last beat, before whatever the hero places next. */
  readonly tail?: number
}): EdiAct => {
  const parts = spec.parts ?? []
  const beats = [...spec.beats].sort((a, b) => a.at - b.at)
  const act: Act = { name: spec.id, beats }
  const duration = Math.max(0, ...beats.map((b) => b.at)) + (spec.tail ?? 0)

  const players = [...stageParts, ...standingCast(), ...parts]
  const { keyframes } = compose([{ act, at: 0 }], { parts: players, maxStep: 120 })
  const camera = spec.focus ?? WIDE

  const scene = defineScene(spec.id, {
    title: spec.title,
    parts: players,
    camera: { ...camera, aspect: ASPECT },
    dotRadius: DOT_RADIUS,
    lineWidth: LINE_WIDTH,
    background: GROUND_PAPER,
    css: css(paper),
    animate: { mode: 'loop', keyframes, sizing: 'screen', easing: 'linear' },
  })

  return { id: spec.id, title: spec.title, act, parts, duration, scene }
}
