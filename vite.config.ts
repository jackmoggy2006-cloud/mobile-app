import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Project Pages URL: https://<user>.github.io/mobile-app/
export default defineConfig({
  plugins: [react()],
  base: '/mobile-app/',
})
