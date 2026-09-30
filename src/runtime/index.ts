/**
 * The browser runtime for animated scenes.
 *
 * It moves points the compiler already labelled: dots carry `data-p`, lines carry
 * `data-a`/`data-b`, faces carry `data-face`, and the keyframes ride alongside the SVG in a
 * JSON script tag. So there is no scene graph to rebuild at runtime — just numbers written
 * onto attributes.
 *
 * Time is one clock, sampled. Every tick asks the shared timeline where each part, the
 * camera and the paint order are at millisecond `t`, and paints whatever changed. That is
 * the same sampler `dotscene preview --at` runs in the terminal, so the two never disagree.
 *
 * One rAF loop drives every scene on the page, offscreen scenes stop ticking, and
 * `prefers-reduced-motion` holds the first frame without ever starting.
 */

import type { AnimateMode, Vec2 } from '../model.ts'
import {
  buildTracks,
  clockAt,
  lapOf,
  sampleAt,
  type Frame,
  type SceneFrame,
  type TimelineConfig,
  type Tracks,
  type ViewBox,
} from '../timeline.ts'

export type { Frame, SceneFrame } from '../timeline.ts'

/** The payload a compiled scene carries. */
export type SceneConfig = TimelineConfig

export interface SceneHandle {
  /** Stop animating and drop the scene from the shared loop. */
  readonly stop: () => void
  /** Jump straight to a keyframe, skipping the transition. */
  readonly goTo: (pose: string) => void
  /** Jump to a millisecond on the clock and paint it. */
  readonly seek: (ms: number) => void
  /** Freeze where it is. */
  readonly pause: () => void
  /**
   * Start or resume, from where the clock is. Starts the loop outright, whatever trigger
   * mount installed or did not — a scene that never scrolled into view, or one held still
   * for `prefers-reduced-motion`, plays when a page asks it to.
   */
  readonly play: () => void
  /** Whether the clock is advancing right now. `time()` alone cannot tell paused from never started. */
  readonly playing: () => boolean
  /** The clock position, in milliseconds. */
  readonly time: () => number
  /** Length of one lap of the clock, in milliseconds. */
  readonly duration: number
  readonly element: SVGSVGElement
}

interface Ticker {
  readonly tick: (now: number) => void
}

const running = new Set<Ticker>()
let frameId = 0

const pump = (now: number): void => {
  for (const ticker of running) ticker.tick(now)
  frameId = running.size > 0 ? requestAnimationFrame(pump) : 0
}

const start = (ticker: Ticker): void => {
  running.add(ticker)
  if (frameId === 0) frameId = requestAnimationFrame(pump)
}

const stop = (ticker: Ticker): void => {
  running.delete(ticker)
  if (running.size === 0 && frameId !== 0) {
    cancelAnimationFrame(frameId)
    frameId = 0
  }
}

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Dots, lines and faces belonging to one part, looked up once at mount. */
interface Bindings {
  readonly dots: readonly (readonly [string, SVGCircleElement])[]
  readonly lines: readonly (readonly [string, string, SVGLineElement])[]
  readonly faces: readonly (readonly [readonly string[], SVGPolygonElement])[]
}

/** The same bindings, resolved to offsets into the part's flat frame. */
interface Wired {
  readonly dots: readonly (readonly [number, SVGCircleElement])[]
  readonly lines: readonly (readonly [number, number, SVGLineElement])[]
  readonly faces: readonly (readonly [readonly number[], SVGPolygonElement])[]
}

/**
 * Index every element in the scene by the part it belongs to.
 *
 * An element with no `data-part` is filed under `''`, which is what a hand-written SVG or an
 * older single-part build looks like — those still animate as long as the frame is keyed to
 * match.
 */
/**
 * The part an element belongs to: its own `data-part`, else that of the nearest `<g
 * data-part>` above it — so hand-written markup that labels only the group still animates —
 * else `''`, the single-part case.
 */
const partOf = (element: Element): string => {
  const own = element.getAttribute('data-part')
  if (own !== null) return own
  const group = typeof element.closest === 'function' ? element.closest('g[data-part]') : null
  return group?.getAttribute('data-part') ?? ''
}

