/**
 * What the keeper built: the hut, the lighthouse and its light, the dock, the hammock, and
 * a signboard nobody reads. Every figure sits at the grid origin, base at z = 0.
 */

import { defineFigure, type Vec2, type Vec3 } from 'dotscene'
import { at, box, edge, pad } from '../../edi/projection.ts'
import { figureOf, merge, tag, tone, type Shape } from '../../iso.ts'

/** A shape's faces all given one kind. */
const faced = (shape: Shape, kind: string): Shape => ({
  ...shape,
  faces: (shape.faces ?? []).map((f) => ({ ...f, kind })),
})

// ---------------------------------------------------------------------------------------------
// The hut

const HUT_WALL = 1.6
const HUT_APEX = 2.6

export const hut = figureOf(
  'hut',
  merge(
    tone(box('hut', [-1, -1], [1, 1], HUT_WALL), 'warm'),
    // A pyramid roof: the apex over the middle, the two visible slopes faced.
    {
      points: { apex: at([0, 0, HUT_APEX]) },
      edges: [
        ['apex', 'hutTopEast'],
        ['apex', 'hutTopNear'],
        ['apex', 'hutTopWest'],
      ],
      faces: [
        { points: ['hutTopEast', 'hutTopNear', 'apex'], kind: 'roof' },
        { points: ['hutTopNear', 'hutTopWest', 'apex'], kind: 'roof' },
      ],
    },
    // The chimney rises out of the back slope.
    box('chimney', [0.4, -0.7], [0.7, -0.4], 3.2, 2.0),
    // The door, in the front wall; the window, in the side wall.
    tag(
      {
        points: {
          doorL: at([-0.3, 1, 0]),
          doorR: at([0.3, 1, 0]),
          doorTR: at([0.3, 1, 1.1]),
          doorTL: at([-0.3, 1, 1.1]),
          winA: at([1, -0.65, 0.65]),
          winB: at([1, -0.15, 0.65]),
          winC: at([1, -0.15, 1.15]),
          winD: at([1, -0.65, 1.15]),
        },
        edges: [
          ['doorL', 'doorTL'],
          ['doorTL', 'doorTR'],
          ['doorTR', 'doorR'],
          ['winA', 'winB'],
          ['winB', 'winC'],
          ['winC', 'winD'],
          ['winD', 'winA'],
        ],
        faces: [
          { points: ['doorL', 'doorR', 'doorTR', 'doorTL'], kind: 'door' },
          { points: ['winA', 'winB', 'winC', 'winD'], kind: 'glass' },
        ],
      },
      'soft',
    ),
  ),
  "The keeper's hut",
)
/** Just outside the door, on the +y side. */
export const HUT_DOOR: Vec2 = [0, 1.6]
export const HUT_CHIMNEY: Vec3 = [0.55, -0.55, 3.2]

// ---------------------------------------------------------------------------------------------
// The lighthouse

const TOWER_TOP = 10
const BASE_HALF = 1
const TOP_HALF = 0.7

/** The tower's half-width at a height: it tapers from the base to the gallery. */
const halfAt = (z: number): number => BASE_HALF + (TOP_HALF - BASE_HALF) * (z / TOWER_TOP)

/** A band round the tower's two visible walls at a height. */
const band = (name: string, z: number): Shape => {
  const s = halfAt(z)
  return tag(merge(edge(`${name}E`, [s, -s, z], [s, s, z]), edge(`${name}S`, [s, s, z], [-s, s, z])), 'soft')
}

const tower: Shape = {
  points: {
    towerEast: at([BASE_HALF, -BASE_HALF, 0]),
    towerNear: at([BASE_HALF, BASE_HALF, 0]),
    towerWest: at([-BASE_HALF, BASE_HALF, 0]),
    towerTopFar: at([-TOP_HALF, -TOP_HALF, TOWER_TOP]),
    towerTopEast: at([TOP_HALF, -TOP_HALF, TOWER_TOP]),
    towerTopNear: at([TOP_HALF, TOP_HALF, TOWER_TOP]),
    towerTopWest: at([-TOP_HALF, TOP_HALF, TOWER_TOP]),
  },
  edges: [
    ['towerEast', 'towerNear'],
    ['towerNear', 'towerWest'],
    ['towerEast', 'towerTopEast'],
    ['towerNear', 'towerTopNear'],
    ['towerWest', 'towerTopWest'],
    ['towerTopFar', 'towerTopEast'],
    ['towerTopEast', 'towerTopNear'],
    ['towerTopNear', 'towerTopWest'],
    ['towerTopWest', 'towerTopFar'],
  ],
  faces: [
    { points: ['towerTopFar', 'towerTopEast', 'towerTopNear', 'towerTopWest'], kind: 'roof' },
    { points: ['towerEast', 'towerNear', 'towerTopNear', 'towerTopEast'], kind: 'east' },
    { points: ['towerNear', 'towerWest', 'towerTopWest', 'towerTopNear'], kind: 'south' },
  ],
}

