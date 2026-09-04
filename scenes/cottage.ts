import { defineFigure } from 'dotscene'

/**
 * Furniture for the Three Bears' cottage.
 *
 * Every prop is drawn with the floor at y = 64, the same as the person module, so a figure
 * and a piece of furniture placed at the same origin stand on one shared floor.
 */

export const table = defineFigure('table', {
  title: 'A table',
  points: {
    topL: [-34, 36],
    topR: [34, 36],
    legLTop: [-27, 36],
    legLFoot: [-27, 64],
    legRTop: [27, 36],
    legRFoot: [27, 64],
  },
  edges: [
    ['topL', 'topR'],
    ['legLTop', 'legLFoot'],
    ['legRTop', 'legRFoot'],
  ],
})

/** Opens upward with its base at y = 36 — the tabletop — so it stands on the table. */
export const bowl = defineFigure('bowl', {
  title: 'A bowl of porridge',
  points: {
    rimL: [-7, 29],
    rimR: [7, 29],
    sideL: [-5, 34],
    sideR: [5, 34],
    base: [0, 36],
  },
  edges: [
    ['rimL', 'rimR'],
    ['rimL', 'sideL'],
    ['sideL', 'base'],
    ['base', 'sideR'],
    ['sideR', 'rimR'],
  ],
})

/** Side view, back to the left. A rectangular back reads as a chair; a bare post does not. */
export const chair = defineFigure('chair', {
  title: 'A chair',
  points: {
    railTopB: [-13, 28],
    railTopF: [-6, 28],
    seatB: [-13, 47],
    seatM: [-6, 47],
    seatF: [14, 47],
    footB: [-13, 64],
    footF: [14, 64],
  },
  edges: [
    ['railTopB', 'railTopF'],
    ['railTopB', 'seatB'],
    ['railTopF', 'seatM'],
    ['seatB', 'seatM'],
    ['seatM', 'seatF'],
    ['seatB', 'footB'],
    ['seatF', 'footF'],
  ],
  poses: {
    whole: {},
    /** Broken all to pieces: back thrown down, seat collapsed, legs splayed. */
    broken: {
      railTopB: [-31, 49],
      railTopF: [-24, 57],
      seatB: [-16, 62],
      seatM: [-7, 55],
      seatF: [13, 61],
      footB: [-27, 64],
      footF: [19, 64],
    },
  },
})

export const bed = defineFigure('bed', {
  title: 'A bed',
  points: {
    headTop: [-46, 26],
    headBot: [-46, 50],
    footTop: [42, 36],
    footBot: [42, 50],
    legB: [-46, 64],
    legF: [42, 64],
    pillowL: [-42, 46],
    pillowR: [-28, 46],
  },
  edges: [
    ['headTop', 'headBot'],
    ['headBot', 'footBot'],
    ['footBot', 'footTop'],
    ['headBot', 'legB'],
    ['footBot', 'legF'],
    ['pillowL', 'pillowR'],
  ],
})
