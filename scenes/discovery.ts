import { defineScene } from 'dotscene'
import { bear } from './bear.ts'
import { girl } from './girl.ts'
import { bed } from './cottage.ts'

/**
 * The three bears find her asleep.
 *
 * Goldilocks is the standing figure turned on her side: `rotate: -90` maps her local +y
 * (head to feet) onto +x, so she lies head-left along the mattress. Laying her out that way
 * costs one transform instead of twenty hand-written coordinates.
 */
export const scene = defineScene('discovery', {
  title: 'Someone has been sleeping in my bed',
  parts: [
    { figure: bed, at: [0, 0] },
    { figure: girl, id: 'goldilocks', pose: 'sleep', rotate: -90, at: [-42, 40] },
    { figure: bear, id: 'papa', pose: 'startle', at: [80, 64 * (1 - 1.15)], scale: 1.15 },
    { figure: bear, id: 'mama', pose: 'startle', at: [128, 64 * (1 - 0.95)], scale: 0.95 },
    { figure: bear, id: 'baby', pose: 'startle', at: [164, 64 * (1 - 0.65)], scale: 0.65 },
  ],
})
