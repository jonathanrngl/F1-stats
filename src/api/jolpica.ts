import { memo, sleep } from './cache'

const BASE = 'https://api.jolpi.ca/ergast/f1'

/*
 * Jolpica drosselt anonyme Zugriffe bei rund vier Anfragen pro Sekunde (und
 * 500 pro Stunde) und schickt beim Überschreiten ein 429 ohne Retry-After.
 * Deshalb regelt dieser Client selbst: alle Anfragen laufen nacheinander durch
 * eine Warteschlange mit festem Mindestabstand, ein 429 wird mit wachsender
 * Wartezeit wiederholt, und Antworten landen im Cache. Der WM-Verlauf braucht
 * eine Anfrage pro Rennen – ohne diese Bremse läuft er sofort ins Limit.
 */
const MIN_GAP_MS = 300
const MAX_RETRIES = 4
const BACKOFF_MS = 700

export interface Season {
  season: string
  url: string
}

/** Termin einer Session. `time` ist UTC und fehlt bei alten Saisons. */
export interface SessionTime {
  date: string
  time?: string
}

export interface Race {
  season: string
  round: string
  raceName: string
  date: string
  /** Startzeit des Rennens in UTC; erst ab 2005 in den Daten. */
  time?: string
  url?: string
  Circuit: {
    circuitId: string
    circuitName: string
    Location: { locality: string; country: string }
  }
  /*
   * Der Rennkalender enthaelt die Termine des ganzen Wochenendes – aber nur
   * die Termine. Ergebnisse gibt es in dieser Datenquelle ausschliesslich fuer
   * Qualifying, Sprint und Rennen; fuer die freien Trainings existiert kein
   * Endpunkt. Ein Sprintwochenende hat nur ein Training und dafuer eine
   * Sprint-Qualifikation.
   */
  FirstPractice?: SessionTime
  SecondPractice?: SessionTime
  ThirdPractice?: SessionTime
  SprintQualifying?: SessionTime
  Sprint?: SessionTime
  Qualifying?: SessionTime
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

/** Punkteverlauf eines Fahrers über die Saison; `points[i]` gilt nach Runde i+1. */
export interface DriverProgression {
  driverId: string
  code: string
  name: string
  team: string
  points: number[]
  total: number
}

// ------------------------------------------------------------ Warteschlange

let queue: Promise<unknown> = Promise.resolve()
let lastStart = 0

/** Reiht eine Anfrage ein: immer nur eine gleichzeitig, mit Mindestabstand. */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastStart + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastStart = Date.now()
    return task()
  })
  // Die Kette darf nicht an einem Fehler abreißen, sonst steht sie danach still.
  queue = run.catch(() => undefined)
  return run
}

async function request(path: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= MAX_RETRIES
    let res: Response

    try {
      res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
    } catch {
      // Abgerissene Verbindung, DNS-Aussetzer, blockierte Antwort: der Browser
      // meldet nur "Failed to fetch". Genauso behandeln wie eine Drosselung.
      if (last) throw new Error('Die F1-API ist gerade nicht erreichbar. Bitte neu laden.')
      await backoff(attempt)
      continue
    }

    if (res.status === 429) {
      if (last) {
        throw new Error(
          'Die F1-API drosselt gerade alle Zugriffe. Bitte eine Minute warten und neu laden.',
        )
      }
      await backoff(attempt)
      continue
    }
    if (!res.ok) {
      throw new Error(`Daten konnten nicht geladen werden (HTTP ${res.status}).`)
    }
    return (await res.json()).MRData
  }
}

/** Wartet vor dem nächsten Versuch – und bremst dabei die ganze Warteschlange,
 *  denn das Limit gilt für alle Anfragen zusammen, nicht für die einzelne. */
async function backoff(attempt: number) {
  await sleep(BACKOFF_MS * 2 ** attempt)
  lastStart = Date.now()
}

