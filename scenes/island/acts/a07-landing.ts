/**
 * The pilot that never ended.
 *
 * A little biplane has been crossing the island since dawn, trailing its banner, with
 * nowhere it is allowed to land. When the lighthouse comes on it has a runway: it comes in
 * low along the beach, touches down, and taxis to a stop by the hut, propeller winding down.
 */

import { type Beat } from 'dotscene'
import { at as project } from '../../edi/projection.ts'
import { defineAct, holdAt, stateBefore } from './act.ts'
import { depthOf, fly, SKY, vec } from './kit.ts'
import { PLANE } from '../world.ts'
import { START } from '../timing.ts'

const P = 'plane'
const B = 'banner'
const ALT = 8.5
const PASS = 8600
const GAP = 2400
const PROP = ['x', 'xPropB'] as const
const PROP_R = ['xr', 'xr'] as const
const FLAP = ['a', 'b', 'c']

const beats: Beat[] = []

// Out and back, all day, at altitude, until it is time to come in.
let t = 0
let outbound = true
while (t + PASS < START.landing - 1500) {
  beats.push(
    ...fly({
      part: P,
      from: outbound ? PLANE.a : PLANE.b,
      to: outbound ? PLANE.b : PLANE.a,
      z: ALT,
      at: t,
      duration: PASS,
      pose: outbound ? 'x' : 'xr',
      propPoses: outbound ? PROP : PROP_R,
      trail: { part: B, offset: outbound ? PLANE.bannerOffset : PLANE.bannerOffsetBack, poses: FLAP },
    }),
  )
  t += PASS + GAP
  outbound = !outbound
}

// The approach: from the far end of its run, down onto the beach and along it.
const IN = START.landing
beats.push(
  ...fly({
    part: P,
    from: PLANE.a,
    to: PLANE.touchdown,
    z: ALT,
    zTo: 0,
    at: IN,
    duration: 3600,
    pose: 'x',
    propPoses: PROP,
    trail: { part: B, offset: PLANE.bannerOffset, poses: FLAP },
    bob: 0.12,
  }),
)
// Rolling out along the sand to a stop; the banner drops behind.
const ground = (cell: readonly [number, number], pose: string) => ({
  at: vec(project([cell[0], cell[1], 0])),
  pose,
  opacity: 1,
  depth: depthOf(cell) + 0.5,
})
beats.push({ at: IN + 3600, parts: { [P]: { ...ground(PLANE.touchdown, 'x'), depth: SKY + 2 } } })
beats.push({ at: IN + 3601, parts: { [P]: ground(PLANE.touchdown, 'x') } })
beats.push({ at: IN + 4300, parts: { [P]: ground(PLANE.roll, 'xPropB') } })
beats.push({ at: IN + 5200, parts: { [P]: ground(PLANE.park, 'x') }, easing: 'easeOut' })
beats.push({ at: IN + 3700, parts: { [B]: { opacity: 1 } } })
beats.push({ at: IN + 4400, parts: { [B]: { opacity: 0 } }, easing: 'easeIn' })

// Reset under the dark: back to the start of its first pass, high and far off.
beats.push({ at: holdAt(START.reset), parts: { [P]: stateBefore(beats, P, holdAt(START.reset)), [B]: stateBefore(beats, B, holdAt(START.reset)) } })
const home = vec(project([PLANE.a[0], PLANE.a[1], ALT]))
beats.push({ at: START.reset + 30, parts: { [P]: { at: home, pose: 'x', opacity: 1, depth: SKY + 2 }, [B]: { at: vec([home[0] + PLANE.bannerOffset[0], home[1] + PLANE.bannerOffset[1]]), pose: 'a', opacity: 1, depth: SKY + 1 } } })

export const act = defineAct('islandLanding', 'The pilot that never ended', beats)
