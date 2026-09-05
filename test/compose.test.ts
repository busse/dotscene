import { describe, expect, it } from 'vitest'
import { compose, defineFigure, defineScene, loopGaps, resolve, resolveAt, type Act } from '../src/index.ts'
import { isIssueError } from '../src/validate.ts'

const chip = defineFigure('chip', {
  points: { a: [0, 0], b: [4, 0] },
  edges: [['a', 'b']],
  poses: { up: { a: [0, -10] } },
})

/** A token that slides from x to y over `span` ms. */
const slide = (name: string, part: string, from: number, to: number, span: number, easing?: 'easeInOut'): Act => ({
  name,
  beats: [
    { at: 0, parts: { [part]: { at: [from, 0] } } },
    { at: span, parts: { [part]: { at: [to, 0] } }, ...(easing === undefined ? {} : { easing }) },
  ],
})

const xOf = (frame: { parts?: Record<string, { at?: readonly [number, number] }> } | undefined, part: string) =>
  frame?.parts?.[part]?.at?.[0]

describe('compose', () => {
  it('turns one act into keyframes at the times it asked for', () => {
    const { keyframes, duration } = compose([{ act: slide('a', 'token', 0, 100, 1000), at: 0 }])
    expect(keyframes.map((k) => k.name)).toEqual(['t0', 't1000'])
    expect(keyframes[0]?.duration).toBe(0) // the loop's cut
    expect(keyframes[1]?.duration).toBe(1000)
    expect(duration).toBe(1000)
  })

  it('offsets an act by where it is placed', () => {
    const { keyframes } = compose([{ act: slide('a', 'token', 0, 100, 500), at: 2000 }])
    expect(keyframes.map((k) => k.name)).toEqual(['t2000', 't2500'])
  })

  it('leaves a part out of the keyframes another act asked for, since the runtime interpolates per part', () => {
    // Restating `slow` at t=500 would be correct but wasteful: the timeline reads it as
    // halfway along anyway, because it interpolates between the keyframes that mention it.
    const { keyframes } = compose([
      { act: slide('slow', 'slow', 0, 100, 1000), at: 0 },
      { act: slide('quick', 'quick', 0, 10, 0), at: 500 },
    ])
    const middle = keyframes.find((k) => k.name === 't500')
    expect(middle).toBeDefined()
    expect(middle?.parts?.slow).toBeUndefined()
    // `quick` has two beats at the same instant; the later one wins.
    expect(xOf(middle, 'quick')).toBe(10)
  })

  it('reads a part halfway along through a keyframe that does not mention it', () => {
    const { keyframes } = compose([
      { act: slide('slow', 'slow', 0, 100, 1000), at: 0 },
      { act: slide('quick', 'quick', 0, 10, 0), at: 500 },
    ])
    const scene = defineScene('sparse', {
      parts: [
        { figure: chip, id: 'slow' },
        { figure: chip, id: 'quick' },
      ],
      viewBox: [-10, -10, 120, 20],
      animate: { mode: 'loop', keyframes },
    })
    const at500 = resolveAt(scene, 500)
    expect(at500.dots.find((d) => d.part === 'slow' && d.point === 'a')?.at).toEqual([50, 0])
  })

  it('leaves a part alone outside its own span, so it parks where it was left', () => {
    const { keyframes } = compose([
      { act: slide('early', 'early', 0, 10, 200), at: 0 },
      { act: slide('late', 'late', 0, 10, 200), at: 1000 },
    ])
    const atEnd = keyframes.find((k) => k.name === 't1200')
    expect(atEnd?.parts?.early).toBeUndefined()
    expect(atEnd?.parts?.late).toBeDefined()
  })

  it('writes a beat\'s easing onto its keyframe rather than baking samples', () => {
    const eased = compose([{ act: slide('a', 'token', 0, 100, 900, 'easeInOut'), at: 0 }])
    expect(eased.keyframes).toHaveLength(2)
    expect(eased.keyframes[1]?.easing).toBe('easeInOut')
    expect(eased.keyframes[1]?.parts?.token?.easing).toBeUndefined()
  })

  it('lets two parts arrive at one instant each their own way', () => {
    const { keyframes } = compose([
      { act: slide('a', 'soft', 0, 100, 900, 'easeInOut'), at: 0 },
      { act: slide('b', 'hard', 0, 100, 900), at: 0 },
    ])
    const end = keyframes.find((k) => k.name === 't900')
    // One easing wins the keyframe; the other part carries its own.
    const own = [end?.parts?.soft?.easing, end?.parts?.hard?.easing].filter((e) => e !== undefined)
    expect(own).toHaveLength(1)
    const scene = defineScene('two', {
      parts: [
        { figure: chip, id: 'soft' },
        { figure: chip, id: 'hard' },
      ],
      viewBox: [-10, -10, 120, 20],
      animate: { mode: 'loop', keyframes },
    })
    const at450 = resolveAt(scene, 450)
    const x = (part: string) => at450.dots.find((d) => d.part === part && d.point === 'a')?.at[0]
    expect(x('hard')).toBe(50)
    expect(x('soft')).toBe(50)
    const at225 = resolveAt(scene, 225)
    expect(at225.dots.find((d) => d.part === 'hard' && d.point === 'a')?.at[0]).toBe(25)
    expect(at225.dots.find((d) => d.part === 'soft' && d.point === 'a')?.at[0]).toBeLessThan(20)
  })

  it('never adds keyframes an act did not ask for', () => {
    const { keyframes } = compose([{ act: slide('a', 'token', 0, 100, 5000, 'easeInOut'), at: 0 }])
    expect(keyframes).toHaveLength(2)
  })

  it('interpolates depth and opacity along an eased segment', () => {
    const diving: Act = {
      name: 'dive',
      beats: [
        { at: 0, parts: { mover: { at: [0, 0], depth: 1, opacity: 0 } } },
        { at: 1000, parts: { mover: { at: [10, 0], depth: 3, opacity: 1 } }, easing: 'easeInOut' },
      ],
    }
    const scene = defineScene('dive', {
      parts: [{ figure: chip, id: 'mover', depth: 1, opacity: 0 }],
      viewBox: [-10, -10, 40, 20],
      animate: { mode: 'loop', keyframes: compose([{ act: diving, at: 0 }]).keyframes },
    })
    const half = resolveAt(scene, 500)
    expect(half.opacities?.mover).toBeCloseTo(0.5, 5)
    expect(half.dots.find((d) => d.point === 'a')?.at[0]).toBe(5)
  })

  it('carries the camera as a track of its own', () => {
    const shot: Act = {
      name: 'shot',
      beats: [
        { at: 0, camera: { at: [0, 0], width: 100 } },
        { at: 1000, camera: { at: [50, 0], width: 40 }, easing: 'easeInOut' },
      ],
    }
    const { keyframes } = compose([{ act: shot, at: 0 }])
    expect(keyframes.map((k) => k.name)).toEqual(['t0', 't1000'])
    expect(keyframes[1]?.camera).toEqual({ at: [50, 0], width: 40 })
    expect(keyframes[1]?.easing).toBe('easeInOut')
    expect(keyframes[1]?.parts).toEqual({})
  })

  it('rejects two acts moving the camera at once', () => {
    const shot = (name: string): Act => ({
      name,
      beats: [
        { at: 0, camera: { at: [0, 0], width: 100 } },
        { at: 1000, camera: { at: [50, 0], width: 40 } },
      ],
    })
    expect(() => compose([{ act: shot('a'), at: 0 }, { act: shot('b'), at: 500 }])).toThrow(/camera/)
  })

  it('rejects two acts driving one part at the same time', () => {
    let caught: unknown
    try {
      compose([
        { act: slide('first', 'truck', 0, 50, 1000), at: 0 },
        { act: slide('second', 'truck', 50, 90, 1000), at: 400 },
      ])
    } catch (error) {
      caught = error
    }
    expect(isIssueError(caught)).toBe(true)
    const [issue] = (caught as { issues: readonly { code: string; part?: string }[] }).issues
    expect(issue?.code).toBe('ACT_OVERLAP')
    expect(issue?.part).toBe('truck')
  })

  it('allows two acts to touch end to end, which is how a part is handed on', () => {
    expect(() =>
      compose([
        { act: slide('first', 'truck', 0, 50, 1000), at: 0 },
        { act: slide('second', 'truck', 50, 90, 1000), at: 1000 },
      ]),
    ).not.toThrow()
  })

  it('records which acts contribute to each keyframe', () => {
    const { acts } = compose([
      { act: slide('haul', 'truck', 0, 90, 2000), at: 0 },
      { act: slide('ping', 'token', 0, 10, 0), at: 1000 },
    ])
    expect(acts.t1000).toEqual(['ping'])
    expect(acts.t2000).toEqual(['haul'])
  })
})

