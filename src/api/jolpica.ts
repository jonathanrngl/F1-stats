const BASE = 'https://api.jolpi.ca/ergast/f1'
const USER_AGENT = 'F1StatsPlatform/0.1.0'

export interface Season {
  season: string
  url: string
}

export interface Race {
  season: string
  round: string
  raceName: string
  date: string
  Circuit: {
    circuitId: string
    circuitName: string
    Location: { locality: string; country: string }
  }
}

export interface DriverStanding {
  position: string
  positionText: string
  points: string
  wins: string
  Driver: {
    driverId: string
    code?: string
    givenName: string
    familyName: string
    nationality: string
  }
  Constructors: { constructorId: string; name: string }[]
}

export interface ConstructorStanding {
  position: string
  positionText: string
  points: string
  wins: string
  Constructor: { constructorId: string; name: string; nationality: string }
}

const cache = new Map<string, unknown>()

async function get<T>(path: string, extract: (data: any) => T): Promise<T> {
  const cached = cache.get(path)
  if (cached !== undefined) return cached as T

  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  })
  if (res.status === 429) {
    throw new Error('Zu viele Anfragen an die F1-API. Bitte kurz warten und erneut versuchen.')
  }
  if (!res.ok) {
    throw new Error(`Daten konnten nicht geladen werden (HTTP ${res.status}).`)
  }
  const json = await res.json()
  const value = extract(json.MRData)
  cache.set(path, value)
  return value
}

export function fetchSeasons(): Promise<Season[]> {
  return get('/seasons/?limit=100', (d) => d.SeasonTable.Seasons as Season[])
}

export function fetchRaces(season: string): Promise<Race[]> {
  return get(`/${season}/races/?limit=100`, (d) => d.RaceTable.Races as Race[])
}

export function fetchDriverStandings(season: string, round: string): Promise<DriverStanding[]> {
  return get(
    `/${season}/${round}/driverstandings/?limit=100`,
    (d) => d.StandingsTable.StandingsLists[0]?.DriverStandings ?? [],
  )
}

export function fetchConstructorStandings(
  season: string,
  round: string,
): Promise<ConstructorStanding[]> {
  return get(
    `/${season}/${round}/constructorstandings/?limit=100`,
    (d) => d.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [],
  )
}
