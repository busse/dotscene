/**
 * Vehicles and handling gear for the EDI hero: the rig that runs the route, a delivery van
 * for traffic, the forklift that loads and unloads, and the pallet it carries.
 *
 * Everything that drives is authored twice over one set of point names — laid along grid x
 * and laid along grid y — so an act can switch orientation at a corner with a one-millisecond
 * tween. The two layouts are the same shape with the two grid coordinates swapped, which is
 * what `g` below does: a figure is written once in (along, across, z) and mapped onto whichever
 * axis it travels.
 *
 * Every figure is centred on grid (0, 0) with its base at z = 0; the scene places it by
 * translating the part, which works because the projection is affine.
 */

import { defineFigure, type Vec2, type Vec3 } from 'dotscene'
import { at, box, edge, pad } from '../projection.ts'
import { merge, tag, tone, type Shape } from '../../iso.ts'

type Axis = 'x' | 'y'

/** (along, across, z) → grid cell, for a figure travelling along `axis`. */
const g =
  (axis: Axis) =>
  (along: number, across: number, z: number): Vec3 =>
    axis === 'x' ? [along, across, z] : [across, along, z]

/** A box footprint spanning `a0..a1` along the travel axis and `c0..c1` across it. */
const span =
  (axis: Axis) =>
  (a0: number, c0: number, a1: number, c1: number): readonly [Vec2, Vec2] =>
    axis === 'x'
      ? [
          [a0, c0],
          [a1, c1],
        ]
      : [
          [c0, a0],
          [c1, a1],
        ]

/**
 * A wheel: a short vertical stroke on the visible side, from the ground to the deck. Two dots
 * that nearly touch read as a tyre at this size; a ring would be a blob.
 */
const wheel = (axis: Axis, name: string, along: number, across: number, deck: number): Shape =>
  tag(edge(name, g(axis)(along, across, 0), g(axis)(along, across, deck)), 'wheel')

// ---------------------------------------------------------------------------------------------
// The rig

const TRAILER_LENGTH = 2.6
const TRAILER_HALF_WIDTH = 0.55
const TRAILER_DECK = 0.5
const TRAILER_TOP = 2.9
const CAB_LENGTH = 0.9
const CAB_HALF_WIDTH = 0.5
const CAB_TOP = 2.2
const CAB_GAP = 0.1

/** Rear face of the trailer, along the travel axis. Negative: it is behind the origin. */
export const RIG_REAR = -1.8
/** Front of the cab to the rear of the trailer. */
export const RIG_LENGTH = TRAILER_LENGTH + CAB_GAP + CAB_LENGTH
const CAB_FRONT = RIG_REAR + RIG_LENGTH

/** The rig's rear centre, at deck height, relative to its origin — where a dock door meets it. */
export const rigAnchor = (axis: Axis, dir: 1 | -1 = 1): Vec3 => g(axis)(RIG_REAR * dir, 0, TRAILER_DECK)

/**
 * The rig laid along one axis, cab at the +along end for `dir` 1 and at the −along end for
 * `dir` −1, so it can drive back the way it came with the cab still leading. A box names its
 * corners by grid position, so the reversed layout keeps every point name and only moves them.
 */
const rigShape = (axis: Axis, dir: 1 | -1 = 1): Shape => {
  const s = (a0: number, c0: number, a1: number, c1: number) =>
    dir > 0 ? span(axis)(a0, c0, a1, c1) : span(axis)(-a1, c0, -a0, c1)
  const p = (along: number, across: number, z: number) => g(axis)(along * dir, across, z)
  const trailerFront = RIG_REAR + TRAILER_LENGTH
  const cabRear = trailerFront + CAB_GAP
  return merge(
    tag(box('trailer', ...s(RIG_REAR, -TRAILER_HALF_WIDTH, trailerFront, TRAILER_HALF_WIDTH), TRAILER_TOP, TRAILER_DECK), 'vehicle'),
    tone(tag(box('cab', ...s(cabRear, -CAB_HALF_WIDTH, CAB_FRONT, CAB_HALF_WIDTH), CAB_TOP, TRAILER_DECK), 'vehicle'), 'blue'),
    // The windshield's sill, across the front of the cab.
    tag(edge('windshield', p(CAB_FRONT, -CAB_HALF_WIDTH, 1.15), p(CAB_FRONT, CAB_HALF_WIDTH, 1.15)), 'soft'),
    wheel(axis, 'wheelRear', (RIG_REAR + 0.45) * dir, TRAILER_HALF_WIDTH, TRAILER_DECK),
    wheel(axis, 'wheelMid', (RIG_REAR + 0.85) * dir, TRAILER_HALF_WIDTH, TRAILER_DECK),
    wheel(axis, 'wheelFront', (CAB_FRONT - 0.25) * dir, CAB_HALF_WIDTH, TRAILER_DECK),
  )
}

