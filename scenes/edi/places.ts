/**
 * What is built at each waypoint.
 *
 * Each waypoint contributes two parts, not one: whatever stands *behind* the road and
 * whatever stands *in front* of it. They need separate paint order because the truck passes
 * between them — behind the far buildings, in front of the near trailers — and a part is the
 * unit the renderer sorts.
 */

import { box, footprint, pad, uvLine } from './projection.ts'
import { waypoint, type WaypointId } from './route.ts'
import { figureOf, merge, tag, type Shape } from '../iso.ts'

/**
 * Depth offsets from a waypoint's own v, far and near side of the road.
 *
 * A note on scale, because it is not obvious: a footprint of w by d in grid units projects to
 * `(w + d) * TILE` across the screen, since both axes run diagonally. A shed that sounds six
 * wide is eighty units across in a frame only three hundred and eighty wide. Every dimension
 * below is chosen from the screen width it produces, not from how it reads as a number.
 */
const BACK = -7.5
const FRONT = 5

/** A parked trailer. Small, boxy, and there are a lot of them — this is the texture. */
const trailer = (id: string, u: number, v: number, length = 1.4): Shape =>
  box(id, ...footprint(u, v, length, 0.6), 1.4, 0.3)

/** A row of trailers backed onto a dock, spread along u. */
const trailerRow = (id: string, u: number, v: number, count: number, gap = 2.4): Shape =>
  merge(...Array.from({ length: count }, (_u, i) => trailer(`${id}${i}`, u + i * gap, v)))

/** Dock doors: short marks along the face of a building, read as a working frontage. */
const dockDoors = (id: string, u: number, v: number, count: number, gap = 1.4): Shape =>
  merge(
    ...Array.from({ length: count }, (_u, i) =>
      uvLine(`${id}${i}`, [u + i * gap, v], [u + i * gap, v], 0, 1.1),
    ),
  )

/** A yard: an apron with a faint lot grid ruled across it, drawn over its own surface. */
const yard = (id: string, u: number, v: number, w: number, d: number, rules = 4): Shape =>
  merge(
    tag(pad(id, ...footprint(u, v, w, d)), 'ground'),
    tag(
      merge(
        ...Array.from({ length: rules }, (_u, i) => {
          const offset = -w / 2 + ((i + 1) * w) / (rules + 1)
          return uvLine(`${id}Rule${i}`, [u + offset, v - d / 2], [u + offset, v + d / 2])
        }),
      ),
      'lot',
    ),
  )

interface Place {
  readonly back: Shape
  readonly front: Shape
}

const build = (id: WaypointId, make: (u: number, v: number) => Place) => {
  const { u, v } = waypoint(id)
  const { back, front } = make(u, v)
  return {
    back: figureOf(`${id}Back`, back, `${id} — far side`),
    front: figureOf(`${id}Front`, front, `${id} — near side`),
    backDepth: v + BACK,
    frontDepth: v + FRONT,
  }
}

export const places = {
  /** Origin: one shed, and the yard it ships out of. */
  shipper: build('shipper', (u, v) => ({
    back: merge(
      box('shipShed', ...footprint(u, v + BACK, 3.4, 2), 4.6),
      dockDoors('shipDoor', u - 2.4, v + BACK + 1.4, 4),
    ),
    front: merge(yard('shipYard', u, v + FRONT, 5, 1.8), trailerRow('shipTrl', u - 2.6, v + FRONT, 3)),
  })),

  /** Local terminal: a long dock, and a full row backed onto it. */
  originTerm: build('originTerm', (u, v) => ({
    back: merge(
      box('otShed', ...footprint(u, v + BACK, 5, 1.8), 3.2),
      dockDoors('otDoor', u - 3.4, v + BACK + 1.3, 6),
    ),
    front: merge(yard('otYard', u, v + FRONT, 6.5, 1.8), trailerRow('otTrl', u - 3.6, v + FRONT, 4)),
  })),

  /** Relay: almost nothing, so the middle of the frame can breathe. */
  relay: build('relay', (u, v) => ({
    back: merge(
      box('relayHut', ...footprint(u - 1.4, v + BACK + 1.4, 1.4, 1.1), 2),
      uvLine('relayMast', [u + 1.4, v + BACK + 1.4], [u + 1.4, v + BACK + 1.4], 0, 5.4),
    ),
    front: merge(
      yard('relayPad', u, v + FRONT - 1.2, 3.4, 1.4, 2),
      trailerRow('relayTrl', u - 1.2, v + FRONT - 1.2, 2, 2.4),
    ),
  })),

  /** The crossdock: doors on both sides, trailers on both sides. The busiest thing here. */
  hub: build('hub', (u, v) => ({
    back: merge(
      box('hubShed', ...footprint(u, v + BACK, 7.5, 2.6), 4.2),
      dockDoors('hubDoorN', u - 5.6, v + BACK + 1.8, 9, 1.4),
      trailerRow('hubTrlN', u - 5.4, v + BACK - 3, 5, 2.6),
    ),
    front: merge(
      yard('hubYard', u, v + FRONT, 9, 2.6, 6),
      trailerRow('hubTrlS', u - 6, v + FRONT - 0.5, 6, 2.4),
      box('hubOffice', ...footprint(u + 7, v + FRONT + 1.2, 1.4, 1.2), 2.8),
    ),
  })),

  /** Destination terminal: the mirror of the origin, a little smaller. */
  destTerm: build('destTerm', (u, v) => ({
    back: merge(
      box('dtShed', ...footprint(u, v + BACK, 4.4, 1.7), 3),
      dockDoors('dtDoor', u - 2.6, v + BACK + 1.2, 5),
    ),
    front: merge(yard('dtYard', u, v + FRONT, 5.5, 1.7), trailerRow('dtTrl', u - 2.6, v + FRONT, 3)),
  })),

  /** Destination: where the freight stops being the carrier's problem. */
  consignee: build('consignee', (u, v) => ({
    back: merge(
      box('conShed', ...footprint(u, v + BACK, 3.2, 2), 4),
      dockDoors('conDoor', u - 1.4, v + BACK + 1.4, 3),
    ),
    front: merge(yard('conYard', u, v + FRONT, 4.4, 1.7), trailerRow('conTrl', u - 1.2, v + FRONT, 2)),
  })),
} as const
