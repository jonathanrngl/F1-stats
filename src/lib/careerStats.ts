import type { CareerRace } from '../api/jolpica'
import { isClassified, reachedFinish } from './format'

/*
 * Eine Karriere aus ihren Rennergebnissen gerechnet.
 *
 * Alles hier ist eine Zählung über dieselben Zeilen, die auch in der
 * Rennergebnis-Ansicht stehen – es kommt keine zweite Quelle und keine
 * Schätzung dazu. Wo eine Zahl nicht das ist, was ihr Name naheliegt, sagt der
 * Kommentar es: `polePositions` zählt Starts von Platz eins, nicht
 * Qualifying-Bestzeiten, weil die Daten den Startplatz führen und nicht die
 * Pole. Bei einer Startplatzstrafe fallen die beiden auseinander.
 */

export interface CareerTotals {
  starts: number
  wins: number
  podiums: number
  points: number
  polePositions: number
  fastestLaps: number
  retirements: number
  /** Beste je erreichte Zielposition. */
  bestFinish: number
  seasons: number
  firstSeason: string
  lastSeason: string
  teams: string[]
  /** Anteil der Rennen, die im Ziel endeten. */
  finishRate: number
}

export interface CareerSeason {
  season: string
  starts: number
  wins: number
  podiums: number
  points: number
  bestFinish: number
  teams: string
}

export function careerTotals(races: CareerRace[]): CareerTotals {
  const seasons = new Set(races.map((r) => r.season))
  // Reihenfolge der Teams nach dem ersten Einsatz, nicht alphabetisch: so liest
  // sich die Liste als Laufbahn.
  const teams: string[] = []
  for (const r of races) if (!teams.includes(r.team)) teams.push(r.team)

  const classified = races.filter((r) => isClassified(r.positionText))
  const finishes = races.filter((r) => reachedFinish(r.status)).length

  return {
    starts: races.length,
    wins: races.filter((r) => r.position === 1).length,
    podiums: classified.filter((r) => r.position <= 3).length,
    points: races.reduce((sum, r) => sum + r.points, 0),
    polePositions: races.filter((r) => r.grid === 1).length,
    fastestLaps: races.filter((r) => r.fastestLap).length,
    retirements: races.length - finishes,
    bestFinish: classified.length ? Math.min(...classified.map((r) => r.position)) : 0,
    seasons: seasons.size,
    firstSeason: races[0]?.season ?? '',
    lastSeason: races.at(-1)?.season ?? '',
    teams,
    finishRate: races.length ? finishes / races.length : 0,
  }
}

export function careerSeasons(races: CareerRace[]): CareerSeason[] {
  const bySeason = new Map<string, CareerRace[]>()
  for (const race of races) {
    const list = bySeason.get(race.season)
    if (list) list.push(race)
    else bySeason.set(race.season, [race])
  }

  return [...bySeason]
    .map(([season, list]) => {
      const classified = list.filter((r) => isClassified(r.positionText))
      const teams: string[] = []
      for (const r of list) if (!teams.includes(r.team)) teams.push(r.team)
      return {
        season,
        starts: list.length,
        wins: list.filter((r) => r.position === 1).length,
        podiums: classified.filter((r) => r.position <= 3).length,
        points: list.reduce((sum, r) => sum + r.points, 0),
        bestFinish: classified.length ? Math.min(...classified.map((r) => r.position)) : 0,
        teams: teams.join(', '),
      }
    })
    .sort((a, b) => b.season.localeCompare(a.season))
}

/**
 * Suche über Name und Kennung, ohne Rücksicht auf Gross- und Kleinschreibung
 * und auf Akzente: "perez" soll Pérez finden, "kimi" auch Räikkönen.
 */
export function normalise(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
}

/*
 * Rangfolge der Treffer, nach abnehmender Gewichtung:
 *
 * 1. Treffer am Anfang des Nachnamens. Wer "perez" tippt, meint Sergio Pérez
 *    und nicht Luis Pérez-Sala, bei dem der Name weiter vorn steht und ein
 *    reiner Positionsvergleich ihn deshalb nach oben ziehen würde.
 * 2. Treffer am Wortanfang überhaupt – "ver" meint Verstappen, nicht
 *    Villeneuve, wo die Folge mitten im Wort sitzt.
 * 3. Der jüngere Fahrer zuerst. Bei "verstappen" heisst das Max vor Jos: über
 *    880 Namen aus 75 Jahren ist der spätere fast immer der gemeinte.
 */
export function matchDrivers<T extends { name: string; driverId: string; born?: string }>(
  drivers: T[],
  query: string,
  limit = 40,
): T[] {
  const needle = normalise(query)
  if (needle.length < 2) return []
  const words = needle.split(/\s+/)

  const scored: { driver: T; score: number }[] = []
  for (const driver of drivers) {
    const name = normalise(driver.name)
    const haystack = `${name} ${normalise(driver.driverId)}`
    if (!words.every((w) => haystack.includes(w))) continue

    const at = haystack.indexOf(words[0])
    const startsWord = at === 0 || haystack[at - 1] === ' '
    const surname = name.split(' ').at(-1) ?? ''
    const startsSurname = surname.startsWith(words[0])

    // Bei einem Treffer am Nachnamen zählt die Position im Gesamtnamen nicht
    // mit – sonst entschiede die Länge des Vornamens, und "magnussen" brächte
    // Jan vor Kevin, nur weil sein Vorname kürzer ist.
    scored.push({ driver, score: startsSurname ? 0 : (startsWord ? 10 : 100) + at })
  }

  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        (b.driver.born ?? '').localeCompare(a.driver.born ?? '') ||
        a.driver.name.localeCompare(b.driver.name, 'de'),
    )
    .slice(0, limit)
    .map((s) => s.driver)
}
