import { describe, expect, it } from 'vitest'
import { DEFAULT_CSS, compile, defineFigure, defineScene, resolve, renderAscii, renderSvg } from '../src/index.ts'
import { sceneFromJson, sceneToJson } from '../src/serialize.ts'

const bar = defineFigure('bar', {
  title: 'A bar',
  points: { top: [0, 0], base: [0, 10] },
  edges: [['top', 'base']],
  poses: { tip: { top: [4, 0] } },
})

describe('resolve', () => {
  it('fits the viewBox to the content plus padding', () => {
    const resolved = resolve(defineScene('s', { parts: [{ figure: bar }], padding: 2 }))
    expect(resolved.viewBox).toEqual([-2, -2, 4, 14])
  })

  it('honours an explicit viewBox', () => {
    const resolved = resolve(defineScene('s', { parts: [{ figure: bar }], viewBox: [0, 0, 100, 100] }))
    expect(resolved.viewBox).toEqual([0, 0, 100, 100])
  })

  it('applies part transforms to every point', () => {
    const resolved = resolve(defineScene('s', { parts: [{ figure: bar, at: [10, 0], scale: 2 }] }))
    expect(resolved.dots.map((dot) => dot.at)).toEqual([
      [10, 0],
      [10, 20],
    ])
  })

  it('spans every pose in the cycle so a moving point never clips', () => {
    const wide = defineFigure('wide', {
      points: { a: [0, 0], b: [0, 10] },
      edges: [['a', 'b']],
      poses: { out: { a: [40, 0] } },
    })
    const resolved = resolve(
      defineScene('s', { parts: [{ figure: wide }], padding: 0, animate: { cycle: ['out'] } }),
    )
    expect(resolved.viewBox).toEqual([0, 0, 40, 10])
  })

  it('exposes cycle frames in scene space', () => {
    const resolved = resolve(
      defineScene('s', { parts: [{ figure: bar, at: [5, 5] }], animate: { cycle: ['tip'] } }),
    )
    expect(resolved.animation?.points.bar).toEqual(['top', 'base'])
    expect(resolved.animation?.frames.tip?.bar).toEqual([9, 5, 5, 15])
  })

  it('names the part it animates even when the scene has several', () => {
    const resolved = resolve(
      defineScene('s', {
        parts: [{ figure: bar }, { figure: bar, id: 'second', at: [20, 0] }],
        animate: { part: 'second', cycle: ['tip'] },
      }),
    )
    expect(resolved.animation?.parts).toEqual(['second'])
  })
})

