/**
 * The site's colour system, mapped onto what this scene contains.
 *
 * Non-photo blue was the pencil a draughtsman laid out with, because the reproduction camera
 * could not see it: structure in blue, content inked on top. Here that division is the
 * subject — **the freight is inked and the data is blue**. Sheds, yards, trailers and the
 * road are things, drawn in gray. The carrier's office, the bank, the rig's cab and every
 * message in the air are the parties and the traffic of the network, and they wear the blue.
 *
 * The named steps are the supplied ramps: gray-000/050/100/200/700/800/900/950 and
 * npb-300/500/600/700. Two lighter blues and two mid grays are interpolated between those
 * steps where a wall needed a tint the ramp did not name; they are marked, and should be
 * replaced by the ramp's own values if it has them.
 */

/** Three faces of a solid: the roof lightest, then the two walls it stands on. */
export interface Tone {
  readonly roof: string
  readonly east: string
  readonly south: string
}

export interface Roles {
  readonly ink: string
  readonly soft: string
  readonly lot: string
  readonly ground: string
  readonly kerb: string
  readonly net: string
  readonly token: string
  readonly glyph: string
  readonly water: string
  readonly faces: {
    readonly neutral: Tone
    readonly warm: Tone
    readonly blue: Tone
    readonly kraft: Tone
    /** A working shed: white roof, warm walls. */
    readonly shed: Tone
    readonly apron: string
    readonly road: string
    readonly water: string
    readonly bridge: string
    readonly foliage: string
    readonly canopy: string
    readonly door: string
    readonly doorway: string
    readonly flag: string
    readonly smoke: string
    readonly cloud: string
    readonly paper: string
    readonly coin: string
  }
}

// The ramp, by name.
const gray000 = '#ffffff'
const gray050 = '#fbfaf7'
const gray100 = '#f2f1ec'
const gray200 = '#e6e4dd'
const gray300 = '#d5d2c8' // interpolated
const gray400 = '#b9b5a9' // interpolated
const gray700 = '#3b4042'
const gray750 = '#33383b'
const gray800 = '#262a2c'
const gray900 = '#1d2021'
const gray950 = '#16181a'
const npb100 = '#e4f4f9' // interpolated
const npb200 = '#cfeaf4' // interpolated
const npb300 = '#a4dded'
const npb400 = '#70bfd6' // interpolated
const npb500 = '#3d9fbf'
const npb600 = '#1b7f9f'
const npb700 = '#0b6580'

/** gray-050 paper, gray-900 ink, blues stepped darker as they take on meaning. */
export const paper: Roles = {
  ink: gray900,
  soft: gray700,
  lot: npb300,
  ground: npb500,
  kerb: gray700,
  net: npb600,
  token: npb700,
  glyph: npb700,
  water: npb500,
  faces: {
    neutral: { roof: gray000, east: gray100, south: gray200 },
    warm: { roof: gray100, east: gray200, south: gray300 },
    blue: { roof: npb300, east: npb400, south: npb500 },
    kraft: { roof: gray200, east: gray300, south: gray400 },
    shed: { roof: gray000, east: gray200, south: gray300 },
    apron: gray100,
    road: gray200,
    water: npb200,
    bridge: gray100,
    foliage: npb100,
    canopy: npb300,
    door: gray300,
    doorway: gray700,
    flag: npb500,
    smoke: gray100,
    cloud: gray000,
    paper: gray000,
    coin: npb300,
  },
}

/** Roles invert on dark: npb-300 is the legible blue at 11.99:1, and ink turns pale. */
export const night: Roles = {
  ink: '#edebe6',
  soft: '#9a9a93',
  lot: gray750,
  ground: npb500,
  kerb: '#6b6b66',
  net: npb400,
  token: npb300,
  glyph: npb300,
  water: npb400,
  faces: {
    neutral: { roof: gray700, east: gray800, south: gray900 },
    warm: { roof: gray750, east: gray800, south: gray950 },
    blue: { roof: npb500, east: npb600, south: npb700 },
    kraft: { roof: gray750, east: gray800, south: gray900 },
    shed: { roof: gray700, east: gray800, south: gray950 },
    apron: gray900,
    road: gray800,
    water: '#173540',
    bridge: gray800,
    foliage: '#1f3a44',
    canopy: npb600,
    door: gray750,
    doorway: gray950,
    flag: npb400,
    smoke: gray800,
    cloud: gray800,
    paper: gray700,
    coin: npb600,
  },
}

export const GROUND_PAPER = gray050
export const GROUND_NIGHT = gray950

const groundOf = (r: Roles): string => (r === night ? GROUND_NIGHT : GROUND_PAPER)

/**
 * Sizes are written relative to the camera's zoom, so a push-in never fattens a stroke: the
 * runtime writes `--ds-zoom` as the camera moves and every radius here follows it.
 */
const r = (radius: number): string => `r:calc(${radius} * var(--ds-zoom))`
const w = (width: number): string => `stroke-width:calc(${width} * var(--ds-zoom))`

const toneCss = (name: string, tone: Tone): string =>
  [`.ds-face--roof-${name}{fill:${tone.roof}}`, `.ds-face--east-${name}{fill:${tone.east}}`, `.ds-face--south-${name}{fill:${tone.south}}`].join('')