export const lighthouse = figureOf(
  'lighthouse',
  merge(
    tower,
    band('bandLow', 3.5),
    band('bandHigh', 7),
    faced(box('gallery', [-0.95, -0.95], [0.95, 0.95], 10.22, 9.98), 'wood'),
    // The lantern room wears the blue; its roof is the lamp's own colour.
    (() => {
      const room = tone(box('lantern', [-0.6, -0.6], [0.6, 0.6], 11.6, 10.22), 'blue')
      return { ...room, faces: (room.faces ?? []).map((f) => (f.kind === 'roof-blue' ? { ...f, kind: 'lamp' } : f)) }
    })(),
    // A small dome: three spokes up to a finial.
    {
      points: { finial: at([0, 0, 12.3]) },
      edges: [
        ['finial', 'lanternTopEast'],
        ['finial', 'lanternTopNear'],
        ['finial', 'lanternTopWest'],
      ],
      faces: [
        { points: ['lanternTopEast', 'lanternTopNear', 'finial'], kind: 'roof' },
        { points: ['lanternTopNear', 'lanternTopWest', 'finial'], kind: 'roof' },
      ],
    },
    tag(
      {
        points: { lhDoorL: at([-0.25, 1, 0]), lhDoorR: at([0.25, 1, 0]), lhDoorTR: at([0.25, 1, 0.95]), lhDoorTL: at([-0.25, 1, 0.95]) },
        edges: [
          ['lhDoorL', 'lhDoorTL'],
          ['lhDoorTL', 'lhDoorTR'],
          ['lhDoorTR', 'lhDoorR'],
        ],
        faces: [{ points: ['lhDoorL', 'lhDoorR', 'lhDoorTR', 'lhDoorTL'], kind: 'door' }],
      },
      'soft',
    ),
  ),
  'The lighthouse',
)
/** The lamp's centre, inside the lantern room. */
export const LAMP: Vec3 = [0, 0, 10.9]
export const LIGHTHOUSE_DOOR: Vec2 = [0, 1.5]

/** The light: a ring with a heart, flat, for the scene to put at `LAMP` and switch on. */
export const lamp = figureOf(
  'lamp',
  (() => {
    const names: string[] = []
    const points: Record<string, Vec2> = {}
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const name = `lamp${i}`
      names.push(name)
      points[name] = at([Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0])
    }
    points.lampCore = at([0, 0, 0])
    return { points, edges: names.map((n, i) => [n, names[(i + 1) % 8]!] as const) }
  })(),
  'The light',
  'lamp',
)

/** The beam: a wedge from the apex out along +x, for the scene to swing about the apex. */
export const beam = figureOf(
  'beam',
  tag(
    {
      points: { apex: at([0, 0, 0]), farA: at([9, -1.1, 0]), farB: at([9, 1.1, 0]) },
      edges: [
        ['apex', 'farA'],
        ['apex', 'farB'],
      ],
      faces: [{ points: ['apex', 'farA', 'farB'], kind: 'beam' }],
    },
    'soft',
  ),
  'The beam',
)

// ---------------------------------------------------------------------------------------------
// The dock

const DOCK_LENGTH = 4
const DOCK_HALF = 0.6
const DECK = 0.35

/**
 * The jetty laid along one direction: `along` maps a length coordinate to grid, so the same
 * points can be posed pointing east (+x, the rest), west (−x) or south (+y).
 */
const dockPoints = (along: (l: number, w: number) => [number, number]): Record<string, Vec2> => {
  const p = (l: number, w: number, z: number): Vec2 => {
    const [x, y] = along(l, w)
    return at([x, y, z])
  }
  const points: Record<string, Vec2> = {
    deckFar: p(0, -DOCK_HALF, DECK),
    deckEast: p(DOCK_LENGTH, -DOCK_HALF, DECK),
    deckNear: p(DOCK_LENGTH, DOCK_HALF, DECK),
    deckWest: p(0, DOCK_HALF, DECK),
    bollardFoot: p(DOCK_LENGTH - 0.4, -0.35, DECK),
    bollardTop: p(DOCK_LENGTH - 0.4, -0.35, DECK + 0.45),
  }
  ;[0.3, 2, 3.7].forEach((l, i) => {
    ;[-0.5, 0.5].forEach((w, j) => {
      points[`post${i}${j}Top`] = p(l, w, DECK)
      points[`post${i}${j}Foot`] = p(l, w, -0.3)
    })
  })
  return points
}

