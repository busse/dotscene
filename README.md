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

`dotscene build` writes to `dist/`: one `.svg` and one `.html` per scene, a `dotscene.css`, the gallery at `index.html`, and `dotscene.min.js` when any scene animates.

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

Give an edge a `kind` and it gains a modifier class (`ds-line--soft`) to target.

### Animation

`animate.mode` is `loop`, `pingpong`, `hover`, or `click`. One `requestAnimationFrame` loop drives every scene on the page, scenes pause while scrolled out of view, and `prefers-reduced-motion: reduce` holds the first pose without ever starting. The runtime is exposed as `window.dotscene` for manual control:

```js
const handle = dotscene.mount(svg, config)
handle.goTo('wave')
handle.stop()
```

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
npm run build     # -> dist/
```
