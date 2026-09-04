/**
 * The JSON scene format.
 *
 * Scenes can be authored as TypeScript (typed, with helpers like `mirrorX`) or as plain
 * JSON (no compile step, trivial to emit or patch programmatically). Both produce the same
 * Scene, and `sceneToJson` round-trips one back out — which is also what `inspect --json`
 * reports.
 */

import type { AnimateSpec, Figure, FigureSpec, Part, PoseOverride, Scene, Vec2 } from './model.ts'
import { defineFigure, defineScene, partId } from './model.ts'

export interface JsonFigure {
  readonly points: Readonly<Record<string, Vec2>>
  readonly edges: readonly (readonly [string, string] | { readonly from: string; readonly to: string; readonly kind?: string })[]
  readonly poses?: Readonly<Record<string, PoseOverride>>
  readonly title?: string
}

export interface JsonPart {
  readonly figure: string
  readonly id?: string
  readonly at?: Vec2
  readonly scale?: number | Vec2
  readonly rotate?: number
  readonly flipX?: boolean
  readonly pose?: string
}

export interface JsonScene {
  readonly name: string
  readonly title?: string
  readonly padding?: number
  readonly viewBox?: readonly [number, number, number, number]
  readonly figures: Readonly<Record<string, JsonFigure>>
  readonly parts: readonly JsonPart[]
  readonly animate?: AnimateSpec
}

/** Build a Scene from the JSON format. Figure and scene validation run as usual. */
export const sceneFromJson = (json: JsonScene): Scene => {
  const figures = new Map<string, Figure>()
  for (const [name, spec] of Object.entries(json.figures)) {
    figures.set(name, defineFigure(name, spec as FigureSpec))
  }

  const parts: Part[] = json.parts.map((part) => {
    const figure = figures.get(part.figure)
    if (figure === undefined) {
      throw new Error(`scene '${json.name}': part references figure '${part.figure}', which this file does not define`)
    }
    return {
      figure,
      ...(part.id === undefined ? {} : { id: part.id }),
      ...(part.at === undefined ? {} : { at: part.at }),
      ...(part.scale === undefined ? {} : { scale: part.scale }),
      ...(part.rotate === undefined ? {} : { rotate: part.rotate }),
      ...(part.flipX === undefined ? {} : { flipX: part.flipX }),
      ...(part.pose === undefined ? {} : { pose: part.pose }),
    }
  })

  return defineScene(json.name, {
    parts,
    ...(json.title === undefined ? {} : { title: json.title }),
    ...(json.padding === undefined ? {} : { padding: json.padding }),
    ...(json.viewBox === undefined ? {} : { viewBox: json.viewBox }),
    ...(json.animate === undefined ? {} : { animate: json.animate }),
  })
}

/** Serialize a Scene back to the JSON format, with keys in a stable order. */
export const sceneToJson = (scene: Scene): JsonScene => {
  const figures: Record<string, JsonFigure> = {}
  for (const part of scene.parts) {
    const figure = part.figure
    if (figure.name in figures) continue
    figures[figure.name] = {
      ...(figure.title === undefined ? {} : { title: figure.title }),
      points: figure.points,
      edges: figure.edges.map((edge) => (edge.kind === undefined ? ([edge.from, edge.to] as const) : edge)),
      ...(Object.keys(figure.poses).length === 0 ? {} : { poses: figure.poses }),
    }
  }

  const parts: JsonPart[] = scene.parts.map((part) => ({
    figure: part.figure.name,
    id: partId(part),
    ...(part.at === undefined ? {} : { at: part.at }),
    ...(part.scale === undefined ? {} : { scale: part.scale }),
    ...(part.rotate === undefined ? {} : { rotate: part.rotate }),
    ...(part.flipX === undefined ? {} : { flipX: part.flipX }),
    ...(typeof part.pose === 'string' ? { pose: part.pose } : {}),
  }))

  return {
    name: scene.name,
    ...(scene.title === undefined ? {} : { title: scene.title }),
    padding: scene.padding,
    ...(scene.viewBox === undefined ? {} : { viewBox: scene.viewBox }),
    figures,
    parts,
    ...(scene.animate === undefined ? {} : { animate: scene.animate }),
  }
}
