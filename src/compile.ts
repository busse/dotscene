/**
 * Compiling a scene into the artifacts you paste onto a page.
 *
 * A static scene compiles to one `<svg>` and nothing else — no script tag, no payload, no
 * dependency. An animated scene adds its pose frames as inline JSON plus a single shared
 * runtime script, which keeps the emitted block self-contained and copy-pasteable.
 */

import type { Scene } from './model.ts'
import { resolve, type ResolvedScene } from './layout.ts'
import { renderSvg, type SvgOptions } from './render/svg.ts'

export interface CompileOptions extends SvgOptions {
  /** `src` for the runtime script tag on animated scenes. Default './dotscene.min.js'. */
  readonly runtimeSrc?: string
}

export interface CompiledScene {
  readonly name: string
  readonly resolved: ResolvedScene
  /** Standalone SVG document, suitable for writing to a .svg file. */
  readonly svg: string
  /** The pasteable block: the SVG, plus pose data and the runtime tag when animated. */
  readonly html: string
  readonly animated: boolean
}

/** The runtime payload for an animated scene: everything it needs, and nothing more. */
export const animationPayload = (resolved: ResolvedScene): string | undefined => {
  const animation = resolved.animation
  if (animation === undefined) return undefined
  return JSON.stringify({
    cycle: animation.cycle,
    timings: animation.timings,
    easing: animation.easing,
    mode: animation.mode,
    frames: animation.frames,
    ...(animation.depths === undefined ? {} : { depths: animation.depths }),
  })
}

export const compile = (scene: Scene, options: CompileOptions = {}): CompiledScene => {
  const resolved = resolve(scene)
  const svg = renderSvg(resolved, options)
  const payload = animationPayload(resolved)

  const html =
    payload === undefined
      ? svg
      : [
          svg,
          `<script type="application/json" data-dotscene-poses="${resolved.name}">${payload}</script>`,
          `<script src="${options.runtimeSrc ?? './dotscene.min.js'}" defer></script>`,
        ].join('\n')

  return { name: resolved.name, resolved, svg, html, animated: payload !== undefined }
}
