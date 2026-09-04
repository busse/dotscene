/**
 * Structured validation.
 *
 * Errors are data, not prose: every issue carries a machine-readable `code`, the exact
 * names involved, and — where a typo is likely — the nearest valid name. That turns a
 * two-turn correction loop into one, which matters when the author is an agent.
 */

import type { EdgeSpec, Figure, FigureSpec, PointId, PoseOverride, Scene, Vec2 } from './model.ts'
import { partId } from './model.ts'

export type IssueCode =
  | 'UNKNOWN_POINT'
  | 'EMPTY_FIGURE'
  | 'BAD_COORDINATE'
  | 'SELF_EDGE'
  | 'DUPLICATE_PART_ID'
  | 'UNKNOWN_POSE'
  | 'UNKNOWN_PART'
  | 'EMPTY_SCENE'
  | 'EMPTY_CYCLE'

export interface Issue {
  readonly code: IssueCode
  readonly message: string
  /** Where the problem is: figure name, scene name, pose name, part id — whichever apply. */
  readonly figure?: string
  readonly scene?: string
  readonly pose?: string
  readonly part?: string
  readonly point?: PointId
  readonly edge?: readonly [PointId, PointId]
  /** Nearest valid name, when the issue looks like a typo. */
  readonly didYouMean?: string
}

export type IssueError = Error & { readonly issues: readonly Issue[] }

/** An Error carrying structured issues, so callers can render them as JSON or as text. */
export const issueError = (issues: readonly Issue[]): IssueError => {
  const summary = issues.map((i) => `  ${i.code}: ${i.message}`).join('\n')
  const error = new Error(`dotscene: ${issues.length} issue(s)\n${summary}`) as Error & { issues: readonly Issue[] }
  error.name = 'DotsceneError'
  error.issues = issues
  return error
}

export const isIssueError = (value: unknown): value is IssueError =>
  value instanceof Error && Array.isArray((value as { issues?: unknown }).issues)

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min((row[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
    }
    prev = row
  }
  return prev[b.length] ?? 0
}

/** The closest candidate to `name`, if one is close enough to be a plausible typo. */
export const nearestName = (name: string, candidates: readonly string[]): string | undefined => {
  const threshold = Math.max(2, Math.floor(name.length / 3))
  let best: string | undefined
  let bestDistance = Infinity
  for (const candidate of candidates) {
    const distance = levenshtein(name.toLowerCase(), candidate.toLowerCase())
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best !== undefined && bestDistance <= threshold ? best : undefined
}

const suggest = (name: string, candidates: readonly string[]): { didYouMean?: string } => {
  const guess = nearestName(name, candidates)
  return guess === undefined ? {} : { didYouMean: guess }
}

const isVec2 = (value: unknown): value is Vec2 =>
  Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === 'number' && Number.isFinite(n))

const edgeEnds = (edge: EdgeSpec): readonly [PointId, PointId] =>
  'from' in edge ? [edge.from, edge.to] : [edge[0], edge[1]]

export const validateFigureSpec = (name: string, spec: FigureSpec): readonly Issue[] => {
  const issues: Issue[] = []
  const names = Object.keys(spec.points)

  if (names.length === 0) {
    issues.push({ code: 'EMPTY_FIGURE', figure: name, message: `figure '${name}' declares no points` })
  }

  for (const [point, at] of Object.entries(spec.points)) {
    if (!isVec2(at)) {
      issues.push({
        code: 'BAD_COORDINATE',
        figure: name,
        point,
        message: `point '${point}' must be [x, y] with two finite numbers, got ${JSON.stringify(at)}`,
      })
    }
  }

  for (const edge of spec.edges) {
    const [from, to] = edgeEnds(edge)
    if (from === to) {
      issues.push({ code: 'SELF_EDGE', figure: name, edge: [from, to], message: `edge connects '${from}' to itself` })
      continue
    }
    for (const end of [from, to] as const) {
      if (!(end in spec.points)) {
        issues.push({
          code: 'UNKNOWN_POINT',
          figure: name,
          edge: [from, to],
          point: end,
          message: `edge [${from}, ${to}] references unknown point '${end}'`,
          ...suggest(end, names),
        })
      }
    }
  }

  for (const [poseName, override] of Object.entries(spec.poses ?? {})) {
    issues.push(...validateOverrideAgainst(name, names, poseName, override))
  }

  return issues
}

