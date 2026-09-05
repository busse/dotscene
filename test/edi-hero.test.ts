import { describe, expect, it } from 'vitest'
import { animationPayload, resolve } from '../src/index.ts'
import { composed, placements, scene, heroNight, seam } from '../scenes/edi/hero.ts'
import { acts } from '../scenes/edi/acts/index.ts'

describe('the hero', () => {
  it('cuts back to the start invisibly', () => {
    expect(seam).toEqual([])
  })

  it('plays every act', () => {
    const played = new Set(Object.values(composed.acts).flat())
    for (const act of acts) expect(played.has(act.id)).toBe(true)
  })

  it('overlaps acts rather than queueing them — which is the whole point of composing', () => {
    const together = Object.values(composed.acts).filter((a) => a.filter((n) => n !== 'settle').length > 1)
    expect(together.length).toBeGreaterThan(10)
  })

  it('runs the rig continuously, with no stretch where it is simply missing', () => {
    const frames = composed.keyframes
    const first = frames.findIndex((k) => k.parts?.rig !== undefined)
    const last = frames.length - 1 - [...frames].reverse().findIndex((k) => k.parts?.rig !== undefined)
    // Once it starts it is in every keyframe until it finishes: a keyframe that omits it
    // would freeze it there while everything else carried on.
    for (let i = first; i <= last; i++) expect(frames[i]?.parts?.rig).toBeDefined()
  })

  it('stays inside the payload budget', () => {
    const payload = animationPayload(resolve(scene))!
    // 200 kB is the gate the plan set. Blowing it means revisiting how a part that only
    // translates is sent — one transform rather than every point.
    expect(payload.length).toBeLessThan(200 * 1024)
  })

  it('sends each part\'s depth once, not at every step', () => {
    const animation = resolve(scene).animation!
    const perFrame = Object.values(animation.depths!.byFrame)
    const parts = Object.keys(animation.depths!.base).length
    expect(parts).toBeGreaterThan(30)
    // Only the rig changes depth, so no step should be restating the rest of the stack.
    expect(Math.max(...perFrame.map((d) => Object.keys(d).length))).toBeLessThan(3)
  })

  it('is the same animation in both palettes', () => {
    const light = resolve(scene)
    const dark = resolve(heroNight)
    expect(dark.animation?.cycle).toEqual(light.animation?.cycle)
    expect(dark.partOrder).toEqual(light.partOrder)
  })

  it('places every act exactly once', () => {
    const names = placements.map((p) => p.act.name)
    expect(names).toEqual([...new Set(names)])
    expect(names).toHaveLength(acts.length + 1) // + the settle beat that holds the tail
  })
})
