import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { OutputChunk, OutputBundle } from 'rollup';

interface ChunkWithCode extends OutputChunk {
  code: string;
  fileName: string;
}

// Custom plugin to handle content script
function contentScriptPlugin() {
  return {
    name: 'content-script',
    generateBundle(options: any, bundle: OutputBundle) {
      // Find the content script chunk and its dependency
      const contentChunk = Object.values(bundle).find(
        (chunk): chunk is ChunkWithCode => 
          chunk.type === 'chunk' && chunk.fileName === 'content.js'
      );

      const detectorChunk = Object.values(bundle).find(
        (chunk): chunk is ChunkWithCode =>
          chunk.type === 'chunk' && chunk.fileName.includes('checkoutDetector')
      );

      if (contentChunk && detectorChunk) {
        // Get detector code without the export statement
        const detectorCode = detectorChunk.code.replace(/export\s*{[^}]*};?/, '');
        
        // Combine chunks and wrap in IIFE
        contentChunk.code = `(function() {
          // Detector implementation
          ${detectorCode}
          
          // Content script implementation using detector function directly
          ${contentChunk.code}
        })();`;

        // Remove the detector chunk since it's now included in content.js
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
        // Create dist directory if it doesn't exist
        mkdirSync('dist', { recursive: true });
        
        // Copy manifest.json
        const manifest = JSON.parse(readFileSync('manifest.json', 'utf-8'));
        writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
        
        // Copy and transform popup.html
        const popupHtml = readFileSync('src/popup/popup.html', 'utf-8')
          .replace('assets/style.css', 'style.css');
        writeFileSync('dist/popup.html', popupHtml);
      } catch (error) {
        console.error('Error in copyManifestPlugin:', error);
      }
    }
  };
}

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
        contentScriptPlugin(),
        copyManifestPlugin()
      ],
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
            chunkFileNames: '[name].js', // Put chunks in root directory
            assetFileNames: '[name][extname]' // Put assets in root directory without hash
          },
          preserveEntrySignatures: 'strict'
        },
        sourcemap: false,
        cssCodeSplit: false, // This ensures CSS is bundled into a single file
        minify: false // Disable minification for easier debugging
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src')
        }
      }
    };
  }
});