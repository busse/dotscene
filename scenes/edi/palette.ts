/**
 * The site's colour system, mapped onto what this scene contains.
 *
 * Non-photo blue was the pencil a draughtsman laid out with, because the reproduction camera
 * could not see it: structure in blue, content inked on top. Here that division is the
 * subject rather than a convention — **the freight is inked and the data is blue**. Docks,
 * terminals, trailers and the truck are things; the network above them, and everything
 * travelling it, is information about things.
 *
 * Every value is from the supplied ramps. Contrast figures are the measured ones: gray-900 on
 * paper is 15.71:1, npb-300 is 1.42:1 and so is never asked to carry meaning on a light
 * ground — it is the faint construction grid, which is exactly what it was for.
 */

export interface Roles {
  readonly ink: string
  readonly lot: string
  readonly ground: string
  readonly road: string
  readonly net: string
  readonly node: string
  readonly faces: {
    readonly roof: string
    readonly east: string
    readonly south: string
    readonly apron: string
  }
}

/** gray-050 paper, gray-900 ink, blues stepped darker as they take on meaning. */
export const paper: Roles = {
  ink: '#1d2021',
  lot: '#a4dded',
  ground: '#1b7f9f',
  road: '#0b6580',
  net: '#1b7f9f',
  node: '#0b6580',
  faces: { roof: '#ffffff', east: '#f2f1ec', south: '#e6e4dd', apron: '#fbfaf7' },
}

/** Roles invert on dark: npb-300 is the legible blue at 11.99:1, and ink turns pale. */
export const night: Roles = {
  ink: '#edebe6',
  lot: '#33383b',
  ground: '#3d9fbf',
  road: '#a4dded',
  net: '#3d9fbf',
  node: '#a4dded',
  faces: { roof: '#3b4042', east: '#262a2c', south: '#1d2021', apron: '#16181a' },
}

export const GROUND_PAPER = '#fbfaf7'
export const GROUND_NIGHT = '#16181a'

/** The ground each palette paints, as a rule the dark override can restate. */
const groundOf = (r: Roles) => (r === night ? GROUND_NIGHT : GROUND_PAPER)

/** The scene's own stylesheet: literal hex, because a standalone file inherits nothing. */
export const css = (r: Roles): string =>
  [
    `.ds-face--roof{fill:${r.faces.roof}}`,
    `.ds-face--east{fill:${r.faces.east}}`,
    `.ds-face--south{fill:${r.faces.south}}`,
    `.ds-face--apron{fill:${r.faces.apron}}`,
    `.ds-line{stroke:${r.ink}}`,
    `.ds-dot{fill:${r.ink}}`,
    `.ds-line--lot{stroke:${r.lot}}`,
    `.ds-dot--lot{fill:${r.lot};r:.5}`,
    `.ds-line--ground{stroke:${r.ground}}`,
    `.ds-dot--ground{fill:${r.ground};r:.7}`,
    `.ds-line--road{stroke:${r.road};stroke-width:.85}`,
    `.ds-dot--road{fill:${r.road};r:.9}`,
    `.ds-line--net{stroke:${r.net};stroke-width:.4;stroke-opacity:.75}`,
    `.ds-dot--net{fill:${r.net};r:.6}`,
    `.ds-line--node{stroke:${r.node};stroke-width:.7}`,
    `.ds-dot--node{fill:${r.node};r:1.2}`,
    `.ds-line--vehicle{stroke:${r.ink};stroke-width:.4}`,
    `.ds-dot--vehicle{fill:${r.ink};r:.55}`,
    `.ds-line--token{stroke:${r.node};stroke-width:.4}`,
    `.ds-dot--token{fill:${r.node};r:.5}`,
    `.ds-line--tether{stroke:${r.net};stroke-width:.35;stroke-opacity:.4}`,
    `.ds-dot--tether{fill:${r.net};r:.35;fill-opacity:.5}`,
  ].join('')

/**
 * Both palettes in one block, for a scene that will sit inline on a themed page.
 *
 * A standalone `.svg` or an `<img>` still wants two files, which is why `css` exists on its
 * own — nothing outside the file can reach in and restyle it. But a block pasted into a page
 * with a theme toggle is a different problem: shipping both variants doubles a payload that
 * is mostly geometry, and the site can only pick one at build time anyway.
 *
 * So the dark roles ride along as overrides, in the three states a themed page actually has:
 * no stamp and a dark OS, and an explicit stamp either way. Written as nested rules, so they
 * stay scoped to this scene and cannot reach another on the same page.
 */
export const themedCss = (light: Roles, dark: Roles): string => {
  const overrides = `${css(dark)}.ds-bg{fill:${groundOf(dark)}}--ds-face-fill:${groundOf(dark)};`
  return [
    css(light),
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) &{${overrides}}}`,
    `:root[data-theme="dark"] &{${overrides}}`,
  ].join('')
}
