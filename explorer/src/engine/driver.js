import { longestStreak, mean, metric, rate, unknown } from './metric.js'

/**
 * Kennzahlen zu einem Fahrer.
 *
 * Alle Funktionen nehmen eine geöffnete Datenbank und liefern `Metric`-Werte.
 * Sie rechnen über die Rohdaten, nie über bereits berechnete Anzeigewerte –
 * damit dieselbe Zahl im Build, in der API, in der Oberfläche und im Explorer
 * aus derselben Quelle kommt.
 *
 * Zwei Begriffe, die in der Formel 1 gern verwechselt werden und hier streng
 * getrennt sind:
 *
 *   Nennung (entry)  – der Fahrer war gemeldet
 *   Start   (start)  – der Fahrer stand in der Startaufstellung
 *
 * Wer sich nicht qualifizierte, nicht antrat oder ausgeschlossen wurde, hat
 * eine Nennung ohne Start. Aguri Suzuki kommt so auf 88 Nennungen bei 65
 * Starts. Quoten beziehen sich immer auf Starts, denn ein nicht gefahrenes
 * Rennen kann man weder gewinnen noch verlieren.
 */

/** Einschränkung auf Saisons, Strecke oder Team – jeder Filter ist optional. */
/** @typedef {{ fromYear?: number, toYear?: number, circuitId?: string, grandPrixId?: string, constructorId?: string }} Filter */

/** Baut WHERE-Bedingungen und Parameter aus einem Filter. */
function bedingungen(filter = {}) {
  const wo = []
  const p = []
  if (filter.fromYear !== undefined) {
    wo.push('r.year >= ?')
    p.push(filter.fromYear)
  }
  if (filter.toYear !== undefined) {
    wo.push('r.year <= ?')
    p.push(filter.toYear)
  }
  if (filter.circuitId) {
    wo.push('r.circuit_id = ?')
    p.push(filter.circuitId)
  }
  if (filter.grandPrixId) {
    wo.push('r.grand_prix_id = ?')
    p.push(filter.grandPrixId)
  }
  if (filter.constructorId) {
    wo.push('rr.constructor_id = ?')
    p.push(filter.constructorId)
  }
  return { sql: wo.length ? ' AND ' + wo.join(' AND ') : '', p }
}

/**
 * Alle Rennen eines Fahrers, in zeitlicher Reihenfolge, je Rennen eine Zeile.
 *
 * Die Zusammenfassung je Rennen ist nötig, weil in den 1950ern zwei Zeilen für
 * denselben Fahrer im selben Rennen stehen können – wer das Auto eines
 * Teamkollegen übernahm, wurde doppelt gewertet. Gezählt wird das beste
 * Ergebnis, der beste Startplatz und die Summe der Punkte.
 */
export function driverRaces(db, driverId, filter = {}) {
  const { sql, p } = bedingungen(filter)
  return db
    .prepare(
      `SELECT r.id            AS raceId,
              r.year          AS year,
              r.round         AS round,
              r.grand_prix_id AS grandPrixId,
              r.circuit_id    AS circuitId,
              r.date          AS date,
              MAX(rr.started)             AS started,
              MAX(rr.classified)          AS classified,
              MIN(rr.position)            AS position,
              MIN(rr.grid_position)       AS grid,
              MIN(rr.qualifying_position) AS qualifying,
              MAX(rr.pole_position)       AS pole,
              MAX(rr.fastest_lap)         AS fastestLap,
              MAX(rr.shared_car)          AS sharedCar,
              SUM(rr.points)              AS points,
              MIN(rr.constructor_id)      AS constructorId
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
        WHERE rr.driver_id = ?${sql}
        GROUP BY r.id
        ORDER BY r.year, r.round`,
    )
    .all(driverId, ...p)
}

/** Deckung über die tatsächlich betrachteten Rennen. */
function spanne(rennen) {
  if (rennen.length === 0) return null
  return { firstYear: rennen[0].year, lastYear: rennen[rennen.length - 1].year }
}

