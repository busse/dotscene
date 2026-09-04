# dotscene — authoring contract

Illustrations built from named points and the edges between them. Read this before adding or changing a scene.

## Model

- **Figure** — `defineFigure(name, { points, edges, poses?, title? })`. Points are `{ name: [x, y] }` in the figure's own space, **y grows downward**. Edges are `['a', 'b']` pairs, or `{ from, to, kind }` when a stroke needs its own style class.
- **Pose** — a *partial* override of a figure's points, declared in `poses`. Omitted points keep their rest position.
- **Scene** — `defineScene(name, { parts, title?, animate?, padding?, viewBox?, dotRadius?, lineWidth? })`. A part is `{ figure, id?, at?, scale?, rotate?, flipX?, pose? }`.

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
node bin/dotscene.js preview <scene> --poses           # every pose in the cycle
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

## Gotchas

- The viewBox spans **every pose in the animation cycle**, not just the resting one. A pose that reaches outside the rest bounds is fine; it will not clip.
- Dot radius comes from the scene's median edge length. A part scaled far down inside a large scene will look cramped — fix the authoring scale, do not fight it with `dotRadius`.
- Poses lerp positions, not angles, so long limbs shorten slightly mid-tween. Expected; see the README.
- Two files must not export scenes with the same name — `loadScenes` rejects it rather than picking one.
- Output is byte-stable by design (2-decimal rounding, fixed ordering). A noisy `git diff` after a rebuild means something actually changed.
- `docs/` is build output but **is committed** — GitHub Pages serves the gallery from it. Rebuild and commit it alongside any scene change; never hand-edit a file in there.

## Style

TypeScript strict, named exports only, functional — factory functions and closures, no classes. Conventional commits.
