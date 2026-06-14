import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  define: {
    // Mirror the Vite defines from wxt.config.ts so tests can import analyzeStream.ts
    __API_BASE_URL__: JSON.stringify('http://localhost:3000'),
    __API_TOKEN__: JSON.stringify(''),
  },
  resolve: {
    // More-specific subpath alias first (see wxt.config.ts).
    alias: [
      {
        find: '@ethical-shopper/core/pageClassifier',
        replacement: resolve(__dirname, '../../packages/core/src/pageClassifier.ts'),
      },
      {
        find: '@ethical-shopper/core',
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
