/**
 * Tempo. One file, so the whole thing can be slowed down or sped up from a single number.
 *
 * A hero background is watched out of the corner of an eye, so the pace is closer to a slow
 * conveyor than to a demo reel: a message crosses the frame in about a second and a half, and
 * the rig takes most of a minute to run the route.
 */

/** Multiply every duration by this to retime the whole animation. */
export const TEMPO = 1

const scaled = (ms: number) => Math.round(ms * TEMPO)

/** A message crossing between neighbouring partners. */
export const HOP = scaled(1400)
/** A message crossing most of the frame — the ASN, the invoice. */
export const LONG_HOP = scaled(2100)
/** An acknowledgment: quick, and there are many. */
export const ACK = scaled(750)
/** How long after a message lands before its acknowledgment leaves. */
export const ACK_DELAY = scaled(420)
/** One leg of the rig's journey. */
export const HAUL = scaled(5200)
/** Loading or unloading at a dock. */
export const DWELL = scaled(1800)
