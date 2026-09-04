import { defineFigure, defineScene } from 'dotscene'

/** A desk lamp, on the person module: base on the ground at y = 64. */
export const lamp = defineFigure('lamp', {
  title: 'A desk lamp',
  points: {
    baseL: [-10, 64],
    baseR: [10, 64],
    stem: [0, 62],
    joint: [2, 34],
    armEnd: [22, 20],
    shadeTop: [16, 12],
    shadeLip: [34, 26],
  },
  edges: [
    ['baseL', 'baseR'],
    ['baseL', 'stem'],
    ['baseR', 'stem'],
    ['stem', 'joint'],
    ['joint', 'armEnd'],
    ['armEnd', 'shadeTop'],
    ['shadeTop', 'shadeLip'],
    ['shadeLip', 'armEnd'],
  ],
})

export const scene = defineScene('lamp', { title: 'A desk lamp', parts: [{ figure: lamp }] })
