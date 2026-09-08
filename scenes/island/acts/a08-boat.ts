/**
 * The boat. With the light lit, the harbour can be found: a launch comes in from the open
 * sea with its lantern on, slows, and ties up at the dock — the first visitor in years.
 */

import { type Beat } from 'dotscene'
import { at as project } from '../../edi/projection.ts'
import { defineAct, holdAt, stateBefore } from './act.ts'
import { depthOf, vec, type Cell } from './kit.ts'
import { BOAT } from '../world.ts'
import { START } from '../timing.ts'

const beats: Beat[] = []
const state = (cell: Cell, opacity: number, lantern: number) => ({
  boat: { at: vec(project([cell[0], cell[1], 0])), pose: BOAT.pose, opacity, depth: depthOf(cell) + 0.4 },
  boatLantern: { at: vec(project([cell[0] + BOAT.lantern[0], cell[1] + BOAT.lantern[1], BOAT.lantern[2]])), opacity: lantern, depth: depthOf(cell) + 0.9 },
})

// Waiting out at sea, unseen, until the light is lit.
beats.push({ at: 0, parts: state(BOAT.from, 0, 0) })
beats.push({ at: START.boat, parts: state(BOAT.from, 0, 0) })
beats.push({ at: START.boat + 600, parts: state(BOAT.from, 1, 1) }, { at: START.boat + 601, parts: { boat: { opacity: 1 } } })

// In to the dock, slowing, and a wake behind.
const ARRIVE = 6800
const steps = 6
for (let i = 1; i <= steps; i++) {
  const f = i / steps
  const cell: Cell = [BOAT.from[0] + (BOAT.docked[0] - BOAT.from[0]) * f, BOAT.from[1] + (BOAT.docked[1] - BOAT.from[1]) * f]
  const parts = state(cell, 1, 1)
  const wakeCell: Cell = [cell[0] + BOAT.wakeOffset[0], cell[1] + BOAT.wakeOffset[1]]
  beats.push({
    at: START.boat + 600 + Math.round(ARRIVE * f),
    parts: {
      ...parts,
      wake: { at: vec(project([wakeCell[0], wakeCell[1], 0])), pose: BOAT.wakePoses[i % 3]!, opacity: i === steps ? 0 : 0.9, depth: depthOf(wakeCell) + 0.3 },
    },
    easing: i === steps ? 'easeOut' : undefined,
  })
}

// Held at the dock, then gone again before dawn, so the harbour is empty and waiting once more.
beats.push({ at: holdAt(START.reset), parts: Object.fromEntries(['boat', 'boatLantern', 'wake'].map((id) => [id, stateBefore(beats, id, holdAt(START.reset))])) })
beats.push({ at: START.reset + 20, parts: { ...state(BOAT.from, 0, 0), wake: { opacity: 0 } } })

export const act = defineAct('islandBoat', 'A boat finds the harbour', beats)
