/**
 * Reifenstints je Rennen von OpenF1 laden und als CSV im Repo ablegen.
 *
 *   node scripts/lade-reifen.mjs [--ab 2023] [--max 30] [--neu]
 *
 * Weder F1DB noch Jolpica führen, auf welcher Mischung wer wie lange fuhr.
 * OpenF1 führt es ab 2023: je Fahrer und Stint die erste und letzte Runde,
 * die Mischung und wie viele Runden der Satz schon hatte. Daraus wird auf der
 * Rennseite die Strategie – das Bild, das ein Ergebnis am wenigsten verrät.
 *
 * Abgelegt wird wie bei den Rundendaten (lade-runden.mjs): eine CSV je
 * Rennen in reifen/, der Import spielt sie ein und prüft sie.
 *
 * Zwei Zuordnungen, und beide dürfen nicht raten:
 *
 *   Das Rennen. OpenF1 kennt Sessions mit Startzeit in UTC, F1DB Rennen mit
 *   Datum. Las Vegas startet samstags um 22 Uhr Ortszeit – in UTC ist dann
 *   Sonntag. Gesucht wird deshalb die Rennsession, die höchstens einen Tag
 *   vom Datum entfernt liegt; abgesagte (Imola 2023) zählen nicht. Gibt es
 *   keine oder mehr als eine, bleibt das Rennen offen.
 *
 *   Der Fahrer. OpenF1 nennt Startnummern. Welche Nummer wer war, steht für
 *   genau dieses Rennen in race_result. Eine Nummer, die dort nicht vorkommt,
 *   heißt: Das Rennen wird nicht gespeichert – lieber keine Strategie als
 *   eine, in der ein Fahrer fehlt oder der falsche steht.
 */
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'https://api.openf1.org/v1'
const MIN_ABSTAND_MS = 400
const MAX_VERSUCHE = 6
const BACKOFF_MS = 2000
/** Vor diesem Jahr führt OpenF1 keine Stints. */
const FRUEHESTES_JAHR = 2023
/** Die Mischungen, die OpenF1 nennt. Alles andere ist ein Fehler in den Daten. */
export const MISCHUNGEN = new Set(['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'])

const args = process.argv.slice(2)
const argWert = (name, ersatz) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : ersatz
}
const AB = Math.max(FRUEHESTES_JAHR, Number(argWert('--ab', FRUEHESTES_JAHR)))
const MAX = Number(argWert('--max', 1e9))
const NEU = args.includes('--neu')

const WURZEL = process.cwd()
const DB = path.join(WURZEL, 'data', 'f1.sqlite')
const ZIEL = path.join(WURZEL, 'reifen')
const schlaf = (ms) => new Promise((r) => setTimeout(r, ms))

let letzterStart = 0

