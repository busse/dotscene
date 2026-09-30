/**
 * The dotscene command line.
 *
 * Every command takes `--json` and prints machine-readable output, and every failure exits
 * non-zero with structured issues. That is deliberate: the usual operator here is an agent,
 * and the difference between prose errors and structured ones is the difference between a
 * two-turn correction loop and a one-turn one.
 */

import { parseArgs } from 'node:util'
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from './compile.ts'
import { keyframeTime, resolve, resolveAt, type ResolvedScene } from './layout.ts'
import { partId, withPose, type Scene } from './model.ts'
import { renderAscii } from './render/ascii.ts'
import { loadScenes, type LoadedScene } from './load.ts'
import { sceneToJson } from './serialize.ts'
import { renderGallery } from './site.ts'
import { DEFAULT_CSS } from './render/svg.ts'
import { isIssueError, validateScene, type Issue } from './validate.ts'

const USAGE = `dotscene — constellation-style scene illustrations

Usage
  dotscene list                        every scene, with its poses
  dotscene inspect <scene>             points, edges, poses, viewBox
  dotscene preview <scene>             render to the terminal as text
  dotscene check                       validate every scene, exit 1 on issues
  dotscene new <name>                  scaffold a scene file
  dotscene build                       emit SVG, pasteable HTML, and the runtime

Options
  --dir <path>      where scenes live (default: scenes)
  --json            machine-readable output
  --pose <name>     which pose or keyframe to inspect or preview
  --poses           preview every pose in turn
  --at <ms>         preview the animation at a millisecond, camera and all
  --every <ms>      preview the whole animation as a flipbook, one frame per interval
  --width <n>       preview width in characters (default: 44)
  --labels          annotate preview dots with their point names
  --out <path>      build output directory (default: docs, served by GitHub Pages)
  --assets <path>   static files copied into the build verbatim (default: site)
  --base-url <url>  absolute address the build is served from, for the social card
  --css <mode>      inline (default) puts each scene's stylesheet in its block;
                    external writes <name>.css beside it and links it from the gallery
  --timeline <mode> inline (default) puts the animation in each block;
                    external writes <name>.poses.json and the runtime fetches it, cached
  --help            this message
`

interface Options {
  readonly dir: string
  readonly json: boolean
  readonly pose?: string
  readonly poses: boolean
  readonly at?: number
  readonly every?: number
  readonly width: number
  readonly labels: boolean
  readonly out: string
  readonly assets: string
  readonly baseUrl?: string
  readonly css: 'inline' | 'external'
  readonly timeline: 'inline' | 'external'
}

/** Non-zero exit with structured issues, rendered as JSON or as text depending on the flag. */
const failWithIssues = (issues: readonly Issue[], json: boolean): never => {
  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: false, issues }, null, 2)}\n`)
  } else {
    process.stderr.write(`${issues.length} issue(s):\n`)
    for (const issue of issues) {
      const where = [issue.scene, issue.figure, issue.part, issue.pose].filter(Boolean).join(' / ')
      const hint = issue.didYouMean === undefined ? '' : `  (did you mean '${issue.didYouMean}'?)`
      process.stderr.write(`  ${issue.code}${where === '' ? '' : ` [${where}]`}: ${issue.message}${hint}\n`)
    }
  }
  process.exit(1)
}

const fail = (message: string, json: boolean): never => {
  if (json) process.stdout.write(`${JSON.stringify({ ok: false, error: message }, null, 2)}\n`)
  else process.stderr.write(`dotscene: ${message}\n`)
  process.exit(1)
}

const requireScene = (scenes: Map<string, LoadedScene>, name: string | undefined, json: boolean): LoadedScene => {
  if (name === undefined) return fail(`which scene? one of: ${[...scenes.keys()].join(', ') || '(none found)'}`, json)
  const found = scenes.get(name)
  if (found === undefined) return fail(`no scene named '${name}'. Available: ${[...scenes.keys()].join(', ') || '(none)'}`, json)
  return found
}

/**
 * The names worth stepping through for a scene: its keyframes if it is staged, otherwise
 * every pose its figures define.
 */
const sceneSteps = (scene: Scene): readonly string[] => {
  const keyframes = scene.animate?.keyframes
  if (keyframes !== undefined) return keyframes.map((keyframe) => keyframe.name)
  const names = new Set<string>()
  for (const part of scene.parts) for (const pose of Object.keys(part.figure.poses)) names.add(pose)
  return [...names]
}

/**
 * Resolve a scene at a named step. A keyframe name wins over a pose name, so previewing a
 * staged animation shows the whole tableau — every part where the timeline puts it at that
 * instant, camera included — rather than one part changing shape in place.
 */
const staged = (scene: Scene, name: string): ResolvedScene => {
  const resolved = resolve(scene)
  const ms = keyframeTime(resolved, name)
  return ms === undefined ? resolve(withPose(scene, name)) : resolveAt(scene, ms)
}

const cmdList = (scenes: Map<string, LoadedScene>, options: Options): void => {
  const rows = [...scenes.values()].map(({ scene, file }) => ({
    name: scene.name,
    file: relative(process.cwd(), file),
    title: scene.title,
    ...(scene.version === undefined ? {} : { version: scene.version }),
    parts: scene.parts.map(partId),
    poses: sceneSteps(scene),
    animated: scene.animate !== undefined,
  }))

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: true, scenes: rows }, null, 2)}\n`)
    return
  }
  if (rows.length === 0) {
    process.stdout.write(`no scenes found in ${options.dir}/\n`)
    return
  }
  for (const row of rows) {
    const marks = [row.animated ? 'animated' : undefined, row.version === undefined ? undefined : `v${row.version}`, `${row.parts.length} part(s)`]
      .filter(Boolean)
      .join(', ')
    process.stdout.write(`${row.name}  (${marks})  ${row.file}\n`)
    if (row.poses.length > 0) process.stdout.write(`  poses: ${row.poses.join(', ')}\n`)
  }
}

