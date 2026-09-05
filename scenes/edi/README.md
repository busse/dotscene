# The EDI hero animation

An end-to-end EDI transaction lifecycle for a carrier, built as a one-minute looping hero
background with a moving camera. **Freight is inked and data is blue**: the physical world —
sheds, yards, trailers, the road, the river — is drawn in gray, and the carrier's office, the
bank, the rig's cab and every message in the air wear the palette's blue. Two layers: things,
and information about things.

The thesis is *data moves first*. Every physical move is preceded by a message landing: the
carrier says yes and only then does a rig leave its bay; the advance ship notice lands and the
consignee's door goes up before the truck is anywhere near; the driver's device reports in and
the status fans out to three people. Each message carries its transaction set as digits —
`204`, `990`, `214`, `856` — which the camera reveals when it pushes in.

## Where to change what

| to change… | edit | what follows automatically |
|---|---|---|
| the site palette, a face tone | `palette.ts` | every scene, both themes |
| where a site stands, the road, the river | `world.ts` | its doors, mast, yard, every act that goes there, every shot aimed at it |
| what a building looks like | `figures/places.ts` | every scene |
| the rig, the forklift, the pallet | `figures/vehicles.ts` | every act that drives or loads |
| a message's shape, its badge, the digits | `figures/tokens.ts` | every flight |
| how a flight, a drive, a docking or a shuttle is staged | `acts/kit.ts` | every act |
| what one step looks like | `acts/aNN-*.ts` | that step, standalone and in the hero |
| when a step starts | `timing.ts` | the hero, and the camera script |
| where the camera looks, and when | `acts/camera.ts` | the hero |
| the ambient life: flag, smoke, birds, van, ripples | `acts/ambient.ts` | the hero |
| what is put back for the next lap | `acts/reset.ts` | the hero |
| the frame's shape and the establishing shot | `world.ts` (`ASPECT`, `WIDE`) | everything |

## The acts

| | transaction | what happens |
|---|---|---|
| 00 | prologue | the shipper's forklift sets a pallet down by the dock |
| 01 | **204** load tender | shipper → carrier |
| 02 | **997** acknowledgment | carrier → shipper, small and quick |
| 03 | **990** response to tender | carrier says yes; ack back; **the rig leaves its bay** |
| 04 | **211** bill of lading | shipper → carrier; ack back |
| 05 | **214** dispatched | status out; the rig runs the road to the shipper over the bridge and backs onto the dock; the dock worker waves it in |
| 06 | **214** picked up | door up, forklift loads the trailer, rig pulls away; the driver reports, the carrier tells the shipper, the shipper acknowledges |
| 07 | **856** advance ship notice | shipper → consignee across the whole frame; the consignee's door goes up and its forklift comes out to wait |
| 08 | **214** arrived at terminal | the long leg to the crossdock; check-in; the shipper *and the broker* are told |
| 09 | **214** out for delivery | the last leg; the consignee is told |
| 10 | **214** delivered | dock, unload, the receiver signs at the cab; three parties told; the rig drives off |
| 11 | **210** freight invoice | carrier → bank |
| 12 | **820** payment | four coins bank → carrier; the shipper is told what it cost |
| — | reset | the rig is put back on its bay and a fresh pallet on the forks while the camera is elsewhere |

Around all of it: a pennant, smoke from the plant's stack, trees in the wind, two flocks of
birds, ripples under the bridge, a van going the other way, and the crossdock's own forklift
working a door all day. Something is always moving.

## Working on it

```sh
node bin/dotscene.js preview ediHero --at 24500 --width 120     # what the browser shows at 24.5 s, camera and all
node bin/dotscene.js preview ediHero --every 5000 --width 60    # a flipbook of the whole lap
node bin/dotscene.js preview edi06Pickup --at 3000              # one act, on its own clock
node bin/dotscene.js inspect ediHero                            # keyframes, lap length, cast
node bin/dotscene.js build                                      # everything, into docs/
```

In a browser, `dotscene.scenes.get('ediHero')` is the running scene: `pause()`, `seek(ms)`,
`play()`, `time()`. Pausing is sticky — scrolling does not restart it — so a frame can be held
for as long as it takes to look at it.

Each act is its own scene with its own framing (`focus` in `defineAct`), so it builds and
previews without the rest.

## Rules the code depends on

- **An act's first beat establishes everything it will move.** Otherwise the act is right in
  sequence and wrong on its own, and a bad hand-off shows as a slide rather than a failure.
- **One act moves the rig at a time**, and each takes it from where the last one stopped. The
  compositor rejects an overlap outright; a gap shows as the rig sliding with its wheels still.
- **Every yard has one loading lane.** Trailers stop a forklift's reach short of the wall, and
  the forklift works the trailer's side from that lane, so every load is a straight run along
  one grid axis and happens in view rather than inside a building.
- **A vehicle turns in a millisecond.** A box names the same corners in different places when
  laid along the other axis, so a slow blend between headings turns the solid inside out.
- **Messages fly above the masts.** An arc bows up to sixty units over its endpoints, so a
  shot about a message is framed on the masts and the sky, not the yard under it. A shot about
  freight is framed on a dock. The tilts between the two are most of the camera's motion.
- **Things enter and leave by fading.** No token is parked off-frame; opacity does the work,
  and a part invisible at both ends of the lap is exempt from the seam check.
- **The reset happens where the camera is not looking.** The rig jumps back to its bay while
  the camera is close on the office; the pallet jumps back to the shipper's forks at the same
  moment. A cut nobody can see is not a cut. `seam` in `hero.ts` must stay empty.
- **Ambient loops end on their first pose** at the lap's end, so the wrap is a hold rather
  than a snap.
