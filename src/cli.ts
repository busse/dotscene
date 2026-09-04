/**
 * The dotscene command line.
 *
 * Every command takes `--json` and prints machine-readable output, and every failure exits
 * non-zero with structured issues. That is deliberate: the usual operator here is an agent,
 * and the difference between prose errors and structured ones is the difference between a
 * two-turn correction loop and a one-turn one.
 */

import { parseArgs } from 'node:util'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from './compile.ts'
import { resolve } from './layout.ts'
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
  --pose <name>     which pose to inspect or preview
  --poses           preview every pose in turn
  --width <n>       preview width in characters (default: 44)
  --labels          annotate preview dots with their point names
  --out <path>      build output directory (default: dist)
  --help            this message
`

interface Options {
  readonly dir: string
  readonly json: boolean
  readonly pose?: string
  readonly poses: boolean
  readonly width: number
  readonly labels: boolean
  readonly out: string
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

/** Every pose name reachable in a scene, in declaration order, deduplicated. */
const scenePoses = (scene: Scene): readonly string[] => {
  const names = new Set<string>()
  for (const part of scene.parts) for (const pose of Object.keys(part.figure.poses)) names.add(pose)
  return [...names]
}

const cmdList = (scenes: Map<string, LoadedScene>, options: Options): void => {
  const rows = [...scenes.values()].map(({ scene, file }) => ({
    name: scene.name,
    file: relative(process.cwd(), file),
    title: scene.title,
    parts: scene.parts.map(partId),
    poses: scenePoses(scene),
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
    const marks = [row.animated ? 'animated' : undefined, `${row.parts.length} part(s)`].filter(Boolean).join(', ')
    process.stdout.write(`${row.name}  (${marks})  ${row.file}\n`)
    if (row.poses.length > 0) process.stdout.write(`  poses: ${row.poses.join(', ')}\n`)
  }
}

const cmdInspect = (loaded: LoadedScene, options: Options): void => {
  const scene = options.pose === undefined ? loaded.scene : withPose(loaded.scene, options.pose)
  const resolved = resolve(scene)

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
      `\n  animation  part '${anim.part}', cycle ${anim.cycle.join(' -> ')}, ${anim.duration}ms over ${anim.hold}ms hold, ${anim.mode}\n`,
    )
  }
}

const cmdPreview = (loaded: LoadedScene, options: Options): void => {
  const names = options.poses
    ? (loaded.scene.animate?.cycle ?? scenePoses(loaded.scene))
    : [options.pose ?? '']

  const frames = names.map((pose) => {
    const scene = pose === '' ? loaded.scene : withPose(loaded.scene, pose)
    return {
      pose: pose === '' ? undefined : pose,
      art: renderAscii(resolve(scene), { width: options.width, labels: options.labels }),
    }
  })

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: true, scene: loaded.scene.name, frames }, null, 2)}\n`)
    return
  }
  for (const frame of frames) {
    if (frame.pose !== undefined) process.stdout.write(`\n${loaded.scene.name} · ${frame.pose}\n`)
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
const bundleRuntime = async (outfile: string): Promise<number> => {
  const { build } = await import('esbuild')
  const entry = resolvePath(dirname(fileURLToPath(import.meta.url)), 'runtime/index.ts')
  const result = await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    minify: true,
    format: 'iife',
    // Exposed as a global so a page can drive a scene by hand — goTo, stop, or mount
    // something it rendered itself.
    globalName: 'dotscene',
    target: 'es2020',
    legalComments: 'none',
    metafile: true,
  })
  return Object.values(result.metafile.outputs)[0]?.bytes ?? 0
}

const cmdBuild = async (scenes: Map<string, LoadedScene>, options: Options): Promise<void> => {
  await mkdir(options.out, { recursive: true })

  const compiled = [...scenes.values()].map(({ scene }) => compile(scene))
  const written: string[] = []

  for (const entry of compiled) {
    const svgFile = resolvePath(options.out, `${entry.name}.svg`)
    const htmlFile = resolvePath(options.out, `${entry.name}.html`)
    await writeFile(svgFile, `${entry.svg}\n`)
    await writeFile(htmlFile, `${entry.html}\n`)
    written.push(relative(process.cwd(), svgFile), relative(process.cwd(), htmlFile))
  }

  const cssFile = resolvePath(options.out, 'dotscene.css')
  await writeFile(cssFile, `${DEFAULT_CSS}\n`)
  written.push(relative(process.cwd(), cssFile))

  const galleryFile = resolvePath(options.out, 'index.html')
  await writeFile(galleryFile, renderGallery(compiled))
  written.push(relative(process.cwd(), galleryFile))

  let runtimeBytes = 0
  if (compiled.some((entry) => entry.animated)) {
    const runtimeFile = resolvePath(options.out, 'dotscene.min.js')
    runtimeBytes = await bundleRuntime(runtimeFile)
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
      width: { type: 'string', default: '44' },
      labels: { type: 'boolean', default: false },
      out: { type: 'string', default: 'dist' },
      help: { type: 'boolean', default: false },
    },
  })

  const options: Options = {
    dir: values.dir!,
    json: values.json!,
    ...(values.pose === undefined ? {} : { pose: values.pose }),
    poses: values.poses!,
    width: Number.parseInt(values.width!, 10) || 44,
    labels: values.labels!,
    out: values.out!,
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
