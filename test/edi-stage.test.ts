import { describe, expect, it } from 'vitest'
import { along, segments, waypoints } from '../scenes/edi/route.ts'
import { truck } from '../scenes/edi/fleet.ts'
import { scene, stageNight } from '../scenes/edi/stage.ts'
import { resolve } from '../src/index.ts'

describe('the route', () => {
  it('is built entirely from grid-axis runs, so a vehicle can lie along one', () => {
    for (const seg of segments) {
      const movesX = seg.from[0] !== seg.to[0]
      const movesY = seg.from[1] !== seg.to[1]
      expect(movesX !== movesY).toBe(true)
      expect(seg.axis).toBe(movesX ? 'x' : 'y')
    }
  })

  it('starts and ends off the frame, so traffic arrives from somewhere', () => {
    expect(along(0).at[0]).toBeLessThan(-190)
    expect(along(1).at[0]).toBeGreaterThan(190)
  })

  it('runs continuously — no jumps between segments', () => {
    let previous = along(0).at
    for (let i = 1; i <= 400; i++) {
      const here = along(i / 400).at
      expect(Math.hypot(here[0] - previous[0], here[1] - previous[1])).toBeLessThan(12)
      previous = here
    }
  })

  it('crosses depth in both directions, which is what makes the weave read as solid', () => {
    const depths = Array.from({ length: 200 }, (_u, i) => along(i / 199).depth)
    const rises = depths.some((d, i) => i > 0 && d > depths[i - 1]!)
    const falls = depths.some((d, i) => i > 0 && d < depths[i - 1]!)
    expect(rises && falls).toBe(true)
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(6)
  })

  it('visits every waypoint', () => {
    const corners = new Set(segments.flatMap((s) => [s.from.join(','), s.to.join(',')]))
    for (const stop of waypoints) {
      const gx = (stop.u + stop.v) / 2
      const gy = (stop.v - stop.u) / 2
      expect(corners.has(`${gx},${gy}`)).toBe(true)
    }
  })
})

describe('the rig', () => {
  it('carries both orientations over one set of points, so turning is a tween', () => {
    const base = Object.keys(truck.points).sort()
    expect(Object.keys(truck.poses.y ?? {}).sort()).toEqual(base)
    expect(truck.poses.x).toEqual({})
  })

  it('is the same solid laid along the other axis — same size, different shape', () => {
    const size = (points: Record<string, readonly [number, number]>) => {
      const xs = Object.values(points).map((p) => p[0])
      const ys = Object.values(points).map((p) => p[1])
      return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
    }
    const alongX = truck.points as Record<string, readonly [number, number]>
    const alongY = truck.poses.y as Record<string, readonly [number, number]>
    // The two grid axes fall either side of vertical, so the footprints mirror: identical
    // extents, different geometry.
    expect(size(alongY)).toEqual(size(alongX))
    expect(alongY).not.toEqual(alongX)
  })

  it('moves every corner when it changes orientation, which is why a turn must snap', () => {
    // A box names corners by grid position, so east and west trade places. Tween that slowly
    // and the solid passes through itself; over a short interval it reads as a snap.
    const alongX = truck.points as Record<string, readonly [number, number]>
    const alongY = truck.poses.y as Record<string, readonly [number, number]>
    const swapped = Object.keys(alongX).filter((n) => alongX[n]![0] !== -alongY[n]![0])
    expect(swapped.length).toBeGreaterThan(0)
  })
})

describe('the stage', () => {
  it('paints back to front by depth, not by declaration order', () => {
    const order = resolve(scene).partOrder
    expect(order[0]).toBe('ediRoad')
    expect(order.at(-1)).toMatch(/^sample/)
    expect(order.indexOf('hubBack')).toBeLessThan(order.indexOf('hubFront'))
  })

  it('emits the same geometry in both palettes — only the colours differ', () => {
    const light = resolve(scene)
    const dark = resolve(stageNight)
    expect(dark.dots.length).toBe(light.dots.length)
    expect(dark.faces.length).toBe(light.faces.length)
    expect(dark.partOrder).toEqual(light.partOrder)
  })

  it('is dense enough to be worth the trouble', () => {
    const resolved = resolve(scene)
    expect(resolved.dots.length).toBeGreaterThan(300)
    expect(resolved.faces.length).toBeGreaterThan(60)
  })
})
