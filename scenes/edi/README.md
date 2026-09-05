# The EDI hero animation

An end-to-end EDI transaction lifecycle for a carrier and forwarder, built as an animated
background. Freight is inked and data is blue: the physical world — docks, terminals,
trailers, the rig — is drawn in gray-900, and the network above it, with everything
travelling that network, is non-photo blue. One layer is things; the other is information
about things.

## Where to change what

Every kind of change has exactly one place it belongs.

| to change… | edit | what follows automatically |
|---|---|---|
| the site palette | `palette.ts` | every scene, both themes |
| where a terminal sits | `route.ts` | its buildings, its network node, the road, the rig's path |
| what is built at a waypoint | `places.ts` | nothing else |
| the trading-partner network | `network.ts` | where messages fly to and from |
| a message's shape | `tokens.ts` | every act that sends one |
| the rig | `fleet.ts` | every act that drives |
| how fast the whole thing runs | `timing.ts` | every act |
| what one step looks like | `acts/aNN-*.ts` | that step, standalone and in the hero |
| the running order | `acts/index.ts` | the hero |
| when a step starts, and what it overlaps | `hero.ts` | the hero |
| the frame, tile size, or height scale | `projection.ts` | everything |

## The twelve acts

| | transaction | what moves |
|---|---|---|
| 01 | **204** load tender | shipper → carrier |
| 02 | **997** functional acknowledgment | carrier → shipper |
| 03 | **990** response to tender | carrier → shipper, with an ack back |
| 04 | **211** bill of lading | shipper → carrier, with an ack back |
| 05 | **214** dispatched | status out; the rig leaves for the shipper |
| 06 | **214** picked up | status and ack; the rig loads and pulls away |
| 07 | **856** advance ship notice | shipper → consignee, skipping the carrier entirely |
| 08 | **214** arrived at terminal | the long leg through the crossdock; the broker is told too |
| 09 | **214** out for delivery | the last leg |
| 10 | **214** delivered | three parties told; the rig carries on out of frame |
| 11 | **210** freight invoice | carrier → payer, who never saw the freight |
| 12 | **820** payment and remittance | money moves; the shipper is told what it cost |

## Working on it

```sh
node bin/dotscene.js preview edi05Dispatch --poses   # step one act in the terminal
node bin/dotscene.js inspect ediHero --json          # keyframe count, timing, total length
node bin/dotscene.js build                           # everything, into docs/
```

Each act is its own scene, so it builds and previews without the rest. That is the reason for
the file layout: editing act 11 means opening one file and previewing one scene.

## Rules the code depends on

- **An act's first beat establishes everything it will move.** Otherwise the act is correct in
  sequence and wrong on its own, and a bad hand-off shows as a slide rather than a failure.
  There are tests for this.
- **The rig's acts run back to back.** `hero.ts` computes their start times rather than listing
  them; a gap would show as the rig sliding with its wheels still, and an overlap is rejected
  outright by the compositor.
- **Two acts may not move the same part at once.** Touching end to end is the hand-off.
- **Tokens park off-frame at both ends of a flight**, so nothing pops into existence when the
  loop cuts, and nothing lingers at a node afterwards.
- **A corner snaps.** The rig's two orientations name the same box corners in different places,
  so a slow blend between them turns the solid inside out.
