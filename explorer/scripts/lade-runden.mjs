/**
 * Rundenweise Positionen von Jolpica nachladen.
 *
 *   node scripts/lade-runden.mjs [--ab 1996] [--bis 2026] [--fortsetzen]
 *
 * F1DB führt keine Rundendaten. Sie sind aber die einzige Grundlage für den
 * Positionsverlauf eines Rennens und für Führungsrunden – und damit für zwei
 * Kennzahlen, nach denen die Spezifikation ausdrücklich fragt.
 *
 * Der Lauf ist sehr teuer, und zwar teurer, als es aussieht: Jolpica
 * paginiert Rundendaten nicht nach Rennen, sondern nach ZEITNAHMEN – also
 * Fahrer mal Runde. Ein einzelnes modernes Rennen sind rund 1.100 Zeilen und
 * damit zwölf Anfragen, nicht eine.
 *
 * Gerechnet für alles ab 1996: 591 Rennen, 36.025 gefahrene Runden, im Schnitt
 * 20,6 Starter – macht 741.225 Zeitnahmen und 7.413 Anfragen. Bei 500 pro
 * Stunde sind das knapp 15 Stunden. Deshalb gibt es --entscheidungen und
 * --ab/--bis: Ein gezielter Ausschnitt ist in einer Stunde zu haben, der
 * vollständige Bestand braucht einen Lauf über Nacht.
 *
 * Vor 1996 liefert Jolpica nichts – gemessen, nicht vermutet: 1995 gibt null
 * Zeilen zurück, 1996 gibt 812.
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const BASE = 'https://api.jolpi.ca/ergast/f1'
const PAGE = 100
const MIN_ABSTAND_MS = 300
const MAX_VERSUCHE = 5
const BACKOFF_MS = 1500
/** Vor diesem Jahr führt Jolpica keine Rundendaten. */
const FRUEHESTES_JAHR = 1996

const args = process.argv.slice(2)
const argWert = (name, ersatz) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : ersatz
}
const AB = Math.max(FRUEHESTES_JAHR, Number(argWert('--ab', FRUEHESTES_JAHR)))
const BIS = Number(argWert('--bis', 2100))
const FORTSETZEN = args.includes('--fortsetzen')
/** Nur die Rennen, in denen ein Titel fiel – ein bezahlbarer, sinnvoller Ausschnitt. */
const NUR_ENTSCHEIDUNGEN = args.includes('--entscheidungen')

const DB = path.join(process.cwd(), 'data', 'f1.sqlite')
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
      res = await fetch(BASE + pfad, { headers: { Accept: 'application/json' } })
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

// ------------------------------------------------------------------- Lauf

const db = new DatabaseSync(DB)
db.exec('PRAGMA journal_mode = WAL')

/*
 * Jolpica kennt nur Saison und Runde, die eigene Datenbank sprechende
 * Kennungen. Diese Karte übersetzt – und filtert gleich die Rennen heraus,
 * die schon geladen sind.
 */
const rennen = db
  .prepare(
    `SELECT r.id, r.year, r.round,
            (SELECT COUNT(*) FROM lap_position l WHERE l.race_id = r.id) AS schon
       FROM race r
      WHERE r.year >= ? AND r.year <= ?${NUR_ENTSCHEIDUNGEN ? ' AND r.drivers_title_decider = 1' : ''}
      ORDER BY r.year, r.round`,
  )
  .all(AB, BIS)

const offen = FORTSETZEN ? rennen.filter((r) => r.schon === 0) : rennen
const fahrerIds = new Set(db.prepare('SELECT id FROM driver').all().map((z) => z.id))

