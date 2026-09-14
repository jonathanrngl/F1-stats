// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

/*
 * Statische Ausgabe: Alle Seiten entstehen beim Bauen aus der importierten
 * Datenbank. React-Inseln nur dort, wo wirklich interagiert wird – der Rest
 * ist fertiges HTML und braucht kein JavaScript.
 */
export default defineConfig({
  output: 'static',
  integrations: [react()],
  build: { format: 'directory' },
  server: { port: 4321 },
})
