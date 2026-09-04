import {
  defineFigure,
  definePose,
  defineScene,
  distance,
  jointBetween,
  lerpPoints,
  posePoints,
  type Keyframe,
  type Pose,
  type Vec2,
} from 'dotscene'
import { person } from './person.ts'

/** A sack of money, hanging from its tie at the origin so it sits wherever a hand is. */
export const moneybag = defineFigure('moneybag', {
  title: 'A bag of money',
  points: {
    tie: [0, 0],
    neckL: [-3, 3],
    neckR: [3, 3],
    sideL: [-7, 9],
    sideR: [7, 9],
    baseL: [-5, 16],
    baseR: [5, 16],
  },
  edges: [
    ['tie', 'neckL'],
    ['tie', 'neckR'],
    ['neckL', 'neckR'],
    ['neckL', 'sideL'],
    ['sideL', 'baseL'],
    ['baseL', 'baseR'],
    ['baseR', 'sideR'],
    ['sideR', 'neckR'],
  ],
})

/** A briefcase, hanging from the middle of its handle at the origin. */
export const briefcase = defineFigure('briefcase', {
  title: 'A briefcase',
  points: {
    gripL: [-4, 0],
    gripR: [4, 0],
    topL: [-10, 5],
    topR: [10, 5],
    botL: [-10, 16],
    botR: [10, 16],
  },
  edges: [
    ['gripL', 'gripR'],
    ['gripL', 'topL'],
    ['gripR', 'topR'],
    ['topL', 'topR'],
    ['topL', 'botL'],
    ['botL', 'botR'],
    ['botR', 'topR'],
  ],
})

/** The ground the two of them walk along. Never moves, so no keyframe mentions it. */
export const floor = defineFigure('floor', {
  points: { floorL: [-108, 64], floorR: [108, 64] },
  edges: [['floorL', 'floorR']],
})

const FLOOR = 64
/** Half a stride, in a figure's own units. Must match the foot separation in stepA/stepB. */
const HALF = 10
const CYCLE = ['stepA', 'passA', 'stepB', 'passB'] as const

// Close enough that the offered hands nearly touch, so the items pass hand to hand rather
// than floating across a gap — and close enough that stepping in to shake is a shuffle
// rather than a 12-unit glide with the legs held still.
const MEET = 23
// Close enough that a handshake is a bend of the elbow rather than a lunge: the clasp is
// 18 units from each figure's centre, against an arm that reaches about 20 from the shoulder.
const SHAKE = 18
/**
 * Where the two hands actually meet, in scene space. Both figures solve back from it.
 *
 * Roughly elbow height. Lower than this and the solved elbow has to drop past the hip for
 * the forearm to reach back up, which reads as a scoop rather than a handshake.
 */
const CLASP: Vec2 = [0, 27]

const TRADER_SCALE = 0.94
/** The trader is shorter and takes quicker, shorter steps — and starts mid-swing, so the
 * two never plant a foot on the same beat. */
const TRADER_RATE = 1.14
const TRADER_PHASE = 1.3


/**
 * The figure at an arbitrary point in the gait cycle, phase counted in half-strides.
 *
 * Interpolating between the four named poses is what frees each figure from the keyframe
 * grid: two people can then be caught at different points in their stride at the same
 * instant, and walk at different cadences, instead of marching in lockstep.
 *
 * Planting survives it. A foot's local x runs linearly from +HALF to -HALF across a
 * half-stride while the body advances HALF, so the foot holds one world position at every
 * phase in between, not just at the sampled ones.
 */
const gaitPose = (() => {
  const cache = new Map<string, Pose>()
  return (phase: number): Pose => {
    const wrapped = ((phase % 4) + 4) % 4
    const key = wrapped.toFixed(3)
    const cached = cache.get(key)
    if (cached !== undefined) return cached
    const index = Math.floor(wrapped)
    const points = lerpPoints(
      posePoints(person, CYCLE[index]!),
      posePoints(person, CYCLE[(index + 1) % 4]!),
      wrapped - index,
    )
    const pose = definePose(person, `gait${key}`, points)
    cache.set(key, pose)
    return pose
  }
})()

