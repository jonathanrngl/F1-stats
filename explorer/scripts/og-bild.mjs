/**
 * Das Vorschaubild geteilter Links neu zeichnen: scripts/og-bild.html →
 * public/og.png, 1200 × 630, mit dem installierten Chrome wie die übrigen
 * Browserskripte.
 *
 *   node scripts/og-bild.mjs
 *
 * Die Vorlage lädt Archivo aus node_modules, deshalb läuft das Skript im
 * Verzeichnis explorer/. Inline-Stile und das Skript in der Vorlage sind
 * dort zulässig: Sie wird nie ausgeliefert, nur abfotografiert.
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

const vorlage = path.join(process.cwd(), 'scripts', 'og-bild.html')
const ziel = path.join(process.cwd(), 'public', 'og.png')

const browser = await chromium.launch({ channel: 'chrome' })
const seite = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await seite.goto(pathToFileURL(vorlage).href)
await seite.evaluate(() => document.fonts.ready)
const geladen = await seite.evaluate(() => document.fonts.check("800 60px 'Archivo Variable'"))
if (!geladen) {
  console.error('Archivo ist nicht geladen – liegt node_modules/@fontsource-variable/archivo vor?')
  process.exit(1)
}
await seite.screenshot({ path: ziel })
await browser.close()
console.log(`→ ${path.relative(process.cwd(), ziel)}`)
