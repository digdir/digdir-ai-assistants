import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const bffUrl = process.env.VITE_BFF_URL || 'http://127.0.0.1:5173'
const allowedHost = process.env.VITE_ALLOWED_HOST

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 3000,
    ...(allowedHost ? { allowedHosts: [allowedHost] } : {}),
    proxy: {
      // Proxy API requests to Node.js BFF during development
      '/api': {
        target: bffUrl,
        changeOrigin: true,
      },
      '/auth': {
        target: bffUrl,
        changeOrigin: true,
      },
    },
  },
})