const cmdInspect = (loaded: LoadedScene, options: Options): void => {
  const scene = loaded.scene
  const resolved =
    options.at !== undefined ? resolveAt(scene, options.at) : options.pose === undefined ? resolve(scene) : staged(scene, options.pose)

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          file: relative(process.cwd(), loaded.file),
          viewBox: resolved.viewBox,
          scene: sceneToJson(scene),
          animation: resolved.animation,
        },
        null,
        2,
      )}\n`,
    )
    return
  }

  process.stdout.write(`${scene.name}${scene.title === undefined ? '' : ` — ${scene.title}`}\n`)
  process.stdout.write(`  file     ${relative(process.cwd(), loaded.file)}\n`)
  process.stdout.write(`  viewBox  ${resolved.viewBox.join(' ')}\n`)
  for (const part of scene.parts) {
    const id = partId(part)
    process.stdout.write(`\n  part '${id}' — figure '${part.figure.name}'\n`)
    if (part.at !== undefined) process.stdout.write(`    at ${part.at.join(', ')}\n`)
    if (part.scale !== undefined) process.stdout.write(`    scale ${String(part.scale)}\n`)
    if (part.rotate !== undefined) process.stdout.write(`    rotate ${part.rotate}\n`)
    if (part.flipX === true) process.stdout.write(`    flipX\n`)
    if (part.pose !== undefined) process.stdout.write(`    pose ${typeof part.pose === 'string' ? part.pose : part.pose.name}\n`)
    process.stdout.write(`    points (${Object.keys(part.figure.points).length}):\n`)
    for (const [name, at] of Object.entries(part.figure.points)) {
      process.stdout.write(`      ${name.padEnd(12)} ${at[0]}, ${at[1]}\n`)
    }
    process.stdout.write(`    edges (${part.figure.edges.length}): `)
    process.stdout.write(`${part.figure.edges.map((edge) => `${edge.from}-${edge.to}`).join(' ')}\n`)
    const poses = Object.entries(part.figure.poses)
    if (poses.length > 0) {
      process.stdout.write(`    poses:\n`)
      for (const [name, override] of poses) {
        const moved = Object.keys(override)
        process.stdout.write(`      ${name.padEnd(12)} moves ${moved.length === 0 ? '(nothing)' : moved.join(', ')}\n`)
      }
    }
  }
  if (resolved.animation !== undefined) {
    const anim = resolved.animation
    process.stdout.write(
      `\n  animation  ${anim.mode}, ${anim.easing}, ${anim.cycle.length} keyframes, ${anim.duration}ms per lap${
        anim.camera === undefined ? '' : ', camera moves'
      }\n    moving ${anim.parts.join(', ')}\n`,
    )
    // A composed timeline can run to hundreds of steps; the list is for the hand-staged case.
    if (anim.cycle.length <= 40) {
      for (const name of anim.cycle) {
        const timing = anim.timings[name]!
        const movers = Object.keys(anim.frames[name] ?? {})
        process.stdout.write(
          `    ${name.padEnd(12)} ${timing.duration}ms in, ${timing.hold}ms hold   [${movers.join(', ')}]\n`,
        )
      }
    }
  }
}

const cmdPreview = (loaded: LoadedScene, options: Options): void => {
  const draw = (resolved: ResolvedScene): string => renderAscii(resolved, { width: options.width, labels: options.labels })

  let frames: { pose?: string; at?: number; art: string }[]
  if (options.every !== undefined || options.at !== undefined) {
    // Time-based: the same sampler the browser runs, so a frame here is a frame there.
    const lap = resolve(loaded.scene).animation?.duration ?? 0
    const step = options.every
    const instants =
      step === undefined || step <= 0
        ? [options.at ?? 0]
        : Array.from({ length: Math.max(1, Math.ceil(lap / step)) }, (_u, i) => i * step)
    frames = instants.map((at) => ({ at, art: draw(resolveAt(loaded.scene, at)) }))
  } else {
    const names = options.poses ? (loaded.scene.animate?.cycle ?? sceneSteps(loaded.scene)) : [options.pose ?? '']
    frames = names.map((pose) => ({
      ...(pose === '' ? {} : { pose }),
      art: draw(pose === '' ? resolve(loaded.scene) : staged(loaded.scene, pose)),
    }))
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: true, scene: loaded.scene.name, frames }, null, 2)}\n`)
    return
  }
  for (const frame of frames) {
    if (frame.pose !== undefined) process.stdout.write(`\n${loaded.scene.name} · ${frame.pose}\n`)
    if (frame.at !== undefined) process.stdout.write(`\n${loaded.scene.name} · ${frame.at}ms\n`)
    process.stdout.write(`${frame.art}\n`)
  }
}

