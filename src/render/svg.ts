/**
 * SVG renderer: resolved geometry in, markup out. No DOM, so it runs anywhere.
 *
 * Emitted elements carry `data-p` (dots) and `data-a`/`data-b` (lines) so the browser
 * runtime can find and move them by point name without re-parsing the scene.
 */

import type { ResolvedScene } from '../layout.ts'

export interface SvgOptions {
  /**
   * Inline the default stylesheet inside the <svg>. On by default so a pasted block renders
   * with no other setup; turn it off when the page already includes dotscene.css.
   */
  readonly styles?: boolean
  /** Indentation for nested elements. */
  readonly indent?: string
}

/** Default look, kept at low specificity so page CSS can override any of it. */
export const DEFAULT_CSS = [
  '.dotscene{--ds-dot-r:1.2;--ds-line-w:0.55;--ds-dot-fill:currentColor;--ds-line-stroke:currentColor}',
  '.dotscene .ds-line{stroke:var(--ds-line-stroke);stroke-width:var(--ds-line-w);stroke-linecap:round;fill:none}',
  '.dotscene .ds-dot{fill:var(--ds-dot-fill);r:var(--ds-dot-r)}',
].join('')

/**
 * Per-scene sizing, scoped to this scene's data attribute.
 *
 * Override from a page with a more specific selector — `svg.dotscene .ds-dot { r: 2 }` —
 * rather than by redefining the custom property, which this rule would win.
 */
const sceneCss = (scene: ResolvedScene): string =>
  `svg[data-dotscene="${scene.name}"]{--ds-dot-r:${scene.dotRadius};--ds-line-w:${scene.lineWidth}}`

const escapeXml = (value: string): string =>
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

const attrs = (pairs: readonly (readonly [string, string | number | undefined])[]): string =>
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
  const titled = scene.title !== undefined

  const open = `<svg ${attrs([
    ['xmlns', 'http://www.w3.org/2000/svg'],
    ['class', 'dotscene'],
    ['data-dotscene', scene.name],
    ['viewBox', `${x} ${y} ${width} ${height}`],
    ['role', titled ? 'img' : undefined],
    ['aria-hidden', titled ? undefined : 'true'],
  ])}>`

  const body: string[] = []
  if (titled) body.push(`<title>${escapeXml(scene.title!)}</title>`)
  if (options.styles !== false) body.push(`<style>${DEFAULT_CSS}${sceneCss(scene)}</style>`)

  // Clip to the viewBox. A browser clips to the *viewport*, not the viewBox, so under the
  // default `preserveAspectRatio` a container with a different aspect ratio letterboxes —
  // and anything the scene parked outside the viewBox shows up in the letterbox bars. A
  // staged scene relies on off-stage being invisible, and this is also what makes the SVG
  // agree with the ASCII renderer, which has always clipped.
  const clipId = `ds-clip-${scene.name}`
  body.push(
    `<defs><clipPath id="${escapeXml(clipId)}"><rect ${attrs([
      ['x', x],
      ['y', y],
      ['width', width],
      ['height', height],
    ])}/></clipPath></defs>`,
  )

  const content: string[] = []

  for (const line of scene.lines) {
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

  for (const dot of scene.dots) {
    content.push(
      `<circle ${attrs([
        ['class', 'ds-dot'],
        ['data-part', dot.part],
        ['data-p', dot.point],
        ['cx', dot.at[0]],
        ['cy', dot.at[1]],
        ['r', scene.dotRadius],
      ])}/>`,
    )
  }

  body.push(`<g clip-path="url(#${escapeXml(clipId)})">`)
  for (const row of content) body.push(`${indent}${row}`)
  body.push('</g>')

  return [open, ...body.map((row) => `${indent}${row}`), '</svg>'].join('\n')
}
