import { alle } from './db.js'

/**
 * Der Index für die Suche in der Kopfleiste.
 *
 * Fahrer, Teams und Strecken in einer Liste – zusammen rund 1.200 Einträge.
 * Er liegt als eigene Datei unter `/data/suche.json` und nicht in den Seiten:
 * Eingebettet wüchse jede der 2.384 Seiten um denselben Betrag, und geladen
 * wird er ohnehin erst, wenn jemand das Feld benutzt.
 *
 * Jeder Eintrag ist so kurz wie möglich. Die Namen kommen als `display_name` –
 * wer „Lauda" tippt, sucht Niki Lauda und nicht Andreas Nikolaus Lauda.
 *
 * Mitgeführt wird je Eintrag eine Zahl für die Sortierung bei Gleichstand:
 * Bei Fahrern die Starts, bei Teams und Strecken die Zahl der Rennen. Wer
 * „hill" tippt, soll Graham und Damon Hill vor Hill (dem Konstrukteur von
 * 1975) sehen – nicht in der Reihenfolge, in der sie zufällig in der
 * Datenbank stehen.
 */
export function suchindex() {
  const fahrer = alle(`
    SELECT d.id, d.display_name AS n, d.abbreviation AS k, c.ioc AS l,
           MIN(r.year) AS von, MAX(r.year) AS bis,
           COUNT(DISTINCT CASE WHEN rr.started = 1 THEN rr.race_id END) AS g
      FROM driver d
      LEFT JOIN country c ON c.id = d.nationality_id
      JOIN race_result rr ON rr.driver_id = d.id
      JOIN race r ON r.id = rr.race_id
     GROUP BY d.id
     ORDER BY g DESC`)

  const teams = alle(`
    SELECT k.id, k.name AS n, c.ioc AS l,
           MIN(r.year) AS von, MAX(r.year) AS bis,
           COUNT(DISTINCT rr.race_id) AS g
      FROM constructor k
      LEFT JOIN country c ON c.id = k.nationality_id
      JOIN race_result rr ON rr.constructor_id = k.id
      JOIN race r ON r.id = rr.race_id
     GROUP BY k.id
     ORDER BY g DESC`)

  const strecken = alle(`
    SELECT z.id, z.name AS n, c.ioc AS l,
           MIN(r.year) AS von, MAX(r.year) AS bis,
           COUNT(r.id) AS g
      FROM circuit z
      LEFT JOIN country c ON c.id = z.country_id
      JOIN race r ON r.circuit_id = z.id
     GROUP BY z.id
     ORDER BY g DESC`)

  /** `a` ist die Art: f, t, s – ein Buchstabe statt eines Wortes je Eintrag. */
  const formen = (liste, art) =>
    liste.map((x) => ({
      i: x.id,
      n: x.n,
      a: art,
      l: x.l ?? null,
      v: x.von,
      b: x.bis,
      g: x.g,
      ...(x.k ? { k: x.k } : {}),
    }))

  return [...formen(fahrer, 'f'), ...formen(teams, 't'), ...formen(strecken, 's')]
}
