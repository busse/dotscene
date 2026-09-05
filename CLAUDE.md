# dotscene — authoring contract

Illustrations built from named points and the edges between them. Read this before adding or changing a scene.

## Model

- **Figure** — `defineFigure(name, { points, edges, poses?, title? })`. Points are `{ name: [x, y] }` in the figure's own space, **y grows downward**. Edges are `['a', 'b']` pairs, or `{ from, to, kind }` when a stroke needs its own style class.
- **Pose** — a *partial* override of a figure's points, declared in `poses`. Omitted points keep their rest position.
- **Scene** — `defineScene(name, { parts, title?, animate?, padding?, viewBox?, camera?, dotRadius?, lineWidth?, css?, background? })`. A part is `{ figure, id?, at?, scale?, rotate?, flipX?, pose?, depth?, opacity? }`.
- **Animation** — `animate.cycle` for one part running through its poses; `animate.keyframes` when several parts move, or when a part travels as well as poses. A keyframe is `{ name, parts: { <id>: { at?, scale?, rotate?, flipX?, pose?, depth?, opacity?, easing? } }, camera?: { at?, width? }, duration?, hold?, easing? }`; omitted fields fall back to the part's declaration. **Keyframes are sparse**: a part a keyframe leaves out is interpolated between the keyframes that mention it, not frozen. Only name what changes.
- **Camera** — a scene's `camera: { at, width, aspect }` is the resting frame; a keyframe's `camera` moves it. `animate.sizing: 'screen'` keeps dots and strokes a constant size on the page as it zooms.
- **Layers** — inside a figure, faces paint, then lines, then dots; `layers` (groups of point names, back to front) paint a compound figure solid by solid instead. `merge` in `scenes/iso.ts` records one layer per shape merged.

Point names are the contract. Keep them stable across poses — that is what makes tweening work.

## Conventions

- **One module for every figure**: a person is ~64 units tall, feet at y ≈ 64. Draw cars, tools, and terrain against that (a car is ~170 units long). Figures that share the module compose without per-scene fudging.
- Suffix bilateral points `L`/`R` and generate one side with `mirrorX(points)`.
- Use `ring(prefix, center, radius, count)` for anything round — it returns both points and the edges closing the loop.
- Ground lines sit at a figure's foot height so parts can share one `y` without offsets.

## The loop

Never guess at coordinates. After every edit:

```sh
node bin/dotscene.js preview <scene> --width 44        # look at it
node bin/dotscene.js preview <scene> --pose <name>     # one pose
node bin/dotscene.js preview <scene> --poses           # step the whole cycle
node bin/dotscene.js preview <scene> --pose <keyframe> # one step of a staged animation
node bin/dotscene.js preview <scene> --at 12500        # the animation at an instant, camera and all
node bin/dotscene.js preview <scene> --every 2000      # a flipbook of the whole lap
node bin/dotscene.js preview <scene> --labels          # name the dots
node bin/dotscene.js inspect <scene> --json            # current state as data
node bin/dotscene.js check                             # validate, exit 1 on issues
```

The ASCII preview runs over the same resolved geometry as the SVG, and `--at` runs the same sampler as the browser runtime, so if it reads correctly there it will render correctly in a browser. Correct a figure from the preview rather than from the numbers. In a browser, `dotscene.scenes.get(name)` gives `pause()` (sticky), `seek(ms)`, `play()` and `time()` — the way to hold a frame and look at it.

Every command takes `--json`. Failures are structured, with `didYouMean` when a name looks like a typo — read the issue rather than re-deriving the problem.

## Adding a scene

1. `node bin/dotscene.js new <name>` scaffolds `scenes/<name>.ts`.
2. Author points, then edges, then poses. Preview after each stage.
3. Reuse existing figures by importing them (`import { person } from './person.ts'`) rather than redrawing.
4. `npm test && npm run typecheck && node bin/dotscene.js check` before committing.

## Isometric scenes

`scenes/iso.ts` holds the shared kit — `Shape`, `merge`, `tag`, `figureOf`, and `isoKit(project)` giving `box`, `pad`, `edge` and `line` bound to a projection. Both the city and the EDI scenes build on it; add primitives there rather than forking them.

Author in grid coordinates and project once with `isometric({ tile, squash, rise })`: +x down-right, +y down-left, +z up.

