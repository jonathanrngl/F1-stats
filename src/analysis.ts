import type { DriverProgression, RaceResults, ResultRow } from './api/jolpica'

/*
 * Auswertungen über eine ganze Saison. Reine Funktionen ohne Netzzugriff:
 * rein kommen die Rohdaten der API, raus kommt, was die Ansicht zeigt.
 */

/** Gewertet ist, wer eine Platzziffer hat. R/D/W/N/E stehen für Ausfall,
 *  Disqualifikation, Nichtantritt, nicht gewertet, Ausschluss. */
const isClassified = (r: ResultRow) => /^\d+$/.test(r.positionText)

/** "0" heißt: Startplatz nicht überliefert – kommt in frühen Jahren vor. */
const hasGrid = (r: ResultRow) => Number(r.grid) > 0

export interface DriverRaceStats {
  driverId: string
  code: string
  name: string
  team: string
  nationality: string
  entries: number
  classified: number
  /** Antritte ohne Wertung: Ausfall, Disqualifikation, Nichtantritt. */
  retired: number
  wins: number
  podiums: number
  points: number
  poles: number
  fastestLaps: number
  /** Summe aus Startplatz minus Zielposition über alle vergleichbaren Rennen. */
  placesGained: number
  /** Rennen, die in `placesGained` eingehen (Startplatz bekannt und gewertet). */
  gainRaces: number
  avgFinish: number | null
  avgGrid: number | null
  bestFinish: number | null
}

export function driverRaceStats(races: RaceResults[]): DriverRaceStats[] {
  const byDriver = new Map<string, DriverRaceStats>()
  const finishSum = new Map<string, number>()
  const gridSum = new Map<string, number>()
  const gridRaces = new Map<string, number>()

  for (const race of races) {
    for (const r of race.results) {
      const id = r.Driver.driverId
      let s = byDriver.get(id)
      if (!s) {
        s = {
          driverId: id,
          code: r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase(),
          name: `${r.Driver.givenName} ${r.Driver.familyName}`,
          team: r.Constructor.name,
          nationality: r.Driver.nationality,
          entries: 0,
          classified: 0,
          retired: 0,
          wins: 0,
          podiums: 0,
          points: 0,
          poles: 0,
          fastestLaps: 0,
          placesGained: 0,
          gainRaces: 0,
          avgFinish: null,
          avgGrid: null,
          bestFinish: null,
        }
        byDriver.set(id, s)
      }
      // Bei einem Teamwechsel mitten in der Saison gewinnt das letzte Team:
      // die Rennen kommen in Rundenreihenfolge an.
      s.team = r.Constructor.name
      s.entries++
      s.points += Number(r.points) || 0
      if (Number(r.grid) === 1) s.poles++
      if (r.FastestLap?.rank === '1') s.fastestLaps++

      if (hasGrid(r)) {
        gridSum.set(id, (gridSum.get(id) ?? 0) + Number(r.grid))
        gridRaces.set(id, (gridRaces.get(id) ?? 0) + 1)
      }

      if (isClassified(r)) {
        const pos = Number(r.position)
        s.classified++
        if (pos === 1) s.wins++
        if (pos <= 3) s.podiums++
        if (s.bestFinish === null || pos < s.bestFinish) s.bestFinish = pos
        finishSum.set(id, (finishSum.get(id) ?? 0) + pos)
        if (hasGrid(r)) {
          s.placesGained += Number(r.grid) - pos
          s.gainRaces++
        }
      } else {
        s.retired++
      }
    }
  }

  for (const s of byDriver.values()) {
    s.avgFinish = s.classified > 0 ? (finishSum.get(s.driverId) ?? 0) / s.classified : null
    const gr = gridRaces.get(s.driverId) ?? 0
    s.avgGrid = gr > 0 ? (gridSum.get(s.driverId) ?? 0) / gr : null
  }

  return [...byDriver.values()].sort((a, b) => b.points - a.points)
}

export interface DuelSide {
  driverId: string
  code: string
  name: string
  races: number
  grids: number
  points: number
}

export interface TeamDuel {
  constructorId: string
  team: string
  a: DuelSide
  b: DuelSide
  /** Rennen, in denen beide gewertet wurden – nur die sind vergleichbar. */
  raceDuels: number
  /** Qualifikationen, in denen beide einen überlieferten Startplatz hatten. */
  gridDuels: number
}

