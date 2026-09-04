import { defineFigure, defineScene } from 'dotscene'
import { person } from './person.ts'

/** Ground line at y = 0, dipping into a trench. Extends past the figure on both sides. */
export const ground = defineFigure('ground', {
  title: 'Ground with a trench',
  points: {
    farL: [-34, 0],
    lipL: [2, 0],
    floorL: [8, 11],
    floorR: [22, 12],
    lipR: [28, 0],
    farR: [46, 0],
    pileA: [32, 0],
    pileB: [36, -6],
    pileC: [41, 0],
  },
  edges: [
    ['farL', 'lipL'],
    ['lipL', 'floorL'],
    ['floorL', 'floorR'],
    ['floorR', 'lipR'],
    ['lipR', 'farR'],
    ['pileA', 'pileB'],
    ['pileB', 'pileC'],
  ],
})

/** A shovel, grip at the origin, blade down the +y axis. */
export const shovel = defineFigure('shovel', {
  title: 'A shovel',
  points: {
    grip: [0, 0],
    shaft: [3, 11],
    collar: [6, 22],
    bladeL: [2, 25],
    bladeTip: [7, 32],
    bladeR: [11, 24],
  },
  edges: [
    ['grip', 'shaft'],
    ['shaft', 'collar'],
    ['collar', 'bladeL'],
    ['bladeL', 'bladeTip'],
    ['bladeTip', 'bladeR'],
    ['bladeR', 'collar'],
  ],
})

export const scene = defineScene('ditch', {
  title: 'A person digging a ditch',
  parts: [
    { figure: ground },
    { figure: person, id: 'digger', pose: 'dig', at: [-14, -64] },
    { figure: shovel, at: [4, -26], rotate: 14 },
  ],
})
