#!/usr/bin/env node
/**
 * Render the social card: a still of the hero, as a PNG.
 *
 * LinkedIn, Threads and Slack all decline an SVG `og:image`, and the gallery's own hero is
 * an animation besides, so the one image that has to work everywhere is a raster of a chosen
 * instant. The output belongs in `site/`, which `dotscene build` copies into `docs/` — so the
 * card is a source asset that happens to be made by a script, not a file hand-placed in the
 * build output.
 *
 * Holding an exact frame is the fiddly part: a headless browser's virtual-time budget is not
 * the animation clock, and load time eats an unpredictable share of it. So the page pauses
 * the scene and seeks it, and only then reports that it is ready.
 *
 *   node scripts/og-image.mjs                       # the default scene and instant
 *   node scripts/og-image.mjs --at 12500 --out /tmp/try.png
 *   node scripts/og-image.mjs --scene islandHero --at 8000
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { resolve, join } from 'node:path'
import { parseArgs } from 'node:util'
import { build } from 'esbuild'
import { compile } from '../src/compile.ts'
import { loadScenes } from '../src/load.ts'

const run = promisify(execFile)

const { values } = parseArgs({
  options: {
    scene: { type: 'string', default: 'ediHeroMeadow' },
    at: { type: 'string', default: '0' },
    out: { type: 'string', default: 'site/og.png' },
    width: { type: 'string', default: '1200' },
    height: { type: 'string', default: '630' },
  },
})

const at = Number.parseInt(values.at, 10)
const width = Number.parseInt(values.width, 10)
const height = Number.parseInt(values.height, 10)

const chrome =
  process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const scenes = await loadScenes('scenes')
const found = scenes.get(values.scene)
if (found === undefined) {
  process.stderr.write(`no scene named '${values.scene}'\n`)
  process.exit(1)
}

const { html, resolved } = compile(found.scene)
const background = found.scene.background ?? '#ffffff'

const runtime = await build({
  entryPoints: [resolve('src/runtime/index.ts')],
  write: false,
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'dotscene',
  target: 'es2020',
  legalComments: 'none',
})

// The block, with the runtime inlined rather than fetched, and the scene held at one instant.
const block = html.replace(
  /<script src="[^"]*dotscene\.min\.js" defer><\/script>/,
  `<script>${runtime.outputFiles[0].text}</script>`,
)

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; background: ${background}; }
  body { width: ${width}px; height: ${height}px; display: grid; place-items: center; overflow: hidden; }
  .dotscene { width: 100%; height: auto; max-height: ${height}px; display: block; }
</style>
</head>
<body>
${block}
<script>
  // Sticky pause, then seek: the frame in the screenshot is the frame asked for, whatever the
  // virtual-time budget did on the way here.
  const hold = () => {
    const scene = window.dotscene && window.dotscene.scenes && window.dotscene.scenes.get('${resolved.name}')
    if (!scene) return setTimeout(hold, 10)
    scene.pause()
    scene.seek(${at})
    document.title = 'ready'
  }
  hold()
</script>
`

const dir = await mkdtemp(join(tmpdir(), 'dotscene-og-'))
const pageFile = join(dir, 'card.html')
await writeFile(pageFile, page)

const out = resolve(values.out)
await mkdir(resolve(out, '..'), { recursive: true })

try {
  await run(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    // Generous, because it is spent on load and on the seek, not on playing the animation.
    '--virtual-time-budget=20000',
    `--screenshot=${out}`,
    pageFile,
  ])
} finally {
  await rm(dir, { recursive: true, force: true })
}

process.stdout.write(`${values.scene} at ${at}ms -> ${out} (${width}x${height})\n`)