const cmdCheck = (scenes: Map<string, LoadedScene>, options: Options): void => {
  const issues: Issue[] = []
  for (const { scene } of scenes.values()) {
    issues.push(...validateScene(scene))
  }
  if (issues.length > 0) failWithIssues(issues, options.json)

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: true, checked: [...scenes.keys()] }, null, 2)}\n`)
    return
  }
  process.stdout.write(`ok — ${scenes.size} scene(s) valid\n`)
}

const TEMPLATE = (name: string) => `import { defineFigure, defineScene, mirrorX } from 'dotscene'

/** Local space: y grows downward. Keep a figure roughly 64 units tall to match \`person\`. */
export const ${name} = defineFigure('${name}', {
  title: 'TODO: describe this figure',
  points: {
    a: [0, 0],
    b: [0, 20],
  },
  edges: [['a', 'b']],
  poses: {
    idle: {},
  },
})

export const scene = defineScene('${name}', {
  title: 'TODO: describe this scene',
  parts: [{ figure: ${name} }],
})
`

const cmdNew = async (name: string | undefined, options: Options): Promise<void> => {
  if (name === undefined) fail('dotscene new <name>', options.json)
  const file = resolvePath(options.dir, `${name!}.ts`)
  await mkdir(options.dir, { recursive: true })
  await writeFile(file, TEMPLATE(name!), { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') fail(`${relative(process.cwd(), file)} already exists`, options.json)
    throw error
  })
  const path = relative(process.cwd(), file)
  if (options.json) process.stdout.write(`${JSON.stringify({ ok: true, file: path }, null, 2)}\n`)
  else process.stdout.write(`created ${path}\n  next: dotscene preview ${name}\n`)
}


/**
 * Bundle the browser runtime.
 *
 * esbuild is a dev dependency, so it is imported here rather than at module load — the
 * read-only commands must keep working in an install that never builds.
 */
const bundleRuntime = async (): Promise<string> => {
  const { build } = await import('esbuild')
  const entry = resolvePath(dirname(fileURLToPath(import.meta.url)), 'runtime/index.ts')
  const result = await build({
    entryPoints: [entry],
    write: false,
    bundle: true,
    minify: true,
    format: 'iife',
    // Exposed as a global so a page can drive a scene by hand — goTo, stop, or mount
    // something it rendered itself.
    globalName: 'dotscene',
    target: 'es2020',
    legalComments: 'none',
  })
  return result.outputFiles[0]?.text ?? ''
}

/** `<name>-v<n>` files already under `versions/`, by scene name. */
const archivedVersions = async (dir: string): Promise<Record<string, number[]>> => {
  const found: Record<string, number[]> = {}
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return found
  }
  for (const file of names) {
    const match = /^(.+)-v(\d+)\.html$/.exec(file)
    if (match === null) continue
    ;(found[match[1]!] ??= []).push(Number(match[2]))
  }
  for (const list of Object.values(found)) list.sort((a, b) => a - b)
  return found
}

/**
 * The address the build will be served from, for the social card.
 *
 * A crawler resolves `og:image` against nothing, so the card needs an absolute URL and the
 * build has no other way to know one. `--base-url` wins; otherwise the `homepage` of the
 * project being built, which is where a site already records this. Neither means no card.
 */
const siteBaseUrl = async (options: Options): Promise<string | undefined> => {
  if (options.baseUrl !== undefined) return options.baseUrl.replace(/\/+$/, '')
  try {
    const pkg: unknown = JSON.parse(await readFile(resolvePath('package.json'), 'utf8'))
    const homepage = (pkg as { homepage?: unknown }).homepage
    return typeof homepage === 'string' && homepage !== '' ? homepage.replace(/\/+$/, '') : undefined
  } catch {
    return undefined
  }
}

/** Above this an image proxy is likely to refuse the file, and a browser to labour over it. */
const SMIL_LIMIT = 8 * 1024 * 1024

const cmdBuild = async (scenes: Map<string, LoadedScene>, options: Options): Promise<void> => {
  await mkdir(options.out, { recursive: true })

  const externalCss = options.css === 'external'
  const externalPoses = options.timeline === 'external'
  const compiled = [...scenes.values()].map(({ scene }) =>
    compile(scene, { ...(externalCss ? { styles: false } : {}), ...(externalPoses ? { poses: 'external' } : {}) }),
  )
  const written: string[] = []
  const runtime = compiled.some((entry) => entry.animated) ? await bundleRuntime() : ''

  for (const entry of compiled) {
    const svgFile = resolvePath(options.out, `${entry.name}.svg`)
    const htmlFile = resolvePath(options.out, `${entry.name}.html`)
    await writeFile(svgFile, `${entry.svg}\n`)
    await writeFile(htmlFile, `${entry.html}\n`)
    written.push(relative(process.cwd(), svgFile), relative(process.cwd(), htmlFile))
    if (externalCss) {
      const cssFile = resolvePath(options.out, `${entry.name}.css`)
      await writeFile(cssFile, `${entry.css}\n`)
      written.push(relative(process.cwd(), cssFile))
    }
    if (externalPoses && entry.poses !== undefined) {
      const posesFile = resolvePath(options.out, `${entry.name}.poses.json`)
      await writeFile(posesFile, `${entry.poses}\n`)
      written.push(relative(process.cwd(), posesFile))
    }
    // A self-playing copy for places no script runs, unless it would be too heavy to serve.
    if (entry.smil !== undefined && entry.smil.length <= SMIL_LIMIT) {
      const animFile = resolvePath(options.out, `${entry.name}.anim.svg`)
      await writeFile(animFile, `${entry.smil}\n`)
      written.push(relative(process.cwd(), animFile))
    }
  }

  // Versioned scenes are archived once, self-contained — the runtime inlined, so a frozen
  // copy keeps playing however the runtime changes later — and never overwritten.
  const versionsDir = resolvePath(options.out, 'versions')
  for (const [name, { scene }] of scenes) {
    const version = scene.version
    if (version === undefined) continue
    // Self-contained whatever the build's flags: styles and timeline inline, runtime inlined.
    const entry = externalCss || externalPoses ? compile(scene) : compiled.find((candidate) => candidate.name === name)!
    await mkdir(versionsDir, { recursive: true })
    const stem = resolvePath(versionsDir, `${entry.name}-v${version}`)
    const frozen = entry.html.replace(/<script src="[^"]*dotscene\.min\.js" defer><\/script>/, () => `<script>${runtime}</script>`)
    for (const [file, content] of [
      [`${stem}.svg`, `${entry.svg}\n`],
      [`${stem}.html`, `${frozen}\n`],
    ] as const) {
      try {
        await writeFile(file, content, { flag: 'wx' })
        written.push(relative(process.cwd(), file))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    }
  }
  const archives = await archivedVersions(versionsDir)

  // GitHub Pages runs Jekyll over the directory unless told not to; the build output is
  // already final, so opt out rather than letting it be reprocessed.
  const pagesMarker = resolvePath(options.out, '.nojekyll')
  await writeFile(pagesMarker, '')
  written.push(relative(process.cwd(), pagesMarker))

  const cssFile = resolvePath(options.out, 'dotscene.css')
  await writeFile(cssFile, `${DEFAULT_CSS}\n`)
  written.push(relative(process.cwd(), cssFile))

  // Files the page needs that no scene produces — the social card's PNG, above all. Copied
  // verbatim so `docs/` stays entirely build output and nothing in it is hand-placed.
  try {
    await cp(options.assets, options.out, { recursive: true })
    for (const file of await readdir(options.assets)) {
      written.push(relative(process.cwd(), resolvePath(options.out, file)))
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const baseUrl = await siteBaseUrl(options)
  const galleryFile = resolvePath(options.out, 'index.html')
  await writeFile(
    galleryFile,
    renderGallery(compiled, './dotscene.min.js', archives, {
      ...(baseUrl === undefined ? {} : { baseUrl }),
      ...(externalCss ? { styles: compiled.map((entry) => `./${entry.name}.css`) } : {}),
    }),
  )
  written.push(relative(process.cwd(), galleryFile))

  let runtimeBytes = 0
  if (runtime !== '') {
    const runtimeFile = resolvePath(options.out, 'dotscene.min.js')
    await writeFile(runtimeFile, runtime)
    runtimeBytes = Buffer.byteLength(runtime)
    written.push(relative(process.cwd(), runtimeFile))
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: true, files: written, runtimeBytes }, null, 2)}\n`)
    return
  }
  process.stdout.write(`built ${compiled.length} scene(s) into ${options.out}/\n`)
  for (const file of written) process.stdout.write(`  ${file}\n`)
  if (runtimeBytes > 0) process.stdout.write(`  runtime: ${runtimeBytes} bytes minified\n`)
}

