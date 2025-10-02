export default {
  root: './',
  
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    },
    fs: {
      // Permettre de servir les fichiers en dehors de root
      strict: false
    }
  },
  
  build: {
    outDir: '../server/dist/admin'
  }
}