describe('renderSvg', () => {
  it('emits a self-contained block with point names attached', () => {
    const svg = renderSvg(resolve(defineScene('bar', { parts: [{ figure: bar }], title: 'A bar', padding: 1 })))
    expect(svg).toMatchInlineSnapshot(`
      "<svg xmlns="http://www.w3.org/2000/svg" class="dotscene" data-dotscene="bar" viewBox="-1 -1 2 12" role="img">
        <title>A bar</title>
        <style>:where(.dotscene){--ds-zoom:1}:where(.dotscene .ds-line){stroke:var(--ds-line-stroke,currentColor);stroke-width:calc(var(--ds-line-w,0.55) * var(--ds-zoom,1));stroke-linecap:round;fill:none}:where(.dotscene .ds-dot){fill:var(--ds-dot-fill,currentColor);r:calc(var(--ds-dot-r,1.2) * var(--ds-zoom,1))}:where(.dotscene .ds-face){fill:var(--ds-face-fill,#ffffff);stroke:none}:where(svg[data-dotscene="bar"]){--ds-dot-r:1.6;--ds-line-w:0.72}</style>
        <defs><clipPath id="ds-clip-bar"><rect class="ds-clip" x="-1" y="-1" width="2" height="12"/></clipPath></defs>
        <g clip-path="url(#ds-clip-bar)">
          <g data-part="bar">
          <line class="ds-line" data-part="bar" data-a="top" data-b="base" x1="0" y1="0" x2="0" y2="10"/>
          <circle class="ds-dot" data-part="bar" data-p="top" cx="0" cy="0" r="1.6"/>
          <circle class="ds-dot" data-part="bar" data-p="base" cx="0" cy="10" r="1.6"/>
          </g>
        </g>
      </svg>"
    `)
  })

  it('marks an untitled scene as decorative rather than leaving an unlabeled image', () => {
    const svg = renderSvg(resolve(defineScene('bar', { parts: [{ figure: bar }] })), { styles: false })
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).not.toContain('role="img"')
    expect(svg).not.toContain('<style>')
  })

  it('escapes markup in a title', () => {
    const svg = renderSvg(resolve(defineScene('x', { parts: [{ figure: bar }], title: '<b> & "co"' })))
    expect(svg).toContain('<title>&lt;b&gt; &amp; &quot;co&quot;</title>')
  })

  it('tags an edge kind as both a class and a data attribute', () => {
    const dashed = defineFigure('d', { points: { a: [0, 0], b: [5, 0] }, edges: [{ from: 'a', to: 'b', kind: 'soft' }] })
    const svg = renderSvg(resolve(defineScene('d', { parts: [{ figure: dashed }] })))
    expect(svg).toContain('class="ds-line ds-line--soft"')
  })

  it('clips content to the viewBox, so anything staged off-screen stays off-screen', () => {
    const wide = defineScene('stage', {
      parts: [{ figure: bar, at: [500, 0] }],
      viewBox: [0, 0, 100, 20],
    })
    const svg = renderSvg(resolve(wide))
    expect(svg).toContain('<clipPath id="ds-clip-stage"><rect class="ds-clip" x="0" y="0" width="100" height="20"/></clipPath>')
    expect(svg).toContain('<g clip-path="url(#ds-clip-stage)">')
    // The off-stage geometry is still emitted — the runtime needs it to animate — but the
    // clip is what keeps it invisible until a keyframe walks it on.
    expect(svg).toContain('cx="500"')
  })

  it('escapes the stylesheet for a standalone file, where a nesting & is fatal XML', () => {
    const themed = defineScene('themed', { parts: [{ figure: bar }], css: ':root[data-theme="dark"] &{.ds-line{stroke:#fff}}' })
    const file = renderSvg(resolve(themed), { xml: true })
    const block = renderSvg(resolve(themed))
    expect(file).toContain('&amp;{')
    expect(file).not.toMatch(/&\{/)
    // Inside an HTML page a <style> is raw text, so the block keeps the & literal.
    expect(block).toContain('&{')
  })

  it('covers its box when asked to, the way a background must', () => {
    const cover = renderSvg(resolve(defineScene('bg', { parts: [{ figure: bar }], fit: 'slice' })))
    expect(cover).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(renderSvg(resolve(defineScene('bg', { parts: [{ figure: bar }] })))).not.toContain('preserveAspectRatio')
  })

  it('names the clip after the scene so two scenes on one page do not collide', () => {
    const a = renderSvg(resolve(defineScene('one', { parts: [{ figure: bar }] })))
    const b = renderSvg(resolve(defineScene('two', { parts: [{ figure: bar }] })))
    expect(a).toContain('ds-clip-one')
    expect(b).toContain('ds-clip-two')
  })

  it('is byte-stable across renders', () => {
    const scene = defineScene('bar', { parts: [{ figure: bar, rotate: 33, scale: 1.7 }] })
    expect(renderSvg(resolve(scene))).toBe(renderSvg(resolve(scene)))
  })
})

