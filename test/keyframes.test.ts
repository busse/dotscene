import { describe, expect, it } from 'vitest'
import { atKeyframe, compile, defineFigure, defineScene, resolve } from '../src/index.ts'
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
      cut: { duration: 0, hold: 100 },
      slow: { duration: 400, hold: 800 },
    })
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
