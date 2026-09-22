import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/*
 * Die Inhaltsrichtlinie.
 *
 * GitHub Pages lässt keine eigenen HTTP-Kopfzeilen zu, deshalb steht sie als
 * <meta> in der Seite. Die eigenen Bündel laufen, ein eingeschleustes Skript
 * nicht – und `connect-src` nennt genau die eine fremde Adresse, die die App
 * wirklich braucht. Damit hätte selbst ein solches Skript kein Ziel, an das es
 * etwas schicken könnte.
 *
 * `style-src` erlaubt Inline-Stile. React setzt seine `style`-Angaben zwar über
 * die CSSOM, was die Richtlinie ohnehin nicht betrifft; die Erlaubnis kostet
 * hier nichts und nimmt einer stillen Anzeigepanne die Grundlage. Die Abwehr
 * gilt Skripten, nicht Farben.
 *
 * `frame-ancestors` fehlt bewusst: Browser werten die Direktive in einem <meta>
 * nicht aus. Dafür bräuchte es eine Kopfzeile, die Pages nicht kennt.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://api.jolpi.ca",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/*
 * Nur im Bau, nicht beim Entwickeln: Der Entwicklungsserver lädt über einen
 * WebSocket nach und wertet dabei Code aus – unter dieser Richtlinie stünde
 * `npm run dev` still.
 */
const inhaltsrichtlinie = (): Plugin => ({
  name: 'inhaltsrichtlinie',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
      injectTo: 'head-prepend',
    },
  ],
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), inhaltsrichtlinie()],
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
