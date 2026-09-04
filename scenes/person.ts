import { defineFigure, defineScene, mirrorX } from '../src/index.ts'

const left = {
  shoulderL: [-7, 15],
  elbowL: [-13, 24],
  handL: [-16, 33],
  hipL: [-5, 36],
  kneeL: [-7, 50],
  footL: [-8, 64],
} as const

/**
 * A person, seen head-on. Local space: origin at the top of the head, y downward,
 * roughly 64 units tall — treat that as the module for every other figure.
 */
export const person = defineFigure('person', {
  title: 'A person',
  points: {
    head: [0, 3],
    neck: [0, 13],
    chest: [0, 22],
    hip: [0, 34],
    ...left,
    ...mirrorX(left),
  },
  edges: [
    ['head', 'neck'],
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
    idle: {},
    wave: {
      elbowR: [14, 16],
      handR: [18, 5],
      head: [1, 3],
    },
    lean: {
      head: [-3, 4],
      neck: [-2, 13],
      chest: [-1, 22],
      handL: [-18, 30],
      kneeR: [8, 50],
      footR: [11, 64],
    },
  },
})

export const scene = defineScene('person', {
  title: 'A person',
  parts: [{ figure: person }],
})
