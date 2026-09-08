/**
 * An animated scene as a standalone SVG that animates itself — SMIL `<animate>` elements
 * baked from the timeline — so it plays anywhere an SVG image is shown and no script can
 * run: a GitHub README, an `<img>`, a Markdown viewer.
 *
 * It is the runtime's sampler written out as data. Every part the timeline moves gets, for
 * each of its dots, lines and faces, the value at every instant the part's track changes
 * course — the keyframes it is mentioned in, the ends of its holds, the wrap — with the
 * segment between two stops eased the way the runtime eases it. A part's still points get
 * nothing, and a part the timeline never mentions is drawn once. So the file is proportional
 * to what happens, the same as the runtime payload, but it says it in XML and per element
 * rather than per part, which is several times larger.
 *
 * Not carried over: depth reordering (paint order is the resting one), `sizing: 'screen'`
 * (dots and strokes scale with the camera, as any SVG's would), and the hover and click
 * modes, which need a script.
 */

import type { EasingName } from '../model.ts'
import { restOf, timelineOf, type ResolvedDot, type ResolvedFace, type ResolvedLine, type ResolvedScene } from '../layout.ts'
import { buildTracks, type Frame, type Schedule, type Track, type ViewBox } from '../timeline.ts'
import { DEFAULT_CSS, attrs, escapeXml, sceneCss } from './svg.ts'

export interface SmilOptions {
  readonly indent?: string
  /** Escape the stylesheet for an XML document. Default true. */
  readonly xml?: boolean
}

/** One point on a track: the value reached at `at`, and the easing of the segment into it. */
interface Stop<T> {
  readonly at: number
  readonly value: T
  readonly easing: EasingName
}

/** Cubic-bézier control points that stand in for the runtime's quadratic easings. */
const SPLINE: Readonly<Record<EasingName, string>> = {
  linear: '0 0 1 1',
  easeIn: '0.11 0 0.5 0',
  easeOut: '0.5 1 0.89 1',
  easeInOut: '0.45 0 0.55 1',
}

const reversed = (easing: EasingName): EasingName => (easing === 'easeIn' ? 'easeOut' : easing === 'easeOut' ? 'easeIn' : easing)

const trackEasing = <T>(sched: Schedule, track: Track<T>, j: number): EasingName => track.easings?.[j] ?? sched.easing(track.keys[j]!)

/**
 * Where a track changes course over one lap, mirroring `sampleTrack`: rest until the move
 * into the first mention, the value at each mention, held through its hold, the last held to
 * the end, and in a loop tweened home over the wrap.
 */
const stopsOf = <T>(sched: Schedule, track: Track<T>, rest: T, mode: 'loop' | 'pingpong'): Stop<T>[] => {
  const { keys, values } = track
  const stops: Stop<T>[] = []
  const push = (at: number, value: T, easing: EasingName = 'linear'): void => {
    stops.push({ at, value, easing })
  }
  if (keys.length === 0) return stops
  const first = keys[0]!
  if (first === 0) push(0, values[0]!)
  else {
    push(0, rest)
    const from = sched.leave[first - 1] ?? 0
    if (from > 0) push(from, rest)
    push(sched.arrive[first]!, values[0]!, trackEasing(sched, track, 0))
  }
  for (let j = 0; j < keys.length; j++) {
    const key = keys[j]!
    if (sched.leave[key]! > sched.arrive[key]!) push(sched.leave[key]!, values[j]!)
    if (j + 1 < keys.length) push(sched.arrive[keys[j + 1]!]!, values[j + 1]!, trackEasing(sched, track, j + 1))
  }
  const last = keys[keys.length - 1]!
  if (sched.end > sched.leave[last]!) push(sched.end, values[values.length - 1]!)
  if (mode === 'loop') {
    const opening = first === 0 ? values[0]! : rest
    if (sched.total > sched.end) push(sched.total, opening, sched.easing(0))
    else if (stops[stops.length - 1]!.at < sched.total) push(sched.total, stops[stops.length - 1]!.value)
    return stops
  }
  // Pingpong: out to the end, then the same stops back, each segment's easing reversed.
  const forward = stops.filter((stop) => stop.at <= sched.end)
  const back: Stop<T>[] = []
  for (let i = forward.length - 2; i >= 0; i--) {
    back.push({ at: 2 * sched.end - forward[i]!.at, value: forward[i]!.value, easing: reversed(forward[i + 1]!.easing) })
  }
  return [...forward, ...back]
}