/**
 * A point on a scaled figure, in scene space.
 *
 * Scaling happens about the origin, so a figure drawn with its feet at y = FLOOR lifts off
 * the ground unless it is pushed back down by `FLOOR * (1 - scale)`. Everything hanging off
 * that figure — the bag, the briefcase — has to ride the same offset.
 */
const place = (x: number, local: Vec2, scale: number, flipX: boolean): Vec2 => [
  Math.round((x + (flipX ? -local[0] : local[0]) * scale) * 100) / 100,
  Math.round((local[1] * scale + FLOOR * (1 - scale)) * 100) / 100,
]

/** The figure's own arm segment lengths, so a solved elbow matches how it is drawn. */
const ARM = {
  upper: distance(person.points.shoulderR!, person.points.elbowR!),
  fore: distance(person.points.elbowR!, person.points.handR!),
}

/** A scene point expressed in the local frame of an unflipped part at `x` with `scale`. */
const toLocal = (world: Vec2, x: number, scale: number): Vec2 => [
  (world[0] - x) / scale,
  (world[1] - FLOOR * (1 - scale)) / scale,
]

/**
 * A figure reaching one hand to a point in the scene, elbow solved rather than guessed.
 *
 * Both figures in a handshake are given the same world target, which is the only way their
 * hands actually meet — they are different heights and scales, so a hand position that looks
 * right written into a shared pose lands somewhere else for the other one.
 *
 * `lean` tips the upper body towards the other person; the carrying arm rides along with it
 * so it stays attached to the shoulder.
 */
const reachPose = (label: string, side: 'R' | 'L', target: Vec2, x: number, scale: number, lean: number): Pose => {
  const base = posePoints(person, side === 'R' ? 'holdL' : 'holdR')
  const other = side === 'R' ? 'L' : 'R'
  const tip = (point: Vec2, amount: number): Vec2 => [point[0] + lean * amount, point[1]]

  const shoulder = tip(base[`shoulder${side}`]!, 0.8)
  const hand = toLocal(target, x, scale)

  return definePose(person, label, {
    ...base,
    head: tip(base.head!, 1.3),
    neck: tip(base.neck!, 1),
    chest: tip(base.chest!, 0.6),
    [`shoulder${side}`]: shoulder,
    [`shoulder${other}`]: tip(base[`shoulder${other}`]!, 0.8),
    [`elbow${other}`]: tip(base[`elbow${other}`]!, 0.8),
    [`hand${other}`]: tip(base[`hand${other}`]!, 0.8),
    // The elbow bows down and away from the body, the way a shaking arm hangs.
    [`elbow${side}`]: jointBetween(shoulder, hand, ARM.upper, ARM.fore, side === 'R' ? 1 : -1),
    [`hand${side}`]: hand,
  })
}

const TRADER_Y = FLOOR * (1 - TRADER_SCALE)

/**
 * One beat of the handshake: both figures reaching the same clasp point.
 *
 * Passing separate targets covers the approach, before their hands have met.
 */
const clasp = (
  name: string,
  target: Vec2 | { readonly walker: Vec2; readonly trader: Vec2 },
  timing: { duration: number; hold: number; easing?: Keyframe['easing'] },
): Keyframe => {
  const walkerTarget = 'walker' in target ? target.walker : target
  const traderTarget = 'walker' in target ? target.trader : target
  const walkerPose = reachPose(`${name}W`, 'R', walkerTarget, -SHAKE, 1, 2)
  const traderPose = reachPose(`${name}T`, 'L', traderTarget, SHAKE, TRADER_SCALE, -2)
  return {
    name,
    ...timing,
    parts: {
      walker: { at: [-SHAKE, 0], pose: walkerPose, flipX: false, scale: 1 },
      trader: { at: [SHAKE, TRADER_Y], pose: traderPose, flipX: false, scale: TRADER_SCALE },
      case: { at: place(-SHAKE, walkerPose.points.handL!, 1, false) },
      bag: { at: place(SHAKE, traderPose.points.handR!, TRADER_SCALE, false) },
    },
  }
}

/** A point from one of the standing poses, so items track the hand rather than a guess. */
const handOf = (pose: string, point: 'handL' | 'handR'): Vec2 => posePoints(person, pose)[point]!

