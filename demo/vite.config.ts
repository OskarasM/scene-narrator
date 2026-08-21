import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The demo builds the library from source rather than from a published tarball, so a change
// to src is visible in the demo immediately and the deployed demo always matches the commit
// it was built from.
const src = (p: string) => fileURLToPath(new URL('../src/' + p, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@oskarasm/scene-narrator/react': src('react.tsx'),
      '@oskarasm/scene-narrator': src('index.ts'),
    },
  },
})
