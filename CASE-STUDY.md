# Case study: The Island of Misfit Applications

*What dotscene can do at full stretch, how the island was built, what six rounds of review
changed, and how to build the next one. Written for people and for coding agents alike.*

The island is a one-minute looping hero animation: a tropical island where the applications
nobody owns wash up, and a lighthouse keeper who puts them right, one a day. It runs as the
background of a personal site's intro block, under the page's own copy, in both light and
dark themes, from a single self-contained HTML block and a nine-kilobyte runtime. Everything
in it is dots, the lines between them, and flat coloured faces — the whole of dotscene's
vocabulary — and it was authored and revised entirely from the terminal, by an agent, with the
author reviewing the result in a browser and sending back notes.

- The scene, standalone: `docs/islandHero.html` (`islandHeroNight` is the fixed-dark twin,
  `islandStage` the still)
- Every reviewed version, frozen: `docs/versions/islandHero-v1.html` … `-v6.html`
- The source: `scenes/island/`, with its own [README](scenes/island/README.md) as the map
- The site adapter: `scenes/site/island.ts`

## Why this scene

The EDI hero came first and built most of the machinery: the isometric kit, acts composed on a
shared clock, a camera script, sparse keyframes with per-part easing, versioned output. The
island is the second hero on that kit and is the one to study, because it needed everything
the EDI needed plus the things a story with a character needs:

- a **figure with a day**: waking, walking between stations, working, going home to bed, with
  poses that tween into one another without reading as a corpse rising
- **props that travel**: a mug of coffee that lives in one hand all day, is set down at night
  and picked up in the morning, and never has to be thought about by the act that moves him
- a **reset that holds**: everything put back for the next lap without anything sliding there
  for forty seconds first
- **routes that respect the set**: walks that go round the hut and round the hammock rather
  than through them
- **framing for a page**, not for a frame: every shot places its subject about seven tenths
  across, because the page's copy covers the left

And it went through review. Six versions are archived, each a response to notes like "the palm
trees look like stick insects" and "I thought the man in the hammock was dead". The record of
what each note changed, and the rule it left behind, is the most reusable thing here.

## The numbers

| | |
|---|---|
| lap | 60 s, looping, seamless |
| acts composed | 10 (dawn, five misfits, dusk, a landing, a boat, a reset) plus ambient life and a camera script |
| parts on stage | 79, drawn from 53 figures |
| dots at rest | 1,130 |
| keyframes | 1,352, sparse: each names only the parts that change |
| payload | 705 kB of animation data inline in the block; the runtime is 9 kB |
| source | about 3,600 lines under `scenes/island/`, plus 117 lines of tests |
| build output | one HTML block with both themes; one `.svg` still; one self-playing `.anim.svg` (SMIL, 6 MB) for places no script runs; one archived page per version |

The payload is proportional to what happens, not to the cast. Restating every part at every
instant would be several megabytes; naming only what moves, against a per-part point table,
with easing declared rather than baked, keeps it under a megabyte for a minute of film.

## What you are looking at

**The day.** The sun comes up out of the sea. The keeper sits up in the hammock, reaches for
the mug of coffee steaming on the stump beside it, takes two slow sips, hops down, stretches,
and walks to the jetty. There a mainframe is rocking on its corners; the keeper leans in and it
gets wheels, and rolls out along the planks. A stack of spreadsheets teeters on the grass until
a proper drum slides under it. A fax posts pages into the sea until a wire is strung to the
lamp and the next page flies there instead. A cron job paces the far shore with a beard down
to its feet, ringing at every turn, until it gets an owner's flag and a trim and goes to sit in
the shade. A chatbot on a pole says `?` to everything until it is wired to the mainframe and
starts answering. At every stop the keeper takes a sip first.

At dusk the keeper lights the lamp and the beam begins to sweep the sky. A biplane that has
towed a `404` banner across the sky all day comes in and lands on the grass. A boat finds the
harbour by the light and ties up at the jetty. The keeper goes home to the hut for supper, the
window lights, the chimney smokes; then out again, the mug goes back on its stump, and into the
hammock for the night. Under the deepest dark, with the camera on the lamp, the misfits are put
back the way they were. The night lifts, and the sun comes up.

