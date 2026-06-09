import { defineConfig } from 'wxt'
import { fileURLToPath } from 'url'
import { resolve } from 'path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  manifest: {
    name: 'Ethical Shopper',
    description: 'Know the ethics of the companies you buy from, before you check out.',
    version: '0.1.0',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['<all_urls>'],
  },

  // Inject API base URL at build time.
  // In production this is the Vercel deployment URL.
  // In dev: set API_BASE_URL env var or it defaults to localhost.
  vite: () => ({
    define: {
      __API_BASE_URL__: JSON.stringify(
        process.env['API_BASE_URL'] ?? 'https://ethical-shopper.vercel.app',
      ),
    },
    resolve: {
      alias: {
        // Resolve workspace package from TypeScript source so Vite
        // can tree-shake and type-check in one pass (no separate build step).
        '@ethical-shopper/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    },
  }),
})
