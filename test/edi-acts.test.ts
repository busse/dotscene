import { describe, expect, it } from 'vitest'
import { acts } from '../scenes/edi/acts/index.ts'
import { compose, resolve } from '../src/index.ts'

describe('the acts', () => {
  it('covers the lifecycle end to end', () => {
    expect(acts).toHaveLength(12)
    expect(acts.map((a) => a.id)).toEqual([...new Set(acts.map((a) => a.id))])
  })

  it('gives every act beats that start at its own zero', () => {
    for (const act of acts) {
      const times = act.act.beats.map((b) => b.at)
      expect(Math.min(...times)).toBe(0)
      expect(Math.max(...times)).toBeLessThanOrEqual(act.duration + 2)
    }
  })

  it('never lets two acts own the same token', () => {
    const ids = acts.flatMap((a) => a.parts.map((p) => p.id))
    expect(ids).toEqual([...new Set(ids)])
  })

  it('hands the rig on where the last act left it', () => {
    const driving = acts.filter((a) => a.drive !== undefined)
    expect(driving.length).toBeGreaterThan(3)
    driving.slice(1).forEach((act, i) => {
      // An act's establishing position must match the previous one's end, or the rig slides.
      expect(act.drive!.from).toBeCloseTo(driving[i]!.drive!.to, 6)
    })
    expect(driving[0]!.drive!.from).toBe(0)
    expect(driving.at(-1)!.drive!.to).toBe(1)
  })

  it('brings the rig home at the end, so the loop can cut without it jumping', () => {
    expect(acts.at(-3)!.drive?.parkAfter ?? acts.find((a) => a.drive?.parkAfter)?.drive?.parkAfter).toBe(true)
  })

  it('composes end to end without two acts fighting over a part', () => {
    let at = 0
    const placed = acts.map((act) => {
      const placement = { act: act.act, at }
      at += act.duration + 400
      return placement
    })
    expect(() => compose(placed)).not.toThrow()
  })

  it('flies every message from one node to another, arcing on the way', () => {
    for (const act of acts) {
      for (const part of act.parts) {
        const moves = act.act.beats
          .filter((b) => b.parts[part.id!] !== undefined)
          .map((b) => b.parts[part.id!]!.at!)
        expect(moves.length).toBeGreaterThanOrEqual(5)
        // The last hop parks it off-frame; before that it should have risen off the straight
        // line between its ends, which is what makes it an arc rather than a slide.
        const flight = moves.slice(0, -1)
        const midY = flight[Math.floor(flight.length / 2)]![1]
        const straight = (flight[0]![1] + flight.at(-1)![1]) / 2
        expect(midY).toBeLessThan(straight)
      }
    }
  })

  it('resolves each act on its own, so a step can be previewed without the rest', () => {
    for (const act of acts) {
      const resolved = resolve(act.scene)
      expect(resolved.animation?.cycle.length).toBeGreaterThan(3)
      expect(resolved.partOrder).toContain('rig')
    }
  })
})
