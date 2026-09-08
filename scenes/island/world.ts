/**
 * The Island of Misfit Applications: where everything stands.
 *
 * A tropical island in the right third of the frame, sea to its left under the page's copy,
 * so all of the day's action happens where it can be seen. The island figure is authored in
 * (u, v) — u across the screen, v into it — and placed once; every other position is given
 * relative to the island in the same terms and converted to a grid cell here, so moving the
 * island moves the day with it.
 */

import type { Part, Vec2, Vec3 } from 'dotscene'
import { at as project, cell } from '../edi/projection.ts'
import { keeper, mug, steam } from './figures/keeper.ts'
import { ripples } from '../edi/figures/sky.ts'
import { BEACH, HAMMOCK_SPOT, POINT, bush, flowers, island, palm, palmSmall, rocks } from './figures/terrain.ts'
import { DOCK_END, HAMMOCK_LIE, HUT_CHIMNEY, HUT_DOOR, LAMP as LAMP_LOCAL, LIGHTHOUSE_DOOR, STUMP_TOP, beam, dock, hammock, hammockRim, hut, lamp, lighthouse, signpost, stump } from './figures/structures.ts'
import { CHATBOT_MOUTH, CHATBOT_PORT, CRON_BADGE, FAX_SLOT, MAINFRAME_PORT, chatbot, cron, drum, fax, mainframe, spreadsheet } from './figures/misfits.ts'
import { BANNER_W, BOAT_LANTERN, PLANE_TAIL, banner, boat, crab, moon, plane, stars, sun, turtle, wake } from './figures/traffic.ts'
import { nightfall } from './figures/fixtures.ts'
import { BEHIND, depthOf, KEEPER_SCALE, MUG_SCALE, feetAt, lyingAt, SKY, type Cell } from './acts/kit.ts'

const v3 = (c: Cell, z = 0): Vec3 => [c[0], c[1], z]
const add = (a: Cell, b: Cell): Cell => [a[0] + b[0], a[1] + b[1]]

// ---------------------------------------------------------------------------------------------
// The frame

export const ASPECT = 2.4
/** The establishing shot: sea on the left, the island on the right. */
export const WIDE = { at: [90, -30] as Vec2, width: 600 }

// ---------------------------------------------------------------------------------------------
// Where the island is

/** The island's origin, as a grid cell. */
const ORIGIN: Cell = cell(22, -6)

/** A place on the island, given in the island's own (u, v), as a grid cell. */
export const isl = (u: number, v: number): Cell => add(ORIGIN, cell(u, v))

// ---------------------------------------------------------------------------------------------
// Places

const HUT_AT = isl(5, -4)
const LIGHTHOUSE_AT = isl(POINT[0], POINT[1])
const HAMMOCK_AT = isl(HAMMOCK_SPOT[0], HAMMOCK_SPOT[1])
/** The root a cell inside the beach's rim, so the jetty starts on sand and ends over water. */
const DOCK_AT = isl(5, 7.6)
/**
 * The cron job paces the far shore, between the hut and the tower — the back of the scene,
 * away from the jetty and the crab, so the mainframe's fixing has the front beach to itself.
 * Both ends are on the sand band there, which is about two cells wide.
 */
const CRON_A = isl(7, -7)
const CRON_B = isl(12, -5)
/** The dock lies along +y here, so its seaward end is that far down the y axis. */
export const DOCK_TIP = add(DOCK_AT, [0, DOCK_END[0]])

export const HAMMOCK = {
  cell: add(HAMMOCK_AT, [HAMMOCK_LIE[0], HAMMOCK_LIE[1]]),
  z: HAMMOCK_LIE[2],
  /** Beside it, on the grass. */
  stand: add(HAMMOCK_AT, [0.2, 1.3]),
}

