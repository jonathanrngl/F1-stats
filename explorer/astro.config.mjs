// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

/*
 * Statische Ausgabe: Alle Seiten entstehen beim Bauen aus der importierten
 * Datenbank. React-Inseln nur dort, wo wirklich interagiert wird – der Rest
 * ist fertiges HTML und braucht kein JavaScript.
 *
 * site und base zeigen auf das Projektverzeichnis von GitHub Pages. Jeder
 * seiteninterne Verweis muss diesen Vorsatz tragen, sonst zeigt er am Repo
 * vorbei auf die Wurzel der Domain; dafür steht `import.meta.env.BASE_URL`,
 * das beim Entwickeln schlicht "/" ist.
 */
export default defineConfig({
  site: 'https://jonathanrngl.github.io',
  base: '/F1-stats/',
  output: 'static',
  integrations: [react()],
  build: { format: 'directory' },
  server: { port: 4321 },
})
