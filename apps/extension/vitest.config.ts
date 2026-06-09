import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  define: {
    // Mirror the Vite define from wxt.config.ts so tests can import analyzeStream.ts
    __API_BASE_URL__: JSON.stringify('http://localhost:3000'),
  },
  resolve: {
    alias: [
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