/** The stump at the hammock's head end, on the near side, where the mug lives overnight. */
const STUMP_AT = add(HAMMOCK_AT, [-0.35, 0.6])
export const STUMP = {
  cell: STUMP_AT,
  /** Where the keeper stands to set the mug down. */
  stand: add(HAMMOCK_AT, [-0.35, 1.5]),
  top: project([STUMP_AT[0], STUMP_AT[1], STUMP_TOP[2]]) as Vec2,
}
/** The mug resting on the stump: its handle origin offset so the cup sits centred on the top. */
export const MUG_ON_STUMP = {
  at: [STUMP.top[0] + 8 * MUG_SCALE, STUMP.top[1] - 6 * MUG_SCALE] as Vec2,
  depth: depthOf(HAMMOCK_AT) + 0.8,
}

export const HUT = {
  door: add(HUT_AT, HUT_DOOR),
  lighthouseDoor: add(LIGHTHOUSE_AT, LIGHTHOUSE_DOOR),
  window: project([HUT_AT[0] + 1.02, HUT_AT[1], 0.9]),
  chimney: project([HUT_AT[0] + HUT_CHIMNEY[0], HUT_AT[1] + HUT_CHIMNEY[1], HUT_CHIMNEY[2]]),
  depth: depthOf(HUT_AT),
}

export const LAMP = {
  cell: LIGHTHOUSE_AT,
  at: project([LIGHTHOUSE_AT[0] + LAMP_LOCAL[0], LIGHTHOUSE_AT[1] + LAMP_LOCAL[1], LAMP_LOCAL[2]]),
}

const MAINFRAME_HOME = add(DOCK_AT, [0, 0.5])
const MAINFRAME_ROLLED = add(DOCK_AT, [0, 2.7])
export const MAINFRAME = {
  home: MAINFRAME_HOME,
  mid: add(DOCK_AT, [0, 1.6]),
  rolled: MAINFRAME_ROLLED,
  /** The socket on its side, where it stands after rolling. */
  portRolled: project([MAINFRAME_ROLLED[0] + MAINFRAME_PORT[0], MAINFRAME_ROLLED[1] + MAINFRAME_PORT[1], MAINFRAME_PORT[2] + 0.35]),
}

export const SPREADSHEET = {
  home: isl(8, 1.5),
  drumFrom: isl(7.5, -2),
}

const FAX_AT = isl(10.5, 6)
export const FAX = {
  cell: FAX_AT,
  slot: project([FAX_AT[0] + FAX_SLOT[0], FAX_AT[1] + FAX_SLOT[1], FAX_SLOT[2] + 0.3]),
  /** Where its pages hit the water. */
  splash: project(v3(isl(12.5, 10.5), 0)),
}

export const CRON = {
  a: CRON_A,
  b: CRON_B,
  /** In the shade of the small palm on the point. */
  rest: isl(10.5, -5.8),
  badge: CRON_BADGE,
}

const CHATBOT_AT = isl(12.5, 2.2)
export const CHATBOT = {
  cell: CHATBOT_AT,
  mouth: project([CHATBOT_AT[0] + CHATBOT_MOUTH[0], CHATBOT_AT[1] + CHATBOT_MOUTH[1], CHATBOT_MOUTH[2]]),
  port: project([CHATBOT_AT[0] + CHATBOT_PORT[0], CHATBOT_AT[1] + CHATBOT_PORT[1], CHATBOT_PORT[2]]),
}

/** Where the keeper stands to work on each of them. */
export const WORK = {
  /** Beside the mainframe on its near side, so the keeper stands in front of it. */
  mainframe: add(DOCK_AT, [1.2, -1.6]),
  spreadsheet: isl(6.3, 2.4),
  fax: isl(8.6, 6.8),
  /** In front and to the left of where the job stops, clear of the tower, facing it. */
  cron: add(CRON_B, [0.5, 1.4]),
  chatbot: isl(11, 3.6),
}

