#!/usr/bin/env node
/**
 * Write the card art into the site.
 *
 * Every scene named `art<Thing>` becomes `_includes/art/<thing>.html` in ../cbdot — the
 * pasteable block without its own runtime tag, since the site loads the runtime once from
 * its layout — and the runtime itself goes to `assets/js/dotscene.min.js`. The art is
 * generated here and applied there; the site never hand-edits a file in `_includes/art/`.
 *
 *   node scripts/sync-cbdot.mjs [path-to-cbdot]
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { compile } from '../src/compile.ts'
import { loadScenes } from '../src/load.ts'

const site = resolve(process.argv[2] ?? '../cbdot')
const artDir = resolve(site, '_includes/art')
const jsDir = resolve(site, 'assets/js')
await mkdir(artDir, { recursive: true })
await mkdir(jsDir, { recursive: true })

const scenes = await loadScenes('scenes')
const written = []
for (const { scene } of scenes.values()) {
  const match = /^art([A-Z][A-Za-z0-9]*)$/.exec(scene.name)
  if (match === null) continue
  const file = resolve(artDir, `${match[1].toLowerCase()}.html`)
  const { html } = compile(scene)
  // The layout loads the runtime; a second copy per card would mount every scene twice.
  const block = html.replace(/\n<script src="[^"]*dotscene\.min\.js" defer><\/script>/, '')
  await writeFile(file, `${block}\n`)
  written.push(file)
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
