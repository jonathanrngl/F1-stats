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
const STORE_PREFIX = 'f1cache:v1:'
const TTL_KURZ_MS = 6 * 60 * 60 * 1000
const TTL_LANG_MS = 30 * 24 * 60 * 60 * 1000

/*
 * Wie lange ein Pfad im Cache gilt.
 *
 * Eine Lebensdauer für alles war in beide Richtungen falsch: Das Ergebnis des
 * Großen Preises von 1988 ändert sich nie, wurde aber nach sechs Stunden
 * verworfen und neu geholt – beim Fahrerverzeichnis sind das neun Anfragen für
 * Daten, die seit Jahrzehnten feststehen. Abgeschlossene Saisons und das
 * Verzeichnis halten deshalb lange, alles andere bleibt bei sechs Stunden:
 * die laufende Saison ändert sich jedes Wochenende.
 */
function ttlOf(path: string): number {
  if (path.startsWith('/drivers/?')) return TTL_LANG_MS
  const jahr = /^\/(\d{4})\//.exec(path)
  if (jahr && Number(jahr[1]) < new Date().getFullYear()) return TTL_LANG_MS
  return TTL_KURZ_MS
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

/** Punkteverlauf eines Fahrers über die Saison; `points[i]` gilt nach Runde i+1. */
export interface DriverProgression {
  driverId: string
  code: string
  name: string
  team: string
  points: number[]
  total: number
}

// ---------------------------------------------------------------- Persistenz

function readStore<T>(path: string): T | undefined {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + path)
    if (!raw) return undefined
    const entry = JSON.parse(raw) as { t: number; v: T }
    if (Date.now() - entry.t > ttlOf(path)) {
      localStorage.removeItem(STORE_PREFIX + path)
      return undefined
    }
    return entry.v
  } catch {
    return undefined
  }
}

