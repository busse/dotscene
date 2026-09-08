/**
 * The island put back for the next lap, under the deepest dark and while the camera is on
 * the lamp: the mainframe back on its corners at the dock, the sheets teetering again, the
 * drum gone, the cron job pacing again without its flag. The keeper walked to the hammock
 * and is asleep in it already.
 *
 * Everything that jumps here is first held where it was, an instant before. A reset is a
 * keyframe like any other, and without the hold a part would slide toward it for as long as
 * it has been still.
 */

import { at as project } from '../../edi/projection.ts'
import { defineAct, holdAt, stateBefore } from './act.ts'
import { depthOf, vec } from './kit.ts'
import { CRON, MAINFRAME, SPREADSHEET } from '../world.ts'
import { START } from '../timing.ts'
import { act as mainframeAct } from './a01-mainframe.ts'
import { act as spreadsheetAct } from './a02-spreadsheet.ts'
import { act as cronAct } from './a04-cron.ts'

const T = START.reset
const HOLD = holdAt(T)

const held = (act: { beats: readonly import('dotscene').Beat[] }, ...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, stateBefore(act.beats, id, HOLD)]))

export const act = defineAct('islandReset', 'The island put back for the night', [
  { at: HOLD, parts: { ...held(mainframeAct.act, 'mainframe'), ...held(spreadsheetAct.act, 'spreadsheet', 'drum'), ...held(cronAct.act, 'cron', 'cronFlag') } },
  // The jetty is in the lamp shot, so the mainframe fades out where it stands, jumps, and fades in at its root.
  { at: T + 450, parts: { mainframe: { opacity: 0 } }, easing: 'easeIn' },
  { at: T + 460, parts: { mainframe: { at: vec(project([MAINFRAME.home[0], MAINFRAME.home[1], 0])), pose: 'square', rotate: 0, opacity: 0, depth: depthOf(MAINFRAME.home) + 0.5 } } },
  { at: T + 1100, parts: { mainframe: { opacity: 1 } }, easing: 'easeOut' },
  { at: T + 25, parts: { spreadsheet: { at: vec(project([SPREADSHEET.home[0], SPREADSHEET.home[1], 0])), pose: 'rest', depth: depthOf(SPREADSHEET.home) + 0.6 }, drum: { at: vec(project([SPREADSHEET.drumFrom[0], SPREADSHEET.drumFrom[1], 0])), opacity: 0, depth: depthOf(SPREADSHEET.drumFrom) + 0.5 } } },
  { at: T + 35, parts: { cron: { at: vec(project([CRON.a[0], CRON.a[1], 0])), pose: 'rest', flipX: false, depth: depthOf(CRON.a) + 0.5 }, cronFlag: { opacity: 0 } } },
])
