import { defineFigure, defineScene, mirrorX } from 'dotscene'

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
    /** Seated in profile, facing right, hands out at a wheel. */
    drive: {
      head: [4, 7],
      neck: [3, 16],
      chest: [2, 23],
      hip: [0, 32],
      shoulderL: [2, 17],
      elbowL: [9, 24],
      handL: [15, 27],
      shoulderR: [4, 18],
      elbowR: [11, 25],
      handR: [16, 25],
      hipL: [0, 33],
      kneeL: [12, 36],
      footL: [17, 46],
      hipR: [1, 34],
      kneeR: [13, 37],
      footR: [18, 47],
    },
    /** Bent forward over a shovel, weight on the back foot. */
    dig: {
      head: [10, 11],
      neck: [7, 19],
      chest: [4, 25],
      hip: [0, 34],
      shoulderL: [4, 21],
      elbowL: [11, 30],
      handL: [17, 40],
      shoulderR: [9, 20],
      elbowR: [15, 28],
      handR: [20, 35],
      hipL: [-2, 35],
      kneeL: [-8, 49],
      footL: [-11, 64],
      hipR: [3, 35],
      kneeR: [8, 50],
      footR: [12, 63],
    },
    /**
     * Walking and hand-off poses. `Carry` holds an item in the right hand, `Hold` in the
     * left — so two figures facing each other can each keep the item on the inner side.
     * A/B are opposite halves of the stride.
     */
    walkCarryA: {
      kneeL: [-11, 47], footL: [-16, 61], kneeR: [4, 51], footR: [7, 64],
      elbowR: [12, 26], handR: [12, 35],
      elbowL: [-10, 25], handL: [-8, 32],
    },
    walkCarryB: {
      kneeL: [-4, 51], footL: [-7, 64], kneeR: [11, 47], footR: [16, 61],
      elbowR: [12, 26], handR: [12, 35],
      elbowL: [-15, 25], handL: [-19, 31],
    },
    walkHoldA: {
      kneeL: [-11, 47], footL: [-16, 61], kneeR: [4, 51], footR: [7, 64],
      elbowL: [-12, 26], handL: [-12, 35],
      elbowR: [10, 25], handR: [8, 32],
    },
    walkHoldB: {
      kneeL: [-4, 51], footL: [-7, 64], kneeR: [11, 47], footR: [16, 61],
      elbowL: [-12, 26], handL: [-12, 35],
      elbowR: [15, 25], handR: [19, 31],
    },
    /** Standing still with something in one hand. */
    holdR: { elbowR: [12, 26], handR: [12, 35] },
    holdL: { elbowL: [-12, 26], handL: [-12, 35] },
    /** Arm out at chest height, offering what it holds. */
    offerR: { elbowR: [17, 19], handR: [25, 23] },
    offerL: { elbowL: [-17, 19], handL: [-25, 23] },
    /** Shaking with one hand while the other keeps hold of something. */
    shakeR: { elbowR: [15, 23], handR: [23, 28], elbowL: [-12, 26], handL: [-12, 35] },
    shakeL: { elbowL: [-15, 23], handL: [-23, 28], elbowR: [12, 26], handR: [12, 35] },
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
