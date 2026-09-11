/*
 * OpenF1 als zweite Quelle – ausschliesslich für Boxenstopps.
 *
 * Der Grund: Jolpica führt pro Stopp nur eine Dauer, und das ist die Zeit in
 * der Boxengasse. Die Standzeit am Auto – die zwei Sekunden, die man aus der
 * Übertragung kennt – steht dort nicht, in keinem Feld. OpenF1 führt beides
 * getrennt: `lane_duration` und `stop_duration`.
 *
 * Zwei Eigenschaften machen die Quelle hier brauchbar:
 *
 * 1. Eine ganze Saison passt in zwei Anfragen. Der Boxenstopp-Endpunkt lässt
 *    sich über einen Bereich von `session_key` abfragen, statt Rennen für
 *    Rennen – das sind zwei Anfragen gegen vierundzwanzig bei Jolpica.
 * 2. Sie schickt `access-control-allow-origin: *`, läuft also direkt aus dem
 *    Browser, ohne Zwischenstelle.
 *
 * Und zwei Einschränkungen, die die Oberfläche benennen muss:
 *
 * 1. Es gibt nur Saisons ab 2023.
 * 2. Die Standzeit ist ungleichmässig gefüllt: 2023 gar nicht, 2024 zu knapp
 *    einem Fünftel, 2025 zu etwa fünf Sechsteln. Deshalb wird nirgends eine
 *    Jahresgrenze behauptet – gezählt wird, was tatsächlich da ist, und die
 *    Abdeckung steht neben dem Ergebnis.
 */
import { memo } from './cache'

const BASE = 'https://api.openf1.org/v1'

/** Erste Saison, für die OpenF1 überhaupt Sessions führt. */
export const OPENF1_FROM = 2023

export interface RaceSession {
  key: number
  /** Kalendertag des Rennens in UTC – der Schlüssel für die Zuordnung zur Runde. */
  day: string
  location: string
}

export interface OpenF1Stop {
  sessionKey: number
  carNumber: string
  lap: number
  /** Zeit in der Boxengasse, in Sekunden. */
  lane: number
  /** Standzeit am Auto, in Sekunden – fehlt, wo die Quelle sie nicht führt. */
  still?: number
}

async function request(path: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
  } catch {
    throw new Error('OpenF1 ist gerade nicht erreichbar.')
  }
  // Eine leere Treffermenge meldet OpenF1 als 404 mit Erklärungstext, nicht als
  // leere Liste. Das ist kein Fehler, sondern die Antwort "dazu nichts da".
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`OpenF1 antwortete mit HTTP ${res.status}.`)
  return res.json()
}

/**
 * Die Grands Prix einer Saison. `session_type=Race` umfasst auch die Sprints,
 * deshalb wird zusätzlich auf `session_name` gefiltert – ein Sprint ist ein
 * eigenes Rennen und würde die Zuordnung zur Runde doppelt belegen.
 */
export function fetchRaceSessions(season: string): Promise<RaceSession[]> {
  return memo(`openf1:sessions:${season}`, async () => {
    const rows = (await request(`/sessions?year=${season}&session_type=Race`)) as any[]
    if (!Array.isArray(rows)) return []
    return rows
      .filter((r) => r.session_name === 'Race' && !r.is_cancelled && r.date_start)
      .map(
        (r): RaceSession => ({
          key: Number(r.session_key),
          day: String(r.date_start).slice(0, 10),
          location: String(r.location ?? ''),
        }),
      )
      .sort((a, b) => a.day.localeCompare(b.day))
  })
}

/**
 * Alle Boxenstopps der Rennen einer Saison, in einer Anfrage über den Bereich
 * der Session-Nummern. Der Bereich enthält auch Trainings und Qualifyings,
 * darum wird gegen die übergebenen Rennen gefiltert.
 *
 * Gespeichert wird nur das reduzierte Ergebnis: die Rohantwort ist rund
 * anderthalb Megabyte, davon wird ein Zehntel gebraucht.
 */
export function fetchPitStops(season: string, sessions: RaceSession[]): Promise<OpenF1Stop[]> {
  if (sessions.length === 0) return Promise.resolve([])

  return memo(`openf1:pit:${season}`, async () => {
    const keys = sessions.map((s) => s.key)
    const lo = Math.min(...keys)
    const hi = Math.max(...keys)
    const wanted = new Set(keys)

    const rows = (await request(`/pit?session_key>=${lo}&session_key<=${hi}`)) as any[]
    if (!Array.isArray(rows)) return []

    return rows
      .filter((r) => wanted.has(Number(r.session_key)))
      .map((r): OpenF1Stop => {
        const still = r.stop_duration == null ? undefined : Number(r.stop_duration)
        return {
          sessionKey: Number(r.session_key),
          carNumber: String(r.driver_number),
          lap: Number(r.lap_number),
          lane: Number(r.lane_duration ?? r.pit_duration),
          still: Number.isFinite(still) ? still : undefined,
        }
      })
      .filter((s) => Number.isFinite(s.lane) && s.lane > 0)
  })
}