function writeStore(path: string, value: unknown) {
  try {
    localStorage.setItem(STORE_PREFIX + path, JSON.stringify({ t: Date.now(), v: value }))
  } catch {
    // Speicher voll oder gesperrt: eigene Einträge räumen, sonst nichts tun.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(STORE_PREFIX)) localStorage.removeItem(key)
      }
    } catch {
      /* Cache ist nur eine Beschleunigung – ein Fehlschlag darf nichts kosten. */
    }
  }
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
      if (last) throw new Error('The F1 API cannot be reached at the moment. Please reload.')
      await backoff(attempt)
      continue
    }

    if (res.status === 429) {
      if (last) {
        throw new Error(
          'The F1 API is throttling every request at the moment. Please wait a minute and reload.',
        )
      }
      await backoff(attempt)
      continue
    }
    if (!res.ok) {
      throw new Error(`The data could not be loaded (HTTP ${res.status}).`)
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

/** Cache über laufende und abgeschlossene Anfragen – jeder Pfad fliegt nur einmal. */
const inflight = new Map<string, Promise<unknown>>()

function get<T>(path: string, extract: (data: any) => T): Promise<T> {
  const running = inflight.get(path)
  if (running) return running as Promise<T>

  const stored = readStore<T>(path)
  if (stored !== undefined) {
    const resolved = Promise.resolve(stored)
    inflight.set(path, resolved)
    return resolved
  }

  const pending = schedule(() => request(path))
    .then((data) => {
      const value = extract(data)
      writeStore(path, value)
      return value
    })
    .catch((e) => {
      inflight.delete(path) // Fehlschläge nicht merken, damit ein Retry möglich ist.
      throw e
    })

  inflight.set(path, pending)
  return pending
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
 * durch die Warteschlange. `onProgress` meldet nicht nur den Fortschritt,
 * sondern auch den bis dahin bekannten Verlauf: der Graph zeichnet sich damit
 * Runde für Runde auf, statt am Ladebalken zu warten.
 *
 * Warum je Runde und nicht in einem Rutsch über `/{saison}/results/`?
 * Bis 1990 zählten nur die besten N Rennen einer Saison zur Meisterschaft
 * (1988 fuhr Prost 105 Punkte ein, gewertet wurden 87). Die Summe der
 * Rennergebnisse ist dann nicht der WM-Stand. `/driverstandings/` kennt die
 * Streichresultate, die Ergebnisliste nicht.
 */
export async function fetchProgression(
  season: string,
  lastRound: number,
  onProgress: (done: number, total: number, partial: DriverProgression[]) => void,
): Promise<DriverProgression[]> {
  const perRound: Map<string, number>[] = []
  const meta = new Map<string, { code: string; name: string; team: string }>()

  const collect = (): DriverProgression[] =>
    [...meta]
      .map(([driverId, info]) => {
        // Fehlt ein Fahrer in einer Runde (Einstieg mitten in der Saison, noch
        // keine Wertung), wird der letzte bekannte Punktestand fortgeschrieben.
        let carried = 0
        const points = perRound.map((round) => {
          carried = round.get(driverId) ?? carried
          return carried
        })
        return { driverId, ...info, points, total: points.at(-1) ?? 0 }
      })
      .sort((a, b) => b.total - a.total)

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
    onProgress(round, lastRound, collect())
  }

  return collect()
}

// ------------------------------------------------------- Ergebnisse je Rennen

export interface ResultRow {
  position: string
  /** Ziffer = gewertet; R/D/W/N/E = ausgefallen, disqualifiziert, nicht gestartet. */
  positionText: string
  points: string
  /** Startplatz. "0" heißt: nicht überliefert (kommt in frühen Jahren vor). */
  grid: string
  status: string
  Driver: {
    driverId: string
    code?: string
    givenName: string
    familyName: string
    nationality: string
  }
  Constructor: { constructorId: string; name: string; nationality: string }
  FastestLap?: { rank: string }
}

export interface RaceResults {
  round: number
  raceName: string
  date: string
  results: ResultRow[]
}

const PAGE = 100

/**
 * Alle Rennergebnisse einer Saison. Die API zählt hier Ergebniszeilen, nicht
 * Rennen, und deckelt eine Seite bei 100 – eine moderne Saison (24 Rennen,
 * ~480 Zeilen) kostet damit fünf Anfragen statt einer pro Rennen.
 */
export async function fetchSeasonResults(
  season: string,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<RaceResults[]> {
  const page = (offset: number) =>
    get(`/${season}/results/?limit=${PAGE}&offset=${offset}`, (d) => ({
      total: Number(d.total) || 0,
      races: (d.RaceTable.Races ?? []) as {
        round: string
        raceName: string
        date: string
        Results: ResultRow[]
      }[],
    }))

  const first = await page(0)
  const pages = Math.max(1, Math.ceil(first.total / PAGE))
  const raw = [...first.races]
  onProgress(1, pages)

  for (let p = 1; p < pages; p++) {
    raw.push(...(await page(p * PAGE)).races)
    onProgress(p + 1, pages)
  }

  // Eine Seitengrenze läuft mitten durch ein Rennen: dasselbe Rennen kommt dann
  // auf zwei Seiten mit je einem Teil der Ergebnisse. Nach Runde zusammenführen.
  const byRound = new Map<number, RaceResults>()
  for (const r of raw) {
    const round = Number(r.round)
    const entry = byRound.get(round)
    if (entry) entry.results.push(...r.Results)
    else
      byRound.set(round, {
        round,
        raceName: r.raceName,
        date: r.date,
        results: [...r.Results],
      })
  }

  return [...byRound.values()].sort((a, b) => a.round - b.round)
}

export interface SprintInfo {
  /** Runden, an denen ein Sprint gefahren wurde. */
  rounds: number[]
  /** Größte in einem Sprint dieser Saison erzielte Punktzahl. */
  maxPoints: number
}

/**
 * Sprint-Wochenenden einer Saison. Gibt es keine (alles vor 2021), kommt eine
 * leere Liste zurück – die Anfrage kostet dann genau einen Treffer im Cache.
 */
export async function fetchSprintRounds(season: string): Promise<SprintInfo> {
  const page = (offset: number) =>
    get(`/${season}/sprint/?limit=${PAGE}&offset=${offset}`, (d) => ({
      total: Number(d.total) || 0,
      races: (d.RaceTable.Races ?? []) as {
        round: string
        SprintResults: { points: string }[]
      }[],
    }))

  const first = await page(0)
  const pages = Math.max(1, Math.ceil(first.total / PAGE))
  const raw = [...first.races]
  for (let p = 1; p < pages; p++) raw.push(...(await page(p * PAGE)).races)

  const rounds = new Set<number>()
  let maxPoints = 0
  for (const r of raw) {
    rounds.add(Number(r.round))
    for (const x of r.SprintResults ?? []) maxPoints = Math.max(maxPoints, Number(x.points) || 0)
  }
  return { rounds: [...rounds].sort((a, b) => a - b), maxPoints }
}

// ------------------------------------------------------------------ Fahrer

export interface DriverInfo {
  driverId: string
  code?: string
  givenName: string
  familyName: string
  /**
   * Fehlt bei 16 Fahrern des Verzeichnisses – durchweg Reserve- und
   * Testfahrer der jüngsten Jahre (Paul Aron, Colton Herta, Ryo Hirakawa …).
   * Die API liefert für sie nur Name und Kennung, kein Land und kein
   * Geburtsdatum. Als Pflichtfeld geführt, brachte das die Suche zum Absturz.
   */
  nationality?: string
  dateOfBirth?: string
  url?: string
}

/**
 * Das vollständige Fahrerverzeichnis – 881 Namen seit 1950, neun Seiten.
 *
 * Die API kennt keine Namenssuche, deshalb wird einmal alles geholt und im
 * Browser gefiltert. Das ist vertretbar, weil das Verzeichnis sich höchstens
 * zum Saisonstart ändert und deshalb lange im Cache bleibt (siehe `ttlOf`):
 * die neun Anfragen fallen im Normalfall genau einmal an.
 */
export async function fetchAllDrivers(
  onProgress: (done: number, total: number) => void = () => {},
): Promise<DriverInfo[]> {
  const page = (offset: number) =>
    get(`/drivers/?limit=${PAGE}&offset=${offset}`, (d) => ({
      total: Number(d.total) || 0,
      drivers: (d.DriverTable.Drivers ?? []) as DriverInfo[],
    }))

  const first = await page(0)
  const pages = Math.max(1, Math.ceil(first.total / PAGE))
  const all = [...first.drivers]
  onProgress(1, pages)

  for (let p = 1; p < pages; p++) {
    all.push(...(await page(p * PAGE)).drivers)
    onProgress(p + 1, pages)
  }
  return all
}

/** Ein Rennen aus Sicht eines Fahrers – genau eine Ergebniszeile je Rennen. */
export interface CareerRace {
  season: string
  round: string
  raceName: string
  date: string
  result: ResultRow
}

/**
 * Alle Rennergebnisse eines Fahrers, über die ganze Karriere.
 *
 * Auch hier zählt die API Ergebniszeilen: Verstappen kostet drei Anfragen,
 * Alonso fünf. Jedes Rennen enthält genau eine Zeile – die des Fahrers.
 */
export async function fetchDriverCareer(
  driverId: string,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<CareerRace[]> {
  const page = (offset: number) =>
    get(`/drivers/${driverId}/results/?limit=${PAGE}&offset=${offset}`, (d) => ({
      total: Number(d.total) || 0,
      races: (d.RaceTable.Races ?? []) as {
        season: string
        round: string
        raceName: string
        date: string
        Results: ResultRow[]
      }[],
    }))

  const first = await page(0)
  const pages = Math.max(1, Math.ceil(first.total / PAGE))
  const raw = [...first.races]
  onProgress(1, pages)

  for (let p = 1; p < pages; p++) {
    raw.push(...(await page(p * PAGE)).races)
    onProgress(p + 1, pages)
  }

  return raw
    .flatMap((r) =>
      (r.Results ?? []).map((result) => ({
        season: r.season,
        round: r.round,
        raceName: r.raceName,
        date: r.date,
        result,
      })),
    )
    .sort((a, b) => Number(a.season) - Number(b.season) || Number(a.round) - Number(b.round))
}

export interface SeasonStanding {
  season: string
  position: number | null
  points: number
  wins: number
}

/**
 * Endstand eines Fahrers in einer Saison.
 *
 * Jolpica verlangt für Wertungen zwingend ein Saisonjahr – einen Endpunkt, der
 * die Meisterschaftsplätze einer ganzen Karriere auf einmal liefert, gibt es
 * nicht. Also eine Anfrage je Saison. Das lohnt trotzdem: Nur die Wertung kennt
 * die Streichresultate bis 1990, die Summe der Rennpunkte ist dort nicht der
 * WM-Stand, und nur so stimmt die Zahl der Titel.
 */
export function fetchDriverSeasonStanding(
  season: string,
  driverId: string,
): Promise<SeasonStanding> {
  return get(`/${season}/drivers/${driverId}/driverstandings/?limit=1`, (d) => {
    const row = d.StandingsTable.StandingsLists[0]?.DriverStandings?.[0]
    return {
      season,
      position: row ? Number(row.position) || null : null,
      points: row ? Number(row.points) || 0 : 0,
      wins: row ? Number(row.wins) || 0 : 0,
    }
  })
}