const bindAll = (svg: SVGSVGElement): Map<string, Bindings> => {
  const dots = new Map<string, (readonly [string, SVGCircleElement])[]>()
  const lines = new Map<string, (readonly [string, string, SVGLineElement])[]>()
  const faces = new Map<string, (readonly [readonly string[], SVGPolygonElement])[]>()

  for (const element of svg.querySelectorAll<SVGCircleElement>('circle[data-p]')) {
    const part = partOf(element)
    ;(dots.get(part) ?? dots.set(part, []).get(part)!).push([element.getAttribute('data-p')!, element])
  }
  for (const element of svg.querySelectorAll<SVGLineElement>('line[data-a][data-b]')) {
    const part = partOf(element)
    ;(lines.get(part) ?? lines.set(part, []).get(part)!).push([
      element.getAttribute('data-a')!,
      element.getAttribute('data-b')!,
      element,
    ])
  }
  for (const element of svg.querySelectorAll<SVGPolygonElement>('polygon[data-face]')) {
    const part = partOf(element)
    ;(faces.get(part) ?? faces.set(part, []).get(part)!).push([element.getAttribute('data-face')!.split(' '), element])
  }

  const bindings = new Map<string, Bindings>()
  for (const part of new Set([...dots.keys(), ...lines.keys(), ...faces.keys()])) {
    bindings.set(part, { dots: dots.get(part) ?? [], lines: lines.get(part) ?? [], faces: faces.get(part) ?? [] })
  }
  return bindings
}

/**
 * Turn name bindings into offsets into the part's flat frame, `x, y, x, y…` in the order of
 * its points table. A part the payload gives no table for takes its dots' document order.
 */
const wire = (bound: Bindings, names: readonly string[]): Wired => {
  const index = new Map<string, number>()
  names.forEach((name, i) => index.set(name, i * 2))
  const at = (name: string): number => index.get(name) ?? -1
  return {
    dots: bound.dots.map(([name, element]) => [at(name), element] as const).filter(([i]) => i >= 0),
    lines: bound.lines.map(([a, b, element]) => [at(a), at(b), element] as const).filter(([a, b]) => a >= 0 && b >= 0),
    faces: bound.faces.map(([rim, element]) => [rim.map(at), element] as const),
  }
}

/**
 * What the static drawing shows, read back off the elements.
 *
 * A track holds this before its first keyframe and returns to it at the wrap, so it has to
 * be known — and reading it here costs nothing, where shipping it in the payload would
 * restate every moving part once more.
 */
const restOf = (bound: Bindings, names: readonly string[]): Frame => {
  const byName = new Map<string, Vec2>()
  for (const [name, element] of bound.dots) {
    byName.set(name, [Number(element.getAttribute('cx') ?? 0), Number(element.getAttribute('cy') ?? 0)])
  }
  const out: number[] = []
  for (const name of names) {
    const at = byName.get(name) ?? [0, 0]
    out.push(at[0], at[1])
  }
  return out
}

const paintPart = (wired: Wired, frame: Frame): void => {
  for (const [rim, element] of wired.faces) {
    let path = ''
    for (const i of rim) {
      if (i < 0 || frame[i] === undefined) continue
      path += `${path === '' ? '' : ' '}${frame[i]},${frame[i + 1]}`
    }
    if (path !== '') element.setAttribute('points', path)
  }
  for (const [i, element] of wired.dots) {
    const x = frame[i]
    if (x === undefined) continue
    element.setAttribute('cx', String(x))
    element.setAttribute('cy', String(frame[i + 1]))
  }
  for (const [a, b, element] of wired.lines) {
    const ax = frame[a]
    const bx = frame[b]
    if (ax === undefined || bx === undefined) continue
    element.setAttribute('x1', String(ax))
    element.setAttribute('y1', String(frame[a + 1]))
    element.setAttribute('x2', String(bx))
    element.setAttribute('y2', String(frame[b + 1]))
  }
}

/**
 * Re-stack the part groups when their order changes.
 *
 * Depth is interpolated like any other number, so a part crosses the stack at the moment the
 * numbers actually cross rather than at a keyframe boundary. Nothing touches the DOM unless
 * the resulting order differs from the one already on screen — a reorder is rare and a
 * comparison is cheap.
 */
const restack = (groups: Map<string, SVGGElement>, order: string[], depths: Readonly<Record<string, number>>): string[] => {
  const next = [...order].sort((a, b) => (depths[a] ?? 0) - (depths[b] ?? 0))
  if (next.every((part, index) => part === order[index])) return order
  const parent = groups.get(next[0]!)?.parentNode
  if (parent == null) return order
  for (const part of next) {
    const group = groups.get(part)
    if (group !== undefined) parent.appendChild(group)
  }
  return next
}

/** The first element matching a selector that also carries a class — fakes and all. */
const rectWithClass = (svg: SVGSVGElement, cls: string): Element | undefined => {
  for (const element of svg.querySelectorAll(`rect.${cls}`)) {
    if ((element.getAttribute('class') ?? '').split(' ').includes(cls)) return element
  }
  return undefined
}

const parseViewBox = (svg: SVGSVGElement): ViewBox | undefined => {
  const raw = typeof svg.getAttribute === 'function' ? svg.getAttribute('viewBox') : null
  if (raw === null || raw === undefined) return undefined
  const parts = raw.trim().split(/[\s,]+/).map(Number)
  return parts.length === 4 && parts.every(Number.isFinite) ? (parts as unknown as ViewBox) : undefined
}

