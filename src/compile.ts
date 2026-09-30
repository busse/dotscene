/**
 * Compiling a scene into the artifacts you paste onto a page.
 *
 * A static scene compiles to one `<svg>` and nothing else — no script tag, no payload, no
 * dependency. An animated scene adds its pose frames as inline JSON plus a single shared
 * runtime script, which keeps the emitted block self-contained and copy-pasteable.
 */

import type { Scene } from './model.ts'
import { resolve, timelineOf, type ResolvedScene } from './layout.ts'
import { DEFAULT_CSS, renderSvg, sceneCss, type SvgOptions } from './render/svg.ts'
import { renderSmil } from './render/smil.ts'

export interface CompileOptions extends SvgOptions {
  /** `src` for the runtime script tag on animated scenes. Default './dotscene.min.js'. */
  readonly runtimeSrc?: string
  /**
   * `inline` (the default) puts the animation payload in a `<script type="application/json">`
   * after the svg. `external` leaves it out: the svg names `posesSrc` in `data-dotscene-src`,
   * the runtime fetches it, and a page that shows the scene twice loads it once. `poses` on
   * the result carries the payload either way, for writing to that file.
   */
  readonly poses?: 'inline' | 'external'
  /** Where the external payload will be served from. Default `./<name>.poses.json`. */
  readonly posesSrc?: string
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
  /** The animation payload as JSON, when animated — what `<name>.poses.json` holds. */
  readonly poses?: string
  /**
   * The scene's stylesheet on its own: the defaults and its scoped rules, the same text the
   * inline `<style>` carries. For a page that links one sheet per scene and emits the blocks
   * with `styles: false`, so a host can theme them from its own tokens.
   */
  readonly css: string
  /**
   * The animation as a self-playing SVG document (SMIL), for an `<img>` or a README where no
   * script runs. Absent for static scenes and for the hover and click modes.
   */
  readonly smil?: string
}

/** The runtime payload for an animated scene: everything it needs, and nothing more. */
export const animationPayload = (resolved: ResolvedScene): string | undefined => {
  const config = timelineOf(resolved)
  return config === undefined ? undefined : JSON.stringify(config)
}

export const compile = (scene: Scene, options: CompileOptions = {}): CompiledScene => {
  const resolved = resolve(scene)
  const payload = animationPayload(resolved)
  const external = payload !== undefined && options.poses === 'external'
  const posesSrc = external ? (options.posesSrc ?? `./${resolved.name}.poses.json`) : undefined
  const svg = renderSvg(resolved, { ...options, xml: true })
  const inline = renderSvg(resolved, { ...options, ...(posesSrc === undefined ? {} : { posesSrc }) })
  const runtimeTag = `<script src="${options.runtimeSrc ?? './dotscene.min.js'}" defer></script>`

  const html =
    payload === undefined
      ? inline
      : external
        ? [inline, runtimeTag].join('\n')
        : [inline, `<script type="application/json" data-dotscene-poses="${resolved.name}">${payload}</script>`, runtimeTag].join('\n')

  const smil = payload === undefined ? undefined : renderSmil(resolved, { indent: options.indent })
  return {
    name: resolved.name,
    resolved,
    svg,
    inline,
    html,
    animated: payload !== undefined,
    ...(payload === undefined ? {} : { poses: payload }),
    css: `${DEFAULT_CSS}${sceneCss(resolved)}`,
    ...(smil === undefined ? {} : { smil }),
  }
}
