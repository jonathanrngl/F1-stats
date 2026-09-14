import { mean, metric, rate, unknown } from './metric.js'

/**
 * Kennzahlen zu einem Konstrukteur.
 *
 * Ein Team ist nicht einfach die Summe seiner Fahrer. Zwei Dinge sind anders
 * als beim Fahrerprofil:
 *
 *   Ein Rennen zählt einmal, auch wenn zwei Autos antraten. „Starts" heißt
 *   hier gefahrene Rennen, nicht gefahrene Autos – sonst hätte jedes
 *   Zweiwagenteam doppelt so viele Starts wie Rennen.
 *
 *   Ein Doppelsieg ist ein eigenes Ereignis: beide Autos auf den ersten zwei
 *   Plätzen. Er steckt in keiner Fahrerzahl.
 */

/** Alle Ergebniszeilen eines Teams, nach Rennen gebündelt. */
export function constructorRaces(db, constructorId, filter = {}) {
  const wo = []
  const p = [constructorId]
  if (filter.fromYear !== undefined) {
    wo.push('r.year >= ?')
    p.push(filter.fromYear)
  }
  if (filter.toYear !== undefined) {
    wo.push('r.year <= ?')
    p.push(filter.toYear)
  }

  const zeilen = db
    .prepare(
      `SELECT r.id AS raceId, r.year, r.round, r.circuit_id AS circuitId,
              rr.driver_id AS driverId, rr.position, rr.classified, rr.started,
              rr.grid_position AS grid, rr.qualifying_position AS qualifying,
              rr.pole_position AS pole, rr.fastest_lap AS fastestLap, rr.points
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
        WHERE rr.constructor_id = ?${wo.length ? ' AND ' + wo.join(' AND ') : ''}
        ORDER BY r.year, r.round`,
    )
    .all(...p)

  const proRennen = new Map()
  for (const z of zeilen) {
    const e = proRennen.get(z.raceId) ?? {
      raceId: z.raceId,
      year: z.year,
      round: z.round,
      circuitId: z.circuitId,
      autos: [],
    }
    e.autos.push(z)
    proRennen.set(z.raceId, e)
  }
  return [...proRennen.values()]
}

const spanne = (rennen) =>
  rennen.length === 0 ? null : { firstYear: rennen[0].year, lastYear: rennen.at(-1).year }

/** Gefahrene Rennen, nicht gefahrene Autos. */
export const calculateTeamStarts = (rennen) =>
  metric(rennen.filter((r) => r.autos.some((a) => a.started)).length, rennen.length, spanne(rennen))

/** Bestes Ergebnis des Teams je Rennen. */
const bestesAuto = (r) => {
  const gewertet = r.autos.filter((a) => a.classified && a.position !== null)
  return gewertet.length ? Math.min(...gewertet.map((a) => a.position)) : null
}

export const calculateTeamWins = (rennen) =>
  metric(rennen.filter((r) => bestesAuto(r) === 1).length, rennen.length, spanne(rennen))

/** Podien als Rennen mit mindestens einem Auto unter den ersten drei. */
export const calculateTeamPodiums = (rennen) =>
  metric(
    rennen.filter((r) => {
      const b = bestesAuto(r)
      return b !== null && b <= 3
    }).length,
    rennen.length,
    spanne(rennen),
  )

/**
 * Doppelsiege: beide Autos auf den Plätzen eins und zwei.
 *
 * Ein eigenes Ereignis, das in keiner Fahrerzahl steckt – und die schärfste
 * Aussage über die Überlegenheit eines Autos.
 */
export function calculateOneTwos(rennen) {
  const n = rennen.filter((r) => {
    const plaetze = r.autos
      .filter((a) => a.classified && a.position !== null)
      .map((a) => a.position)
      .sort((x, y) => x - y)
    return plaetze[0] === 1 && plaetze[1] === 2
  }).length
  return metric(n, rennen.length, spanne(rennen))
}

export const calculateTeamPoles = (rennen) =>
  metric(rennen.filter((r) => r.autos.some((a) => a.qualifying === 1)).length, rennen.length, spanne(rennen))

