/**
 * The misfits: six applications nobody wanted, each with a visible quirk and a pose in which
 * the quirk is put right. The Island of Misfit Toys, as software.
 *
 * Every figure is authored centred on grid (0, 0) with its base at z 0 and its front on the
 * +y wall — lower-left on screen — so a visitor approaches it the way a rig approaches a dock.
 * Whole-body motion is the part's business (`at`, `rotate`, `scale`); poses change only what
 * changes shape, and keep every point name.
 */

import { defineFigure, type Vec2, type Vec3 } from 'dotscene'
import { at, box, edge, pad } from '../../edi/projection.ts'
import { merge, tag, tone, type Shape } from '../../iso.ts'

type Points = Record<string, Vec2>

const round2 = (n: number): number => Math.round(n * 100) / 100

/** A ring of `n` points on a circle standing in the x–z plane at one y — a reel, a clock. */
const ringXZ = (prefix: string, centre: Vec3, r: number, n = 8, start = 90): Shape => {
  const points: Points = {}
  const edges: (readonly [string, string])[] = []
  for (let i = 0; i < n; i++) {
    const a = ((start + (360 / n) * i) * Math.PI) / 180
    points[`${prefix}${i}`] = at([centre[0] + Math.cos(a) * r, centre[1], centre[2] + Math.sin(a) * r])
    edges.push([`${prefix}${i}`, `${prefix}${(i + 1) % n}`])
  }
  return { points, edges }
}

/** A ring lying flat on the ground plane at height z — the rim of a drum. */
const ringXY = (prefix: string, centre: Vec3, r: number, n = 8): Shape => {
  const points: Points = {}
  const edges: (readonly [string, string])[] = []
  for (let i = 0; i < n; i++) {
    const a = ((360 / n) * i * Math.PI) / 180
    points[`${prefix}${i}`] = at([centre[0] + Math.cos(a) * r, centre[1] + Math.sin(a) * r, centre[2]])
    edges.push([`${prefix}${i}`, `${prefix}${(i + 1) % n}`])
  }
  return { points, edges }
}

/** A lone point: an indicator light, an eye. */
const dot = (name: string, cell: Vec3): Shape => ({ points: { [name]: at(cell) }, edges: [] })

/** Rename a shape's face kinds wholesale. */
const facesAs = (shape: Shape, kind: string): Shape => ({ ...shape, faces: (shape.faces ?? []).map((f) => ({ ...f, kind })) })

const figureFrom = (name: string, title: string, rest: Shape, poses: Record<string, Shape>) =>
  defineFigure(name, {
    title,
    points: rest.points,
    edges: rest.edges,
    faces: rest.faces ?? [],
    pointKinds: rest.kinds ?? {},
    ...(rest.layers === undefined || rest.layers.length < 2 ? {} : { layers: rest.layers }),
    poses: { ...Object.fromEntries(Object.entries(poses).map(([n, s]) => [n, s.points])) },
  })

// ---------------------------------------------------------------------------------------------
// 1. The mainframe — the train with square wheels

const CAB: readonly [Vec2, Vec2] = [
  [-0.8, -0.5],
  [0.8, 0.5],
]
const WHEEL_CORNERS: readonly Vec2[] = [
  [-0.6, -0.3],
  [0.6, -0.3],
  [-0.6, 0.3],
  [0.6, 0.3],
]

/** One wheel: a 0.3 cube under a corner, or the same seven points on a circle. */
const wheel = (prefix: string, [cx, cy]: Vec2, roundWheel: boolean): Shape => {
  if (!roundWheel) {
    return tag(box(prefix, [cx - 0.15, cy - 0.15], [cx + 0.15, cy + 0.15], 0, -0.3), 'metal')
  }
  // Six rim points and the near-top corner as the hub: the box's edges become a rim and
  // three spokes, and its three faces become wedges that fill the disc between them.
  const r = 0.19
  const cz = -0.15
  const rim = (deg: number): Vec2 => at([cx + Math.cos((deg * Math.PI) / 180) * r, cy, cz + Math.sin((deg * Math.PI) / 180) * r])
  const shape: Shape = {
    points: {
      [`${prefix}TopWest`]: rim(180),
      [`${prefix}TopFar`]: rim(120),
      [`${prefix}TopEast`]: rim(60),
      [`${prefix}East`]: rim(0),
      [`${prefix}Near`]: rim(-60),
      [`${prefix}West`]: rim(-120),
      [`${prefix}TopNear`]: at([cx, cy, cz]),
    },
    edges: [
      [`${prefix}East`, `${prefix}Near`],
      [`${prefix}Near`, `${prefix}West`],
      [`${prefix}East`, `${prefix}TopEast`],
      [`${prefix}Near`, `${prefix}TopNear`],
      [`${prefix}West`, `${prefix}TopWest`],
      [`${prefix}TopFar`, `${prefix}TopEast`],
      [`${prefix}TopEast`, `${prefix}TopNear`],
      [`${prefix}TopNear`, `${prefix}TopWest`],
      [`${prefix}TopWest`, `${prefix}TopFar`],
    ],
    faces: [
      { points: [`${prefix}TopFar`, `${prefix}TopEast`, `${prefix}TopNear`, `${prefix}TopWest`], kind: 'roof' },
      { points: [`${prefix}East`, `${prefix}Near`, `${prefix}TopNear`, `${prefix}TopEast`], kind: 'east' },
      { points: [`${prefix}Near`, `${prefix}West`, `${prefix}TopWest`, `${prefix}TopNear`], kind: 'south' },
    ],
  }
  return tag(shape, 'metal')
}

