/**
 * The site's colour system, for card art.
 *
 * Card art sits inline in a themed page, so ink is `currentColor` and follows the card. The
 * blue and the fills are literal tokens from `../cbdot/_sass/_tokens.scss`, with the dark
 * theme's values riding along as nested overrides in the three states a themed page has.
 *
 * The rules that matter here: npb-300 is never a meaningful stroke on paper, so a stroke that
 * means something is npb-700 on light and npb-300 on dark; a fill is npb-100 on light and the
 * dark theme's accent surface on dark.
 */

export const VIEWBOX = [0, 0, 290, 100] as const

const light = {
  blue: '#0b6580', // npb-700
  blueFill: '#c2e8f3', // npb-200 — one step past the card's hover wash, so it survives it
  blueSoft: '#a4dded', // npb-300, a surface
  neutralFill: '#f2f1ec', // tan-100
  warmFill: '#e6e4dd', // tan-200
  muted: '#656c6f', // gray-600
}

const dark = {
  blue: '#a4dded', // npb-300
  blueFill: '#075166', // npb-800 — past the dark hover wash for the same reason
  blueSoft: '#1b7f9f', // npb-600
  neutralFill: '#1e2124', // surface-sunk
  warmFill: '#2a2d30',
  muted: '#8e9598', // ink-muted
}

type Tokens = typeof light

const roles = (t: Tokens): string =>
  [
    `.ds-face{fill:${t.neutralFill}}`,
    `.ds-face--blue{fill:${t.blueFill}}`,
    `.ds-face--soft{fill:${t.blueSoft}}`,
    `.ds-face--warm{fill:${t.warmFill}}`,
    `.ds-line--blue{stroke:${t.blue}}`,
    `.ds-dot--blue{fill:${t.blue}}`,
    `.ds-line--soft{stroke:${t.blue};stroke-opacity:.45}`,
    `.ds-dot--soft{fill:${t.blue};fill-opacity:.55}`,
    `.ds-line--muted{stroke:${t.muted}}`,
    `.ds-dot--muted{fill:${t.muted}}`,
    `.ds-line--hair{stroke:${t.muted};stroke-opacity:.5;stroke-width:.6}`,
    `.ds-dot--hair{fill:${t.muted};fill-opacity:.5;r:1.1}`,
  ].join('')

/** Both themes in one block. Selectors are nested, so they stay scoped to this scene. */
export const themed = (extra = ''): string =>
  [
    roles(light),
    extra,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) &{${roles(dark)}}}`,
    `:root[data-theme="dark"] &{${roles(dark)}}`,
  ].join('')
