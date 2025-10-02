import { defineConfig } from 'vite'

export default defineConfig({
  root: './',
  publicDir: false, // Désactiver le dossier public
  
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
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  
  // Désactiver l'optimisation des dépendances
  optimizeDeps: {
    disabled: true
  }
})
