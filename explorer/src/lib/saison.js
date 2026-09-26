import { alle, eine, rennenListe } from './db.js'
import { streichregel, sprintFuer, systemFuer } from '../engine/punkte.js'

/**
 * Alles über eine Saison, an einer Stelle – für die Saisonseite und die API.
 *
 * Vorher standen dreizehn Abfragen in der Seite selbst. Hier sind sie
 * beieinander, und die Seite ist wieder Darstellung.
 */
export function saisonDaten(jahr) {
  const saison = eine(
    `SELECT s.*, (SELECT COUNT(*) FROM race WHERE year = s.year) AS rennen FROM season s WHERE s.year = ?`,
    jahr,
  )
  if (!saison) return null

  /*
   * Die Teams eines Fahrers als Liste mit Kennung, nicht als ein Text: Vorher
   * stand „Ferrari,Haas“ ohne Leerzeichen und ohne Verweis in der Tabelle.
   */
  const teamsJeFahrer = new Map()
  for (const z of alle(
    `SELECT DISTINCT rr.driver_id AS fahrer, k.id, k.name
       FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN constructor k ON k.id = rr.constructor_id
      WHERE r.year = ? ORDER BY r.round`,
    jahr,
  )) {
    const l = teamsJeFahrer.get(z.fahrer) ?? []
    if (!l.some((t) => t.id === z.id)) l.push({ id: z.id, name: z.name })
    teamsJeFahrer.set(z.fahrer, l)
  }

  const fahrerWertung = alle(
    `SELECT sds.position, sds.position_text AS text, sds.points, sds.championship_won AS meister,
            d.id, d.display_name AS name, d.abbreviation AS kuerzel,
            (SELECT COUNT(*) FROM race_result rr JOIN race r ON r.id = rr.race_id
              WHERE r.year = ?1 AND rr.driver_id = d.id AND rr.position = 1) AS siege,
            (SELECT COUNT(*) FROM sprint_result sr JOIN race r ON r.id = sr.race_id
              WHERE r.year = ?1 AND sr.driver_id = d.id AND sr.position = 1) AS sprintSiege
       FROM season_driver_standing sds
       JOIN driver d ON d.id = sds.driver_id
      WHERE sds.year = ?1
      ORDER BY sds.position IS NULL, sds.position`,
    jahr,
  ).map((f) => ({ ...f, teams: teamsJeFahrer.get(f.id) ?? [] }))

  const teamWertung = alle(
    `SELECT scs.position, scs.points, scs.championship_won AS meister, k.id, k.name
       FROM season_constructor_standing scs
       JOIN constructor k ON k.id = scs.constructor_id
      WHERE scs.year = ? ORDER BY scs.position`,
    jahr,
  )

  /* Der Kalender mit Pole und schnellster Runde je Rennen. */
  const pole = new Map(
    alle(
      `SELECT rr.race_id AS id, d.id AS fahrerId, d.display_name AS name
         FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN driver d ON d.id = rr.driver_id
        WHERE r.year = ? AND rr.qualifying_position = 1`,
      jahr,
    ).map((z) => [z.id, z]),
  )
  const schnellste = new Map(
    alle(
      `SELECT rr.race_id AS id, d.id AS fahrerId, d.display_name AS name
         FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN driver d ON d.id = rr.driver_id
        WHERE r.year = ? AND rr.fastest_lap = 1`,
      jahr,
    ).map((z) => [z.id, z]),
  )
  const kalender = rennenListe(jahr)
    .sort((a, b) => a.runde - b.runde)
    .map((r) => ({ ...r, pole: pole.get(r.id) ?? null, schnellste: schnellste.get(r.id) ?? null }))

  const kennzahlen = eine(
    `SELECT COUNT(DISTINCT CASE WHEN rr.position = 1 THEN rr.driver_id END) AS sieger,
            COUNT(DISTINCT CASE WHEN rr.qualifying_position = 1 THEN rr.driver_id END) AS polesetter,
            SUM(CASE WHEN rr.started = 1 THEN 1 ELSE 0 END) AS starts,
            SUM(CASE WHEN rr.started = 1 AND rr.classified = 0 THEN 1 ELSE 0 END) AS ausfaelle
       FROM race_result rr JOIN race r ON r.id = rr.race_id WHERE r.year = ?`,
    jahr,
  )

  /*
   * Die Ergebnismatrix: jeder Fahrer, jedes Rennen. Das ist die Ansicht, mit
   * der man eine Saison liest – wer wann wo stand –, und sie fehlte. Je Fahrer
   * und Rennen das beste Ergebnis, falls er zwei Autos fuhr.
   */
  const zellen = new Map()
  for (const z of alle(
    `SELECT rr.driver_id AS fahrer, r.round AS runde, MIN(rr.position) AS platz,
            MAX(rr.classified) AS gewertet, MAX(rr.started) AS gestartet,
            MIN(rr.position_text) AS text, SUM(rr.points) AS punkte, MAX(rr.fastest_lap) AS schnellste,
            MAX(CASE WHEN rr.qualifying_position = 1 THEN 1 ELSE 0 END) AS pole
       FROM race_result rr JOIN race r ON r.id = rr.race_id
      WHERE r.year = ? GROUP BY rr.driver_id, r.round`,
    jahr,
  )) {
    zellen.set(`${z.fahrer}|${z.runde}`, z)
  }

  /* Der Punkteverlauf der Konstrukteure, wie der der Fahrer aus den Zwischenständen. */
  const teamStaende = alle(
    `SELECT r.round AS runde, s.constructor_id AS id, s.points AS punkte
       FROM race_constructor_standing s JOIN race r ON r.id = s.race_id
      WHERE r.year = ? ORDER BY r.round`,
    jahr,
  )

  /*
   * Die Nennliste: wer mit welchem Chassis, Motor und Reifen antrat. F1DB
   * führt das je Meldung – „Rob Walker Racing“ meldete einen Cooper –, und so
   * steht es hier.
   */
  const nennungen = alle(
    `SELECT e.id AS meldung, e.name AS meldungName, k.id AS teamId, k.name AS team,
            m.id AS motorId, m.name AS motorHersteller,
            (SELECT GROUP_CONCAT(c.name, ', ') FROM season_entrant_chassis sc JOIN chassis c ON c.id = sc.chassis_id
              WHERE sc.year = sed.year AND sc.entrant_id = sed.entrant_id AND sc.constructor_id = sed.constructor_id
                AND sc.engine_manufacturer_id = sed.engine_manufacturer_id) AS chassis,
            (SELECT GROUP_CONCAT(COALESCE(en.full_name, en.name), ', ') FROM season_entrant_engine se JOIN engine en ON en.id = se.engine_id
              WHERE se.year = sed.year AND se.entrant_id = sed.entrant_id AND se.constructor_id = sed.constructor_id
                AND se.engine_manufacturer_id = sed.engine_manufacturer_id) AS motor,
            (SELECT GROUP_CONCAT(t.name, ', ') FROM season_entrant_tyre st JOIN tyre_manufacturer t ON t.id = st.tyre_manufacturer_id
              WHERE st.year = sed.year AND st.entrant_id = sed.entrant_id AND st.constructor_id = sed.constructor_id
                AND st.engine_manufacturer_id = sed.engine_manufacturer_id) AS reifen,
            GROUP_CONCAT(sed.driver_id, '|') AS fahrerIds
       FROM season_entrant_driver sed
       JOIN entrant e ON e.id = sed.entrant_id
       JOIN constructor k ON k.id = sed.constructor_id
       JOIN engine_manufacturer m ON m.id = sed.engine_manufacturer_id
      WHERE sed.year = ? AND sed.test_driver = 0
      GROUP BY sed.entrant_id, sed.constructor_id, sed.engine_manufacturer_id
      ORDER BY k.name, e.name`,
    jahr,
  )
  const fahrerNamen = new Map(alle('SELECT id, display_name AS name FROM driver').map((d) => [d.id, d.name]))
  const mitErgebnis = new Set(alle('SELECT DISTINCT driver_id AS id FROM race_result').map((z) => z.id))
  for (const n of nennungen) {
    n.fahrer = [...new Set(n.fahrerIds.split('|'))].map((id) => ({ id, name: fahrerNamen.get(id) ?? id, mitSeite: mitErgebnis.has(id) }))
  }

  /* Das Punktesystem der Saison, in Worten – aus punkte.js, nicht aus einem Text hier. */
  const system = systemFuer(jahr)
  const sprint = sprintFuer(jahr)
  const regel = streichregel(jahr)
  const regelText =
    regel === null
      ? null
      : typeof regel === 'number'
        ? `Only the best ${regel} results counted towards the championship.`
        : `The season was split in two: the best ${regel[0].beste} of the first ${regel[0].rennen} races counted, and the best ${regel[1].beste} of the rest.`

  return {
    saison, fahrerWertung, teamWertung, kalender, kennzahlen, zellen, teamStaende, nennungen,
    punkte: { system, sprint, regelText },
  }
}