const rigX = rigShape('x')
const rigY = rigShape('y')

/** Orientation poses: the axis the rig lies along, and `r` when its cab points the other way. */
export type Heading = 'x' | 'y' | 'xr' | 'yr'

export const rig = defineFigure('rig', {
  title: 'A tractor-trailer',
  points: rigX.points,
  edges: rigX.edges,
  faces: rigX.faces ?? [],
  pointKinds: rigX.kinds ?? {},
  poses: {
    x: {},
    y: rigY.points,
    xr: rigShape('x', -1).points,
    yr: rigShape('y', -1).points,
  },
})

// ---------------------------------------------------------------------------------------------
// The van

const VAN_LENGTH = 1.4
const VAN_HALF_WIDTH = 0.4
const VAN_DECK = 0.3
const VAN_TOP = 1.5

/** The van's rear centre at deck height, relative to its origin. */
export const vanAnchor = (axis: Axis): Vec3 => g(axis)(-VAN_LENGTH / 2, 0, VAN_DECK)

const vanShape = (axis: Axis, dir: 1 | -1 = 1): Shape => {
  const s = span(axis)
  const p = (along: number, across: number, z: number) => g(axis)(along * dir, across, z)
  const front = VAN_LENGTH / 2
  return merge(
    tag(box('van', ...s(-front, -VAN_HALF_WIDTH, front, VAN_HALF_WIDTH), VAN_TOP, VAN_DECK), 'vehicle'),
    tag(edge('vanShield', p(front, -VAN_HALF_WIDTH, 0.95), p(front, VAN_HALF_WIDTH, 0.95)), 'soft'),
    wheel(axis, 'vanWheelRear', (-front + 0.35) * dir, VAN_HALF_WIDTH, VAN_DECK),
    wheel(axis, 'vanWheelFront', (front - 0.3) * dir, VAN_HALF_WIDTH, VAN_DECK),
  )
}

const vanX = vanShape('x')
const vanY = vanShape('y')

export const van = defineFigure('van', {
  title: 'A delivery van',
  points: vanX.points,
  edges: vanX.edges,
  faces: vanX.faces ?? [],
  pointKinds: vanX.kinds ?? {},
  poses: {
    x: {},
    y: vanY.points,
    xr: vanShape('x', -1).points,
    yr: vanShape('y', -1).points,
  },
})

// ---------------------------------------------------------------------------------------------
// The forklift

const LIFT_LENGTH = 1.0
const LIFT_HALF_WIDTH = 0.35
const LIFT_BODY_TOP = 0.9
const CAGE_TOP = 1.9
const FORK_REACH = 0.8
const FORK_HALF = 0.2
const FORK_LOW = 0.1
const FORK_HIGH = 1.2

/** Grid position of the fork tips' centre, relative to the figure origin. */
export const FORK_TIP = (axis: Axis, high: boolean, dir: 1 | -1 = 1): Vec3 =>
  g(axis)((LIFT_LENGTH / 2 + FORK_REACH) * dir, 0, high ? FORK_HIGH : FORK_LOW)

/** Where a carried pallet's centre sits: halfway along the tines, on top of them. */
export const FORK_CENTRE = (axis: Axis, high: boolean, dir: 1 | -1 = 1): Vec3 =>
  g(axis)((LIFT_LENGTH / 2 + FORK_REACH / 2) * dir, 0, high ? FORK_HIGH : FORK_LOW)

/**
 * The forklift is a low body under a cage: the overhead guard is the body's own footprint
 * lifted to the top of the mast and stood on three posts, so the two front posts *are* the
 * mast. Anything more detailed than that is a blob at this size.
 */