Around all of it: seven palms in the breeze, ripples on the sea, a crab with pincers on the
sand, a turtle in the shallows, and stars.

**The drawing.** Everything is points and edges. A face is a filled polygon over some of a
figure's points; in an isometric scene a box is three faces and nine edges, and paint order
does the hiding. Colour is by role: an edge or dot carries a `kind`, a face a `kind`, and the
palette maps kinds to the site's tokens. One block carries both themes; the page's theme
toggle picks one.

**The camera.** It never rests. Every shot is a push or a tilt, and every subject sits about
72% of the way across the frame, where the page's copy is not.

## How it is built

Five layers, each a folder or a file, each with one job.

### 1. Figures: named points, the edges between them, poses

A figure is a point table and an edge list. A pose is a partial override of the points, and
because point names are stable across poses, the runtime can tween between any two. The
keeper is the shared `person` figure with poses added for the hammock:

```ts
// scenes/island/figures/keeper.ts
export const keeper = defineFigure('keeper', {
  points: person.points,
  edges: person.edges,
  poses: {
    ...person.poses,
    lie,       // along the hammock, every point placed by hand
    sitUp,     // torso upright, legs dangling — built from the same hip as `lie`
    reachSit,  // sitUp with the left arm out toward the stump
    sipSit,    // sitUp with the mug at the mouth
    sip: { elbowL: [-11, 20], handL: [-3, 11], head: [0, 2] },
    stretch: { elbowL: [-11, 6], handL: [-13, -6], elbowR: [11, 6], handR: [13, -6] },
  },
})
```

`lie` and `sitUp` share one hip position on purpose. The tween between them therefore pivots
at the hip and reads as a body sitting up. The first version rotated the whole figure about its
head instead, and the note that came back was "I thought the man was dead, and coming to
life".

Isometric solids are authored in grid space and projected once: a mainframe is a box with two
tape reels on its face, in a `square` pose on cube feet and a `round` pose on wheels; the cron
job is a tall cabinet on two legs with a clock face and a beard that hangs from it, `long` or
`short`. Every misfit has a pose in which its quirk is put right.

### 2. The world: where everything stands

`world.ts` lays the island out in grid cells and derives every place an act will need: the
hammock's hip cell, the stump's top, each misfit's home and the cell the keeper stands on to
work at it, the jetty's tip, where the boat comes from. Acts never carry coordinates of their
own. Move the jetty in `world.ts` and the mainframe, the boat, the keeper's station and the
camera shots aimed at all of them move with it.

The frame is declared here too — `WIDE`, the establishing shot, and `ASPECT` — and the whole
island is placed in the right half of it, because the page washes the left for its copy.

### 3. Acts: beats on the day's own clock

An act is a list of beats — `{ at, parts: { id: { at?, pose?, opacity?, depth?, … } }, easing? }`
— and the parts it owns. Island acts are placed at zero and speak in absolute times from
`timing.ts`, so a beat reads as a clock time and two acts can be checked against each other by
eye:

```ts
// scenes/island/acts/a01-mainframe.ts — the keeper arrives, sips, and leans in
beats.push(...sip(WORK.mainframe, START.mainframe + 300, true))
beats.push({ at: START.mainframe + 1500, parts: standAt(K, WORK.mainframe, 'lean', true), easing: 'easeInOut' })
beats.push({ at: FIXED.mainframe, parts: { [M]: at(MAINFRAME.home, 0, { pose: 'round' }) }, easing: 'easeInOut' })
```

The staging helpers in `acts/kit.ts` are where the island's craft lives:

- `standAt(part, cell, pose, flipX, z, carry)` puts the keeper's feet on a cell in a pose —
  and places the mug from the left hand of that pose, so an act never thinks about the mug.
- `walk(part, from, to, at, duration, endPose, carry)` lays a gait cycle along a straight
  line, advancing exactly one stride per contact so the planted foot never skates, and settles
  exactly at `at + duration` so the next act can take the keeper at that instant.
