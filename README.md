# dotscene

Illustrations made of dots and lines — the look of a graph view, but drawn on purpose. A person, a car, a person *driving* a car, all built the way you'd draw a constellation. And, when they move, a camera to watch them with.

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

Scenes compile to a self-contained block you paste onto a page. Static scenes are plain SVG with **zero JavaScript**. Animated ones add a 9 kB runtime that plays a timeline: every moving part, the paint order, each part's opacity, and the camera.

**[See every scene in the gallery →](https://busse.github.io/dotscene/)** — each one beside the block that produces it. [GALLERY.md](GALLERY.md) is the same thing rendered on GitHub, no page needed.

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
$ dotscene preview ediHero --at 24500          # the animation at 24.5 s, camera and all
$ dotscene preview ediHero --every 5000        # a flipbook of the whole lap
$ dotscene inspect person --json
$ dotscene check
```

`preview --at` runs the same sampler the browser runtime uses over the same resolved geometry, so a frame that reads correctly in the terminal is the frame the page will show. `check` exits non-zero and reports issues as data, with a suggestion when something looks like a typo:

```json
{ "code": "UNKNOWN_POINT", "figure": "person", "edge": ["neck", "hnadR"],
  "message": "edge references unknown point 'hnadR'", "didYouMean": "handR" }
```

## Commands

| | |
|---|---|
| `dotscene list` | every scene, with its poses |
| `dotscene inspect <scene>` | points, edges, poses, viewBox, timeline |
| `dotscene preview <scene>` | render to the terminal as text |
| `dotscene check` | validate everything, exit 1 on issues |
| `dotscene new <name>` | scaffold a scene file |
| `dotscene build` | emit SVG, pasteable HTML, gallery, runtime |

Useful flags: `--pose <name>`, `--poses`, `--at <ms>`, `--every <ms>`, `--width <n>`, `--labels`, `--json`, `--dir <path>`, `--out <path>`.

## Output

A looping scene also gets a self-playing copy, `docs/<name>.anim.svg`: the timeline baked into the SVG as SMIL `<animate>` elements, so it plays wherever an SVG image renders and no script can run — a GitHub README, an `<img>`, a Markdown preview. It matches the runtime at every keyframe. It cannot re-stack parts as they pass one another, keep dots and strokes a constant size as the camera zooms, or respond to hover and click; those need the runtime. [GALLERY.md](GALLERY.md) shows every scene this way. For a heavy scene used as decoration it is also the cheapest way onto a page: one cacheable file, no script, no inline data.

Two flags change what a block carries. `--timeline external` leaves the animation out of each block and writes it to `<name>.poses.json`; the svg names that file in `data-dotscene-src`, the runtime fetches it, and a page that shows the scene twice loads it once and caches it — the island's block drops from a megabyte to the size of its drawing. `--css external` leaves the `<style>` out and writes `<name>.css` beside it, for a host that links one sheet per scene and themes the blocks from its own tokens. The versioned archive stays self-contained whatever the flags. `scripts/sync-site.mjs` takes the same two.

`dotscene build` writes to `docs/`: one `.svg` and one `.html` per scene, a `dotscene.css`, the gallery at `index.html`, and `dotscene.min.js` when any scene animates. Anything in `site/` is copied in verbatim, which is how a file the page needs but no scene produces — the social card's PNG — reaches the build without being hand-placed in output. That path is committed rather than ignored, because GitHub Pages serves the gallery straight from it — point Pages at the `main` branch, `/docs` folder. Use `--out` for somewhere else, and `--assets` for a different source of static files.

The gallery opens on one scene playing at full width, whatever it weighs — `ediHeroMeadow`, by default. Its own section further down shows a still linking to its page instead, since two live elements cannot share a scene name. Link previews need a raster and an absolute URL: `--base-url`, or the `homepage` in `package.json`, supplies the address, and `npm run og` renders the card from a chosen instant of the hero into `site/og.png`:

```sh
npm run og                                  # the default scene and instant
node scripts/og-image.mjs --at 12500        # a different moment
node scripts/og-image.mjs --scene islandHero --at 8000 --out /tmp/try.png
```

### Versions

Give a scene a `version` and `build` also writes `docs/versions/<name>-v<n>.html` and `.svg` — a frozen copy with the runtime inlined, so it keeps playing however the runtime changes later — and never overwrites one that exists. The current build stays at `docs/<name>.html`; the gallery tags each scene with its version and links every earlier one. Bump the number when a scene's output changes in a way worth keeping the old one of, so a revision can be judged against what came before.

The emitted block carries its own point labels, which is how the runtime moves things without rebuilding a scene graph:

```html
<svg class="dotscene" data-dotscene="header" viewBox="-24 -3 48 73" role="img">
  <title>A person cycling through poses</title>
  <style>/* defaults, overridable */</style>
  <g data-part="person">
    <line class="ds-line" data-part="person" data-a="neck" data-b="hip" x1="0" y1="13" x2="0" y2="34"/>
    <circle class="ds-dot" data-part="person" data-p="head" cx="0" cy="3" r="1.6"/>
  </g>
</svg>
<script type="application/json" data-dotscene-poses="header">{"cycle":["idle","wave"],…}</script>
<script src="./dotscene.min.js" defer></script>
```

The contract for hand-written markup: every dot has `data-p`, every line `data-a` and `data-b`, every face `data-face`, and each belongs to a part — its own `data-part`, or failing that the nearest `<g data-part>` above it. The poses script must be a sibling of the svg, not a child of a heading or a link the svg sits in: it is text as far as the document is concerned, and inside an `h1` it becomes the heading. A scene that is pure decoration takes `decorative: true` and is emitted with `aria-hidden` and no role or title, so a name the surrounding text already gives is not announced twice.

The runtime handle — `dotscene.scenes.get(name)` — has `play()`, `pause()`, `seek(ms)`, `time()` and `playing()`. `play()` starts the loop outright, whatever mount installed: a scene held still for `prefers-reduced-motion`, or one that never scrolled into view, plays when the page asks it to. `pause()` is sticky against scrolling. `playing()` is how to tell paused from never started, which `time()` alone cannot.

The `.svg` file and the block differ in one thing: the file's stylesheet is XML-escaped, because a standalone SVG is parsed as XML and a themed scene's nesting `&` would be a fatal error there, while inside an HTML page a `<style>` is raw text and the same `&` must stay literal.

Dots and lines default to `currentColor`, so a scene inherits the surrounding text colour in light and dark alike.

### Styling

Styles ship inside the block. The library's defaults are wrapped whole in `:where()`, so they weigh nothing and any other rule beats them — which matters when a page shows several scenes, since each block carries its own copy of the defaults. A scene's own rule for `.ds-line--road` is (0,1,0); the scope that confines it to that scene adds nothing. A host stylesheet overrides any of it with two classes — no element selectors, no `!important`:

```css
.masthead__scene .ds-dot  { r: 2; fill: #6f9; }
.masthead__scene .ds-line { stroke-width: 0.4; }
```

Give an edge a `kind`, or a point a role in `pointKinds`, and it gains a modifier class — `ds-line--soft`, `ds-dot--soft` — to target. A scene's own `css` is the place to write those rules, and it travels inside the emitted block:

```ts
defineScene('city', {
  parts: [...],
  css: '.ds-line--road{stroke-width:1.15}.ds-line--lot{stroke-opacity:.28}',
})
```

Selectors are bare and get scoped to the scene, so two scenes on one page cannot style each other.

Sizes are written against `--ds-zoom`, which the runtime sets as the camera moves for a scene with `sizing: 'screen'`. Write a radius as `calc(.5 * var(--ds-zoom))` and a push-in leaves it the same size on the page — a pen line stays a pen line however close the drawing is held.

### Matching a site's palette

Set `background` and write literal hex in `css` rather than leaning on `currentColor`: a standalone `.svg`, an `<img src>`, or a rasterised PNG inherits nothing from the page it lands on. Where a palette's roles invert between light and dark, emit two scenes over one figure rather than hoping a single file covers both — see `city` and `cityNight` in `scenes/city.ts`, which share every point and differ only in `background` and `css`. For a block that sits inline on a themed page, `themedCss` in `scenes/edi/palette.ts` carries both palettes in one copy.

### Animation

Two forms. `cycle` is the shorthand for one part running through its own poses:

```ts
animate: { cycle: ['idle', 'wave', 'lean'], duration: 700, hold: 900 }
```

`keyframes` stages the whole scene — each step says where the parts it moves are, and how the camera is framed:

```ts
animate: {
  keyframes: [
    { name: 'empty',  duration: 0, hold: 400,
      parts: { walker: { at: [-150, 0], pose: 'walkCarryA' }, bag: { at: [-138, 35], opacity: 0 } } },
    { name: 'meet',   duration: 700, hold: 500,
      parts: { walker: { at: [-30, 0], pose: 'holdR' },       bag: { at: [-18, 35], opacity: 1 } },
      camera: { at: [-24, 30], width: 120 } },
  ],
}
```

**Keyframes are sparse.** A part that a keyframe leaves out is not frozen there; it is interpolated between the keyframes that *do* mention it, eased by the keyframe it is heading into. So a keyframe only has to name what it changes, and a scene with forty moving parts costs what actually happens rather than forty parts times every instant. Before its first keyframe a part holds where the scene declared it, and travels from there during the transition into that keyframe; after its last it holds; and in a loop the wrap carries it back to its opening state over the first keyframe's `duration` — set that to `0` and the wrap is a cut.

A part's state is `at`, `scale`, `rotate`, `flipX`, `pose`, `depth` (paint order, interpolated, so a truck crosses behind a building where the numbers cross) and `opacity` (interpolated, so a thing appears and vanishes by fading rather than by teleporting off-frame). A keyframe's `pose` can be a computed `Pose` rather than a name — build one with `lerpPoints` to catch a figure at any point between two poses, which is how two walkers on one timeline keep different cadences.

Parts that want different rhythms — steam that flickers against palms that sway slowly — are a `keyframes` scene, not a `cycle`: each part is mentioned only at its own beats, so each keeps its own period and phase, and `compose` lays several such acts on one clock. A `cycle` is one part, one clock.

A keyframe's `easing` applies to every part arriving at it; a part that wants a different one carries its own `easing` on its state. Continuous travel wants `linear` on every step, easing only where the motion genuinely starts and stops: an ease brings velocity to zero at *every* keyframe it passes through, which is what makes a run of steps pulse instead of flow.

**The camera** is a track like any other. Give the scene a resting `camera: { at, width, aspect }` and any keyframe a `camera: { at?, width? }`, and the viewBox pans and zooms between them; height follows from the aspect so the frame never changes shape. `sizing: 'screen'` keeps dots and strokes a constant size on the page as the camera moves. A scene with a camera is framed by it; `viewBox` then only describes the stage.

`animate.mode` is `loop`, `pingpong`, `hover`, or `click`. One `requestAnimationFrame` loop drives every scene on the page, scenes pause while scrolled out of view, and `prefers-reduced-motion: reduce` holds the first frame without ever starting. The runtime is exposed as `window.dotscene`, and every mounted scene is in `dotscene.scenes` by name:

```js
const hero = dotscene.scenes.get('ediHero')
hero.pause()          // sticky: scrolling does not restart it
hero.seek(24500)      // paint the frame at 24.5 s
hero.play()
hero.time()           // where the clock is
hero.duration         // one lap, in ms
```

### Composing overlapping acts

A keyframe is one global instant, so splicing keyframe arrays end to end can only show one thing at a time. For an animation with several things happening at once, `compose` places independently-authored *acts* on a single timeline:

```ts
const tender: Act = {
  name: '204',
  beats: [
    { at: 0,    parts: { token: { at: shipper, opacity: 0 } } },
    { at: 300,  parts: { token: { at: shipper, opacity: 1 } }, easing: 'easeOut' },
    { at: 1800, parts: { token: { at: carrier } }, camera: { at: carrier, width: 240 }, easing: 'easeInOut' },
  ],
}

const { keyframes, duration } = compose([
  { act: tender, at: 0 },
  { act: pickup, at: 1200 },   // overlaps — both are in flight together
])
```

Each act keeps its own clock; `at` places it on the shared one. Nothing is resampled and nothing is baked: a beat's easing is written onto its keyframe, and when two beats land on the same instant wanting different easings each part carries its own. Two acts moving the same part — or the camera — at overlapping times is rejected as an authoring mistake; touching end to end is how a part is handed on. `loopGaps(composed, parts)` names anything whose last state differs from its opening state, which is what makes a loop's seam invisible; a part invisible at both ends is exempt.

## Reaching for a point

`jointBetween(shoulder, hand, upperLength, forearmLength, bend)` solves the elbow for a hand you have already placed, keeping both segments their proper length. Put the hand where the scene needs it — a clasp point shared by two figures, a handle, a doorframe — and let the joint follow, rather than guessing the joint and accepting wherever the hand lands. Out of reach, the limb straightens towards the target instead of failing.

Two figures of different heights only ever touch if both solve back from the same point in scene space; a hand position written into a shared pose lands somewhere else once the other figure is scaled.

## Using the hero animation on a site

`dotscene build` emits `docs/ediHero.html` — a self-contained block carrying both palettes, so one copy serves a page with a theme toggle. For Jekyll:

```sh
cp docs/ediHero.html    _includes/edi-hero.html
cp docs/dotscene.min.js assets/js/
```

```liquid
<div class="hero">
  {% include edi-hero.html %}
  <div class="hero__copy"><h1>Freight moves. Data moves first.</h1></div>
</div>
<script src="{{ '/assets/js/dotscene.min.js' | relative_url }}" defer></script>
```

The block ships with a `<script src="./dotscene.min.js">` tag pointing at its own directory; either drop the runtime beside the include or strip that line and load it yourself, as above. One runtime serves every scene on the page.

Size it with CSS — the SVG is `width: 100%; height: auto` at a 2.4:1 aspect, and its own ground colour comes with it. `prefers-reduced-motion: reduce` holds the establishing shot and never starts the loop. The lower right of the frame is quiet by design; that is where the copy goes.

`docs/ediHeroNight.html` is a fixed-dark twin, for a standalone `.svg` or an `<img>` where no page CSS can reach in. `docs/ediHeroMeadow.html` is the same animation on a green ground with grass and bare earth for texture, with its own dark twin. See `scenes/edi/README.md` for what to edit to change what.

`docs/islandHero.html` is a second hero over the same machinery: the Island of Misfit Applications, a tropical island where the applications nobody owns wash up and a lighthouse keeper puts them right, one a day. Its action sits in the right half of the frame so a page can lay copy over the left. `scenes/island/README.md` is its map, and [CASE-STUDY.md](CASE-STUDY.md) is the long read: how it is built, what six rounds of review changed, and the rules for building the next one.

## Card art for the site

`scenes/site/` holds the art for a site next door: one scene per card at the slot's own aspect, ink as `currentColor` and the site's tokens for everything else, and `artHero`, the EDI meadow with `fit: 'slice'` so it covers the intro block from rule to rule while the page washes paper over the copy. `node scripts/sync-site.mjs <path-to-site>` writes each `art<Thing>` scene into `<site>/_includes/art/<thing>.html` — the block without its runtime tag, since the site's layout loads the runtime once — and copies the runtime to `<site>/assets/js/`. The site never hand-edits those files; change the scene here and sync. It is written against a Jekyll layout; the shape is worth copying even if yours differs.

## Isometric scenes

`isometric({ tile, squash, rise, origin })` returns a function projecting grid coordinates — tiles across, tiles down, storeys up — onto the drawing plane. Grid +x runs down-right, +y down-left, +z straight up.

```ts
const grid = isometric({ tile: 8, squash: 0.5, rise: 5 })
const corner = grid([3, 1, 6])   // three tiles across, one down, six storeys up
```

Scenes stay two-dimensional. This is an authoring transform applied once, when a figure is written, so depth costs nothing at runtime and every other feature — poses, keyframes, the ASCII preview — works unchanged. See `scenes/city.ts`, and `scenes/iso.ts` for the shared kit: `box`, `pad`, `edge`, `line`, and `blade(prefix, base, tip, half, lift, kind)` — one filled quad from a base to a drooping tip, widest at the middle and arched by `lift`, which is the island's palm frond and any leaf, petal, fin or flame.

The default `squash` of 0.5 makes a cell twice as wide as it is tall: dimetric rather than strictly isometric, but it is what the word has meant in games for decades and it keeps every edge on a clean 2:1 slope. Pass `squash: Math.tan(Math.PI / 6)` for true 30-degree isometric.

### Solid surfaces

A figure can declare `faces` — filled polygons named by the points around their rim — which is how a scene occludes. A face is painted under its own figure's strokes, and **parts paint in depth order**, so a wall painted later covers the grid lines, roads and vehicles painted before it. Give parts a `depth` — in this projection `x + y`, larger being nearer — or order them back to front.

```ts
faces: [{ points: ['topFar', 'topEast', 'topNear', 'topWest'], kind: 'roof' }]
```

A face defaults to the scene's `background`, since its job is to hide what is behind it; give it a `kind` and its own fill to shade the sides of a solid. Faces move with the figure, so an animated part keeps its walls.

Inside one figure, faces paint first, then lines, then dots — so a compound figure would draw a far solid's edges across a near solid's walls. `layers` fix that: groups of point names painted solid by solid, back to front. `merge` in `scenes/iso.ts` records one layer per shape merged, so `merge(farBlock, nearShed)` paints correctly without any more work.

## Sizing

Dot radius and stroke width derive from the scene's **median edge length**, so a figure looks the same drawn alone as it does composed into something larger. Set `dotRadius` / `lineWidth` on a scene to override.

Figures here are drawn on a shared module: a person is ~64 units tall, and everything else is scaled against that. Keeping to it means figures compose without per-scene fudging.

## A known artifact

Poses interpolate point *positions*, not joint *angles*, so an edge does not keep its length through the middle of a large swing — an arm shortens slightly as it passes the halfway point. For pose-to-pose deltas this reads as squash-and-stretch and is usually fine. Fixing it properly means interpolating along a skeleton hierarchy, which is a change inside `poses.ts` rather than to the model.

## Scene files

Scenes live in `scenes/` as either TypeScript (typed, with helpers like `mirrorX` and `ring`) or JSON (no compile step). Both produce the same `Scene`; see `src/serialize.ts` for the JSON shape.

## Development

Node 22.18 or newer. The CLI, the scripts and the tests import the TypeScript sources directly and rely on Node stripping the types; there is no build step.

```sh
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # -> docs/ (committed; GitHub Pages serves it)
```
