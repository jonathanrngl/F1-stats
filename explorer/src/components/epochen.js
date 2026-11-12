import { saisonListe } from '../lib/db.js'

/**
 * Welche Jahre das Epochenband beschriftet (Epochenband.astro, docs/DESIGN.md
 * 8.3), und ob der Zeitraum eines Gegenstands damit schon zu sehen ist.
 *
 * Eine Regel an einer Stelle: Das Band beschriftet die Enden der Achse und das
 * erste und letzte Jahr des Gegenstands, lässt aber eine Zahl weg, die näher
 * als acht Saisons an einer anderen steht. Seiten, die den Zeitraum dann in
 * Worten nennen (Team, Motor, Reifen, Strecke), fragen hier – stünde die Regel
 * dort noch einmal, liefe sie beim ersten Ändern auseinander.
 */
const MINDESTABSTAND = 8

let achseGespeichert = null

/** Erste und letzte Saison der Daten – die Enden jeder Achse. */
export function achse() {
  if (!achseGespeichert) {
    const jahre = saisonListe().map((s) => s.jahr)
    achseGespeichert = { von: Math.min(...jahre), bis: Math.max(...jahre) }
  }
  return achseGespeichert
}

/** Die beschrifteten Jahre: Achsenenden zuerst, dann erstes und letztes Jahr des Gegenstands. */
export function epochenMarken(jahre) {
  const { von, bis } = achse()
  const sortiert = [...jahre].sort((a, b) => a - b)
  const marken = []
  for (const j of [von, bis, sortiert[0], sortiert.at(-1)]) {
    if (j === undefined || marken.includes(j)) continue
    if (marken.some((m) => Math.abs(m - j) < MINDESTABSTAND)) continue
    marken.push(j)
  }
  return marken
}

/** Zeigt das Band erstes und letztes Jahr schon als Zahl? Sonst gehört der Zeitraum in den Kopfsatz. */
export function zeitraumImBand(jahre) {
  const sortiert = [...jahre].sort((a, b) => a - b)
  const marken = epochenMarken(sortiert)
  return sortiert.length > 0 && marken.includes(sortiert[0]) && marken.includes(sortiert.at(-1))
}
