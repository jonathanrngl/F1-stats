import { mean, metric, rate } from './metric.js'

/**
 * Kennzahlen zu einer Strecke.
 *
 * Die interessante Frage einer Streckenseite ist nicht, wie oft dort gefahren
 * wurde, sondern wer dort auffällig gut war. Dafür braucht es einen Vergleich
 * mit der eigenen Normalform: Ein Fahrer, der überall gewinnt, ist in Monaco
 * kein Spezialist.
 */

/** Alle Rennen auf dieser Strecke, neueste zuerst. */
export function circuitRaces(db, circuitId) {
  return db
    .prepare(
      `SELECT r.id, r.year, r.round, g.name AS grandPrix, r.date,
              r.course_length_km AS laenge, r.laps AS runden,
              (SELECT rr.driver_id FROM race_result rr WHERE rr.race_id = r.id AND rr.position = 1 ORDER BY rr.display_order LIMIT 1) AS siegerId,
              (SELECT d.display_name FROM race_result rr JOIN driver d ON d.id = rr.driver_id
                WHERE rr.race_id = r.id AND rr.position = 1 ORDER BY rr.display_order LIMIT 1) AS sieger,
              (SELECT rr.constructor_id FROM race_result rr WHERE rr.race_id = r.id AND rr.position = 1 ORDER BY rr.display_order LIMIT 1) AS siegerTeamId,
              (SELECT k.name FROM race_result rr JOIN constructor k ON k.id = rr.constructor_id
                WHERE rr.race_id = r.id AND rr.position = 1 ORDER BY rr.display_order LIMIT 1) AS siegerTeam,
              (SELECT rr.grid_position FROM race_result rr WHERE rr.race_id = r.id AND rr.position = 1 ORDER BY rr.display_order LIMIT 1) AS siegerStart
         FROM race r
         JOIN grand_prix g ON g.id = r.grand_prix_id
        WHERE r.circuit_id = ?
        ORDER BY r.year DESC`,
    )
    .all(circuitId)
}

/** Bestenliste nach Siegen, Podien oder Poles auf dieser Strecke. */
export function circuitLeaders(db, circuitId, art = 'siege', anzahl = 10) {
  const bedingung = {
    siege: 'rr.position = 1',
    podien: 'rr.classified = 1 AND rr.position <= 3',
    poles: 'rr.qualifying_position = 1',
  }[art]

  return db
    .prepare(
      `SELECT rr.driver_id AS id, d.display_name AS name, COUNT(*) AS anzahl,
              MIN(r.year) AS von, MAX(r.year) AS bis
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE r.circuit_id = ? AND ${bedingung}
        GROUP BY rr.driver_id
        ORDER BY anzahl DESC, von
        LIMIT ?`,
    )
    .all(circuitId, anzahl)
}

export function circuitTeamLeaders(db, circuitId, anzahl = 10) {
  return db
    .prepare(
      `SELECT rr.constructor_id AS id, k.name, COUNT(DISTINCT rr.race_id) AS anzahl
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN constructor k ON k.id = rr.constructor_id
        WHERE r.circuit_id = ? AND rr.position = 1
        GROUP BY rr.constructor_id
        ORDER BY anzahl DESC
        LIMIT ?`,
    )
    .all(circuitId, anzahl)
}

/** Kennzahlen der Strecke: Ausfallquote, Pole-zu-Sieg, Aufholjagden. */
export function circuitStats(db, circuitId) {
  const z = db
    .prepare(
      `SELECT COUNT(DISTINCT r.id) AS rennen,
              SUM(CASE WHEN rr.started = 1 THEN 1 ELSE 0 END) AS starts,
              SUM(CASE WHEN rr.started = 1 AND rr.classified = 0 THEN 1 ELSE 0 END) AS ausfaelle
         FROM race r JOIN race_result rr ON rr.race_id = r.id
        WHERE r.circuit_id = ?`,
    )
    .get(circuitId)

  const polezuSieg = db
    .prepare(
      `SELECT COUNT(*) AS poles,
              SUM(CASE WHEN rr.position = 1 THEN 1 ELSE 0 END) AS siege
         FROM race_result rr JOIN race r ON r.id = rr.race_id
        WHERE r.circuit_id = ? AND rr.qualifying_position = 1`,
    )
    .get(circuitId)

  const vonHinten = db
    .prepare(
      `SELECT d.display_name AS name, rr.driver_id AS id, r.year, rr.grid_position AS start
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE r.circuit_id = ? AND rr.position = 1 AND rr.grid_position IS NOT NULL
        ORDER BY rr.grid_position DESC LIMIT 1`,
    )
    .get(circuitId)

  const startPlaetze = db
    .prepare(
      `SELECT rr.grid_position AS g FROM race_result rr JOIN race r ON r.id = rr.race_id
        WHERE r.circuit_id = ? AND rr.position = 1 AND rr.grid_position IS NOT NULL`,
    )
    .all(circuitId)
    .map((x) => x.g)

  return {
    rennen: z.rennen,
    ausfallquote: rate(z.ausfaelle ?? 0, z.starts ?? 0),
    poleZuSieg: rate(polezuSieg.siege ?? 0, polezuSieg.poles ?? 0),
    mittlererSiegerStart: mean(startPlaetze, { minSample: 3 }),
    groessteAufholjagd: vonHinten ?? null,
  }
}