/**
 * Teamduell: das Kräfteverhältnis im selben Auto, die einzige halbwegs faire
 * Gegenüberstellung zweier Fahrer.
 *
 * Gewertet wird nur, wo beide im selben Rennen ins Ziel kamen – ein Ausfall
 * sagt nichts über den Zweikampf. Bei mehr als zwei Fahrern im Jahr (Wechsel,
 * Ersatzfahrer) treten die beiden mit den meisten Starts gegeneinander an.
 */
export function teamDuels(races: RaceResults[]): TeamDuel[] {
  const teams = new Map<
    string,
    { name: string; rows: Map<number, ResultRow[]>; entries: Map<string, number> }
  >()

  for (const race of races) {
    for (const r of race.results) {
      const id = r.Constructor.constructorId
      let t = teams.get(id)
      if (!t) {
        t = { name: r.Constructor.name, rows: new Map(), entries: new Map() }
        teams.set(id, t)
      }
      const list = t.rows.get(race.round)
      if (list) list.push(r)
      else t.rows.set(race.round, [r])
      t.entries.set(r.Driver.driverId, (t.entries.get(r.Driver.driverId) ?? 0) + 1)
    }
  }

  const duels: TeamDuel[] = []

  for (const [constructorId, t] of teams) {
    const pair = [...t.entries].sort((x, y) => y[1] - x[1]).slice(0, 2)
    if (pair.length < 2) continue
    const [idA, idB] = pair.map(([id]) => id)

    const side = (id: string, row: ResultRow): DuelSide => ({
      driverId: id,
      code: row.Driver.code ?? row.Driver.familyName.slice(0, 3).toUpperCase(),
      name: `${row.Driver.givenName} ${row.Driver.familyName}`,
      races: 0,
      grids: 0,
      points: 0,
    })

    let a: DuelSide | null = null
    let b: DuelSide | null = null
    let raceDuels = 0
    let gridDuels = 0

    for (const rows of t.rows.values()) {
      const rowA = rows.find((r) => r.Driver.driverId === idA)
      const rowB = rows.find((r) => r.Driver.driverId === idB)
      if (rowA && !a) a = side(idA, rowA)
      if (rowB && !b) b = side(idB, rowB)
      if (a && rowA) a.points += Number(rowA.points) || 0
      if (b && rowB) b.points += Number(rowB.points) || 0
      if (!rowA || !rowB || !a || !b) continue

      if (isClassified(rowA) && isClassified(rowB)) {
        raceDuels++
        if (Number(rowA.position) < Number(rowB.position)) a.races++
        else b.races++
      }
      if (hasGrid(rowA) && hasGrid(rowB)) {
        gridDuels++
        if (Number(rowA.grid) < Number(rowB.grid)) a.grids++
        else b.grids++
      }
    }

    if (!a || !b || raceDuels + gridDuels === 0) continue
    duels.push({ constructorId, team: t.name, a, b, raceDuels, gridDuels })
  }

  // Das stärkste Team zuerst: die Punkte beider Fahrer zusammen.
  return duels.sort((x, y) => y.a.points + y.b.points - (x.a.points + x.b.points))
}

// ------------------------------------------------------------- Titelrechner

export interface TitleContender {
  driver: DriverProgression
  /** Rückstand auf die Spitze. */
  gap: number
  /** Bestmöglicher Endstand, wenn alles Verbleibende gewonnen wird. */
  maxPossible: number
  alive: boolean
}

export interface TitleVerdict {
  /** Obergrenze je Runde, Index 0 = Runde 1. */
  caps: number[]
  /** Was in den verbleibenden Runden zusammen noch zu holen ist. */
  pointsLeft: number
  roundsScored: number
  totalRounds: number
  roundsLeft: number
  leader: DriverProgression | null
  /** Runde, nach der der Titel rechnerisch feststand; null, wenn offen. */
  decidedRound: number | null
  contenders: TitleContender[]
}