export const calculateEntries = (rennen) => metric(rennen.length, rennen.length, spanne(rennen))

export const calculateStarts = (rennen) => {
  const n = rennen.filter((r) => r.started).length
  return metric(n, rennen.length, spanne(rennen))
}

const gestartet = (rennen) => rennen.filter((r) => r.started)
const gewertet = (rennen) => rennen.filter((r) => r.classified && r.position !== null)

export const calculateWins = (rennen) =>
  metric(gewertet(rennen).filter((r) => r.position === 1).length, gestartet(rennen).length, spanne(rennen))

export const calculatePodiums = (rennen) =>
  metric(gewertet(rennen).filter((r) => r.position <= 3).length, gestartet(rennen).length, spanne(rennen))

export const calculatePoints = (rennen) =>
  metric(
    rennen.reduce((s, r) => s + (r.points ?? 0), 0),
    gestartet(rennen).length,
    spanne(rennen),
  )

/*
 * Pole-Position und Startplatz 1 sind zweierlei, und die Daten führen drei
 * verschiedene Zählungen. Gemessen an Verstappen:
 *
 *   qualifying_position = 1   52   schnellster im Qualifying
 *   grid_position = 1         48   von Platz 1 losgefahren
 *   F1DB-Flag polePosition    48   folgt im Kern dem Startplatz
 *
 * Die Differenz sind Strafversetzungen: In Belgien 2024 war Verstappen
 * Schnellster und startete nach einer Motorstrafe als Elfter. Die
 * Rekordbücher schreiben ihm die Pole gut, F1DBs Flag nicht. Umgekehrt holte
 * Leclerc in Monaco 2021 die Pole und ging gar nicht an den Start.
 *
 * Bis in die 2000er fallen alle drei zusammen – Fangios 29 und Sennas 65
 * stimmen in jeder Zählung. Erst die Strafenära trennt sie.
 *
 * Diese Engine nimmt die sportliche Bedeutung: Pole ist, wer die schnellste
 * Qualifikationszeit fuhr. Wer wirklich von vorn losfuhr, steht daneben.
 */

/** Pole-Positions: schnellste Zeit im Qualifying. */
export const calculatePoles = (rennen) =>
  metric(
    rennen.filter((r) => r.qualifying === 1).length,
    gestartet(rennen).length,
    spanne(rennen),
  )

/** Rennen, die der Fahrer tatsächlich von Startplatz 1 aus begann. */
export const calculateStartsFromPole = (rennen) =>
  metric(rennen.filter((r) => r.grid === 1).length, gestartet(rennen).length, spanne(rennen))

/**
 * Zählung nach F1DBs eigenem Flag – nur für den Abgleich mit den
 * Gesamtzahlen, die F1DB mitliefert. Nicht für die Anzeige gedacht.
 */
export const calculatePolesF1DB = (rennen) =>
  metric(rennen.filter((r) => r.pole).length, gestartet(rennen).length, spanne(rennen))

export const calculateFastestLaps = (rennen) =>
  metric(rennen.filter((r) => r.fastestLap).length, gestartet(rennen).length, spanne(rennen))

/** Ausfallquote: gestartet, aber nicht gewertet. */
export function calculateDNFRate(rennen) {
  const starts = gestartet(rennen)
  const ausfaelle = starts.filter((r) => !r.classified).length
  return rate(ausfaelle, starts.length, spanne(rennen))
}

export const calculateWinRate = (rennen) =>
  rate(gewertet(rennen).filter((r) => r.position === 1).length, gestartet(rennen).length, spanne(rennen))

export const calculatePodiumRate = (rennen) =>
  rate(gewertet(rennen).filter((r) => r.position <= 3).length, gestartet(rennen).length, spanne(rennen))

/**
 * Wie oft wurde aus einer Pole ein Sieg?
 *
 * Bezugsgröße sind die Poles, nicht die Starts: Die Frage lautet „wie oft hat
 * er sie verwertet", nicht „wie oft hat er von vorn gewonnen".
 *
 * Und es sind dieselben Poles wie in `calculatePoles` – die schnellste Zeit im
 * Qualifying. Hier stand F1DBs Flag, und die Fahrerseite zeigte deshalb 52
 * Poles neben „37 von 48 verwertet“: zwei Zählungen in einer Zeile.
 */