describe('loopGaps', () => {
  it('judges each part on its own first and last mention, since keyframes are sparse', () => {
    const early: Act = { name: 'early', beats: [{ at: 0, parts: { a: { at: [0, 0] } } }, { at: 100, parts: { a: { at: [5, 0] } } }] }
    const late: Act = { name: 'late', beats: [{ at: 0, parts: { b: { at: [0, 0] } } }, { at: 100, parts: { b: { at: [0, 0] } } }] }
    expect(loopGaps(compose([{ act: early, at: 0 }, { act: late, at: 1000 }]))).toEqual(['a'])
  })

  it('counts a fade as a gap, since an opaque start and a vanished end would pop at the cut', () => {
    const fade: Act = { name: 'fade', beats: [{ at: 0, parts: { a: { at: [0, 0], opacity: 1 } } }, { at: 100, parts: { a: { at: [0, 0], opacity: 0 } } }] }
    expect(loopGaps(compose([{ act: fade, at: 0 }]))).toEqual(['a'])
  })

  it('names a part that does not end where it started', () => {
    const drift: Act = {
      name: 'drift',
      beats: [
        { at: 0, parts: { a: { at: [0, 0] }, b: { at: [0, 0] } } },
        { at: 100, parts: { a: { at: [0, 0] }, b: { at: [9, 0] } } },
      ],
    }
    expect(loopGaps(compose([{ act: drift, at: 0 }]))).toEqual(['b'])
  })

  it('is empty when everything comes home', () => {
    const round: Act = {
      name: 'round',
      beats: [
        { at: 0, parts: { a: { at: [0, 0] } } },
        { at: 100, parts: { a: { at: [9, 0] } } },
        { at: 200, parts: { a: { at: [0, 0] } } },
      ],
    }
    expect(loopGaps(compose([{ act: round, at: 0 }]))).toEqual([])
  })
})

describe('composed output drives a real scene', () => {
  it('resolves into frames the runtime can play', () => {
    const { keyframes } = compose([
      { act: slide('a', 'left', -20, 20, 800), at: 0 },
      { act: slide('b', 'right', 20, -20, 800), at: 400 },
    ])
    const scene = defineScene('woven', {
      parts: [
        { figure: chip, id: 'left' },
        { figure: chip, id: 'right' },
      ],
      viewBox: [-40, -10, 80, 20],
      animate: { mode: 'loop', keyframes },
    })
    const resolved = resolve(scene)
    expect([...(resolved.animation?.parts ?? [])].sort()).toEqual(['left', 'right'])
    // Only `right` has a beat at t=400; `left` is read off its own segment.
    expect(Object.keys(resolved.animation?.frames.t400 ?? {})).toEqual(['right'])
    const at600 = resolveAt(scene, 600)
    const x = (part: string) => at600.dots.find((d) => d.part === part && d.point === 'a')?.at[0]
    // Both are in flight at t=600, which is the whole point of composing.
    expect(x('left')).toBe(10)
    expect(x('right')).toBe(10)
  })
})
