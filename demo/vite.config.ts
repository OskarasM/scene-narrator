import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The demo builds the library from source rather than from a published tarball, so a change
// to src is visible in the demo immediately and the deployed demo always matches the commit
// it was built from.
const src = (p: string) => fileURLToPath(new URL('../src/' + p, import.meta.url))

// The deployment serves this from the root, which is the default. A host that serves it
// from a subpath instead, such as a project page on a static host, needs the built asset
// URLs to carry that prefix, and sets DEMO_BASE to it. Reading it from the environment
// rather than hardcoding one means the same commit builds correctly for either.
const base = process.env.DEMO_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      'scene-narrator/react': src('react.tsx'),
      'scene-narrator': src('index.ts'),
    },
    // The aliases above point at source that lives outside this package, so its bare
    // `react` and `three` imports resolve against the repository root's node_modules while
    // the demo's own resolve here. Two copies of React means two copies of the hooks
    // dispatcher, and the second one is null: "Cannot read properties of null (reading
    // useEffect)", which renders a blank page and no error visible on it.
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },
})
