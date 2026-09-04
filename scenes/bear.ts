import { defineFigure, defineScene, mirrorX, ring } from 'dotscene'

const head = ring('head', [0, 12], 8.5, 10)
const earL = ring('earL', [-7, 3.5], 3, 6)
const earR = ring('earR', [7, 3.5], 3, 6)
const snout = ring('snout', [0, 16], 3, 6)

const left = {
  shoulderL: [-11, 28],
  elbowL: [-15, 36],
  pawL: [-16, 45],
  hipL: [-7, 45],
  kneeL: [-9, 55],
  footL: [-11, 64],
} as const

/**
 * A bear standing upright, on the person module: 64 units tall, feet at y = 64.
 *
 * Papa, Mama and Baby are the same figure at different scales — see the story scenes.
 */
export const bear = defineFigure('bear', {
  title: 'A bear',
  points: {
    ...head.points,
    ...earL.points,
    ...earR.points,
    ...snout.points,
    neck: [0, 25],
    chest: [0, 34],
    hip: [0, 44],
    ...left,
    ...mirrorX(left),
  },
  edges: [
    ...head.edges,
    ...earL.edges,
    ...earR.edges,
    ...snout.edges,
    // Ears sit on the skull rather than floating beside it.
    ['earL3', 'head8'],
    ['earR4', 'head1'],
    ['head5', 'neck'],
    ['neck', 'chest'],
    ['chest', 'hip'],
    ['neck', 'shoulderL'],
    ['neck', 'shoulderR'],
    ['shoulderL', 'elbowL'],
    ['elbowL', 'pawL'],
    ['shoulderR', 'elbowR'],
    ['elbowR', 'pawR'],
    ['hip', 'hipL'],
    ['hip', 'hipR'],
    ['hipL', 'kneeL'],
    ['kneeL', 'footL'],
    ['hipR', 'kneeR'],
    ['kneeR', 'footR'],
  ],
  poses: {
    stand: {},
    /** Paws raised in alarm — the moment the bears find their beds occupied. */
    startle: {
      elbowL: [-18, 30],
      pawL: [-20, 20],
      elbowR: [18, 30],
      pawR: [20, 20],
      neck: [0, 26],
    },
  },
})

export const scene = defineScene('bear', {
  title: 'A bear',
  parts: [{ figure: bear }],
})