/**
 * Obergrenze der Punkte, die an einem Wochenende zu holen sind – je Runde.
 *
 * Ein Pauschalwert für die ganze Saison wäre zu grob: 2024 lag der Titel nach
 * Las Vegas fest (Vorsprung 65, danach standen Katar mit Sprint und Abu Dhabi
 * ohne aus, zusammen höchstens 60). Rechnet man für beide Restrennen mit dem
 * Sprint-Maximum, kommt man auf 66 – und datiert die Entscheidung eine Runde
 * zu spät.
 *
 * Deshalb: Rennmaximum aus den Ergebnissen der Saison (deckt Siegpunkte und
 * den Punkt für die schnellste Runde ab), Sprintbonus nur an den Runden, an
 * denen tatsächlich ein Sprint stattfand. Für Runden, die noch ausstehen, wird
 * ein Sprint unterstellt – das überschätzt eher, und Überschätzen ist die
 * sichere Richtung: es erklärt niemanden zu früh für geschlagen.
 */
export function roundCaps(
  races: RaceResults[],
  sprintRounds: number[],
  sprintMax: number,
  totalRounds: number,
): number[] {
  let raceMax = 0
  for (const race of races) {
    for (const r of race.results) raceMax = Math.max(raceMax, Number(r.points) || 0)
  }
  if (raceMax === 0) return []

  const known = races.length
  const sprints = new Set(sprintRounds)
  return Array.from({ length: totalRounds }, (_, i) => {
    const round = i + 1
    if (round > known) return raceMax + sprintMax // noch offen: Sprint unterstellen
    return raceMax + (sprints.has(round) ? sprintMax : 0)
  })
}

/**
 * Wann stand der Titel rechnerisch fest – und wer kann ihn noch holen?
 *
 * `caps` ist die Obergrenze je Runde aus `roundCaps`. Fehlt sie – weil die
 * Ergebnisliste nicht geladen werden konnte –, tritt ein Ersatzwert an ihre
 * Stelle: der größte Punktzuwachs, den ein Fahrer in dieser Saison an einem
 * Wochenende hatte. Der ist gröber, aber ebenfalls nie zu knapp bemessen.
 */
export function titleRace(
  progression: DriverProgression[],
  totalRounds: number,
  caps?: number[],
): TitleVerdict {
  const roundsScored = progression[0]?.points.length ?? 0
  const rounds = Math.max(totalRounds, roundsScored)
  const roundsLeft = Math.max(0, rounds - roundsScored)

  let fallback = 0
  for (const d of progression) {
    let prev = 0
    for (const p of d.points) {
      fallback = Math.max(fallback, p - prev)
      prev = p
    }
  }

  const capOf = (round: number) => caps?.[round - 1] ?? fallback
  /** Was zwischen Runde `after` (ausschließlich) und dem Saisonende liegt. */
  const remaining = (after: number) => {
    let sum = 0
    for (let r = after + 1; r <= rounds; r++) sum += capOf(r)
    return sum
  }

  const pointsLeft = remaining(roundsScored)
  const leader = progression[0] ?? null
  const contenders: TitleContender[] = progression.slice(0, 10).map((driver) => ({
    driver,
    gap: (leader?.total ?? 0) - driver.total,
    maxPossible: driver.total + pointsLeft,
    // Gleichstand zählt als lebendig: bei Punktgleichheit entscheidet die
    // Zahl der Siege, nicht die Rechnung hier.
    alive: driver.total + pointsLeft >= (leader?.total ?? 0),
  }))

  // Erste Runde, nach der der Vorsprung nicht mehr einholbar war.
  let decidedRound: number | null = null
  if (roundsScored > 0 && (caps?.length || fallback > 0)) {
    for (let r = 1; r <= roundsScored; r++) {
      const at = progression.map((d) => d.points[r - 1] ?? 0).sort((x, y) => y - x)
      if (at.length < 2) break
      if (at[0] - at[1] > remaining(r)) {
        decidedRound = r
        break
      }
    }
  }

  return {
    caps: caps ?? [],
    pointsLeft,
    roundsScored,
    totalRounds: rounds,
    roundsLeft,
    leader,
    decidedRound,
    contenders,
  }
}

// --------------------------------------------------------------- Ausfälle

