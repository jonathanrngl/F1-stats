import { get, type SeasonRace } from './jolpica'
import { fetchPitStops, fetchRaceSessions, OPENF1_FROM } from './openf1'

/*
 * Boxenstopps aus zwei Quellen, hinter einer Funktion.
 *
 * OpenF1 ist die bessere Quelle, wo sie reicht: sie führt die Standzeit am
 * Auto getrennt von der Zeit in der Boxengasse, und eine ganze Saison kostet
 * zwei Anfragen statt vierundzwanzig. Sie beginnt allerdings erst 2023.
 *
 * Jolpica reicht zurück bis 2011, kennt aber nur die Zeit in der Boxengasse
 * und will eine Anfrage je Rennen. Für alles vor 2023 bleibt sie der Weg.
 *
 * Welche Quelle gegriffen hat, steht im Ergebnis – die Oberfläche muss es
 * sagen können, denn die beiden liefern nicht dasselbe.
 */

export interface PitStop {
  /** Ergast-Kennung, wo die Quelle sie führt (Jolpica). */
  driverId?: string
  /** Startnummer, wo nur sie da ist (OpenF1). */
  carNumber?: string
  lap: number
  /** Zeit in der Boxengasse, in Sekunden. Hängt an der Strecke. */
  lane: number
  /** Standzeit am Auto, in Sekunden. Nur OpenF1, und dort nicht lückenlos. */
  still?: number
}

export interface RacePitStops {
  round: number
  raceName: string
  stops: PitStop[]
}

export type PitSource = 'openf1' | 'jolpica'

export interface SeasonPitStops {
  races: RacePitStops[]
  /** Runden, die auch nach allen Wiederholungen nicht zu laden waren. */
  failed: number[]
  source: PitSource
  /** Wie viele Stopps eine Standzeit mitbringen – Grundlage der Abdeckung. */
  withStill: number
  total: number
}

/** Erste Saison mit Boxenstopp-Daten in der Ergast-Schnittstelle. */
export const PITSTOPS_FROM = 2011

export async function fetchSeasonPitStops(
  season: string,
  lastRound: number,
  races: SeasonRace[],
  onProgress: (done: number, total: number) => void,
): Promise<SeasonPitStops> {
  if (Number(season) >= OPENF1_FROM) {
    const fromOpenF1 = await viaOpenF1(season, races, onProgress)
    // Wenn OpenF1 für diese Saison (noch) nichts hat, greift der alte Weg.
    if (fromOpenF1 && fromOpenF1.races.length > 0) return fromOpenF1
  }
  return viaJolpica(season, lastRound, onProgress)
}

/** Zwei Anfragen: die Rennen der Saison, dann alle Stopps über ihren Bereich. */
async function viaOpenF1(
  season: string,
  races: SeasonRace[],
  onProgress: (done: number, total: number) => void,
): Promise<SeasonPitStops | null> {
  let sessions
  let stops
  try {
    onProgress(0, 2)
    sessions = await fetchRaceSessions(season)
    if (sessions.length === 0) return null
    onProgress(1, 2)
    stops = await fetchPitStops(season, sessions)
    onProgress(2, 2)
  } catch {
    // Zweite Quelle nicht erreichbar: kein Grund, ganz ohne Boxenstopps
    // dazustehen – der Aufrufer weicht auf Jolpica aus.
    return null
  }
  if (stops.length === 0) return null

  // Zuordnung Session -> Runde über den Kalendertag. Beide Quellen datieren das
  // Rennen in UTC, das trifft in der Praxis für jedes Rennen einer Saison.
  const roundOfDay = new Map(races.map((r) => [r.date, r]))
  const roundOfSession = new Map<number, SeasonRace>()
  for (const session of sessions) {
    const race = roundOfDay.get(session.day)
    if (race) roundOfSession.set(session.key, race)
  }

  const byRound = new Map<number, RacePitStops>()
  let withStill = 0
  let total = 0

  for (const stop of stops) {
    const race = roundOfSession.get(stop.sessionKey)
    if (!race) continue
    const bucket =
      byRound.get(race.round) ?? { round: race.round, raceName: race.raceName, stops: [] }
    bucket.stops.push({
      carNumber: stop.carNumber,
      lap: stop.lap,
      lane: stop.lane,
      still: stop.still,
    })
    byRound.set(race.round, bucket)
    total++
    if (stop.still !== undefined) withStill++
  }

  return {
    races: [...byRound.values()].sort((a, b) => a.round - b.round),
    failed: [],
    source: 'openf1',
    withStill,
    total,
  }
}

/**
 * Eine Anfrage je Rennen. Ein Rennen, das auch nach den Wiederholungen nicht
 * kommt, lässt den Lauf nicht platzen: bei zwei Dutzend Anfragen wäre es die
 * falsche Abwägung, für eine fehlende Runde dreiundzwanzig geladene
 * wegzuwerfen. Die Ausfälle stehen in `failed`.
 */
async function viaJolpica(
  season: string,
  lastRound: number,
  onProgress: (done: number, total: number) => void,
): Promise<SeasonPitStops> {
  const races: RacePitStops[] = []
  const failed: number[] = []
  let total = 0

  for (let round = 1; round <= lastRound; round++) {
    try {
      const race = await get(`/${season}/${round}/pitstops/?limit=100`, (d) => {
        const entry = d.RaceTable.Races?.[0]
        return {
          round,
          raceName: (entry?.raceName as string) ?? '',
          stops: ((entry?.PitStops as any[]) ?? []).map(
            (s): PitStop => ({
              driverId: s.driverId,
              lap: Number(s.lap),
              // Rotphasen stehen als '50:37.323' in den Daten – die Autos
              // standen dann minutenlang in der Boxengasse. Number() macht
              // daraus NaN, und genau so wird der Wert später verworfen.
              lane: Number(s.duration),
            }),
          ),
        }
      })
      if (race.stops.length > 0) {
        races.push(race)
        total += race.stops.length
      }
    } catch {
      failed.push(round)
    }
    onProgress(round, lastRound)
  }

  return { races, failed, source: 'jolpica', withStill: 0, total }
}
