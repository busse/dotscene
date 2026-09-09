import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Several tests sample a whole minute-long lap of a hero animation and resolve every part
    // at every stop — tens of seconds of honest geometry, not a hang. Vitest's 5 s default
    // only started applying to synchronous tests in v3, which is why these needed no setting
    // before. Raise it rather than thinning the sampling: the coverage is the point.
    testTimeout: 120_000,
  },
})
