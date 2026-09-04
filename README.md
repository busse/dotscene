# dotscene

Illustrations made of dots and lines — the look of a graph view, but drawn on purpose. A person, a car, a person *driving* a car, all built the way you'd draw a constellation.

```
person · wave

                 ·
                │            ·
                │           │
                │          │
           ·────·────·─    │
          ╱     │     ────·
        ╱╱      │
       ╱        ·
      ·         │
     │          │
     │          │
    ·          ─·─
            ·──   ─·
            │       │
           │        │
           ·         ·
           │         │
          │          │
          ·           ·
```

Scenes compile to a self-contained block you paste onto a page. Static scenes are plain SVG with **zero JavaScript**. Animated ones add a 1.3 kB runtime that tweens between poses.

## The idea

A **figure** is named points and the edges between them. A **pose** is a partial override of those same names:

```ts
import { defineFigure, defineScene } from 'dotscene'

export const person = defineFigure('person', {
  points: { head: [0, 3], neck: [0, 13], handR: [16, 33] /* … */ },
  edges: [['head', 'neck'], ['neck', 'handR'] /* … */],
  poses: {
    wave: { handR: [18, 5] },
  },
})

export const scene = defineScene('header', {
  parts: [{ figure: person }],
  animate: { cycle: ['idle', 'wave', 'lean'], duration: 700, hold: 900 },
})
```

Because `handR` means the same thing in every pose, tweening between two poses is a per-point interpolation — no morphing, no correspondence problem. That one property is what the rest of the library is built on.

## Authoring loop

The whole point is that you can see what you drew without opening a browser:

```
$ dotscene preview person --pose wave --labels
$ dotscene inspect person --json
$ dotscene check
```

`check` exits non-zero and reports issues as data, with a suggestion when something looks like a typo:

```json
{ "code": "UNKNOWN_POINT", "figure": "person", "edge": ["neck", "hnadR"],
  "message": "edge references unknown point 'hnadR'", "didYouMean": "handR" }
```

## Commands

| | |
|---|---|
| `dotscene list` | every scene, with its poses |
| `dotscene inspect <scene>` | points, edges, poses, viewBox |
| `dotscene preview <scene>` | render to the terminal as text |
| `dotscene check` | validate everything, exit 1 on issues |
| `dotscene new <name>` | scaffold a scene file |
| `dotscene build` | emit SVG, pasteable HTML, gallery, runtime |

Useful flags: `--pose <name>`, `--poses`, `--width <n>`, `--labels`, `--json`, `--dir <path>`, `--out <path>`.

## Output

`dotscene build` writes to `docs/`: one `.svg` and one `.html` per scene, a `dotscene.css`, the gallery at `index.html`, and `dotscene.min.js` when any scene animates. That path is committed rather than ignored, because GitHub Pages serves the gallery straight from it — point Pages at the `main` branch, `/docs` folder. Use `--out` for somewhere else.

The emitted block carries its own point labels, which is how the runtime moves things without rebuilding a scene graph:

```html
<svg class="dotscene" data-dotscene="header" viewBox="-24 -3 48 73" role="img">
  <title>A person cycling through poses</title>
  <style>/* defaults, overridable */</style>
  <line class="ds-line" data-a="neck" data-b="hip" x1="0" y1="13" x2="0" y2="34"/>
  <circle class="ds-dot" data-p="head" cx="0" cy="3" r="1.6"/>
</svg>
<script type="application/json" data-dotscene-poses="header">{"cycle":["idle","wave"],…}</script>
<script src="./dotscene.min.js" defer></script>
```

Dots and lines default to `currentColor`, so a scene inherits the surrounding text colour in light and dark alike.

### Styling

Per-scene defaults ship inside the block. Override them from a page with a more specific selector:

```css
svg.dotscene .ds-dot  { r: 2; fill: #6f9; }
svg.dotscene .ds-line { stroke-width: 0.4; }
```

Give an edge a `kind`, or a point a role in `pointKinds`, and it gains a modifier class — `ds-line--soft`, `ds-dot--soft` — to target. A scene's own `css` is the place to write those rules, and it travels inside the emitted block:

```ts
defineScene('city', {
  parts: [...],
  css: '.ds-line--road{stroke-width:1.15}.ds-line--lot{stroke-opacity:.28}',
})
```

Selectors are bare and get scoped to the scene, so two scenes on one page cannot style each other.

### Matching a site's palette

Set `background` and write literal hex in `css` rather than leaning on `currentColor`: a standalone `.svg`, an `<img src>`, or a rasterised PNG inherits nothing from the page it lands on. Where a palette's roles invert between light and dark, emit two scenes over one figure rather than hoping a single file covers both — see `city` and `cityNight` in `scenes/city.ts`, which share every point and differ only in `background` and `css`.

### Animation

Two forms. `cycle` is the shorthand for one part running through its own poses:

```ts
animate: { cycle: ['idle', 'wave', 'lean'], duration: 700, hold: 900 }
```

