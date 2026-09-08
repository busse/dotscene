/**
 * The island's colours, from the site's tokens.
 *
 * Sea and sky are the blue family, sand and wood the tans, ink the cool grays. The greens
 * are the meadow's — not from the site's ramps, marked as such in the EDI palette — because
 * a tropical island without green is a sandbar. Roles invert on dark the way the site's own
 * theme does, and nightfall inside the scene is a translucent face laid over everything,
 * which works on either ground.
 */

const gray000 = '#ffffff'
const tan050 = '#fbfaf7'
const tan100 = '#f2f1ec'
const tan200 = '#e6e4dd'
const tan300 = '#dbd9d2'
const tan400 = '#b4b2ab'
const tan500 = '#948c7d'
const tan600 = '#746c5c'
const tan700 = '#574f41'
const tan800 = '#3c362c'
const gray500 = '#878e91'
const gray600 = '#656c6f'
const gray700 = '#3b4042'
const gray800 = '#262a2c'
const gray900 = '#1d2021'
const gray950 = '#16181a'
const npb050 = '#f1fafd'
const npb100 = '#dcf2f9'
const npb200 = '#c2e8f3'
const npb300 = '#a4dded'
const npb400 = '#6fc2dc'
const npb500 = '#3d9fbf'
const npb600 = '#1b7f9f'
const npb700 = '#0b6580'
const npb800 = '#075166'
const npb900 = '#063d4d'
// Not from the ramps: the meadow's greens.
const grass100 = '#e3ecd6'
const grass200 = '#d3e0c1'
const grass300 = '#a9c091'
const grass400 = '#7fa06a'
const grassNight = '#1a2320'
const grassNight200 = '#212c25'
const grassNight300 = '#3c4d3c'
const grassNight400 = '#55704f'

export interface Roles {
  readonly bg: string
  readonly ink: string
  readonly soft: string
  readonly blue: string
  readonly sun: string
  readonly star: string
  readonly sea: string
  readonly sand: string
  readonly wood: string
  readonly metal: string
  readonly foliage: string
  readonly faces: Readonly<Record<string, string>>
  readonly tones: Readonly<Record<string, readonly [string, string, string]>>
}

/** Day on paper: the sea is the page's blue, sand the page's tan. */
export const day: Roles = {
  bg: npb100,
  ink: gray900,
  soft: gray600,
  blue: npb700,
  sun: npb700,
  star: npb500,
  sea: npb500,
  sand: tan500,
  wood: tan700,
  metal: gray600,
  foliage: grass400,
  faces: {
    sea: npb200,
    shallows: npb100,
    sand: tan100,
    grass: grass100,
    patch: grass200,
    rock: tan300,
    foliage: grass200,
    trunk: tan300,
    wood: tan200,
    canvas: tan100,
    lamp: npb300,
    beam: npb300,
    glass: npb100,
    screen: npb100,
    paper: gray000,
    bubble: gray000,
    metal: tan300,
    sail: gray000,
    hull: tan200,
    sun: npb100,
    moon: npb100,
    wing: tan100,
    banner: gray000,
    shell: tan300,
    flag: npb500,
    door: tan300,
    night: gray950,
    coin: npb300,
    smoke: tan100,
    cloud: gray000,
  },
  tones: {
    neutral: [gray000, tan100, tan200],
    warm: [tan100, tan200, tan300],
    blue: [npb300, npb400, npb500],
    kraft: [tan300, tan400, tan500],
    shed: [gray000, tan200, tan300],
  },
}

/** Night on the dark ground: the sea deep, sand dim, blue legible. */
export const dark: Roles = {
  bg: '#0f1d24',
  ink: '#edebe6',
  soft: '#8e9598',
  blue: npb300,
  sun: npb300,
  star: npb200,
  sea: npb400,
  sand: tan500,
  wood: tan500,
  metal: gray500,
  foliage: grassNight400,
  faces: {
    sea: '#103240',
    shallows: '#173f4f',
    sand: tan800,
    grass: grassNight,
    patch: grassNight200,
    rock: gray800,
    foliage: grassNight200,
    trunk: tan800,
    wood: tan700,
    canvas: tan700,
    lamp: npb400,
    beam: npb400,
    glass: npb800,
    screen: npb800,
    paper: gray700,
    bubble: gray700,
    metal: gray700,
    sail: gray700,
    hull: tan800,
    sun: npb500,
    moon: npb200,
    wing: gray700,
    banner: gray700,
    shell: tan700,
    flag: npb400,
    door: tan700,
    night: '#000000',
    coin: npb600,
    smoke: gray800,
    cloud: gray800,
  },
  tones: {
    neutral: [gray700, gray800, gray900],
    warm: [tan700, tan800, gray950],
    blue: [npb500, npb600, npb700],
    kraft: [tan600, tan700, tan800],
    shed: [gray700, gray800, gray950],
  },
}

