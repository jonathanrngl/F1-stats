import { fahrerListe, rennenListe } from './db.js'

/**
 * „On this day": für jeden Tag des Jahres die Rennen, die an ihm gefahren
 * wurden, und die Sieger, die an ihm geboren sind.
 *
 * Welcher Tag heute ist, weiß erst der Browser – die Seite wird nicht täglich
 * gebaut, und sie soll es auch nicht müssen. Deshalb entsteht hier der ganze
 * Kalender, und die Startseite liest daraus den Tag des Besuchers.
 *
 * Kompakt als Listen statt als Objekte, weil die Datei auf der Startseite
 * geladen wird: 1.100 Rennen als Objekte mit Feldnamen wären das Doppelte.
 *
 *   rennen:  [jahr, Grand Prix, Rennkennung, Sieger, Kennung des (ersten) Siegers]
 *   geboren: [jahr, Name, Fahrerkennung, Siege, Titel]
 */
export function tageskalender() {
  const tage = {}
  const tag = (datum) => (tage[datum.slice(5, 10)] ??= { rennen: [], geboren: [] })

  for (const r of rennenListe()) {
    if (r.siegerId) tag(r.datum).rennen.push([r.jahr, r.nameVoll, r.id, r.sieger, r.siegerId])
  }
  for (const f of fahrerListe()) {
    if (f.geboren && f.siege > 0) {
      tag(f.geboren).geboren.push([Number(f.geboren.slice(0, 4)), f.name, f.id, f.siege, f.titel ?? 0])
    }
  }

  /* Die jüngsten Rennen zuerst; unter den Geburtstagen die mit den meisten Titeln, dann Siegen. */
  for (const t of Object.values(tage)) {
    t.rennen.sort((a, b) => b[0] - a[0])
    t.geboren.sort((a, b) => b[4] - a[4] || b[3] - a[3] || a[0] - b[0])
  }
  return Object.fromEntries(Object.entries(tage).sort(([a], [b]) => a.localeCompare(b)))
}
