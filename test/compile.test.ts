import { describe, expect, it } from 'vitest'
import { compile, defineFigure, defineScene, resolve } from '../src/index.ts'

const bar = defineFigure('bar', {
  points: { top: [0, 0], base: [0, 10] },
  edges: [['top', 'base']],
  poses: { tip: { top: [4, 0] } },
})

describe('compile', () => {
  it('emits a static scene as bare SVG — no payload, no script tag', () => {
    const out = compile(defineScene('bar', { parts: [{ figure: bar }] }))
    expect(out.animated).toBe(false)
    expect(out.html).toBe(out.svg)
    expect(out.html).not.toContain('<script')
  })

  it('emits an animated scene with its frames and the runtime tag', () => {
    const out = compile(
      defineScene('bar', { parts: [{ figure: bar }], animate: { cycle: ['tip'] } }),
      { runtimeSrc: '/js/dotscene.js' },
    )
    expect(out.animated).toBe(true)
    expect(out.html).toContain('<script type="application/json" data-dotscene-poses="bar">')
    expect(out.html).toContain('<script src="/js/dotscene.js" defer></script>')

    const payload = JSON.parse(out.html.match(/data-dotscene-poses="bar">(.*?)<\/script>/s)![1]!)
    expect(payload.frames.tip.bar).toEqual({ top: [4, 0], base: [0, 10] })
    expect(payload.mode).toBe('loop')
    expect(payload.timings.tip).toEqual({ duration: 700, hold: 900 })
  })

  it('produces identical output on repeated runs', () => {
    const scene = defineScene('bar', { parts: [{ figure: bar }], animate: { cycle: ['tip'] } })
    expect(compile(scene).html).toBe(compile(scene).html)
  })
})

describe('dot sizing', () => {
  const scaled = (scale: number) =>
    resolve(defineScene('s', { parts: [{ figure: bar, scale }] })).dotRadius

  it('tracks the scene detail level rather than a fixed unit', () => {
    expect(scaled(4)).toBeGreaterThan(scaled(1))
    expect(scaled(1)).toBeGreaterThan(scaled(0.25))
  })

  it('keeps a figure the same relative weight at any authoring scale', () => {
    // A figure drawn ten times larger should get dots ten times larger, so the two render
    // identically once scaled to the same size on screen.
    expect(scaled(10) / scaled(1)).toBeCloseTo(10, 1)
  })

  it('lets a scene set the radius explicitly', () => {
    const resolved = resolve(defineScene('s', { parts: [{ figure: bar }], dotRadius: 5, lineWidth: 3 }))
    expect(resolved.dotRadius).toBe(5)
    expect(resolved.lineWidth).toBe(3)
  })

  it('falls back to the viewBox when a scene has no edges to measure', () => {
    const dots = defineFigure('dots', { points: { a: [0, 0], b: [50, 50] }, edges: [] })
    expect(resolve(defineScene('s', { parts: [{ figure: dots }] })).dotRadius).toBeGreaterThan(0)
  })
})