const r = (radius: number): string => `r:calc(${radius} * var(--ds-zoom))`
const w = (width: number): string => `stroke-width:calc(${width} * var(--ds-zoom))`

const toneCss = (name: string, [roof, east, south]: readonly [string, string, string]): string =>
  name === 'neutral'
    ? `.ds-face--roof{fill:${roof}}.ds-face--east{fill:${east}}.ds-face--south{fill:${south}}`
    : `.ds-face--roof-${name}{fill:${roof}}.ds-face--east-${name}{fill:${east}}.ds-face--south-${name}{fill:${south}}`

const stroke = (kind: string, colour: string, width: number, radius: number, opacity = 1): string =>
  `.ds-line--${kind}{stroke:${colour};${w(width)}${opacity < 1 ? `;stroke-opacity:${opacity}` : ''}}` +
  `.ds-dot--${kind}{fill:${colour};${r(radius)}${opacity < 1 ? `;fill-opacity:${opacity}` : ''}}`

export const css = (p: Roles): string =>
  [
    ...Object.entries(p.tones).map(([name, tone]) => toneCss(name, tone)),
    ...Object.entries(p.faces).map(([kind, fill]) => `.ds-face--${kind}{fill:${fill}}`),
    `.ds-face--beam{fill-opacity:.55}`,
    `.ds-face--shallows{fill-opacity:.7}`,
    `.ds-face--bubble{fill-opacity:.92}`,
    `.ds-face--smoke{fill-opacity:.7}`,
    `.ds-face--cloud{fill-opacity:.85}`,
    `.ds-line{stroke:${p.ink}}`,
    `.ds-dot{fill:${p.ink}}`,
    stroke('soft', p.soft, 0.3, 0.42, 0.8),
    stroke('blue', p.blue, 0.5, 0.6),
    stroke('lamp', p.blue, 0.55, 0.65),
    stroke('sun', p.sun, 0.5, 0.55, 0.85),
    stroke('star', p.star, 0.4, 0.6, 0.9),
    stroke('sea', p.sea, 0.4, 0.45, 0.7),
    stroke('water', p.sea, 0.4, 0.45, 0.7),
    stroke('sand', p.sand, 0.35, 0.45, 0.6),
    stroke('wood', p.wood, 0.4, 0.5, 0.85),
    stroke('metal', p.metal, 0.4, 0.5),
    stroke('foliage', p.foliage, 0.4, 0.45),
    stroke('frond', p.foliage, 0.32, 0.22, 0.9),
    `.ds-face--mug{fill:${p.faces.paper ?? p.bg}}`,
    stroke('mug', p.ink, 0.42, 0.36),
    stroke('steam', p.soft, 0.32, 0.26, 0.75),
    stroke('canvas', p.soft, 0.3, 0.4, 0.7),
    stroke('token', p.blue, 0.5, 0.6),
    stroke('glyph', p.blue, 0.55, 0.5),
    stroke('coin', p.blue, 0.5, 0.5),
    stroke('pulse', p.blue, 0.55, 0.55, 0.9),
    stroke('bird', p.ink, 0.45, 0.45),
    `.ds-line--night,.ds-dot--night{display:none}`,
  ].join('')

/** Both themes in one block, scoped to the scene. */
export const themedCss = (light: Roles, night: Roles): string => {
  const overrides = `${css(night)}.ds-bg{fill:${night.bg}}--ds-face-fill:${night.bg};`
  return [
    css(light),
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) &{${overrides}}}`,
    `:root[data-theme="dark"] &{${overrides}}`,
  ].join('')
}
