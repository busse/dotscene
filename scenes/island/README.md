# The Island of Misfit Applications

A tropical island where the applications nobody owns wash up, and a lighthouse keeper who
puts them right, one a day, built as a one-minute looping hero background with a moving
camera. It is openly whimsical: a mainframe rocking on its corners, a spreadsheet holding
up the business, a fax machine posting pages into the sea, a cron job pacing the beach with
a beard, and a chatbot that answers everything with a question.

The island sits in the **right half of the frame**, and every shot places its subject about
seven tenths of the way across, because the page that uses it lays its copy over the left.
The sea on the left is the page's.

## Where to change what

| to change… | edit | what follows automatically |
|---|---|---|
| the palette, a face tone, the two themes | `palette.ts` | every scene |
| where the island, the tower, the hut and each misfit stand | `world.ts` | every act, every shot |
| the frame's shape and the establishing shot | `world.ts` (`ASPECT`, `WIDE`) | everything |
| what the island, the tower, the hut, the dock look like | `figures/terrain.ts`, `figures/structures.ts` | every scene |
| what a misfit looks like, its poses | `figures/misfits.ts` | its act |
| the plane, the boat, the sun, the moon, the crab, the turtle | `figures/traffic.ts` | the acts that use them |
| wires, bubbles, glows, the dark | `figures/fixtures.ts` | the acts that use them |
| how the keeper walks, stands, lies; flights, arcs, wires, speech | `acts/kit.ts` | every act |
| what one act looks like | `acts/aNN-*.ts` | that act |
| when an act starts, when its misfit is fixed, when night falls | `timing.ts` | the hero and the camera |
| where the camera looks, and when | `acts/camera.ts` | the hero |
| the ambient life: palms, waves, crab, turtle, stars | `acts/ambient.ts` | the hero |
| what is put back for the next lap | `acts/reset.ts` | the hero |
| the version the scenes report | `version.ts` | the archive under `docs/versions/` |

## The day

| | act | what happens |
|---|---|---|
| 00 | dawn | the sun comes up out of the sea; the keeper wakes in the hammock and walks down to the dock |
| 01 | the mainframe | rocking on its corners at the dock; the keeper leans in and it gets wheels, and rolls |
| 02 | the spreadsheet | a stack of sheets teetering on the grass; the keeper fetches a proper drum and the stack straightens on it |
| 03 | the fax | posting pages into the sea with a splash; the keeper strings a wire to the lamp and the next page flies there instead |
| 04 | the cron job | pacing the beach ringing at every turn; the keeper pins an owner's flag on it, trims the beard, and it goes to sit in the shade |
| 05 | the chatbot | a screen on a pole saying `?` to everything; wired to the mainframe it starts giving answers |
| 06 | dusk | the keeper lights the lamp; the beam sweeps the sky; home to the hut, window lit, chimney smoking |
| 07 | the landing | the plane that has flown its banner over all day comes in and lands on the grass |
| 08 | the boat | a boat finds the harbour by the light and ties up at the dock |
| — | reset | under the deepest dark, with the camera on the lamp, everything is put back for the next lap |

Around all of it: seven palms in the breeze, ripples on the sea, a crab on the sand, a turtle
in the shallows, and stars when it is dark.

## Variants

`islandHero` is the paper version with both themes in one block; `islandHeroNight` is its
fixed-dark twin. `islandStage` is the still, for judging the layout. `artIsland` in
`scenes/cbdot/island.ts` is the same animation told to cover its box, for the site.

## Working on it

```sh
node bin/dotscene.js preview islandHero --at 24500 --width 120   # what the browser shows at 24.5 s
node bin/dotscene.js preview islandHero --every 5000 --width 60  # a flipbook of the lap
node bin/dotscene.js preview islandStage --width 150             # the layout, still
node bin/dotscene.js inspect islandHero                          # keyframes, lap, cast
```

In a browser, `dotscene.scenes.get('islandHero')` is the running scene: `pause()`, `seek(ms)`,
`play()`, `time()`. To see an exact instant headlessly, load the built page with a script
that waits for the handle, then seeks and pauses, and screenshot that.

## Rules the code depends on

- **Every act speaks in the day's own times.** Island acts are placed at zero and use
  `START`, `FIXED` and `NIGHT` from `timing.ts` directly, so an act's beats read as clock
  times and two acts can be checked against each other by eye.
- **One act moves the keeper at a time.** Each act ends by walking the keeper to the next
  station, arriving exactly at the instant the next act's first keeper beat is due. `walk`
  settles at `at + duration`, not after it.
- **A reset needs a hold.** A jump back is a keyframe like any other, so without a hold at
  the same state an instant before it, the part slides there for as long as it has been
  still. `stateBefore` and `holdAt` in `acts/act.ts` do this; the drift test enforces it.
- **The reset happens where the camera is not looking and under the dark.** The camera is
  on the lamp when the misfits jump back; the nightfall is at its deepest. `seam` in
  `hero.ts` must stay empty.
- **Ambient loops end on their first pose** at the lap's end, so the wrap is a hold rather
  than a snap. Waves only run whole cycles.
- **The beam never points down.** It sweeps the sky between two angles rather than turning
  full circle, because a wedge pointing into the island reads as a mistake.
- **Off-frame is a real place.** The plane's ends of run and the boat's start are outside
  the establishing shot on purpose, so their parked states never show.
