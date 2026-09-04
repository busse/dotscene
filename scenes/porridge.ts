import { defineScene } from 'dotscene'
import { girl } from './girl.ts'
import { bowl, table } from './cottage.ts'

/**
 * Three bowls on the table, and Goldilocks reaching for the first of them.
 *
 * Props are drawn with the floor at y = 64, so scaling one about the origin also moves the
 * height it sits at. A bowl whose base belongs on the tabletop at y = 36 is placed at
 * `36 * (1 - scale)` to put the base back on the table.
 */
export const scene = defineScene('porridge', {
  title: 'Someone has been eating my porridge',
  parts: [
    { figure: table, at: [14, 0] },
    { figure: bowl, id: 'bowlPapa', at: [-6, 36 * (1 - 1.15)], scale: 1.15 },
    { figure: bowl, id: 'bowlMama', at: [14, 0] },
    { figure: bowl, id: 'bowlBaby', at: [32, 36 * (1 - 0.75)], scale: 0.75 },
    { figure: girl, id: 'goldilocks', pose: 'reach', at: [-34, 0] },
  ],
})
