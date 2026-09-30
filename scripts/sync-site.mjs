#!/usr/bin/env node
/**
 * Write the card art into a site next door.
 *
 * Every scene named `art<Thing>` becomes `_includes/art/<thing>.html` under the site root — the
 * pasteable block without its own runtime tag, since the site loads the runtime once from
 * its layout — and the runtime itself goes to `assets/js/dotscene.min.js`. The art is
 * generated here and applied there; the site never hand-edits a file in `_includes/art/`.
 *
 * The layout is a Jekyll one; point it at whatever site consumes the art.
 *
 *   node scripts/sync-site.mjs <path-to-site>
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { compile } from '../src/compile.ts'
import { loadScenes } from '../src/load.ts'

const args = process.argv.slice(2)
const target = args.find((arg) => !arg.startsWith('--'))
const flag = (name) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}
if (target === undefined) {
  process.stderr.write(
    [
      'usage: node scripts/sync-site.mjs <path-to-site> [--css external] [--timeline external] [--timeline-url <prefix>]',
      '  --css external    leave the <style> out of each block; write assets/css/art/<thing>.css to link instead',
      '  --timeline external  leave the timeline out of each block; write assets/art/<thing>.poses.json for the runtime to fetch',
      '  --timeline-url       where those files are served from (default /assets/art)',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

const externalCss = flag('--css') === 'external'
const externalPoses = flag('--timeline') === 'external'
const posesUrl = (flag('--timeline-url') ?? '/assets/art').replace(/\/+$/, '')

const site = resolve(target)
const artDir = resolve(site, '_includes/art')
const jsDir = resolve(site, 'assets/js')
const cssDir = resolve(site, 'assets/css/art')
const posesDir = resolve(site, 'assets/art')
await mkdir(artDir, { recursive: true })
await mkdir(jsDir, { recursive: true })
if (externalCss) await mkdir(cssDir, { recursive: true })
if (externalPoses) await mkdir(posesDir, { recursive: true })

const scenes = await loadScenes('scenes')
const written = []
for (const { scene } of scenes.values()) {
  const match = /^art([A-Z][A-Za-z0-9]*)$/.exec(scene.name)
  if (match === null) continue
  const thing = match[1].toLowerCase()
  const file = resolve(artDir, `${thing}.html`)
  const compiled = compile(scene, {
    ...(externalCss ? { styles: false } : {}),
    ...(externalPoses ? { poses: 'external', posesSrc: `${posesUrl}/${thing}.poses.json` } : {}),
  })
  // The layout loads the runtime; a second copy per card would mount every scene twice.
  const block = compiled.html.replace(/\n<script src="[^"]*dotscene\.min\.js" defer><\/script>/, '')
  await writeFile(file, `${block}\n`)
  written.push(file)
  if (externalCss) {
    const cssFile = resolve(cssDir, `${thing}.css`)
    await writeFile(cssFile, `${compiled.css}\n`)
    written.push(cssFile)
  }
  if (externalPoses && compiled.poses !== undefined) {
    const posesFile = resolve(posesDir, `${thing}.poses.json`)
    await writeFile(posesFile, `${compiled.poses}\n`)
    written.push(posesFile)
  }
}

const bundled = await build({
  entryPoints: [resolve('src/runtime/index.ts')],
  write: false,
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'dotscene',
  target: 'es2020',
  legalComments: 'none',
})
const runtime = resolve(jsDir, 'dotscene.min.js')
await writeFile(runtime, bundled.outputFiles[0].text)
written.push(runtime)

for (const file of written) process.stdout.write(`${file}\n`)
