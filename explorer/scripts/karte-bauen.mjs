/**
 * Landumrisse für die Streckenkarte erzeugen.
 *
 *   curl -sSLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
 *   node scripts/karte-bauen.mjs
 *
 * Läuft nicht beim Bauen. Das Ergebnis steht als `src/lib/weltkarte.js` im
 * Projekt: Die Seite soll ohne Netz bauen, und eine Karte, die sich zwischen
 * zwei Läufen ändert, wäre schwer zu prüfen. Neu auszuführen ist das nur, wenn
 * sich der Ausschnitt ändern soll – etwa weil ein Grand Prix nördlicher
 * stattfindet als Anderstorp.
 *
 * Quelle: Natural Earth 110 m, gemeinfrei (naturalearthdata.com).
 */
import fs from 'node:fs'

/*
 * Natural Earth (110 m, gemeinfrei) zu SVG-Pfaden für eine Weltkarte.
 *
 * Der Ausschnitt ist auf die Breiten beschränkt, in denen je ein Grand Prix
 * gefahren wurde: Anderstorp bei 57° Nord, Melbourne bei 38° Süd. Antarktis
 * und Arktis fallen damit weg, und Europa – wo die meisten Strecken liegen –
 * bekommt mehr Platz.
 */
const LON_MIN = -128
const LON_MAX = 152
const LAT_MAX = 62
const LAT_MIN = -46

const W = 1000
const H = Math.round((W * (LAT_MAX - LAT_MIN)) / (LON_MAX - LON_MIN))

const x = (lon) => ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W
const y = (lat) => ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H

/** Punkte, die dichter als `eps` beieinanderliegen, tragen nichts bei. */
function ausduennen(punkte, eps = 1.2) {
  const raus = [punkte[0]]
  for (const p of punkte.slice(1)) {
    const l = raus.at(-1)
    if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) >= eps) raus.push(p)
  }
  if (raus.length < 3) return null
  return raus
}

const QUELLE = process.argv[2] ?? 'ne_110m_land.geojson'
if (!fs.existsSync(QUELLE)) {
  console.error(`${QUELLE} fehlt – siehe den Kopf dieser Datei.`)
  process.exit(1)
}
const geo = JSON.parse(fs.readFileSync(QUELLE, 'utf8'))
const pfade = []

const ringe = []
for (const f of geo.features) {
  const g = f.geometry
  if (g.type === 'Polygon') ringe.push(...g.coordinates)
  else if (g.type === 'MultiPolygon') for (const p of g.coordinates) ringe.push(...p)
}

for (const ring of ringe) {
  /* Ganz ausserhalb des Ausschnitts? Antarktis faellt hier heraus. */
  const lats = ring.map((c) => c[1])
  const lons = ring.map((c) => c[0])
  if (Math.max(...lats) < LAT_MIN || Math.min(...lats) > LAT_MAX) continue
  if (Math.max(...lons) < LON_MIN || Math.min(...lons) > LON_MAX) continue

  const punkte = ausduennen(ring.map((c) => [x(c[0]), y(c[1])]))
  if (!punkte) continue

  const d =
    'M' +
    punkte.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') +
    'Z'
  pfade.push(d)
}

const inhalt = `/**
 * Landumrisse für die Streckenkarte, als SVG-Pfade.
 *
 * Quelle: Natural Earth, Auflösung 110 m, gemeinfrei (naturalearthdata.com).
 * Einmal umgerechnet und hier abgelegt – nicht zur Bauzeit geholt: Die Seite
 * soll ohne Netz bauen, und eine Karte, die sich zwischen zwei Läufen ändert,
 * wäre schwer zu prüfen.
 *
 * Abbildung: Plattkarte (äquidistante Zylinderprojektion) auf den Ausschnitt,
 * in dem je ein Grand Prix gefahren wurde – Anderstorp bei 57° Nord, Melbourne
 * bei 38° Süd. Antarktis und Arktis fallen dadurch weg, und Europa bekommt
 * mehr Platz. Flächen sind in dieser Abbildung nicht flächentreu; als
 * Hintergrund für Punkte genügt sie, für einen Flächenvergleich nicht.
 *
 * Erzeugt aus ne_110m_land.geojson, Punkte unter 1,2 Einheiten Abstand
 * ausgedünnt auf ${pfade.length} Umrisse. Erzeugt von scripts/karte-bauen.mjs –
 * von Hand zu ändern lohnt nicht, das Skript schreibt die Datei neu.
 */

/** Zeichenfläche, auf die sich alle Koordinaten beziehen. */
export const KARTE = { breite: ${W}, hoehe: ${H} }

/** Der abgebildete Ausschnitt in Grad. */
export const AUSSCHNITT = {
  lonMin: ${LON_MIN},
  lonMax: ${LON_MAX},
  latMin: ${LAT_MIN},
  latMax: ${LAT_MAX},
}

/** Geografische Koordinaten auf die Zeichenfläche abbilden. */
export const ortX = (lon) =>
  ((lon - AUSSCHNITT.lonMin) / (AUSSCHNITT.lonMax - AUSSCHNITT.lonMin)) * KARTE.breite
export const ortY = (lat) =>
  ((AUSSCHNITT.latMax - lat) / (AUSSCHNITT.latMax - AUSSCHNITT.latMin)) * KARTE.hoehe

export const LAND = [
${pfade.map((d) => `  '${d}',`).join('\n')}
]
`

fs.writeFileSync(new URL('../src/lib/weltkarte.js', import.meta.url), inhalt)
const kb = Math.round(Buffer.byteLength(inhalt) / 1024)
console.log(`${pfade.length} Umrisse, ${kb} KB, Zeichenfläche ${W}×${H}`)
