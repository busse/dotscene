---
name: dotscene-authoring
description: Draw or edit a dotscene scene — figures made of named points and edges, with poses. Use when adding a scene to scenes/, changing a figure's points or edges, adding or tuning a pose, composing figures into a scene, or when a rendered scene looks wrong and needs correcting.
---

# Authoring dotscene scenes

Scenes are named points and the edges between them. You cannot get coordinates right by reasoning alone — draw, look, correct.

## Loop

```sh
node bin/dotscene.js preview <scene> --width 44
```

Read the ASCII output as the drawing. It runs over the same resolved geometry as the SVG, so what reads correctly there renders correctly in a browser. Adjust coordinates, preview again. Add `--labels` when you need to know which dot is which, `--pose <name>` for one pose, `--poses` to step the whole cycle.

Then `node bin/dotscene.js check` — issues come back structured, with `didYouMean` on likely typos.

## Shape of a figure

```ts
import { defineFigure, defineScene, mirrorX, ring } from 'dotscene'

const left = { shoulderL: [-7, 15], elbowL: [-13, 24], handL: [-16, 33] } as const

export const thing = defineFigure('thing', {
  title: 'What this is',
  points: { head: [0, 3], neck: [0, 13], ...left, ...mirrorX(left) },
  edges: [['head', 'neck'], ['neck', 'shoulderL'], ['neck', 'shoulderR']],
  poses: {
    idle: {},
    wave: { handR: [18, 5] },   // partial — unlisted points hold their rest position
  },
})

export const scene = defineScene('thing', {
  title: 'What this shows',
  parts: [{ figure: thing }],
  animate: { cycle: ['idle', 'wave'], duration: 700, hold: 900, mode: 'loop' },
})
```

## Staging several parts at once

`animate.cycle` moves one part. When two figures and the things they carry all move, use `keyframes` — each step says where every moving part is and what pose it holds:

```ts
animate: {
  mode: 'loop',
  keyframes: [
    { name: 'empty', duration: 0, hold: 400,
      parts: { walker: { at: [-150, 0], pose: 'walkCarryA' }, bag: { at: [-138, 35] } } },
    { name: 'meet', duration: 700, hold: 500,
      parts: { walker: { at: [-30, 0], pose: 'holdR' }, bag: { at: [-18, 35] } } },
  ],
}
```

- Omitted fields fall back to the part's declaration; a part no keyframe names never moves.
- `duration` is the time to move *into* that step — `0` makes it a hard cut.
- Preview one step with `preview <scene> --pose <keyframe>`, or step them all with `--poses`.
- A prop that rides in a hand is its own part: give it the hand's position at every keyframe. Compute those from a named constant rather than retyping coordinates.

## Rules that matter

- **y grows downward.** A point with a smaller y is higher on screen.
- **Keep point names stable across poses.** Poses interpolate by name; a renamed point breaks the tween.
- **Stay on the module.** A person is ~64 units tall with feet at y ≈ 64; a car is ~170 long. Draw new figures against that so they compose without rescaling.
- **Mirror, don't retype.** `mirrorX(points)` turns every `…L` into a `…R` at the negated x.
- **`ring(prefix, center, radius, count)`** for wheels, hubs, anything round — returns points *and* the closing edges.
- **Reuse figures by importing them.** Compose in a scene with `{ figure, at, scale, rotate, flipX, pose }`; do not redraw a person to put one in a car.
- **Order of work:** points, then edges, then poses. Preview between each.

## When something looks wrong

| Symptom | Cause |
|---|---|
| A limb reads as a blob | The part is scaled far down inside a large scene. Fix the authoring scale, not `dotRadius`. |
| A pose clips at the edge | It will not — the viewBox spans every pose in the cycle. Look for a wrong coordinate instead. |
| A limb shortens mid-tween | Expected. Poses lerp positions, not joint angles. |
| A figure meant to be off-stage is visible | The scene needs an explicit `viewBox`; a fitted one grows to include it. |
| Everything slides backwards when the loop wraps | Give the first keyframe `duration: 0` so the reset cuts. |
| An extended arm looks stretched | The hand is further from the shoulder than the arm is long — about 20 units on the person module. |
| Diagonals look wrong in preview | Terminal cells are 2× taller than wide; the renderer already corrects for this. Trust the SVG. |

## Before finishing

```sh
npm test && npm run typecheck && node bin/dotscene.js check
```
