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
const STORE_TTL_MS = 6 * 60 * 60 * 1000

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
    if (Date.now() - entry.t > STORE_TTL_MS) {
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
