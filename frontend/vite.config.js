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
      // M2 - File manager direct routes
      '/upload':        'http://127.0.0.1:8000',
      '/generate-note': 'http://127.0.0.1:8000',
      '/refine-text':   'http://127.0.0.1:8000',
      '/folders':       'http://127.0.0.1:8000',
      '/notes': {
        target: 'http://127.0.0.1:8000',
        bypass: (req, res) => {
          if (req.headers.accept && req.headers.accept.indexOf('html') !== -1) {
            return req.url; // serve index.html for page routes
          }
        }
      },

      // All /api routes
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