- `restAt(cell, z, pose, carry)` anchors the hammock poses at the hip.
- `sip(cell, at, flipX)` is the one beat that knows what the mug is for.
- `flight`, `arcAcross`, `stringWire`, `speak`, `cycle` stage the things that fly, arc, string
  and talk.

Keyframes are sparse. A beat names only what changes; a part left out is interpolated between
the keyframes that mention it. That is what keeps the payload small, and it is also the source
of the subtlest bug in the project (see the reset, below).

### 4. Compose: one timeline, no resampling

```ts
// scenes/island/hero.ts
export const composed = compose(placements, { parts: players })
export const seam = loopGaps(composed, players)   // must stay empty
```

`compose` places every act on the shared clock and refuses if two acts move one part — or the
camera — at overlapping times. Touching end to end is the hand-off. Nothing is baked: the
runtime interpolates each part between its own mentions, with each part's easing.
`loopGaps` lists every part whose state at the lap's end differs from its state at the start;
the island's must be empty, and a test says so.

### 5. The camera: a shot list

```ts
// scenes/island/acts/camera.ts
const framed = (subject: Vec2, width: number, dy = 0): Vec2 => [subject[0] - width * 0.22, subject[1] + dy]
shot(START.mainframe + 800, dockSide, 170, -8)
shot(FIXED.fax + 1200, between(faxSide, tower, 0.45), 260)
```

Each shot is a centre, a width and an arrival time; the runtime glides between them. `framed`
is the whole framing policy in one line: put the subject 72% of the way across. `sizing:
'screen'` keeps dots and strokes a constant size on the page as the camera zooms.

## The working loop

Nothing was authored by guessing at coordinates. The loop, after every edit:

```sh
node bin/dotscene.js check                                   # validate; exit 1 on issues, with didYouMean
node bin/dotscene.js preview islandHero --at 24500 --width 120   # ASCII of what the browser shows at 24.5 s
node bin/dotscene.js preview islandHero --every 5000 --width 60  # a flipbook of the lap
node bin/dotscene.js inspect islandHero --json               # the composed state as data
npx vitest run test/island.test.ts                           # the rules, enforced
node bin/dotscene.js build                                   # docs/, and the version archive
```

The ASCII preview runs over the same resolved geometry as the SVG and the same sampler as
the browser runtime, so if it reads there it will render. It is enough to place things. It is
not enough to judge a pose, a face or a colour, and for those the loop went to a browser.

**Exact instants.** Headless Chrome's virtual-time budget is not the animation clock: page
load eats an unpredictable share of it, and a screenshot asked for at 17.5 s landed anywhere
between 10 and 14. The recipe that works is to copy the built page, append a script that waits
for the runtime's handle and then seeks and pauses, serve the copy, and screenshot that:

```js
// appended to a copy of docs/islandHero.html — built pages have no </body>, so append
(function () {
  var t = +(new URLSearchParams(location.search).get('t') || 0)
  var timer = setInterval(function () {
    var h = window.dotscene && dotscene.scenes.get('islandHero')
    if (!h) return
    clearInterval(timer); h.pause(); h.seek(t)
  }, 10)
})()
```

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1440,600 --virtual-time-budget=5000 \
  --screenshot=f24500.png "http://127.0.0.1:8766/islandHero-harness.html?t=24500"
