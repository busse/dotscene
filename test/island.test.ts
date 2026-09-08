import { describe, expect, it } from 'vitest'
import { animationPayload, compile, resolve, resolveAt } from '../src/index.ts'
import { acts, composed, heroNight, players, scene, seam } from '../scenes/island/hero.ts'
import { scene as art } from '../scenes/cbdot/island.ts'
import { WIDE } from '../scenes/island/world.ts'
import { LOOP, START, FIXED, NIGHT } from '../scenes/island/timing.ts'
import { cameraScript } from '../scenes/island/acts/camera.ts'

/** A part's declared fields as of time `t`, the last keyframe at or before it having the say. */
const stateAt = (id: string, t: number) => {
  let clock = 0
  let state: Record<string, unknown> = { ...(players.find((p) => p.id === id) ?? {}) }
  for (const keyframe of composed.keyframes) {
    clock += keyframe.duration ?? 0
    if (clock > t) break
    const step = keyframe.parts?.[id]
    if (step) state = { ...state, ...step }
    clock += keyframe.hold ?? 0
  }
  return state as { at?: [number, number]; pose?: string; opacity?: number }
}

describe('the island of misfit applications', () => {
  it('is a minute long and composes without two acts moving one part at once', () => {
    expect(composed.duration).toBe(LOOP)
    expect(acts.length).toBeGreaterThanOrEqual(10)
  })

  it('loops without a seam', () => {
    expect(seam).toEqual([])
  })

  it('names every part once', () => {
    const ids = players.map((p) => p.id).filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('tells the day in order: each misfit is put right after the keeper reaches it', () => {
    const order = ['mainframe', 'spreadsheet', 'fax', 'cron', 'chatbot'] as const
    for (let i = 0; i < order.length; i++) {
      const step = order[i]!
      expect(FIXED[step]).toBeGreaterThan(START[step])
      if (i > 0) expect(START[step]).toBeGreaterThan(FIXED[order[i - 1]!])
    }
    expect(NIGHT.deep).toBeGreaterThan(START.dusk)
    expect(START.reset).toBeGreaterThan(NIGHT.deep)
    expect(NIGHT.lift).toBeGreaterThan(START.reset)
  })

  it('keeps the camera on the right half of the frame, where the island is', () => {
    const leftEdge = WIDE.at[0] - WIDE.width / 2
    const middle = WIDE.at[0]
    for (const beat of cameraScript.beats) {
      const cam = beat.camera!
      expect(cam.at![0]).toBeGreaterThanOrEqual(middle - 40)
      expect(cam.at![0]).toBeGreaterThan(leftEdge)
    }
  })

  it('never lets the camera rest: every shot moves', () => {
    const shots = cameraScript.beats
    for (let i = 1; i < shots.length; i++) {
      const a = shots[i - 1]!.camera!
      const b = shots[i]!.camera!
      const moved = a.at![0] !== b.at![0] || a.at![1] !== b.at![1] || a.width !== b.width
      expect(moved, `shot ${i} at ${shots[i]!.at}`).toBe(true)
    }
  })

  it('puts the misfits right and leaves them so until the night resets them', () => {
    const wheels = (t: number) => stateAt('mainframe', t).at![0]
    expect(wheels(START.mainframe + 200)).not.toBe(wheels(START.night))
    expect(wheels(START.night)).toBe(wheels(START.reset - 10))
    expect(stateAt('spreadsheet', START.mainframe).pose).not.toBe('straight')
    expect(stateAt('spreadsheet', START.night).pose).toBe('straight')
    expect(stateAt('spreadsheet', START.reset - 10).pose).toBe('straight')
    expect(stateAt('spreadsheet', LOOP).pose).toBe('rest')
  })

  it('holds every put-right thing still until the reset, rather than sliding it back', () => {
    const centre = (t: number, id: string): [number, number] => {
      const dots = resolveAt(scene, t).dots.filter((d) => d.part === id)
      const n = dots.length || 1
      return [dots.reduce((s, d) => s + d.at[0], 0) / n, dots.reduce((s, d) => s + d.at[1], 0) / n]
    }
    const settledAt: Record<string, number> = { boat: START.boat + 7600 }
    for (const id of ['mainframe', 'spreadsheet', 'drum', 'cron', 'cronFlag', 'faxWire', 'botWire', 'plane', 'boat']) {
      const settled = centre(settledAt[id] ?? START.landing + 5400, id)
      const before = centre(START.reset - 100, id)
      expect(before[0], id).toBeCloseTo(settled[0], 0)
      expect(before[1], id).toBeCloseTo(settled[1], 0)
    }
  })

  it('resets under the dark: the night is at its deepest when the misfits jump back', () => {
    for (const t of [START.reset - 10, START.reset, START.reset + 100]) {
      expect(stateAt('nightfall', t).opacity ?? 1).toBeGreaterThanOrEqual(NIGHT.opacity - 0.01)
    }
  })

  it('carries both themes in one block, and a fixed dark twin', () => {
    const light = compile(scene).inline
    expect(light).toContain(':root[data-theme="dark"] &')
    expect(compile(heroNight).inline).not.toContain('prefers-color-scheme')
  })

  it('costs less than the page it sits on', () => {
    const kb = (animationPayload(resolve(scene)) ?? "").length / 1024
    expect(kb).toBeLessThan(700)
  })

  it('is the same animation for the site, told to cover its box', () => {
    expect(art.fit).toBe('slice')
    expect(art.animate!.keyframes).toBe(scene.animate!.keyframes)
  })
})
