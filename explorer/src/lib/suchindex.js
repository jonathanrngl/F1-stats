import { alle } from './db.js'

/**
 * Der Index für die Suche in der Kopfleiste.
 *
 * Fahrer, Teams, Strecken, Motoren, Saisons und Rennen in einer Liste – rund
 * 2.500 Einträge. Rennen und Motoren fehlten bis hierher: Wer „Monaco 1988“
 * suchte, musste über Saisons, Jahr und Kalender klicken, und die Motorseiten
 * erreichte man nur über ihre eigene Liste.
 *
 * Er liegt als eigene Datei unter `/data/suche.json` und nicht in den Seiten:
 * Eingebettet wüchse jede Seite um denselben Betrag, und geladen wird er
 * ohnehin erst, wenn jemand das Feld benutzt.
 *
 * Jeder Eintrag ist so kurz wie möglich. Die Namen kommen als `display_name` –
 * wer „Lauda" tippt, sucht Niki Lauda und nicht Andreas Nikolaus Lauda.
 *
 * Mitgeführt wird je Eintrag eine Zahl für die Sortierung bei Gleichstand:
 * Bei Fahrern die Starts, bei Teams, Strecken und Motoren die Zahl der Rennen,
 * bei Rennen und Saisons das Jahr. Wer „hill" tippt, soll Graham und Damon
 * Hill vor Hill (dem Konstrukteur von 1975) sehen.
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
           COUNT(r.id) AS g, z.place_name AS o
      FROM circuit z
      LEFT JOIN country c ON c.id = z.country_id
      JOIN race r ON r.circuit_id = z.id
     GROUP BY z.id
     ORDER BY g DESC`)

  const motoren = alle(`
    SELECT m.id, m.name AS n, c.ioc AS l,
           MIN(r.year) AS von, MAX(r.year) AS bis,
           COUNT(DISTINCT rr.race_id) AS g
      FROM engine_manufacturer m
      LEFT JOIN country c ON c.id = m.country_id
      JOIN race_result rr ON rr.engine_id = m.id
      JOIN race r ON r.id = rr.race_id
     GROUP BY m.id
     ORDER BY g DESC`)

  const rennen = alle(`
    SELECT r.id, COALESCE(g.full_name, g.name || ' Grand Prix') || ' ' || r.year AS n,
           c.ioc AS l, r.year AS von, r.year AS bis, r.year AS g, z.name AS o
      FROM race r
      JOIN grand_prix g ON g.id = r.grand_prix_id
      JOIN circuit z ON z.id = r.circuit_id
      LEFT JOIN country c ON c.id = z.country_id
     ORDER BY r.year DESC, r.round`)

  const saisons = alle(`SELECT year AS id, year || ' season' AS n, year AS von, year AS bis, year AS g FROM season ORDER BY year DESC`)

  /**
   * `a` ist die Art: f(ahrer), t(eam), s(trecke), m(otor), r(ennen), j(ahr) –
   * ein Buchstabe statt eines Wortes je Eintrag. `o` ist ein Ort, der
   * mitgesucht wird: „Spa“ findet Spa-Francorchamps, „Suzuka“ das Rennen in
   * Japan.
   */
  const formen = (liste, art) =>
    liste.map((x) => ({
      i: x.id,
      n: x.n,
      a: art,
      ...(x.l ? { l: x.l } : {}),
      v: x.von,
      b: x.bis,
      g: x.g,
      ...(x.k ? { k: x.k } : {}),
      ...(x.o && x.o !== x.n ? { o: x.o } : {}),
    }))

  return [
    ...formen(fahrer, 'f'),
    ...formen(teams, 't'),
    ...formen(strecken, 's'),
    ...formen(motoren, 'm'),
    ...formen(saisons, 'j'),
    ...formen(rennen, 'r'),
  ]
}
