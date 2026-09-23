import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative stier, så det byggede app kan ligge under en vilkårlig adresse
  base: './',
})
