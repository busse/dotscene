import { describe, expect, it } from 'vitest'
import { defineFigure, defineScene } from '../src/index.ts'
import { compile } from '../src/compile.ts'
import { renderGallery } from '../src/site.ts'
import { scene as heroMeadow } from '../scenes/edi/hero.ts'

const bar = defineFigure('bar', {
  title: 'A bar',
  points: { top: [0, 0], base: [0, 10] },
  edges: [['top', 'base']],
  poses: { tip: { top: [4, 0] } },
})

const still = compile(defineScene('still', { title: 'A still', parts: [{ figure: bar }] }))

const BASE = 'https://example.test/gallery'

describe('the gallery page', () => {
  it('plays the hero at the top, above the words, with nothing written over it', () => {
    const page = renderGallery([still], './dotscene.min.js', {}, { hero: 'still' })
    expect(page).toContain('<figure class="hero">')
    // The hero comes before the heading, and carries no copy of its own.
    expect(page.indexOf('<figure class="hero">')).toBeLessThan(page.indexOf('<h1>'))
    const figure = page.slice(page.indexOf('<figure class="hero">'), page.indexOf('</figure>'))
    expect(figure).toContain('data-dotscene="still"')
    expect(figure).not.toContain('<h1')
    expect(figure).not.toContain('<p')
  })

  it('has no hero when the named scene is not in the build', () => {
    const page = renderGallery([still], './dotscene.min.js', {}, { hero: 'absent' })
    expect(page).not.toContain('class="hero"')
    expect(page).toContain('<h1>dotscene</h1>')
  })

  it('mounts the hero once, so nothing else claims its name', () => {
    const page = renderGallery([still], './dotscene.min.js', {}, { hero: 'still' })
    const live = page.replace(/<pre><code>[\s\S]*?<\/code><\/pre>/g, '')
    expect(live.match(/<svg[^>]*data-dotscene="still"/g)).toHaveLength(1)
    expect(live.match(/data-dotscene-poses="still"/g)).toBeNull()
  })

  it('embeds the hero live however heavy it is, and sends its timeline once', () => {
    // The gallery shows a scene this size as a still image linking to its own page. The hero
    // is the exception the limit exists to allow: one scene, playing, at the top.
    const meadow = compile(heroMeadow)
    expect(meadow.html.length).toBeGreaterThan(90_000)
    const page = renderGallery([meadow], './dotscene.min.js', {}, { hero: meadow.name })
    const live = page.replace(/<pre><code>[\s\S]*?<\/code><\/pre>/g, '')
    expect(live.match(new RegExp(`<svg[^>]*data-dotscene="${meadow.name}"`, 'g'))).toHaveLength(1)
    expect(live.match(new RegExp(`data-dotscene-poses="${meadow.name}"`, 'g'))).toHaveLength(1)
    expect(page).toContain('<script src="./dotscene.min.js" defer></script>')
  })

  it('gives a link unfurler an absolute card, because it resolves nothing itself', () => {
    const page = renderGallery([still], './dotscene.min.js', {}, { baseUrl: BASE })
    expect(page).toContain(`<meta property="og:image" content="${BASE}/og.png">`)
    expect(page).toContain(`<meta property="og:url" content="${BASE}/">`)
    expect(page).toContain(`<link rel="canonical" href="${BASE}/">`)
    expect(page).toContain('<meta property="og:image:width" content="1200">')
    expect(page).toContain('<meta property="og:image:height" content="630">')
    expect(page).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(page).toContain(`<meta name="twitter:image" content="${BASE}/og.png">`)
    // A trailing slash on the base must not become a double one in the tags.
    const trailing = renderGallery([still], './dotscene.min.js', {}, { baseUrl: `${BASE}/` })
    expect(trailing).not.toContain('//og.png')
  })

  it('omits the card rather than emitting a relative one that cannot work', () => {
    const page = renderGallery([still])
    expect(page).not.toContain('og:image')
    expect(page).not.toContain('og:url')
    expect(page).not.toContain('rel="canonical"')
    // The tags that need no address still stand.
    expect(page).toContain('<meta property="og:title"')
    expect(page).toContain('<meta property="og:description"')
    expect(page).toContain('<meta name="description"')
  })

  it('credits the author and points at the source, top and bottom', () => {
    const page = renderGallery([still])
    expect(page).toContain('https://github.com/busse/dotscene')
    expect(page).toContain('https://www.linkedin.com/in/chrisbusse')
    expect(page).toContain('<meta name="author" content="Chris Busse">')
    expect(page).toContain('<footer class="colophon">')
    const links = page.slice(page.indexOf('<ul class="links">'), page.indexOf('</ul>'))
    expect(links).toContain('Source on GitHub')
    expect(links).toContain('Chris Busse on LinkedIn')
  })

  it('escapes a title into an attribute rather than breaking out of it', () => {
    const quoted = compile(
      defineScene('quoted', { title: 'A "big" <bar> & co', parts: [{ figure: bar }] }),
    )
    // Long enough to be shown as an image, which is where a title lands in an alt attribute.
    const page = renderGallery([{ ...quoted, html: 'x'.repeat(90_001) }])
    expect(page).toContain('alt="A &quot;big&quot; &lt;bar&gt; &amp; co"')
  })
})
