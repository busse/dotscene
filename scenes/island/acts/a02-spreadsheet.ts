/**
 * The spreadsheet that thinks it is a database.
 *
 * A stack of gridded sheets, teetering, holding up the business. The keeper fetches a proper
 * database drum from the hut and slides it under; the stack straightens and sits up on it.
 */

import { type Beat, type PartKeyframe } from 'dotscene'
import { at as project } from '../../edi/projection.ts'
import { defineAct } from './act.ts'
import { depthOf, standAt, walk, walkTime, vec } from './kit.ts'
import { SPREADSHEET, WORK } from '../world.ts'
import { FIXED, START } from '../timing.ts'

const S = 'spreadsheet'
const D = 'drum'
const K = 'keeper'

const stack = (z: number, pose: string): PartKeyframe => ({
  at: vec(project([SPREADSHEET.home[0], SPREADSHEET.home[1], z])),
  depth: depthOf(SPREADSHEET.home) + 0.6,
  pose,
})
const drum = (cell: readonly [number, number], opacity: number): PartKeyframe => ({
  at: vec(project([cell[0], cell[1], 0])),
  depth: depthOf(cell) + 0.5,
  opacity,
})

const beats: Beat[] = []

// Teetering, until the drum is under it.
const SWAY = ['rest', 'leanA', 'rest', 'leanB']
for (let t = 0, i = 0; t < FIXED.spreadsheet - 1200; t += 700, i++) {
  beats.push({ at: t, parts: { [S]: stack(0, SWAY[i % 4]!) }, easing: 'easeInOut' })
}

// The keeper arrives, considers it, and goes for the drum.
beats.push({ at: START.spreadsheet + 2300, parts: standAt(K, WORK.spreadsheet, 'idle') })
beats.push({ at: START.spreadsheet + 2700, parts: standAt(K, WORK.spreadsheet, 'lean') })
beats.push({ at: START.spreadsheet + 3300, parts: standAt(K, WORK.spreadsheet, 'offerR') })

// The drum slides over from beside the hut and under the stack.
beats.push({ at: START.spreadsheet + 2800, parts: { [D]: drum(SPREADSHEET.drumFrom, 0) } })
beats.push({ at: START.spreadsheet + 3200, parts: { [D]: drum(SPREADSHEET.drumFrom, 1) } })
beats.push({ at: FIXED.spreadsheet - 900, parts: { [D]: drum(SPREADSHEET.home, 1) }, easing: 'easeInOut' })

// The stack straightens and rises onto it.
beats.push({ at: FIXED.spreadsheet - 1200, parts: { [S]: stack(0, 'rest') } })
beats.push({ at: FIXED.spreadsheet - 300, parts: { [S]: stack(0.9, 'straight') }, easing: 'easeInOut' })
beats.push({ at: FIXED.spreadsheet, parts: { [S]: stack(0.82, 'straight') }, easing: 'easeOut' })

// Satisfied, the keeper moves on.
beats.push({ at: FIXED.spreadsheet + 200, parts: standAt(K, WORK.spreadsheet, 'idle') })
beats.push(...walk(K, WORK.spreadsheet, WORK.fax, FIXED.spreadsheet + 400, Math.max(walkTime(WORK.spreadsheet, WORK.fax), START.fax + 2300 - (FIXED.spreadsheet + 400))))

export const act = defineAct('islandSpreadsheet', 'The spreadsheet that thinks it is a database', beats)
