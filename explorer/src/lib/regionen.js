/**
 * Die Regionen der Streckenkarte, in Grad.
 *
 * Eigene Datei, weil weltkarte.js von scripts/karte-bauen.mjs neu geschrieben
 * wird – und weil zwei Stellen dieselben Grenzen brauchen: die große Karte,
 * die in eine Region zoomt, und die Lagekarte einer Strecke, die dorthin
 * verweist.
 *
 * Südamerika und Ozeanien fehlen mit Absicht: drei und zwei Strecken, weit
 * auseinander – die Weltkarte zeigt sie schon deutlich.
 */
export const REGIONEN = [
  { id: 'welt', label: 'World' },
  { id: 'europa', label: 'Europe', lon: [-10, 41], lat: [35, 59] },
  { id: 'nordamerika', label: 'North America', lon: [-124, -68], lat: [16, 50] },
  { id: 'asien', label: 'Middle East & Asia', lon: [44, 142], lat: [-2, 43] },
]

/** Die Region, in der ein Ort liegt – oder null, wenn er in keiner liegt. */
export function regionVon(lon, lat) {
  if (lon === null || lat === null) return null
  const r = REGIONEN.find(
    (r) => r.lon && lon >= r.lon[0] && lon <= r.lon[1] && lat >= r.lat[0] && lat <= r.lat[1],
  )
  return r ? r.id : null
}
