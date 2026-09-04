import { defineFigure, defineScene } from 'dotscene'
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

// Where each figure stands, and where the item in its hand therefore hangs. A carrying hand
// sits 12 units to the figure's inner side at y = 35, so an item's x is the figure's x
// plus or minus 12 — stated once here rather than recomputed at every keyframe.
const OFF = 150
const MEET = 30
const SHAKE = 24
const HAND = 12
const HAND_Y = 35

/** Positions for the walker (item on their right) and the trader (item on their left). */
const rightHand = (x: number): readonly [number, number] => [x + HAND, HAND_Y]
const leftHand = (x: number): readonly [number, number] => [x - HAND, HAND_Y]

/**
 * Two people meet, trade a bag of money for a briefcase, shake on it and walk on.
 *
 * The scene has an explicit viewBox because it needs somewhere to be off-stage: figures are
 * parked well outside it at the ends, and the SVG viewport clips them. A fitted viewBox
 * would zoom out to include the whole walk and nothing would ever enter or leave.
 *
 * `empty` has `duration: 0` so the loop's wrap-around is a hard cut. Without it, the last
 * keyframe would tween back to the first and both figures would slide backwards across the
 * stage in full view.
 */
export const scene = defineScene('exchange', {
  title: 'Two people trade a bag of money for a briefcase',
  viewBox: [-110, -6, 220, 76],
  parts: [
    { figure: floor },
    { figure: person, id: 'walker', pose: 'walkCarryA', at: [-OFF, 0] },
    { figure: person, id: 'trader', pose: 'walkHoldA', at: [OFF, 0] },
    { figure: moneybag, id: 'bag', at: rightHand(-OFF) },
    { figure: briefcase, id: 'case', at: leftHand(OFF) },
  ],
  animate: {
    mode: 'loop',
    easing: 'easeInOut',
    keyframes: [
      {
        name: 'empty',
        duration: 0,
        hold: 400,
        parts: {
          walker: { at: [-OFF, 0], pose: 'walkCarryA' },
          trader: { at: [OFF, 0], pose: 'walkHoldA' },
          bag: { at: rightHand(-OFF) },
          case: { at: leftHand(OFF) },
        },
      },
      {
        name: 'enter1',
        duration: 700,
        hold: 0,
        parts: {
          walker: { at: [-100, 0], pose: 'walkCarryB' },
          trader: { at: [100, 0], pose: 'walkHoldB' },
          bag: { at: rightHand(-100) },
          case: { at: leftHand(100) },
        },
      },
      {
        name: 'enter2',
        duration: 700,
        hold: 0,
        parts: {
          walker: { at: [-60, 0], pose: 'walkCarryA' },
          trader: { at: [60, 0], pose: 'walkHoldA' },
          bag: { at: rightHand(-60) },
          case: { at: leftHand(60) },
        },
      },
      {
        name: 'meet',
        duration: 700,
        hold: 500,
        parts: {
          walker: { at: [-MEET, 0], pose: 'holdR' },
          trader: { at: [MEET, 0], pose: 'holdL' },
          bag: { at: rightHand(-MEET) },
          case: { at: leftHand(MEET) },
        },
      },
      {
        name: 'offer',
        duration: 600,
        hold: 300,
        parts: {
          walker: { at: [-MEET, 0], pose: 'offerR' },
          trader: { at: [MEET, 0], pose: 'offerL' },
          bag: { at: [-5, 23] },
          case: { at: [5, 23] },
        },
      },
      {
        // The exchange itself: arms stay out, the two items cross.
        name: 'swap',
        duration: 550,
        hold: 300,
        parts: {
          walker: { at: [-MEET, 0], pose: 'offerR' },
          trader: { at: [MEET, 0], pose: 'offerL' },
          bag: { at: [5, 23] },
          case: { at: [-5, 23] },
        },
      },
      {
        // Each moves the new item to their outer hand, freeing the inner one.
        name: 'taken',
        duration: 500,
        hold: 250,
        parts: {
          walker: { at: [-MEET, 0], pose: 'holdL' },
          trader: { at: [MEET, 0], pose: 'holdR' },
          case: { at: leftHand(-MEET) },
          bag: { at: rightHand(MEET) },
        },
      },
      {
        name: 'shake',
        duration: 500,
        hold: 700,
        parts: {
          walker: { at: [-SHAKE, 0], pose: 'shakeR' },
          trader: { at: [SHAKE, 0], pose: 'shakeL' },
          case: { at: leftHand(-SHAKE) },
          bag: { at: rightHand(SHAKE) },
        },
      },
      {
        name: 'part1',
        duration: 650,
        hold: 0,
        parts: {
          walker: { at: [20, 0], pose: 'walkHoldB' },
          trader: { at: [-20, 0], pose: 'walkCarryB' },
          case: { at: leftHand(20) },
          bag: { at: rightHand(-20) },
        },
      },
      {
        name: 'part2',
        duration: 700,
        hold: 0,
        parts: {
          walker: { at: [80, 0], pose: 'walkHoldA' },
          trader: { at: [-80, 0], pose: 'walkCarryA' },
          case: { at: leftHand(80) },
          bag: { at: rightHand(-80) },
        },
      },
      {
        name: 'gone',
        duration: 700,
        hold: 500,
        parts: {
          walker: { at: [OFF, 0], pose: 'walkHoldB' },
          trader: { at: [-OFF, 0], pose: 'walkCarryB' },
          case: { at: leftHand(OFF) },
          bag: { at: rightHand(-OFF) },
        },
      },
    ],
  },
})