describe('renderAscii', () => {
  it('draws a vertical bar as a column of line glyphs capped by dots', () => {
    const art = renderAscii(resolve(defineScene('bar', { parts: [{ figure: bar }], padding: 1 })), {
      width: 9,
      height: 5,
    })
    expect(art).toMatchInlineSnapshot(`
      "    ·
          │
          │
          │
          ·"
    `)
  })

  it('picks the diagonal that matches the stroke direction', () => {
    const slash = defineFigure('s', { points: { a: [0, 0], b: [10, 10] }, edges: [['a', 'b']] })
    const art = renderAscii(resolve(defineScene('s', { parts: [{ figure: slash }], padding: 0 })), { width: 12 })
    expect(art).toContain('╲')
    expect(art).not.toContain('╱')
  })

  it('never draws a label over the figure', () => {
    const art = renderAscii(resolve(defineScene('bar', { parts: [{ figure: bar }], padding: 1 })), {
      width: 24,
      labels: true,
    })
    expect(art).toContain('top')
    expect(art).toContain('base')
  })
})

describe('json scenes', () => {
  it('round-trips a scene through the JSON format', () => {
    const scene = defineScene('bar', {
      title: 'A bar',
      parts: [{ figure: bar, at: [3, 4] }],
      animate: { cycle: ['tip'], mode: 'pingpong' },
    })
    const back = sceneFromJson(sceneToJson(scene))
    expect(resolve(back)).toEqual(resolve(scene))
  })

  it('rejects a part naming a figure the file does not define', () => {
    expect(() =>
      sceneFromJson({ name: 'x', figures: {}, parts: [{ figure: 'ghost' }] }),
    ).toThrow(/references figure 'ghost'/)
  })
})

describe('scene css', () => {
  const kinded = defineFigure('k', {
    points: { a: [0, 0], b: [10, 0] },
    edges: [{ from: 'a', to: 'b', kind: 'road' }],
  })

  it('scopes a scene\'s own rules to that scene', () => {
    const svg = renderSvg(
      resolve(defineScene('town', { parts: [{ figure: kinded }], css: '.ds-line--road{stroke-width:2}' })),
    )
    expect(svg).toContain(':where(svg[data-dotscene="town"]){.ds-line--road{stroke-width:2}}')
  })

  it('emits nothing extra when a scene sets no css', () => {
    const svg = renderSvg(resolve(defineScene('town', { parts: [{ figure: kinded }] })))
    expect(svg).not.toContain(':where(svg[data-dotscene="town"]){.')
  })

  it('gives a kinded edge a class the scene css can reach', () => {
    const svg = renderSvg(resolve(defineScene('town', { parts: [{ figure: kinded }] })))
    expect(svg).toContain('class="ds-line ds-line--road"')
  })
})

describe('roles and ground', () => {
  const roled = defineFigure('r', {
    points: { hub: [0, 0], rim: [10, 0] },
    pointKinds: { hub: 'ink' },
    edges: [{ from: 'hub', to: 'rim', kind: 'guide' }],
  })

  it('gives a labelled dot a class to colour by role', () => {
    const svg = renderSvg(resolve(defineScene('s', { parts: [{ figure: roled }] })))
    expect(svg).toContain('class="ds-dot ds-dot--ink"')
    expect(svg).toContain('class="ds-dot" data-part="r" data-p="rim"')
  })

  it('rejects a role label on a point that does not exist, and suggests the real one', () => {
    let caught: unknown
    try {
      defineFigure('r', { points: { hub: [0, 0] }, edges: [], pointKinds: { hubb: 'ink' } })
    } catch (error) {
      caught = error
    }
    const [issue] = (caught as { issues: readonly { code: string; didYouMean?: string }[] }).issues
    expect(issue?.code).toBe('UNKNOWN_POINT')
    expect(issue?.didYouMean).toBe('hub')
  })

  it('paints an explicit ground covering the viewBox, for files no page will style', () => {
    const svg = renderSvg(
      resolve(defineScene('s', { parts: [{ figure: roled }], viewBox: [0, 0, 40, 20], background: '#fbfaf7' })),
    )
    expect(svg).toContain('<rect class="ds-bg" x="0" y="0" width="40" height="20" fill="#fbfaf7"/>')
  })

  it('leaves the ground alone when a scene does not ask for one', () => {
    expect(renderSvg(resolve(defineScene('s', { parts: [{ figure: roled }] })))).not.toContain('ds-bg')
  })
})

