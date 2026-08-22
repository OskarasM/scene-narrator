import { defineConfig } from '@playwright/test'
import { screenReaderConfig } from '@guidepup/playwright'

// Real NVDA driving a real Chromium. Headed by definition, one worker by definition: there
// is one screen reader on the machine and it reads whichever window has focus.
//
// This suite is not part of `npm test` and does not run in CI. It needs Windows, an NVDA
// installation, and an unattended machine that nothing else is going to steal focus from.
// Its output is committed to NVDA.md so that the result is reviewable without rerunning it.
export default defineConfig({
  ...screenReaderConfig,
  testDir: './nvda',
  timeout: 5 * 60 * 1000,
  retries: 0,
  reporter: [['list']],
  use: {
    ...screenReaderConfig.use,
    browserName: 'chromium',
    launchOptions: {
      // The same flag the whole benchmark hinges on. With NVDA genuinely attached it is
      // redundant, and setting it anyway keeps this run comparable to the benchmark.
      args: ['--force-renderer-accessibility'],
    },
  },
})
