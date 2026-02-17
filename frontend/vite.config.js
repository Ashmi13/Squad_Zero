import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': 'http://localhost:8000',
      '/generate-note': 'http://localhost:8000',
      '/refine-text': 'http://localhost:8000',
      '/folders': 'http://localhost:8000',
      '/notes': 'http://localhost:8000'
    }
  }
})
