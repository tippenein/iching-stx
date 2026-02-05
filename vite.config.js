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
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: [
      '@stacks/transactions',
      '@stacks/network',
      '@stacks/auth',
      '@stacks/connect'
    ]
  }
})