import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5330,
    strictPort: true,
    host: true
  },
  preview: {
    port: 5330,
    strictPort: true
  }
})
