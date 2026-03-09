import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': 'http://127.0.0.1:8000',
      '/generate-note': 'http://127.0.0.1:8000',
      '/refine-text': 'http://127.0.0.1:8000',
      '/folders': 'http://127.0.0.1:8000',
      '/notes': 'http://127.0.0.1:8000'
    }
  }
})
