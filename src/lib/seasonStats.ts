import type { SeasonEntry } from '../api/jolpica'
import type { PitStop, RacePitStops } from '../api/pitstops'
import { isClassified, reachedFinish } from './format'

/*
 * Auswertung einer Saison aus den Rohergebnissen.
 *
 * Zwei Dinge, die hier bewusst *nicht* stehen:
 *
 * 1. Überholmanöver. Die Datenquelle zählt sie nicht, und aus den
 *    Rundenpositionen liesse sich nur schätzen – jeder Boxenstopp und jeder
 *    Ausfall sähe darin wie ein Überholvorgang aus. Statt einer erfundenen
 *    Zahl steht unten `positionsGained`: gutgemachte Plätze zwischen Start
 *    und Ziel. Das ist eine ehrliche, nachprüfbare Grösse – aber eben eine
 *    andere, und sie wird in der Oberfläche auch so benannt.
 *
 * 2. Die Standzeit am Auto. Ergast liefert als Boxenstopp-Dauer die Zeit in
 *    der Boxengasse, nicht die zwei Sekunden am Wagen. Die Boxengassen sind
 *    unterschiedlich lang, ein Vergleich der absoluten Zeiten über Strecken
 *    hinweg wäre also wertlos. Die Wertung unten vergleicht deshalb nur
 *    innerhalb eines Rennens und zählt, wie oft ein Team dort das schnellste
 *    war – nach demselben Prinzip wie die bekannte Boxenstopp-Wertung.
 */

export interface Rank {
  id: string
  name: string
  detail: string
  value: number
}

interface Bucket {
  name: string
  detail: string
  value: number
}

/** Summiert eine Kennzahl je Fahrer und gibt die Bestenliste zurück. */
export function byDriver(
  entries: SeasonEntry[],
  pick: (entry: SeasonEntry) => number,
  limit = 8,
): Rank[] {
  const buckets = new Map<string, Bucket>()

  for (const entry of entries) {
    const add = pick(entry)
    if (!add) continue
    const found = buckets.get(entry.driverId)
    if (found) {
      found.value += add
      // Teamwechsel mitten in der Saison: das letzte Team gewinnt, denn die
      // Liste wird meist als "wer fährt das gerade" gelesen.
      found.detail = entry.team
    } else {
      buckets.set(entry.driverId, { name: entry.driver, detail: entry.team, value: add })
    }
  }

  return toRanks(buckets, limit)
}

/** Dasselbe je Team. */
export function byTeam(
  entries: SeasonEntry[],
  pick: (entry: SeasonEntry) => number,
  limit = 8,
): Rank[] {
  const buckets = new Map<string, Bucket>()

  for (const entry of entries) {
    const add = pick(entry)
    if (!add) continue
    const found = buckets.get(entry.teamId)
    if (found) found.value += add
    else buckets.set(entry.teamId, { name: entry.team, detail: '', value: add })
  }

  return toRanks(buckets, limit)
}

function toRanks(buckets: Map<string, Bucket>, limit: number): Rank[] {
  return [...buckets]
    .map(([id, b]) => ({ id, ...b }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'de'))
    .slice(0, limit)
}

// ---------------------------------------------------------------- Kennzahlen

export const isWin = (e: SeasonEntry) => (e.position === 1 ? 1 : 0)

export const isPodium = (e: SeasonEntry) =>
  e.position <= 3 && isClassified(e.positionText) ? 1 : 0

export const isPointsFinish = (e: SeasonEntry) => (e.points > 0 ? 1 : 0)

/** Startplatz eins. Nicht ganz dasselbe wie die Pole, wenn Strafen greifen. */
export const startedFirst = (e: SeasonEntry) => (e.grid === 1 ? 1 : 0)

export const hasFastestLap = (e: SeasonEntry) => (e.fastestLap ? 1 : 0)

export const isRetirement = (e: SeasonEntry) => (reachedFinish(e.status) ? 0 : 1)

/**
 * Gutgemachte Plätze zwischen Startplatz und Ziel – nur bei gewerteten
 * Ankünften und nur, wenn ein regulärer Startplatz vorliegt. Startplatz 0
 * heisst "aus der Boxengasse" und hätte keinen sinnvollen Bezugspunkt.
 */
export const positionsGained = (e: SeasonEntry) =>
  e.grid > 0 && isClassified(e.positionText) ? Math.max(0, e.grid - e.position) : 0

