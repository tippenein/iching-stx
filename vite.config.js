import { defineConfig } from 'vite'

export default defineConfig({
  root: './frontend',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'stacks-tx': ['@stacks/transactions', '@stacks/network'],
          'stacks-crypto': ['@stacks/encryption'],
        }
      }
    }
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: [
      '@stacks/transactions',
      '@stacks/network',
      '@stacks/connect',
      '@stacks/encryption'
    ]
  }
})