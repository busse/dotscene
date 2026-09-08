import { describe, expect, it } from 'vitest'
import { animationPayload, resolve, resolveAt } from '../src/index.ts'
import { acts } from '../scenes/edi/acts/index.ts'
import { cameraScript } from '../scenes/edi/acts/camera.ts'
import { cast, composed, heroMeadow, heroMeadowNight, heroNight, placements, scene, seam } from '../scenes/edi/hero.ts'
import { along, ROAD, routeAt, segments, sites } from '../scenes/edi/world.ts'
import { LOOP, START } from '../scenes/edi/timing.ts'

describe('the world', () => {
  it('builds the road from grid-axis runs only, so a vehicle can lie along any of them', () => {
    for (const seg of segments) {
      const movesX = seg.from[0] !== seg.to[0]
      const movesY = seg.from[1] !== seg.to[1]
      expect(movesX !== movesY).toBe(true)
    }
    expect(ROAD.length).toBeGreaterThan(5)
  })

  it('runs the road off both sides of the establishing shot', () => {
    expect(along(0).cell[0]).toBeLessThan(-40)
    expect(along(1).cell[0]).toBeGreaterThan(40)
  })

  it('passes in front of every dock, along x, so a rig can back straight onto the door', () => {
    for (const site of [sites.shipper, sites.hub, sites.consignee]) {
      for (const door of site.doors) {
        const spot = along(routeAt([door[0], door[1] + 3]))
        expect(spot.axis).toBe('x')
        expect(spot.cell[1]).toBeGreaterThan(door[1] + 2)
        expect(Math.abs(spot.cell[0] - door[0])).toBeLessThan(0.01)
      }
    }
  })
})

describe('the acts', () => {
  it('covers the lifecycle: a prologue and twelve transactions', () => {
    expect(acts).toHaveLength(13)
    expect(acts.map((a) => a.id)).toEqual([...new Set(acts.map((a) => a.id))])
  })

  it('gives every act beats that start at its own zero', () => {
    for (const act of acts) {
      const times = act.act.beats.map((b) => b.at)
      expect(Math.min(...times)).toBe(0)
      expect(Math.max(...times)).toBeLessThanOrEqual(act.duration)
    }
  })

  it('never lets two acts own the same part they bring', () => {
    const ids = acts.flatMap((a) => a.parts.map((p) => p.id))
    expect(ids).toEqual([...new Set(ids)])
  })

  it('carries the transaction set as digits on the messages that need explaining', () => {
    const labelled = acts.flatMap((a) => a.parts.filter((p) => p.id!.endsWith('Label')).map((p) => p.figure.title))
    for (const set of ['204', '990', '211', '214', '856', '210', '820']) expect(labelled).toContain(set)
  })

  it('resolves each act on its own, so a step can be previewed without the rest', () => {
    for (const act of acts) {
      const resolved = resolve(act.scene)
      expect(resolved.animation?.cycle.length).toBeGreaterThan(2)
      expect(resolved.partOrder).toContain('rig')
    }
  })
})

