import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    // Resolve workspace packages from source so tests never need a prior build step.
    // More-specific paths must come before less-specific ones.
    alias: [
      {
        find: '@ethical-shopper/core/fakes',
        replacement: resolve(__dirname, '../../packages/core/src/fakes/index.ts'),
      },
      {
        find: '@ethical-shopper/core',
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    ],
  },
  test: {
    environment: 'node',
  },
})