const round2 = (n: number): string => String(Math.round(n * 100) / 100)

/** One `<animate>`, or nothing when the series never changes. */
const animate = (attribute: string, stops: readonly Stop<string>[], lap: number, indent: string): string => {
  if (stops.length < 2 || stops.every((stop) => stop.value === stops[0]!.value)) return ''
  // Five places: a hundredth of a lap is six hundred milliseconds of a minute-long scene.
  const keyTimes = stops.map((stop) => String(Math.round(Math.min(1, Math.max(0, stop.at / lap)) * 100000) / 100000)).join(';')
  const values = stops.map((stop) => stop.value).join(';')
  const eased = stops.slice(1).some((stop) => stop.easing !== 'linear')
  const splines = eased ? stops.slice(1).map((stop) => SPLINE[stop.easing]).join(';') : undefined
  return `${indent}<animate ${attrs([
    ['attributeName', attribute],
    ['dur', `${lap / 1000}s`],
    ['repeatCount', 'indefinite'],
    ['calcMode', eased ? 'spline' : 'linear'],
    ['keyTimes', keyTimes],
    ['keySplines', splines],
    ['values', values],
  ])}/>`
}

/** A coordinate series out of a frame series; a frame short of the index holds the last. */
const coordinate = (stops: readonly Stop<Frame>[], index: number, fallback: number): Stop<string>[] => {
  let last = fallback
  return stops.map((stop) => {
    const value = stop.value[index]
    if (value !== undefined) last = value
    return { at: stop.at, value: round2(last), easing: stop.easing }
  })
}

/**
 * The scene as a self-animating SVG document, or `undefined` when it is static or needs a
 * script to play (the hover and click modes).
 */
