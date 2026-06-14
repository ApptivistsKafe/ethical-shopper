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
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '96': 'icon/96.png',
      '128': 'icon/128.png',
    },
    web_accessible_resources: [
      {
        // The lazily-imported panel bundle (see entrypoints/panel.ts)
        resources: ['panel.js', 'chunks/*'],
        matches: ['<all_urls>'],
      },
    ],
  },

  // Build-time injection:
  //  - API_BASE_URL: the deployed apps/api URL (defaults to production)
  //  - API_TOKEN: shared abuse-mitigation token; must match the server's
  //    EXTENSION_API_TOKEN. Empty string disables the header (local dev).
  vite: () => ({
    define: {
      __API_BASE_URL__: JSON.stringify(
        process.env['API_BASE_URL'] ?? 'https://ethical-shopper.vercel.app',
      ),
      __API_TOKEN__: JSON.stringify(process.env['API_TOKEN'] ?? ''),
    },
    resolve: {
      // Resolve the workspace package from TypeScript source (no separate build
      // step). The subpath alias MUST come first and map to the self-contained
      // pageClassifier module so the content script never pulls in Zod via the
      // barrel — it runs on every page and must stay lean.
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
  }),
})
