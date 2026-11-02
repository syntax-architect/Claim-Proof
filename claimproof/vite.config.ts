import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function versionedServiceWorkerPlugin() {
  return {
    name: 'versioned-service-worker',
    apply: 'build' as const,
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const swPath = path.resolve(distDir, 'sw.js');
      const assetsDir = path.resolve(distDir, 'assets');

      if (!fs.existsSync(swPath)) return;

      const swVersion = `v${Date.now()}`;
      let assets: string[] = [];

      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        assets = files
          .filter(
            (f) =>
              (f.endsWith('.js') ||
                f.endsWith('.css') ||
                f.endsWith('.woff2') ||
                f.endsWith('.woff') ||
                f.endsWith('.ttf')) &&
              !f.endsWith('.map')
          )
          .map((f) => `/assets/${f}`);
      }

      let content = fs.readFileSync(swPath, 'utf-8');
      content = content.replace(/__SW_VERSION__/g, swVersion);
      if (assets.length > 0) {
        const formattedAssets = assets.map((a) => `'${a}'`).join(', ');
        content = content.replace(/\/\*\s*__CORE_ASSETS__\s*\*\//g, `, ${formattedAssets}`);
      }
      fs.writeFileSync(swPath, content, 'utf-8');
    }
  };
}

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'SUPABASE_'],
  plugins: [react(), tailwindcss(), versionedServiceWorkerPlugin()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (normalizedId.includes('node_modules')) {
            if (normalizedId.includes('pdfjs-dist')) return 'pdfjs';
            if (normalizedId.includes('pdf-lib')) return 'pdf-lib';
            if (normalizedId.includes('@zxing')) return 'zxing';
            if (normalizedId.includes('@supabase')) return 'supabase';
            if (normalizedId.includes('qrcode')) return 'qr';
            if (normalizedId.includes('framer-motion')) return 'vendor-motion';
            if (normalizedId.includes('lucide-react')) return 'vendor-icons';
            if (normalizedId.includes('dexie')) return 'vendor-dexie';
            if (
              normalizedId.includes('react-dom') ||
              normalizedId.includes('/react/') ||
              normalizedId.includes('scheduler')
            )
              return 'vendor-react';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**', 'src/services/**'],
      thresholds: {
        lines: 70
      }
    }
  }
});