/**
 * Streckenspezialisten.
 *
 * Verglichen wird die mittlere Zielposition auf dieser Strecke mit der des
 * Fahrers überall sonst. Wer hier im Schnitt drei Plätze besser abschneidet
 * als sonst, kann die Strecke – unabhängig davon, wie gut sein Auto war.
 *
 * Mindestens `minStarts` Starts hier und ebenso viele anderswo, sonst ist der
 * Vergleich Rauschen: Ein einzelnes gutes Rennen macht keinen Spezialisten.
 */
export function circuitSpecialists(db, circuitId, minStarts = 3, anzahl = 8) {
  const zeilen = db
    .prepare(
      `SELECT rr.driver_id AS id, d.display_name AS name,
              AVG(CASE WHEN r.circuit_id = ?1 THEN rr.position END) AS hier,
              AVG(CASE WHEN r.circuit_id <> ?1 THEN rr.position END) AS sonst,
              COUNT(CASE WHEN r.circuit_id = ?1 THEN 1 END) AS startsHier,
              COUNT(CASE WHEN r.circuit_id <> ?1 THEN 1 END) AS startsSonst,
              COUNT(CASE WHEN r.circuit_id = ?1 AND rr.position = 1 THEN 1 END) AS siegeHier
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE rr.classified = 1 AND rr.position IS NOT NULL
        GROUP BY rr.driver_id
       HAVING startsHier >= ?2 AND startsSonst >= ?2`,
    )
    .all(circuitId, minStarts)

  return zeilen
    .map((z) => ({
      id: z.id,
      name: z.name,
      startsHier: z.startsHier,
      siegeHier: z.siegeHier,
      hier: z.hier,
      sonst: z.sonst,
      // Positiv heißt: hier besser als sonst.
      vorteil: z.sonst - z.hier,
    }))
    .sort((a, b) => b.vorteil - a.vorteil)
    .slice(0, anzahl)
}

/**
 * Die Streckenführungen mit dem Zeitraum, in dem sie gefahren wurden.
 *
 * Der Zeitraum steht in keiner Spalte – F1DB markiert nur, welches Layout
 * heute gilt. Er kommt deshalb aus den Rennen, die darauf stattfanden. Das
 * ist die belastbarere Angabe: Sie beschreibt, was gefahren wurde, nicht was
 * geplant war.
 */
export function circuitLayouts(db, circuitId) {
  return db
    .prepare(
      `SELECT l.id, l.is_current AS aktuell, l.length_km AS laenge, l.turns AS kurven,
              COUNT(r.id) AS rennen, MIN(r.year) AS von, MAX(r.year) AS bis
         FROM circuit_layout l
         LEFT JOIN race r ON r.circuit_layout_id = l.id
        WHERE l.circuit_id = ?
        GROUP BY l.id
        ORDER BY von`,
    )
    .all(circuitId)
}

/**
 * Der Rundenrekord je Streckenführung: die schnellste Rennrunde, die je auf
 * diesem Layout gefahren wurde.
 *
 * Je Layout, nicht je Strecke. Silverstone 1987 und Silverstone 2024 teilen
 * sich den Namen, nicht den Kurs – ein Rekord über beide hinweg verglich eine
 * Runde über 4,7 km mit einer über 5,9 km. Aus dem Rennen, nicht aus dem
 * Qualifying: So zählt die Formel 1 den Rundenrekord.
 */
export function circuitLapRecords(db, circuitId) {
  return db
    .prepare(
      `SELECT r.circuit_layout_id AS layout, f.time_ms AS zeit, f.lap AS runde,
              r.id AS raceId, r.year AS jahr, d.id AS fahrerId, d.display_name AS fahrer
         FROM fastest_lap f
         JOIN race r ON r.id = f.race_id
         JOIN driver d ON d.id = f.driver_id
        WHERE r.circuit_id = ? AND f.position = 1 AND f.time_ms IS NOT NULL
          AND f.time_ms = (SELECT MIN(f2.time_ms) FROM fastest_lap f2 JOIN race r2 ON r2.id = f2.race_id
                            WHERE r2.circuit_layout_id = r.circuit_layout_id AND f2.time_ms IS NOT NULL)
        ORDER BY r.year`,
    )
    .all(circuitId)
}

export const ausfallquote = (db, circuitId) => circuitStats(db, circuitId).ausfallquote
export const streckenMetrik = metric
