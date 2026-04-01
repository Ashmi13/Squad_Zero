import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/upload':        'http://127.0.0.1:8000',
      '/generate-note': 'http://127.0.0.1:8000',
      '/refine-text':   'http://127.0.0.1:8000',
      '/folders':       'http://127.0.0.1:8000',
      '/notes':         'http://127.0.0.1:8000',

      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  envDir: '../', // Root .env — DO NOT REMOVE
});