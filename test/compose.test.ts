import { describe, expect, it } from 'vitest'
import { compose, defineFigure, defineScene, loopGaps, resolve, type Act } from '../src/index.ts'
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

  it('resamples a part that is mid-move through another act\'s keyframe', () => {
    // Without resampling, `slow` would freeze at 0 through t=500 and then jump.
    const { keyframes } = compose([
      { act: slide('slow', 'slow', 0, 100, 1000), at: 0 },
      { act: slide('quick', 'quick', 0, 10, 0), at: 500 },
    ])
    const middle = keyframes.find((k) => k.name === 't500')
    expect(middle).toBeDefined()
    expect(xOf(middle, 'slow')).toBe(50)
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

  it('bakes an eased segment into samples, since the runtime only walks straight lines', () => {
    const linear = compose([{ act: slide('a', 'token', 0, 100, 900), at: 0 }])
    const eased = compose([{ act: slide('a', 'token', 0, 100, 900, 'easeInOut'), at: 0 }], { maxStep: 150 })
    expect(linear.keyframes).toHaveLength(2)
    expect(eased.keyframes.length).toBeGreaterThan(5)
    // Halfway through an easeInOut is still halfway along; a quarter through is not.
    expect(xOf(eased.keyframes.find((k) => k.name === 't450'), 'token')).toBeCloseTo(50, 5)
    expect(xOf(eased.keyframes.find((k) => k.name === 't150'), 'token')!).toBeLessThan(25)
  })

  it('leaves a linear segment alone, so nothing pays for easing it does not use', () => {
    const { keyframes } = compose([{ act: slide('a', 'token', 0, 100, 5000), at: 0 }], { maxStep: 100 })
    expect(keyframes).toHaveLength(2)
  })

  it('interpolates a pose when a resample lands inside a pose change', () => {
    const posed: Act = {
      name: 'posed',
      beats: [
        { at: 0, parts: { fig: { pose: 'idle' } } },
        { at: 1000, parts: { fig: { pose: 'up' } } },
      ],
    }
    const withPose = defineFigure('withPose', {
      points: { a: [0, 0], b: [4, 0] },
      edges: [['a', 'b']],
      poses: { idle: {}, up: { a: [0, -10] } },
    })
    const { keyframes } = compose(
      [{ act: posed, at: 0 }, { act: slide('other', 'other', 0, 1, 0), at: 500 }],
      { parts: [{ figure: withPose, id: 'fig' }] },
    )
    const middle = keyframes.find((k) => k.name === 't500')
    const pose = middle?.parts?.fig?.pose
    expect(typeof pose).toBe('object')
    // Halfway between a at y 0 and a at y -10.
    expect((pose as { points: Record<string, readonly [number, number]> }).points.a).toEqual([0, -5])
  })

  it('interpolates depth, so a part crosses the stack where the numbers cross', () => {
    const diving: Act = {
      name: 'dive',
      beats: [
        { at: 0, parts: { mover: { at: [0, 0], depth: 1 } } },
        { at: 1000, parts: { mover: { at: [10, 0], depth: 3 } } },
      ],
    }
    const { keyframes } = compose([
      { act: diving, at: 0 },
      { act: slide('tick', 'tick', 0, 1, 0), at: 250 },
    ])
    expect(keyframes.find((k) => k.name === 't250')?.parts?.mover?.depth).toBe(1.5)
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
    expect(acts.t1000).toEqual(expect.arrayContaining(['haul', 'ping']))
  })
})

describe('loopGaps', () => {
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
    // Both are in flight at t=400, which is the whole point of composing.
    expect(Object.keys(resolved.animation?.frames.t400 ?? {}).sort()).toEqual(['left', 'right'])
  })
})
