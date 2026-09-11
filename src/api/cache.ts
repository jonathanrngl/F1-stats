/*
 * Gemeinsamer Zwischenspeicher für alle Datenquellen.
 *
 * Zwei Schichten: eine Map über laufende und abgeschlossene Anfragen, damit
 * derselbe Schlüssel innerhalb einer Sitzung nur einmal fliegt, und der
 * localStorage darunter, damit ein Neuladen der Seite nicht alles erneut
 * anfragt. Der Speicher ist bewusst nur eine Beschleunigung – schlägt er fehl,
 * kostet das nichts als Zeit.
 *
 * Wichtig für die Aufrufer: hier wird das *reduzierte* Ergebnis abgelegt, nicht
 * die Rohantwort. Eine Saison Boxenstopps kommt bei OpenF1 als gut anderthalb
 * Megabyte, wovon ein Zehntel gebraucht wird; ungefiltert wäre die Quote des
 * localStorage nach zwei Saisons voll.
 */

const PREFIX = 'f1cache:v2:'
const TTL_MS = 6 * 60 * 60 * 1000

export function readStore<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return undefined
    const entry = JSON.parse(raw) as { t: number; v: T }
    if (Date.now() - entry.t > TTL_MS) {
      localStorage.removeItem(PREFIX + key)
      return undefined
    }
    return entry.v
  } catch {
    return undefined
  }
}

export function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value }))
  } catch {
    // Speicher voll oder gesperrt: eigene Einträge räumen, sonst nichts tun.
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(PREFIX)) localStorage.removeItem(k)
      }
    } catch {
      /* Ohne Cache läuft alles genauso, nur langsamer. */
    }
  }
}

const inflight = new Map<string, Promise<unknown>>()

/** Lädt einen Schlüssel höchstens einmal – aus dem Speicher, sonst über `load`. */
export function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const running = inflight.get(key)
  if (running) return running as Promise<T>

  const stored = readStore<T>(key)
  if (stored !== undefined) {
    const resolved = Promise.resolve(stored)
    inflight.set(key, resolved)
    return resolved
  }

  const pending = load()
    .then((value) => {
      writeStore(key, value)
      return value
    })
    .catch((e: unknown) => {
      inflight.delete(key) // Fehlschläge nicht merken, damit ein Retry möglich ist.
      throw e
    })

  inflight.set(key, pending)
  return pending
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
