/**
 * Die gebaute Seite in einem echten Browser prüfen.
 *
 *   node scripts/pruefe-oberflaeche.mjs            alle Prüfungen gegen dist/
 *   node scripts/pruefe-oberflaeche.mjs --nur-server   dist/ nur ausliefern, zum Ansehen
 *
 * Die Engine-Tests prüfen Zahlen, pruefe-ausgabe.mjs prüft HTML. Beides sieht
 * nicht, ob eine Insel im Browser lädt, ob die Inhaltsrichtlinie ein Skript
 * blockiert oder ob die Navigation am Telefon erreichbar ist. Genau das ist
 * zweimal passiert – die Linienfarben im Punkteverlauf fehlten, weil die
 * Richtlinie `style`-Attribute blockierte, und der Vergleich verwarf beim
 * Hydrieren sein ganzes Gerüst –, und beides fiel nur beim Ansehen auf.
 *
 * Benutzt wird das installierte Chrome (playwright-core bringt keinen Browser
 * mit). Auf den Runnern von GitHub ist es vorinstalliert, lokal meist auch.
 *
 * Der kleine Server unten ersetzt `astro preview`, das die Seiten ohne den
 * Vorsatz /F1-stats/ ausliefert und deshalb ohne Stylesheet zeigt.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const DIST = path.join(process.cwd(), 'dist')
const BASIS = '/F1-stats'
const NUR_SERVER = process.argv.includes('--nur-server')

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
}

/** Ausliefern wie GitHub Pages: Verzeichnis → index.html, sonst 404.html. */
function server() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    let weg = decodeURIComponent(url.pathname)
    if (!weg.startsWith(`${BASIS}/`) && weg !== BASIS) {
      res.writeHead(404).end()
      return
    }
    weg = weg.slice(BASIS.length) || '/'
    let datei = path.join(DIST, path.normalize(weg).replace(/^([/\\])+/, ''))
    if (!datei.startsWith(DIST)) {
      res.writeHead(403).end()
      return
    }
    if (fs.existsSync(datei) && fs.statSync(datei).isDirectory()) datei = path.join(datei, 'index.html')
    if (!fs.existsSync(datei)) {
      const nf = path.join(DIST, '404.html')
      res.writeHead(404, { 'content-type': TYPEN['.html'] })
      res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'not found')
      return
    }
    res.writeHead(200, { 'content-type': TYPEN[path.extname(datei)] ?? 'application/octet-stream' })
    fs.createReadStream(datei).pipe(res)
  })
}

if (!fs.existsSync(DIST)) {
  console.error('Kein gebautes Verzeichnis unter dist/. Erst: npm run build')
  process.exit(1)
}

const srv = server()
await new Promise((ok) => srv.listen(NUR_SERVER ? 4323 : 0, '127.0.0.1', ok))
const WURZEL = `http://127.0.0.1:${srv.address().port}${BASIS}`

if (NUR_SERVER) {
  console.log(`dist/ unter ${WURZEL}/ – beenden mit Strg+C`)
} else {
  await pruefeAlles()
}

