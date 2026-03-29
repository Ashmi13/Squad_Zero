import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),  // allows import from '@/pages/...'
    },
  },

  server: {
    port: 5173,
    proxy: {
      // Member 3 (Sandavi) - Structured Notes API routes
      '/upload':        'http://127.0.0.1:8000',
      '/generate-note': 'http://127.0.0.1:8000',
      '/refine-text':   'http://127.0.0.1:8000',
      '/folders':       'http://127.0.0.1:8000',
      '/notes':         'http://127.0.0.1:8000',

      // Team shared API routes
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  envDir: '../', // Look for .env in root directory
});