import { defineConfig, devices } from '@playwright/test'

// The site suite, against the real demo in a real browser. Separate from the
// repository root config, which drives NVDA and cannot run in CI: that one
// needs Windows, an NVDA install and an unattended machine. This one needs
// nothing but a browser, which is why it gates every pull request.
const testPort = Number.parseInt(process.env.SCENE_NARRATOR_TEST_PORT ?? '4175', 10)
const testBaseUrl = `http://127.0.0.1:${testPort}`

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: testBaseUrl,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${testPort} --strictPort`,
    url: testBaseUrl,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