/** The plane's run: a line along +x through the island, off the frame at both ends. */
const RUNWAY_Y = 0.5
export const PLANE = {
  a: add(ORIGIN, [-48, 0]),
  b: add(ORIGIN, [36, 0]),
  touchdown: add(ORIGIN, [-1.2, RUNWAY_Y]),
  roll: add(ORIGIN, [1.6, RUNWAY_Y]),
  park: add(ORIGIN, [3.4, RUNWAY_Y]),
  /** The banner's left edge sits at the tail; trailing means to the left of a +x plane. */
  bannerOffset: [project(PLANE_TAIL)[0] - project([0, 0, 0])[0] - BANNER_W, project(PLANE_TAIL)[1] - project([0, 0, 0])[1]] as Vec2,
  bannerOffsetBack: [project([-PLANE_TAIL[0], PLANE_TAIL[1], PLANE_TAIL[2]])[0] - project([0, 0, 0])[0], project([-PLANE_TAIL[0], PLANE_TAIL[1], PLANE_TAIL[2]])[1] - project([0, 0, 0])[1]] as Vec2,
}

/** The boat comes in from the open sea at the lower right, bow first, and moors at the tip. */
/** The launch comes in along −x from the sea at the lower right and ties up beside the jetty's end. */
export const BOAT = {
  from: add(DOCK_TIP, [24, 1.1]),
  docked: add(DOCK_TIP, [1.4, 1.1]),
  pose: 'xr',
  lantern: [-BOAT_LANTERN[0], BOAT_LANTERN[1], BOAT_LANTERN[2]] as Vec3,
  wakeOffset: [2.1, 0] as Cell,
  wakePoses: ['ra', 'rb', 'rc'] as const,
}

/** The sun's day and the moon's night, in scene units: over the sea, round to the point. */
export const SUN = { rise: [360, 10] as Vec2, set: [-160, -40] as Vec2, height: 120 }
export const MOON = { rise: [360, -20] as Vec2, set: [-100, -120] as Vec2, height: 70 }
export const STARS_AT: Vec2 = [200, -145]

// ---------------------------------------------------------------------------------------------
// The stage

const FAR = -1000

const placed = (id: string, figure: Part['figure'], c: Cell, extra: Partial<Part> & { z?: number } = {}): Part => {
  const { z = 0, ...rest } = extra
  return { id, figure, at: project(v3(c, z)), depth: depthOf(c), ...rest }
}

const PALMS: readonly [Cell, boolean][] = [
  [isl(0.5, -4.5), false],
  [isl(3.5, -1.5), false],
  [isl(-3, -6.5), false],
  [isl(9.3, 3.6), false],
  [isl(12.6, -6.2), true],
  [isl(-6.5, 1.2), true],
  [isl(-9, -3), false],
]

export const stageParts: readonly Part[] = [
  { id: 'island', figure: island, at: project(v3(ORIGIN)), depth: FAR + 1 },
  placed('rocks', rocks, LIGHTHOUSE_AT, { depth: depthOf(LIGHTHOUSE_AT) - 0.6 }),
  placed('lighthouse', lighthouse, LIGHTHOUSE_AT),
  placed('hut', hut, HUT_AT),
  placed('hammock', hammock, HAMMOCK_AT, { depth: depthOf(HAMMOCK_AT) + 0.2 }),
  // In front of the keeper (+0.42) and the mug (+0.47), so a body lies in it, not on it.
  placed('hammockRim', hammockRim, HAMMOCK_AT, { depth: depthOf(HAMMOCK_AT) + 0.6 }),
  // In front of the hammock's rim (+0.6), so the mug on it is never threaded through the canvas.
  placed('stump', stump, STUMP_AT, { depth: depthOf(HAMMOCK_AT) + 0.7 }),
  placed('dock', dock, DOCK_AT, { pose: 'south', depth: depthOf(DOCK_AT) - 0.3 }),
  placed('signpost', signpost, isl(11.5, 6.6)),
  ...PALMS.map(([c, small], i) => placed(`palm${i}`, small ? palmSmall : palm, c, { pose: 'rest' })),
  placed('bush0', bush, isl(7.6, -1)),
  placed('bush1', flowers, isl(0.2, 2.2)),
  placed('bush2', bush, isl(-7.5, 3)),
  placed('bush3', flowers, isl(-2, 5)),
]

