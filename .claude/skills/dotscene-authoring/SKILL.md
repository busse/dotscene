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

## Making something walk

Four poses, and one number that ties them to the scene.

- `stepA` / `stepB` are the contacts: front foot `+S/2` from the hip, back foot `-S/2`. `passA` / `passB` are the mid-swings: the planted foot at `0`, the other lifted and passing.
- The scene must advance the figure by exactly `S` between one contact and the next. Then the planted foot occupies the same world position in both frames and does not slide — this, not the leg shapes, is what separates walking from skating.
- The body drops ~3 units at contact and rises at passing. That is forced by geometry: a leg reaching forward cannot also be at full length. Bake it into the poses.
- Author the cycle facing `+x` and use `flipX` on the part to walk the other way, rather than writing a mirrored set.
- Give every walk keyframe `easing: 'linear'` and `hold: 0`. Ease only the first and last.

### Two walkers should not look like one mirrored

They share a keyframe grid, so vary them per figure: `scale` (height and stride move together), gait `rate` in half-strides per keyframe (cadence), and the starting phase (which foot is down). For a phase that does not land on the grid, build the pose:

```ts
const pose = definePose(person, label, lerpPoints(posePoints(person, 'stepA'), posePoints(person, 'passA'), t))
```

A keyframe's `pose` takes that object directly. Planting still holds at every fractional phase, because the foot's local x moves linearly while the body advances.

Check it by reading the resolved frames, not by eye: the planted foot's world x should repeat across three consecutive frames.

```sh
node bin/dotscene.js inspect <scene> --json | grep -o '"footL":\[[^]]*\]'
```

## Making two figures touch

Hands meet only if both figures solve back from the same point in scene space — writing a hand position into a shared pose puts it somewhere else once the other figure is scaled.

```ts
const local = [(target[0] - x) / scale, (target[1] - FLOOR * (1 - scale)) / scale]
const elbow = jointBetween(shoulder, local, upperLength, forearmLength, bend)
```

Place the hand on the target and solve the elbow, never the reverse. Check the result: the distance between the two hands should be 0, and shoulder-to-hand should be comfortably inside the arm's length so the elbow bends rather than locking straight.

Before reordering beats, write down which hand holds what at every step. A figure cannot shake with an occupied hand, so the order dictates the hand logistics, and each change of hand costs a beat. Folding one into a movement you already have — swinging a bag across as you come to a stop — is cheaper and reads better than a beat that exists only to move an object.

A gesture is a sequence, not a pose. A handshake is reach, clasp, two or three pumps with the swing damping out, then settle — one held pose reads as a freeze-frame.

## Isometric scenes

Author in grid coordinates, project once:

```ts
const grid = isometric({ tile: 8, squash: 0.5, rise: 5 })   // +x down-right, +y down-left, +z up
const points = { towerNear: grid([3, 3, 0]), towerTop: grid([3, 3, 6]) }
```

- Build local `box` / `line` helpers over grid space rather than writing projected numbers.
- For a solid-looking box, drop the far corner — always the smallest x + y — and its three edges. Seven points, nine edges, three visible faces.
- A full ground grid is cheap: only line endpoints become dots, so twelve lines cost twenty-four dots around the rim, not a hundred in the middle.
- Nothing can hide behind anything, so depth comes from weight. Give edges a `kind` and set it in the scene's `css`; reach their dots with `circle[data-p^="prefix"]`.
- Set `dotRadius` explicitly when the scene mixes scales — small trees beside large buildings — since the median-edge default will size for one and swallow the other.

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
| A walk looks jerky | Every keyframe is easing. Use `linear` for the run of steps. |
| Feet skate along the ground | The distance travelled per keyframe does not match the stride baked into the contact poses. |
| An item is in the hand a figure needs for a gesture | The beat order forces it. Add a beat that moves it, or fold the move into the transition before. |
| Two hands that should touch do not | Each was posed in its own local frame. Solve both from one scene point. |
| A reaching arm is locked straight | The target is at or past full reach. Move the figures closer, or lower the target. |
| Two walkers look like one figure mirrored | Same scale, cadence and phase. Vary all three. |
| An isometric scene is a flat tangle of equal lines | Nothing occludes anything. Separate ground, roads and structure by `kind` and weight them in the scene's `css`. |
| A profile figure's torso is a blob | Points within ~3 units pile up at this dot size. Spread the shoulders and hips a little; it still reads as profile. |
| Diagonals look wrong in preview | Terminal cells are 2× taller than wide; the renderer already corrects for this. Trust the SVG. |

## Before finishing

```sh
npm test && npm run typecheck && node bin/dotscene.js check
```