/** The scene's own stylesheet: literal hex, because a standalone file inherits nothing. */
export const css = (p: Roles): string =>
  [
    // Solids.
    `.ds-face--roof{fill:${p.faces.neutral.roof}}`,
    `.ds-face--east{fill:${p.faces.neutral.east}}`,
    `.ds-face--south{fill:${p.faces.neutral.south}}`,
    toneCss('warm', p.faces.warm),
    toneCss('blue', p.faces.blue),
    toneCss('kraft', p.faces.kraft),
    toneCss('shed', p.faces.shed),
    `.ds-face--apron{fill:${p.faces.apron}}`,
    `.ds-face--road{fill:${p.faces.road}}`,
    `.ds-face--water{fill:${p.faces.water}}`,
    `.ds-face--bridge{fill:${p.faces.bridge}}`,
    `.ds-face--foliage{fill:${p.faces.foliage}}`,
    `.ds-face--canopy{fill:${p.faces.canopy}}`,
    `.ds-face--door{fill:${p.faces.door}}`,
    `.ds-face--doorway{fill:${p.faces.doorway}}`,
    `.ds-face--flag{fill:${p.faces.flag}}`,
    `.ds-face--smoke{fill:${p.faces.smoke};fill-opacity:.7}`,
    `.ds-face--cloud{fill:${p.faces.cloud};fill-opacity:.85}`,
    `.ds-face--paper{fill:${p.faces.paper}}`,
    `.ds-face--coin{fill:${p.faces.coin}}`,
    // Ink: everything physical, by default.
    `.ds-line{stroke:${p.ink}}`,
    `.ds-dot{fill:${p.ink}}`,
    `.ds-line--soft{stroke:${p.soft};${w(0.3)};stroke-opacity:.8}`,
    `.ds-dot--soft{fill:${p.soft};${r(0.42)};fill-opacity:.8}`,
    `.ds-line--wheel{stroke:${p.ink};${w(0.7)}}`,
    `.ds-dot--wheel{fill:${p.ink};${r(0.5)}}`,
    `.ds-line--vehicle{stroke:${p.ink};${w(0.42)}}`,
    `.ds-dot--vehicle{fill:${p.ink};${r(0.55)}}`,
    // Ground: the drafting layer, faint.
    `.ds-line--lot{stroke:${p.lot};${w(0.3)}}`,
    `.ds-dot--lot{fill:${p.lot};${r(0.4)}}`,
    `.ds-line--ground{stroke:${p.ground};${w(0.35)};stroke-opacity:.7}`,
    `.ds-dot--ground{fill:${p.ground};${r(0.5)};fill-opacity:.8}`,
    `.ds-line--kerb{stroke:${p.kerb};${w(0.45)};stroke-opacity:.75}`,
    `.ds-dot--kerb{fill:${p.kerb};${r(0.5)};fill-opacity:.75}`,
    `.ds-line--water{stroke:${p.water};${w(0.4)};stroke-opacity:.7}`,
    `.ds-dot--water{fill:${p.water};${r(0.45)};fill-opacity:.7}`,
    `.ds-line--bank{stroke:${p.water};${w(0.4)};stroke-opacity:.6}`,
    `.ds-dot--bank{fill:${p.water};${r(0.45)};fill-opacity:.6}`,
    `.ds-line--foliage{stroke:${p.soft};${w(0.35)}}`,
    `.ds-dot--foliage{fill:${p.soft};${r(0.45)}}`,
    // The network and everything that travels it.
    `.ds-line--net{stroke:${p.net};${w(0.5)}}`,
    `.ds-dot--net{fill:${p.net};${r(0.65)}}`,
    `.ds-line--link{stroke:${p.net};${w(0.3)};stroke-opacity:.28;stroke-dasharray:1.4 2.2}`,
    `.ds-dot--link{fill:${p.net};${r(0.5)};fill-opacity:.4}`,
    `.ds-line--token{stroke:${p.token};${w(0.5)}}`,
    `.ds-dot--token{fill:${p.token};${r(0.6)}}`,
    `.ds-line--glyph{stroke:${p.glyph};${w(0.55)}}`,
    `.ds-dot--glyph{fill:${p.glyph};${r(0.5)}}`,
    `.ds-line--coin{stroke:${p.token};${w(0.5)}}`,
    `.ds-dot--coin{fill:${p.token};${r(0.5)}}`,
    `.ds-line--pulse{stroke:${p.net};${w(0.55)};stroke-opacity:.9}`,
    `.ds-dot--pulse{fill:${p.net};${r(0.55)}}`,
    `.ds-line--bird{stroke:${p.ink};${w(0.45)}}`,
    `.ds-dot--bird{fill:${p.ink};${r(0.45)}}`,
  ].join('')

/**
 * Both palettes in one block, for a scene that will sit inline on a themed page.
 *
 * The dark roles ride along as overrides in the three states a themed page actually has: no
 * stamp and a dark OS, and an explicit stamp either way. Nested rules, so they stay scoped to
 * this scene and cannot reach another on the same page.
 */
export const themedCss = (light: Roles, dark: Roles): string => {
  const overrides = `${css(dark)}.ds-bg{fill:${groundOf(dark)}}--ds-face-fill:${groundOf(dark)};`
  return [
    css(light),
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) &{${overrides}}}`,
    `:root[data-theme="dark"] &{${overrides}}`,
  ].join('')
}
