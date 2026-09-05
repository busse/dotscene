import { describe, expect, it } from 'vitest'
import {
  buildTracks,
  clockAt,
  compose,
  defineFigure,
  defineScene,
  lapOf,
  resolve,
  resolveAt,
  sampleAt,
  sampleTrack,
  schedule,
  type Act,
} from '../src/index.ts'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

describe('schedule', () => {
  it('lays keyframes out on one absolute clock: arrive, hold, transition, arrive', () => {
    const sched = schedule(['a', 'b', 'c'], {
      a: { duration: 300, hold: 100 },
      b: { duration: 200, hold: 50 },
      c: { duration: 400, hold: 0 },
    })
    expect(sched.arrive).toEqual([0, 300, 750])
    expect(sched.leave).toEqual([100, 350, 750])
    expect(sched.end).toBe(750)
    // The first keyframe's duration is the transition back into it at the wrap.
    expect(sched.total).toBe(1050)
  })
})

describe('sampleTrack', () => {
  const sched = schedule(['k0', 'k1', 'k2', 'k3'], {
    k0: { duration: 0, hold: 100 },
    k1: { duration: 100, hold: 100, easing: 'linear' },
    k2: { duration: 100, hold: 0, easing: 'linear' },
    k3: { duration: 100, hold: 100, easing: 'linear' },
  })
  // arrive: 0, 200, 400, 500   leave: 100, 300, 400, 600   end 600, total 600

  it('holds rest before its first keyframe, then travels in over the preceding transition', () => {
    const track = { keys: [2], values: [40] }
    expect(sampleTrack(sched, track, 0, 250, lerp, 'loop')).toBe(0)
    // The transition into k2 runs from leave[k1]=300 to arrive[k2]=400.
    expect(sampleTrack(sched, track, 0, 350, lerp, 'loop')).toBe(20)
    expect(sampleTrack(sched, track, 0, 400, lerp, 'loop')).toBe(40)
  })

  it('interpolates between the keyframes that mention it, skipping the ones that do not', () => {
    const track = { keys: [1, 3], values: [10, 70] }
    // From leave[k1]=300 to arrive[k3]=500, straight through k2.
    expect(sampleTrack(sched, track, 0, 400, lerp, 'loop')).toBe(40)
    expect(sampleTrack(sched, track, 0, 250, lerp, 'loop')).toBe(10)
  })

  it('holds after its last keyframe until the lap ends', () => {
    const track = { keys: [1], values: [10] }
    expect(sampleTrack(sched, track, 0, 590, lerp, 'loop')).toBe(10)
  })

  it('cuts back to its opening state when the wrap takes no time', () => {
    const track = { keys: [1], values: [10] }
    expect(sampleTrack(sched, track, 0, 0, lerp, 'loop')).toBe(0)
    expect(clockAt(sched, 'loop', 600)).toBe(0)
  })

  it('tweens home over the wrap when the first keyframe has a duration', () => {
    const tweened = schedule(['k0', 'k1'], { k0: { duration: 200, hold: 0, easing: 'linear' }, k1: { duration: 100, hold: 0 } })
    // arrive 0, 100; end 100; total 300
    const track = { keys: [0, 1], values: [0, 10] }
    expect(sampleTrack(tweened, track, 0, 200, lerp, 'loop')).toBe(5)
    expect(sampleTrack(tweened, track, 0, 299, lerp, 'loop')).toBeCloseTo(0.05, 5)
    // A pingpong never crosses the wrap.
    expect(sampleTrack(tweened, track, 0, 100, lerp, 'pingpong')).toBe(10)
  })

  it('eases into a keyframe by that keyframe\'s own easing', () => {
    const eased = schedule(['k0', 'k1'], { k0: { duration: 0, hold: 0 }, k1: { duration: 100, hold: 0, easing: 'easeIn' } })
    const track = { keys: [0, 1], values: [0, 100] }
    expect(sampleTrack(eased, track, 0, 50, lerp, 'loop')).toBe(25)
  })
})

describe('clockAt', () => {
  const sched = schedule(['a', 'b', 'c'], { a: { duration: 100, hold: 100 }, b: { duration: 100, hold: 100 }, c: { duration: 100, hold: 100 } })
  // arrive 0, 200, 400; leave 100, 300, 500; end 500; total 600

  it('wraps a loop at its total', () => {
    expect(lapOf(sched, 'loop')).toBe(600)
    expect(clockAt(sched, 'loop', 650)).toBe(50)
  })

  it('turns a pingpong round without holding the far end twice', () => {
    // Out to 500, then back from the last arrival (400) to 0: a lap of 900.
    expect(lapOf(sched, 'pingpong')).toBe(900)
    expect(clockAt(sched, 'pingpong', 450)).toBe(450)
    expect(clockAt(sched, 'pingpong', 550)).toBe(350)
    expect(clockAt(sched, 'pingpong', 900)).toBe(0)
  })
})