console.log(
  `Rundendaten ${AB}–${Math.min(BIS, Math.max(...rennen.map((r) => r.year)))}: ` +
    `${offen.length} von ${rennen.length} Rennen offen.`,
)
if (offen.length === 0) {
  db.close()
  process.exit(0)
}
// Zwölf Seiten je modernem Rennen, nicht eine – siehe Kopfkommentar.
const SEITEN_JE_RENNEN = 12
const anfragen = offen.length * SEITEN_JE_RENNEN
console.log(
  `Geschätzt ${anfragen.toLocaleString('de-DE')} Anfragen, bei 500 pro Stunde rund ` +
    `${(anfragen / 500).toFixed(1)} Stunden.
`,
)

const einfuegen = db.prepare(
  'INSERT OR REPLACE INTO lap_position (race_id, driver_id, lap, position, time_ms) VALUES (?, ?, ?, ?, ?)',
)

let geladen = 0
let zeilenGesamt = 0
let ohneDaten = 0
const fehlerhafte = []

for (const r of offen) {
  try {
    const zeilen = await rundenEinesRennens(r.year, r.round)
    if (zeilen.length === 0) {
      ohneDaten++
    } else {
      db.exec('BEGIN')
      for (const z of zeilen) {
        // Ein Fahrer, den die eigene Datenbank nicht kennt, würde den
        // Fremdschlüssel brechen. Das kommt vor, wenn Jolpica und F1DB eine
        // Kennung unterschiedlich schreiben – dann lieber die Zeile weglassen.
        if (!fahrerIds.has(z.driverId)) continue
        einfuegen.run(r.id, z.driverId, z.lap, z.position, z.timeMs)
      }
      db.exec('COMMIT')
      zeilenGesamt += zeilen.length
    }
    geladen++
    if (geladen % 20 === 0 || geladen === offen.length) {
      console.log(
        `  ${String(geladen).padStart(4)}/${offen.length}  ${r.year} R${r.round}  ` +
          `${zeilenGesamt.toLocaleString('de-DE')} Rundenzeilen` +
          (ohneDaten ? `, ${ohneDaten} Rennen ohne Daten` : ''),
      )
    }
  } catch (e) {
    fehlerhafte.push(`${r.year} R${r.round}: ${e.message}`)
    console.error(`  FEHLER ${r.year} R${r.round}: ${e.message}`)
    // Weitermachen: Ein einzelnes fehlendes Rennen ist kein Grund, den
    // ganzen Lauf zu verwerfen. --fortsetzen holt es beim nächsten Mal.
  }
}

// Deckung neu auszählen, damit die Oberfläche weiß, was jetzt belegt ist.
const z = db
  .prepare(
    `SELECT MIN(r.year) a, MAX(r.year) b, COUNT(DISTINCT l.race_id) n
       FROM lap_position l JOIN race r ON r.id = l.race_id`,
  )
  .get()
if (z.a !== null) {
  const gesamt = db.prepare('SELECT COUNT(*) n FROM race WHERE year BETWEEN ? AND ?').get(z.a, z.b).n
  db.prepare(
    `INSERT OR REPLACE INTO coverage (metric, first_year, last_year, completeness, source, note)
     VALUES ('lap_position', ?, ?, ?, 'Jolpica', 'Positionsverlauf je Runde')`,
  ).run(z.a, z.b, gesamt > 0 ? z.n / gesamt : 0)
  console.log(
    `\nDeckung: ${z.a}–${z.b}, ${z.n} Rennen (${Math.round((z.n / gesamt) * 100)} % des Zeitraums).`,
  )
}

db.close()
console.log(
  `\nFertig. ${geladen} Rennen geladen, ${zeilenGesamt.toLocaleString('de-DE')} Rundenzeilen` +
    (ohneDaten ? `, ${ohneDaten} ohne Daten` : '') +
    (fehlerhafte.length ? `, ${fehlerhafte.length} fehlgeschlagen` : '') +
    '.',
)
if (fehlerhafte.length) {
  console.log('Fehlgeschlagen (mit --fortsetzen erneut versuchen):')
  for (const f of fehlerhafte.slice(0, 10)) console.log('  ' + f)
}
