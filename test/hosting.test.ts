import { describe, expect, it } from 'vitest'
import { compile } from '../src/index.ts'
import { scene as singlestone } from '../scenes/site/singlestone.ts'
import { scene as island } from '../scenes/island/hero.ts'

describe('a block as a host page sees it', () => {
  it('keeps the timeline out of the block when asked, and names where it lives', () => {
    const external = compile(singlestone, { poses: 'external' })
    expect(external.html).toContain(`data-dotscene-src="./${singlestone.name}.poses.json"`)
    expect(external.html).not.toContain('data-dotscene-poses=')
    expect(external.html).toContain('dotscene.min.js')
    expect(external.poses).toBeDefined()
    expect(JSON.parse(external.poses!)).toHaveProperty('frames')
    const custom = compile(singlestone, { poses: 'external', posesSrc: '/assets/art/singlestone.poses.json' })
    expect(custom.html).toContain('data-dotscene-src="/assets/art/singlestone.poses.json"')
  })

  it('puts the timeline inline by default', () => {
    const inline = compile(singlestone)
    expect(inline.html).toContain(`data-dotscene-poses="${singlestone.name}"`)
    expect(inline.html).not.toContain('data-dotscene-src')
  })

  it('hands the stylesheet over on its own, so a block can be emitted without one', () => {
    const bare = compile(singlestone, { styles: false })
    expect(bare.inline).not.toContain('<style>')
    expect(bare.css).toContain(':where(.dotscene)')
    expect(bare.css).toContain(`:where(svg[data-dotscene="${singlestone.name}"])`)
  })

  it('weighs no more than one class per rule, so a host wins with two', () => {
    const { css } = compile(island)
    // Nothing in the defaults or the scope escapes :where().
    expect(css).not.toMatch(/(^|})\.dotscene[ {]/)
    expect(css).not.toMatch(/(^|})svg\[data-dotscene/)
  })

  it('hides a decorative scene from assistive technology, title and all', () => {
    const decorative = compile({ ...island, decorative: true })
    expect(decorative.inline).toContain('aria-hidden="true"')
    expect(decorative.inline).toContain('focusable="false"')
    expect(decorative.inline).not.toContain('role="img"')
    expect(decorative.inline).not.toContain('<title>')
    const named = compile(island)
    expect(named.inline).toContain('role="img"')
    expect(named.inline).toContain('<title>')
  })
})