/** Jeder Pfad fliegt nur einmal – Zwischenspeicher siehe ./cache. */
export function get<T>(path: string, extract: (data: any) => T): Promise<T> {
  return memo(`jolpica:${path}`, () => schedule(() => request(path)).then(extract))
}

// --------------------------------------------------------------- Endpunkte

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

/**
 * Runde des zuletzt gewerteten Rennens einer Saison. Ohne Rundenangabe liefert
 * die API den aktuellen Stand, also die letzte Runde mit Ergebnissen. Bei einer
 * laufenden Saison ist das nicht die letzte Runde des Rennkalenders.
 */
export function fetchLatestRound(season: string): Promise<string> {
  return get(
    `/${season}/driverstandings/?limit=1`,
    (d) => d.StandingsTable.StandingsLists[0]?.round ?? '',
  )
}

/**
 * Punkteverlauf aller Fahrer über die Saison – eine Anfrage je Runde, seriell
 * durch die Warteschlange. `onProgress` meldet den Fortschritt für die Anzeige.
 */
export async function fetchProgression(
  season: string,
  lastRound: number,
  onProgress: (done: number, total: number) => void,
): Promise<DriverProgression[]> {
  const perRound: Map<string, number>[] = []
  const meta = new Map<string, { code: string; name: string; team: string }>()

  for (let round = 1; round <= lastRound; round++) {
    const standings = await fetchDriverStandings(season, String(round))
    const points = new Map<string, number>()
    for (const s of standings) {
      points.set(s.Driver.driverId, Number(s.points))
      meta.set(s.Driver.driverId, {
        code: s.Driver.code ?? s.Driver.familyName.slice(0, 3).toUpperCase(),
        name: `${s.Driver.givenName} ${s.Driver.familyName}`,
        team: s.Constructors.map((c) => c.name).join(', '),
      })
    }
    perRound.push(points)
    onProgress(round, lastRound)
  }

  return [...meta].map(([driverId, info]) => {
    // Fehlt ein Fahrer in einer Runde (Einstieg mitten in der Saison, noch
    // keine Wertung), wird der letzte bekannte Punktestand fortgeschrieben.
    let carried = 0
    const points = perRound.map((round) => {
      carried = round.get(driverId) ?? carried
      return carried
    })
    return { driverId, ...info, points, total: points.at(-1) ?? 0 }
  }).sort((a, b) => b.total - a.total)
}

// ------------------------------------------------- Rennergebnis & Qualifying

export interface RaceResult {
  position: string
  positionText: string
  points: string
  grid: string
  laps: string
  status: string
  number?: string
  Driver: {
    driverId: string
    code?: string
    givenName: string
    familyName: string
    nationality: string
  }
  Constructor: { constructorId: string; name: string }
  /** Fehlt bei Ausfaellen; `time` ist beim Sieger absolut, sonst ein Rueckstand. */
  Time?: { millis: string; time: string }
  /** Erst ab 2004 in den Daten, und auch dann nicht bei jedem Fahrer. */
  FastestLap?: { rank: string; lap: string; Time: { time: string } }
}

export interface QualifyingResult {
  position: string
  number?: string
  Driver: {
    driverId: string
    code?: string
    givenName: string
    familyName: string
    nationality: string
  }
  Constructor: { constructorId: string; name: string }
  Q1?: string
  Q2?: string
  Q3?: string
}

/** Ein Rennen ohne Ergebnis (noch nicht gefahren) liefert eine leere Liste. */
export function fetchRaceResults(season: string, round: string): Promise<RaceResult[]> {
  return get(
    `/${season}/${round}/results/?limit=100`,
    (d) => d.RaceTable.Races[0]?.Results ?? [],
  )
}

export function fetchQualifying(season: string, round: string): Promise<QualifyingResult[]> {
  return get(
    `/${season}/${round}/qualifying/?limit=100`,
    (d) => d.RaceTable.Races[0]?.QualifyingResults ?? [],
  )
}