// ------------------------------------------------------------------ Überblick

export interface SeasonOverview {
  races: number
  winners: number
  winnerTeams: number
  polesitters: number
  retirementShare: number
}

export function overview(entries: SeasonEntry[]): SeasonOverview {
  const rounds = new Set(entries.map((e) => e.round))
  const winners = new Set(entries.filter((e) => e.position === 1).map((e) => e.driverId))
  const winnerTeams = new Set(entries.filter((e) => e.position === 1).map((e) => e.teamId))
  const polesitters = new Set(entries.filter((e) => e.grid === 1).map((e) => e.driverId))
  const outs = entries.filter((e) => !reachedFinish(e.status)).length

  return {
    races: rounds.size,
    winners: winners.size,
    winnerTeams: winnerTeams.size,
    polesitters: polesitters.size,
    retirementShare: entries.length ? outs / entries.length : 0,
  }
}

// ---------------------------------------------------------------- Boxenstopps

/**
 * Der schnellste Stopp *eines* Rennens.
 *
 * Die Zeit in der Boxengasse steht immer neben dem Median desselben Rennens:
 * ohne diesen Bezug ist sie nicht lesbar, weil sie an der Länge der
 * Boxengasse und an der Rennsituation hängt. Unter Safety Car fällt sie
 * deutlich kürzer aus – in Zandvoort 2022 stammten die zehn kürzesten Werte
 * der ganzen Saison aus drei Runden unter gelber Flagge.
 *
 * Die Standzeit am Auto ist davon unberührt und darum die einzige der beiden
 * Zahlen, die man über Strecken hinweg vergleichen darf.
 */
export interface RaceFastest {
  round: number
  raceName: string
  /** Schnellste Zeit in der Boxengasse und der Median des Rennens dazu. */
  lane: number
  laneMedian: number
  laneDriver: string
  laneTeam: string
  lap: number
  /** Schnellste Standzeit des Rennens – nur wo die Quelle sie führt. */
  still?: number
  stillDriver?: string
  stillTeam?: string
}

export interface BestStill {
  round: number
  raceName: string
  driver: string
  team: string
  still: number
  lap: number
}

export interface PitTeamRank {
  id: string
  team: string
  /** Rennen, in denen das Team den schnellsten Stopp des Feldes hatte. */
  wins: number
  /** Rennen, in denen es unter den besten drei Teams lag. */
  topThree: number
  races: number
}

export interface PitStats {
  /** Je Rennen die Bestwerte. Bewusst keine Bestzeit über alle Strecken. */
  perRace: RaceFastest[]
  /** Schnellste Standzeit der Saison – über Strecken hinweg vergleichbar. */
  bestStill: BestStill | null
  /** Median aller Standzeiten, als Einordnung für die Bestzeit. */
  stillMedian: number | null
  ranking: PitTeamRank[]
  /**
   * Nach welcher Zahl die Wertung je Rennen entschieden wurde. Gemischt heisst:
   * wo eine Standzeit vorlag, nach ihr, sonst nach der Boxengassen-Zeit.
   */
  rankedBy: 'still' | 'lane' | 'mixed'
  mostStops: Rank[]
  totalStops: number
  races: number
}