export const calculateTeamFastestLaps = (rennen) =>
  metric(rennen.filter((r) => r.autos.some((a) => a.fastestLap)).length, rennen.length, spanne(rennen))

export const calculateTeamPoints = (rennen) =>
  metric(
    rennen.reduce((s, r) => s + r.autos.reduce((t, a) => t + (a.points ?? 0), 0), 0),
    rennen.length,
    spanne(rennen),
  )

/**
 * Zuverlässigkeit: Anteil der Autos, die ins Ziel kamen.
 *
 * Hier zählen Autos, nicht Rennen – die Frage lautet, wie oft die Technik
 * hielt, und jedes Auto ist ein eigener Versuch.
 */
export function calculateTeamReliability(rennen) {
  const autos = rennen.flatMap((r) => r.autos).filter((a) => a.started)
  return rate(autos.filter((a) => a.classified).length, autos.length, spanne(rennen))
}

export const calculateTeamAverageFinish = (rennen) =>
  mean(
    rennen.flatMap((r) => r.autos).filter((a) => a.classified && a.position !== null).map((a) => a.position),
    { minSample: 3, coverage: spanne(rennen) },
  )

export const calculateTeamAverageStart = (rennen) =>
  mean(
    rennen.flatMap((r) => r.autos).filter((a) => a.started && a.grid !== null).map((a) => a.grid),
    { minSample: 3, coverage: spanne(rennen) },
  )

/** Konstrukteurstitel aus der Wertung – nicht aus den Rennpunkten. */
export function calculateTeamChampionships(db, constructorId) {
  const zeilen = db
    .prepare(
      `SELECT year, position, points, championship_won AS won
         FROM season_constructor_standing WHERE constructor_id = ? ORDER BY year`,
    )
    .all(constructorId)

  if (zeilen.length === 0) {
    return { titles: metric(0, 0, null), best: unknown('Nie in einer Konstrukteurswertung geführt.'), seasons: [] }
  }
  const deckung = { firstYear: zeilen[0].year, lastYear: zeilen.at(-1).year }
  const plaetze = zeilen.map((z) => z.position).filter((p) => p !== null)
  return {
    titles: metric(zeilen.filter((z) => z.won).length, zeilen.length, deckung),
    best: plaetze.length ? metric(Math.min(...plaetze), zeilen.length, deckung) : unknown('Keine Platzierung überliefert.'),
    seasons: zeilen,
  }
}

/** Welche Fahrer für dieses Team antraten, mit Jahren und Bilanz. */
export function calculateTeamDrivers(db, constructorId) {
  return db
    .prepare(
      `SELECT rr.driver_id AS driverId, d.full_name AS name,
              MIN(r.year) AS von, MAX(r.year) AS bis,
              COUNT(DISTINCT CASE WHEN rr.started = 1 THEN rr.race_id END) AS starts,
              COUNT(DISTINCT CASE WHEN rr.position = 1 THEN rr.race_id END) AS siege,
              SUM(rr.points) AS punkte
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE rr.constructor_id = ?
        GROUP BY rr.driver_id
        ORDER BY siege DESC, starts DESC`,
    )
    .all(constructorId)
}

/**
 * Vorgänger und Nachfolger eines Rennstalls.
 *
 * Jaguar wurde Red Bull, Toro Rosso wurde AlphaTauri wurde RB. F1DB führt
 * diese Abstammung, und ohne sie ist jede Team-Historie unvollständig.
 */
export function calculateLineage(db, constructorId) {
  const eltern = db
    .prepare('SELECT parent_id FROM constructor_chronology WHERE constructor_id = ?')
    .all(constructorId)
    .map((z) => z.parent_id)

  const wurzel = eltern[0] ?? constructorId
  return db
    .prepare(
      `SELECT ch.constructor_id AS id, k.name, ch.year_from AS von, ch.year_to AS bis
         FROM constructor_chronology ch
         JOIN constructor k ON k.id = ch.constructor_id
        WHERE ch.parent_id = ?
        ORDER BY ch.sort_order`,
    )
    .all(wurzel)
}
