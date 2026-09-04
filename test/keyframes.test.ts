import { describe, expect, it } from 'vitest'
import {
  atKeyframe,
  compile,
  defineFigure,
  definePose,
  defineScene,
  easings,
  lerpPoints,
  posePoints,
  resolve,
} from '../src/index.ts'
import { validateScene } from '../src/validate.ts'

const bar = defineFigure('bar', {
  points: { top: [0, 0], base: [0, 10] },
  edges: [['top', 'base']],
  poses: { tip: { top: [4, 0] } },
})

const twoPart = (animate: Parameters<typeof defineScene>[1]['animate']) =>
  defineScene('s', {
    parts: [
      { figure: bar, id: 'a' },
      { figure: bar, id: 'b', at: [50, 0] },
    ],
    viewBox: [0, 0, 100, 20],
    ...(animate === undefined ? {} : { animate }),
  })

describe('keyframes', () => {
  it('moves every part named in a keyframe, in one step', () => {
    const resolved = resolve(
      twoPart({
        keyframes: [
          { name: 'apart', parts: { a: { at: [0, 0] }, b: { at: [50, 0] } } },
          { name: 'together', parts: { a: { at: [20, 0], pose: 'tip' }, b: { at: [30, 0] } } },
        ],
      }),
    )
    expect(resolved.animation?.frames.together).toEqual({
      a: { top: [24, 0], base: [20, 10] },
      b: { top: [30, 0], base: [30, 10] },
    })
    expect(resolved.animation?.parts).toEqual(['a', 'b'])
  })

  it('falls back to a part\'s own transform for fields the keyframe omits', () => {
    const resolved = resolve(
      twoPart({ keyframes: [{ name: 'posed', parts: { b: { pose: 'tip' } } }] }),
    )
    // `b` keeps its declared at: [50, 0] because the keyframe only set a pose.
    expect(resolved.animation?.frames.posed?.b).toEqual({ top: [54, 0], base: [50, 10] })
  })

  it('leaves a part out of the frame entirely when no keyframe moves it', () => {
    const resolved = resolve(twoPart({ keyframes: [{ name: 'only-a', parts: { a: { pose: 'tip' } } }] }))
    expect(Object.keys(resolved.animation?.frames['only-a'] ?? {})).toEqual(['a'])
    expect(resolved.animation?.parts).toEqual(['a'])
  })

  it('carries per-keyframe pacing, falling back to the animate defaults', () => {
    const resolved = resolve(
      twoPart({
        duration: 400,
        hold: 800,
        keyframes: [
          { name: 'cut', duration: 0, hold: 100, parts: { a: {} } },
          { name: 'slow', parts: { a: {} } },
        ],
      }),
    )
    expect(resolved.animation?.timings).toEqual({
      cut: { duration: 0, hold: 100, easing: 'easeInOut' },
      slow: { duration: 400, hold: 800, easing: 'easeInOut' },
    })
  })

  it('lets a keyframe choose its own easing, so a run of steps can stay linear', () => {
    const resolved = resolve(
      twoPart({
        easing: 'easeInOut',
        keyframes: [
          { name: 'stride', easing: 'linear', parts: { a: {} } },
          { name: 'arrive', parts: { a: {} } },
        ],
      }),
    )
    expect(resolved.animation?.timings.stride?.easing).toBe('linear')
    expect(resolved.animation?.timings.arrive?.easing).toBe('easeInOut')
  })

  it('still accepts the single-part cycle shorthand', () => {
    const resolved = resolve(defineScene('one', { parts: [{ figure: bar }], animate: { cycle: ['tip'] } }))
    expect(resolved.animation?.frames.tip?.bar).toEqual({ top: [4, 0], base: [0, 10] })
    expect(resolved.animation?.parts).toEqual(['bar'])
  })
})

describe('keyframe validation', () => {
  it('rejects a keyframe naming a part the scene does not have', () => {
    const issues = validateScene(twoPart({ keyframes: [{ name: 'k', parts: { c: {} } }] }))
    expect(issues[0]?.code).toBe('UNKNOWN_PART')
  })

  it('suggests the right pose when a keyframe misspells one', () => {
    const issues = validateScene(twoPart({ keyframes: [{ name: 'k', parts: { a: { pose: 'tpi' } } }] }))
    expect(issues[0]?.code).toBe('UNKNOWN_POSE')
    expect(issues[0]?.didYouMean).toBe('tip')
  })

  it('rejects setting both cycle and keyframes', () => {
    const issues = validateScene(twoPart({ cycle: ['tip'], part: 'a', keyframes: [{ name: 'k' }] }))
    expect(issues.map((issue) => issue.code)).toContain('AMBIGUOUS_ANIMATION')
  })

  it('rejects an animate block that sets neither', () => {
    const issues = validateScene(twoPart({}))
    expect(issues.map((issue) => issue.code)).toContain('EMPTY_CYCLE')
  })
})

