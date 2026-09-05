/**
 * Compiling a scene into the artifacts you paste onto a page.
 *
 * A static scene compiles to one `<svg>` and nothing else — no script tag, no payload, no
 * dependency. An animated scene adds its pose frames as inline JSON plus a single shared
 * runtime script, which keeps the emitted block self-contained and copy-pasteable.
 */

import type { Scene } from './model.ts'
import { resolve, timelineOf, type ResolvedScene } from './layout.ts'
import { renderSvg, type SvgOptions } from './render/svg.ts'

export interface CompileOptions extends SvgOptions {
  /** `src` for the runtime script tag on animated scenes. Default './dotscene.min.js'. */
  readonly runtimeSrc?: string
}

export interface CompiledScene {
  readonly name: string
  readonly resolved: ResolvedScene
  /** Standalone SVG document, suitable for writing to a .svg file — XML-safe. */
  readonly svg: string
  /** The same drawing as it sits inside an HTML page. */
  readonly inline: string
  /** The pasteable block: the SVG, plus pose data and the runtime tag when animated. */
  readonly html: string
  readonly animated: boolean
}

/** The runtime payload for an animated scene: everything it needs, and nothing more. */
export const animationPayload = (resolved: ResolvedScene): string | undefined => {
  const config = timelineOf(resolved)
  return config === undefined ? undefined : JSON.stringify(config)
}

export const compile = (scene: Scene, options: CompileOptions = {}): CompiledScene => {
  const resolved = resolve(scene)
  const svg = renderSvg(resolved, { ...options, xml: true })
  const inline = renderSvg(resolved, options)
  const payload = animationPayload(resolved)

  const html =
    payload === undefined
      ? inline
      : [
          inline,
          `<script type="application/json" data-dotscene-poses="${resolved.name}">${payload}</script>`,
          `<script src="${options.runtimeSrc ?? './dotscene.min.js'}" defer></script>`,
        ].join('\n')

  return { name: resolved.name, resolved, svg, inline, html, animated: payload !== undefined }
}
