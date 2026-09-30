/**
 * SVG renderer: resolved geometry in, markup out. No DOM, so it runs anywhere.
 *
 * Emitted elements carry `data-p` (dots) and `data-a`/`data-b` (lines) so the browser
 * runtime can find and move them by point name without re-parsing the scene.
 */

import type { ResolvedDot, ResolvedFace, ResolvedLine, ResolvedScene } from '../layout.ts'

export interface SvgOptions {
  /**
   * Inline the default stylesheet inside the <svg>. On by default so a pasted block renders
   * with no other setup; turn it off when the page already includes dotscene.css.
   */
  readonly styles?: boolean
  /** Indentation for nested elements. */
  readonly indent?: string
  /**
   * Escape the stylesheet as XML text. A standalone `.svg` is parsed as XML, where a bare
   * `&` — the CSS nesting selector a themed scene uses — is a fatal error; inside an HTML
   * page a `<style>` is raw text and the same `&` must stay literal. So the file and the
   * pasteable block differ in exactly this.
   */
  readonly xml?: boolean
  /**
   * Where the animation payload lives when it is not inline: the svg carries this as
   * `data-dotscene-src` and the runtime fetches it. Absent for an inline block.
   */
  readonly posesSrc?: string
}

/**
 * Default look, weighing nothing.
 *
 * Every compiled block carries its own copy of these rules, so a page showing two scenes has
 * two copies — and the second lands later in the document than the first scene's own rules.
 * Whole selectors sit inside `:where()` so the defaults have zero specificity and any rule of
 * a scene's beats them wherever they appear. For the same reason the defaults declare none of
 * the variables a scene sets: those live as `var()` fallbacks, leaving each scene's sizing rule
 * nothing to tie with. `--ds-zoom` is the exception — no scene sets it, and scene css is
 * written against it, so it needs a value to exist.
 */
export const DEFAULT_CSS = [
  // `--ds-zoom` is written by the runtime as the camera moves, for scenes sized to the
  // screen: a push-in shrinks it, so dots and strokes keep their size on the page.
  ':where(.dotscene){--ds-zoom:1}',
  ':where(.dotscene .ds-line){stroke:var(--ds-line-stroke,currentColor);stroke-width:calc(var(--ds-line-w,0.55) * var(--ds-zoom,1));stroke-linecap:round;fill:none}',
  ':where(.dotscene .ds-dot){fill:var(--ds-dot-fill,currentColor);r:calc(var(--ds-dot-r,1.2) * var(--ds-zoom,1))}',
  // A face exists to hide what is behind it, so it defaults to the scene's own ground.
  ':where(.dotscene .ds-face){fill:var(--ds-face-fill,#ffffff);stroke:none}',
].join('')

/**
 * Per-scene sizing, scoped to this scene's data attribute.
 *
 * Override from a page with a more specific selector — `svg.dotscene .ds-dot { r: 2 }` —
 * rather than by redefining the custom property, which this rule would win.
 */
export const sceneCss = (scene: ResolvedScene): string => {
  // `:where()` so the scope adds nothing: a scene's own rule weighs one class, no more.
  const selector = `:where(svg[data-dotscene="${scene.name}"])`
  const ground = scene.background === undefined ? '' : `;--ds-face-fill:${scene.background}`
  const sizing = `${selector}{--ds-dot-r:${scene.dotRadius};--ds-line-w:${scene.lineWidth}${ground}}`
  // The scene's own rules go inside a nested block, so bare selectors it writes cannot
  // reach another scene sharing the page.
  return scene.css === undefined ? sizing : `${sizing}${selector}{${scene.css}}`
}

export const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&apos;'
    }
  })

export const attrs = (pairs: readonly (readonly [string, string | number | undefined])[]): string =>
  pairs
    .filter((pair): pair is readonly [string, string | number] => pair[1] !== undefined)
    .map(([name, value]) => `${name}="${typeof value === 'string' ? escapeXml(value) : value}"`)
    .join(' ')

/**
 * Render a resolved scene to an SVG string.
 *
 * Lines are emitted before dots so joints sit on top of the strokes they join. Untitled
 * scenes are marked `aria-hidden` — line art with no description is decoration, and an
 * unlabeled `role="img"` would be worse than none.
 */