**Naming areas.** Screen words and grid words disagree here, so say which you mean. In `scenes/city.ts` the plate's four *corners* land at the top, right, bottom and left of the frame, which makes its four *edges* the upper-left, upper-right, lower-right and lower-left. So the east–west road (constant `gy`, running along +x) enters through the upper-left edge and leaves through the lower-right; the other road runs upper-right to lower-left. The lots read as the top lot (tower), right lot (office), left lot (works) and bottom lot (park). Landmarks — "the park lot", "the tower's road" — beat compass words, and grid coordinates beat both. The library stays 2D — this is an authoring transform, not a renderer mode, so everything else keeps working. `scenes/city.ts` is the worked example, with local `box`, `tree` and `line` helpers over grid space.

- A box's far corner is always the one with the smallest x + y. Drop it and the three edges meeting it, and a transparent wireframe becomes a solid-looking box showing three faces.
- **Solids need `faces`, and paint order does the hiding.** Parts paint in declaration order, so list them back to front — depth is x + y, larger nearer. A face is painted under its own figure's strokes and defaults to the scene's `background`. Check what actually overlaps before settling an order: a single depth key per part is only correct while nothing straddles another thing's span.
- Only a line's endpoints become dots, so a full ground grid costs two dots per line rather than one per intersection.
- **A footprint of w by d projects to `(w + d) * tile` across the screen**, because both axes run diagonally. Pick dimensions from the screen width they produce, not from how the number reads — a shed that sounds six wide is eighty units across.
- Roads want to run along the grid axes, with L-turns between waypoints. A diagonal path cannot carry a grid-aligned solid, so anything driving along it reads as a crate sliding sideways.
- Nothing occludes anything, so depth comes from stroke weight: give edges a `kind` and set opacity and width in the scene's `css`.

## The EDI hero

`scenes/edi/` is the largest thing here — a twelve-act EDI lifecycle with a prologue, ambient
life, a camera script and a reset, composed into one looping hero background. `scenes/edi/README.md`
is the map: what to edit to change what, the act list, and the rules the tests enforce. Read it
before touching anything in that folder. Figures live in `scenes/edi/figures/`, the layout in
`world.ts`, the staging helpers in `acts/kit.ts`, the shot list in `acts/camera.ts`.

- **Payload is proportional to what happens, not to the cast.** Sparse keyframes, flat
  coordinate arrays against a per-part point table, per-part easing instead of baked samples,
  and a depth/opacity map that sends the stack once. The hero is ~1300 keyframes and under
  400 kB; restating every part at every instant was 1.7 MB.
- **A gallery of everything cannot also play everything.** Scenes over about 90 kB are shown as
  images linking to their own page; under that they embed and animate in place.

## Gotchas