const mainframeShape = (roundWheels: boolean): Shape =>
  merge(
    // Far wheels, then near, then the cabinet over them, then what sits on its walls.
    wheel('w0', WHEEL_CORNERS[0]!, roundWheels),
    wheel('w1', WHEEL_CORNERS[1]!, roundWheels),
    wheel('w2', WHEEL_CORNERS[2]!, roundWheels),
    wheel('w3', WHEEL_CORNERS[3]!, roundWheels),
    tone(box('cab', CAB[0], CAB[1], 2.0), 'kraft'),
    tag(merge(ringXZ('reelL', [-0.38, 0.5, 1.2], 0.28), ringXZ('reelR', [0.38, 0.5, 1.2], 0.28)), 'soft'),
    tag(merge(dot('lamp0', [-0.45, 0.5, 1.78]), dot('lamp1', [0, 0.5, 1.78]), dot('lamp2', [0.45, 0.5, 1.78])), 'blue'),
    // The socket on the +x wall: a short mark where a cable plugs in.
    tag(edge('port', [0.8, -0.12, 0.9], [0.8, 0.12, 0.9]), 'blue'),
  )

/** Where a cable plugs into the mainframe, on its +x wall. */
export const MAINFRAME_PORT: Vec3 = [0.8, 0, 0.9]

export const mainframe = figureFrom('mainframe', 'The mainframe, on square wheels', mainframeShape(false), {
  square: mainframeShape(false),
  round: mainframeShape(true),
})

// ---------------------------------------------------------------------------------------------
// 2. The spreadsheet — a stack of sheets that thinks it is a database

const SHEETS = 5
const SHEET_STEP = 0.4

/** The stack, each sheet slid by `lean` times its index. */
const spreadsheetShape = (lean: number): Shape =>
  merge(
    ...Array.from({ length: SHEETS }, (_u, i) => {
      const dx = round2(-0.12 * i * lean)
      const dy = round2(0.06 * i * lean)
      const z = 0.05 + i * SHEET_STEP
      const sheet = facesAs(pad(`s${i}`, [dx - 0.6, dy - 0.5], [dx + 0.6, dy + 0.5], z), 'paper')
      const rules = tag(
        merge(
          edge(`s${i}g`, [dx - 0.2, dy - 0.5, z], [dx - 0.2, dy + 0.5, z]),
          edge(`s${i}h`, [dx - 0.6, dy + 0.15, z], [dx + 0.6, dy + 0.15, z]),
        ),
        'soft',
      )
      return merge(tag(sheet, 'soft'), rules)
    }),
  )

/** The stack's footprint centre, on the ground. */
export const SPREADSHEET_BASE: Vec3 = [0, 0, 0]

export const spreadsheet = figureFrom('spreadsheet', 'A spreadsheet that thinks it is a database', spreadsheetShape(1), {
  rest: spreadsheetShape(1),
  leanA: spreadsheetShape(1.6),
  leanB: spreadsheetShape(-0.4),
  straight: spreadsheetShape(0),
})

/** A database: a drum, two rims and the wall between their near halves. */
const DRUM_R = 0.75
const DRUM_H = 0.9

