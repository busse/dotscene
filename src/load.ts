/** Discovering and loading scene files from a directory. */

import { readdir, readFile } from 'node:fs/promises'
import { join, resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Scene } from './model.ts'
import { sceneFromJson, type JsonScene } from './serialize.ts'

export interface LoadedScene {
  readonly scene: Scene
  /** Absolute path of the file the scene came from. */
  readonly file: string
}

const isScene = (value: unknown): value is Scene =>
  typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'scene'

/** Scene files, sorted, so every command reports in a stable order. */
export const findSceneFiles = async (dir: string): Promise<readonly string[]> => {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }
  return entries
    .filter((name) => name.endsWith('.ts') || name.endsWith('.json'))
    .filter((name) => !name.endsWith('.test.ts') && !name.endsWith('.d.ts'))
    .sort()
    .map((name) => resolvePath(join(dir, name)))
}

/** Every scene exported by one file. A TypeScript module may export more than one. */
export const loadSceneFile = async (file: string): Promise<readonly LoadedScene[]> => {
  if (file.endsWith('.json')) {
    const json = JSON.parse(await readFile(file, 'utf8')) as JsonScene
    return [{ scene: sceneFromJson(json), file }]
  }
  const module = (await import(pathToFileURL(file).href)) as Record<string, unknown>
  return Object.values(module)
    .filter(isScene)
    .map((scene) => ({ scene, file }))
}

/**
 * Load every scene in a directory, keyed by name.
 *
 * A duplicate name is an error rather than a silent overwrite — two files claiming the same
 * scene would make `build` output depend on directory order.
 */
export const loadScenes = async (dir: string): Promise<Map<string, LoadedScene>> => {
  const found = new Map<string, LoadedScene>()
  for (const file of await findSceneFiles(dir)) {
    for (const loaded of await loadSceneFile(file)) {
      const existing = found.get(loaded.scene.name)
      if (existing !== undefined) {
        throw new Error(`two files define a scene named '${loaded.scene.name}': ${existing.file} and ${loaded.file}`)
      }
      found.set(loaded.scene.name, loaded)
    }
  }
  return found
}
