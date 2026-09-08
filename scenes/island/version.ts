/**
 * The version every island scene reports. `build` archives each versioned scene under
 * `docs/versions/` and never overwrites one, so a revision can be judged against the last.
 *
 * - v1 — the first cut: five misfits put right in a day, dusk, a landing, a boat, night.
 * - v2 — after UAT: palms with leaf fronds instead of stick-insect legs; the keeper sits up in
 *   the hammock rather than swinging upright, has coffee before work, and carries the mug all
 *   day with a sip at every station; the hammock is slung between the palms with a near rim.
 * - v3 — after the second UAT: the dock starts on the sand; the keeper's stations are on dry
 *   land; the mug lives on a stump by the hammock overnight, is reached for at dawn and set
 *   down at dusk, and hangs from its handle; the cron job is a tall cabinet with a clock and
 *   a real beard; the chatbot's screen is portrait; the spreadsheet has figures and a selected
 *   cell; the crab has pincers and the turtle a shell; the banner reads 404.
 * - v4 — after the third UAT: the dock and the mainframe move to the far shore between the hut
 *   and the tower, away from the beach where the cron job and the crab are; the boat comes in
 *   along the far sea; the mug and its stump paint in front of the hammock; the keeper comes
 *   back out of the hut, sets the mug down and sleeps in the hammock on camera, so the reset
 *   moves only the misfits; the sun and moon pass behind the island.
 * - v5 — v4 moved the wrong thing. The jetty and the mainframe are back on the front shore as
 *   in v3; it is the cron job that paces the far shore now, between the hut and the tower.
 * - v6 — bedtime without the glitch: the hammock hangs a clear cell in front of the hut rather
 *   than against its door, and the evening walks go round the hut's corner and round the palm
 *   at the hammock's end instead of through the walls and the canvas.
 */
export const ISLAND_VERSION = 6
