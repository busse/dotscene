/**
 * The mainframe on square wheels — the train that could not roll.
 *
 * It rocks on its corners at the dock, going nowhere, until the keeper kneels and swaps the
 * wheels for round ones. Then it rolls the length of the dock for the first time in years
 * and gives a little bounce at the end.
 */

import { type Beat, type PartKeyframe } from 'dotscene'
import { at as project } from '../../edi/projection.ts'
import { defineAct } from './act.ts'
import { depthOf, sip, standAt, walk, walkTime, vec } from './kit.ts'
import { MAINFRAME, WORK } from '../world.ts'
import { FIXED, START } from '../timing.ts'

const M = 'mainframe'
const K = 'keeper'

const at = (cell: readonly [number, number], z = 0, extra: Partial<PartKeyframe> = {}): PartKeyframe => ({
  at: vec(project([cell[0], cell[1], z])),
  depth: depthOf(cell) + 0.5,
  pose: 'square',
  rotate: 0,
  ...extra,
})

const beats: Beat[] = []

// Rocking on its corners, every third of a second, until it is fixed.
beats.push({ at: 0, parts: { [M]: at(MAINFRAME.home, 0, { rotate: 0 }) }, easing: 'easeInOut' })
for (let t = 340, i = 0; t < FIXED.mainframe - 400; t += 340, i++) {
  beats.push({ at: t, parts: { [M]: at(MAINFRAME.home, 0, { rotate: i % 2 === 0 ? 3.2 : -3.2 }) }, easing: 'easeInOut' })
}
beats.push({ at: FIXED.mainframe - 400, parts: { [M]: at(MAINFRAME.home, 0, { rotate: 0 }) }, easing: 'easeOut' })

// The keeper kneels to it, and the wheels turn round as it stands up again.
beats.push(...sip(WORK.mainframe, START.mainframe + 300, true))
beats.push({ at: START.mainframe + 1500, parts: standAt(K, WORK.mainframe, 'lean', true), easing: 'easeInOut' })
beats.push({ at: FIXED.mainframe - 300, parts: standAt(K, WORK.mainframe, 'lean', true) })
beats.push({ at: FIXED.mainframe + 200, parts: standAt(K, WORK.mainframe, 'idle', true), easing: 'easeInOut' })
beats.push({ at: FIXED.mainframe, parts: { [M]: at(MAINFRAME.home, 0, { pose: 'round' }) }, easing: 'easeInOut' })

// And it rolls, with a bounce, and settles.
const ROLL = FIXED.mainframe + 600
beats.push({ at: ROLL, parts: { [M]: at(MAINFRAME.home, 0, { pose: 'round' }) } })
beats.push({ at: ROLL + 1000, parts: { [M]: at(MAINFRAME.mid, 0.18, { pose: 'round' }) }, easing: 'easeIn' })
beats.push({ at: ROLL + 1900, parts: { [M]: at(MAINFRAME.rolled, 0, { pose: 'round' }) }, easing: 'easeOut' })
beats.push({ at: ROLL + 2150, parts: { [M]: at(MAINFRAME.rolled, 0.22, { pose: 'round' }) }, easing: 'easeOut' })
beats.push({ at: ROLL + 2400, parts: { [M]: at(MAINFRAME.rolled, 0, { pose: 'round' }) }, easing: 'easeIn' })

// The keeper waves it off and heads for the next one.
beats.push({ at: ROLL + 600, parts: standAt(K, WORK.mainframe, 'wave', true) })
beats.push({ at: ROLL + 1300, parts: standAt(K, WORK.mainframe, 'idle', true) })
beats.push(...walk(K, WORK.mainframe, WORK.spreadsheet, ROLL + 1400, Math.max(walkTime(WORK.mainframe, WORK.spreadsheet), START.spreadsheet + 2200 - (ROLL + 1400))))

export const act = defineAct('islandMainframe', 'The mainframe on square wheels', beats)
