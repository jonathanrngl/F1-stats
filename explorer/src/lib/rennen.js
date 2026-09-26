import { alle, eine } from './db.js'

/**
 * Alles über ein Rennen, an einer Stelle – für die Rennseite und die JSON-API.
 *
 * Die Rennseite zeigte bisher Ergebnis und Boxenstopp-Anzahl. In der Datenbank
 * lagen daneben das Qualifying mit allen drei Segmenten, die Startaufstellung
 * mit 587 Strafversetzungen, jeder Sprint, jeder einzelne Boxenstopp mit Runde
 * und Dauer, die schnellsten Runden mit Zeit und der Stand der Meisterschaft –
 * gelesen wurde davon nichts. Das ist die Seite, die man nach einem Rennen
 * aufschlägt; sie soll das zeigen.
 */
export function rennDaten(id) {
  const rennen = eine(
    `SELECT r.*, g.name AS gpName, COALESCE(g.full_name, g.name || ' Grand Prix') AS gpVoll,
            z.name AS strecke, z.place_name AS ort, c.name AS land, c.ioc AS ioc, c.demonym AS demonym,
            l.length_km AS layoutLaenge
       FROM race r
       JOIN grand_prix g ON g.id = r.grand_prix_id
       JOIN circuit z ON z.id = r.circuit_id
       LEFT JOIN country c ON c.id = z.country_id
       LEFT JOIN circuit_layout l ON l.id = r.circuit_layout_id
      WHERE r.id = ?`,
    id,
  )
  if (!rennen) return null

  /*
   * Ergebnisse in der Reihenfolge der Anzeige: Erst die Gewerteten nach Platz,
   * danach Ausfälle und Nichtstarter. display_order aus F1DB trägt genau das.
   */
  const ergebnisse = alle(
    `SELECT rr.*, d.display_name AS fahrer, d.id AS fahrerId, d.abbreviation AS kuerzel,
            k.name AS team, k.id AS teamId, m.name AS motor, m.id AS motorId, t.name AS reifen
       FROM race_result rr
       JOIN driver d ON d.id = rr.driver_id
       JOIN constructor k ON k.id = rr.constructor_id
       LEFT JOIN engine_manufacturer m ON m.id = rr.engine_id
       LEFT JOIN tyre_manufacturer t ON t.id = rr.tyre_id
      WHERE rr.race_id = ?
      ORDER BY rr.display_order`,
    id,
  )

  const qualifying = alle(
    `SELECT q.position, q.position_text AS text, q.time_ms AS zeit, q.q1_ms AS q1, q.q2_ms AS q2, q.q3_ms AS q3,
            q.gap_ms AS abstand, d.display_name AS fahrer, d.id AS fahrerId, k.name AS team, k.id AS teamId
       FROM qualifying_result q
       JOIN driver d ON d.id = q.driver_id
       JOIN constructor k ON k.id = q.constructor_id
      WHERE q.race_id = ?
      ORDER BY q.position IS NULL, q.position`,
    id,
  )

  const startaufstellung = alle(
    `SELECT g.position, g.position_text AS text, g.qualifying_position AS quali,
            g.grid_penalty AS strafe, g.grid_penalty_positions AS strafPlaetze,
            d.display_name AS fahrer, d.id AS fahrerId, k.name AS team, k.id AS teamId
       FROM starting_grid g
       JOIN driver d ON d.id = g.driver_id
       JOIN constructor k ON k.id = g.constructor_id
      WHERE g.race_id = ?
      ORDER BY g.position IS NULL, g.position`,
    id,
  )

  const sprint = alle(
    `SELECT s.position, s.position_text AS text, s.classified AS gewertet, s.grid_position AS start, s.points AS punkte,
            d.display_name AS fahrer, d.id AS fahrerId, k.name AS team, k.id AS teamId
       FROM sprint_result s
       JOIN driver d ON d.id = s.driver_id
       JOIN constructor k ON k.id = s.constructor_id
      WHERE s.race_id = ?
      ORDER BY s.position IS NULL, s.position`,
    id,
  )

  const stopps = alle(
    `SELECT p.stop AS stopp, p.lap AS runde, p.duration_ms AS dauer,
            d.display_name AS fahrer, d.id AS fahrerId
       FROM pit_stop p JOIN driver d ON d.id = p.driver_id
      WHERE p.race_id = ?
      ORDER BY p.lap, p.duration_ms`,
    id,
  )

  const schnellsteRunden = alle(
    `SELECT f.position, f.lap AS runde, f.time_ms AS zeit, f.gap_ms AS abstand,
            d.display_name AS fahrer, d.id AS fahrerId, k.name AS team, k.id AS teamId
       FROM fastest_lap f
       JOIN driver d ON d.id = f.driver_id
       JOIN constructor k ON k.id = f.constructor_id
      WHERE f.race_id = ?
      ORDER BY f.position IS NULL, f.position`,
    id,
  )

  const fahrerDesTages = eine(
    `SELECT d.display_name AS fahrer, d.id AS fahrerId, o.percentage AS anteil
       FROM driver_of_the_day o JOIN driver d ON d.id = o.driver_id
      WHERE o.race_id = ? AND o.position = 1`,
    id,
  )

  /*
   * Der Stand der Meisterschaft nach diesem Rennen, und wie er sich bewegt
   * hat: der Vergleich mit dem Stand nach dem Rennen davor.
   */
  const vorheriges = eine(
    `SELECT id FROM race WHERE year = ? AND round < ?
        AND EXISTS (SELECT 1 FROM race_driver_standing s WHERE s.race_id = race.id)
      ORDER BY round DESC LIMIT 1`,
    rennen.year, rennen.round,
  )
  const stand = (tabelle, spalte, name, zielId) =>
    alle(
      `SELECT s.position, s.points AS punkte, x.id AS id, x.${name} AS name,
              (SELECT v.position FROM ${tabelle} v WHERE v.race_id = ? AND v.${spalte} = s.${spalte}) AS vorher
         FROM ${tabelle} s JOIN ${zielId} x ON x.id = s.${spalte}
        WHERE s.race_id = ?
        ORDER BY s.position IS NULL, s.position
        LIMIT 10`,
      vorheriges?.id ?? '', id,
    )
  const fahrerStand = stand('race_driver_standing', 'driver_id', 'display_name', 'driver')
  const teamStand = stand('race_constructor_standing', 'constructor_id', 'name', 'constructor')

  const nachbarn = alle(
    `SELECT r.id, r.round, COALESCE(g.full_name, g.name) AS name
       FROM race r JOIN grand_prix g ON g.id = r.grand_prix_id
      WHERE r.year = ? AND r.round IN (?, ?)`,
    rennen.year, rennen.round - 1, rennen.round + 1,
  )

  /** Wie viele Stopps je Fahrer, und sein schnellster – die Zusammenfassung über der Einzelliste. */
  const jeFahrer = new Map()
  for (const s of stopps) {
    const e = jeFahrer.get(s.fahrerId) ?? { fahrerId: s.fahrerId, fahrer: s.fahrer, stopps: 0, schnellster: null, runden: [] }
    e.stopps++
    e.runden.push(s.runde)
    if (s.dauer !== null && (e.schnellster === null || s.dauer < e.schnellster)) e.schnellster = s.dauer
    jeFahrer.set(s.fahrerId, e)
  }

  /*
   * Runde für Runde, wo es sie gibt – seit 1996, und nur für die Rennen, die
   * lade-runden.mjs schon geholt hat. Je Fahrer eine Liste der Positionen,
   * null für Runden, in denen er nicht mehr fuhr.
   */
  const rundenZeilen = alle(
    'SELECT driver_id AS id, lap AS runde, position FROM lap_position WHERE race_id = ? ORDER BY lap',
    id,
  )
  let runden = null
  if (rundenZeilen.length) {
    const letzte = Math.max(...rundenZeilen.map((z) => z.runde))
    const jeFahrer = new Map()
    for (const z of rundenZeilen) {
      if (!jeFahrer.has(z.id)) jeFahrer.set(z.id, new Array(letzte).fill(null))
      jeFahrer.get(z.id)[z.runde - 1] = z.position
    }
    const inReihenfolge = [...new Set(ergebnisse.map((e) => e.fahrerId))].filter((f) => jeFahrer.has(f))
    runden = {
      anzahl: letzte,
      fahrer: inReihenfolge.map((f) => {
        const e = ergebnisse.find((x) => x.fahrerId === f)
        const pos = jeFahrer.get(f)
        return {
          id: f,
          name: e.fahrer,
          kuerzel: e.kuerzel ?? e.fahrer.split(' ').at(-1).slice(0, 3).toUpperCase(),
          start: e.grid_position,
          ziel: e.position,
          positionen: pos,
          gefuehrt: pos.filter((p) => p === 1).length,
        }
      }),
    }
  }

  return {
    rennen,
    runden,
    gefahren: ergebnisse.length > 0,
    ergebnisse,
    qualifying,
    startaufstellung,
    /** Nur Strafversetzungen – sonst ist die Startaufstellung das Qualifying noch einmal. */
    strafen: startaufstellung.filter((g) => g.strafe || g.strafPlaetze),
    sprint,
    stopps,
    stoppsJeFahrer: [...jeFahrer.values()].sort((a, b) => a.stopps - b.stopps || (a.schnellster ?? 9e9) - (b.schnellster ?? 9e9)),
    schnellsteRunden,
    fahrerDesTages,
    fahrerStand,
    teamStand,
    vorher: nachbarn.find((n) => n.round === rennen.round - 1) ?? null,
    nachher: nachbarn.find((n) => n.round === rennen.round + 1) ?? null,
  }
}