/*
 * Die API liefert den Grund auf Englisch. Für die jüngeren Jahre ist er zu
 * "Retired" zusammengefasst, ältere Saisons nennen ihn genau ("Halfshaft",
 * "Fuel pump"). Übersetzt wird, was häufig vorkommt; alles andere bleibt
 * stehen, wie es kommt – lieber englisch als falsch geraten.
 */
const REASONS: Record<string, string> = {
  Accident: 'Unfall',
  Collision: 'Kollision',
  'Collision damage': 'Kollisionsschaden',
  Engine: 'Motor',
  Gearbox: 'Getriebe',
  Transmission: 'Getriebe',
  Clutch: 'Kupplung',
  Hydraulics: 'Hydraulik',
  Electrical: 'Elektrik',
  Suspension: 'Aufhängung',
  Brakes: 'Bremsen',
  Differential: 'Differential',
  Overheating: 'Überhitzung',
  Mechanical: 'Technik',
  Tyre: 'Reifen',
  Puncture: 'Reifenschaden',
  Driveshaft: 'Antriebswelle',
  Halfshaft: 'Antriebswelle',
  'Fuel pump': 'Benzinpumpe',
  'Fuel system': 'Kraftstoffsystem',
  'Fuel leak': 'Kraftstoffleck',
  'Out of fuel': 'Kein Sprit mehr',
  'Oil leak': 'Ölleck',
  'Oil pressure': 'Öldruck',
  'Water leak': 'Wasserleck',
  'Water pump': 'Wasserpumpe',
  Radiator: 'Kühler',
  Wheel: 'Rad',
  Steering: 'Lenkung',
  Throttle: 'Gaszug',
  Exhaust: 'Auspuff',
  Turbo: 'Turbolader',
  Battery: 'Batterie',
  Ignition: 'Zündung',
  'Spun off': 'Dreher',
  Retired: 'Aufgegeben',
  Withdrew: 'Zurückgezogen',
  Disqualified: 'Disqualifiziert',
  'Did not start': 'Nicht gestartet',
  'Did not qualify': 'Nicht qualifiziert',
  'Did not prequalify': 'Vorqualifikation verpasst',
  'Not classified': 'Nicht gewertet',
  Injury: 'Verletzung',
  Illness: 'Krankheit',
  Fire: 'Feuer',
  Vibrations: 'Vibrationen',
  Handling: 'Fahrverhalten',
  'Power Unit': 'Antriebseinheit',
  'Power loss': 'Leistungsverlust',
  Damage: 'Schaden',
  Debris: 'Trümmerteile',
}

export interface Reason {
  reason: string
  count: number
}

/** Häufigste Ausfallgründe der Saison, absteigend. */
export function retirementReasons(races: RaceResults[]): Reason[] {
  const counts = new Map<string, number>()
  for (const race of races) {
    for (const r of race.results) {
      if (isClassified(r)) continue
      const label = REASONS[r.status] ?? r.status
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
  }
  return [...counts]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Griffen in dieser Saison Streichresultate?
 *
 * Bis 1990 zählten nur die besten N Rennen zur Meisterschaft. Wer mehr fuhr,
 * bekam die Mehrpunkte nicht gutgeschrieben – 1988 holte Prost 105 Punkte,
 * gewertet wurden 87. Der Titelrechner kennt diese Regel nicht: Er nimmt an,
 * jeder Punkt zähle, und datiert die Entscheidung deshalb eher zu spät. 1988
 * stand Senna in Japan fest, die Rechnung hier sagt Australien.
 *
 * Erkennen lässt es sich ohne Regeltabelle: Liegt der WM-Stand eines Fahrers
 * unter der Summe seiner Rennpunkte, wurde gestrichen. Falschmeldungen sind
 * ausgeschlossen – Sprintpunkte, die in der Ergebnisliste fehlen, können den
 * WM-Stand nur heben, nie senken.
 */
export function hadDroppedScores(
  races: RaceResults[],
  progression: DriverProgression[],
): boolean {
  if (races.length === 0 || progression.length === 0) return false

  const scored = new Map<string, number>()
  for (const race of races) {
    for (const r of race.results) {
      const id = r.Driver.driverId
      scored.set(id, (scored.get(id) ?? 0) + (Number(r.points) || 0))
    }
  }

  return progression.some((d) => (scored.get(d.driverId) ?? 0) > d.total)
}