/** Attach the runtime to one already-rendered SVG. */
export const mount = (svg: SVGSVGElement, config: SceneConfig): SceneHandle => {
  const bindings = bindAll(svg)
  const groups = new Map<string, SVGGElement>()
  for (const group of svg.querySelectorAll<SVGGElement>('g[data-part]')) {
    groups.set(group.getAttribute('data-part')!, group)
  }
  const restOpacity: Record<string, number> = {}
  for (const [part, group] of groups) {
    const raw = group.getAttribute('opacity')
    if (raw !== null) restOpacity[part] = Number(raw)
  }
  // Every part's point order: the payload's table, else the order its dots appear in.
  const names = new Map<string, readonly string[]>()
  const wired = new Map<string, Wired>()
  const restFrame: Record<string, Frame> = {}
  for (const [part, bound] of bindings) {
    const table = config.points?.[part] ?? bound.dots.map(([name]) => name)
    names.set(part, table)
    wired.set(part, wire(bound, table))
    restFrame[part] = restOf(bound, table)
  }
  const rest = { frame: restFrame, opacity: restOpacity }

  const tracks: Tracks = buildTracks(config)
  const sched = tracks.schedule
  const mode: AnimateMode = config.mode
  const lap = lapOf(sched, mode)

  // Camera plumbing: the viewBox itself, the clip and ground rects that follow it, and the
  // zoom factor scenes sized to the screen read from CSS.
  const clip = rectWithClass(svg, 'ds-clip')
  const ground = rectWithClass(svg, 'ds-bg')
  const restView = config.camera?.base ?? parseViewBox(svg)
  let lastView: ViewBox | undefined
  const applyCamera = (view: ViewBox): void => {
    if (lastView === view) return
    lastView = view
    const value = `${view[0]} ${view[1]} ${view[2]} ${view[3]}`
    svg.setAttribute('viewBox', value)
    for (const rect of [clip, ground]) {
      if (rect === undefined) continue
      rect.setAttribute('x', String(view[0]))
      rect.setAttribute('y', String(view[1]))
      rect.setAttribute('width', String(view[2]))
      rect.setAttribute('height', String(view[3]))
    }
    if (config.sizing === 'screen' && restView !== undefined && restView[2] > 0 && svg.style !== undefined) {
      svg.style.setProperty('--ds-zoom', (view[2] / restView[2]).toFixed(4))
    }
  }

  // The order the document already has, which is also the order to fall back to.
  let stack = [...groups.keys()]
  const painted = new Map<string, Frame>()
  const shown = new Map<string, number>()

  const paintAt = (t: number): void => {
    const sample = sampleAt(tracks, config, t, rest)
    for (const part of Object.keys(sample.frame)) {
      const frame = sample.frame[part]!
      // A held value is the same object every tick; only a fresh interpolation costs a paint.
      if (painted.get(part) === frame) continue
      painted.set(part, frame)
      const bound = wired.get(part)
      if (bound !== undefined) paintPart(bound, frame)
    }
    if (sample.depths !== undefined) stack = restack(groups, stack, sample.depths)
    if (sample.opacity !== undefined) {
      for (const [part, value] of Object.entries(sample.opacity)) {
        if (shown.get(part) === value) continue
        shown.set(part, value)
        groups.get(part)?.setAttribute('opacity', String(Math.round(value * 1000) / 1000))
      }
    }
    if (sample.camera !== undefined) applyCamera(sample.camera)
  }

  // The clock. `t` is where the scene is; the anchor pair says when and where it last
  // started moving, so a pause and a resume never lose their place.
  let t = 0
  let playing = false
  /** Paused by hand: scrolling back into view must not restart it. */
  let held = false
  let anchorNow = 0
  let anchorT = 0
  let direction: 1 | -1 = 1
  /** For the stepping modes: the clock position to stop at. */
  let target: number | undefined

  const settle = (at: number): void => {
    t = at
    anchorT = at
    anchorNow = performance.now()
    paintAt(t)
  }

  const currentIndex = (): number => {
    let index = 0
    for (let i = 0; i < sched.arrive.length; i++) if (sched.arrive[i]! <= t + 1e-6) index = i
    return index
  }

  const ticker: Ticker = {
    tick: (now) => {
      if (!playing) return
      const elapsed = now - anchorNow
      if (target === undefined) {
        t = clockAt(sched, mode, anchorT + elapsed)
      } else {
        t = anchorT + direction * elapsed
        if ((direction > 0 && t >= target) || (direction < 0 && t <= target)) {
          t = target === sched.total ? 0 : target
          playing = false
        }
      }
      paintAt(t)
    },
  }

  /** Play forward to the next keyframe, skipping any dead time in a hold. */
  const stepForward = (now: number): void => {
    const index = currentIndex()
    const next = index + 1
    if (t <= sched.leave[index]! && t >= sched.arrive[index]!) t = sched.leave[index]!
    target = next >= sched.arrive.length ? sched.total : sched.arrive[next]!
    if (target <= t) target = sched.total
    direction = 1
    anchorT = t
    anchorNow = now
    playing = true
    start(ticker)
  }

  /** Play back to the start, skipping holds on the way. */
  const stepHome = (now: number): void => {
    const index = currentIndex()
    if (t > sched.arrive[index]! && t <= sched.leave[index]!) t = sched.arrive[index]!
    target = 0
    direction = -1
    anchorT = t
    anchorNow = now
    playing = true
    start(ticker)
  }

  const resume = (): void => {
    if (held) return
    anchorNow = performance.now()
    anchorT = t
    playing = true
    start(ticker)
  }
  const pause = (): void => {
    playing = false
  }

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) resume()
            else {
              pause()
              stop(ticker)
            }
          }
        })
      : undefined

  const onEnter = (): void => stepForward(performance.now())
  const onLeave = (): void => stepHome(performance.now())
  const onClick = onEnter
  const cleanup: (() => void)[] = []

  settle(0)

  if (!prefersReducedMotion()) {
    if (mode === 'hover') {
      svg.addEventListener('pointerenter', onEnter)
      svg.addEventListener('pointerleave', onLeave)
      cleanup.push(() => {
        svg.removeEventListener('pointerenter', onEnter)
        svg.removeEventListener('pointerleave', onLeave)
      })
    } else if (mode === 'click') {
      svg.addEventListener('click', onClick)
      cleanup.push(() => svg.removeEventListener('click', onClick))
    } else if (observer !== undefined) {
      observer.observe(svg)
      cleanup.push(() => observer.disconnect())
    } else {
      resume()
    }
  }

  return {
    element: svg,
    duration: lap,
    stop: () => {
      playing = false
      stop(ticker)
      for (const undo of cleanup) undo()
    },
    goTo: (pose) => {
      const at = sched.names.indexOf(pose)
      if (at >= 0) settle(sched.arrive[at]!)
    },
    seek: (ms) => settle(lap > 0 ? ((ms % lap) + lap) % lap : 0),
    pause: () => {
      held = true
      pause()
    },
    play: () => {
      held = false
      target = undefined
      resume()
    },
    playing: () => playing,
    time: () => t,
  }
}

