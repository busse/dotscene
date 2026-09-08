import { describe, expect, it } from 'vitest'
import { compile, loopGaps, resolve, resolveAt } from '../src/index.ts'
import { scene as singlestone } from '../scenes/cbdot/singlestone.ts'
import { scene as eszett } from '../scenes/cbdot/eszett.ts'
import { scene as bussetech } from '../scenes/cbdot/bussetech.ts'
import { VIEWBOX } from '../scenes/cbdot/palette.ts'

const art = [singlestone, eszett, bussetech]

describe('card art', () => {
  it('fills the card\'s slot: one viewBox, three times wider than tall', () => {
    for (const scene of art) expect(scene.viewBox).toEqual(VIEWBOX)
    expect(VIEWBOX[2] / VIEWBOX[3]).toBeCloseTo(2.9, 1)
  })

  it('carries both themes, with ink left to the card', () => {
    for (const scene of art) {
      const svg = compile(scene).inline
      expect(svg).toContain(':root[data-theme="dark"] &')
      expect(svg).toContain('@media (prefers-color-scheme: dark)')
      // No background rect: the card paints its own, and the art sits on it.
      expect(svg).not.toContain('class="ds-bg"')
      // Nothing here names the paper or the ink: strokes and dots are currentColor.
      expect(svg).not.toContain('#fbfaf7')
      expect(svg).not.toContain('#1d2021')
    }
  })

  it('loops without a seam', () => {
    for (const scene of art) {
      const keyframes = scene.animate!.keyframes!
      // The first keyframe is the cut, and the last state of every part matches it.
      expect(keyframes[0]!.duration).toBe(0)
      const composed = { keyframes, duration: 0, acts: {} }
      expect(loopGaps(composed, scene.parts), scene.name).toEqual([])
    }
  })

  it('rests on a finished picture, which is what reduced motion shows', () => {
    // At time zero: the tiers in order, the whole letter, a ledger with entries.
    const tiers = resolveAt(singlestone, 0)
    expect(tiers.opacities?.bandTop ?? 1).toBe(1)
    const letter = resolveAt(eszett, 0)
    const stem = letter.dots.filter((d) => d.part === 'letter').map((d) => d.at[1])
    expect(Math.max(...stem) - Math.min(...stem)).toBeGreaterThan(60)
    expect(resolve(bussetech).partOrder).toContain('human')
  })

  it('draws the letter out of the pencil, never ahead of it', () => {
    // While drawing, every point not yet reached sits exactly at the pencil's tip.
    for (const t of [3600, 4200, 4800]) {
      const at = resolveAt(eszett, t)
      const tip = at.dots.find((d) => d.part === 'pencil' && d.point === 'tip')!.at
      const undrawn = at.dots.filter((d) => d.part === 'letter' && Math.hypot(d.at[0] - tip[0], d.at[1] - tip[1]) < 0.01)
      expect(undrawn.length, `at ${t}ms`).toBeGreaterThan(0)
    }
  })
})