/** Eine Anfrage mit Mindestabstand und wachsender Wartezeit bei Drosselung. */
async function hole(pfad) {
  for (let versuch = 0; ; versuch++) {
    const wartet = letzterStart + MIN_ABSTAND_MS - Date.now()
    if (wartet > 0) await schlaf(wartet)
    letzterStart = Date.now()

    let res
    try {
      res = await fetch(BASE + pfad, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(60_000) })
    } catch (e) {
      if (versuch >= MAX_VERSUCHE) throw new Error(`Netzfehler bei ${pfad}: ${e.message}`)
      await schlaf(BACKOFF_MS * 2 ** versuch)
      continue
    }
    if (res.status === 429) {
      if (versuch >= MAX_VERSUCHE) throw new Error(`Dauerhaft gedrosselt bei ${pfad}`)
      await schlaf(BACKOFF_MS * 2 ** versuch)
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} bei ${pfad}`)
    return res.json()
  }
}

const TAG_MS = 86_400_000

/**
 * Die eine Rennsession zu einem Datum, oder null. Exportiert für die Tests:
 * An Las Vegas und am abgesagten Imola entscheidet sich, ob sie stimmt.
 */
export function passendeSession(sessions, datum) {
  const tag = Date.parse(`${datum}T12:00:00Z`)
  const nah = sessions.filter((s) => !s.is_cancelled && Math.abs(Date.parse(s.date_start) - tag) <= 1.5 * TAG_MS)
  return nah.length === 1 ? nah[0] : null
}

/**
 * Stints prüfen und in Zeilen übersetzen, oder einen Grund liefern, warum
 * nicht. `nummern` bildet Startnummer → F1DB-Fahrer für dieses Rennen ab.
 */
export function stintZeilen(stints, nummern) {
  const unbekannt = new Set()
  const zeilen = []
  for (const s of stints) {
    const fahrer = nummern.get(String(s.driver_number))
    if (!fahrer) {
      unbekannt.add(s.driver_number)
      continue
    }
    // Ohne Runden oder Mischung ist ein Stint nicht zu zeichnen; OpenF1 führt solche Reste vereinzelt.
    if (!Number.isInteger(s.lap_start) || !Number.isInteger(s.lap_end) || s.lap_end < s.lap_start) continue
    if (!MISCHUNGEN.has(s.compound)) continue
    zeilen.push({
      fahrer,
      stint: s.stint_number,
      von: s.lap_start,
      bis: s.lap_end,
      mischung: s.compound,
      alter: Number.isInteger(s.tyre_age_at_start) ? s.tyre_age_at_start : null,
    })
  }
  if (unbekannt.size) return { fehler: `Startnummer nicht im Rennen: ${[...unbekannt].join(', ')}` }
  zeilen.sort((a, b) => a.fahrer.localeCompare(b.fahrer) || a.stint - b.stint)
  return { zeilen }
}

// ------------------------------------------------------------------- Lauf

if (process.argv[1]?.endsWith('lade-reifen.mjs')) {
  const db = new DatabaseSync(DB, { readOnly: true })
  fs.mkdirSync(ZIEL, { recursive: true })

  const rennen = db
    .prepare(
      `SELECT r.id, r.year, r.date FROM race r
        WHERE r.year >= ? AND EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)
        ORDER BY r.year DESC, r.round DESC`,
    )
    .all(AB)
  const nummernImRennen = db.prepare(
    'SELECT car_number AS nummer, driver_id AS fahrer FROM race_result WHERE race_id = ? AND car_number IS NOT NULL',
  )

  const offen = rennen.filter((r) => NEU || !fs.existsSync(path.join(ZIEL, `${r.id}.csv`))).slice(0, MAX)
  console.log(`Reifenstints ab ${AB}: ${offen.length} von ${rennen.length} Rennen in diesem Lauf.`)

  const sessionsJeJahr = new Map()
  let geladen = 0
  const fehlerhafte = []

  for (const r of offen) {
    try {
      if (!sessionsJeJahr.has(r.year)) sessionsJeJahr.set(r.year, await hole(`/sessions?year=${r.year}&session_name=Race`))
      const session = passendeSession(sessionsJeJahr.get(r.year), r.date)
      if (!session) {
        fehlerhafte.push(`${r.id}: keine eindeutige Rennsession am ${r.date}`)
        continue
      }
      const nummern = new Map(nummernImRennen.all(r.id).map((n) => [String(n.nummer), n.fahrer]))
      const { zeilen, fehler } = stintZeilen(await hole(`/stints?session_key=${session.session_key}`), nummern)
      if (fehler) {
        fehlerhafte.push(`${r.id}: ${fehler}`)
        continue
      }
      if (!zeilen.length) {
        fehlerhafte.push(`${r.id}: keine Stints`)
        continue
      }
      const csv = ['driver_id,stint,lap_start,lap_end,compound,tyre_age', ...zeilen.map((z) => `${z.fahrer},${z.stint},${z.von},${z.bis},${z.mischung},${z.alter ?? ''}`)]
      fs.writeFileSync(path.join(ZIEL, `${r.id}.csv`), csv.join('\n') + '\n')
      geladen++
      console.log(`  ${String(geladen).padStart(4)}/${offen.length}  ${r.id}  ${zeilen.length} Stints`)
    } catch (e) {
      fehlerhafte.push(`${r.id}: ${e.message}`)
    }
  }

  db.close()
  console.log(`\nFertig. ${geladen} Rennen gespeichert${fehlerhafte.length ? `, ${fehlerhafte.length} nicht` : ''}. Der nächste Import spielt sie ein.`)
  for (const f of fehlerhafte.slice(0, 20)) console.log('  ' + f)
}