/**
 * One person walking.
 *
 * `rate` is half-strides per keyframe — the cadence. `scale` sets both height and stride, so
 * a shorter figure covers less ground per step. `startPhase` decides which foot is down when
 * the scene opens. Between them, two movers on one shared timeline stop looking like one
 * figure mirrored.
 */
interface Mover {
  readonly id: 'walker' | 'trader'
  readonly carries: 'bag' | 'case'
  readonly scale: number
  readonly flipX: boolean
  readonly dir: 1 | -1
  readonly from: number
  readonly rate: number
  readonly startPhase: number
}

const advance = (m: Mover): number => m.dir * m.rate * HALF * m.scale

const moverParts = (m: Mover, i: number) => {
  const x = Math.round((m.from + advance(m) * i) * 100) / 100
  const pose = gaitPose(m.startPhase + i * m.rate)
  return {
    [m.id]: {
      at: [x, Math.round(FLOOR * (1 - m.scale) * 100) / 100] as Vec2,
      pose,
      flipX: m.flipX,
      scale: m.scale,
    },
    // The carried thing hangs off the arm that is not swinging, read straight from the
    // interpolated pose so it stays in the hand through the body's bob.
    [m.carries]: { at: place(x, pose.points.handR!, m.scale, m.flipX) },
  }
}

interface WalkOptions {
  readonly tag: string
  readonly samples: number
  readonly movers: readonly Mover[]
  readonly leadIn?: Keyframe['easing']
  readonly leadInMs?: number
}

/** Milliseconds per keyframe. One walker half-stride every 190ms is about 1.4 m/s here. */
const HALF_MS = 190

/**
 * Generate a leg of the journey.
 *
 * Every frame is `linear` with no hold: easing each step would make the walk pulse, since an
 * ease brings the body to a stop at every keyframe it passes through.
 */
const walk = ({ tag, samples, movers, leadIn, leadInMs }: WalkOptions): Keyframe[] =>
  Array.from({ length: samples + 1 }, (_unused, i) => ({
    name: `${tag}${i}`,
    duration: i === 0 ? (leadInMs ?? HALF_MS) : HALF_MS,
    hold: 0,
    easing: i === 0 && leadIn !== undefined ? leadIn : ('linear' as const),
    parts: Object.assign({}, ...movers.map((m) => moverParts(m, i))),
  }))

const IN_SAMPLES = 11
const OUT_SAMPLES = 16

const walkerIn: Mover = {
  id: 'walker',
  carries: 'bag',
  scale: 1,
  flipX: false,
  dir: 1,
  from: -MEET - IN_SAMPLES * HALF,
  rate: 1,
  startPhase: 0,
}
const traderIn: Mover = {
  id: 'trader',
  carries: 'case',
  scale: TRADER_SCALE,
  flipX: true,
  dir: -1,
  from: MEET + IN_SAMPLES * TRADER_RATE * HALF * TRADER_SCALE,
  rate: TRADER_RATE,
  startPhase: TRADER_PHASE,
}
const walkerOut: Mover = { ...walkerIn, carries: 'case', from: -SHAKE, startPhase: 0 }
const traderOut: Mover = { ...traderIn, carries: 'bag', from: SHAKE, startPhase: TRADER_PHASE }

/**
 * Two people meet, trade a bag of money for a briefcase, shake on it and walk on.
 *
 * The scene has an explicit viewBox because it needs somewhere to be off-stage: figures are
 * parked well outside it at the ends, and content is clipped to the viewBox.
 *
 * The first keyframe has `duration: 0` so the loop's wrap-around is a hard cut. Without it,
 * the last keyframe would tween back to the first and both figures would slide backwards
 * across the stage in full view.
 *
 * They walk in profile and turn to face each other to do business — the turn is just the
 * tween between a `flipX` walk pose and a front-facing one.
 */
