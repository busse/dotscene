# dotscene — authoring contract

Illustrations built from named points and the edges between them. Read this before adding or changing a scene.

## Model

- **Figure** — `defineFigure(name, { points, edges, poses?, title? })`. Points are `{ name: [x, y] }` in the figure's own space, **y grows downward**. Edges are `['a', 'b']` pairs, or `{ from, to, kind }` when a stroke needs its own style class.
- **Pose** — a *partial* override of a figure's points, declared in `poses`. Omitted points keep their rest position.
- **Scene** — `defineScene(name, { parts, title?, animate?, padding?, viewBox?, dotRadius?, lineWidth? })`. A part is `{ figure, id?, at?, scale?, rotate?, flipX?, pose? }`.
- **Animation** — `animate.cycle` for one part running through its poses; `animate.keyframes` when several parts move, or when a part travels as well as poses. A keyframe is `{ name, parts: { <id>: { at?, scale?, rotate?, flipX?, pose? } }, duration?, hold? }`; omitted fields fall back to the part's declaration, and an unmentioned part stays put.

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
node bin/dotscene.js preview <scene> --labels          # name the dots
node bin/dotscene.js inspect <scene> --json            # current state as data
node bin/dotscene.js check                             # validate, exit 1 on issues
```

The ASCII preview runs over the same resolved geometry as the SVG, so if it reads correctly there it will render correctly in a browser. Correct a figure from the preview rather than from the numbers.

Every command takes `--json`. Failures are structured, with `didYouMean` when a name looks like a typo — read the issue rather than re-deriving the problem.

## Adding a scene

1. `node bin/dotscene.js new <name>` scaffolds `scenes/<name>.ts`.
2. Author points, then edges, then poses. Preview after each stage.
3. Reuse existing figures by importing them (`import { person } from './person.ts'`) rather than redrawing.
4. `npm test && npm run typecheck && node bin/dotscene.js check` before committing.

## Isometric scenes

Author in grid coordinates and project once with `isometric({ tile, squash, rise })`: +x down-right, +y down-left, +z up. The library stays 2D — this is an authoring transform, not a renderer mode, so everything else keeps working. `scenes/city.ts` is the worked example, with local `box`, `tree` and `line` helpers over grid space.

- A box's far corner is always the one with the smallest x + y. Drop it and the three edges meeting it, and a transparent wireframe becomes a solid-looking box showing three faces.
- Only a line's endpoints become dots, so a full ground grid costs two dots per line rather than one per intersection.
- Nothing occludes anything, so depth comes from stroke weight: give edges a `kind` and set opacity and width in the scene's `css`.

## Gotchas

- The viewBox spans **every pose in the animation cycle**, not just the resting one. A pose that reaches outside the rest bounds is fine; it will not clip.
- Dot radius comes from the scene's median edge length. A part scaled far down inside a large scene will look cramped — fix the authoring scale, do not fight it with `dotRadius`.
- Poses lerp positions, not angles, so long limbs shorten slightly mid-tween. Expected; see the README.
- **Off-stage needs an explicit `viewBox`.** Content is clipped to it, so parking a figure outside is how it enters and exits. A fitted viewBox grows to include every keyframe, and then nothing is ever off-screen.
- **Ease only where motion starts and stops.** `easing` is per keyframe. An ease decelerates to zero at every keyframe it crosses, so easing each step of a walk makes it pulse — use `linear` for the run and ease only the first and last transitions.
- **Match a palette with literal hex, not `currentColor`.** A standalone `.svg`, an `<img src>` or a rasterised PNG inherits nothing from a page. Set the scene's `background` too — assuming white is how a chosen paper colour gets lost. When a palette's roles invert on dark, emit a second scene over the same figure rather than one file for both.
- **Colour by role, not by name.** Give edges a `kind` and points a `pointKinds` entry, then style the `ds-line--x` / `ds-dot--x` classes. Matching point-name prefixes works but breaks silently on a rename.
- **An edge `kind` needs the scene's `css` to do anything.** The class is emitted regardless, but a self-contained block has nowhere else to write the rule. Selectors there are bare and get scoped to the scene automatically.
- **Two figures touch only if both solve back from one scene point.** They are different heights and scales, so a hand position written into a shared pose lands somewhere else for the other one. Convert the target into each figure's local frame and place the hand there; use `jointBetween` for the elbow so the arm bends instead of stretching straight. See `clasp` in `scenes/exchange.ts`.
- **Reordering gestures is a hand-logistics problem, not a reordering problem.** A figure cannot shake with a hand that is holding something, so the order of beats decides which hand each item has to be in, and every change of hand needs a beat to happen in. Work out where each item lives at every step before moving anything.
- **A gesture held as one keyframe reads as a freeze.** A handshake needs a reach, a clasp, and a couple of damped pumps; a single pose held for half a second looks like two people stopped mid-reach.
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
