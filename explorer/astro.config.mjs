// @ts-check
import { createHash } from 'node:crypto'
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import { MODUS_SKRIPT } from './src/lib/modus.js'

/*
 * Das Inline-Skript im Kopf (hell/dunkel) hasht Astro nicht selbst. Der Hash
 * wird deshalb hier aus demselben Text gerechnet, den das Layout ausgibt –
 * ändert sich das Skript, zieht die Richtlinie von allein nach.
 */
const MODUS_HASH = `sha256-${createHash('sha256').update(MODUS_SKRIPT).digest('base64')}`

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

/*
 * Die Sitemap: jede gebaute Seite, nach dem Bau aus dem geschrieben, was
 * tatsächlich entstanden ist – nicht aus einer Liste, die neben den Seiten
 * gepflegt werden müsste. Die Weiterleitungen der alten deutschen Adressen
 * und die 404-Seite stehen nicht darin; sie sind keine Seiten, die jemand
 * finden soll.
 *
 * Eine eigene Integration statt @astrojs/sitemap: Es sind zwanzig Zeilen, und
 * jede Abhängigkeit weniger ist eine, die beim Bauen keinen Code ausführt.
 *
 * GitHub Pages erlaubt keine robots.txt in der Wurzel einer Projektseite –
 * die läge unter /robots.txt, und das gehört dem Konto. Die Sitemap wird
 * deshalb über die Search Console angemeldet und im Kopf jeder Seite verlinkt.
 */
const sitemap = () => ({
  name: 'sitemap',
  hooks: {
    'astro:build:done': async ({ pages, dir }) => {
      const { writeFile } = await import('node:fs/promises')
      const alt = Object.keys(ALTE_ADRESSEN).map((a) => a.slice(1))
      const wege = pages
        .map((p) => p.pathname)
        .filter((p) => !/^404\/?$/.test(p) && !alt.some((a) => p === `${a}/`))
        .sort()
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        wege.map((p) => `  <url><loc>https://jonathanrngl.github.io${BASIS}/${p}</loc></url>`).join('\n') +
        '\n</urlset>\n'
      await writeFile(new URL('sitemap.xml', dir), xml)
    },
  },
})

export default defineConfig({
  site: 'https://jonathanrngl.github.io',
  base: '/F1-stats/',
  output: 'static',
  /*
   * Jede Adresse endet auf einen Schrägstrich, wie es die Verzeichnisausgabe
   * ohnehin schreibt. So gibt es je Seite genau eine Adresse, und die Links
   * darauf sind überall dieselben.
   */
  trailingSlash: 'always',
  integrations: [react(), sitemap()],
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
  /*
   * Inhaltsrichtlinie.
   *
   * GitHub Pages lässt keine eigenen HTTP-Kopfzeilen zu; Astro schreibt die
   * Richtlinie deshalb als <meta> in jede Seite. `script-src` und `style-src`
   * setzt Astro selbst und trägt dort die Hashes der eigenen Inseln ein –
   * deshalb stehen sie hier nicht und dürfen es auch nicht.
   *
   * Die Seite lädt ausschließlich Eigenes: den Datenwürfel und die JSON-API
   * unter derselben Herkunft. `connect-src 'self'` heißt damit, dass ein
   * eingeschleustes Skript seine Beute nirgendwohin schicken könnte.
   *
   * Nicht dabei: `frame-ancestors`. Browser werten die Direktive in einem
   * <meta> nicht aus, sie bräuchte eine Kopfzeile. Schutz vor Clickjacking
   * gibt es auf GitHub Pages also nicht – das ist eine Grenze der Plattform,
   * kein Versehen.
   */
  security: {
    csp: {
      scriptDirective: { hashes: [MODUS_HASH] },
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
    },
  },
})
