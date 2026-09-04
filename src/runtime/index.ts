/**
 * The browser runtime for animated scenes.
 *
 * It moves points the compiler already labelled: dots carry `data-p`, lines carry
 * `data-a`/`data-b`, and the pose frames ride alongside the SVG in a JSON script tag. So
 * there is no scene graph to rebuild at runtime — just numbers written onto attributes.
 *
 * One rAF loop drives every scene on the page, offscreen scenes stop ticking, and
 * `prefers-reduced-motion` holds the first pose without ever starting.
 */

import type { AnimateMode, EasingName, Vec2 } from '../model.ts'
import { easingFor } from '../poses.ts'

/** One part's points at one keyframe. */
export type Frame = Readonly<Record<string, Vec2>>

/** Every moving part at one keyframe, keyed by part id. */
export type SceneFrame = Readonly<Record<string, Frame>>

export interface SceneConfig {
  readonly cycle: readonly string[]
  readonly frames: Readonly<Record<string, SceneFrame>>
  readonly timings: Readonly<Record<string, { duration: number; hold: number; easing?: EasingName }>>
  readonly easing: EasingName
  readonly mode: AnimateMode
}

export interface SceneHandle {
  /** Stop animating and drop the scene from the shared loop. */
  readonly stop: () => void
  /** Jump straight to a pose, skipping the transition. */
  readonly goTo: (pose: string) => void
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

/** Dots and lines belonging to one part, looked up once at mount. */
interface Bindings {
  readonly dots: readonly (readonly [string, SVGCircleElement])[]
  readonly lines: readonly (readonly [string, string, SVGLineElement])[]
}

/**
 * Index every element in the scene by the part it belongs to.
 *
 * An element with no `data-part` is filed under `''`, which is what a hand-written SVG or an
 * older single-part build looks like — those still animate as long as the frame is keyed to
 * match.
 */
const bindAll = (svg: SVGSVGElement): Map<string, Bindings> => {
  const dots = new Map<string, (readonly [string, SVGCircleElement])[]>()
  const lines = new Map<string, (readonly [string, string, SVGLineElement])[]>()

  for (const element of svg.querySelectorAll<SVGCircleElement>('circle[data-p]')) {
    const part = element.getAttribute('data-part') ?? ''
    const list = dots.get(part) ?? []
    list.push([element.getAttribute('data-p')!, element])
    dots.set(part, list)
  }
  for (const element of svg.querySelectorAll<SVGLineElement>('line[data-a][data-b]')) {
    const part = element.getAttribute('data-part') ?? ''
    const list = lines.get(part) ?? []
    list.push([element.getAttribute('data-a')!, element.getAttribute('data-b')!, element])
    lines.set(part, list)
  }

  const bindings = new Map<string, Bindings>()
  for (const part of new Set([...dots.keys(), ...lines.keys()])) {
    bindings.set(part, { dots: dots.get(part) ?? [], lines: lines.get(part) ?? [] })
  }
  return bindings
}

const paintPart = (bindings: Bindings, points: Frame): void => {
  for (const [name, element] of bindings.dots) {
    const at = points[name]
    if (at === undefined) continue
    element.setAttribute('cx', String(at[0]))
    element.setAttribute('cy', String(at[1]))
  }
  for (const [from, to, element] of bindings.lines) {
    const a = points[from]
    const b = points[to]
    if (a === undefined || b === undefined) continue
    element.setAttribute('x1', String(a[0]))
    element.setAttribute('y1', String(a[1]))
    element.setAttribute('x2', String(b[0]))
    element.setAttribute('y2', String(b[1]))
  }
}

const paint = (bindings: Map<string, Bindings>, frame: SceneFrame): void => {
  for (const part of Object.keys(frame)) {
    const bound = bindings.get(part)
    if (bound !== undefined) paintPart(bound, frame[part]!)
  }
}

const blendFrame = (from: Frame, to: Frame, t: number): Frame => {
  const out: Record<string, Vec2> = {}
  for (const name of Object.keys(from)) {
    const a = from[name]!
    const b = to[name] ?? a
    out[name] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  }
  return out
}

/** Interpolate every moving part between two keyframes. A part absent from `to` holds still. */
const blend = (from: SceneFrame, to: SceneFrame, t: number): SceneFrame => {
  const out: Record<string, Frame> = {}
  for (const part of Object.keys(from)) {
    out[part] = blendFrame(from[part]!, to[part] ?? from[part]!, t)
  }
  return out
}

/** Attach the runtime to one already-rendered SVG. */
export const mount = (svg: SVGSVGElement, config: SceneConfig): SceneHandle => {
  const bindings = bindAll(svg)
  const cycle = config.cycle.length > 0 ? config.cycle : Object.keys(config.frames)
  const frameFor = (index: number): SceneFrame => config.frames[cycle[index] ?? ''] ?? {}
  const timingFor = (index: number): { duration: number; hold: number; easing?: EasingName } =>
    config.timings?.[cycle[index] ?? ''] ?? { duration: 700, hold: 900 }

  let index = 0
  let target = 0
  let moving = false
  let markedAt = 0
  let direction = 1

  const settle = (at: number): void => {
    index = at
    target = at
    moving = false
    paint(bindings, frameFor(at))
  }

  /** The next pose in the cycle, bouncing at the ends when the mode says pingpong. */
  const advance = (): number => {
    if (config.mode === 'pingpong') {
      if (index + direction >= cycle.length || index + direction < 0) direction = -direction as 1 | -1
      return index + direction
    }
    return (index + 1) % cycle.length
  }

  const beginMove = (to: number, now: number): void => {
    target = to
    moving = true
    markedAt = now
  }

  const ticker: Ticker = {
    tick: (now) => {
      const elapsed = now - markedAt
      if (moving) {
        // Pacing belongs to the keyframe being moved INTO, so one step can linger and the
        // next can snap.
        const { duration, easing } = timingFor(target)
        const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration)
        paint(bindings, blend(frameFor(index), frameFor(target), easingFor(easing ?? config.easing)(t)))
        if (t >= 1) {
          index = target
          moving = false
          markedAt = now
        }
        return
      }
      // Held at a pose. Automatic modes move on once the hold expires; the interactive
      // modes wait for the next pointer event instead.
      if ((config.mode === 'loop' || config.mode === 'pingpong') && elapsed >= timingFor(index).hold) {
        beginMove(advance(), now)
      }
    },
  }

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              markedAt = performance.now()
              start(ticker)
            } else {
              stop(ticker)
            }
          }
        })
      : undefined

  const onEnter = (): void => {
    markedAt = performance.now()
    beginMove(advance(), markedAt)
    start(ticker)
  }
  const onLeave = (): void => {
    markedAt = performance.now()
    beginMove(0, markedAt)
    start(ticker)
  }
  const onClick = onEnter

  const cleanup: (() => void)[] = []

  settle(0)

  if (!prefersReducedMotion()) {
    if (config.mode === 'hover') {
      svg.addEventListener('pointerenter', onEnter)
      svg.addEventListener('pointerleave', onLeave)
      cleanup.push(() => {
        svg.removeEventListener('pointerenter', onEnter)
        svg.removeEventListener('pointerleave', onLeave)
      })
      start(ticker)
    } else if (config.mode === 'click') {
      svg.addEventListener('click', onClick)
      cleanup.push(() => svg.removeEventListener('click', onClick))
      start(ticker)
    } else if (observer !== undefined) {
      observer.observe(svg)
      cleanup.push(() => observer.disconnect())
    } else {
      markedAt = performance.now()
      start(ticker)
    }
  }

  return {
    element: svg,
    stop: () => {
      stop(ticker)
      for (const undo of cleanup) undo()
    },
    goTo: (pose) => {
      const at = cycle.indexOf(pose)
      if (at >= 0) settle(at)
    },
  }
}

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
      handles.push(mount(svg, config))
    } catch {
      // A malformed payload should cost one scene its animation, not the whole page.
    }
  }
  return handles
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountAll())
  else mountAll()
}