// ---------------------------------------------------------------------------------------------
// The cast that moves

export const cast = (): Part[] => [
  { id: 'nightfall', figure: nightfall, depth: SKY + 500, opacity: 0 },
  { id: 'keeper', figure: keeper, ...lyingAt(HAMMOCK.cell, HAMMOCK.z).keeper, scale: KEEPER_SCALE },
  { id: 'mug', figure: mug, ...MUG_ON_STUMP, scale: MUG_SCALE },
  { id: 'steam', figure: steam, at: MUG_ON_STUMP.at, scale: MUG_SCALE, pose: 'a', opacity: 0, depth: MUG_ON_STUMP.depth + 0.01 },
  placed('mainframe', mainframe, MAINFRAME_HOME, { pose: 'square', depth: depthOf(MAINFRAME_HOME) + 0.5, z: 0.35 }),
  placed('spreadsheet', spreadsheet, SPREADSHEET.home, { pose: 'rest', depth: depthOf(SPREADSHEET.home) + 0.6 }),
  placed('drum', drum, SPREADSHEET.drumFrom, { opacity: 0, depth: depthOf(SPREADSHEET.drumFrom) + 0.5 }),
  placed('fax', fax, FAX_AT, { pose: 'rest', depth: depthOf(FAX_AT) + 0.5 }),
  placed('cron', cron, CRON.a, { pose: 'rest', depth: depthOf(CRON.a) + 0.5 }),
  placed('chatbot', chatbot, CHATBOT_AT, { pose: 'rest', depth: depthOf(CHATBOT_AT) + 0.5 }),
  { id: 'lamp', figure: lamp, at: LAMP.at, opacity: 0, depth: SKY + 600 },
  { id: 'beam', figure: beam, at: LAMP.at, opacity: 0, rotate: 200, depth: SKY + 590 },
  placed('plane', plane, PLANE.a, { pose: 'x', z: 8.5, depth: SKY + 2 }),
  { id: 'banner', figure: banner, at: [project(v3(PLANE.a, 8.5))[0] + PLANE.bannerOffset[0], project(v3(PLANE.a, 8.5))[1] + PLANE.bannerOffset[1]], pose: 'a', depth: SKY + 1 },
  placed('boat', boat, BOAT.from, { pose: BOAT.pose, opacity: 0, depth: depthOf(BOAT.from) + 0.4 }),
  { id: 'boatLantern', figure: lamp, at: project([BOAT.from[0] + BOAT.lantern[0], BOAT.from[1] + BOAT.lantern[1], BOAT.lantern[2]]), opacity: 0, scale: 0.5, depth: SKY + 601 },
  placed('wake', wake, add(BOAT.from, BOAT.wakeOffset), { pose: BOAT.wakePoses[0], opacity: 0, depth: depthOf(BOAT.from) + 0.3 }),
  { id: 'sun', figure: sun, at: SUN.rise, opacity: 0, depth: BEHIND },
  { id: 'moon', figure: moon, at: MOON.rise, opacity: 0, depth: BEHIND },
  { id: 'stars', figure: stars, at: STARS_AT, pose: 'a', opacity: 0, depth: SKY + 605 },
  placed('crab', crab, isl(4.5, 6.4), { pose: 'a', scale: 0.75, depth: depthOf(isl(4.5, 6.4)) + 0.2 }),
  placed('turtle', turtle, isl(9, 12), { pose: 'a', scale: 1.2, depth: FAR + 6 }),
  ...[isl(-13, 6), isl(-4, 11), isl(16.5, 4), isl(10, -12)].map((c, i) => ({ id: `waves${i}`, figure: ripples, at: project(v3(c)), pose: 'a', scale: 0.8, opacity: 0, depth: FAR + 2 + i * 0.01 })),
]

export { BEACH }