export const run = async (argv: readonly string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      dir: { type: 'string', default: 'scenes' },
      json: { type: 'boolean', default: false },
      pose: { type: 'string' },
      poses: { type: 'boolean', default: false },
      at: { type: 'string' },
      every: { type: 'string' },
      width: { type: 'string', default: '44' },
      labels: { type: 'boolean', default: false },
      out: { type: 'string', default: 'docs' },
      assets: { type: 'string', default: 'site' },
      'base-url': { type: 'string' },
      css: { type: 'string', default: 'inline' },
      timeline: { type: 'string', default: 'inline' },
      help: { type: 'boolean', default: false },
    },
  })

  const options: Options = {
    dir: values.dir!,
    json: values.json!,
    ...(values.pose === undefined ? {} : { pose: values.pose }),
    poses: values.poses!,
    ...(values.at === undefined ? {} : { at: Number.parseFloat(values.at) || 0 }),
    ...(values.every === undefined ? {} : { every: Number.parseFloat(values.every) || 0 }),
    width: Number.parseInt(values.width!, 10) || 44,
    labels: values.labels!,
    out: values.out!,
    assets: values.assets!,
    css: values.css === 'external' ? 'external' : 'inline',
    timeline: values.timeline === 'external' ? 'external' : 'inline',
    ...(values['base-url'] === undefined ? {} : { baseUrl: values['base-url'] }),
  }

  const [command, target] = positionals
  if (values.help === true || command === undefined || command === 'help') {
    process.stdout.write(USAGE)
    return
  }

  if (command === 'new') {
    await cmdNew(target, options)
    return
  }

  const scenes = await loadScenes(options.dir)

  switch (command) {
    case 'list':
      return cmdList(scenes, options)
    case 'inspect':
      return cmdInspect(requireScene(scenes, target, options.json), options)
    case 'preview':
      return cmdPreview(requireScene(scenes, target, options.json), options)
    case 'check':
      return cmdCheck(scenes, options)
    case 'build':
      return cmdBuild(scenes, options)
    default:
      fail(`unknown command '${command}'. Run \`dotscene --help\`.`, options.json)
  }
}

export const main = async (argv: readonly string[]): Promise<void> => {
  const json = argv.includes('--json')
  try {
    await run(argv)
  } catch (error) {
    if (isIssueError(error)) failWithIssues(error.issues, json)
    fail(error instanceof Error ? error.message : String(error), json)
  }
}
