import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  optimizeDeps: {
    exclude: [
      '@jsquash/jpeg',
      '@jsquash/png',
      '@jsquash/webp',
      '@jsquash/avif',
      '@jsquash/jxl',
      '@jsquash/oxipng',
      '@jsquash/resize',
    ],
  },
})
