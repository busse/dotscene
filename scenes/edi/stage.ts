/**
 * The stage: everything that is there before anything moves.
 *
 * Parts are listed with explicit depths rather than in declaration order, because depth here
 * is a real coordinate — a waypoint's `v` — and the truck will later be given a depth that
 * changes as it drives. Sorting on one number keeps the whole scene consistent instead of
 * leaving paint order as a thing to remember.
 */

import { defineScene } from 'dotscene'
import { figureOf } from '../iso.ts'
import { HERO_VIEWBOX } from './projection.ts'
import { road, waypoints } from './route.ts'
import { places } from './places.ts'
import { mesh, meshTethers, nodeAt, NET_Z } from './network.ts'
import { truck } from './fleet.ts'
import { shapes } from './tokens.ts'
import { along } from './route.ts'
import { css, night, paper, GROUND_NIGHT, GROUND_PAPER } from './palette.ts'

export const routeFigure = figureOf('ediRoad', road, 'The route', 'road')

/**
 * Every part of the stage, in depth order.
 *
 * The road sits under everything; the mesh floats over it. Between them each waypoint
 * contributes what stands behind the road and what stands in front, which is the gap a truck
 * later drives through.
 */
/** Where the rig waits before an act moves it: the start of the route, off-frame. */
export const rigStart = along(0)

/** The rig as a part. Acts drive it; the static stage just parks it somewhere visible. */
export const rigPart = (t: number) => {
  const spot = along(t)
  return { figure: truck, id: 'rig', at: spot.at, pose: spot.axis, depth: spot.depth } as const
}

export const stageParts = [
  { figure: routeFigure, depth: -100 },
  { figure: meshTethers, depth: -98 },
  ...waypoints.flatMap(({ id }) => {
    const place = places[id]
    return [
      { figure: place.back, depth: place.backDepth },
      { figure: place.front, depth: place.frontDepth },
    ]
  }),
  { figure: mesh, depth: 100 },
] as const

/** Tokens fly above the mesh, so they are never lost behind a link. */
export const TOKEN_DEPTH = 101

const layout = {
  parts: [
    ...stageParts,
    rigPart(0.42),
    { figure: shapes.doc('sampleDoc'), at: nodeAt('originTerm'), depth: TOKEN_DEPTH },
    { figure: shapes.status('sampleStatus'), at: nodeAt('hub'), depth: TOKEN_DEPTH },
  ],
  viewBox: HERO_VIEWBOX,
  // The scene spans a working yard and a mesh of thin links, so the median-edge default
  // sizes dots for the buildings and buries the network. Set it against the smaller detail.
  dotRadius: 0.95,
  lineWidth: 0.45,
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
