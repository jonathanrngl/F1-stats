/**
 * Rundenweise Positionen von Jolpica laden und als CSV im Repo ablegen.
 *
 *   node scripts/lade-runden.mjs [--entscheidungen] [--ab 1996] [--bis 2026] [--max 30] [--neu]
 *
 * F1DB führt keine Rundendaten. Sie sind aber die einzige Grundlage für den
 * Positionsverlauf eines Rennens und für Führungsrunden.
 *
 * Zwei Fehler hatte die erste Fassung, und beide ließen die Tabelle leer:
 *
 *   Die Kennungen. Jolpica schreibt „max_verstappen“ und „hamilton“, F1DB
 *   „max-verstappen“ und „lewis-hamilton“. Jede Zeile, deren Fahrer die
 *   Datenbank nicht kannte, wurde still verworfen – also praktisch alle, und
 *   das Protokoll zählte sie trotzdem mit. Jetzt wird je Rennen zugeordnet:
 *   gegen die Fahrer, die F1DB für genau dieses Rennen führt. Dort ist ein
 *   Nachname so gut wie immer eindeutig. Was sich nicht zuordnen lässt, steht
 *   im Protokoll, und ein Rennen mit Lücken wird nicht gespeichert.
 *
 *   Der Ort. Die Zeilen landeten in data/f1.sqlite, und der nächste Import
 *   baute diese Datei neu – ohne sie. Jetzt liegen sie als eine CSV je Rennen
 *   in runden/, im Repo, und der Import spielt sie jedes Mal ein.
 *
 * Der Lauf ist teuer: Jolpica paginiert nach Zeitnahmen, ein modernes Rennen
 * sind rund zwölf Anfragen, bei 500 je Stunde. --max begrenzt einen Lauf so,
 * dass er in einer Stunde bleibt; runden.yml ruft ihn regelmäßig auf, bis
 * alles da ist. Vorhandene Rennen werden übersprungen, außer mit --neu.
 *
 * Vor 1996 liefert Jolpica nichts – gemessen, nicht vermutet: 1995 gibt null
 * Zeilen zurück, 1996 gibt 812.
 */
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'https://api.jolpi.ca/ergast/f1'
const PAGE = 100
const MIN_ABSTAND_MS = 350
const MAX_VERSUCHE = 6
const BACKOFF_MS = 2000
/** Vor diesem Jahr führt Jolpica keine Rundendaten. */
const FRUEHESTES_JAHR = 1996

const args = process.argv.slice(2)
const argWert = (name, ersatz) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : ersatz
}
const AB = Math.max(FRUEHESTES_JAHR, Number(argWert('--ab', FRUEHESTES_JAHR)))
const BIS = Number(argWert('--bis', 2100))
const MAX = Number(argWert('--max', 1e9))
const NEU = args.includes('--neu')
/** Nur die Rennen, in denen ein Titel fiel – ein bezahlbarer, sinnvoller Ausschnitt. */
const NUR_ENTSCHEIDUNGEN = args.includes('--entscheidungen')

const WURZEL = process.cwd()
const DB = path.join(WURZEL, 'data', 'f1.sqlite')
const ZIEL = path.join(WURZEL, 'runden')
const schlaf = (ms) => new Promise((r) => setTimeout(r, ms))

let letzterStart = 0

