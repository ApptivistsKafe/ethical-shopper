import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { OutputChunk, OutputBundle } from 'rollup';

// Load environment variables
dotenv.config();

interface ChunkWithCode extends OutputChunk {
  code: string;
  fileName: string;
}

// Custom plugin to handle content script
function contentScriptPlugin() {
  return {
    name: 'content-script',
    generateBundle(options: any, bundle: OutputBundle) {
      const contentChunk = Object.values(bundle).find(
        (chunk): chunk is ChunkWithCode => 
          chunk.type === 'chunk' && chunk.fileName === 'content.js'
      );

      const detectorChunk = Object.values(bundle).find(
        (chunk): chunk is ChunkWithCode =>
          chunk.type === 'chunk' && chunk.fileName.includes('checkoutDetector')
      );

      if (contentChunk && detectorChunk) {
        const detectorCode = detectorChunk.code.replace(/export\s*{[^}]*};?/, '');
        
        contentChunk.code = `(function() {
          // Detector implementation
          ${detectorCode}
          
          // Content script implementation using detector function directly
          ${contentChunk.code}
        })();`;

        delete bundle[detectorChunk.fileName];
      }
    }
  };
}

// Plugin to copy and transform necessary files
function copyManifestPlugin() {
  return {
    name: 'copy-manifest',
    closeBundle() {
      try {
        mkdirSync('dist', { recursive: true });
        
        const manifest = JSON.parse(readFileSync('manifest.json', 'utf-8'));
        writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
        
        const popupHtml = readFileSync('src/popup/popup.html', 'utf-8')
          .replace('assets/style.css', 'style.css');
        writeFileSync('dist/popup.html', popupHtml);
      } catch (error) {
        console.error('Error in copyManifestPlugin:', error);
      }
    }
  };
}

// Environment variables plugin
function envPlugin() {
  return {
    name: 'env-plugin',
    config: () => ({
      define: {
        'process.env.GOOGLE_AI_API_KEY': JSON.stringify(process.env.GOOGLE_AI_API_KEY)
      }
    })
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const commonConfig = {
    plugins: [react(), envPlugin()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    optimizeDeps: {
      include: ['@google/generative-ai']
    }
  };

  if (command === 'serve') {
    // Development config
    return {
      ...commonConfig,
      root: 'src/dev'
    };
  } else {
    // Production config
    return {
      ...commonConfig,
      plugins: [...commonConfig.plugins, contentScriptPlugin(), copyManifestPlugin()],
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
          input: {
            popup: resolve(__dirname, 'src/popup/popup.tsx'),
            content: resolve(__dirname, 'src/content/content.ts'),
            background: resolve(__dirname, 'src/background/background.ts')
          },
          output: {
            format: 'es',
            entryFileNames: '[name].js',
            chunkFileNames: '[name].js',
            assetFileNames: '[name][extname]'
          },
          preserveEntrySignatures: 'strict'
        },
        sourcemap: false,
        cssCodeSplit: false,
        minify: false
      }
    };
  }
});