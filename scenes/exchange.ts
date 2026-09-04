import { defineFigure, defineScene, type Keyframe } from 'dotscene'
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

// The figures always mirror each other, so one x describes both: the walker sits at +x and
// the trader at -x. STRIDE is the distance the body covers between one foot landing and the
// other, and it has to match the foot separation in `person`'s stepA/stepB poses exactly —
// that is what keeps the planted foot from sliding along the ground.
const STRIDE = 20
/** Milliseconds per half-stride. 20 units every 190ms is about 1.4 m/s at this scale. */
const HALF_MS = 190

const MEET = 30
const SHAKE = 24
const HAND = 12
const HAND_Y = 35
/** Where the hanging hand is in the walk poses — lower at contact, because the body dips. */
const WALK_HAND_X = 9
const WALK_HAND_Y = { contact: 38, pass: 35 } as const

const rightHand = (x: number): readonly [number, number] => [x + HAND, HAND_Y]
const leftHand = (x: number): readonly [number, number] => [x - HAND, HAND_Y]

interface WalkOptions {
  readonly tag: string
  /** The walker's x at the start and end. The trader mirrors it. */
  readonly from: number
  readonly to: number
  readonly steps: number
  readonly walkerCarries: 'bag' | 'case'
  readonly traderCarries: 'bag' | 'case'
  /** Easing for the transition into the first frame — where the walk starts or resets. */
  readonly leadIn?: Keyframe['easing']
  readonly leadInMs?: number
}

/**
 * Generate one leg of the journey as contact/pass keyframes.
 *
 * Every frame is `linear` with no hold: easing each step would make the walk pulse, since
 * an ease brings the body to a stop at every keyframe it passes through.
 */
const walk = ({ tag, from, to, steps, walkerCarries, traderCarries, leadIn, leadInMs }: WalkOptions): Keyframe[] => {
  const frames: Keyframe[] = []
  const half = (to - from) / (steps * 2)

  for (let i = 0; i <= steps * 2; i++) {
    const x = Math.round((from + half * i) * 100) / 100
    const contact = i % 2 === 0
    const phase = Math.floor(i / 2) % 2 === 0 ? 'A' : 'B'
    const pose = `${contact ? 'step' : 'pass'}${phase}`
    const handY = contact ? WALK_HAND_Y.contact : WALK_HAND_Y.pass
    const first = i === 0

    const items = {
      [walkerCarries]: { at: [x + WALK_HAND_X, handY] as const },
      [traderCarries]: { at: [-x - WALK_HAND_X, handY] as const },
    }

    frames.push({
      name: `${tag}${i}`,
      duration: first ? (leadInMs ?? HALF_MS) : HALF_MS,
      hold: 0,
      ...(first && leadIn !== undefined ? { easing: leadIn } : { easing: 'linear' as const }),
      parts: {
        walker: { at: [x, 0], pose, flipX: false },
        trader: { at: [-x, 0], pose, flipX: true },
        ...items,
      },
    })
  }
  return frames
}

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
    { figure: person, id: 'walker', pose: 'stepA', at: [-150, 0] },
    { figure: person, id: 'trader', pose: 'stepA', at: [150, 0], flipX: true },
    { figure: moneybag, id: 'bag', at: [-141, 38] },
    { figure: briefcase, id: 'case', at: [141, 38] },
  ],
  animate: {
    mode: 'loop',
    easing: 'easeInOut',
    keyframes: [
      // In: six strides from off-stage to arm's length. The first frame is the loop's cut.
      ...walk({
        tag: 'in',
        from: -150,
        to: -MEET,
        steps: 6,
        walkerCarries: 'bag',
        traderCarries: 'case',
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
          walker: { at: [-MEET, 0], pose: 'holdR', flipX: false },
          trader: { at: [MEET, 0], pose: 'holdL', flipX: false },
          bag: { at: rightHand(-MEET) },
          case: { at: leftHand(MEET) },
        },
      },
      {
        name: 'offer',
        duration: 560,
        hold: 260,
        parts: {
          walker: { at: [-MEET, 0], pose: 'offerR', flipX: false },
          trader: { at: [MEET, 0], pose: 'offerL', flipX: false },
          bag: { at: [-5, 23] },
          case: { at: [5, 23] },
        },
      },
      {
        // The exchange itself: arms stay out, the two items cross.
        name: 'swap',
        duration: 520,
        hold: 260,
        parts: {
          walker: { at: [-MEET, 0], pose: 'offerR', flipX: false },
          trader: { at: [MEET, 0], pose: 'offerL', flipX: false },
          bag: { at: [5, 23] },
          case: { at: [-5, 23] },
        },
      },
      {
        // Each moves the new item to their outer hand, freeing the inner one.
        name: 'taken',
        duration: 460,
        hold: 220,
        parts: {
          walker: { at: [-MEET, 0], pose: 'holdL', flipX: false },
          trader: { at: [MEET, 0], pose: 'holdR', flipX: false },
          case: { at: leftHand(-MEET) },
          bag: { at: rightHand(MEET) },
        },
      },
      {
        name: 'shake',
        duration: 460,
        hold: 620,
        parts: {
          walker: { at: [-SHAKE, 0], pose: 'shakeR', flipX: false },
          trader: { at: [SHAKE, 0], pose: 'shakeL', flipX: false },
          case: { at: leftHand(-SHAKE) },
          bag: { at: rightHand(SHAKE) },
        },
      },
      // Out: eight strides past each other and off the far sides, each carrying what they
      // were handed. The first frame turns them back into profile and starts them moving.
      ...walk({
        tag: 'out',
        from: -SHAKE,
        to: 136,
        steps: 8,
        walkerCarries: 'case',
        traderCarries: 'bag',
        leadIn: 'easeIn',
        leadInMs: 420,
      }),
    ],
  },
})
