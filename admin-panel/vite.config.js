import { defineConfig } from 'vite'

export default defineConfig({
  root: './',
  publicDir: 'public',
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../server/dist/admin',
    emptyOutDir: true
  }
})
