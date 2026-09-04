import { describe, expect, it } from 'vitest'
import { defineFigure, definePose, defineScene, mirrorX, withPose } from '../src/index.ts'
import { isIssueError, validateScene } from '../src/validate.ts'

const bare = { points: { a: [0, 0], b: [0, 10] }, edges: [['a', 'b']] } as const

describe('defineFigure', () => {
  it('normalizes terse edge pairs into objects', () => {
    const figure = defineFigure('bar', bare)
    expect(figure.edges).toEqual([{ from: 'a', to: 'b' }])
  })

  it('rejects an edge naming a point that does not exist, and suggests the intended one', () => {
    let caught: unknown
    try {
      defineFigure('person', { points: { handR: [1, 1], neck: [0, 0] }, edges: [['neck', 'hnadR']] })
    } catch (error) {
      caught = error
    }
    expect(isIssueError(caught)).toBe(true)
    const [issue] = (caught as { issues: readonly { code: string; didYouMean?: string }[] }).issues
    expect(issue?.code).toBe('UNKNOWN_POINT')
    expect(issue?.didYouMean).toBe('handR')
  })

  it('rejects a pose that moves an unknown point', () => {
    expect(() =>
      defineFigure('bar', { ...bare, poses: { odd: { c: [1, 1] } } as never }),
    ).toThrow(/pose 'odd' moves unknown point 'c'/)
  })

  it('rejects non-finite coordinates', () => {
    expect(() => defineFigure('bar', { points: { a: [0, NaN] }, edges: [] } as never)).toThrow(/BAD_COORDINATE/)
  })
})

describe('definePose', () => {
  it('validates against the figure it belongs to', () => {
    const figure = defineFigure('bar', bare)
    expect(definePose(figure, 'shift', { b: [2, 10] }).points).toEqual({ b: [2, 10] })
    expect(() => definePose(figure, 'shift', { z: [0, 0] })).toThrow(/unknown point 'z'/)
  })
})

describe('validateScene', () => {
  const figure = defineFigure('bar', { ...bare, poses: { up: { b: [0, -10] }, wave: { b: [4, -6] } } })

  it('offers no suggestion when nothing is close enough to be a typo', () => {
    const scene = defineScene('anim', { parts: [{ figure }], animate: { cycle: ['somersault'] } })
    const issue = validateScene(scene).find((candidate) => candidate.code === 'UNKNOWN_POSE')
    expect(issue?.didYouMean).toBeUndefined()
  })

  it('flags duplicate part ids', () => {
    const scene = defineScene('two', { parts: [{ figure }, { figure }] })
    expect(validateScene(scene).map((issue) => issue.code)).toContain('DUPLICATE_PART_ID')
  })

  it('flags an animate cycle naming a pose the figure lacks', () => {
    const scene = defineScene('anim', { parts: [{ figure }], animate: { cycle: ['up', 'wvae'] } })
    const issue = validateScene(scene).find((candidate) => candidate.code === 'UNKNOWN_POSE')
    expect(issue?.didYouMean).toBe('wave')
  })

  it('requires animate.part when the scene has more than one part', () => {
    const scene = defineScene('anim', {
      parts: [{ figure }, { figure, id: 'other' }],
      animate: { cycle: ['up'] },
    })
    expect(validateScene(scene).map((issue) => issue.code)).toContain('UNKNOWN_PART')
  })

  it('accepts a well-formed scene', () => {
    expect(validateScene(defineScene('ok', { parts: [{ figure }] }))).toEqual([])
  })
})

describe('withPose', () => {
  it('poses the only part without touching the original scene', () => {
    const figure = defineFigure('bar', { ...bare, poses: { up: { b: [0, -10] }, wave: { b: [4, -6] } } })
    const scene = defineScene('s', { parts: [{ figure }] })
    expect(withPose(scene, 'up').parts[0]?.pose).toBe('up')
    expect(scene.parts[0]?.pose).toBeUndefined()
  })
})

describe('mirrorX', () => {
  it('mirrors suffixed points across the vertical axis', () => {
    expect(mirrorX({ handL: [-16, 22], head: [0, 0] })).toEqual({ handR: [16, 22] })
  })

  it('honours a custom axis and suffix pair', () => {
    expect(mirrorX({ aStart: [2, 5] }, { from: 'Start', to: 'End', axis: 10 })).toEqual({ aEnd: [18, 5] })
  })
})
