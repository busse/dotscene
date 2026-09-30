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
    querySelectorAll: (selector: string) =>
      selector.startsWith('circle') ? Object.values(dots) : selector.startsWith('polygon') ? [] : [line],
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

/** Wrap a part's points in the scene-frame shape the compiler emits. */
/** The bar's frame, packed in its points order: top, then base. */
const forBar = (points: { top: readonly [number, number]; base?: readonly [number, number] }) => ({
  bar: [...points.top, ...(points.base ?? [])],
})

const timing = (names: readonly string[], duration = 100, hold = 100) =>
  Object.fromEntries(names.map((name) => [name, { duration, hold }]))

const config = (overrides: Partial<SceneConfig> = {}): SceneConfig => ({
  cycle: ['a', 'b'],
  points: { bar: ['top', 'base'] },
  frames: {
    a: forBar({ top: [0, 0], base: [0, 10] }),
    b: forBar({ top: [10, 0], base: [0, 10] }),
  },
  timings: timing(['a', 'b']),
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
        a: forBar({ top: [0, 0], base: [0, 10] }),
        b: forBar({ top: [10, 0], base: [0, 10] }),
        c: forBar({ top: [20, 0], base: [0, 10] }),
      },
      timings: timing(['a', 'b', 'c']),
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
    mountScene(svg, config({ frames: { a: forBar({ top: [3, 3] }), b: forBar({ top: [9, 3] }) } }))
    expect(svg.dots.base.attrs.cy).toBe('10')
  })
})

describe('multi-part scenes', () => {
  /** Two parts that move independently, the shape a staged animation produces. */
  const twoPartSvg = () => {
    const walker = element({ 'data-p': 'head', 'data-part': 'walker', cx: '0', cy: '0' })
    const bag = element({ 'data-p': 'tie', 'data-part': 'bag', cx: '0', cy: '0' })
    const line = element({ 'data-a': 'head', 'data-b': 'head', 'data-part': 'walker' })
    return {
      walker,
      bag,
      querySelectorAll: (selector: string) =>
        selector.startsWith('circle') ? [walker, bag] : selector.startsWith('polygon') ? [] : [line],
      addEventListener: () => {},
      removeEventListener: () => {},
    }
  }

  const twoPartConfig: SceneConfig = {
    cycle: ['start', 'end'],
    points: { walker: ['head'], bag: ['tie'] },
    frames: {
      start: { walker: [0, 0], bag: [10, 0] },
      end: { walker: [100, 0], bag: [110, 0] },
    },
    timings: { start: { duration: 100, hold: 100 }, end: { duration: 100, hold: 100 } },
    easing: 'linear',
    mode: 'loop',
  }

  it('moves each part to its own position in the frame', () => {
    const svg = twoPartSvg()
    const handle = mountScene(svg, twoPartConfig)
    handle.goTo('end')
    expect(svg.walker.attrs.cx).toBe('100')
    expect(svg.bag.attrs.cx).toBe('110')
  })

  it('interpolates the parts independently', () => {
    const svg = twoPartSvg()
    mountScene(svg, twoPartConfig)
    observed[0]!.fire(true)
    run(160)
    const walkerAt = Number(svg.walker.attrs.cx)
    const bagAt = Number(svg.bag.attrs.cx)
    expect(walkerAt).toBeGreaterThan(0)
    expect(walkerAt).toBeLessThan(100)
    // The bag keeps its 10-unit offset the whole way across.
    expect(bagAt - walkerAt).toBeCloseTo(10, 5)
  })

  it('cuts instantly into a keyframe whose duration is zero', () => {
    const svg = twoPartSvg()
    mountScene(svg, {
      ...twoPartConfig,
      timings: { start: { duration: 0, hold: 100 }, end: { duration: 100, hold: 0 } },
    })
    observed[0]!.fire(true)
    // 100ms hold at `start`, 100ms moving to `end`, no hold there, then the wrap into
    // `start` — which takes no time at all, so the position snaps rather than sliding back.
    run(280)
    expect(svg.walker.attrs.cx).toBe('0')
  })
})