export function calculatePoleToWinRate(rennen) {
  const poles = rennen.filter((r) => r.qualifying === 1)
  return rate(poles.filter((r) => r.position === 1).length, poles.length, spanne(rennen))
}

/** Durchschnittliche Zielposition – nur gewertete Rennen, sonst wäre sie beliebig. */
export const calculateAverageFinish = (rennen, minSample = 3) =>
  mean(gewertet(rennen).map((r) => r.position), { minSample, coverage: spanne(rennen) })

/** Durchschnittlicher Startplatz. Nicht überlieferte Plätze bleiben draußen. */
export const calculateAverageStart = (rennen, minSample = 3) =>
  mean(
    gestartet(rennen)
      .map((r) => r.grid)
      .filter((g) => g !== null),
    { minSample, coverage: spanne(rennen) },
  )

/**
 * Plätze gegenüber dem Startplatz gewonnen.
 *
 * Nur Rennen, in denen sowohl Startplatz als auch Zielposition vorliegen –
 * ein Ausfall sagt nichts über Rennkönnen, sondern über Technik oder Pech.
 */
export function calculatePositionsGained(rennen) {
  const vergleichbar = gewertet(rennen).filter((r) => r.grid !== null)
  if (vergleichbar.length === 0) return unknown('No races with a recorded grid position.')
  return metric(
    vergleichbar.reduce((s, r) => s + (r.grid - r.position), 0),
    vergleichbar.length,
    spanne(rennen),
  )
}

/** Längste Serien. Gezählt wird über Starts, nicht über Nennungen. */
export function calculateStreaks(rennen) {
  const starts = gestartet(rennen)
  return {
    wins: longestStreak(starts, (r) => r.position === 1),
    podiums: longestStreak(starts, (r) => r.classified && r.position <= 3),
    points: longestStreak(starts, (r) => (r.points ?? 0) > 0),
    finishes: longestStreak(starts, (r) => r.classified === 1),
  }
}

/**
 * Titel und beste Meisterschaftsplatzierung.
 *
 * Kommt aus der Wertungstabelle, nicht aus den Rennpunkten: Bis 1990 zählten
 * nur die besten Ergebnisse einer Saison, die Summe der Rennpunkte ist dort
 * nicht der WM-Stand.
 */
export function calculateChampionships(db, driverId, filter = {}) {
  const wo = []
  const p = [driverId]
  if (filter.fromYear !== undefined) {
    wo.push('year >= ?')
    p.push(filter.fromYear)
  }
  if (filter.toYear !== undefined) {
    wo.push('year <= ?')
    p.push(filter.toYear)
  }
  const zeilen = db
    .prepare(
      `SELECT year, position, points, championship_won AS won
         FROM season_driver_standing
        WHERE driver_id = ?${wo.length ? ' AND ' + wo.join(' AND ') : ''}
        ORDER BY year`,
    )
    .all(...p)

  /*
   * Wer nie in einer Wertung auftaucht, hat keine unbekannte Titelzahl,
   * sondern null Titel – das ist eine Aussage, keine Lücke. Der beste
   * Meisterschaftsplatz dagegen ist dann wirklich nicht bekannt.
   */
  if (zeilen.length === 0) {
    return { titles: metric(0, 0, null), best: unknown('Never listed in the championship standings.'), seasons: [] }
  }

  const deckung = { firstYear: zeilen[0].year, lastYear: zeilen[zeilen.length - 1].year }
  const platzierungen = zeilen.map((z) => z.position).filter((p) => p !== null)

  return {
    titles: metric(zeilen.filter((z) => z.won).length, zeilen.length, deckung),
    best: platzierungen.length
      ? metric(Math.min(...platzierungen), zeilen.length, deckung)
      : unknown('No championship position recorded.'),
    seasons: zeilen,
  }
}