/** Sprintrennen gibt es erst ab 2021 und nur an manchen Wochenenden. */
export function fetchSprintResults(season: string, round: string): Promise<RaceResult[]> {
  return get(
    `/${season}/${round}/sprint/?limit=100`,
    (d) => d.RaceTable.Races?.[0]?.SprintResults ?? [],
  )
}

// ------------------------------------------------------------- Saisonbilanz

export interface StatusCount {
  status: string
  count: number
}

/** Wie die Saison ausging: beendet, überrundet, Unfall, Technik – mit Anzahl. */
export function fetchSeasonStatus(season: string): Promise<StatusCount[]> {
  return get(`/${season}/status/?limit=100`, (d) =>
    (d.StatusTable.Status as any[])
      .map((s) => ({ status: s.status as string, count: Number(s.count) }))
      .sort((a, b) => b.count - a.count),
  )
}

// ------------------------------------------------------- Saison am Stueck

/** Eine Zeile je Fahrer und Rennen – die flache Form fuer alle Bestenlisten. */
export interface SeasonEntry {
  round: number
  raceName: string
  driverId: string
  driver: string
  code: string
  /** Startnummer – ueber sie laeuft die Zuordnung der OpenF1-Boxenstopps. */
  carNumber: string
  teamId: string
  team: string
  /** Klassierung; bei Ausfaellen die Position in der Wertung. */
  position: number
  positionText: string
  /** 0 heisst: aus der Boxengasse gestartet. */
  grid: number
  points: number
  status: string
  fastestLap: boolean
}

/** Rennkopf ohne Ergebnisse – fuer die Siegerliste und die Rennnamen. */
export interface SeasonRace {
  round: number
  raceName: string
  date: string
  circuitName: string
  country: string
}

export interface SeasonData {
  entries: SeasonEntry[]
  races: SeasonRace[]
}

const PAGE = 100

function resultsPage(season: string, offset: number) {
  return get(`/${season}/results/?limit=${PAGE}&offset=${offset}`, (d) => ({
    total: Number(d.total),
    races: d.RaceTable.Races as any[],
  }))
}

/**
 * Alle Ergebnisse einer Saison. Ergast gibt sie seitenweise aus, eine Saison
 * passt in ungefaehr fuenf Anfragen – verglichen mit einer Anfrage je Rennen
 * ist das der guenstige Weg, und er bleibt weit unter dem Stundenlimit.
 *
 * Ein Rennen kann dabei auf zwei Seiten liegen. Weil hier ohnehin auf eine
 * Zeile je Fahrer und Rennen abgeflacht wird, macht das keinen Unterschied.
 */
export async function fetchSeasonResults(season: string): Promise<SeasonData> {
  const first = await resultsPage(season, 0)
  const pages = Math.max(1, Math.ceil(first.total / PAGE))
  const all = [first]

  for (let page = 1; page < pages; page++) {
    all.push(await resultsPage(season, page * PAGE))
  }

  // Ein Rennen kann auf zwei Seiten liegen, deshalb werden die Rennkoepfe
  // ueber die Runde zusammengefuehrt statt einfach angehaengt.
  const races = new Map<number, SeasonRace>()
  for (const { races: page } of all) {
    for (const race of page) {
      const round = Number(race.round)
      if (!races.has(round)) {
        races.set(round, {
          round,
          raceName: race.raceName,
          date: race.date,
          circuitName: race.Circuit.circuitName,
          country: race.Circuit.Location.country,
        })
      }
    }
  }

  const entries = all.flatMap(({ races: page }) =>
    page.flatMap((race) =>
      (race.Results as any[]).map(
        (r): SeasonEntry => ({
          round: Number(race.round),
          raceName: race.raceName,
          driverId: r.Driver.driverId,
          driver: `${r.Driver.givenName} ${r.Driver.familyName}`,
          code: r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase(),
          carNumber: String(r.number ?? ''),
          teamId: r.Constructor.constructorId,
          team: r.Constructor.name,
          position: Number(r.position),
          positionText: r.positionText,
          grid: Number(r.grid),
          points: Number(r.points),
          status: r.status,
          fastestLap: r.FastestLap?.rank === '1',
        }),
      ),
    ),
  )

  return { entries, races: [...races.values()].sort((a, b) => a.round - b.round) }
}