/**
 * Eine Anfrage mit Mindestabstand und wachsender Wartezeit bei Drosselung.
 * Das Stundenlimit lässt sich nicht vorhersagen, deshalb wird bei 429 immer
 * länger gewartet, statt aufzugeben.
 */
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
      const warten = BACKOFF_MS * 2 ** versuch
      process.stdout.write(` [gedrosselt, warte ${Math.round(warten / 1000)}s]`)
      await schlaf(warten)
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} bei ${pfad}`)
    return (await res.json()).MRData
  }
}

/** Alle Runden eines Rennens, über Seiten hinweg zusammengesetzt. */
async function rundenEinesRennens(jahr, runde) {
  const zeilen = []
  let offset = 0
  let gesamt = 1

  while (offset < gesamt) {
    const d = await hole(`/${jahr}/${runde}/laps/?limit=${PAGE}&offset=${offset}`)
    gesamt = Number(d.total) || 0
    for (const r of d.RaceTable.Races ?? []) {
      for (const lap of r.Laps ?? []) {
        for (const t of lap.Timings ?? []) {
          zeilen.push({
            driverId: t.driverId,
            lap: Number(lap.number),
            position: Number(t.position),
            timeMs: zeitZuMs(t.time),
          })
        }
      }
    }
    offset += PAGE
  }
  return zeilen
}

/** "1:37.284" oder "37.284" nach Millisekunden. */
function zeitZuMs(t) {
  if (!t) return null
  const m = /^(?:(\d+):)?(\d+)\.(\d+)$/.exec(t.trim())
  if (!m) return null
  return (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000 + Number(m[3].padEnd(3, '0').slice(0, 3))
}

const falte = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * Jolpica-Kennung → F1DB-Kennung, für die Fahrer eines Rennens.
 *
 * Drei Stufen: erst gleich bis auf Unterstrich und Bindestrich
 * („max_verstappen“), dann als Nachname eines der Fahrer dieses Rennens
 * („hamilton“ → „lewis-hamilton“), dann über den Nachnamen allein. Mehrdeutig
 * heißt: nicht zugeordnet.
 */
export function ordneZu(jolpicaId, fahrerImRennen) {
  const norm = falte(jolpicaId)
  if (fahrerImRennen.some((f) => f.id === norm)) return norm
  // „Jr.“ und „Sr.“ gehören in F1DB zum Namen, bei Jolpica nicht: carlos-sainz-jr ↔ sainz.
  const ohneZusatz = (s) => s.replace(/-+(jr|sr)-*$/, '').replace(/-+$/, '')
  // Namenszusätze wie „D'“ lässt Jolpica weg: jerome-dambrosio ↔ ambrosio.
  const passend = fahrerImRennen.filter((f) => {
    const nachname = ohneZusatz(falte(f.nachname))
    return ohneZusatz(f.id).endsWith(`-${norm}`) || nachname === norm || nachname.endsWith(`-${norm}`)
  })
  if (passend.length === 1) return passend[0].id
  const teil = fahrerImRennen.filter((f) => {
    const n = ohneZusatz(falte(f.nachname))
    return n && (norm.endsWith(`-${n}`) || norm.includes(n))
  })
  return teil.length === 1 ? teil[0].id : null
}

// ------------------------------------------------------------------- Lauf

if (process.argv[1]?.endsWith('lade-runden.mjs')) {
  const db = new DatabaseSync(DB, { readOnly: true })
  fs.mkdirSync(ZIEL, { recursive: true })

  const rennen = db
    .prepare(
      `SELECT r.id, r.year, r.round FROM race r
        WHERE r.year >= ? AND r.year <= ?${NUR_ENTSCHEIDUNGEN ? ' AND r.drivers_title_decider = 1' : ''}
          AND EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)
        ORDER BY r.year DESC, r.round DESC`,
    )
    .all(AB, BIS)
  const fahrerJeRennen = db.prepare(
    `SELECT DISTINCT d.id, d.last_name AS nachname FROM race_result rr JOIN driver d ON d.id = rr.driver_id
      WHERE rr.race_id = ?`,
  )

  const offen = rennen.filter((r) => NEU || !fs.existsSync(path.join(ZIEL, `${r.id}.csv`))).slice(0, MAX)
  console.log(`Rundendaten ${AB}–${Math.min(BIS, rennen[0]?.year ?? BIS)}: ${offen.length} von ${rennen.length} Rennen in diesem Lauf.`)

  let geladen = 0
  let zeilenGesamt = 0
  let ohneDaten = 0
  const fehlerhafte = []

  for (const r of offen) {
    try {
      const zeilen = await rundenEinesRennens(r.year, r.round)
      if (zeilen.length === 0) {
        ohneDaten++
        continue
      }
      const imRennen = fahrerJeRennen.all(r.id)
      const zuordnung = new Map()
      const offenIds = new Set()
      for (const z of zeilen) {
        if (zuordnung.has(z.driverId) || offenIds.has(z.driverId)) continue
        const f1db = ordneZu(z.driverId, imRennen)
        if (f1db) zuordnung.set(z.driverId, f1db)
        else offenIds.add(z.driverId)
      }
      if (offenIds.size) {
        // Lieber kein Rennen als eines, in dem ein Fahrer fehlt: Der Verlauf wäre falsch.
        fehlerhafte.push(`${r.id}: nicht zuzuordnen: ${[...offenIds].join(', ')}`)
        console.error(`  LÜCKE ${r.id}: ${[...offenIds].join(', ')}`)
        continue
      }
      const csv = ['driver_id,lap,position,time_ms', ...zeilen.map((z) => `${zuordnung.get(z.driverId)},${z.lap},${z.position},${z.timeMs ?? ''}`)]
      fs.writeFileSync(path.join(ZIEL, `${r.id}.csv`), csv.join('\n') + '\n')
      geladen++
      zeilenGesamt += zeilen.length
      console.log(`  ${String(geladen).padStart(4)}/${offen.length}  ${r.id}  ${zeilen.length} Zeitnahmen`)
    } catch (e) {
      fehlerhafte.push(`${r.id}: ${e.message}`)
      console.error(`  FEHLER ${r.id}: ${e.message}`)
      // Weitermachen: Ein einzelnes fehlendes Rennen ist kein Grund, den
      // ganzen Lauf zu verwerfen. Der nächste Lauf holt es.
    }
  }

  db.close()
  console.log(
    `\nFertig. ${geladen} Rennen gespeichert, ${zeilenGesamt.toLocaleString('de-DE')} Zeitnahmen` +
      (ohneDaten ? `, ${ohneDaten} ohne Daten` : '') +
      (fehlerhafte.length ? `, ${fehlerhafte.length} nicht gespeichert` : '') +
      '. Der nächste Import spielt sie ein.',
  )
  if (fehlerhafte.length) for (const f of fehlerhafte.slice(0, 20)) console.log('  ' + f)
}
