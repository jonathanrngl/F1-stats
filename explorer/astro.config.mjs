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
/*
 * Die Adressen waren deutsch, solange die Seite es war. Wer sie schon
 * gespeichert oder verlinkt hat, soll nicht ins Leere laufen – deshalb bleibt
 * jede alte Übersicht als Weiterleitung bestehen.
 *
 * Für die Einzelseiten (/fahrer/max-verstappen/) gilt das nicht: Eine statische
 * Ausgabe müsste dafür jede der rund 2300 Adressen als eigene Weiterleitungs-
 * datei schreiben, und Astro erzeugt sie ohne `getStaticPaths` nicht. Diese
 * Adressen brechen also; das ist der Preis der Umstellung und keine Nachlässigkeit.
 */
const BASIS = '/F1-stats'

const ALTE_ADRESSEN = {
  '/fahrer': '/drivers',
  '/saisons': '/seasons',
  '/rennen': '/races',
  '/strecken': '/circuits',
  '/rekorde': '/records',
  '/aenderungen': '/changes',
  '/vergleich': '/comparison',
  '/vorschau': '/preview',
  '/klassisch': '/classic',
}

export default defineConfig({
  site: 'https://jonathanrngl.github.io',
  base: '/F1-stats/',
  output: 'static',
  integrations: [react()],
  build: { format: 'directory' },
  server: { port: 4321 },
  /*
   * Das Ziel trägt den Vorsatz selbst: Astro setzt ihn nur auf die Quelle, das
   * Ziel schreibt es unverändert in die Weiterleitung. Ohne ihn zeigte
   * /F1-stats/fahrer/ auf jonathanrngl.github.io/drivers/ – an der Seite vorbei.
   */
  redirects: Object.fromEntries(
    Object.entries(ALTE_ADRESSEN).map(([alt, neu]) => [`${alt}/`, `${BASIS}${neu}/`]),
  ),
})
