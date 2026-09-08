/**
 * The keeper's day, on one clock. Sixty seconds from dawn to dawn.
 *
 * Every start time lives here so the acts, the ambient loops and the camera script read the
 * same numbers. The misfits are broken from the top of the loop until the keeper reaches each
 * one, so the order below is also the order the keeper walks the island.
 */

export const LOOP = 60000

export const START = {
  dawn: 0,
  mainframe: 8500,
  spreadsheet: 14000,
  fax: 20000,
  cron: 28000,
  chatbot: 34500,
  dusk: 41000,
  landing: 46000,
  boat: 47000,
  night: 49000,
  reset: 56000,
} as const

/** Where each misfit is put right — the ambient "broken" loops run until these. */
export const FIXED = {
  mainframe: 11000,
  spreadsheet: 19300,
  fax: 25000,
  cron: 32600,
  chatbot: 39600,
} as const

/** The nightfall overlay: when it starts to darken, when it is darkest, when dawn lifts it. */
export const NIGHT = { from: 43000, deep: 52000, lift: 57600, opacity: 0.58 } as const

/** The keeper walks about this fast, in grid units per second. */
export const PACE = 2.2