const validateOverrideAgainst = (
  figureName: string,
  names: readonly string[],
  poseName: string,
  override: PoseOverride,
): readonly Issue[] => {
  const issues: Issue[] = []
  for (const [point, at] of Object.entries(override)) {
    if (!names.includes(point)) {
      issues.push({
        code: 'UNKNOWN_POINT',
        figure: figureName,
        pose: poseName,
        point,
        message: `pose '${poseName}' moves unknown point '${point}'`,
        ...suggest(point, names),
      })
    } else if (!isVec2(at)) {
      issues.push({
        code: 'BAD_COORDINATE',
        figure: figureName,
        pose: poseName,
        point,
        message: `pose '${poseName}' sets '${point}' to ${JSON.stringify(at)}, expected [x, y]`,
      })
    }
  }
  return issues
}

export const validatePoseOverride = (figure: Figure, poseName: string, override: PoseOverride): readonly Issue[] =>
  validateOverrideAgainst(figure.name, Object.keys(figure.points), poseName, override)

/** Cross-part checks that can only run once a scene composes figures together. */
export const validateScene = (scene: Scene): readonly Issue[] => {
  const issues: Issue[] = []

  if (scene.parts.length === 0) {
    issues.push({ code: 'EMPTY_SCENE', scene: scene.name, message: `scene '${scene.name}' has no parts` })
  }

  const seen = new Set<string>()
  for (const part of scene.parts) {
    const id = partId(part)
    if (seen.has(id)) {
      issues.push({
        code: 'DUPLICATE_PART_ID',
        scene: scene.name,
        part: id,
        message: `two parts share the id '${id}' — give one an explicit \`id\``,
      })
    }
    seen.add(id)

    if (typeof part.pose === 'string' && !(part.pose in part.figure.poses)) {
      issues.push({
        code: 'UNKNOWN_POSE',
        scene: scene.name,
        part: id,
        figure: part.figure.name,
        pose: part.pose,
        message: `part '${id}' asks for pose '${part.pose}', which figure '${part.figure.name}' does not define`,
        ...suggest(part.pose, Object.keys(part.figure.poses)),
      })
    }
  }

  const animate = scene.animate
  if (animate !== undefined) {
    const target = animate.part ?? (scene.parts.length === 1 ? partId(scene.parts[0]!) : undefined)
    if (target === undefined) {
      issues.push({
        code: 'UNKNOWN_PART',
        scene: scene.name,
        message: `scene '${scene.name}' has ${scene.parts.length} parts, so \`animate.part\` must name which one cycles`,
      })
    } else {
      const part = scene.parts.find((candidate) => partId(candidate) === target)
      if (part === undefined) {
        issues.push({
          code: 'UNKNOWN_PART',
          scene: scene.name,
          part: target,
          message: `\`animate.part\` names '${target}', which is not a part of this scene`,
          ...suggest(target, scene.parts.map(partId)),
        })
      } else {
        if (animate.cycle.length === 0) {
          issues.push({ code: 'EMPTY_CYCLE', scene: scene.name, part: target, message: `\`animate.cycle\` is empty` })
        }
        for (const poseName of animate.cycle) {
          if (!(poseName in part.figure.poses)) {
            issues.push({
              code: 'UNKNOWN_POSE',
              scene: scene.name,
              part: target,
              figure: part.figure.name,
              pose: poseName,
              message: `\`animate.cycle\` names pose '${poseName}', which figure '${part.figure.name}' does not define`,
              ...suggest(poseName, Object.keys(part.figure.poses)),
            })
          }
        }
      }
    }
  }

  return issues
}
