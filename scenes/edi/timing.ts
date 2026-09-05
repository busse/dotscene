/**
 * Tempo, and the running order.
 *
 * Every start time in the hero lives here, so an act can be slid without opening it, and the
 * camera script — which has to know when everything happens — reads the same numbers. A hero
 * background is watched out of the corner of an eye, so the pace is a slow conveyor rather
 * than a demo reel: a message crosses the frame in a second or two, and the rig takes most of
 * a minute to run the route.
 */

/** Multiply every duration by this to retime the whole animation. */
export const TEMPO = 1

const scaled = (ms: number) => Math.round(ms * TEMPO)

/** A message between neighbouring partners. */
export const HOP = scaled(1500)
/** A message across most of the frame — the advance ship notice. */
export const LONG_HOP = scaled(2400)
/** An acknowledgment: quick, and there are many. */
export const ACK = scaled(900)
/** How long after a message lands its acknowledgment leaves. */
export const ACK_DELAY = scaled(350)
/** Backing onto a door, or pulling off it. */
export const DOCKING = scaled(2000)

/** When each act starts, on the hero's clock. */
export const START = {
  prologue: 0,
  tender: scaled(3300),
  ack: scaled(5600),
  accept: scaled(7300),
  bol: scaled(10600),
  dispatch: scaled(11800),
  pickup: scaled(21500),
  asn: scaled(29000),
  terminal: scaled(29600),
  out: scaled(37200),
  delivered: scaled(42200),
  invoice: scaled(50500),
  payment: scaled(53300),
  reset: scaled(54300),
} as const

/** Where the loop cuts. Everything is home by then. */
export const LOOP = scaled(60000)
