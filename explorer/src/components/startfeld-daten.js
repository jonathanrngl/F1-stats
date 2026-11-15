/*
 * Das aktuelle Startfeld: wer im jüngsten Rennen mit Ergebnis gefahren ist,
 * für welches Team, mit welcher Nummer, und wie Fahrer und Teams in der
 * Saison stehen. Daraus bauen Fahrerkarten.astro und Teamkarten.astro die
 * Karten auf /drivers/ und /teams/.
 *
 * Das Feld kommt aus dem Rennen, nicht aus der Meldeliste der Saison: Die
 * führt jeden, der einmal gefahren ist, auch Ersatzleute für drei Rennen und
 * Testfahrer. Wer im letzten Rennen saß, ist das Feld von heute.
 */
import { alle, eine } from '../lib/db.js'

export function startfeld() {
  const rennen = eine(
    `SELECT r.id, r.year AS jahr, r.round AS runde,
            COALESCE(g.full_name, g.name || ' Grand Prix') AS grandPrix
       FROM race r
       JOIN grand_prix g ON g.id = r.grand_prix_id
      WHERE EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)
      ORDER BY r.date DESC, r.round DESC
      LIMIT 1`,
  )
  if (!rennen) return null

  /* Geteilte Autos der Frühzeit gibt es heute nicht mehr; GROUP BY hält trotzdem jeden Fahrer einmal. */
  const fahrer = alle(
    `SELECT rr.driver_id AS id, d.first_name AS vorname, d.last_name AS nachname,
            MIN(rr.car_number) AS nummer, rr.constructor_id AS teamId, k.name AS team,
            s.position, s.points AS punkte
       FROM race_result rr
       JOIN driver d ON d.id = rr.driver_id
       JOIN constructor k ON k.id = rr.constructor_id
       LEFT JOIN season_driver_standing s ON s.year = ? AND s.driver_id = rr.driver_id
      WHERE rr.race_id = ?
      GROUP BY rr.driver_id
      ORDER BY s.position IS NULL, s.position, MIN(rr.display_order)`,
    rennen.jahr,
    rennen.id,
  )

  const teams = alle(
    `SELECT s.constructor_id AS id, k.name, s.position, s.points AS punkte
       FROM season_constructor_standing s
       JOIN constructor k ON k.id = s.constructor_id
      WHERE s.year = ?
      ORDER BY s.position`,
    rennen.jahr,
  )
    .map((t) => ({ ...t, fahrer: fahrer.filter((f) => f.teamId === t.id) }))
    /* Ein Team, das im letzten Rennen nicht am Start stand, gehört nicht mehr zum Feld. */
    .filter((t) => t.fahrer.length > 0)

  return { ...rennen, fahrer, teams }
}
