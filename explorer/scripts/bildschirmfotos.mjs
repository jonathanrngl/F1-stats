/**
 * Bildschirmfotos der Hauptseiten, hell und dunkel, breit und schmal.
 *
 *   npm run vorschau                                  in einem zweiten Fenster
 *   node scripts/bildschirmfotos.mjs .design/nachher  die Bilder dorthin
 *   node scripts/bildschirmfotos.mjs .design/x / /drivers/ayrton-senna/   nur diese Seiten
 *
 * Für den Vorher-nachher-Vergleich einer Gestaltung: Die Prüfungen in
 * pruefe-oberflaeche.mjs sagen, ob etwas funktioniert, nicht, wie es aussieht.
 * Gezeichnet wird mit dem installierten Chrome wie dort. Lange Seiten werden
 * nach 7.000 Pixeln abgeschnitten – was darunter steht, gleicht dem darüber.
 */
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const WURZEL = process.env.VORSCHAU ?? 'http://127.0.0.1:4323/F1-stats'
const [ziel = '.design/vorher', ...nur] = process.argv.slice(2)

/* Das jüngste Rennen mit Ergebnis – die Rennseite, die gerade am meisten gelesen wird. */
const d = new DatabaseSync(path.join(process.cwd(), 'data', 'f1.sqlite'), { readOnly: true })
const letztes = d
  .prepare('SELECT id FROM race r WHERE EXISTS (SELECT 1 FROM race_result x WHERE x.race_id = r.id) ORDER BY date DESC LIMIT 1')
  .get().id
d.close()

const SEITEN = nur.length
  ? nur
  : [
      '/', '/preview/', '/seasons/2026/', '/seasons/1988/', '/drivers/fernando-alonso/', '/teams/ferrari/',
      `/races/${letztes}/`, '/records/', '/teammates/', '/comparison/', '/explorer/', '/circuits/', '/quiz/',
    ]
const BREITEN = [1440, 390]
const MODI = ['light', 'dark']
const HOECHSTENS = 7000

const name = (weg) => (weg === '/' ? 'start' : weg.replace(/^\/|\/$/g, '').replace(/[/?=&]+/g, '_'))

const { chromium } = await import('playwright-core')
const browser = await chromium.launch({ channel: 'chrome' })
fs.mkdirSync(ziel, { recursive: true })

for (const weg of SEITEN) {
  for (const breite of BREITEN) {
    for (const modus of MODI) {
      const kontext = await browser.newContext({
        viewport: { width: breite, height: breite > 600 ? 900 : 844 },
        deviceScaleFactor: 1,
        colorScheme: modus,
        reducedMotion: 'reduce',
      })
      const p = await kontext.newPage()
      await p.goto(`${WURZEL}${weg}`, { waitUntil: 'networkidle' })
      /* Inseln hydrieren beim Hineinscrollen; einmal ans Ende und zurück, damit sie stehen. */
      await p.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 800) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 30))
        }
        window.scrollTo(0, 0)
      })
      await p.waitForTimeout(300)
      const hoehe = await p.evaluate(() => document.documentElement.scrollHeight)
      const datei = path.join(ziel, `${name(weg)}-${breite}-${modus}.png`)
      await p.screenshot({ path: datei, fullPage: true, clip: { x: 0, y: 0, width: breite, height: Math.min(hoehe, HOECHSTENS) } })
      console.log(`  ${datei}`)
      await kontext.close()
    }
  }
}

await browser.close()
