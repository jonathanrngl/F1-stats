/*
 * Formatierung an einer Stelle, damit Tabellen und Graph dieselbe Sprache
 * sprechen. Zeitwerte behalten den Punkt als Dezimaltrenner: die API liefert
 * '1:33.660', und im Motorsport wird auch hierzulande so geschrieben.
 */

export interface DriverLike {
  code?: string
  givenName: string
  familyName: string
}

export const driverName = (d: DriverLike) => `${d.givenName} ${d.familyName}`

/** Altdaten haben kein Kuerzel – dann die ersten drei Buchstaben des Nachnamens. */
export const driverCode = (d: DriverLike) => d.code ?? d.familyName.slice(0, 3).toUpperCase()

/** '1:33.660' -> 93.66. NaN, wenn nichts Verwertbares drinsteht. */
export function lapSeconds(time: string | undefined): number {
  if (!time) return NaN
  const parts = time.split(':')
  const secs = Number(parts.pop())
  const mins = Number(parts.pop() ?? 0)
  const hours = Number(parts.pop() ?? 0)
  return Number.isNaN(secs) ? NaN : hours * 3600 + mins * 60 + secs
}

/** Rueckstand in Sekunden als '+0.283'. */
export const gapLabel = (seconds: number) =>
  Number.isNaN(seconds) ? '' : seconds === 0 ? '—' : `+${seconds.toFixed(3)}`

export const raceDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE')

export const raceDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Startplatz gegen Zielposition. Ein Startplatz 0 heisst in den Ergast-Daten
 * "aus der Boxengasse gestartet" und laesst sich nicht sinnvoll verrechnen.
 */
export function positionDelta(grid: string, position: string): number | null {
  const from = Number(grid)
  const to = Number(position)
  if (!from || !to) return null
  return from - to
}

export const deltaLabel = (delta: number | null) =>
  delta === null ? '' : delta === 0 ? '±0' : delta > 0 ? `+${delta}` : String(delta)

/** Ausfaelle und Disqualifikationen haben keine Zahl, sondern 'R', 'D', 'W', 'E', 'F', 'N'. */
export const isClassified = (positionText: string) => /^\d+$/.test(positionText)

/** 'Finished' und '+1 Lap' heissen: das Auto kam an. Alles andere ist ein Ausfall. */
export const reachedFinish = (status: string) =>
  status === 'Finished' || /^\+\d+ Lap/.test(status) || status === 'Lapped'

/** Punkte koennen halbe sein (1954, Belgien 2021) – deutsch mit Komma. */
export const pointsLabel = (points: number) => points.toLocaleString('de-DE')

/*
 * Session-Termine kommen als UTC-Datum plus UTC-Uhrzeit. Mit Uhrzeit wird
 * beides zusammen geparst und spaeter in der Zeitzone des Lesers angezeigt –
 * bei einem Rennen in Las Vegas ist das der entscheidende Unterschied. Ohne
 * Uhrzeit (alte Saisons) wird bewusst als lokale Mitternacht geparst, damit
 * das angezeigte Datum dem Datum in den Daten entspricht und nicht um einen
 * Tag verrutscht.
 */
export const sessionDateTime = (session: { date: string; time?: string }) =>
  new Date(session.time ? `${session.date}T${session.time}` : `${session.date}T00:00:00`)

export const weekdayDate = (d: Date) =>
  d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

export const clockTime = (d: Date) =>
  d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/** Kurzform der Zeitzone des Lesers, damit die Uhrzeiten einen Bezug haben. */
export const localZone = () => {
  try {
    return new Intl.DateTimeFormat('de-DE', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}
