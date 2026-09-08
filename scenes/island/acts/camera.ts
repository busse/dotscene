/**
 * The camera script for the island. The page lays its copy over the left of the frame, so
 * every shot frames its subject about seven tenths of the way across, where the drawing is
 * clear. The camera never rests: a hold is a slow push. It follows the keeper from misfit to
 * misfit, tilts up to the lamp at dusk, opens for the landing and the boat, and comes home
 * to the establishing shot.
 */

import type { Vec2 } from 'dotscene'
import { between, camera, look, type Shot } from './kit.ts'
import { CHATBOT, CRON, DOCK_TIP, FAX, HAMMOCK, HUT, LAMP, MAINFRAME, PLANE, SPREADSHEET, WIDE, WORK } from '../world.ts'
import { FIXED, LOOP, START } from '../timing.ts'

/** Centre for a shot that puts `subject` about 72% across the frame, clear of the copy. */
const framed = (subject: Vec2, width: number, dy = 0): Vec2 => [subject[0] - width * 0.22, subject[1] + dy]

const hammock = look(HAMMOCK.cell, 2)
const dockSide = between(look(MAINFRAME.home, 1), look(WORK.mainframe, 1))
const stack = between(look(SPREADSHEET.home, 1), look(WORK.spreadsheet, 1))
const faxSide = between(look(FAX.cell, 1), look(WORK.fax, 1))
const beach = between(look(CRON.a, 1), look(CRON.b, 1))
const shade = look(CRON.rest, 1)
const screen = between(look(CHATBOT.cell, 1.2), look(WORK.chatbot, 1))
const tower = LAMP.at
const towerFoot = look(HUT.lighthouseDoor, 1)
const runway = between(look(PLANE.touchdown, 0.5), look(PLANE.park, 0.5))
const harbour = between(look(DOCK_TIP, 0), tower, 0.45)

const shot = (at: number, subject: Vec2, width: number, dy = 0): Shot => ({ at, to: framed(subject, width, dy), width, easing: 'easeInOut' })

const shots: Shot[] = [
  { at: 0, to: WIDE.at, width: WIDE.width },
  // Dawn: push in on the hammock as the keeper sits up, and stay for the coffee.
  shot(2400, hammock, 200, -4),
  shot(5200, hammock, 215, -6),
  // Down to the dock with the keeper.
  shot(START.mainframe + 800, dockSide, 170, -8),
  shot(FIXED.mainframe + 2600, dockSide, 200, -12),
  // Up to the stack of sheets.
  shot(START.spreadsheet + 2600, stack, 175, -6),
  shot(FIXED.spreadsheet + 600, stack, 190, -10),
  // The fax on the beach; then tilt up along the wire to the lamp.
  shot(START.fax + 2600, faxSide, 180, -4),
  shot(FIXED.fax + 1200, between(faxSide, tower, 0.45), 260),
  shot(FIXED.fax + 3400, between(faxSide, tower, 0.55), 250),
  // Along the beach with the cron job, then into the shade.
  shot(START.cron + 2600, beach, 200, -6),
  shot(FIXED.cron + 2600, between(beach, shade, 0.6), 190, -6),
  // Close on the chatbot's screen, with room above for what it says.
  shot(START.chatbot + 2200, screen, 160, -12),
  shot(FIXED.chatbot + 1800, screen, 175, -14),
  // Dusk: the keeper at the tower's foot, then up to the lamp as it lights.
  shot(START.dusk + 3200, between(towerFoot, tower, 0.35), 230),
  shot(START.dusk + 5200, between(towerFoot, tower, 0.6), 210),
  // The landing: open up on the runway, the tower and its beam.
  shot(START.landing + 2400, between(runway, tower, 0.3), 340, 4),
  // The boat: the harbour under the lamp, then a slow push while it ties up.
  shot(START.boat + 6000, harbour, 400, 20),
  shot(START.boat + 7600, harbour, 380, 16),
  // Up to the lamp, and stay with the beam while the island is put back below.
  shot(START.reset - 600, tower, 200, -14),
  shot(START.reset + 1800, tower, 220, -14),
  { at: LOOP, to: WIDE.at, width: WIDE.width, easing: 'easeInOut' },
]

export const cameraScript = { name: 'islandCamera', beats: camera(shots) }