export function pitStats(races: RacePitStops[], entries: SeasonEntry[]): PitStats {
  // Die Quellen benennen den Fahrer unterschiedlich: Jolpica über die
  // Ergast-Kennung, OpenF1 nur über die Startnummer. Beide Wege werden je
  // Runde aufgelöst, damit ein Fahrerwechsel im selben Auto richtig landet.
  const byId = new Map<string, Who>()
  const byNumber = new Map<string, Who>()
  for (const e of entries) {
    const who: Who = { driver: e.driver, team: e.team, teamId: e.teamId }
    byId.set(`${e.round}:${e.driverId}`, who)
    if (e.carNumber) byNumber.set(`${e.round}:${e.carNumber}`, who)
  }
  const lookup = (round: number, stop: PitStop): Who => {
    if (stop.driverId) {
      const hit = byId.get(`${round}:${stop.driverId}`)
      if (hit) return hit
    }
    if (stop.carNumber) {
      const hit = byNumber.get(`${round}:${stop.carNumber}`)
      if (hit) return hit
    }
    return { driver: stop.driverId ?? `Startnummer ${stop.carNumber ?? '?'}`, team: '–', teamId: 'unbekannt' }
  }

  const perRace: RaceFastest[] = []
  const allStill: number[] = []
  let bestStill: BestStill | null = null
  let totalStops = 0
  let racesByStill = 0
  let racesByLane = 0
  const teamTally = new Map<string, PitTeamRank>()
  const stopCount = new Map<string, Bucket>()

  for (const race of races) {
    const laneOfTeam = new Map<string, { team: string; value: number }>()
    const stillOfTeam = new Map<string, { team: string; value: number }>()
    const laneTimes: number[] = []
    let quickestLane: { value: number; who: Who; lap: number } | null = null
    let quickestStill: { value: number; who: Who; lap: number } | null = null

    for (const stop of race.stops) {
      if (!Number.isFinite(stop.lane) || stop.lane <= 0) continue
      totalStops++
      laneTimes.push(stop.lane)
      const who = lookup(race.round, stop)

      if (!quickestLane || stop.lane < quickestLane.value) {
        quickestLane = { value: stop.lane, who, lap: stop.lap }
      }
      const bestLane = laneOfTeam.get(who.teamId)
      if (!bestLane || stop.lane < bestLane.value) {
        laneOfTeam.set(who.teamId, { team: who.team, value: stop.lane })
      }

      if (stop.still !== undefined && Number.isFinite(stop.still) && stop.still > 0) {
        allStill.push(stop.still)
        if (!quickestStill || stop.still < quickestStill.value) {
          quickestStill = { value: stop.still, who, lap: stop.lap }
        }
        const bestStop = stillOfTeam.get(who.teamId)
        if (!bestStop || stop.still < bestStop.value) {
          stillOfTeam.set(who.teamId, { team: who.team, value: stop.still })
        }
        if (!bestStill || stop.still < bestStill.still) {
          bestStill = {
            round: race.round,
            raceName: race.raceName,
            driver: who.driver,
            team: who.team,
            still: stop.still,
            lap: stop.lap,
          }
        }
      }

      const counted = stopCount.get(who.driver)
      if (counted) counted.value++
      else stopCount.set(who.driver, { name: who.driver, detail: who.team, value: 1 })
    }

    // Wo eine Standzeit vorliegt, entscheidet sie die Wertung dieses Rennens –
    // sie ist die Leistung der Mannschaft. Sonst die Boxengassen-Zeit, die
    // innerhalb eines Rennens für alle denselben Weg umfasst.
    const useStill = stillOfTeam.size > 1
    const order = [...(useStill ? stillOfTeam : laneOfTeam)].sort((a, b) => a[1].value - b[1].value)
    if (order.length > 1) {
      if (useStill) racesByStill++
      else racesByLane++
    }
    order.forEach(([teamId, info], index) => {
      const tally =
        teamTally.get(teamId) ?? { id: teamId, team: info.team, wins: 0, topThree: 0, races: 0 }
      tally.team = info.team
      tally.races++
      if (index === 0) tally.wins++
      if (index < 3) tally.topThree++
      teamTally.set(teamId, tally)
    })

    if (quickestLane && laneTimes.length) {
      laneTimes.sort((a, b) => a - b)
      perRace.push({
        round: race.round,
        raceName: race.raceName,
        lane: quickestLane.value,
        laneMedian: laneTimes[Math.floor(laneTimes.length / 2)],
        laneDriver: quickestLane.who.driver,
        laneTeam: quickestLane.who.team,
        lap: quickestLane.lap,
        still: quickestStill?.value,
        stillDriver: quickestStill?.who.driver,
        stillTeam: quickestStill?.who.team,
      })
    }
  }

  const ranking = [...teamTally.values()].sort(
    (a, b) => b.wins - a.wins || b.topThree - a.topThree || a.team.localeCompare(b.team, 'de'),
  )

  allStill.sort((a, b) => a - b)

  return {
    perRace: perRace.sort((a, b) => a.round - b.round),
    bestStill,
    stillMedian: allStill.length ? allStill[Math.floor(allStill.length / 2)] : null,
    ranking,
    rankedBy: racesByStill && racesByLane ? 'mixed' : racesByStill ? 'still' : 'lane',
    mostStops: toRanks(stopCount, 8),
    totalStops,
    races: races.length,
  }
}

interface Who {
  driver: string
  team: string
  teamId: string
}
