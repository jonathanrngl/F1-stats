import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative Asset-Pfade, damit der Build unter jeder URL liegen darf: im Wurzel-
  // verzeichnis einer eigenen Domain wie auch im Unterpfad von GitHub Pages
  // (/F1-stats/). Die App hat kein Client-Routing, deshalb ist das gefahrlos.
  base: './',
  server: {
    // Das Projekt liegt auf einem Netzlaufwerk (H:). Dort schlägt die native
    // Dateiüberwachung von Windows fehl, deshalb wird gepollt.
    watch: { usePolling: true, interval: 400 },
  },
})
