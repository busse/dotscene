/**
 * The version of the EDI scenes' output.
 *
 * `build` archives every versioned scene under `docs/versions/` as a frozen, self-contained
 * page and never overwrites one, so a revision can be judged against the last. Bump this when
 * the world, the kit or the arrangement changes; give an act its own `version` in `defineAct`
 * when only that act moves on.
 *
 * - v1 — the first cinematic cut.
 * - v2 — vehicles turn at the corner rather than one corner late; right-hand lanes; a parked
 *   trailer paints in front of a rig docked behind it; the consignee's doors sit a forklift's
 *   reach apart so its forklift drives straight out.
 */
export const EDI_VERSION = 2