export const scene = defineScene('exchange', {
  title: 'Two people trade a bag of money for a briefcase',
  viewBox: [-110, -6, 220, 76],
  parts: [
    { figure: floor },
    { figure: person, id: 'walker', pose: 'stepA', at: [walkerIn.from, 0] },
    {
      figure: person,
      id: 'trader',
      pose: 'stepA',
      at: [traderIn.from, FLOOR * (1 - TRADER_SCALE)],
      scale: TRADER_SCALE,
      flipX: true,
    },
    { figure: moneybag, id: 'bag', at: [walkerIn.from + 9, 38] },
    { figure: briefcase, id: 'case', at: [traderIn.from - 9, 38] },
  ],
  animate: {
    mode: 'loop',
    easing: 'easeInOut',
    keyframes: [
      // In: from off-stage to arm's length. The first frame is the loop's cut.
      ...walk({
        tag: 'in',
        samples: IN_SAMPLES,
        movers: [walkerIn, traderIn],
        leadIn: 'linear',
        leadInMs: 0,
      }),
      {
        // They stop walking and turn to face each other.
        name: 'meet',
        duration: 420,
        hold: 350,
        easing: 'easeOut',
        parts: {
          walker: { at: [-MEET, 0], pose: 'holdR', flipX: false, scale: 1 },
          trader: { at: [MEET, FLOOR * (1 - TRADER_SCALE)], pose: 'holdL', flipX: false, scale: TRADER_SCALE },
          bag: { at: place(-MEET, handOf('holdR', 'handR'), 1, false) },
          case: { at: place(MEET, handOf('holdL', 'handL'), TRADER_SCALE, false) },
        },
      },
      {
        name: 'offer',
        duration: 560,
        hold: 260,
        parts: {
          walker: { at: [-MEET, 0], pose: 'offerR', flipX: false, scale: 1 },
          trader: { at: [MEET, FLOOR * (1 - TRADER_SCALE)], pose: 'offerL', flipX: false, scale: TRADER_SCALE },
          bag: { at: place(-MEET, handOf('offerR', 'handR'), 1, false) },
          case: { at: place(MEET, handOf('offerL', 'handL'), TRADER_SCALE, false) },
        },
      },
      {
        // The exchange itself: arms stay out, the two items cross into the other hand.
        name: 'swap',
        duration: 520,
        hold: 260,
        parts: {
          walker: { at: [-MEET, 0], pose: 'offerR', flipX: false, scale: 1 },
          trader: { at: [MEET, FLOOR * (1 - TRADER_SCALE)], pose: 'offerL', flipX: false, scale: TRADER_SCALE },
          bag: { at: place(MEET, handOf('offerL', 'handL'), TRADER_SCALE, false) },
          case: { at: place(-MEET, handOf('offerR', 'handR'), 1, false) },
        },
      },
      {
        // Each moves the new item to their outer hand, freeing the inner one.
        name: 'taken',
        duration: 460,
        hold: 220,
        parts: {
          walker: { at: [-MEET, 0], pose: 'holdL', flipX: false, scale: 1 },
          trader: { at: [MEET, FLOOR * (1 - TRADER_SCALE)], pose: 'holdR', flipX: false, scale: TRADER_SCALE },
          case: { at: place(-MEET, handOf('holdL', 'handL'), 1, false) },
          bag: { at: place(MEET, handOf('holdR', 'handR'), TRADER_SCALE, false) },
        },
      },
      // The handshake. They step in, meet, pump three times with the swing damping out,
      // and settle — a single held pose reads as two people frozen mid-reach.
      clasp(
        'reach',
        { walker: [-7, 26], trader: [7, 27.5] },
        { duration: 420, hold: 60, easing: 'easeOut' },
      ),
      clasp('clasp', CLASP, { duration: 240, hold: 140 }),
      clasp('pumpDown', [0, 29.5], { duration: 170, hold: 0, easing: 'easeInOut' }),
      clasp('pumpUp', [0, 24.5], { duration: 180, hold: 0, easing: 'easeInOut' }),
      clasp('pumpDown2', [0, 28.5], { duration: 170, hold: 0, easing: 'easeInOut' }),
      clasp('settle', [0, 26.5], { duration: 190, hold: 380, easing: 'easeOut' }),
      // Out: past each other and off the far sides, each carrying what they were handed.
      ...walk({
        tag: 'out',
        samples: OUT_SAMPLES,
        movers: [walkerOut, traderOut],
        leadIn: 'easeIn',
        leadInMs: 420,
      }),
    ],
  },
})
