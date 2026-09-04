import { defineFigure, defineScene, mirrorX, ring } from 'dotscene'

const head = ring('head', [0, 7], 5, 8)

const left = {
  hair1L: [-7, 2],
  hair2L: [-9, 11],
  hair3L: [-7, 18],
  shoulderL: [-7, 19],
  elbowL: [-11, 28],
  handL: [-13, 37],
  hipL: [-5, 36],
  kneeL: [-6, 50],
  footL: [-8, 64],
} as const

/**
 * Goldilocks — the person module (64 tall, feet at y = 64) with hair, so she reads apart
 * from the bears at a glance.
 */
export const girl = defineFigure('girl', {
  title: 'Goldilocks',
  points: {
    ...head.points,
    neck: [0, 14],
    chest: [0, 22],
    hip: [0, 34],
    ...left,
    ...mirrorX(left),
  },
  edges: [
    ...head.edges,
    ['hair1L', 'hair2L'],
    ['hair2L', 'hair3L'],
    ['hair1L', 'head7'],
    ['hair1R', 'hair2R'],
    ['hair2R', 'hair3R'],
    ['hair1R', 'head1'],
    ['head4', 'neck'],
    ['neck', 'chest'],
    ['chest', 'hip'],
    ['neck', 'shoulderL'],
    ['neck', 'shoulderR'],
    ['shoulderL', 'elbowL'],
    ['elbowL', 'handL'],
    ['shoulderR', 'elbowR'],
    ['elbowR', 'handR'],
    ['hip', 'hipL'],
    ['hip', 'hipR'],
    ['hipL', 'kneeL'],
    ['kneeL', 'footL'],
    ['hipR', 'kneeR'],
    ['kneeR', 'footR'],
  ],
  poses: {
    stand: {},
    /** Leaning over the table, spoon hand up to her mouth. */
    taste: {
      neck: [2, 15],
      chest: [1, 23],
      elbowR: [10, 24],
      handR: [5, 14],
      elbowL: [-10, 29],
      handL: [-8, 38],
    },
    /** Sitting: knees forward, feet down, back upright. */
    sit: {
      hipL: [-5, 38],
      hipR: [5, 38],
      kneeL: [14, 40],
      kneeR: [16, 41],
      footL: [17, 53],
      footR: [19, 54],
      elbowL: [-10, 30],
      handL: [-8, 39],
      elbowR: [10, 30],
      handR: [8, 39],
    },
    /** Reaching across the table for a bowl. */
    reach: {
      neck: [2, 15],
      chest: [1, 23],
      elbowR: [12, 24],
      handR: [22, 30],
      elbowL: [-10, 29],
      handL: [-9, 38],
    },
    /** Asleep: arms tucked in, knees a little bent. Scenes lay her flat with `rotate`. */
    sleep: {
      elbowL: [-7, 28],
      handL: [-5, 36],
      elbowR: [7, 28],
      handR: [5, 36],
      kneeL: [-8, 50],
      kneeR: [8, 50],
      footL: [-6, 63],
      footR: [10, 63],
      hair2L: [-11, 10],
      hair3L: [-10, 17],
    },
  },
})

export const scene = defineScene('girl', {
  title: 'Goldilocks',
  parts: [{ figure: girl }],
})