describe('faces and paint order', () => {
  const walled = defineFigure('walled', {
    points: { a: [0, 0], b: [10, 0], c: [10, 10], d: [0, 10] },
    edges: [['a', 'b'], ['b', 'c']],
    faces: [{ points: ['a', 'b', 'c', 'd'], kind: 'wall' }],
  })
  const flat = defineFigure('flat', {
    points: { p: [-5, 5], q: [15, 5] },
    edges: [['p', 'q']],
  })

  it('emits a face as a polygon carrying the names of its rim', () => {
    const svg = renderSvg(resolve(defineScene('s', { parts: [{ figure: walled }] })))
    expect(svg).toContain('<polygon class="ds-face ds-face--wall" data-part="walled" data-face="a b c d"')
    expect(svg).toContain('points="0,0 10,0 10,10 0,10"')
  })

  it('paints a part\'s faces under that part\'s own strokes', () => {
    const svg = renderSvg(resolve(defineScene('s', { parts: [{ figure: walled }] })))
    expect(svg.indexOf('<polygon')).toBeLessThan(svg.indexOf('<line'))
  })

  it('paints parts in declaration order, which is what lets a wall hide what is behind it', () => {
    const svg = renderSvg(
      resolve(defineScene('s', { parts: [{ figure: flat }, { figure: walled }] })),
    )
    // The flat part's line is emitted before the wall's polygon, so the wall covers it.
    expect(svg.indexOf('data-part="flat"')).toBeLessThan(svg.indexOf('<polygon'))
  })

  it('keeps a dot above its own part\'s lines', () => {
    const svg = renderSvg(resolve(defineScene('s', { parts: [{ figure: walled }] })))
    expect(svg.indexOf('<line')).toBeLessThan(svg.indexOf('<circle'))
  })

  it('takes the face fill from the scene\'s own ground, so a wall hides rather than reveals', () => {
    const svg = renderSvg(resolve(defineScene('s', { parts: [{ figure: walled }], background: '#fbfaf7' })))
    expect(svg).toContain('--ds-face-fill:#fbfaf7')
  })

  it('rejects a face with fewer than three points', () => {
    expect(() =>
      defineFigure('x', { points: { a: [0, 0], b: [1, 1] }, edges: [], faces: [{ points: ['a', 'b'] }] }),
    ).toThrow(/at least three points/)
  })

  it('rejects a face naming a point that does not exist, and suggests the real one', () => {
    let caught: unknown
    try {
      defineFigure('x', { points: { top: [0, 0], mid: [1, 1], base: [2, 2] }, edges: [], faces: [{ points: ['top', 'mid', 'bse'] }] })
    } catch (error) {
      caught = error
    }
    const issue = (caught as { issues: readonly { code: string; didYouMean?: string }[] }).issues[0]
    expect(issue?.code).toBe('UNKNOWN_POINT')
    expect(issue?.didYouMean).toBe('base')
  })
})

describe('default css on a page with several scenes', () => {
  // Each block carries its own copy of the defaults, so on a page with two scenes the second
  // copy comes after the first scene's rules. Anything the defaults tie with, they beat.
  const rules = [...DEFAULT_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector!, body: body! }))

  it('weighs nothing, so any rule of a scene beats it whatever the order', () => {
    expect(rules.length).toBeGreaterThan(0)
    for (const { selector } of rules) expect(selector).toMatch(/^:where\([^()]*\)$/)
  })

  it('declares none of the variables a scene sets', () => {
    const declared = (css: string): Set<string> => new Set([...css.matchAll(/(--ds-[a-z-]+)\s*:/g)].map((m) => m[1]!))
    const scene = compile(defineScene('ground', { parts: [{ figure: bar }], background: '#fbfaf7', css: '.ds-line{stroke:red}' }))
    const setByScene = declared(scene.css.replace(DEFAULT_CSS, ''))
    expect(setByScene.size).toBeGreaterThan(0)
    for (const name of declared(DEFAULT_CSS)) expect(setByScene.has(name)).toBe(false)
  })
})
