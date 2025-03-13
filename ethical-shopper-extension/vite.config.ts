import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { writeFileSync, copyFileSync } from 'fs';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === 'serve') {
    // Development config - serves the dev version
    return {
      plugins: [react()],
      root: 'src/dev',
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src')
        }
      }
    };
  } else {
    // Production config - builds the extension
    return {
      plugins: [
        react(),
        {
          name: 'copy-html',
          closeBundle() {
            // Copy popup.html to dist
            copyFileSync('src/popup/popup.html', 'dist/popup.html');
          }
        }
      ],
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
          input: {
            popup: resolve(__dirname, 'src/popup/popup.html'),
            content: resolve(__dirname, 'src/content/content.ts'),
            background: resolve(__dirname, 'src/background/background.ts')
          },
          output: {
            dir: 'dist',
            format: 'es',
            entryFileNames: '[name].js',
            chunkFileNames: 'assets/[name].[hash].js',
            assetFileNames: 'assets/[name].[ext]'
          }
        }
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src')
        }
      },
      publicDir: 'public'
    };
  }
});