describe('sampleAt over a resolved scene', () => {
  const chip = defineFigure('chip', { points: { a: [0, 0], b: [4, 0] }, edges: [['a', 'b']] })

  const slide = (name: string, part: string, from: number, to: number, span: number, extra = {}): Act => ({
    name,
    beats: [
      { at: 0, parts: { [part]: { at: [from, 0], ...extra } } },
      { at: span, parts: { [part]: { at: [to, 0] } } },
    ],
  })

  it('moves the camera with the timeline, and the viewBox follows', () => {
    const shot: Act = {
      name: 'shot',
      beats: [
        { at: 0, camera: { at: [0, 0], width: 100 } },
        { at: 1000, camera: { at: [100, 0], width: 50 } },
      ],
    }
    const scene = defineScene('shot', {
      parts: [{ figure: chip, id: 'c' }],
      camera: { at: [0, 0], width: 100, aspect: 2 },
      animate: { mode: 'loop', keyframes: compose([{ act: shot, at: 0 }]).keyframes },
    })
    const rest = resolve(scene)
    expect(rest.viewBox).toEqual([-50, -25, 100, 50])
    expect(rest.animation?.camera?.base).toEqual([-50, -25, 100, 50])
    const half = resolveAt(scene, 500)
    expect(half.viewBox).toEqual([12.5, -18.75, 75, 37.5])
  })

  it('fades a part and drops it from the drawing once it is invisible', () => {
    const appear: Act = {
      name: 'appear',
      beats: [
        { at: 0, parts: { c: { at: [0, 0], opacity: 0 } } },
        { at: 1000, parts: { c: { at: [10, 0], opacity: 1 } } },
      ],
    }
    const scene = defineScene('fade', {
      parts: [{ figure: chip, id: 'c', opacity: 0 }],
      viewBox: [-10, -10, 40, 20],
      animate: { mode: 'loop', keyframes: compose([{ act: appear, at: 0 }]).keyframes },
    })
    const rest = resolve(scene)
    expect(rest.opacities).toEqual({ c: 0 })
    expect(rest.animation?.opacity?.base).toEqual({ c: 0 })
    expect(resolveAt(scene, 0).dots).toHaveLength(0)
    const half = resolveAt(scene, 500)
    expect(half.opacities?.c).toBeCloseTo(0.5, 5)
    expect(half.dots.find((d) => d.point === 'a')?.at).toEqual([5, 0])
  })

  it('re-stacks parts by interpolated depth', () => {
    const scene = defineScene('stack', {
      parts: [
        { figure: chip, id: 'behind', depth: 0 },
        { figure: chip, id: 'mover', depth: 1 },
        { figure: chip, id: 'front', depth: 2, at: [10, 0] },
      ],
      viewBox: [0, 0, 40, 20],
      animate: {
        mode: 'loop',
        keyframes: compose([{ act: slide('dive', 'mover', 0, 10, 1000, { depth: 1 }), at: 0 }]).keyframes.map((k, i) =>
          i === 1 ? { ...k, parts: { mover: { ...k.parts!.mover!, depth: 3 } } } : k,
        ),
      },
    })
    expect(resolveAt(scene, 400).partOrder).toEqual(['behind', 'mover', 'front'])
    expect(resolveAt(scene, 600).partOrder).toEqual(['behind', 'front', 'mover'])
  })

  it('reads every track through one sampler', () => {
    const scene = defineScene('two', {
      parts: [
        { figure: chip, id: 'x' },
        { figure: chip, id: 'y' },
      ],
      viewBox: [-10, -10, 120, 20],
      animate: {
        mode: 'loop',
        keyframes: compose([
          { act: slide('a', 'x', 0, 100, 1000), at: 0 },
          { act: slide('b', 'y', 0, 100, 1000), at: 500 },
        ]).keyframes,
      },
    })
    const resolved = resolve(scene)
    const config = {
      cycle: resolved.animation!.cycle,
      points: resolved.animation!.points,
      frames: resolved.animation!.frames,
      timings: resolved.animation!.timings,
      easing: resolved.animation!.easing,
      mode: resolved.animation!.mode,
    }
    const tracks = buildTracks(config)
    const sample = sampleAt(tracks, config, 750, { frame: {} })
    // Flat frames: point `a` is the first pair.
    expect(sample.frame.x?.[0]).toBe(75)
    expect(sample.frame.y?.[0]).toBe(25)
  })
})
