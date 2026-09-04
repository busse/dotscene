/**
 * ASCII renderer — the authoring feedback loop.
 *
 * Dots and lines survive downsampling to a character grid unusually well, which means an
 * author (very often an agent) can see whether a figure reads correctly without a browser,
 * a screenshot, or a human in the loop. Runs over the same resolved geometry as the SVG
 * renderer, so what you see here is what the SVG will draw.
 */

import type { ResolvedScene } from '../layout.ts'
import type { Vec2 } from '../model.ts'

export interface AsciiOptions {
  /** Grid columns. Default 48. */
  readonly width?: number
  /** Grid rows. Derived from the viewBox aspect ratio when omitted. */
  readonly height?: number
  /** Annotate dots with their point names, where there is blank space to do it. */
  readonly labels?: boolean
  /** Terminal cell height divided by width. Default 2, which is about right for most fonts. */
  readonly charAspect?: number
}

const DOT = '·'
const CROSS = '┼'
const LINE_CHARS = new Set(['─', '│', '╲', '╱', CROSS])

const lineChar = (dc: number, dr: number): string => {
  const adc = Math.abs(dc)
  const adr = Math.abs(dr)
  if (adr < adc * 0.5) return '─'
  if (adc < adr * 0.5) return '│'
  return dc > 0 === dr > 0 ? '╲' : '╱'
}

/** Render a resolved scene as a character grid. */
export const renderAscii = (scene: ResolvedScene, options: AsciiOptions = {}): string => {
  const cols = Math.max(8, options.width ?? 48)
  const [vx, vy, vw, vh] = scene.viewBox
  const charAspect = options.charAspect ?? 2
  const rows = Math.max(4, options.height ?? Math.round((vh / vw) * cols / charAspect))

  const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '))

  const toGrid = ([x, y]: Vec2): readonly [number, number] => [
    ((x - vx) / vw) * (cols - 1),
    ((y - vy) / vh) * (rows - 1),
  ]

  const put = (col: number, row: number, char: string): void => {
    const c = Math.round(col)
    const r = Math.round(row)
    if (r < 0 || r >= rows || c < 0 || c >= cols) return
    const existing = grid[r]![c]!
    if (existing === DOT) return
    // Two strokes crossing the same cell read better as a junction than as either stroke.
    grid[r]![c] = LINE_CHARS.has(existing) && existing !== char ? CROSS : char
  }

  for (const line of scene.lines) {
    const [c0, r0] = toGrid(line.a)
    const [c1, r1] = toGrid(line.b)
    const dc = c1 - c0
    const dr = r1 - r0
    const char = lineChar(dc, dr)
    // One step per cell of the dominant axis: dense enough to leave no gaps, sparse
    // enough not to double up glyphs on a diagonal.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dc), Math.abs(dr))))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      put(c0 + dc * t, r0 + dr * t, char)
    }
  }

  for (const dot of scene.dots) {
    const [col, row] = toGrid(dot.at)
    const c = Math.round(col)
    const r = Math.round(row)
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue
    grid[r]![c] = DOT
  }

  if (options.labels === true) {
    for (const dot of scene.dots) {
      const [col, row] = toGrid(dot.at)
      writeLabel(grid, Math.round(col), Math.round(row), dot.point, cols, rows)
    }
  }

  return grid.map((row) => row.join('').replace(/\s+$/, '')).join('\n')
}

/** Write a point name beside its dot, but only into blank cells — never over the drawing. */
const writeLabel = (
  grid: string[][],
  col: number,
  row: number,
  label: string,
  cols: number,
  rows: number,
): void => {
  if (row < 0 || row >= rows) return
  const candidates = [col + 2, col - label.length - 2]
  for (const start of candidates) {
    if (start < 0 || start + label.length > cols) continue
    const line = grid[row]!
    let free = true
    for (let i = -1; i <= label.length; i++) {
      const cell = line[start + i]
      if (cell !== undefined && cell !== ' ') {
        free = false
        break
      }
    }
    if (!free) continue
    for (let i = 0; i < label.length; i++) line[start + i] = label[i]!
    return
  }
}