const drumShape: Shape = (() => {
  const bottom = tag(ringXY('bot', [0, 0, 0], DRUM_R), 'metal')
  const top = tag(ringXY('top', [0, 0, DRUM_H], DRUM_R), 'metal')
  // The near arc runs from −45° through 45° to 135°: indices 7, 0, 1, 2, 3.
  const near = [7, 0, 1, 2, 3]
  const wall: Shape = {
    points: {},
    edges: [
      { from: 'top7', to: 'bot7', kind: 'metal' },
      { from: 'top3', to: 'bot3', kind: 'metal' },
    ],
    // First point on the top rim, so the wall paints after the bottom rim and hides its far arc.
    faces: [
      { points: [...near.map((i) => `top${i}`), ...[...near].reverse().map((i) => `bot${i}`)], kind: 'east-blue' },
      { points: Object.keys(top.points), kind: 'metal' },
    ],
  }
  return merge(bottom, { ...top, faces: wall.faces, edges: [...top.edges, ...wall.edges] })
})()

/** The top of the drum, where sheets are dropped in. */
export const DRUM_TOP: Vec3 = [0, 0, DRUM_H]

export const drum = defineFigure('drum', {
  title: 'A database',
  points: drumShape.points,
  edges: drumShape.edges,
  faces: drumShape.faces ?? [],
  pointKinds: drumShape.kinds ?? {},
  layers: drumShape.layers ?? [],
})

// ---------------------------------------------------------------------------------------------
// 3. The fax — a fax-to-email bridge

const faxShape = (sending: boolean): Shape => {
  const curl: readonly Vec3[] = sending
    ? [
        [0, 0.05, 0.45],
        [0, 0.08, 0.95],
        [0, 0.12, 1.4],
        [0, 0.2, 1.75],
      ]
    : [
        [0, 0.05, 0.45],
        [0, 0.15, 0.85],
        [0, 0.35, 1.0],
        [0, 0.55, 0.85],
      ]
  const page: Shape = {
    points: Object.fromEntries(curl.map((c, i) => [`page${i}`, at(c)])),
    edges: [
      ['page0', 'page1'],
      ['page1', 'page2'],
      ['page2', 'page3'],
    ],
  }
  return merge(
    tone(box('faxBack', [-0.45, -0.35], [0.45, -0.1], 0.7), 'shed'),
    tone(box('fax', [-0.45, -0.1], [0.45, 0.35], 0.45), 'shed'),
    tag(edge('slot', [-0.3, 0.05, 0.45], [0.3, 0.05, 0.45]), 'soft'),
    tag(page, 'soft'),
    tag(
      {
        points: { handA: at([-0.3, -0.22, 0.75]), handB: at([0, -0.22, 0.95]), handC: at([0.3, -0.22, 0.75]) },
        edges: [
          ['handA', 'handB'],
          ['handB', 'handC'],
        ],
      },
      'soft',
    ),
  )
}

/** Where a page leaves the fax. */
export const FAX_SLOT: Vec3 = [0, 0.05, 0.45]

export const fax = figureFrom('fax', 'A fax-to-email bridge', faxShape(false), {
  rest: faxShape(false),
  sending: faxShape(true),
})

// ---------------------------------------------------------------------------------------------
// 4. The cron job — "temporary", twelve years ago

interface CronPose {
  /** Height of the body's base. */
  readonly seat: number
  readonly legs: 'apart' | 'together' | 'folded'
  readonly beard: 'long' | 'short'
}

const cronShape = ({ seat, legs, beard }: CronPose): Shape => {
  const top = seat + 0.9
  const legX: readonly [number, number] = legs === 'together' ? [-0.03, 0.03] : [-0.27, 0.27]
  const leg = (name: string, x: number): Shape =>
    legs === 'folded'
      ? edge(name, [x, 0.25, seat], [x, 0.55, 0.05])
      : edge(name, [x, 0.1, 0], [x, 0.1, seat])
  const tipZ = beard === 'long' ? seat - 0.95 : seat - 0.15
  const strands = merge(
    ...[-0.28, -0.14, 0, 0.14, 0.28].map((x, i) => {
      const kink = (i % 2 === 0 ? 1 : -1) * 0.06
      const mid: Vec3 = [x + kink, 0.25, (seat + tipZ) / 2]
      return merge(edge(`beard${i}a`, [x, 0.25, seat], mid), edge(`beard${i}b`, mid, [x, 0.25, tipZ]))
    }),
  )
  const clock = merge(
    ringXZ('clock', [0, 0.25, seat + 0.55], 0.24),
    edge('handH', [0, 0.25, seat + 0.55], [0.14, 0.25, seat + 0.55]),
    edge('handM', [0, 0.25, seat + 0.55], [0, 0.25, seat + 0.73]),
  )
  return merge(
    tag(merge(leg('legL', legX[0]), leg('legR', legX[1])), 'metal'),
    tone(box('job', [-0.35, -0.25], [0.35, 0.25], top, seat), 'warm'),
    tag(clock, 'soft'),
    tag(strands, 'soft'),
  )
}