describe('moving faces', () => {
  it('moves a polygon\'s rim along with the points it is named for', () => {
    const dot = element({ 'data-p': 'a', 'data-part': 'bar' })
    const face = element({ 'data-face': 'a b', 'data-part': 'bar', points: '0,0 1,1' })
    const svg = {
      querySelectorAll: (selector: string) =>
        selector.startsWith('circle') ? [dot] : selector.startsWith('polygon') ? [face] : [],
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    const handle = mountScene(svg, {
      cycle: ['start', 'end'],
      points: { bar: ['a', 'b'] },
      frames: {
        start: { bar: [0, 0, 1, 1] },
        end: { bar: [10, 0, 11, 1] },
      },
      timings: { start: { duration: 100, hold: 100 }, end: { duration: 100, hold: 100 } },
      easing: 'linear',
      mode: 'loop',
    })
    handle.goTo('end')
    expect(face.attrs.points).toBe('10,0 11,1')
  })
})

describe('re-stacking by depth', () => {
  /** A parent that records the order its children end up in, the way the DOM would. */
  const stage = (parts: readonly string[]) => {
    const order = [...parts]
    const parent = {
      appendChild: (child: { part: string }) => {
        order.splice(order.indexOf(child.part), 1)
        order.push(child.part)
      },
    }
    const groups = parts.map((part) => ({
      part,
      parentNode: parent,
      getAttribute: (name: string) => (name === 'data-part' ? part : null),
    }))
    return {
      order,
      svg: {
        querySelectorAll: (selector: string) =>
          selector.startsWith('g[') ? groups : selector.startsWith('circle') ? [] : [],
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    }
  }

  const config = (
    base: Record<string, number>,
    byFrame: Record<string, Record<string, number>>,
  ): SceneConfig => ({
    cycle: ['start', 'end'],
    points: {},
    frames: { start: {}, end: {} },
    timings: { start: { duration: 100, hold: 100 }, end: { duration: 100, hold: 100 } },
    depths: { base, byFrame },
    easing: 'linear',
    mode: 'loop',
  })

  it('sorts the groups to match the depths of the frame it settles on', () => {
    const { order, svg } = stage(['ground', 'truck', 'shed'])
    const handle = mountScene(
      svg,
      config({ ground: 0, truck: 1, shed: 2 }, { start: {}, end: { truck: 3 } }),
    )
    handle.goTo('end')
    expect(order).toEqual(['ground', 'shed', 'truck'])
  })

  it('crosses the stack partway through a transition, where the depths actually cross', () => {
    const { order, svg } = stage(['ground', 'truck', 'shed'])
    mountScene(svg, config({ ground: 0, truck: 1, shed: 2 }, { start: {}, end: { truck: 3 } }))
    observed[0]!.fire(true)
    run(140) // past the 100ms hold, a little way into the move: truck is still behind
    expect(order).toEqual(['ground', 'truck', 'shed'])
    run(120) // further along, the truck's depth has passed the shed's
    expect(order).toEqual(['ground', 'shed', 'truck'])
  })

  it('never touches the DOM for a scene that does not animate depth', () => {
    const { order, svg } = stage(['a', 'b'])
    const bare: SceneConfig = {
      cycle: ['one'],
      points: {},
      frames: { one: {} },
      timings: { one: { duration: 0, hold: 100 } },
      easing: 'linear',
      mode: 'loop',
    }
    mountScene(svg, bare)
    observed[0]?.fire(true)
    run(400)
    expect(order).toEqual(['a', 'b'])
  })
})

describe('camera and fades', () => {
  /** A scene with one dot, a ground rect, a clip rect and a group — enough to watch the camera. */
  const cameraSvg = () => {
    const dot = element({ 'data-p': 'a', 'data-part': 'chip', cx: '0', cy: '0' })
    const ground = element({ class: 'ds-bg', x: '0', y: '0', width: '100', height: '50' })
    const clip = element({ class: 'ds-clip', x: '0', y: '0', width: '100', height: '50' })
    const group = { ...element({ 'data-part': 'chip' }), parentNode: null }
    const style: Record<string, string> = {}
    const svgAttrs: Record<string, string> = { viewBox: '0 0 100 50' }
    const svg = {
      dot,
      ground,
      clip,
      group,
      style: { setProperty: (name: string, value: string) => { style[name] = value } },
      styles: style,
      attrs: svgAttrs,
      querySelectorAll: (selector: string) =>
        selector.startsWith('circle')
          ? [dot]
          : selector.startsWith('rect.ds-bg')
            ? [ground]
            : selector.startsWith('rect.ds-clip')
              ? [clip]
              : selector.startsWith('g[')
                ? [group]
                : [],
      addEventListener: () => {},
      removeEventListener: () => {},
      hasAttribute: () => false,
      setAttribute: (name: string, value: string) => { svgAttrs[name] = value },
      getAttribute: (name: string) => svgAttrs[name] ?? null,
    }
    return svg
  }

  const shot: SceneConfig = {
    cycle: ['wide', 'close'],
    points: { chip: ['a'] },
    frames: { wide: { chip: [0, 0] }, close: { chip: [50, 0] } },
    timings: { wide: { duration: 0, hold: 0 }, close: { duration: 1000, hold: 0 } },
    easing: 'linear',
    mode: 'loop',
    camera: { base: [0, 0, 100, 50], byFrame: { wide: [0, 0, 100, 50], close: [50, 10, 40, 20] } },
    opacity: { base: {}, byFrame: { wide: { chip: 0 }, close: { chip: 1 } } },
    sizing: 'screen',
  }

  it('moves the viewBox, the clip and the ground with the camera, and writes the zoom for screen sizing', () => {
    const svg = cameraSvg()
    const handle = mountScene(svg, shot)
    handle.seek(500)
    expect(svg.attrs.viewBox).toBe('25 5 70 35')
    expect(svg.clip.attrs.width).toBe('70')
    expect(svg.ground.attrs.x).toBe('25')
    expect(svg.styles['--ds-zoom']).toBe('0.7000')
    expect(svg.dot.attrs.cx).toBe('25')
  })

  it('fades a part by writing opacity onto its group', () => {
    const svg = cameraSvg()
    const handle = mountScene(svg, shot)
    expect(svg.group.attrs.opacity).toBe('0')
    handle.seek(250)
    expect(svg.group.attrs.opacity).toBe('0.25')
  })

  it('reports its clock and lap, and resumes from where it paused', () => {
    const svg = cameraSvg()
    const handle = mountScene(svg, shot)
    expect(handle.duration).toBe(1000)
    observed[0]!.fire(true)
    run(300)
    handle.pause()
    const frozen = handle.time()
    run(300)
    expect(handle.time()).toBe(frozen)
    handle.play()
    run(200)
    expect(handle.time()).toBeGreaterThan(frozen)
  })
})

describe('what a host can rely on', () => {
  it('play() starts the loop even when reduced motion held it at mount', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const svg = fakeSvg()
    const handle = mountScene(svg, config())
    run(200)
    expect(handle.time()).toBe(0)
    expect(handle.playing()).toBe(false)
    handle.play()
    run(160)
    expect(handle.playing()).toBe(true)
    expect(handle.time()).toBeGreaterThan(0)
  })

  it('play() starts a scene the observer never saw come into view', () => {
    const svg = fakeSvg()
    const handle = mountScene(svg, config())
    run(200)
    expect(handle.playing()).toBe(false)
    handle.play()
    run(160)
    expect(handle.playing()).toBe(true)
  })

  it('reports paused as paused, not as never started', () => {
    const svg = fakeSvg()
    const handle = mountScene(svg, config())
    observed[0]!.fire(true)
    run(64)
    expect(handle.playing()).toBe(true)
    handle.pause()
    expect(handle.playing()).toBe(false)
    const at = handle.time()
    run(64)
    expect(handle.time()).toBe(at)
  })

  it('moves children that carry no data-part of their own, by the group they sit in', () => {
    const group = { getAttribute: (name: string) => (name === 'data-part' ? 'bar' : null) }
    const dots = {
      top: { ...element({ 'data-p': 'top', cx: '0', cy: '0' }), closest: () => group },
      base: { ...element({ 'data-p': 'base', cx: '0', cy: '10' }), closest: () => group },
    }
    const line = { ...element({ 'data-a': 'top', 'data-b': 'base' }), closest: () => group }
    const svg = {
      querySelectorAll: (selector: string) =>
        selector.startsWith('circle') ? Object.values(dots) : selector.startsWith('polygon') ? [] : selector.startsWith('g') ? [] : [line],
      addEventListener: () => {},
      removeEventListener: () => {},
      hasAttribute: () => false,
      setAttribute: () => {},
      getAttribute: () => null,
    }
    const handle = mountScene(svg, config())
    handle.play()
    run(160)
    expect(Number(dots.top.attrs.cx)).toBeGreaterThan(0)
    expect(Number(line.attrs.x1)).toBeGreaterThan(0)
  })
})