- The viewBox spans **every pose in the animation cycle**, not just the resting one. A pose that reaches outside the rest bounds is fine; it will not clip.
- Dot radius comes from the scene's median edge length. A part scaled far down inside a large scene will look cramped — fix the authoring scale, do not fight it with `dotRadius`.
- Poses lerp positions, not angles, so long limbs shorten slightly mid-tween. Expected; see the README.
- **Enter and leave by fading, not by parking.** `opacity` is a keyframe field and interpolates; a thing that must appear or vanish fades. Parking off-frame still works, and needs an explicit `viewBox` or `camera` so a fitted box does not grow to include it.
- **Ease only where motion starts and stops.** `easing` is per keyframe, and a part can carry its own. An ease decelerates to zero at every keyframe it crosses, so easing each step of a walk makes it pulse — use `linear` for the run and ease only the first and last transitions.
- **Messages fly above the things that send them.** An arc bows up to sixty units over its endpoints. A shot about a message is framed on the masts and the sky; a shot about freight is framed on a dock. Aim the camera at the altitude of the thing you want seen, and check with `preview --at`.
- **A paused scene is paused.** The runtime's `pause()` is sticky against the intersection observer; without that, every screenshot tool that scrolls restarts the clock and the frame you inspect is not the frame you asked for.
- **A standalone `.svg` is XML.** The compiler escapes the stylesheet in the `.svg` file and leaves it raw in the block, because a nesting `&` is fatal in one and required in the other. Validate with `xmllint --noout docs/<scene>.svg` after touching the renderer's CSS.
- **Match a palette with literal hex, not `currentColor`.** A standalone `.svg`, an `<img src>` or a rasterised PNG inherits nothing from a page. Set the scene's `background` too — assuming white is how a chosen paper colour gets lost. When a palette's roles invert on dark, emit a second scene over the same figure rather than one file for both.
- **Colour by role, not by name.** Give edges a `kind` and points a `pointKinds` entry, then style the `ds-line--x` / `ds-dot--x` classes. Matching point-name prefixes works but breaks silently on a rename.
- **An edge `kind` needs the scene's `css` to do anything.** The class is emitted regardless, but a self-contained block has nowhere else to write the rule. Selectors there are bare and get scoped to the scene automatically.
- **Two figures touch only if both solve back from one scene point.** They are different heights and scales, so a hand position written into a shared pose lands somewhere else for the other one. Convert the target into each figure's local frame and place the hand there; use `jointBetween` for the elbow so the arm bends instead of stretching straight. See `clasp` in `scenes/exchange.ts`.
- **Reordering gestures is a hand-logistics problem, not a reordering problem.** A figure cannot shake with a hand that is holding something, so the order of beats decides which hand each item has to be in, and every change of hand needs a beat to happen in. Work out where each item lives at every step before moving anything.
- **A gesture held as one keyframe reads as a freeze.** A handshake needs a reach, a clasp, and a couple of damped pumps; a single pose held for half a second looks like two people stopped mid-reach.
- **Several things at once means `compose`, not concatenation.** Splicing keyframe arrays shows one thing at a time. Acts declare beats on their own clock and `compose` places them on a shared timeline. Nothing is resampled or baked: keyframes are sparse and the runtime interpolates each part between its own mentions, easing per part. Two acts moving one part — or the camera — at overlapping times throws; touching end to end is the hand-off. Run `loopGaps(composed, parts)` on anything meant to loop.
- **A track's first mention is a glide, not a snap.** A part travels from where the scene declared it into its first keyframe over the transition preceding that keyframe. Declare parts where their first beat will find them, and a first beat that "establishes" a position costs nothing.
- **A compound figure needs `layers` to occlude itself.** Without them a far block's edges draw across the near shed's walls, because a figure paints all its faces before any of its lines. `merge` gives one layer per shape; list shapes back to front.
- **Two figures on one timeline will march in lockstep unless you break it.** They share a keyframe grid, so give each its own `scale` (height and stride together), gait `rate` (cadence), and starting phase. A keyframe's `pose` accepts a computed `Pose`, so a figure can sit anywhere between two named poses rather than only on the grid — see `gaitPose` in `scenes/exchange.ts`.
- **A travelling figure must advance exactly one stride per contact keyframe.** The stride has to equal the foot separation in the contact poses, or the planted foot slides along the ground and the figure reads as skating. See `STRIDE` in `scenes/exchange.ts` and `stepA`/`stepB` in `scenes/person.ts`.
- **A loop's wrap is a tween like any other.** If the last keyframe is on the opposite side from the first, give the first `duration: 0` so the reset is a cut instead of everything sliding backwards in full view.
- **Scaling moves a floor anchor.** Props are drawn with the floor at y = 64, and `scale` multiplies about the origin — so a chair at `scale: 0.7` ends up floating. Offset it by `64 * (1 - scale)` to put its feet back down, or `36 * (1 - scale)` for something that belongs on the tabletop.
- **`mirrorX` matches an `L` suffix, not an `L` anywhere.** Name bilateral points `hair1L` / `hair1R`, not `hairL1` — the latter silently produces no mirror and then fails validation on the edges.
- A rigid sub-assembly built with `ring` (a head, a wheel) is expensive to move in a pose, since every point needs an override. Prefer moving the whole part with `at` / `rotate`, and keep poses to the limbs.
- Two files must not export scenes with the same name — `loadScenes` rejects it rather than picking one.
- Output is byte-stable by design (2-decimal rounding, fixed ordering). A noisy `git diff` after a rebuild means something actually changed.
- `docs/` is build output but **is committed** — GitHub Pages serves the gallery from it. Rebuild and commit it alongside any scene change; never hand-edit a file in there.

## Style

TypeScript strict, named exports only, functional — factory functions and closures, no classes. Conventional commits.
