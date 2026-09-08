/**
 * Ground texture for the meadow variant: patches of longer grass, tufts, and bare earth.
 *
 * Everything here is flat on the ground and painted before anything that stands on it, so
 * placement can be careless — a patch under a shed is simply covered. Shapes are jittered by
 * a small seeded generator, so the scatter is irregular and the build is byte-stable.
 */

import type { Vec2 } from 'dotscene'
import { point } from '../projection.ts'
import { merge, tag, type Shape } from '../../iso.ts'

/** A tiny deterministic generator, so "random" texture builds the same way every time. */
export const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0 || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** An irregular patch of longer grass around a (u, v) centre, `radius` across in u. */
export const patch = (prefix: string, u: number, v: number, radius: number, seed: number, sides = 6): Shape => {
  const random = seeded(seed)
  const names: string[] = []
  const points: Record<string, Vec2> = {}
  for (let i = 0; i < sides; i++) {
    const angle = ((i + random() * 0.5) / sides) * Math.PI * 2
    const r = radius * (0.65 + random() * 0.5)
    // Depth runs twice as fast as width in (u, v), so a round patch is squat in v.
    const name = `${prefix}${i}`
    names.push(name)
    points[name] = point(u + Math.cos(angle) * r, v + Math.sin(angle) * r * 1.6)
  }
  return tag(
    {
      points,
      edges: names.map((n, i) => [n, names[(i + 1) % sides]!] as const),
      faces: [{ points: names, kind: 'patch' }],
    },
    'grass',
  )
}

/** A tuft: two blades meeting at the ground, the smallest thing that still reads as grass. */
export const tuft = (prefix: string, u: number, v: number, seed: number): Shape => {
  const random = seeded(seed)
  const lean = (random() - 0.5) * 0.3
  const spread = 0.28 + random() * 0.12
  const height = 0.55 + random() * 0.3
  return tag(
    {
      points: {
        [`${prefix}L`]: point(u - spread + lean, v, height * 0.85),
        [`${prefix}B`]: point(u, v, 0),
        [`${prefix}R`]: point(u + spread + lean, v, height),
      },
      edges: [
        [`${prefix}L`, `${prefix}B`],
        [`${prefix}B`, `${prefix}R`],
      ],
    },
    'grass',
  )
}

/** Bare earth: a patch with a dirt face, for under trees and around gates. */
export const bare = (prefix: string, u: number, v: number, radius: number, seed: number): Shape => {
  const grassy = patch(prefix, u, v, radius, seed, 5)
  return tag({ ...grassy, faces: (grassy.faces ?? []).map((f) => ({ ...f, kind: 'dirt' })) }, 'dirt')
}

/** Several shapes scattered by one generator over a (u, v) box. */
export const scatter = (
  prefix: string,
  count: number,
  box: { u: [number, number]; v: [number, number] },
  seed: number,
  make: (name: string, u: number, v: number, seed: number) => Shape,
): Shape => {
  const random = seeded(seed)
  const shapes: Shape[] = []
  for (let i = 0; i < count; i++) {
    const u = box.u[0] + random() * (box.u[1] - box.u[0])
    const v = box.v[0] + random() * (box.v[1] - box.v[0])
    shapes.push(make(`${prefix}${i}`, Math.round(u * 10) / 10, Math.round(v * 10) / 10, seed + i * 7919))
  }
  return merge(...shapes)
}
