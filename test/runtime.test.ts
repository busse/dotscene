/**
 * Runtime tests against a fake clock and a fake SVG.
 *
 * Browsers do not run requestAnimationFrame in a background tab, so driving the loop by
 * hand is the only way to assert on tween progress repeatably. The fakes cover exactly the
 * DOM surface the runtime touches — see src/runtime/index.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type SceneConfig, type SceneHandle } from '../src/runtime/index.ts'

interface FakeElement {
  readonly attrs: Record<string, string>
  getAttribute: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
}

const element = (attrs: Record<string, string>): FakeElement => ({
  attrs,
  getAttribute: (name) => attrs[name] ?? null,
  setAttribute: (name, value) => {
    attrs[name] = value
  },
})

interface Clock {
  now: number
  advance: (ms: number) => void
  frames: (() => void)[]
}

let clock: Clock
let observed: { target: unknown; fire: (visible: boolean) => void }[]
/**
 * The shared rAF loop is module state — correct for a page, which has exactly one, but it
 * would leak between tests. Every mount here is torn down afterwards so each case starts
 * with the loop idle.
 */
let mounted: SceneHandle[]

const mountScene = (svg: unknown, sceneConfig: SceneConfig): SceneHandle => {
  const handle = mount(svg as never, sceneConfig)
  mounted.push(handle)
  return handle
}

const fakeSvg = () => {
  const dots = {
    top: element({ 'data-p': 'top', 'data-part': 'bar', cx: '0', cy: '0' }),
    base: element({ 'data-p': 'base', 'data-part': 'bar', cx: '0', cy: '10' }),
  }
  const line = element({ 'data-a': 'top', 'data-b': 'base', 'data-part': 'bar' })
  const listeners: Record<string, (() => void)[]> = {}

  const svg = {
    dots,
    line,
    listeners,
    querySelectorAll: (selector: string) => (selector.startsWith('circle') ? Object.values(dots) : [line]),
    addEventListener: (type: string, handler: () => void) => {
      ;(listeners[type] ??= []).push(handler)
    },
    removeEventListener: (type: string, handler: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((candidate) => candidate !== handler)
    },
    hasAttribute: () => false,
    setAttribute: () => {},
    getAttribute: () => null,
  }
  return svg
}

const config = (overrides: Partial<SceneConfig> = {}): SceneConfig => ({
  part: 'bar',
  cycle: ['a', 'b'],
  frames: {
    a: { top: [0, 0], base: [0, 10] },
    b: { top: [10, 0], base: [0, 10] },
  },
  duration: 100,
  hold: 100,
  easing: 'linear',
  mode: 'loop',
  ...overrides,
})

beforeEach(() => {
  mounted = []
  clock = {
    now: 1000,
    frames: [],
    advance: (ms) => {
      clock.now += ms
      const due = clock.frames
      clock.frames = []
      for (const frame of due) frame()
    },
  }
  observed = []

  vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) => {
    clock.frames.push(() => callback(clock.now))
    return clock.frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    clock.frames = []
  })
  vi.stubGlobal('performance', { now: () => clock.now })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {}
      observe(target: unknown) {
        observed.push({ target, fire: (visible) => this.callback([{ isIntersecting: visible }]) })
      }
      disconnect() {}
    },
  )
})

afterEach(() => {
  for (const handle of mounted) handle.stop()
  vi.unstubAllGlobals()
})

/** Run the shared loop for `ms`, one 16ms frame at a time. */
const run = (ms: number): void => {
  for (let elapsed = 0; elapsed < ms; elapsed += 16) clock.advance(16)
}

describe('mount', () => {
  it('paints the first pose immediately, before anything animates', () => {
    const svg = fakeSvg()
    mountScene(svg, config())
    expect(svg.dots.top.attrs.cx).toBe('0')
    expect(svg.line.attrs.x1).toBe('0')
    expect(svg.line.attrs.y2).toBe('10')
  })

  it('holds, then tweens to the next pose', () => {
    const svg = fakeSvg()
    mountScene(svg, config())
    observed[0]!.fire(true)

    run(80)
    expect(svg.dots.top.attrs.cx).toBe('0')

    // Past the 100ms hold and halfway through a 100ms linear transition.
    run(70)
    const midpoint = Number(svg.dots.top.attrs.cx)
    expect(midpoint).toBeGreaterThan(0)
    expect(midpoint).toBeLessThan(10)

    run(120)
    expect(Number(svg.dots.top.attrs.cx)).toBe(10)
  })

  it('does not tick while scrolled out of view', () => {
    const svg = fakeSvg()
    mountScene(svg, config())
    observed[0]!.fire(true)
    observed[0]!.fire(false)
    run(1000)
    expect(svg.dots.top.attrs.cx).toBe('0')
  })

  it('holds the first pose and never starts under prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const svg = fakeSvg()
    mountScene(svg, config())
    run(1000)
    expect(svg.dots.top.attrs.cx).toBe('0')
    expect(observed).toHaveLength(0)
  })

  it('bounces at the ends of a pingpong cycle instead of wrapping', () => {
    const svg = fakeSvg()
    const three = config({
      mode: 'pingpong',
      cycle: ['a', 'b', 'c'],
      frames: {
        a: { top: [0, 0], base: [0, 10] },
        b: { top: [10, 0], base: [0, 10] },
        c: { top: [20, 0], base: [0, 10] },
      },
    })
    mountScene(svg, three)
    observed[0]!.fire(true)

    run(600) // a -> b -> c, then the bounce back toward b
    expect(Number(svg.dots.top.attrs.cx)).toBeLessThan(20)
  })

  it('advances a click-driven scene only when clicked', () => {
    const svg = fakeSvg()
    mountScene(svg, config({ mode: 'click' }))
    run(500)
    expect(svg.dots.top.attrs.cx).toBe('0')

    for (const handler of svg.listeners.click ?? []) handler()
    run(200)
    expect(Number(svg.dots.top.attrs.cx)).toBe(10)
  })

  it('jumps straight to a pose with goTo, and stops cleanly', () => {
    const svg = fakeSvg()
    const handle = mountScene(svg, config())
    handle.goTo('b')
    expect(svg.dots.top.attrs.cx).toBe('10')

    handle.stop()
    run(1000)
    expect(svg.dots.top.attrs.cx).toBe('10')
  })

  it('leaves points the frames do not mention where they are', () => {
    const svg = fakeSvg()
    mountScene(svg, config({ frames: { a: { top: [3, 3] }, b: { top: [9, 3] } } }))
    expect(svg.dots.base.attrs.cy).toBe('10')
  })
})