const forkliftShape = (axis: Axis, high: boolean, dir: 1 | -1 = 1): Shape => {
  const s = span(axis)
  const p = (along: number, across: number, z: number) => g(axis)(along * dir, across, z)
  const front = LIFT_LENGTH / 2
  const forkZ = high ? FORK_HIGH : FORK_LOW
  const footprint = s(-front, -LIFT_HALF_WIDTH, front, LIFT_HALF_WIDTH)
  return merge(
    tag(box('liftBody', ...footprint, LIFT_BODY_TOP), 'vehicle'),
    // The guard is a slab seen from above, so it paints as a roof rather than as a yard.
    (() => {
      const cage = tag(pad('cage', ...footprint, CAGE_TOP), 'vehicle')
      return { ...cage, faces: (cage.faces ?? []).map((f) => ({ ...f, kind: 'roof' })) }
    })(),
    {
      points: {},
      edges: [
        { from: 'liftBodyTopEast', to: 'cageEast', kind: 'vehicle' },
        { from: 'liftBodyTopNear', to: 'cageNear', kind: 'vehicle' },
        { from: 'liftBodyTopWest', to: 'cageWest', kind: 'vehicle' },
      ],
    },
    // The driver: head, shoulder, and a hand forward on the wheel.
    tag(
      {
        points: {
          driverHead: at(p(-0.12, 0, 1.36)),
          driverShoulder: at(p(-0.12, 0, 1.08)),
          driverHand: at(p(0.22, 0, 1.12)),
        },
        edges: [
          ['driverHead', 'driverShoulder'],
          ['driverShoulder', 'driverHand'],
        ],
      },
      'vehicle',
    ),
    // The forks, reaching out past the front.
    tag(edge('tineL', p(front, -FORK_HALF, forkZ), p(front + FORK_REACH, -FORK_HALF, forkZ)), 'soft'),
    tag(edge('tineR', p(front, FORK_HALF, forkZ), p(front + FORK_REACH, FORK_HALF, forkZ)), 'soft'),
  )
}

const liftXLow = forkliftShape('x', false)

/** Forks along +x or +y, or reversed (`r`), low or high. */
export const forklift = defineFigure('forklift', {
  title: 'A forklift',
  points: liftXLow.points,
  edges: liftXLow.edges,
  faces: liftXLow.faces ?? [],
  pointKinds: liftXLow.kinds ?? {},
  poses: {
    x: {},
    xLow: {},
    xHigh: forkliftShape('x', true).points,
    y: forkliftShape('y', false).points,
    yLow: forkliftShape('y', false).points,
    yHigh: forkliftShape('y', true).points,
    xrLow: forkliftShape('x', false, -1).points,
    xrHigh: forkliftShape('x', true, -1).points,
    yrLow: forkliftShape('y', false, -1).points,
    yrHigh: forkliftShape('y', true, -1).points,
  },
})

// ---------------------------------------------------------------------------------------------
// The pallet

const PALLET_HALF = 0.45
const LOWER_HALF = 0.4
const LOWER_TOP = 0.6
const UPPER_HALF = 0.28
/** Top of the upper box. */
export const PALLET_HEIGHT = 1.05

/**
 * The pallet itself is only its two visible rim edges: a full pad would put a dot at its far
 * corner, which sits behind the boxes and would show through their roof.
 */
const palletRim: Shape = {
  points: {
    palletEast: at([PALLET_HALF, -PALLET_HALF, 0]),
    palletNear: at([PALLET_HALF, PALLET_HALF, 0]),
    palletWest: at([-PALLET_HALF, PALLET_HALF, 0]),
  },
  edges: [
    ['palletEast', 'palletNear'],
    ['palletNear', 'palletWest'],
  ],
}

const palletShape: Shape = merge(
  tag(palletRim, 'soft'),
  tone(box('boxLower', [-LOWER_HALF, -LOWER_HALF], [LOWER_HALF, LOWER_HALF], LOWER_TOP, 0.05), 'kraft'),
  tone(
    box('boxUpper', [-UPPER_HALF - 0.06, -UPPER_HALF + 0.08], [UPPER_HALF - 0.06, UPPER_HALF + 0.08], PALLET_HEIGHT, LOWER_TOP),
    'kraft',
  ),
)

export const pallet = defineFigure('pallet', {
  title: 'A pallet of boxes',
  points: palletShape.points,
  edges: palletShape.edges,
  faces: palletShape.faces ?? [],
  pointKinds: palletShape.kinds ?? {},
})
