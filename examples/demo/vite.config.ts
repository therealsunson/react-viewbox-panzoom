import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The demo imports the library straight from source (../../src) via this alias,
// so it always reflects the latest code with no build step in between.
export default defineConfig({
  base: '/react-viewbox-panzoom/', // GitHub Pages project path
  plugins: [react()],
  resolve: {
    alias: {
      'react-viewbox-panzoom': fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['../..'] },
  },
})
