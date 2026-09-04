import { defineScene } from 'dotscene'
import { person } from './person.ts'

/**
 * The character-select header: one figure looping through poses.
 *
 * The viewBox is fitted across every pose in the cycle, so the raised arm in `wave` never
 * clips even though the resting figure is narrower.
 */
export const scene = defineScene('header', {
  title: 'A person cycling through poses',
  parts: [{ figure: person }],
  animate: {
    cycle: ['idle', 'wave', 'lean'],
    duration: 700,
    hold: 900,
    easing: 'easeInOut',
    mode: 'loop',
  },
})