/** Where an owner's badge pins on, on the +x wall. */
export const CRON_BADGE: Vec3 = [0.35, 0, 1.15]

const cronRest: CronPose = { seat: 0.45, legs: 'apart', beard: 'long' }

export const cron = figureFrom('cron', 'The temporary job, with a beard', cronShape(cronRest), {
  rest: cronShape(cronRest),
  stepA: cronShape({ seat: 0.45, legs: 'together', beard: 'long' }),
  stepB: cronShape({ seat: 0.45, legs: 'apart', beard: 'long' }),
  trim: cronShape({ seat: 0.45, legs: 'apart', beard: 'short' }),
  sit: cronShape({ seat: 0.15, legs: 'folded', beard: 'short' }),
})

// ---------------------------------------------------------------------------------------------
// 5. The chatbot — a screen on a pole that knows one answer

type Mouth = 'flat' | 'open' | 'smile'

const chatbotShape = (mouth: Mouth): Shape => {
  const [zL, zM, zR]: [number, number, number] =
    mouth === 'open' ? [1.62, 1.5, 1.62] : mouth === 'smile' ? [1.67, 1.56, 1.67] : [1.62, 1.62, 1.62]
  const screen = box('scr', [-0.5, -0.04], [0.5, 0.04], 2.1, 1.4)
  const lit: Shape = { ...screen, faces: (screen.faces ?? []).map((f) => (f.kind === 'south' ? { ...f, kind: 'screen' } : f)) }
  const face: Shape = {
    points: {
      eyeL: at([-0.2, 0.04, 1.85]),
      eyeR: at([0.2, 0.04, 1.85]),
      mouthL: at([-0.2, 0.04, zL]),
      mouthM: at([0, 0.04, zM]),
      mouthR: at([0.2, 0.04, zR]),
    },
    edges: [
      ['mouthL', 'mouthM'],
      ['mouthM', 'mouthR'],
    ],
  }
  return merge(
    tag(edge('pole', [0, 0, 0], [0, 0, 1.4]), 'metal'),
    tag(lit, 'soft'),
    tag(edge('aerial', [0.4, 0, 2.1], [0.4, 0, 2.38]), 'blue'),
    tag(face, 'blue'),
  )
}

/** Where a speech bubble's tail starts. */
export const CHATBOT_MOUTH: Vec3 = [0, 0.04, 1.62]
/** Where a cable plugs in: low on the pole. */
export const CHATBOT_PORT: Vec3 = [0, 0, 0.35]

export const chatbot = figureFrom('chatbot', 'A chatbot with one answer', chatbotShape('flat'), {
  rest: chatbotShape('flat'),
  talk: chatbotShape('open'),
  happy: chatbotShape('smile'),
})

// ---------------------------------------------------------------------------------------------
// 6. A speech bubble — screen-facing, in scene units

/** Width and height of the bubble's body. */
export const BUBBLE_SIZE: Vec2 = [9, 6]

const bubblePoints: Points = {
  b0: [-3.3, -3],
  b1: [3.3, -3],
  b2: [4.5, -1.8],
  b3: [4.5, 1.8],
  b4: [3.3, 3],
  b5: [-1.6, 3],
  tail: [-3.2, 5.4],
  b6: [-3.3, 3],
  b7: [-4.5, 1.8],
  b8: [-4.5, -1.8],
}
const bubbleOrder = ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'tail', 'b6', 'b7', 'b8']

export const bubble = defineFigure('bubble', {
  title: 'A speech bubble',
  points: bubblePoints,
  edges: bubbleOrder.map((n, i) => ({ from: n, to: bubbleOrder[(i + 1) % bubbleOrder.length]!, kind: 'blue' })),
  faces: [{ points: bubbleOrder, kind: 'bubble' }],
  pointKinds: Object.fromEntries(bubbleOrder.map((n) => [n, 'blue'])),
})

// ---------------------------------------------------------------------------------------------
// An owner's badge — a pennant on a pin

export const badgeFlag = defineFigure('badgeFlag', {
  title: 'An owner\'s badge',
  points: {
    pinA: at([0, 0, 0]),
    pinB: at([0, 0, 0.5]),
    tip: at([0.35, 0, 0.42]),
    low: at([0, 0, 0.32]),
  },
  edges: [
    { from: 'pinA', to: 'pinB', kind: 'blue' },
    { from: 'pinB', to: 'tip', kind: 'blue' },
    { from: 'tip', to: 'low', kind: 'blue' },
  ],
  faces: [{ points: ['pinB', 'tip', 'low'], kind: 'flag' }],
  pointKinds: { pinA: 'blue', pinB: 'blue', tip: 'blue', low: 'blue' },
})