// ------------------------------------------------------------ Fahrer & Karriere

export interface DriverInfo {
  driverId: string
  name: string
  code?: string
  nationality: string
  born: string
}

/** Eine Zeile je Rennen einer Karriere. */
export interface CareerRace {
  season: string
  round: number
  raceName: string
  date: string
  team: string
  teamId: string
  position: number
  positionText: string
  grid: number
  points: number
  status: string
  fastestLap: boolean
}

export interface Career {
  driver: DriverInfo
  races: CareerRace[]
}

const toInfo = (d: any): DriverInfo => ({
  driverId: d.driverId,
  name: `${d.givenName} ${d.familyName}`,
  code: d.code,
  nationality: d.nationality,
  born: d.dateOfBirth ?? '',
})

/**
 * Alle Fahrer der Renngeschichte – Grundlage der Suche. Jolpica deckelt `limit`
 * hart bei 100, das sind also rund neun Anfragen. Sie laufen nur beim ersten
 * Öffnen der Suche und liegen danach sechs Stunden im Cache; gespeichert wird
 * die reduzierte Form, nicht die Rohantwort.
 */
export async function fetchAllDrivers(
  onProgress: (done: number, total: number) => void,
): Promise<DriverInfo[]> {
  const page = (offset: number) =>
    get(`/drivers/?limit=${PAGE}&offset=${offset}`, (d) => ({
      total: Number(d.total),
      drivers: (d.DriverTable.Drivers as any[]).map(toInfo),
    }))

  const first = await page(0)
  const pages = Math.max(1, Math.ceil(first.total / PAGE))
  const all = [...first.drivers]
  onProgress(1, pages)

  for (let p = 1; p < pages; p++) {
    const next = await page(p * PAGE)
    all.push(...next.drivers)
    onProgress(p + 1, pages)
  }

  return all.sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/**
 * Jedes Rennen eines Fahrers. Drei bis vier Anfragen für eine lange Karriere.
 *
 * Die Stammdaten kommen aus derselben Antwort mit – eine eigene Anfrage an
 * `/drivers/{id}/` wäre verschenkt. Eine saisonweise Bestenliste je Fahrer
 * bietet Jolpica nicht an (`/drivers/{id}/driverstandings/` verlangt ein Jahr),
 * deshalb wird die Karriere hier aus den Ergebnissen selbst gerechnet.
 */
export async function fetchDriverCareer(
  driverId: string,
  onProgress: (done: number, total: number) => void,
): Promise<Career> {
  const page = (offset: number) =>
    get(`/drivers/${driverId}/results/?limit=${PAGE}&offset=${offset}`, (d) => ({
      total: Number(d.total),
      races: (d.RaceTable.Races as any[]).flatMap((race) =>
        (race.Results as any[]).map(
          (r): CareerRace => ({
            season: race.season,
            round: Number(race.round),
            raceName: race.raceName,
            date: race.date,
            team: r.Constructor.name,
            teamId: r.Constructor.constructorId,
            position: Number(r.position),
            positionText: r.positionText,
            grid: Number(r.grid),
            points: Number(r.points),
            status: r.status,
            fastestLap: r.FastestLap?.rank === '1',
          }),
        ),
      ),
      driver: (d.RaceTable.Races as any[])[0]?.Results?.[0]?.Driver,
    }))

  const first = await page(0)
  const pages = Math.max(1, Math.ceil(first.total / PAGE))
  const races = [...first.races]
  onProgress(1, pages)

  for (let p = 1; p < pages; p++) {
    const next = await page(p * PAGE)
    races.push(...next.races)
    onProgress(p + 1, pages)
  }

  if (!first.driver) throw new Error('Zu diesem Fahrer liegen keine Ergebnisse vor.')

  return {
    driver: toInfo(first.driver),
    races: races.sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round),
  }
}