async function pruefeAlles() {
  const { chromium } = await import('playwright-core')
  let browser
  try {
    browser = await chromium.launch({ channel: 'chrome' })
  } catch (e) {
    console.error(`Chrome ließ sich nicht starten: ${e.message.split('\n')[0]}`)
    srv.close()
    process.exit(1)
  }

  const fehler = []
  let bestanden = 0
  const pruefe = (name, ok, detail = '') => {
    if (ok) bestanden++
    else fehler.push(`${name}${detail ? ' – ' + detail : ''}`)
  }

  /*
   * Jede Seite in einem frischen Kontext, und jeder Konsolenfehler zählt. Eine
   * Verletzung der Inhaltsrichtlinie ist ein solcher Fehler – das ist der
   * Hauptgrund für diesen Teil.
   */
  async function seite(weg, { breite = 1280, hoehe = 900 } = {}) {
    const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe } })
    const p = await kontext.newPage()
    const meldungen = []
    p.on('console', (m) => m.type() === 'error' && meldungen.push(m.text()))
    p.on('pageerror', (e) => meldungen.push(e.message))
    const antwort = await p.goto(`${WURZEL}${weg}`, { waitUntil: 'networkidle' })
    return { p, kontext, meldungen, status: antwort?.status() }
  }

  const OHNE_FEHLER = [
    '/', '/preview/', '/seasons/', '/seasons/1988/', '/seasons/2024/', '/races/',
    '/races/monaco-grand-prix-1988/', '/drivers/', '/drivers/ayrton-senna/', '/teams/ferrari/',
    '/circuits/', '/circuits/monaco/', '/engines/ford/', '/records/', '/changes/', '/teammates/',
    '/comparison/?a=lewis-hamilton&b=michael-schumacher', '/explorer/', '/quiz/',
  ]
  for (const weg of OHNE_FEHLER) {
    const { kontext, meldungen, status } = await seite(weg)
    pruefe(`${weg} lädt`, status === 200, `HTTP ${status}`)
    pruefe(`${weg} ohne Konsolenfehler`, meldungen.length === 0, meldungen.slice(0, 2).join(' | '))
    await kontext.close()
  }
  console.log(`   ✓ ${OHNE_FEHLER.length} Seiten ohne Konsolenfehler`)

  /*
   * Ein Schritt, der unterwegs scheitert, zählt als Fehlschlag und hält die
   * übrigen nicht an – sonst sähe man je Lauf nur den ersten Fehler.
   */
  async function schritt(name, weg, optionen, pruefung) {
    const { p, kontext } = await seite(weg, optionen)
    try {
      await pruefung(p)
    } catch (e) {
      pruefe(name, false, e.message.split('\n')[0])
    } finally {
      await kontext.close()
    }
  }

  // Countdown: im Browser gerechnet, also nicht mehr das nackte Datum.
  await schritt('Countdown', '/preview/', {}, async (p) => {
    const hatRennen = (await p.locator('[data-countdown]').count()) > 0
    const text = hatRennen ? await p.locator('[data-countdown]').first().textContent() : ''
    pruefe('Countdown gerechnet', !hatRennen || /days to go|Today|Tomorrow|ago/.test(text), text)
  })

  // Die Suche in der Kopfleiste: tippen, Treffer, Enter führt hin.
  await schritt('Suche', '/', {}, async (p) => {
    const feld = p.locator('.suche input').first()
    await feld.click()
    await feld.fill('senna')
    const treffer = p.locator('.suche li', { hasText: 'Ayrton Senna' })
    await treffer.first().waitFor({ timeout: 5000 })
    pruefe('Suche findet Senna', (await treffer.count()) > 0)
    await feld.press('Enter')
    await p.waitForURL(/\/drivers\/ayrton-senna\//, { timeout: 5000 })
    pruefe('Enter führt zum ersten Treffer', p.url().includes('/drivers/ayrton-senna/'), p.url())
  })

  // Vergleich aus der Adresse.
  await schritt('Vergleich', '/comparison/?a=lewis-hamilton&b=michael-schumacher', {}, async (p) => {
    await p.getByText('Michael Schumacher').first().waitFor({ timeout: 5000 })
    const inhalt = await p.locator('main').textContent()
    pruefe('Vergleich zeigt beide Fahrer', inhalt.includes('Lewis Hamilton') && inhalt.includes('Michael Schumacher'))
  })

  // Explorer: lädt den Würfel und zeigt Zeilen.
  await schritt('Explorer', '/explorer/', {}, async (p) => {
    await p.locator('main table tbody tr').first().waitFor({ timeout: 10000 })
    pruefe('Explorer zeigt Ergebnisse', (await p.locator('main table tbody tr').count()) > 0)
  })

  // What-if: ein anderes System wählen zeigt eine andere Tabelle.
  await schritt('What-if', '/seasons/1988/', {}, async (p) => {
    const vorher = await p.locator('.whatif-variante:not([hidden]) tbody').textContent()
    await p.getByRole('radio', { name: '1991–2002' }).check()
    const nachher = await p.locator('.whatif-variante:not([hidden]) tbody').textContent()
    pruefe('What-if schaltet das System um', vorher !== nachher)
    pruefe('genau eine Variante sichtbar', (await p.locator('.whatif-variante:not([hidden])').count()) === 1)
  })

  await browser.close()
  srv.close()

  console.log(`\n${bestanden} Prüfungen im Browser bestanden, ${fehler.length} fehlgeschlagen.`)
  if (fehler.length) {
    for (const f of fehler) console.error('  ✗ ' + f)
    process.exit(1)
  }
}
