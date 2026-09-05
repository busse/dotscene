/**
 * The EDI network: nodes above the yards, and the links between them.
 *
 * This is the half of the picture that is *information about* the freight rather than the
 * freight itself, so it is drawn in blue and it floats. Every node is tethered down to the
 * place it belongs to, which is what stops the mesh reading as unrelated decoration.
 *
 * Two of the partners are not on the route at all — the payer settles the invoice and the
 * broker never touches the goods — and putting them off the road is the point: EDI reaches
 * people the truck never visits.
 */

import { point, uvLine } from './projection.ts'
import { waypoints, waypoint, type WaypointId } from './route.ts'
import { figureOf, merge, type Shape } from '../iso.ts'

/** How high the mesh floats above the yards. */
export const NET_Z = 8

export interface NetNode {
  readonly id: string
  readonly u: number
  readonly v: number
}

/** A node over each waypoint, plus the two partners the freight never reaches. */
export const nodes: readonly NetNode[] = [
  ...waypoints.map(({ id, u, v }) => ({ id, u, v: v - 1.5 })),
  { id: 'broker', u: -13, v: -9.5 },
  { id: 'payer', u: 10, v: -9 },
]

export const node = (id: string): NetNode => nodes.find((n) => n.id === id)!

/** Where a message sits when it is at a given partner. */
export const nodeAt = (id: string) => {
  const { u, v } = node(id)
  return point(u, v, NET_Z)
}

/** Trading-partner links. Not a chain — everyone talks to the carrier, and to each other. */
const LINKS: readonly (readonly [string, string])[] = [
  ['shipper', 'originTerm'],
  ['originTerm', 'relay'],
  ['relay', 'hub'],
  ['hub', 'destTerm'],
  ['destTerm', 'consignee'],
  ['shipper', 'hub'],
  ['hub', 'consignee'],
  ['shipper', 'broker'],
  ['broker', 'hub'],
  ['hub', 'payer'],
  ['payer', 'shipper'],
  ['shipper', 'consignee'],
]

/** A small diamond, so a node is a place rather than a dot on a line. */
const marker = (id: string, u: number, v: number, r = 0.85): Shape =>
  merge(
    uvLine(`${id}NE`, [u, v - r], [u + r, v], NET_Z),
    uvLine(`${id}ES`, [u + r, v], [u, v + r], NET_Z),
    uvLine(`${id}SW`, [u, v + r], [u - r, v], NET_Z),
    uvLine(`${id}WN`, [u - r, v], [u, v - r], NET_Z),
  )

const linkShape: Shape = merge(
  ...LINKS.map(([from, to], i) => {
    const a = node(from)
    const b = node(to)
    return uvLine(`link${i}`, [a.u, a.v], [b.u, b.v], NET_Z)
  }),
)

/** Each node dropped down to the yard it speaks for. Faint — it is an association, not a wire. */
const tethers: Shape = merge(
  ...waypoints.map(({ id }) => {
    const n = node(id as WaypointId)
    const ground = waypoint(id as WaypointId)
    return uvLine(`tether${id}`, [n.u, n.v], [ground.u, ground.v], NET_Z, 0)
  }),
)

const markers: Shape = merge(...nodes.map(({ id, u, v }) => marker(id, u, v)))

export const mesh = figureOf('ediMesh', merge(linkShape, markers), 'The EDI network', 'net')
export const meshTethers = figureOf('ediTethers', tethers, 'Nodes tied to their yards', 'tether')