```

For a close look at one figure, render at 2880×1200 and crop around it; `resolveAt(scene, t)`
gives any part's dots, so the crop can be centred on the keeper wherever the camera is. One
Chrome at a time — parallel runs with separate profiles time out.

**The site.** `scenes/site/island.ts` is the same animation told to cover its box
(`fit: 'slice'`). `scripts/sync-site.mjs` compiles every `art*` scene into the site's
`_includes/art/` and drops the runtime in `assets/js/`. The site picks its hero with one line
in `_data/profile.yml`. A Jekyll build and a screenshot of the page closed each round.

**Versions.** Every island scene reports `ISLAND_VERSION` from `version.ts`; `build` archives
each versioned scene as a frozen, self-contained page under `docs/versions/` and never
overwrites one. Reviewing v3 against v2 is opening two files. The changelog lives with the
number.

## What review changed, version by version

This is the part to read twice. Each note is roughly as it was sent; each fix is what actually
shipped; each rule is now enforced in code, a test, or `CLAUDE.md`.

| v | the note | the fix | the rule it left |
|---|---|---|---|
| 1 → 2 | "The palm trees look like stick insects" | Seven fronds as leaf-shaped faces on a curved trunk; joint dots shrunk and coloured like the foliage | A crown of lines reads as legs. Foliage is faces; quiet the dots on it. |
| 1 → 2 | "I thought the man in the hammock was dead, and coming to life" | The keeper became its own figure with `lie` and `sitUp` sharing one hip; the wake is a body sitting up | Poses that tween into each other share their pivot. A rotation about the head is a corpse rising. |
| 1 → 2 | "Perhaps he has some coffee before work — or while he works, fueled by coffee!" | A mug figure; `standAt` and `walk` place it from the left hand of any pose; a sip on arrival at every misfit | Props ride on the pose that holds them, in the kit, not in the acts. |
| 2 → 3 | "What is the hex-bodied creature in the ocean?" | The turtle got an oval shell, a domed plate, a head and paddle flippers | A body with no feature that names it is a hexagon. |
| 2 → 3 | "Crabs should have obvious pincers" | Palms and fingers as filled faces, snapping as it scuttles | Same. |
| 2 → 3 | "Coffee should be set down BEFORE getting in the hammock, not rested on his lap" | A stump beside the hammock; the mug lives there overnight, is reached for at dawn and set down at dusk; `carry = false` for the stretches when it sits there | A prop has a home. The act that holds it decides when it is held. |
| 2 → 3 | "The cron job and chatbot look squished — is that a beard, or weird legs?" | A tall cabinet with a clock face and a wedge of beard; a portrait screen for the chatbot | A face needs a face's proportions. |
| 2 → 3 | "The pier doesn't connect to the land; the man walks on water" | The jetty's root moved a cell inside the beach rim; stations checked against the rim in UV space | Stations are on dry land. Check the polygon, not the picture. |
| 2 → 3 | "The banner text is tiny and illegible"; "spreadsheets need rows, numbers, a formula" | `404` in the EDI's digit glyphs; a grid, figures in cells and a selected cell on the top sheet | Legibility is decided at the shot's width, not the scene's. |
| 2 → 3 | "He looks like he's holding the mug from the top" | The mug's origin moved into its handle | An attach point is a design decision. |
| 3 → 4 | "The mug on the stump is interleaved with the hammock"; "when he goes to sleep he disappears, but is there in the morning"; "the mainframe scene is too busy" | Stump and mug in front of the rim; the keeper walks to bed on camera and the reset moves only the misfits; the wrong thing was moved for the third note | Depth is per part: what a thing sits on decides what it paints over. A character's continuity is the story's, not the reset's. |
| 4 → 5 | "We had a miscommunication. The jetty should have STAYED IN PLACE. It is the cron job I wanted you to RELOCATE." | The jetty and mainframe reverted exactly; the cron job moved to the far shore | When a note names two things, ask which one moves. |
| 5 → 6 | "The part where he goes to sleep looks glitchy. He lays down, gets back up, lays again, maybe disappears for a moment." | The hammock hung against the hut's door; the walk to the stump went through the canvas and the rim painted over him. The hammock moved a cell out; the evening walks go round the corner and round the palm in two legs | Walks are straight lines. Check every leg against every solid and every face that paints in front. |

Two bugs found without a note, because the numbers said so:

- **The forty-second slide.** A reset is a keyframe like any other. With sparse keyframes, a
  part whose last mention was at 13 s and whose reset is at 56 s tweens between them for
  forty-three seconds — the mainframe was creeping back to its root all afternoon. Every reset
  is now preceded by a hold at the same state (`stateBefore`, `holdAt` in `acts/act.ts`), and a
  test resolves every put-right thing at two instants and asserts it has not moved.
- **The settle that overlapped.** `walk` used to settle 180 ms after its stated end, so every
  hand-off overran the next act's first beat by exactly that much, and the compositor refused.
  It settles at `at + duration` now.

## Rules for building the next one

Consolidated from `CLAUDE.md`, the island README and the table above. An agent authoring a
scene here should treat these as constraints, not advice.

1. **One module.** A person is 64 units tall; draw everything against that. Figures that share
   the module compose without per-scene fudging.
2. **Names are the contract.** Keep point names stable across poses; that is what tweening is.
3. **Never guess at coordinates.** Preview after every edit; go to a browser for anything a
   face or a pose depends on; seek to the exact instant.
4. **Only name what changes.** Sparse keyframes keep the payload proportional to the action.
5. **Ease where motion starts and stops, `linear` in between.** An ease decelerates to zero at
   every keyframe it crosses; easing each step of a walk makes it pulse.
6. **Enter and leave by fading.** Nothing is parked in frame. Off-frame is a real place, and
   the plane's and boat's ends of run are outside the establishing shot on purpose.
7. **Several things at once means `compose`.** Acts declare beats on their own clock; two acts
   moving one part at overlapping times is an error; touching end to end is the hand-off.
8. **A reset needs a hold.** And it happens where the camera is not looking, under the dark,
   or behind a fade.
9. **Ambient loops end on their first pose.** The wrap is a hold, not a snap; `loopGaps` must
   be empty.
10. **Frame for the page.** If the page washes one side for copy, put the subject on the other
    side of every shot, not just the establishing one.
11. **Depth is per part and compares centres.** What a thing sits on, and what paints in front
    of it, are decisions; a jetty running away from the viewer has its far end behind its root.
12. **Walks are straight lines.** Check every leg against every solid, and against every face
    that paints in front of the walker. Two legs by way of a point where one will not do.
13. **Props ride on poses, in the kit.** The act that moves a character should not have to
    know what is in its hand — except at the one beat where it changes.
14. **Version everything reviewed.** Bump on any change worth comparing; never overwrite an
    archive.

## Reusing it

To make a third hero on this kit:

1. `node bin/dotscene.js new <name>` for the scaffold, then a folder like `scenes/island/`:
   `figures/`, `world.ts`, `timing.ts`, `palette.ts`, `acts/`, `hero.ts`, `version.ts`.
2. Import the shared kit rather than forking it: `scenes/iso.ts` for solids, `scenes/edi/acts/kit.ts`
   for flights, drives and docking, `scenes/island/acts/kit.ts` for a character who walks,
   stands, rests and carries. Copy `acts/act.ts` for `defineAct`, `stateBefore` and `holdAt`.
3. Author figures first and preview each alone. Then the world. Then one act at a time, each a
   scene of its own that builds and previews without the rest. Then the camera. Then the reset,
   with holds. Then `loopGaps`.
4. Write the tests as you go: the seam, the order of the day, the framing policy, the drift
   before the reset, the payload bound. `test/island.test.ts` is 117 lines and has caught
   every regression the eye missed.
5. Put it on a page with `fit: 'slice'` and a wash for the copy, and review it there.

The `.claude/skills/dotscene-authoring` skill and `CLAUDE.md` carry the same rules in the form
an agent reads at the start of a session.

## Limits, honestly

- **Poses lerp positions, not angles.** A long limb shortens a little mid-tween. It is visible
  on the keeper's stretch if you look for it.
- **Nothing occludes anything except by paint order.** A figure paints all its faces, then its
  lines, then its dots; a compound figure needs `layers` to hide its own far edges. Everything
  in the island is ordered by hand or by a depth rule, and the rim of the hammock is a separate
  part for exactly this reason.
- **The wide shot is small.** At 600 units across, the keeper is a dozen pixels tall. The
  morning and the bedtime read once the camera has pushed in; on a page, that is two seconds
  after the loop starts.
- **The payload is 705 kB.** Most of it is the mug riding every keeper keyframe. The gallery
  shows scenes over 90 kB as images linking to their own page rather than playing them inline.
  The self-playing SVG, which says the same timeline per element rather than per part, is six
  megabytes, and it scales dots and strokes with the zoom because constant screen sizing needs
  a script.
- **The last seconds are quiet.** The camera holds on the lamp and the sweeping beam while the
  misfits are put back below, out of frame. It is the price of a clean reset.