/** Every scene mounted on the page, by name — for a page that wants to drive one by hand. */
export const scenes = new Map<string, SceneHandle>()

/**
 * Find every compiled scene on the page and mount it.
 *
 * Pairs each `<script data-dotscene-poses="name">` with the `<svg data-dotscene="name">`
 * nearest to it, so several scenes can share a page without configuration.
 */
export const mountAll = (root: ParentNode = document): readonly SceneHandle[] => {
  const handles: SceneHandle[] = []
  for (const script of root.querySelectorAll<HTMLScriptElement>('script[data-dotscene-poses]')) {
    const name = script.getAttribute('data-dotscene-poses')!
    const svg = root.querySelector<SVGSVGElement>(`svg[data-dotscene="${CSS.escape(name)}"]`)
    if (svg === null || svg.hasAttribute('data-dotscene-mounted')) continue
    try {
      const config = JSON.parse(script.textContent ?? '{}') as SceneConfig
      svg.setAttribute('data-dotscene-mounted', '')
      const handle = mount(svg, config)
      handles.push(handle)
      scenes.set(name, handle)
    } catch {
      // A malformed payload should cost one scene its animation, not the whole page.
    }
  }
  // A scene whose timeline lives in its own file: fetched once, cached by the browser, and
  // mounted when it arrives. Its handle joins `scenes` then.
  for (const svg of root.querySelectorAll<SVGSVGElement>('svg[data-dotscene][data-dotscene-src]')) {
    if (svg.hasAttribute('data-dotscene-mounted') || typeof fetch !== 'function') continue
    const name = svg.getAttribute('data-dotscene')!
    svg.setAttribute('data-dotscene-mounted', '')
    fetch(svg.getAttribute('data-dotscene-src')!)
      .then((response) => (response.ok ? (response.json() as Promise<SceneConfig>) : Promise.reject(new Error(String(response.status)))))
      .then((config) => {
        scenes.set(name, mount(svg, config))
      })
      .catch(() => {
        // The scene stays as drawn; one missing file should not cost the page anything else.
      })
  }
  return handles
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountAll())
  else mountAll()
}
