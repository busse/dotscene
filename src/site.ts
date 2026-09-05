/**
 * The gallery page.
 *
 * Every compiled scene shown beside the block that produces it — a showcase, and the visual
 * check that the SVG path agrees with what `dotscene preview` shows in the terminal.
 */

import type { CompiledScene } from './compile.ts'
import { DEFAULT_CSS } from './render/svg.ts'

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Longest block shown in full. Past this the gallery is mostly a copy of itself. */
const CODE_LIMIT = 6000

/**
 * Largest scene the gallery embeds live.
 *
 * A gallery of everything cannot also be a player for everything: a scene carrying a few
 * hundred kilobytes of geometry, inlined, makes a page nobody waits for. Under the limit a
 * scene is embedded and animates in place; over it, the gallery shows the file as an image
 * and points at its own page, where it plays properly.
 */
const EMBED_LIMIT = 90_000

/**
 * The copyable block, or its opening if it is long.
 *
 * A gallery shows every scene twice — once drawn and once as source — so a scene carrying a
 * few hundred kilobytes of geometry makes a page nobody can load. Past a limit the source is
 * cut off and the reader is pointed at the file, which is the thing they would copy anyway.
 */
const codeFor = (entry: CompiledScene): string => {
  if (entry.html.length <= CODE_LIMIT) return escapeHtml(entry.html)
  const head = entry.html.slice(0, CODE_LIMIT)
  const kb = (entry.html.length / 1024).toFixed(0)
  return `${escapeHtml(head.slice(0, head.lastIndexOf('\n')))}\n<span class="cut">… ${kb} kB in total — copy <a href="./${entry.name}.html">${entry.name}.html</a> instead</span>`
}

const PAGE_CSS = `
:root {
  --bg: #fbfbf9; --fg: #1b1b1a; --muted: #6b6b66; --rule: #e2e2dd; --code-bg: #f4f4f1;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #16161a; --fg: #e8e8e4; --muted: #9a9a93; --rule: #2c2c31; --code-bg: #1e1e23; }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 3rem 1.5rem 6rem; background: var(--bg); color: var(--fg);
  font: 16px/1.6 ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
}
main { max-width: 62rem; margin: 0 auto; }
h1 { font-size: 1.6rem; letter-spacing: -0.01em; margin: 0 0 .3rem; }
.lede { color: var(--muted); margin: 0 0 3rem; max-width: 46ch; }
.scene { border-top: 1px solid var(--rule); padding: 2.5rem 0; }
.scene h2 { font-size: 1.05rem; margin: 0 0 .2rem; }
.scene p { color: var(--muted); margin: 0 0 1.5rem; font-size: .9rem; }
.layout { display: grid; grid-template-columns: minmax(0, 20rem) minmax(0, 1fr); gap: 2rem; align-items: start; }
@media (max-width: 44rem) { .layout { grid-template-columns: 1fr; } }
.stage { display: grid; place-items: center; padding: 1.5rem; border: 1px solid var(--rule); border-radius: .6rem; }
.stage .dotscene, .stage img { width: 100%; height: auto; max-height: 15rem; display: block; }
.stage a { display: block; }
pre {
  margin: 0; padding: 1rem; overflow: auto; max-height: 15rem; background: var(--code-bg);
  border-radius: .6rem; font-size: .74rem; line-height: 1.5;
}
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.cut { display: block; margin-top: .8em; color: var(--muted); font-style: italic; }
.cut a { color: inherit; }
.tag { display: inline-block; font-size: .72rem; color: var(--muted); border: 1px solid var(--rule);
       border-radius: 100px; padding: .1rem .5rem; margin-left: .4rem; vertical-align: middle; }
`

export const renderGallery = (compiled: readonly CompiledScene[], runtimeSrc = './dotscene.min.js'): string => {
  const sections = compiled
    .map((entry) => {
      const title = entry.resolved.title ?? entry.name
      const tag = entry.animated ? '<span class="tag">animated</span>' : ''
      const heavy = entry.html.length > EMBED_LIMIT
      const stage = heavy
        ? `            <a href="./${entry.name}.html"><img src="./${entry.name}.svg" alt="${escapeHtml(title)}" loading="lazy"></a>`
        : entry.svg
            .split('\n')
            .map((row) => `            ${row}`)
            .join('\n')
      return `      <section class="scene">
        <h2>${escapeHtml(entry.name)}${tag}${heavy ? '<span class="tag">open to play</span>' : ''}</h2>
        <p>${escapeHtml(title)}</p>
        <div class="layout">
          <div class="stage">
${stage}
          </div>
          <pre><code>${codeFor(entry)}</code></pre>
        </div>
      </section>`
    })
    .join('\n')

  const anyAnimated = compiled.some((entry) => entry.animated && entry.html.length <= EMBED_LIMIT)
  const payloads = compiled
    .map((entry) =>
      entry.animated && entry.html.length <= EMBED_LIMIT
        ? `    <script type="application/json" data-dotscene-poses="${entry.name}">${
            entry.html.match(/data-dotscene-poses="[^"]*">([\s\S]*?)<\/script>/)?.[1] ?? '{}'
          }</script>`
        : undefined,
    )
    .filter((row): row is string => row !== undefined)
    .join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>dotscene gallery</title>
    <style>${DEFAULT_CSS}${PAGE_CSS}</style>
  </head>
  <body>
    <main>
      <h1>dotscene</h1>
      <p class="lede">Scenes drawn as dots and lines. Each block below is self-contained — copy it onto any page.</p>
${sections}
    </main>
${payloads}
${anyAnimated ? `    <script src="${runtimeSrc}" defer></script>` : ''}
  </body>
</html>
`
}
