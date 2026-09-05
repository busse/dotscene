/**
 * Shared kit for building things in an isometric grid.
 *
 * Written for the city block first and pulled out here when a second scene family needed the
 * same primitives. The projection is a parameter, so a scene can pick its own tile size and
 * rise without forking the shapes.
 */

import { defineFigure, type Vec2, type Vec3 } from 'dotscene'

export type ShapeEdge = readonly [string, string] | { readonly from: string; readonly to: string; readonly kind?: string }

export interface Shape {
  readonly points: Readonly<Record<string, Vec2>>
  readonly edges: readonly ShapeEdge[]
  readonly faces?: readonly { readonly points: readonly string[]; readonly kind?: string }[]
  /** Per-point roles, so one part can hold inked buildings and blue ground together. */
  readonly kinds?: Readonly<Record<string, string>>
  /** Paint order within the shape, as groups of points, back to front. See `merge`. */
  readonly layers?: readonly (readonly string[])[]
}

/**
 * Combine shapes into one, in the order given — which is also their paint order.
 *
 * Each shape merged becomes a layer of the result, so a building built as `merge(farBlock,
 * nearShed)` paints the shed's walls over the block's edges rather than all faces first and
 * all lines after. A shape that already has layers keeps them.
 */
export const merge = (...shapes: readonly Shape[]): Shape => ({
  points: Object.assign({}, ...shapes.map((s) => s.points)),
  edges: shapes.flatMap((s) => s.edges),
  faces: shapes.flatMap((s) => s.faces ?? []),
  kinds: Object.assign({}, ...shapes.map((s) => s.kinds ?? {})),
  layers: shapes.flatMap((s) => (s.layers !== undefined && s.layers.length > 0 ? s.layers : [Object.keys(s.points)])),
})

/**
 * Give every point and edge of a shape one role.
 *
 * Applied per sub-shape before merging, which is how a single part ends up with its buildings
 * inked and its yard in blue.
 */
export const tag = (shape: Shape, kind: string): Shape => ({
  ...shape,
  edges: shape.edges.map((e) => ('from' in e ? { ...e, kind } : { from: e[0], to: e[1], kind })),
  kinds: Object.fromEntries(Object.keys(shape.points).map((n) => [n, kind])),
})

/**
 * Re-tone a shape's faces — `roof` becomes `roof-blue` — so one building can wear the palette
 * while its neighbours stay neutral. Edges and points are untouched; only fills change.
 */
export const tone = (shape: Shape, name: string): Shape => ({
  ...shape,
  faces: (shape.faces ?? []).map((f) => ({ ...f, kind: `${f.kind ?? 'face'}-${name}` })),
})

/**
 * Label every point in a shape with one role, so a scene can colour by what a thing *is*
 * rather than by matching point names.
 */
export const kindsFor = (shape: Shape, kind: string): Record<string, string> =>
  Object.fromEntries(Object.keys(shape.points).map((name) => [name, kind]))

/** Turn a shape into a figure, optionally with every point carrying one role. */
export const figureOf = (name: string, shape: Shape, title: string, kind?: string) => {
  const blanket =
    kind === undefined ? {} : Object.fromEntries(Object.keys(shape.points).map((n) => [n, kind]))
  // A shape's own roles win over the blanket one it is being given.
  const pointKinds = { ...blanket, ...(shape.kinds ?? {}) }
  return defineFigure(name, {
    title,
    points: shape.points,
    edges: kind === undefined ? shape.edges : shape.edges.map((e) => ('from' in e ? e : { from: e[0], to: e[1], kind })),
    faces: shape.faces ?? [],
    ...(Object.keys(pointKinds).length === 0 ? {} : { pointKinds }),
    ...(shape.layers === undefined || shape.layers.length < 2 ? {} : { layers: shape.layers.filter((l) => l.length > 0) }),
  })
}

export interface IsoKit {
  /** Project one grid cell. */
  readonly at: (cell: Vec3) => Vec2
  readonly box: (prefix: string, from: Vec2, to: Vec2, height: number, base?: number) => Shape
  readonly edge: (name: string, from: Vec3, to: Vec3) => Shape
  readonly line: (name: string, from: Vec2, to: Vec2) => Shape
  /** A flat rectangle lying on the ground — a yard, an apron, a dock pad. */
  readonly pad: (prefix: string, from: Vec2, to: Vec2, z?: number) => Shape
}

export const isoKit = (project: (cell: Vec3) => Vec2): IsoKit => {
  const edge = (name: string, from: Vec3, to: Vec3): Shape => ({
    points: { [`${name}A`]: project(from), [`${name}B`]: project(to) },
    edges: [[`${name}A`, `${name}B`]],
  })

  return {
    at: project,
    edge,
    line: (name, from, to) => edge(name, [from[0], from[1], 0], [to[0], to[1], 0]),

    /**
     * A rectangular solid, from one grid corner to another, `height` tall.
     *
     * The far corner and the three edges meeting it are left out. In this view that corner is
     * always the one with the smallest x + y — the highest on screen — so dropping it turns a
     * transparent wireframe into a solid showing its three visible faces. The faces those
     * edges bound are what stop the ground showing through.
     */
    box: (prefix, from, to, height, base = 0) => {
      const [x0, y0] = from
      const [x1, y1] = to
      return {
        points: {
          [`${prefix}Near`]: project([x1, y1, base]),
          [`${prefix}East`]: project([x1, y0, base]),
          [`${prefix}West`]: project([x0, y1, base]),
          [`${prefix}TopFar`]: project([x0, y0, height]),
          [`${prefix}TopEast`]: project([x1, y0, height]),
          [`${prefix}TopNear`]: project([x1, y1, height]),
          [`${prefix}TopWest`]: project([x0, y1, height]),
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
    },

    pad: (prefix, from, to, z = 0) => {
      const [x0, y0] = from
      const [x1, y1] = to
      const corners = { Far: [x0, y0], East: [x1, y0], Near: [x1, y1], West: [x0, y1] } as const
      return {
        points: Object.fromEntries(
          Object.entries(corners).map(([name, [x, y]]) => [`${prefix}${name}`, project([x, y, z])]),
        ),
        edges: [
          [`${prefix}Far`, `${prefix}East`],
          [`${prefix}East`, `${prefix}Near`],
          [`${prefix}Near`, `${prefix}West`],
          [`${prefix}West`, `${prefix}Far`],
        ],
        faces: [
          { points: [`${prefix}Far`, `${prefix}East`, `${prefix}Near`, `${prefix}West`], kind: 'apron' },
        ],
      }
    },
  }
}
