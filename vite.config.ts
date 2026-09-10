import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Das Projekt liegt auf einem Netzlaufwerk (H:). Dort schlägt die native
    // Dateiüberwachung von Windows fehl, deshalb wird gepollt.
    watch: { usePolling: true, interval: 400 },
  },
})
