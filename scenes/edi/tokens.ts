/**
 * The EDI messages themselves.
 *
 * Unlabelled, so type is carried by shape, size and which way it travels rather than by a
 * number a viewer would have to decode. That is what lets the network stay dense: eight
 * transaction sets read as texture instead of as a legend.
 *
 * Every token lies flat in the mesh plane, drawn at the origin and moved by translating the
 * part — the same trick the rig uses.
 */

import { figureOf, merge, tag, type Shape } from '../iso.ts'
import { pad, uvLine } from './projection.ts'
import { NET_Z } from './network.ts'

/** A document: the ordinary case, and the biggest of them. Tender, bill of lading, invoice. */
const docShape: Shape = merge(
  pad('doc', [-0.62, -0.44], [0.62, 0.44], NET_Z),
  uvLine('docRule1', [-0.3, -0.18], [0.5, -0.18], NET_Z),
  uvLine('docRule2', [-0.3, 0.16], [0.5, 0.16], NET_Z),
)

/** An acknowledgment: small, quick, and there are a lot of them. */
const ackShape: Shape = pad('ack', [-0.3, -0.24], [0.3, 0.24], NET_Z)

/** A status message: narrower than a document, so a stream of them reads as a pulse. */
const statusShape: Shape = merge(
  pad('status', [-0.44, -0.3], [0.44, 0.3], NET_Z),
  uvLine('statusRule', [-0.18, 0], [0.28, 0], NET_Z),
)

/** Each shape is its own figure, because each is its own part with its own flight path. */
export const shapes = {
  doc: (id: string) => figureOf(id, tag(docShape, 'token'), 'A document'),
  ack: (id: string) => figureOf(id, tag(ackShape, 'token'), 'An acknowledgment'),
  status: (id: string) => figureOf(id, tag(statusShape, 'token'), 'A status message'),
} as const

export type TokenShape = keyof typeof shapes

/** Far off-frame, where a token waits between flights and is clipped away. */
export const PARKED: readonly [number, number] = [-1000, -1000]