export const renderSmil = (scene: ResolvedScene, options: SmilOptions = {}): string | undefined => {
  const config = timelineOf(scene)
  if (config === undefined) return undefined
  if (config.mode !== 'loop' && config.mode !== 'pingpong') return undefined
  const mode = config.mode
  const tracks = buildTracks(config)
  const sched = tracks.schedule
  const lap = mode === 'loop' ? sched.total : 2 * sched.end
  if (lap <= 0) return undefined
  const rest = restOf(scene)
  const indent = options.indent ?? '  '
  const inner = `${indent}${indent}`

  const [x, y, width, height] = scene.viewBox
  const titled = scene.title !== undefined
  const open = `<svg ${attrs([
    ['xmlns', 'http://www.w3.org/2000/svg'],
    ['class', 'dotscene'],
    ['data-dotscene', scene.name],
    ['data-version', scene.version],
    ['data-animation', 'smil'],
    ['viewBox', `${x} ${y} ${width} ${height}`],
    ['preserveAspectRatio', scene.fit === 'slice' ? 'xMidYMid slice' : undefined],
    ['role', titled ? 'img' : undefined],
    ['aria-hidden', titled ? undefined : 'true'],
  ])}>`

  const body: string[] = []
  if (titled) body.push(`<title>${escapeXml(scene.title!)}</title>`)
  const css = `${DEFAULT_CSS}${sceneCss(scene)}`
  body.push(`<style>${options.xml === false ? css : css.replace(/&/g, '&amp;')}</style>`)
  if (tracks.camera !== undefined && config.camera !== undefined) {
    const stops = stopsOf<ViewBox>(sched, tracks.camera, config.camera.base, mode).map((stop) => ({
      ...stop,
      value: stop.value.map(round2).join(' '),
    }))
    const line = animate('viewBox', stops, lap, '')
    if (line !== '') body.push(line)
  }
  if (scene.background !== undefined) {
    body.push(`<rect ${attrs([['class', 'ds-bg'], ['x', x], ['y', y], ['width', width], ['height', height], ['fill', scene.background]])}/>`)
  }

  const faces = new Map<string, ResolvedFace[]>()
  const lines = new Map<string, ResolvedLine[]>()
  const dots = new Map<string, ResolvedDot[]>()
  const file = <T extends { part: string }>(into: Map<string, T[]>, item: T): void => {
    const list = into.get(item.part)
    if (list === undefined) into.set(item.part, [item])
    else list.push(item)
  }
  for (const face of scene.faces) file(faces, face)
  for (const line of scene.lines) file(lines, line)
  for (const dot of scene.dots) file(dots, dot)

  for (const part of scene.partOrder) {
    const track = tracks.parts.get(part)
    const names = config.points[part] ?? []
    const stops = track === undefined ? [] : stopsOf<Frame>(sched, track, rest.frame[part] ?? [], mode)
    const index = (point: string): number => names.indexOf(point)
    const series = (point: string, axis: 0 | 1, fallback: number): Stop<string>[] => {
      const i = index(point)
      return i < 0 ? [] : coordinate(stops, i * 2 + axis, fallback)
    }

    const opacityTrack = tracks.opacity.get(part)
    const opacity = scene.opacities?.[part]
    body.push(`<g ${attrs([['data-part', part], ['opacity', opacity]])}>`)
    if (opacityTrack !== undefined) {
      const base = rest.opacity[part] ?? config.opacity?.base[part] ?? 1
      const line = animate(
        'opacity',
        stopsOf<number>(sched, opacityTrack, base, mode).map((stop) => ({ ...stop, value: round2(stop.value) })),
        lap,
        indent,
      )
      if (line !== '') body.push(line)
    }

    const partFaces = faces.get(part) ?? []
    const partLines = lines.get(part) ?? []
    const partDots = dots.get(part) ?? []
    const layers = new Set<number>([0])
    for (const item of [...partFaces, ...partLines, ...partDots]) layers.add(item.layer ?? 0)

    for (const layer of [...layers].sort((a, b) => a - b)) {
      for (const face of partFaces) {
        if ((face.layer ?? 0) !== layer) continue
        const openTag = `<polygon ${attrs([
          ['class', face.kind === undefined ? 'ds-face' : `ds-face ds-face--${face.kind}`],
          ['data-part', face.part],
          ['points', face.at.map(([px, py]) => `${px},${py}`).join(' ')],
        ])}`
        let moving = ''
        if (stops.length > 0 && face.names.every((name) => index(name) >= 0)) {
          const points = stops.map((stop) => ({
            at: stop.at,
            easing: stop.easing,
            value: face.names
              .map((name, k) => {
                const i = index(name)
                const px = stop.value[i * 2] ?? face.at[k]![0]
                const py = stop.value[i * 2 + 1] ?? face.at[k]![1]
                return `${round2(px)},${round2(py)}`
              })
              .join(' '),
          }))
          moving = animate('points', points, lap, inner)
        }
        body.push(moving === '' ? `${indent}${openTag}/>` : `${indent}${openTag}>\n${moving}\n${indent}</polygon>`)
      }

      for (const line of partLines) {
        if ((line.layer ?? 0) !== layer) continue
        const openTag = `<line ${attrs([
          ['class', line.kind === undefined ? 'ds-line' : `ds-line ds-line--${line.kind}`],
          ['data-part', line.part],
          ['x1', line.a[0]],
          ['y1', line.a[1]],
          ['x2', line.b[0]],
          ['y2', line.b[1]],
        ])}`
        const moving = [
          animate('x1', series(line.from, 0, line.a[0]), lap, inner),
          animate('y1', series(line.from, 1, line.a[1]), lap, inner),
          animate('x2', series(line.to, 0, line.b[0]), lap, inner),
          animate('y2', series(line.to, 1, line.b[1]), lap, inner),
        ].filter((row) => row !== '')
        body.push(moving.length === 0 ? `${indent}${openTag}/>` : `${indent}${openTag}>\n${moving.join('\n')}\n${indent}</line>`)
      }

      for (const dot of partDots) {
        if ((dot.layer ?? 0) !== layer) continue
        const openTag = `<circle ${attrs([
          ['class', dot.kind === undefined ? 'ds-dot' : `ds-dot ds-dot--${dot.kind}`],
          ['data-part', dot.part],
          ['data-p', dot.point],
          ['cx', dot.at[0]],
          ['cy', dot.at[1]],
          ['r', scene.dotRadius],
        ])}`
        const moving = [animate('cx', series(dot.point, 0, dot.at[0]), lap, inner), animate('cy', series(dot.point, 1, dot.at[1]), lap, inner)].filter(
          (row) => row !== '',
        )
        body.push(moving.length === 0 ? `${indent}${openTag}/>` : `${indent}${openTag}>\n${moving.join('\n')}\n${indent}</circle>`)
      }
    }
    body.push('</g>')
  }

  return [open, ...body.map((row) => (row.startsWith(indent) ? row : `${indent}${row}`)), '</svg>'].join('\n')
}
