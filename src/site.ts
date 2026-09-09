/**
 * The gallery page.
 *
 * Every compiled scene shown beside the block that produces it — a showcase, and the visual
 * check that the SVG path agrees with what `dotscene preview` shows in the terminal. The
 * page opens on one scene playing at full width, so what the library does is the first thing
 * seen rather than the first thing described.
 */

import { animationPayload, type CompiledScene } from './compile.ts'
import { DEFAULT_CSS } from './render/svg.ts'

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttr = (value: string): string => escapeHtml(value).replace(/"/g, '&quot;')

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
 * The one scene that plays at the top whatever it weighs.
 *
 * The limit above is about a page of forty players. A hero is one, it is the reason someone
 * came, and it is worth its own weight — 128 kB over the wire, against 48 kB for the rest of
 * the page. A build whose scenes do not include it simply has no hero.
 */
const HERO = 'ediHeroMeadow'

/** Who and what the page says it is, to a reader and to a link unfurler. */
const SITE = {
  name: 'dotscene',
  tagline: 'Illustrations made of dots and lines',
  description:
    'Illustrations made of dots and lines — figures built from named points and the edges between them, with poses, a timeline and a camera. Every scene compiles to a self-contained block you paste onto a page.',
  repo: 'https://github.com/busse/dotscene',
  author: 'Chris Busse',
  authorUrl: 'https://www.linkedin.com/in/chrisbusse',
} as const

/**
 * The social preview card.
 *
 * A raster, not the SVG next to it: LinkedIn, Threads and Slack all decline an SVG `og:image`,
 * so the one file that has to work everywhere is a PNG. It is a still of the hero, kept in
 * `site/` and copied into the build — see `scripts/og-image.mjs` for how it is made.
 */
const OG_IMAGE = { file: 'og.png', width: 1200, height: 630 } as const

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
.lede { color: var(--muted); margin: 0 0 1.2rem; max-width: 46ch; }
.hero { margin: 0 0 2.2rem; border: 1px solid var(--rule); border-radius: .8rem; overflow: hidden; }
.hero .dotscene { width: 100%; height: auto; display: block; }
.links { margin: 0 0 3rem; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: .4rem 1.2rem; font-size: .9rem; }
.links a { color: inherit; }
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
.versions { font-size: .8rem; margin-top: -1rem; }
.versions a { color: inherit; }
.tag { display: inline-block; font-size: .72rem; color: var(--muted); border: 1px solid var(--rule);
       border-radius: 100px; padding: .1rem .5rem; margin-left: .4rem; vertical-align: middle; }
.colophon { border-top: 1px solid var(--rule); margin-top: 2rem; padding-top: 2rem; color: var(--muted); font-size: .9rem; }
.colophon a { color: inherit; }
`

export interface GalleryOptions {
  /**
   * Where the page will be served from, without a trailing slash.
   *
   * Only the social card needs it: `og:image` and `og:url` are resolved by a crawler that
   * never saw the page's own address, so they cannot be relative. Without it the page still
   * builds, and simply carries no card.
   */
  readonly baseUrl?: string
  /** Scene to play at the top of the page. Defaults to the EDI meadow; absent means no hero. */
  readonly hero?: string
}

export const renderGallery = (
  compiled: readonly CompiledScene[],
  runtimeSrc = './dotscene.min.js',
  archives: Readonly<Record<string, readonly number[]>> = {},
  options: GalleryOptions = {},
): string => {
  const { hero: heroName = HERO } = options
  // A base with a trailing slash is the ordinary way to write one; joining it blindly would
  // give a crawler `…//og.png`.
  const baseUrl = options.baseUrl?.replace(/\/+$/, '')
  const sections = compiled
    .map((entry) => {
      const title = entry.resolved.title ?? entry.name
      const version = entry.resolved.version
      const tag = entry.animated ? '<span class="tag">animated</span>' : ''
      const versionTag = version === undefined ? '' : `<span class="tag">v${version}</span>`
      // Every archived version, each a frozen page of its own; the current one is marked.
      const older = (archives[entry.name] ?? []).filter((v) => v !== version)
      const versions =
        older.length === 0
          ? ''
          : `<p class="versions">earlier: ${older
              .map((v) => `<a href="./versions/${entry.name}-v${v}.html">v${v}</a>`)
              .join(' · ')}</p>`
      // Shown as a still linking to its own page when it is too heavy to embed — and when it
      // is the hero, which is already playing at the top. Two live elements cannot share one
      // scene name.
      const asImage = entry.html.length > EMBED_LIMIT || entry.name === heroName
      const stage = asImage
        ? `            <a href="./${entry.name}.html"><img src="./${entry.name}.svg" alt="${escapeAttr(title)}" loading="lazy"></a>`
        : entry.inline
            .split('\n')
            .map((row) => `            ${row}`)
            .join('\n')
      return `      <section class="scene">
        <h2>${escapeHtml(entry.name)}${tag}${versionTag}${asImage ? '<span class="tag">open to play</span>' : ''}</h2>
        <p>${escapeHtml(title)}</p>${versions}
        <div class="layout">
          <div class="stage">
${stage}
          </div>
          <pre><code>${codeFor(entry)}</code></pre>
        </div>
      </section>`
    })
    .join('\n')

  const hero = compiled.find((entry) => entry.name === heroName)
  const heroBlock =
    hero === undefined
      ? ''
      : `      <figure class="hero">
${hero.inline
  .split('\n')
  .map((row) => `        ${row}`)
  .join('\n')}
      </figure>
`

  const embedded = compiled.filter(
    (entry) => entry.animated && (entry.html.length <= EMBED_LIMIT || entry.name === heroName),
  )
  const anyAnimated = embedded.length > 0
  const payloads = embedded
    .map((entry) => {
      const payload = animationPayload(entry.resolved)
      return payload === undefined
        ? undefined
        : `    <script type="application/json" data-dotscene-poses="${entry.name}">${payload}</script>`
    })
    .filter((row): row is string => row !== undefined)
    .join('\n')

  // A crawler resolves these against nothing, so they are absolute or they are absent.
  const card =
    baseUrl === undefined
      ? ''
      : `
    <link rel="canonical" href="${escapeAttr(baseUrl)}/">
    <meta property="og:url" content="${escapeAttr(baseUrl)}/">
    <meta property="og:image" content="${escapeAttr(baseUrl)}/${OG_IMAGE.file}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="${OG_IMAGE.width}">
    <meta property="og:image:height" content="${OG_IMAGE.height}">
    <meta property="og:image:alt" content="${escapeAttr(`A still of the ${SITE.name} EDI hero: a freight lifecycle drawn as dots and lines on a meadow.`)}">
    <meta name="twitter:image" content="${escapeAttr(baseUrl)}/${OG_IMAGE.file}">`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(SITE.name)} — ${escapeHtml(SITE.tagline.toLowerCase())}</title>
    <meta name="description" content="${escapeAttr(SITE.description)}">
    <meta name="author" content="${escapeAttr(SITE.author)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeAttr(SITE.name)}">
    <meta property="og:title" content="${escapeAttr(`${SITE.name} — ${SITE.tagline.toLowerCase()}`)}">
    <meta property="og:description" content="${escapeAttr(SITE.description)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(`${SITE.name} — ${SITE.tagline.toLowerCase()}`)}">
    <meta name="twitter:description" content="${escapeAttr(SITE.description)}">${card}
    <style>${DEFAULT_CSS}${PAGE_CSS}</style>
  </head>
  <body>
    <main>
