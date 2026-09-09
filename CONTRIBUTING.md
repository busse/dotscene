# Contributing

Thanks for looking. This is a small project with strong opinions about how a scene gets authored; most of them live in [CLAUDE.md](CLAUDE.md), which is the authoring contract for people and agents alike. Read that before drawing anything. What follows is only what it does not cover.

## Running it

Node 22.18 or newer — the CLI, the scripts and the tests import the TypeScript sources directly and rely on Node stripping the types. There is no build step for the library itself.

```sh
npm install
npm test           # vitest
npm run typecheck  # tsc --noEmit
node bin/dotscene.js check
```

## The loop

Never guess at coordinates. `dotscene preview <scene>` renders to the terminal over the same resolved geometry the SVG uses, and `--at <ms>` runs the same sampler the browser runtime does, so a frame that reads correctly in the terminal is the frame the page will show. Correct a figure from the preview, not from the numbers.

## `docs/` is build output, and it is committed

GitHub Pages serves the gallery straight from `docs/` on `main`, and `GALLERY.md` renders the self-playing SVGs in it. So:

- **Never hand-edit a file in `docs/`.** Run `npm run build` and commit what it writes.
- A file the page needs that no scene produces — the social card's `og.png` — belongs in `site/`, which the build copies in verbatim. Regenerate it with `npm run og`.
- **Rebuild in the same commit as any scene change.** CI rebuilds and fails if the tree is not clean afterwards — a stale gallery is a drift between what the site shows and what the source produces.
- Output is byte-stable by design (2-decimal rounding, fixed ordering). A noisy `git diff` after a rebuild means something actually changed; go find out what.

The repo is heavy on purpose. A self-playing `.anim.svg` is per element rather than per part, so the island hero's is 6.5 MB, and each rebuild of a changed scene adds a new blob to history. That is the price of a gallery that renders on GitHub with no script running, and it was paid knowingly.

## Versioned scenes are archived, never overwritten

A scene with a `version` gets a frozen, self-contained copy under `docs/versions/<name>-v<n>.html` the first time that number is built. Bump the version when a scene's output changes in a way worth judging against what came before; leave it alone for a fix that is simply a fix.

## Before opening a pull request

```sh
npm test && npm run typecheck && node bin/dotscene.js check && npm run build
git status --short   # docs/ changes belong in the commit; nothing else should be dirty
```

TypeScript strict, named exports only, functional — factory functions and closures, no classes. Conventional commits (`feat:`, `fix:`, `docs:`), imperative mood.