describe('computed poses', () => {
  it('accepts a Pose object in a keyframe, not only a pose name', () => {
    const halfway = definePose(bar, 'halfway', lerpPoints(posePoints(bar, undefined), posePoints(bar, 'tip'), 0.5))
    const resolved = resolve(twoPart({ keyframes: [{ name: 'k', parts: { a: { pose: halfway } } }] }))
    // Halfway between the rest position (top at x 0) and `tip` (top at x 4).
    expect(resolved.animation?.frames.k?.a?.top).toEqual([2, 0])
  })

  it('validates a computed pose at build time, not at keyframe time', () => {
    expect(() => definePose(bar, 'bad', { nope: [0, 0] })).toThrow(/unknown point 'nope'/)
    // A valid one raises no scene-level issue, since it was already checked.
    const ok = definePose(bar, 'ok', { top: [1, 1] })
    expect(validateScene(twoPart({ keyframes: [{ name: 'k', parts: { a: { pose: ok } } }] }))).toEqual([])
  })

  it('keeps a foot planted at every phase between two poses, not just at the named ones', () => {
    // A leg whose foot runs from +10 to -10 across a half-stride while the body advances 10
    // holds one world position throughout — the property a walk cycle depends on.
    const leg = defineFigure('leg', {
      points: { hip: [0, 0], foot: [10, 20] },
      edges: [['hip', 'foot']],
      poses: { front: { foot: [10, 20] }, back: { foot: [-10, 20] } },
    })
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const mid = definePose(leg, `p${t}`, lerpPoints(posePoints(leg, 'front'), posePoints(leg, 'back'), t))
      const resolved = resolve(
        defineScene('s', {
          parts: [{ figure: leg, id: 'l' }],
          viewBox: [0, 0, 100, 40],
          animate: { keyframes: [{ name: 'k', parts: { l: { at: [t * 20, 0], pose: mid } } }] },
        }),
      )
      expect(resolved.animation?.frames.k?.l?.foot?.[0]).toBeCloseTo(10, 6)
    }
  })
})

describe('atKeyframe', () => {
  it('stages the scene at one step without mutating the original', () => {
    const scene = twoPart({ keyframes: [{ name: 'k', parts: { a: { at: [10, 0], pose: 'tip' } } }] })
    const staged = atKeyframe(scene, 'k')
    expect(staged.parts[0]?.at).toEqual([10, 0])
    expect(staged.parts[0]?.pose).toBe('tip')
    expect(scene.parts[0]?.at).toBeUndefined()
  })

  it('returns the scene untouched for a name it does not know', () => {
    const scene = twoPart({ keyframes: [{ name: 'k' }] })
    expect(atKeyframe(scene, 'nope')).toBe(scene)
  })
})

describe('compiled payload', () => {
  it('nests frames by part so two parts with the same point names cannot collide', () => {
    const out = compile(
      twoPart({ keyframes: [{ name: 'k', parts: { a: { at: [1, 0] }, b: { at: [2, 0] } } }] }),
    )
    const payload = JSON.parse(out.html.match(/data-dotscene-poses="s">(.*?)<\/script>/s)![1]!)
    expect(payload.frames.k.a.top).toEqual([1, 0])
    expect(payload.frames.k.b.top).toEqual([2, 0])
  })
})

describe('continuous motion', () => {
  const walker = defineFigure('walker', {
    points: { foot: [0, 10], hip: [0, 0] },
    edges: [['hip', 'foot']],
  })

  /** Position of a part at time `ms` into the cycle, the way the runtime computes it. */
  const track = (animation: NonNullable<ReturnType<typeof resolve>['animation']>, ms: number): number => {
    let clock = 0
    for (let i = 1; i < animation.cycle.length; i++) {
      const name = animation.cycle[i]!
      const { duration, easing } = animation.timings[name]!
      if (ms <= clock + duration) {
        const t = duration === 0 ? 1 : (ms - clock) / duration
        const eased = easings[easing](t)
        const from = animation.frames[animation.cycle[i - 1]!]!.p!.hip![0]
        const to = animation.frames[name]!.p!.hip![0]
        return from + (to - from) * eased
      }
      clock += duration + animation.timings[name]!.hold
    }
    return animation.frames[animation.cycle.at(-1)!]!.p!.hip![0]
  }

  const run = (easing: 'linear' | 'easeInOut') =>
    resolve(
      defineScene('run', {
        parts: [{ figure: walker, id: 'p' }],
        viewBox: [0, 0, 100, 20],
        animate: {
          keyframes: [0, 10, 20, 30].map((x) => ({
            name: `k${x}`,
            at: undefined,
            duration: 100,
            hold: 0,
            easing,
            parts: { p: { at: [x, 0] as const } },
          })),
        },
      }),
    ).animation!

  it('moves at a constant speed through a run of equal linear keyframes', () => {
    const animation = run('linear')
    // Sample either side of the keyframe boundary at 100ms. Equal speed across it is what
    // makes a walk read as continuous rather than as a series of lunges.
    const before = track(animation, 90) - track(animation, 80)
    const across = track(animation, 105) - track(animation, 95)
    const after = track(animation, 190) - track(animation, 180)
    expect(across).toBeCloseTo(before, 4)
    expect(after).toBeCloseTo(before, 4)
  })

  it('stalls at every boundary when each step eases, which is the jerk to avoid', () => {
    const animation = run('easeInOut')
    const midStep = track(animation, 55) - track(animation, 45)
    const atBoundary = track(animation, 103) - track(animation, 97)
    // Speed at the keyframe collapses towards zero, so the figure visibly stops and restarts.
    expect(atBoundary).toBeLessThan(midStep * 0.2)
  })
})