`keyframes` stages the whole scene — every moving part's pose *and* position at each step, with per-step pacing:

```ts
animate: {
  keyframes: [
    { name: 'empty',  duration: 0, hold: 400,
      parts: { walker: { at: [-150, 0], pose: 'walkCarryA' }, bag: { at: [-138, 35] } } },
    { name: 'meet',   duration: 700, hold: 500,
      parts: { walker: { at: [-30, 0], pose: 'holdR' },       bag: { at: [-18, 35] } } },
  ],
}
```

Fields a keyframe leaves out fall back to the part's own declaration, and a part no keyframe mentions never moves. `duration` is the time to transition *into* a step, so setting it to `0` makes that step a hard cut — which is how a loop wraps without sliding everything backwards across the stage.

A keyframe's `pose` can be a computed `Pose` rather than a name, which frees a figure from the keyframe grid — build one with `lerpPoints` to catch it at any point between two poses. That is how two figures on one shared timeline can walk at different cadences instead of marching in lockstep.

Each keyframe can set its own `easing`. Continuous travel wants `linear` on every step, easing only where the motion genuinely starts and stops: an ease brings velocity to zero at *every* keyframe it passes through, which is what makes a run of steps pulse instead of flow.

To have figures walk on and off, give the scene an explicit `viewBox` and park them outside it; content is clipped to the viewBox, so off-stage is genuinely invisible.

`animate.mode` is `loop`, `pingpong`, `hover`, or `click`. One `requestAnimationFrame` loop drives every scene on the page, scenes pause while scrolled out of view, and `prefers-reduced-motion: reduce` holds the first pose without ever starting. The runtime is exposed as `window.dotscene` for manual control:

```js
const handle = dotscene.mount(svg, config)
handle.goTo('wave')
handle.stop()
```

## Reaching for a point

`jointBetween(shoulder, hand, upperLength, forearmLength, bend)` solves the elbow for a hand you have already placed, keeping both segments their proper length. Put the hand where the scene needs it — a clasp point shared by two figures, a handle, a doorframe — and let the joint follow, rather than guessing the joint and accepting wherever the hand lands. Out of reach, the limb straightens towards the target instead of failing.

Two figures of different heights only ever touch if both solve back from the same point in scene space; a hand position written into a shared pose lands somewhere else once the other figure is scaled.

## Isometric scenes

`isometric({ tile, squash, rise, origin })` returns a function projecting grid coordinates — tiles across, tiles down, storeys up — onto the drawing plane. Grid +x runs down-right, +y down-left, +z straight up.

```ts
const grid = isometric({ tile: 8, squash: 0.5, rise: 5 })
const corner = grid([3, 1, 6])   // three tiles across, one down, six storeys up
```

Scenes stay two-dimensional. This is an authoring transform applied once, when a figure is written, so depth costs nothing at runtime and every other feature — poses, keyframes, the ASCII preview — works unchanged. See `scenes/city.ts`.

The default `squash` of 0.5 makes a cell twice as wide as it is tall: dimetric rather than strictly isometric, but it is what the word has meant in games for decades and it keeps every edge on a clean 2:1 slope. Pass `squash: Math.tan(Math.PI / 6)` for true 30-degree isometric.

### Solid surfaces

A figure can declare `faces` — filled polygons named by the points around their rim — which is how a scene occludes. A face is painted under its own figure's strokes, and **parts paint in the order they are declared**, so a wall painted later covers the grid lines, roads and vehicles painted before it. Order the parts back to front: in this projection depth is x + y, larger being nearer.

```ts
faces: [{ points: ['topFar', 'topEast', 'topNear', 'topWest'], kind: 'roof' }]
```

A face defaults to the scene's `background`, since its job is to hide what is behind it; give it a `kind` and its own fill to shade the sides of a solid. Faces move with the figure, so an animated part keeps its walls.

Depth can also come from weight alone where solids would be too heavy — see the `css` option below.

## Sizing

Dot radius and stroke width derive from the scene's **median edge length**, so a figure looks the same drawn alone as it does composed into something larger. Set `dotRadius` / `lineWidth` on a scene to override.

Figures here are drawn on a shared module: a person is ~64 units tall, and everything else is scaled against that. Keeping to it means figures compose without per-scene fudging.

## A known artifact

Poses interpolate point *positions*, not joint *angles*, so an edge does not keep its length through the middle of a large swing — an arm shortens slightly as it passes the halfway point. For pose-to-pose deltas this reads as squash-and-stretch and is usually fine. Fixing it properly means interpolating along a skeleton hierarchy, which is a change inside `poses.ts` rather than to the model.

## Scene files

Scenes live in `scenes/` as either TypeScript (typed, with helpers like `mirrorX` and `ring`) or JSON (no compile step). Both produce the same `Scene`; see `src/serialize.ts` for the JSON shape.

## Development

```sh
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # -> docs/ (committed; GitHub Pages serves it)
```
