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
     * A four-phase walk cycle in profile, facing +x. Use `flipX` on the part to walk the
     * other way rather than authoring a mirrored set.
     *
     * Two things make this read as walking rather than skating. The planted foot sits
     * exactly half a stride ahead of the hip at contact and half a stride behind at the
     * next contact, so if the scene advances the figure by one STRIDE between contacts the
     * foot stays put on the ground while the body travels over it. And the body drops 3
     * units at contact — a leg reaching 11 units forward cannot also be 28 units long — so
     * the bob is a consequence of the geometry, not a decoration.
     *
     * The right arm hangs to carry something; the left swings in opposition to the legs.
     */
    stepA: {
      head: [4, 6], neck: [2, 16], chest: [1, 25], hip: [0, 37],
      shoulderL: [-3, 19], shoulderR: [3, 18],
      hipL: [-3, 39], hipR: [3, 39],
      kneeL: [6, 51], footL: [10, 64],
      kneeR: [-4, 51], footR: [-10, 63],
      elbowL: [-8, 27], handL: [-11, 35],
      elbowR: [7, 28], handR: [9, 38],
    },
    passA: {
      head: [4, 3], neck: [2, 13], chest: [1, 22], hip: [0, 34],
      shoulderL: [-3, 16], shoulderR: [3, 15],
      hipL: [-3, 36], hipR: [3, 36],
      kneeL: [-2, 50], footL: [0, 64],
      kneeR: [8, 47], footR: [5, 59],
      elbowL: [-5, 25], handL: [-7, 34],
      elbowR: [7, 25], handR: [9, 35],
    },
    stepB: {
      head: [4, 6], neck: [2, 16], chest: [1, 25], hip: [0, 37],
      shoulderL: [-3, 19], shoulderR: [3, 18],
      hipL: [-3, 39], hipR: [3, 39],
      kneeR: [6, 51], footR: [10, 64],
      kneeL: [-4, 51], footL: [-10, 63],
      elbowL: [1, 26], handL: [4, 33],
      elbowR: [7, 28], handR: [9, 38],
    },
    passB: {
      head: [4, 3], neck: [2, 13], chest: [1, 22], hip: [0, 34],
      shoulderL: [-3, 16], shoulderR: [3, 15],
      hipL: [-3, 36], hipR: [3, 36],
      kneeR: [2, 50], footR: [0, 64],
      kneeL: [8, 47], footL: [5, 59],
      elbowL: [-3, 25], handL: [-4, 34],
      elbowR: [7, 25], handR: [9, 35],
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
