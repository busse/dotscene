import { defineFigure, defineScene, ring } from 'dotscene'

const front = ring('wheelF', [40, 52], 12, 8)
const rear = ring('wheelR', [128, 52], 12, 8)

/**
 * A car in profile, facing left.
 *
 * Drawn on the same module as `person`: the ground sits at y = 64, so a 64-unit-tall figure
 * standing at y = 0 shares this car's ground line without an offset, and a driver only needs
 * scaling for the cabin rather than for the units.
 */
export const car = defineFigure('car', {
  title: 'A car',
  points: {
    noseLow: [8, 58],
    noseHigh: [14, 38],
    hoodFront: [34, 34],
    screenFoot: [62, 31],
    roofFront: [80, 12],
    roofBack: [124, 12],
    tailHigh: [156, 34],
    tailLow: [162, 58],
    ...front.points,
    ...rear.points,
  },
  edges: [
    ['noseLow', 'noseHigh'],
    ['noseHigh', 'hoodFront'],
    ['hoodFront', 'screenFoot'],
    ['screenFoot', 'roofFront'],
    ['roofFront', 'roofBack'],
    ['roofBack', 'tailHigh'],
    ['tailHigh', 'tailLow'],
    ['tailLow', 'noseLow'],
    ...front.edges,
    ...rear.edges,
  ],
  poses: {
    still: {},
  },
})

export const scene = defineScene('car', {
  title: 'A car',
  parts: [{ figure: car }],
})