describe('the hero', () => {
  it('cuts back to the start invisibly', () => {
    expect(seam).toEqual([])
  })

  it('plays every act, the ambient life, the camera and the reset exactly once', () => {
    const names = placements.map((p) => p.act.name)
    expect(names).toEqual([...new Set(names)])
    for (const act of acts) expect(names).toContain(act.id)
    expect(names).toContain('ambient')
    expect(names).toContain('camera')
    expect(names).toContain('reset')
  })

  it('runs as one lap of the length the schedule declares', () => {
    expect(composed.duration).toBe(LOOP)
    expect(resolve(scene).animation?.duration).toBe(LOOP)
  })

  it('has the rig in one act at a time, and hands it on where the last act left it', () => {
    const owners = new Map<string, { from: number; to: number }>()
    for (const { act, at } of placements) {
      for (const beat of act.beats) {
        if ((beat.parts as Record<string, unknown> | undefined)?.rig === undefined) continue
        const span = owners.get(act.name) ?? { from: Infinity, to: -Infinity }
        span.from = Math.min(span.from, at + beat.at)
        span.to = Math.max(span.to, at + beat.at)
        owners.set(act.name, span)
      }
    }
    const spans = [...owners.values()].sort((a, b) => a.from - b.from)
    for (let i = 1; i < spans.length; i++) expect(spans[i]!.from).toBeGreaterThanOrEqual(spans[i - 1]!.to)
    expect(spans.length).toBeGreaterThan(4)
  })

  it('never lets the camera rest: every gap between shots is a move', () => {
    const beats = cameraScript.beats
    for (let i = 1; i < beats.length; i++) {
      const a = beats[i - 1]!.camera!
      const b = beats[i]!.camera!
      const moved = a.at![0] !== b.at![0] || a.at![1] !== b.at![1] || a.width !== b.width
      expect(moved).toBe(true)
    }
    expect(beats[0]!.at).toBe(0)
    expect(beats[beats.length - 1]!.at).toBe(LOOP)
  })

  it('frames a message in flight, not just the ground under it', () => {
    // Halfway through the tender's crossing the envelope must be inside the camera's window.
    const at = resolveAt(scene, START.tender + 260 + 750)
    const [x, y, w, h] = at.viewBox
    const envelope = at.dots.filter((d) => d.part === 'tenderEnv')
    expect(envelope.length).toBeGreaterThan(0)
    for (const dot of envelope) {
      expect(dot.at[0]).toBeGreaterThan(x)
      expect(dot.at[0]).toBeLessThan(x + w)
      expect(dot.at[1]).toBeGreaterThan(y)
      expect(dot.at[1]).toBeLessThan(y + h)
    }
  })

  it('always has several things moving', () => {
    // Sample the lap; at every instant more than one part should be mid-move.
    const resolved = resolve(scene)
    const step = 1000
    for (let t = 500; t < LOOP; t += step) {
      const before = resolveAt(scene, t - 120)
      const now = resolveAt(scene, t)
      const moved = new Set<string>()
      const index = new Map(before.dots.map((d) => [`${d.part}/${d.point}`, d.at]))
      for (const dot of now.dots) {
        const was = index.get(`${dot.part}/${dot.point}`)
        if (was !== undefined && (was[0] !== dot.at[0] || was[1] !== dot.at[1])) moved.add(dot.part)
      }
      expect(moved.size, `at ${t}ms`).toBeGreaterThan(1)
    }
    expect(resolved.animation?.camera).toBeDefined()
  })

  it('keeps the payload within budget by not restating still parts', () => {
    const payload = animationPayload(resolve(scene))!
    expect(payload.length).toBeLessThan(450 * 1024)
    // Keyframes are sparse: the average keyframe names a handful of parts, not the cast.
    const perFrame = composed.keyframes.map((k) => Object.keys(k.parts ?? {}).length)
    expect(perFrame.reduce((a, b) => a + b, 0) / perFrame.length).toBeLessThan(cast.length / 4)
  })

  it('is the same animation in both palettes', () => {
    const light = resolve(scene)
    const dark = resolve(heroNight)
    expect(dark.animation?.cycle).toEqual(light.animation?.cycle)
    expect(dark.partOrder).toEqual(light.partOrder)
  })

  it('puts the meadow under the same animation, with its texture painted first', () => {
    const paper = resolve(scene)
    for (const variant of [heroMeadow, heroMeadowNight]) {
      const green = resolve(variant)
      expect(green.animation?.cycle).toEqual(paper.animation?.cycle)
      expect(green.animation?.frames).toEqual(paper.animation?.frames)
      // Texture first, then everything the paper version has, in the same order.
      const texture = ['patches', 'bare', 'shores', 'verges', 'tufts']
      expect(green.partOrder.slice(0, texture.length)).toEqual(texture)
      expect(green.partOrder.slice(texture.length)).toEqual(paper.partOrder)
      expect(green.background).not.toBe(paper.background)
      expect(green.css).toContain('.ds-face--patch')
    }
  })

  it('only ever moves a vehicle along the axis of the heading it holds', () => {
    // A rig lying along x that travels along y is driving sideways. Between any two of a
    // vehicle's keyframes that share a pose, the displacement must be along that pose's axis.
    const grid = ([sx, sy]: readonly [number, number]): [number, number] => [(sx / 8 + sy / 4) / 2, (sy / 4 - sx / 8) / 2]
    for (const part of ['rig', 'van']) {
      let previous: { cell: [number, number]; pose: string } | undefined
      for (const keyframe of composed.keyframes) {
        const state = keyframe.parts?.[part]
        if (state?.at === undefined || typeof state.pose !== 'string') continue
        const cell = grid(state.at)
        if (previous !== undefined && previous.pose === state.pose) {
          const axis = state.pose[0]
          const across = axis === 'x' ? cell[1] - previous.cell[1] : cell[0] - previous.cell[0]
          expect(Math.abs(across), `${part} at ${keyframe.name} in pose ${state.pose}`).toBeLessThan(1e-3)
        }
        previous = { cell, pose: state.pose }
      }
    }
  })

  it('turns at the corner, not one corner late', () => {
    // The terminal leg crosses two corners: the heading must change at each, and the rig must
    // lie along y for the whole of the y run between them.
    // The first corner comes only half a second into this leg.
    const times = [START.terminal + 300, START.terminal + 3500, START.terminal + 6200]
    const poses = times.map((t) => {
      const at = resolveAt(scene, t)
      // The trailer box's East and Near corners are its y extent: the trailer's width when it
      // lies along x, its full length when it lies along y.
      const east = at.dots.find((d) => d.part === 'rig' && d.point === 'trailerEast')!.at
      const near = at.dots.find((d) => d.part === 'rig' && d.point === 'trailerNear')!.at
      return Math.hypot(east[0] - near[0], east[1] - near[1]) > 15 ? 'y' : 'x'
    })
    expect(poses).toEqual(['x', 'y', 'x'])
  })

  it('paints a docked rig behind the parked trailer beside it, which is nearer', () => {
    // At the shipper the rig backs onto door 1 while a trailer stands on door 2, down-right of
    // it on screen. The trailer must paint after the rig.
    const at = resolveAt(scene, START.pickup + 2000)
    expect(at.partOrder.indexOf('shipperTrailer')).toBeGreaterThan(at.partOrder.indexOf('rig'))
  })

  it('paints the rig behind a building it passes and in front of the yard it crosses', () => {
    // On its way to the shipper the rig runs along the road in front of the shipper's
    // trailers, so it must paint after them.
    const t = START.dispatch + 200 + 6600
    const at = resolveAt(scene, t)
    expect(at.partOrder.indexOf('rig')).toBeGreaterThan(at.partOrder.indexOf('shipperTrailer'))
    expect(at.partOrder.indexOf('rig')).toBeGreaterThan(at.partOrder.indexOf('shipper'))
  })
})
