import { defineScene } from 'dotscene'
import { girl } from './girl.ts'
import { chair } from './cottage.ts'

/**
 * Three chairs, and the little one broken all to pieces.
 *
 * Props carry their floor at y = 64, so a scaled chair is offset by `64 * (1 - scale)` to
 * put its feet back on the floor. Goldilocks sits at y = 11 because her `sit` pose puts her
 * hip at a local y of 36, which lands on the middle chair's seat at 47.
 */
export const scene = defineScene('chairs', {
  title: 'Someone has been sitting in my chair',
  parts: [
    { figure: chair, id: 'chairPapa', at: [-72, 64 * (1 - 1.2)], scale: 1.2 },
    { figure: chair, id: 'chairMama', at: [0, 0] },
    { figure: chair, id: 'chairBaby', pose: 'broken', at: [62, 64 * (1 - 0.7)], scale: 0.7 },
    { figure: girl, id: 'goldilocks', pose: 'sit', at: [4, 11] },
  ],
})