export const renderSvg = (scene: ResolvedScene, options: SvgOptions = {}): string => {
  const indent = options.indent ?? '  '
  const [x, y, width, height] = scene.viewBox
  const titled = scene.title !== undefined && scene.decorative !== true

  const open = `<svg ${attrs([
    ['xmlns', 'http://www.w3.org/2000/svg'],
    ['class', 'dotscene'],
    ['data-dotscene', scene.name],
    ['data-version', scene.version],
    ['data-dotscene-src', options.posesSrc],
    ['viewBox', `${x} ${y} ${width} ${height}`],
    ['preserveAspectRatio', scene.fit === 'slice' ? 'xMidYMid slice' : undefined],
    ['role', titled ? 'img' : undefined],
    ['aria-hidden', titled ? undefined : 'true'],
    ['focusable', titled ? undefined : 'false'],
  ])}>`

  const body: string[] = []
  if (titled) body.push(`<title>${escapeXml(scene.title!)}</title>`)
  if (options.styles !== false) {
    const css = `${DEFAULT_CSS}${sceneCss(scene)}`
    body.push(`<style>${options.xml === true ? css.replace(/&/g, '&amp;') : css}</style>`)
  }

  // Clip to the viewBox. A browser clips to the *viewport*, not the viewBox, so under the
  // default `preserveAspectRatio` a container with a different aspect ratio letterboxes —
  // and anything the scene parked outside the viewBox shows up in the letterbox bars. A
  // staged scene relies on off-stage being invisible, and this is also what makes the SVG
  // agree with the ASCII renderer, which has always clipped.
  if (scene.background !== undefined) {
    body.push(
      `<rect ${attrs([
        ['class', 'ds-bg'],
        ['x', x],
        ['y', y],
        ['width', width],
        ['height', height],
        ['fill', scene.background],
      ])}/>`,
    )
  }

  const clipId = `ds-clip-${scene.name}`
  body.push(
    `<defs><clipPath id="${escapeXml(clipId)}"><rect ${attrs([
      ['class', 'ds-clip'],
      ['x', x],
      ['y', y],
      ['width', width],
      ['height', height],
    ])}/></clipPath></defs>`,
  )

  const content: string[] = []

  // Paint part by part rather than every line and then every dot. A part's fills go down
  // first, then its own strokes on top of them — which is what makes a wall hide the lines
  // of parts painted before it. Declaration order is paint order: nearer things go later.
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
    // One group per part, so the runtime can reorder whole parts when their depth ordering
    // changes — a truck that goes behind one building and in front of the next.
    const opacity = scene.opacities?.[part]
    content.push(`<g ${attrs([['data-part', part], ['opacity', opacity]])}>`)

    // Within a part, solid by solid: a compound figure's layers each put down their faces,
    // lines and dots before the next layer starts, so a near wall hides a far edge.
    const partFaces = faces.get(part) ?? []
    const partLines = lines.get(part) ?? []
    const partDots = dots.get(part) ?? []
    const layers = new Set<number>([0])
    for (const item of [...partFaces, ...partLines, ...partDots]) layers.add(item.layer ?? 0)

    for (const layer of [...layers].sort((a, b) => a - b)) {
      for (const face of partFaces) {
        if ((face.layer ?? 0) !== layer) continue
        content.push(
          `<polygon ${attrs([
            ['class', face.kind === undefined ? 'ds-face' : `ds-face ds-face--${face.kind}`],
            ['data-part', face.part],
            ['data-face', face.names.join(' ')],
            ['points', face.at.map(([px, py]) => `${px},${py}`).join(' ')],
          ])}/>`,
        )
      }

      for (const line of partLines) {
        if ((line.layer ?? 0) !== layer) continue
        content.push(
          `<line ${attrs([
            ['class', line.kind === undefined ? 'ds-line' : `ds-line ds-line--${line.kind}`],
            ['data-part', line.part],
            ['data-a', line.from],
            ['data-b', line.to],
            ['x1', line.a[0]],
            ['y1', line.a[1]],
            ['x2', line.b[0]],
            ['y2', line.b[1]],
          ])}/>`,
        )
      }

      for (const dot of partDots) {
        if ((dot.layer ?? 0) !== layer) continue
        content.push(
          `<circle ${attrs([
            ['class', dot.kind === undefined ? 'ds-dot' : `ds-dot ds-dot--${dot.kind}`],
            ['data-part', dot.part],
            ['data-p', dot.point],
            ['cx', dot.at[0]],
            ['cy', dot.at[1]],
            ['r', scene.dotRadius],
          ])}/>`,
        )
      }
    }

    content.push('</g>')
  }

  body.push(`<g clip-path="url(#${escapeXml(clipId)})">`)
  for (const row of content) body.push(`${indent}${row}`)
  body.push('</g>')

  return [open, ...body.map((row) => `${indent}${row}`), '</svg>'].join('\n')
}