const dockEast = dockPoints((l, w) => [l, w])

export const dock = defineFigure('dock', {
  title: 'The dock',
  points: dockEast,
  edges: [
    { from: 'deckFar', to: 'deckEast', kind: 'wood' },
    { from: 'deckEast', to: 'deckNear', kind: 'wood' },
    { from: 'deckNear', to: 'deckWest', kind: 'wood' },
    { from: 'deckWest', to: 'deckFar', kind: 'wood' },
    { from: 'bollardFoot', to: 'bollardTop', kind: 'wood' },
    ...[0, 1, 2].flatMap((i) => [0, 1].map((j) => ({ from: `post${i}${j}Top`, to: `post${i}${j}Foot`, kind: 'wood' }))),
  ],
  faces: [{ points: ['deckFar', 'deckEast', 'deckNear', 'deckWest'], kind: 'wood' }],
  pointKinds: Object.fromEntries(Object.keys(dockEast).map((n) => [n, 'wood'])),
  poses: {
    east: {},
    west: dockPoints((l, w) => [-l, -w]),
    south: dockPoints((l, w) => [-w, l]),
  },
})
/** The shore end and the seaward end, in the rest pose (along +x). */
export const DOCK_ROOT: Vec2 = [0, 0]
export const DOCK_END: Vec2 = [DOCK_LENGTH, 0]

// ---------------------------------------------------------------------------------------------
// The hammock

const SAG = [1.4, 1.14, 1.0, 1.0, 1.14, 1.4]
const HX = [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5]

export const hammock = figureOf(
  'hammock',
  (() => {
    const points: Record<string, Vec2> = {}
    HX.forEach((x, i) => {
      points[`h${i}`] = at([x, 0, SAG[i]!])
    })
    // The canvas hangs a little below and in front of the rope line.
    ;[1, 2, 3, 4].forEach((i) => {
      points[`c${i}`] = at([HX[i]!, 0.42, SAG[i]! - 0.28])
    })
    return tag(
      {
        points,
        edges: [
          ...HX.slice(1).map((_x, i) => [`h${i}`, `h${i + 1}`] as const),
          ['h1', 'c1'],
          ['c1', 'c2'],
          ['c2', 'c3'],
          ['c3', 'c4'],
          ['c4', 'h4'],
        ],
        faces: [{ points: ['h1', 'h2', 'h3', 'h4', 'c4', 'c3', 'c2', 'c1'], kind: 'canvas' }],
      },
      'soft',
    )
  })(),
  'A hammock',
)
/** Where a lying figure's centre goes. */
export const HAMMOCK_LIE: Vec3 = [0, 0.15, 1.05]

// ---------------------------------------------------------------------------------------------
// The signboard nobody reads

export const signpost = figureOf(
  'signpost',
  merge(
    edge('post', [0, 0, 0], [0, 0, 1.95]),
    tag(
      {
        points: {
          boardA: at([0, -0.55, 1.15]),
          boardB: at([0, 0.55, 1.2]),
          boardC: at([0, 0.62, 1.9]),
          boardD: at([0, -0.48, 1.85]),
          barA0: at([0, -0.3, 1.28]),
          barA1: at([0, -0.3, 1.7]),
          barB0: at([0, 0.02, 1.3]),
          barB1: at([0, 0.02, 1.52]),
          barC0: at([0, 0.34, 1.32]),
          barC1: at([0, 0.34, 1.78]),
        },
        edges: [
          { from: 'boardA', to: 'boardB', kind: 'wood' },
          { from: 'boardB', to: 'boardC', kind: 'wood' },
          { from: 'boardC', to: 'boardD', kind: 'wood' },
          { from: 'boardD', to: 'boardA', kind: 'wood' },
          ['barA0', 'barA1'],
          ['barB0', 'barB1'],
          ['barC0', 'barC1'],
        ],
        faces: [{ points: ['boardA', 'boardB', 'boardC', 'boardD'], kind: 'wood' }],
      },
      'soft',
    ),
  ),
  'A dashboard nobody reads',
)