/**
 * Bilanz gegen die Teamkollegen, Saison für Saison.
 *
 * Gewertet wird nur, wo beide im selben Rennen für dasselbe Team antraten –
 * und für den Rennvergleich nur, wo beide ins Ziel kamen: Ein Ausfall sagt
 * nichts über den Zweikampf. Im Qualifying zählt der Startplatz beider.
 */
export function calculateTeamMateComparison(db, driverId, filter = {}) {
  const { sql, p } = bedingungen(filter)
  const zeilen = db
    .prepare(
      `SELECT r.year, r.id AS raceId, rr.constructor_id AS constructorId,
              rr.driver_id AS driverId,
              rr.classified, rr.position, rr.qualifying_position AS quali, rr.points
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
        WHERE rr.constructor_id IN (
                SELECT DISTINCT constructor_id FROM race_result WHERE driver_id = ?
              )
          AND rr.race_id IN (
                SELECT race_id FROM race_result WHERE driver_id = ?
              )
          AND rr.started = 1${sql}`,
    )
    .all(driverId, driverId, ...p)

  // Nach Rennen und Team bündeln, dann je Gegner aufaddieren.
  const proRennen = new Map()
  for (const z of zeilen) {
    const key = `${z.raceId}|${z.constructorId}`
    const e = proRennen.get(key) ?? []
    e.push(z)
    proRennen.set(key, e)
  }

  const gegner = new Map()
  for (const gruppe of proRennen.values()) {
    const ich = gruppe.find((z) => z.driverId === driverId)
    if (!ich) continue
    for (const anderer of gruppe) {
      if (anderer.driverId === driverId) continue
      const e = gegner.get(anderer.driverId) ?? {
        driverId: anderer.driverId,
        constructorId: ich.constructorId,
        raceDuels: 0, raceWins: 0,
        qualiDuels: 0, qualiWins: 0,
        pointsSelf: 0, pointsOther: 0,
        years: new Set(),
      }
      e.years.add(ich.year)
      e.pointsSelf += ich.points ?? 0
      e.pointsOther += anderer.points ?? 0
      if (ich.classified && anderer.classified) {
        e.raceDuels++
        if (ich.position < anderer.position) e.raceWins++
      }
      if (ich.quali !== null && anderer.quali !== null) {
        e.qualiDuels++
        if (ich.quali < anderer.quali) e.qualiWins++
      }
      gegner.set(anderer.driverId, e)
    }
  }

  return [...gegner.values()]
    .map((e) => ({ ...e, years: [...e.years].sort() }))
    .sort((a, b) => b.raceDuels + b.qualiDuels - (a.raceDuels + a.qualiDuels))
}

/**
 * Leistung je Strecke – die Grundlage für „Track Specialists".
 *
 * Strecken mit ein oder zwei Starts werden mitgeliefert, aber über
 * `sampleSize` als dünn gekennzeichnet: Ein einzelner Sieg ergibt sonst eine
 * Siegquote von hundert Prozent.
 */
export function calculateTrackPerformance(db, driverId, minStarts = 1) {
  const rennen = driverRaces(db, driverId)
  const proStrecke = new Map()

  for (const r of rennen) {
    if (!r.started) continue
    const e = proStrecke.get(r.circuitId) ?? { circuitId: r.circuitId, rennen: [] }
    e.rennen.push(r)
    proStrecke.set(r.circuitId, e)
  }

  return [...proStrecke.values()]
    .filter((e) => e.rennen.length >= minStarts)
    .map((e) => ({
      circuitId: e.circuitId,
      starts: e.rennen.length,
      wins: calculateWins(e.rennen),
      podiums: calculatePodiums(e.rennen),
      poles: calculatePoles(e.rennen),
      averageFinish: calculateAverageFinish(e.rennen),
      winRate: calculateWinRate(e.rennen),
    }))
    .sort((a, b) => b.wins.value - a.wins.value || b.starts - a.starts)
}
