import { describe, expect, it } from 'vitest'
import { compile, renderSmil, resolve, resolveAt } from '../src/index.ts'
import { scene as island } from '../scenes/island/hero.ts'
import { scene as eszett } from '../scenes/site/eszett.ts'
import { scene as singlestone } from '../scenes/site/singlestone.ts'

/** Every `<animate>` in a document, as its attributes. */
const animations = (svg: string): Record<string, string>[] =>
  [...svg.matchAll(/<animate ([^>]*)\/>/g)].map((match) =>
    Object.fromEntries([...match[1]!.matchAll(/(\w+)="([^"]*)"/g)].map((pair) => [pair[1]!, pair[2]!])),
  )

describe('the self-playing SVG', () => {
  it('exists for animated loops and not for stills', () => {
    expect(compile(island).smil).toBeDefined()
    expect(compile(eszett).smil).toBeDefined()
    expect(renderSmil(resolve({ ...island, animate: undefined }))).toBeUndefined()
  })

  it('is well-formed: key times climb from 0 to 1, one value per key, one spline per segment', () => {
    for (const scene of [eszett, singlestone, island]) {
      const svg = renderSmil(resolve(scene))!
      const found = animations(svg)
      expect(found.length).toBeGreaterThan(0)
      for (const a of found) {
        const times = a.keyTimes!.split(';').map(Number)
        const values = a.values!.split(';')
        expect(times[0]).toBe(0)
        expect(times[times.length - 1]).toBe(1)
        for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]!)
        expect(values.length).toBe(times.length)
        if (a.calcMode === 'spline') expect(a.keySplines!.split(';').length).toBe(times.length - 1)
        else expect(a.keySplines).toBeUndefined()
        expect(a.dur).toMatch(/^[\d.]+s$/)
        expect(a.repeatCount).toBe('indefinite')
      }
    }
  })

  it('agrees with the runtime sampler at every stop of a moving dot', () => {
    const svg = renderSmil(resolve(island))!
    const lap = island.animate!.keyframes!.reduce((sum, k) => sum + (k.duration ?? 0) + (k.hold ?? 0), 0)
    // The keeper's head, x: pull its animate out of the circle that carries it.
    const circle = svg.match(/<circle [^>]*data-part="keeper" data-p="head"[^>]*>([\s\S]*?)<\/circle>/)
    expect(circle).not.toBeNull()
    const cx = animations(circle![1]!).find((a) => a.attributeName === 'cx')!
    const times = cx.keyTimes!.split(';').map(Number)
    const values = cx.values!.split(';').map(Number)
    // A sample of stops across the day, skipping any that share a time (a cut has two values).
    const picks = [3, 40, 120, 200, times.length - 2].filter((i) => i > 0 && i < times.length - 1 && times[i] !== times[i - 1] && times[i] !== times[i + 1])
    expect(picks.length).toBeGreaterThan(2)
    for (const i of picks) {
      const at = resolveAt(island, times[i]! * lap)
      const head = at.dots.find((d) => d.part === 'keeper' && d.point === 'head')!
      expect(values[i], `stop ${i} at ${times[i]! * lap} ms`).toBeCloseTo(head.at[0], 0)
    }
  })

  it('carries the camera as an animated viewBox', () => {
    const svg = renderSmil(resolve(island))!
    const view = animations(svg).find((a) => a.attributeName === 'viewBox')!
    expect(view).toBeDefined()
    expect(view.values!.split(';')[0]!.split(' ').length).toBe(4)
  })

  it('leaves still points alone: a part the timeline never moves has no animations', () => {
    const svg = renderSmil(resolve(island))!
    const lighthouse = svg.match(/<g data-part="lighthouse">([\s\S]*?)<\/g>/)!
    expect(lighthouse[1]).not.toContain('<animate')
  })
})
