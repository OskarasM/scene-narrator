import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // jsdom rather than happy-dom: the DOM writer depends on focus, closest() and live
    // region behaviour, and jsdom is the more faithful of the two on focus handling.
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: ['test/setup.ts'],
  },
})