${heroBlock}      <h1>${escapeHtml(SITE.name)}</h1>
      <p class="lede">Scenes drawn as dots and lines. Each block below is self-contained — copy it onto any page.</p>
      <ul class="links">
        <li><a href="${SITE.repo}">Source on GitHub</a></li>
        <li><a href="${SITE.repo}#readme">README</a></li>
        <li><a href="${SITE.repo}/blob/main/CASE-STUDY.md">Case study</a></li>
        <li><a href="${SITE.repo}/blob/main/LICENSE">MIT licence</a></li>
        <li><a href="${SITE.authorUrl}">${escapeHtml(SITE.author)} on LinkedIn</a></li>
      </ul>
${sections}
      <footer class="colophon">
        <p>Built with <a href="${SITE.repo}">${escapeHtml(SITE.name)}</a>. Every scene on this page is generated from the source in <code>scenes/</code> — no drawing tool, no hand-tuned SVG.</p>
        <p>By <a href="${SITE.authorUrl}">${escapeHtml(SITE.author)}</a> · <a href="${SITE.repo}/issues">Issues and questions</a> · MIT licensed.</p>
      </footer>
    </main>
${payloads}
${anyAnimated ? `    <script src="${runtimeSrc}" defer></script>` : ''}
  </body>
</html>
`
}
