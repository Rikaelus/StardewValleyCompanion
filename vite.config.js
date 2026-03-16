import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react()
  ],
  // Set base path for subdirectory deployment:
  // - Default '/' for root deployment
  // - Set to '/stardew/' for example.com/stardew/
  // - Or use env: base: process.env.BASE_URL || '/'
  base: './',
  server: {
    // Enable client-side routing in dev mode
    historyApiFallback: true,
  }
})
