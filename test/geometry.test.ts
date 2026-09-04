import { describe, expect, it } from 'vitest'
import { applyTransform, bounds, lerpVec, mirrorX, rotateVec, round, roundVec } from '../src/geometry.ts'

describe('rotateVec', () => {
  it('rotates clockwise on screen, where y grows downward', () => {
    expect(roundVec(rotateVec([10, 0], 90))).toEqual([0, 10])
  })

  it('is identity at zero', () => {
    expect(rotateVec([3, 4], 0)).toEqual([3, 4])
  })
})

describe('applyTransform', () => {
  it('scales, then flips, then rotates, then translates', () => {
    expect(roundVec(applyTransform([2, 0], { scale: 2, flipX: true, at: [5, 5] }))).toEqual([1, 5])
  })

  it('accepts a non-uniform scale', () => {
    expect(applyTransform([2, 3], { scale: [3, 1] })).toEqual([6, 3])
  })

  it('leaves a point alone under an empty transform', () => {
    expect(applyTransform([7, 9], {})).toEqual([7, 9])
  })
})

describe('bounds', () => {
  it('spans every point given', () => {
    expect(bounds([[0, 0], [-4, 10], [6, 2]])).toEqual({ minX: -4, minY: 0, maxX: 6, maxY: 10 })
  })

  it('collapses to the origin when empty, rather than returning infinities', () => {
    expect(bounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 })
  })
})

describe('round', () => {
  it('keeps two decimals by default', () => {
    expect(round(1.23456)).toBe(1.23)
  })

  it('normalizes negative zero so rebuilds stay byte-stable', () => {
    expect(Object.is(round(-0.001), 0)).toBe(true)
  })
})

describe('lerpVec', () => {
  it('returns the midpoint at t=0.5', () => {
    expect(lerpVec([0, 0], [10, 20], 0.5)).toEqual([5, 10])
  })
})

describe('mirrorX', () => {
  it('ignores points without the source suffix', () => {
    expect(mirrorX({ hip: [0, 30] })).toEqual({})
  })
})
