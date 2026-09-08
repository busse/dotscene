/**
 * An act on the island: a named bundle of beats, placed on the day's clock.
 *
 * Unlike the EDI acts, every island act is placed at zero and speaks in absolute times from
 * `timing.ts` — because each misfit is broken from dawn until the keeper reaches it, and its
 * broken loop and its fix have to be one act, or two acts would fight over one part.
 */

import type { Act, Beat, Part, PartKeyframe } from 'dotscene'

export interface IslandAct {
  readonly id: string
  readonly title: string
  readonly act: Act
  /** Parts this act brings, on top of the stage and the standing cast. */
  readonly parts: readonly Part[]
}

export const defineAct = (id: string, title: string, beats: readonly Beat[], parts: readonly Part[] = []): IslandAct => ({
  id,
  title,
  act: { name: id, beats: [...beats].sort((a, b) => a.at - b.at) },
  parts,
})

/**
 * A part's accumulated state from `beats`, as of just before `before`. A reset that jumps a
 * part back is a keyframe like any other, so without a hold at the same state just before it
 * the part slides there over everything since its last beat.
 */
export const stateBefore = (beats: readonly Beat[], id: string, before: number): PartKeyframe => {
  let state: PartKeyframe = {}
  for (const beat of [...beats].sort((a, b) => a.at - b.at)) {
    if (beat.at >= before) break
    const step = beat.parts?.[id]
    if (step) state = { ...state, ...step }
  }
  return state
}

/** The moment before the reset at which everything it moves is held where it is. */
export const holdAt = (reset: number): number => reset - 80
