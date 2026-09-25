/**
 * F1DB-Release in die eigene SQLite-Datenbank importieren.
 *
 *   node scripts/import.mjs [--version <tag> | --neueste] [--csv <verzeichnis>] [--out <datei>]
 *
 * Ohne --csv lädt das Skript die Fassung, die in `f1db-version.txt` steht.
 * Der Import schreibt nichts, wenn eine Prüfung fehlschlägt: Die bisherige
 * Datenbank bleibt dann unberührt stehen – lieber die alte als eine mit
 * falschen Zahlen.
 */
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

// fileURLToPath statt .pathname: Dort bliebe ein Leerzeichen im Pfad als %20 stehen.
const HIER = path.dirname(fileURLToPath(import.meta.url))
const WURZEL = path.join(HIER, '..')
/*
 * Standardmaessig gilt die Fassung aus `f1db-version.txt`, nicht die neueste.
 *
 * Vorher holte jeder Bau das neueste Release. Das hatte zwei Folgen: Derselbe
 * Commit ergab an zwei Tagen zwei verschiedene Seiten, und ein fehlerhaftes
 * Release hielt jeden Deploy an – auch einen, der nur einen Tippfehler
 * behob. Jetzt steht die Fassung im Repo. Eine neue kommt nur herein, wenn
 * sie importiert, geprueft und gebaut ist (.github/workflows/f1db-update.yml);
 * bis dahin baut jeder Deploy den letzten guten Stand.
 *
 * Geholt wird sie nicht blind. Das Skript laedt die "checksums_sha256.txt"
 * des Releases und prueft das Archiv dagegen. Das faengt den abgerissenen
 * oder unterwegs veraenderten Download.
 *
 * Was es nicht faengt: ein Release, das an der Quelle veraendert wurde - wer
 * das Archiv austauschen koennte, koennte auch die Pruefsummendatei
 * austauschen. Die zweite Verteidigungslinie steht deshalb weiter unten und
 * ist die wichtigere: Was aus dem Archiv zu einer Adresse wird, wird
 * geprueft, bevor es eine wird (siehe `kennung`).
 *
 *   npm run import                         die gepinnte Fassung
 *   npm run import -- --version v2026.14.1 eine bestimmte
 *   npm run import -- --neueste            die neueste veroeffentlichte
 */
const REPO = 'f1db/f1db'
const ARCHIV = 'f1db-csv.zip'
const releaseUrl = (version, datei) =>
  `https://github.com/${REPO}/releases/download/${version}/${datei}`

/** So sieht ein F1DB-Tag aus. Alles andere wird nie Teil einer Adresse. */
const TAG = /^v\d{4}\.\d{1,3}\.\d{1,3}$/

// --------------------------------------------------------------- Argumente

const args = process.argv.slice(2)
const argWert = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const ZIEL = path.resolve(argWert('--out') ?? path.join(WURZEL, 'data', 'f1.sqlite'))
let CSV = argWert('--csv') && path.resolve(argWert('--csv'))
const NEUESTE = args.includes('--neueste')

/** Die gepinnte Fassung aus f1db-version.txt. */
async function gepinnteVersion() {
  const text = (await fs.readFile(path.join(WURZEL, 'f1db-version.txt'), 'utf8')).trim()
  if (!TAG.test(text)) throw new Error(`f1db-version.txt enthaelt keinen gueltigen Tag: ${JSON.stringify(text)}`)
  return text
}

/*
 * Kein Abruf darf ewig haengen: Ohne Zeitgrenze wartete ein stockender
 * Download bis zum Ablauf des CI-Jobs, und das sind sechs Stunden.
 */
const MINUTE = 60_000
const mitGrenze = (ms) => ({ signal: AbortSignal.timeout(ms) })

// ------------------------------------------------------------- CSV-Leser

/**
 * CSV nach Objekten. Eigener Leser statt Abhängigkeit: Die Dateien halten
 * sich an RFC 4180, und mehr als Anführungszeichen, eingebettete Kommas und
 * Zeilenumbrüche kommt darin nicht vor.
 */
function parseCSV(text) {
  const zeilen = []
  let zeile = []
  let feld = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          feld += '"'
          i++
        } else inQuotes = false
      } else feld += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      zeile.push(feld)
      feld = ''
    } else if (c === '\n') {
      zeile.push(feld)
      zeilen.push(zeile)
      zeile = []
      feld = ''
    } else if (c !== '\r') feld += c
  }
  if (feld !== '' || zeile.length) {
    zeile.push(feld)
    zeilen.push(zeile)
  }

  const kopf = zeilen.shift() ?? []
  // Die leere Zeile am Dateiende ist keine Zeile, sondern ein Zeilenumbruch.
  const echte = zeilen.filter((r) => !(r.length === 1 && r[0] === ''))
  const krumm = echte.filter((r) => r.length !== kopf.length)
  return {
    kopf,
    krumm: krumm.length,
    zeilen: echte
      .filter((r) => r.length === kopf.length)
      .map((r) => Object.fromEntries(kopf.map((h, i) => [h, r[i]]))),
  }
}

/**
 * Eine CSV lesen – und laut scheitern, statt still weniger zu liefern.
 *
 * Zwei Arten, auf die ein neues Release Daten verlieren könnte, ohne dass es
 * jemand merkt: Eine Zeile mit falscher Spaltenzahl fiele einfach weg, und
 * eine umbenannte Spalte käme überall als NULL an. Beides bricht hier ab.
 * `spalten` sind die Felder, die dieser Import wirklich liest.
 */
async function lies(datei, spalten = []) {
  const { kopf, krumm, zeilen } = parseCSV(await fs.readFile(path.join(CSV, datei), 'utf8'))
  if (krumm > 0) throw new Error(`${datei}: ${krumm} Zeilen mit falscher Spaltenzahl`)
  const fehlend = spalten.filter((s) => !kopf.includes(s))
  if (fehlend.length) throw new Error(`${datei}: Spalten fehlen: ${fehlend.join(', ')}`)
  return zeilen
}

// Leerstring heißt in F1DB „nicht überliefert" – und wird hier NULL, nie 0.
const txt = (v) => (v === undefined || v === '' ? null : v)
const zahl = (v) => (v === undefined || v === '' ? null : Number(v))
/** Startplatz 0 ist keine Position, sondern eine Lücke. */
const platz = (v) => {
  const n = zahl(v)
  return n === null || n === 0 ? null : n
}
const ja = (v) => (v === 'true' ? 1 : 0)

/*
 * Kennungen aus dem Archiv werden zu Dateipfaden: aus driver.id entsteht in
 * getStaticPaths unmittelbar /drivers/<id>/ und /api/v1/drivers/<id>.json.
 * Eine Kennung mit "../" darin schriebe beim Bauen Dateien ausserhalb von
 * dist/. Das Archiv ist fremde Eingabe - also geprueft, nicht geglaubt.
 *
 * Erlaubt ist genau das, was eine F1DB-Kennung ausmacht: Kleinbuchstaben,
 * Ziffern und Bindestriche. Kein Punkt, kein Schraegstrich, kein Doppelpunkt.
 */
const KENNUNG = /^[a-z0-9][a-z0-9-]*$/
const kennung = (wert, wo) => {
  const v = txt(wert)
  if (v === null) throw new Error(`Leere Kennung in ${wo}`)
  if (v.length > 100 || !KENNUNG.test(v)) {
    throw new Error(`Unzulaessige Kennung in ${wo}: ${JSON.stringify(v)}`)
  }
  return v
}

/*
 * positionText-Werte, die eine Nennung ohne Start bezeichnen: nicht
 * qualifiziert, nicht angetreten, zurückgezogen, ausgeschlossen. Mit genau
 * dieser Liste stimmen die Startzahlen für alle 860 Fahrer mit den
 * Gesamtzahlen von F1DB überein.
 */
const NICHT_GESTARTET = new Set(['DNQ', 'DNPQ', 'DNS', 'WD', 'DNA', 'EX', 'DNP'])

// ------------------------------------------------------------- Beschaffung

/**
 * Die neueste veroeffentlichte Fassung.
 *
 * Mit GITHUB_TOKEN, wo es eins gibt: Ohne erlaubt die API 60 Anfragen je
 * Stunde und Adresse, und die Runner von GitHub teilen sich Adressen.
 */
async function neuesteVersion() {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'f1-stats-import' }
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers,
    ...mitGrenze(MINUTE),
  })
  if (!res.ok) throw new Error(`GitHub-API nicht erreichbar (HTTP ${res.status})`)
  const tag = (await res.json()).tag_name
  if (!tag || !TAG.test(tag)) throw new Error(`GitHub-API nennt keinen gueltigen Tag: ${JSON.stringify(tag)}`)
  return tag
}

/**
 * Die Pruefsumme, die das Release selbst fuer das Archiv angibt.
 *
 * Sie beweist nicht, dass das Archiv in Ordnung ist - wer es austauschen kann,
 * kann auch diese Datei austauschen. Sie beweist, dass angekommen ist, was
 * abgeschickt wurde: gegen abgerissene Downloads und gegen Veraenderung auf
 * dem Weg.
 */
async function veroeffentlichtePruefsumme(version) {
  const res = await fetch(releaseUrl(version, 'checksums_sha256.txt'), { redirect: 'follow', ...mitGrenze(MINUTE) })
  if (!res.ok) throw new Error(`checksums_sha256.txt nicht erreichbar (HTTP ${res.status})`)
  const zeile = (await res.text()).split('\n').find((z) => z.trim().endsWith(ARCHIV))
  if (!zeile) throw new Error(`checksums_sha256.txt nennt ${ARCHIV} nicht`)
  return zeile.trim().split(/\s+/)[0].toLowerCase()
}

async function holeRelease() {
  const tmp = path.join(WURZEL, 'data', '.f1db')
  await fs.mkdir(tmp, { recursive: true })
  const zip = path.join(tmp, ARCHIV)

  const gewuenscht = argWert('--version')
  if (gewuenscht !== undefined && !TAG.test(gewuenscht)) throw new Error(`Kein gueltiger Tag: ${JSON.stringify(gewuenscht)}`)
  const version = gewuenscht ?? (NEUESTE ? await neuesteVersion() : await gepinnteVersion())
  const erwartet = await veroeffentlichtePruefsumme(version)

  console.log(`Lade F1DB ${version} …`)
  const res = await fetch(releaseUrl(version, ARCHIV), { redirect: 'follow', ...mitGrenze(10 * MINUTE) })
  if (!res.ok) throw new Error(`Release ${version} nicht erreichbar (HTTP ${res.status})`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zip))

  const ist = createHash('sha256').update(await fs.readFile(zip)).digest('hex')
  if (ist !== erwartet) {
    await fs.rm(zip, { force: true })
    throw new Error(
      `Pruefsumme von ${ARCHIV} weicht ab.\n` +
        `  erwartet: ${erwartet}\n` +
        `  bekommen: ${ist}\n` +
        'Das Archiv ist nicht vollstaendig angekommen - es wird nicht benutzt.',
    )
  }
  /*
   * Fassung und Pruefsumme in den Bauprotokollen: Bei "latest" ist das die
   * einzige Stelle, an der spaeter noch steht, aus welchen Daten eine
   * bestimmte Fassung der Seite entstanden ist.
   */
  console.log(`  sha256 geprueft: ${ist}`)

  const ziel = path.join(tmp, 'csv')
  await fs.rm(ziel, { recursive: true, force: true })
  await fs.mkdir(ziel, { recursive: true })
  entpacke(zip, ziel)

  const { size } = await fs.stat(zip)
  console.log(`  ${(size / 1024 / 1024).toFixed(1)} MB entpackt nach ${path.relative(WURZEL, ziel)}`)
  return { verzeichnis: ziel, version, pruefsumme: ist }
}

/**
 * ZIP entpacken, ohne Abhängigkeit.
 *
 * Auf Windows liegt `tar` als bsdtar bei und kann ZIP. Auf Linux ist `tar`
 * GNU tar und kann es nicht – dort entpackt `unzip`. Welches Werkzeug
 * vorhanden ist, entscheidet der Versuch, nicht eine Abfrage der Plattform:
 * Auf einem Linux mit bsdtar oder einem Windows mit unzip stimmte sie sonst
 * nicht.
 */
function entpacke(zip, ziel) {
  const versuche = [
    ['tar', ['-xf', zip, '-C', ziel]],
    ['unzip', ['-q', '-o', zip, '-d', ziel]],
  ]
  const fehler = []
  for (const [werkzeug, args] of versuche) {
    try {
      execFileSync(werkzeug, args, { stdio: 'pipe' })
      return
    } catch (e) {
      fehler.push(`${werkzeug}: ${e.stderr?.toString().trim() || e.message}`)
    }
  }
  throw new Error(`Das Release liess sich nicht entpacken.\n  ${fehler.join('\n  ')}`)
}

// ----------------------------------------------------------------- Import

async function importiere(db) {
  const zaehler = {}
  const einfuegen = (tabelle, spalten, zeilen, abbilden) => {
    const platzhalter = spalten.map(() => '?').join(', ')
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${tabelle} (${spalten.join(', ')}) VALUES (${platzhalter})`,
    )
    let n = 0
    for (const z of zeilen) {
      const werte = abbilden(z)
      if (werte === null) continue
      stmt.run(...werte)
      n++
    }
    zaehler[tabelle] = n
    return n
  }

  // -- Stammdaten ----------------------------------------------------------

  einfuegen(
    'country',
    ['id', 'alpha3', 'ioc', 'name', 'demonym'],
    await lies('f1db-countries.csv', ['id', 'alpha3Code', 'iocCode', 'name', 'demonym']),
    (c) => [kennung(c.id, 'country.id'), txt(c.alpha3Code), txt(c.iocCode), c.name, txt(c.demonym)],
  )

  /**
   * Der Name, unter dem ein Fahrer gefahren ist.
   *
   * F1DB fuehrt zwei Namen. `fullName` ist der aus dem Pass - 'Andreas
   * Nikolaus Lauda', 'Sir John Young Stewart', 'James Clark, Jr.'. Niemand
   * kennt die Fahrer so, und in einer Tabelle mit 860 Zeilen oder einer
   * Diagrammlegende richtet das echten Schaden an.
   *
   * Vor- und Nachname zusammen ergeben den bekannten Namen - mit einer
   * Ausnahme: F1DB schreibt den Nachnamen gross, auch wo das Adelspartikel
   * klein gehoert. So wuerde aus 'von Trips' ein 'Von Trips', aus 'de Angelis'
   * ein 'De Angelis'; 28 Fahrer sind betroffen. Die richtige Schreibweise
   * steht im vollen Namen, also wird sie von dort geholt: Kommt der Nachname
   * darin vor (ohne Ruecksicht auf Gross- und Kleinschreibung), gilt dessen
   * Schreibung.
   */
  const PARTIKEL = new Set(['de', 'del', 'della', 'di', 'da', 'dos', 'van', 'von', 'ter', 'ten', 'la', 'le'])

  const anzeigename = (d) => {
    const voll = d.fullName ?? ''
    const i = voll.toLowerCase().lastIndexOf((d.lastName ?? '').toLowerCase())
    let nach = i >= 0 && d.lastName ? voll.slice(i, i + d.lastName.length) : d.lastName

    /*
     * Rueckfall, wenn der volle Name den Nachnamen gar nicht enthaelt. Das
     * trifft genau einen Fahrer: 'De Portago' taucht in 'Alfonso Antonio
     * Vicente Eduardo Angel Blas Francisco de Borja Cabeza de Vaca y Leighton'
     * nicht auf. Dann entscheidet die Liste der Partikel, die im Namensinneren
     * klein bleiben.
     */
    if (i < 0 && nach) {
      const [erstes, ...rest] = nach.split(' ')
      if (PARTIKEL.has(erstes.toLowerCase())) nach = [erstes.toLowerCase(), ...rest].join(' ')
    }
    return `${d.firstName} ${nach}`.trim()
  }

  einfuegen(
    'driver',
    [
      'id', 'first_name', 'last_name', 'full_name', 'display_name', 'abbreviation', 'permanent_number',
      'date_of_birth', 'date_of_death', 'place_of_birth', 'country_of_birth_id', 'nationality_id',
      'f1db_race_entries', 'f1db_race_starts', 'f1db_race_wins', 'f1db_podiums',
      'f1db_pole_positions', 'f1db_fastest_laps', 'f1db_championship_wins',
      'f1db_points', 'f1db_championship_points',
    ],
    await lies('f1db-drivers.csv', [
      'id', 'firstName', 'lastName', 'fullName', 'abbreviation', 'permanentNumber', 'dateOfBirth',
      'dateOfDeath', 'placeOfBirth', 'countryOfBirthCountryId', 'nationalityCountryId',
      'totalRaceEntries', 'totalRaceStarts', 'totalRaceWins', 'totalPodiums', 'totalPolePositions',
      'totalFastestLaps', 'totalChampionshipWins', 'totalPoints', 'totalChampionshipPoints',
    ]),
    (d) => [
      kennung(d.id, 'driver.id'), d.firstName, d.lastName, d.fullName, anzeigename(d),
      txt(d.abbreviation), txt(d.permanentNumber),
      txt(d.dateOfBirth), txt(d.dateOfDeath), txt(d.placeOfBirth), txt(d.countryOfBirthCountryId),
      txt(d.nationalityCountryId),
      zahl(d.totalRaceEntries), zahl(d.totalRaceStarts), zahl(d.totalRaceWins), zahl(d.totalPodiums),
      zahl(d.totalPolePositions), zahl(d.totalFastestLaps), zahl(d.totalChampionshipWins),
      zahl(d.totalPoints), zahl(d.totalChampionshipPoints),
    ],
  )

  /*
   * Motoren- und Reifenhersteller vor den Ergebnissen: Die Ergebniszeilen
   * verweisen darauf, und die Fremdschluesselpruefung am Ende laeuft ueber
   * alles.
   */
  einfuegen(
    'engine_manufacturer',
    [
      'id', 'name', 'country_id', 'f1db_race_entries', 'f1db_race_starts', 'f1db_race_wins',
      'f1db_podiums', 'f1db_pole_positions', 'f1db_fastest_laps', 'f1db_championship_wins',
    ],
    await lies('f1db-engine-manufacturers.csv', [
      'id', 'name', 'countryId', 'totalRaceEntries', 'totalRaceStarts', 'totalRaceWins',
      'totalPodiums', 'totalPolePositions', 'totalFastestLaps', 'totalChampionshipWins',
    ]),
    (m) => [
      kennung(m.id, 'engine_manufacturer.id'), m.name, txt(m.countryId),
      zahl(m.totalRaceEntries), zahl(m.totalRaceStarts), zahl(m.totalRaceWins),
      zahl(m.totalPodiums), zahl(m.totalPolePositions), zahl(m.totalFastestLaps),
      zahl(m.totalChampionshipWins),
    ],
  )

  einfuegen(
    'tyre_manufacturer',
    [
      'id', 'name', 'country_id', 'f1db_race_entries', 'f1db_race_starts', 'f1db_race_wins',
      'f1db_podiums', 'f1db_pole_positions', 'f1db_fastest_laps',
    ],
    await lies('f1db-tyre-manufacturers.csv', [
      'id', 'name', 'countryId', 'totalRaceEntries', 'totalRaceStarts', 'totalRaceWins',
      'totalPodiums', 'totalPolePositions', 'totalFastestLaps',
    ]),
    (m) => [
      kennung(m.id, 'tyre_manufacturer.id'), m.name, txt(m.countryId),
      zahl(m.totalRaceEntries), zahl(m.totalRaceStarts), zahl(m.totalRaceWins),
      zahl(m.totalPodiums), zahl(m.totalPolePositions), zahl(m.totalFastestLaps),
    ],
  )

  einfuegen(
    'constructor',
    [
      'id', 'name', 'full_name', 'nationality_id', 'f1db_race_entries', 'f1db_race_starts',
      'f1db_race_wins', 'f1db_one_twos', 'f1db_podiums', 'f1db_pole_positions',
      'f1db_fastest_laps', 'f1db_championship_wins',
    ],
    await lies('f1db-constructors.csv', [
      'id', 'name', 'fullName', 'countryId', 'totalRaceEntries', 'totalRaceStarts', 'totalRaceWins',
      'total1And2Finishes', 'totalPodiums', 'totalPolePositions', 'totalFastestLaps', 'totalChampionshipWins',
    ]),
    (c) => [
      kennung(c.id, 'constructor.id'), c.name, txt(c.fullName), txt(c.countryId), zahl(c.totalRaceEntries),
      zahl(c.totalRaceStarts), zahl(c.totalRaceWins), zahl(c.total1And2Finishes),
      zahl(c.totalPodiums), zahl(c.totalPolePositions), zahl(c.totalFastestLaps),
      zahl(c.totalChampionshipWins),
    ],
  )

  einfuegen(
    'constructor_chronology',
    ['parent_id', 'constructor_id', 'sort_order', 'year_from', 'year_to'],
    await lies('f1db-constructors-chronology.csv', ['parentConstructorId', 'constructorId', 'positionDisplayOrder', 'yearFrom', 'yearTo']),
    (c) => [c.parentConstructorId, c.constructorId, Number(c.positionDisplayOrder), Number(c.yearFrom), zahl(c.yearTo)],
  )

  einfuegen(
    'driver_family',
    ['driver_id', 'relative_id', 'type', 'sort_order'],
    await lies('f1db-drivers-family-relationships.csv', ['parentDriverId', 'driverId', 'type', 'positionDisplayOrder']),
    (f) => [f.parentDriverId, f.driverId, f.type, Number(f.positionDisplayOrder)],
  )

  einfuegen(
    'chassis',
    ['id', 'constructor_id', 'name', 'full_name'],
    await lies('f1db-chassis.csv', ['id', 'constructorId', 'name', 'fullName']),
    (c) => [kennung(c.id, 'chassis.id'), c.constructorId, c.name, txt(c.fullName)],
  )

  einfuegen(
    'engine',
    ['id', 'engine_manufacturer_id', 'name', 'full_name', 'capacity_l', 'configuration', 'aspiration'],
    await lies('f1db-engines.csv', ['id', 'engineManufacturerId', 'name', 'fullName', 'capacity', 'configuration', 'aspiration']),
    (m) => [kennung(m.id, 'engine.id'), m.engineManufacturerId, m.name, txt(m.fullName), zahl(m.capacity), txt(m.configuration), txt(m.aspiration)],
  )

  einfuegen(
    'entrant',
    ['id', 'name'],
    await lies('f1db-entrants.csv', ['id', 'name']),
    (e) => [kennung(e.id, 'entrant.id'), e.name],
  )

  einfuegen(
    'circuit',
    ['id', 'name', 'full_name', 'previous_names', 'type', 'direction', 'place_name', 'country_id', 'latitude', 'longitude', 'length_km', 'turns'],
    await lies('f1db-circuits.csv', ['id', 'name', 'fullName', 'previousNames', 'type', 'direction', 'placeName', 'countryId', 'latitude', 'longitude', 'length', 'turns']),
    (c) => [kennung(c.id, 'circuit.id'), c.name, txt(c.fullName), txt(c.previousNames), txt(c.type), txt(c.direction), txt(c.placeName), txt(c.countryId), zahl(c.latitude), zahl(c.longitude), zahl(c.length), zahl(c.turns)],
  )

  einfuegen(
    'circuit_layout',
    ['id', 'circuit_id', 'is_current', 'length_km', 'turns'],
    await lies('f1db-circuits-layouts.csv', ['id', 'circuitId', 'effective', 'length', 'turns']),
    (l) => [l.id, l.circuitId, ja(l.effective), zahl(l.length), zahl(l.turns)],
  )

  einfuegen(
    'grand_prix',
    ['id', 'name', 'full_name', 'short_name', 'abbreviation', 'country_id'],
    await lies('f1db-grands-prix.csv', ['id', 'name', 'fullName', 'shortName', 'abbreviation', 'countryId']),
    (g) => [kennung(g.id, 'grand_prix.id'), g.name, txt(g.fullName), txt(g.shortName), txt(g.abbreviation), txt(g.countryId)],
  )

  // -- Saisons und Rennen --------------------------------------------------

  const rennen = await lies('f1db-races.csv', [
    'id', 'year', 'round', 'date', 'time', 'grandPrixId', 'officialName', 'qualifyingFormat', 'circuitId',
    'circuitLayoutId', 'courseLength', 'turns', 'laps', 'distance', 'scheduledLaps',
    'driversChampionshipDecider', 'constructorsChampionshipDecider', 'freePractice1Date',
    'freePractice1Time', 'freePractice2Date', 'freePractice2Time', 'freePractice3Date',
    'freePractice3Time', 'qualifyingDate', 'qualifyingTime', 'sprintQualifyingDate',
    'sprintQualifyingTime', 'sprintRaceDate', 'sprintRaceTime',
  ])
  const jahre = await lies('f1db-seasons.csv', ['year'])
  const rennenJeJahr = new Map()
  for (const r of rennen) rennenJeJahr.set(Number(r.year), (rennenJeJahr.get(Number(r.year)) ?? 0) + 1)

  const ctorStandings = await lies('f1db-seasons-constructor-standings.csv', ['year', 'positionNumber', 'constructorId', 'points', 'championshipWon'])
  const jahreMitCtor = new Set(ctorStandings.map((s) => Number(s.year)))

  einfuegen(
    'season',
    ['year', 'race_count', 'has_constructors_championship'],
    jahre,
    (s) => [Number(s.year), rennenJeJahr.get(Number(s.year)) ?? 0, jahreMitCtor.has(Number(s.year)) ? 1 : 0],
  )

  // Sprint-Wochenenden erkennen: F1DB führt ein sprintRaceDate.
  einfuegen(
    'race',
    [
      'id', 'f1db_id', 'year', 'round', 'grand_prix_id', 'official_name', 'circuit_id',
      'circuit_layout_id', 'date', 'time', 'fp1_date', 'fp1_time', 'fp2_date', 'fp2_time',
      'fp3_date', 'fp3_time', 'qualifying_date', 'qualifying_time', 'sprint_qualifying_date',
      'sprint_qualifying_time', 'sprint_date', 'sprint_time',
      'course_length_km', 'turns', 'laps', 'distance_km',
      'scheduled_laps', 'qualifying_format', 'had_sprint',
      'drivers_title_decider', 'constructors_title_decider', 'formula_one',
    ],
    rennen,
    (r) => [
      slugRennen(r), Number(r.id), Number(r.year), Number(r.round), r.grandPrixId,
      txt(r.officialName), r.circuitId, txt(r.circuitLayoutId), r.date, txt(r.time),
      txt(r.freePractice1Date), txt(r.freePractice1Time), txt(r.freePractice2Date), txt(r.freePractice2Time),
      txt(r.freePractice3Date), txt(r.freePractice3Time), txt(r.qualifyingDate), txt(r.qualifyingTime),
      txt(r.sprintQualifyingDate), txt(r.sprintQualifyingTime), txt(r.sprintRaceDate), txt(r.sprintRaceTime),
      zahl(r.courseLength), zahl(r.turns), zahl(r.laps), zahl(r.distance),
      zahl(r.scheduledLaps), txt(r.qualifyingFormat), r.sprintRaceDate ? 1 : 0,
      ja(r.driversChampionshipDecider), ja(r.constructorsChampionshipDecider),
      // Siehe schema.sql: Indianapolis zaehlte zur WM, war aber kein
      // Formel-1-Rennen. Die Kennung ist stabil, das Feld selbst hat F1DB nicht.
      r.grandPrixId === 'indianapolis' ? 0 : 1,
    ],
  )

  // F1DB adressiert Rennen numerisch, die Plattform sprechend. Diese Karte
  // übersetzt zwischen beidem.
  const rennenId = new Map(rennen.map((r) => [r.id, slugRennen(r)]))

  // -- Ergebnisse ----------------------------------------------------------

  // Ein Fahrer kann in einem Rennen zwei Zeilen haben (geteiltes Auto).
  // Der entry_index nummeriert sie in der Reihenfolge der Anzeige durch.
  const zaehlerJeFahrer = new Map()
  const naechsterIndex = (raceId, driverId) => {
    const k = `${raceId}|${driverId}`
    const n = zaehlerJeFahrer.get(k) ?? 0
    zaehlerJeFahrer.set(k, n + 1)
    return n
  }

  const ergebnisse = await lies('f1db-races-race-results.csv', [
    'raceId', 'positionDisplayOrder', 'positionNumber', 'positionText', 'driverNumber', 'driverId',
    'constructorId', 'engineManufacturerId', 'tyreManufacturerId', 'sharedCar', 'laps', 'timeMillis',
    'timePenaltyMillis', 'gapMillis', 'gapLaps', 'reasonRetired', 'points', 'polePosition',
    'qualificationPositionNumber', 'gridPositionNumber', 'positionsGained', 'pitStops', 'fastestLap',
    'driverOfTheDay', 'grandSlam',
  ])
  einfuegen(
    'race_result',
    [
      'race_id', 'driver_id', 'constructor_id', 'engine_id', 'tyre_id', 'entry_index',
      'display_order', 'car_number', 'position', 'position_text', 'classified', 'started', 'shared_car', 'laps',
      'time_ms', 'time_penalty_ms', 'gap_ms', 'gap_laps', 'reason_retired', 'points', 'pole_position',
      'qualifying_position', 'grid_position', 'positions_gained', 'pit_stops',
      'fastest_lap', 'driver_of_the_day', 'grand_slam',
    ],
    ergebnisse,
    (r) => {
      const race = rennenId.get(r.raceId)
      if (!race) return null
      const pos = zahl(r.positionNumber)
      return [
        race, r.driverId, r.constructorId, txt(r.engineManufacturerId), txt(r.tyreManufacturerId),
        naechsterIndex(race, r.driverId), Number(r.positionDisplayOrder), txt(r.driverNumber),
        pos, r.positionText, pos === null ? 0 : 1,
        NICHT_GESTARTET.has(r.positionText) ? 0 : 1, ja(r.sharedCar), zahl(r.laps),
        zahl(r.timeMillis), zahl(r.timePenaltyMillis), zahl(r.gapMillis), zahl(r.gapLaps), txt(r.reasonRetired),
        zahl(r.points) ?? 0, ja(r.polePosition), platz(r.qualificationPositionNumber),
        platz(r.gridPositionNumber), zahl(r.positionsGained), zahl(r.pitStops),
        ja(r.fastestLap), ja(r.driverOfTheDay), ja(r.grandSlam),
      ]
    },
  )

  einfuegen(
    'qualifying_result',
    ['race_id', 'driver_id', 'constructor_id', 'position', 'position_text', 'time_ms', 'q1_ms', 'q2_ms', 'q3_ms', 'gap_ms'],
    await lies('f1db-races-qualifying-results.csv', ['raceId', 'driverId', 'constructorId', 'positionNumber', 'positionText', 'timeMillis', 'q1Millis', 'q2Millis', 'q3Millis', 'gapMillis']),
    (q) => {
      const race = rennenId.get(q.raceId)
      if (!race) return null
      return [race, q.driverId, q.constructorId, platz(q.positionNumber), txt(q.positionText), zahl(q.timeMillis), zahl(q.q1Millis), zahl(q.q2Millis), zahl(q.q3Millis), zahl(q.gapMillis)]
    },
  )

  einfuegen(
    'starting_grid',
    ['race_id', 'driver_id', 'constructor_id', 'position', 'position_text', 'qualifying_position', 'grid_penalty', 'grid_penalty_positions', 'time_ms'],
    await lies('f1db-races-starting-grid-positions.csv', ['raceId', 'driverId', 'constructorId', 'positionNumber', 'positionText', 'qualificationPositionNumber', 'gridPenalty', 'gridPenaltyPositions', 'timeMillis']),
    (g) => {
      const race = rennenId.get(g.raceId)
      if (!race) return null
      return [race, g.driverId, g.constructorId, platz(g.positionNumber), txt(g.positionText), platz(g.qualificationPositionNumber), txt(g.gridPenalty), zahl(g.gridPenaltyPositions), zahl(g.timeMillis)]
    },
  )

  einfuegen(
    'sprint_result',
    ['race_id', 'driver_id', 'constructor_id', 'position', 'position_text', 'classified', 'grid_position', 'points'],
    await lies('f1db-races-sprint-race-results.csv', ['raceId', 'driverId', 'constructorId', 'positionNumber', 'positionText', 'gridPositionNumber', 'points']),
    (s) => {
      const race = rennenId.get(s.raceId)
      if (!race) return null
      const pos = zahl(s.positionNumber)
      return [race, s.driverId, s.constructorId, pos, s.positionText, pos === null ? 0 : 1, platz(s.gridPositionNumber), zahl(s.points) ?? 0]
    },
  )

  einfuegen(
    'sprint_starting_grid',
    ['race_id', 'driver_id', 'constructor_id', 'position', 'position_text', 'grid_penalty'],
    await lies('f1db-races-sprint-starting-grid-positions.csv', ['raceId', 'driverId', 'constructorId', 'positionNumber', 'positionText', 'gridPenalty']),
    (g) => {
      const race = rennenId.get(g.raceId)
      if (!race) return null
      return [race, g.driverId, g.constructorId, platz(g.positionNumber), txt(g.positionText), txt(g.gridPenalty)]
    },
  )

  einfuegen(
    'fastest_lap',
    ['race_id', 'driver_id', 'constructor_id', 'position', 'lap', 'time_ms', 'gap_ms'],
    await lies('f1db-races-fastest-laps.csv', ['raceId', 'driverId', 'constructorId', 'positionNumber', 'lap', 'timeMillis', 'gapMillis']),
    (f) => {
      const race = rennenId.get(f.raceId)
      if (!race) return null
      return [race, f.driverId, f.constructorId, zahl(f.positionNumber), zahl(f.lap), zahl(f.timeMillis), zahl(f.gapMillis)]
    },
  )

  einfuegen(
    'driver_of_the_day',
    ['race_id', 'driver_id', 'position', 'percentage'],
    await lies('f1db-races-driver-of-the-day-results.csv', ['raceId', 'driverId', 'positionNumber', 'percentage']),
    (d) => {
      const race = rennenId.get(d.raceId)
      if (!race) return null
      return [race, d.driverId, zahl(d.positionNumber), zahl(d.percentage)]
    },
  )

  einfuegen(
    'pit_stop',
    ['race_id', 'driver_id', 'stop', 'lap', 'duration_ms'],
    await lies('f1db-races-pit-stops.csv', ['raceId', 'driverId', 'stop', 'lap', 'timeMillis']),
    (p) => {
      const race = rennenId.get(p.raceId)
      if (!race) return null
      return [race, p.driverId, Number(p.stop), Number(p.lap), zahl(p.timeMillis)]
    },
  )

  // -- Wertungen -----------------------------------------------------------

  einfuegen(
    'race_driver_standing',
    ['race_id', 'driver_id', 'position', 'position_text', 'points', 'positions_gained', 'championship_won'],
    await lies('f1db-races-driver-standings.csv', ['raceId', 'driverId', 'positionNumber', 'positionText', 'points', 'positionsGained', 'championshipWon']),
    (s) => {
      const race = rennenId.get(s.raceId)
      if (!race) return null
      return [race, s.driverId, platz(s.positionNumber), txt(s.positionText), zahl(s.points) ?? 0, zahl(s.positionsGained), ja(s.championshipWon)]
    },
  )

  einfuegen(
    'race_constructor_standing',
    ['race_id', 'constructor_id', 'position', 'points', 'championship_won'],
    await lies('f1db-races-constructor-standings.csv', ['raceId', 'constructorId', 'positionNumber', 'points', 'championshipWon']),
    (s) => {
      const race = rennenId.get(s.raceId)
      if (!race) return null
      return [race, s.constructorId, platz(s.positionNumber), zahl(s.points) ?? 0, ja(s.championshipWon)]
    },
  )

  einfuegen(
    'season_driver_standing',
    ['year', 'driver_id', 'position', 'position_text', 'points', 'championship_won'],
    await lies('f1db-seasons-driver-standings.csv', ['year', 'driverId', 'positionNumber', 'positionText', 'points', 'championshipWon']),
    (s) => [Number(s.year), s.driverId, platz(s.positionNumber), txt(s.positionText), zahl(s.points) ?? 0, ja(s.championshipWon)],
  )

  einfuegen(
    'season_constructor_standing',
    ['year', 'constructor_id', 'position', 'points', 'championship_won'],
    ctorStandings,
    (s) => [Number(s.year), s.constructorId, platz(s.positionNumber), zahl(s.points) ?? 0, ja(s.championshipWon)],
  )

  // -- Nennlisten ----------------------------------------------------------
  //
  // Wer mit welchem Chassis, Motor und Reifen antrat. Die vier Dateien teilen
  // sich denselben Schlüssel aus Jahr, Meldung, Konstrukteur und Motorenhersteller.

  const NENNUNG = ['year', 'entrantId', 'constructorId', 'engineManufacturerId']
  const nennung = (z) => [Number(z.year), z.entrantId, z.constructorId, z.engineManufacturerId]

  einfuegen(
    'season_entrant_driver',
    ['year', 'entrant_id', 'constructor_id', 'engine_manufacturer_id', 'driver_id', 'rounds_text', 'test_driver'],
    await lies('f1db-seasons-entrants-drivers.csv', [...NENNUNG, 'driverId', 'roundsText', 'testDriver']),
    (z) => [...nennung(z), z.driverId, txt(z.roundsText), ja(z.testDriver)],
  )
  einfuegen(
    'season_entrant_chassis',
    ['year', 'entrant_id', 'constructor_id', 'engine_manufacturer_id', 'chassis_id'],
    await lies('f1db-seasons-entrants-chassis.csv', [...NENNUNG, 'chassisId']),
    (z) => [...nennung(z), z.chassisId],
  )
  einfuegen(
    'season_entrant_engine',
    ['year', 'entrant_id', 'constructor_id', 'engine_manufacturer_id', 'engine_id'],
    await lies('f1db-seasons-entrants-engines.csv', [...NENNUNG, 'engineId']),
    (z) => [...nennung(z), z.engineId],
  )
  einfuegen(
    'season_entrant_tyre',
    ['year', 'entrant_id', 'constructor_id', 'engine_manufacturer_id', 'tyre_manufacturer_id'],
    await lies('f1db-seasons-entrants-tyre-manufacturers.csv', [...NENNUNG, 'tyreManufacturerId']),
    (z) => [...nennung(z), z.tyreManufacturerId],
  )

  return zaehler
}

/** Sprechende, zugleich als Adresse taugliche Kennung eines Rennens. */
function slugRennen(r) {
  // Zusammengesetzt, aber genauso eine Adresse wie jede andere - also genauso geprueft.
  return kennung(`${r.grandPrixId}-grand-prix-${r.year}`, 'race.id')
}

// ------------------------------------------------------------- Abgeleitetes

/**
 * Sprint-Wochenenden markieren.
 *
 * `sprintRaceDate` führt F1DB erst seit 2024 – die zwölf Sprints von 2021 bis
 * 2023 standen deshalb als gewöhnliche Wochenenden in der Datenbank, und der
 * Titelrechner zählte für Katar 2023 null Sprints. Ein Sprintergebnis ist der
 * sichere Beleg; das Datum bleibt für künftige Rennen, die noch keines haben.
 */
function markiereSprints(db) {
  db.exec('UPDATE race SET had_sprint = 1 WHERE id IN (SELECT DISTINCT race_id FROM sprint_result)')
  return db.prepare('SELECT COUNT(*) AS n FROM race WHERE had_sprint = 1').get().n
}

/**
 * Saisons mit Streichresultaten erkennen – aus den Daten, nicht aus einer
 * gepflegten Regeltabelle. Liegt der WM-Stand eines Fahrers unter der Summe
 * seiner Rennpunkte, wurde gestrichen. Falschmeldungen sind ausgeschlossen:
 * Sprintpunkte können den WM-Stand nur heben.
 */
function markiereStreichresultate(db) {
  const jahre = db
    .prepare(
      `SELECT r.year AS jahr
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN season_driver_standing sds
              ON sds.year = r.year AND sds.driver_id = rr.driver_id
        GROUP BY r.year, rr.driver_id, sds.points
       HAVING SUM(rr.points) > sds.points + 0.001`,
    )
    .all()
    .map((z) => z.jahr)

  const einmalig = [...new Set(jahre)]
  const stmt = db.prepare('UPDATE season SET dropped_scores = 1 WHERE year = ?')
  for (const j of einmalig) stmt.run(j)
  return einmalig.sort((a, b) => a - b)
}

/**
 * Deckung je Kennzahl auszählen: ab wann belegt und wie vollständig. Die
 * Oberfläche fragt das, bevor sie eine Null anzeigt.
 */
function zaehleDeckung(db) {
  const messungen = [
    ['race_result', 'Ergebnisse', 'SELECT MIN(r.year) a, MAX(r.year) b, COUNT(DISTINCT rr.race_id) n FROM race_result rr JOIN race r ON r.id=rr.race_id', 'F1DB'],
    ['pole_position', 'Pole-Position', "SELECT MIN(r.year) a, MAX(r.year) b, COUNT(DISTINCT rr.race_id) n FROM race_result rr JOIN race r ON r.id=rr.race_id WHERE rr.pole_position=1", 'F1DB'],
    ['fastest_lap', 'Schnellste Rennrunde', "SELECT MIN(r.year) a, MAX(r.year) b, COUNT(DISTINCT rr.race_id) n FROM race_result rr JOIN race r ON r.id=rr.race_id WHERE rr.fastest_lap=1", 'F1DB'],
    ['grid_position', 'Startplatz', 'SELECT MIN(r.year) a, MAX(r.year) b, COUNT(DISTINCT rr.race_id) n FROM race_result rr JOIN race r ON r.id=rr.race_id WHERE rr.grid_position IS NOT NULL', 'F1DB'],
    ['qualifying_time', 'Qualifying-Zeit', 'SELECT MIN(r.year) a, MAX(r.year) b, COUNT(DISTINCT q.race_id) n FROM qualifying_result q JOIN race r ON r.id=q.race_id WHERE q.time_ms IS NOT NULL', 'F1DB'],
    ['qualifying_segments', 'Q1/Q2/Q3 getrennt', 'SELECT MIN(r.year) a, MAX(r.year) b, COUNT(DISTINCT q.race_id) n FROM qualifying_result q JOIN race r ON r.id=q.race_id WHERE q.q3_ms IS NOT NULL', 'F1DB'],
    ['pit_stop', 'Boxenstopps', 'SELECT MIN(r.year) a, MAX(r.year) b, COUNT(DISTINCT p.race_id) n FROM pit_stop p JOIN race r ON r.id=p.race_id', 'F1DB'],
    ['driver_of_the_day', 'Fahrer des Tages', 'SELECT MIN(r.year) a, MAX(r.year) b, COUNT(DISTINCT rr.race_id) n FROM race_result rr JOIN race r ON r.id=rr.race_id WHERE rr.driver_of_the_day=1', 'F1DB'],
    ['lap_position', 'Positionsverlauf je Runde', 'SELECT MIN(r.year) a, MAX(r.year) b, COUNT(DISTINCT l.race_id) n FROM lap_position l JOIN race r ON r.id=l.race_id', 'Jolpica'],
  ]

  const setze = db.prepare(
    'INSERT OR REPLACE INTO coverage (metric, first_year, last_year, completeness, source, note) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const ergebnis = []
  for (const [metric, note, sql, quelle] of messungen) {
    const z = db.prepare(sql).get()
    if (!z || z.a === null) {
      setze.run(metric, null, null, 0, quelle, note + ' – nicht geladen')
      ergebnis.push({ metric, note, von: null, bis: null, anteil: 0 })
      continue
    }
    const gesamt = db.prepare('SELECT COUNT(*) n FROM race WHERE year BETWEEN ? AND ?').get(z.a, z.b).n
    const anteil = gesamt > 0 ? z.n / gesamt : 0
    setze.run(metric, z.a, z.b, anteil, quelle, note)
    ergebnis.push({ metric, note, von: z.a, bis: z.b, anteil })
  }
  return ergebnis
}

// ------------------------------------------------------------------ Proben

/**
 * Gegenproben. Die erste Gruppe prüft die eigene Zählung gegen die
 * Gesamtzahlen, die F1DB selbst mitliefert – zwei unabhängige Wege zum selben
 * Wert. Die zweite prüft Einzelfälle gegen die Rekordbücher.
 */
function pruefe(db) {
  const fehler = []
  const meldung = (ok, text) => {
    if (!ok) fehler.push(text)
    return ok
  }

  // Fremdschlüssel
  const fk = db.prepare('PRAGMA foreign_key_check').all()
  meldung(fk.length === 0, `${fk.length} verletzte Fremdschlüssel`)

  // Je Rennen genau ein Sieger – außer bei geteiltem Auto
  const mehrfachSieger = db
    .prepare(
      `SELECT race_id, COUNT(*) n, SUM(shared_car) geteilt
         FROM race_result WHERE position = 1 GROUP BY race_id HAVING n > 1`,
    )
    .all()
  const ohneErklaerung = mehrfachSieger.filter((r) => r.geteilt === 0)
  meldung(
    ohneErklaerung.length === 0,
    `${ohneErklaerung.length} Rennen mit mehreren Siegern ohne shared_car-Kennzeichnung`,
  )

  // Startplatz 0 darf nicht überlebt haben
  const nullPlatz = db.prepare('SELECT COUNT(*) n FROM race_result WHERE grid_position = 0').get().n
  meldung(nullPlatz === 0, `${nullPlatz} Ergebniszeilen mit Startplatz 0 statt NULL`)

  // Eigene Zählung gegen die Gesamtzahlen von F1DB
  const abgleich = db
    .prepare(
      `SELECT d.id, d.full_name,
              d.f1db_race_entries AS soll_nennungen,
              d.f1db_race_starts  AS soll_starts,
              d.f1db_race_wins    AS soll_siege,
              d.f1db_pole_positions AS soll_poles,
              d.f1db_fastest_laps AS soll_fl,
              (SELECT COUNT(DISTINCT race_id) FROM race_result WHERE driver_id = d.id) AS ist_nennungen,
              (SELECT COUNT(DISTINCT race_id) FROM race_result WHERE driver_id = d.id AND started = 1) AS ist_starts,
              (SELECT COUNT(DISTINCT race_id) FROM race_result WHERE driver_id = d.id AND position = 1) AS ist_siege,
              (SELECT COUNT(DISTINCT race_id) FROM race_result WHERE driver_id = d.id AND pole_position = 1) AS ist_poles,
              (SELECT COUNT(DISTINCT race_id) FROM race_result WHERE driver_id = d.id AND fastest_lap = 1) AS ist_fl
         FROM driver d
        WHERE d.f1db_race_starts > 0`,
    )
    .all()

  const abweichung = (feld) =>
    abgleich.filter((z) => z['soll_' + feld] !== null && z['soll_' + feld] !== z['ist_' + feld])

  for (const [feld, label] of [['nennungen', 'Nennungen'], ['starts', 'Starts'], ['siege', 'Siege'], ['poles', 'Pole-Positions'], ['fl', 'schnellste Runden']]) {
    const ab = abweichung(feld)
    meldung(
      ab.length === 0,
      `${label}: ${ab.length} von ${abgleich.length} Fahrern weichen von F1DB ab` +
        (ab.length ? ` (z. B. ${ab.slice(0, 3).map((z) => `${z.full_name} ${z['ist_' + feld]}≠${z['soll_' + feld]}`).join(', ')})` : ''),
    )
  }

  // Einzelfälle gegen die Rekordbücher
  const STICHPROBEN = [
    ['juan-manuel-fangio', { starts: 51, siege: 24, poles: 29 }],
    ['jim-clark', { starts: 72, siege: 25, poles: 33 }],
    ['ayrton-senna', { starts: 161, siege: 41, poles: 65 }],
  ]
  for (const [id, soll] of STICHPROBEN) {
    const z = abgleich.find((x) => x.id === id)
    if (!z) {
      meldung(false, `Stichprobe ${id} nicht gefunden`)
      continue
    }
    for (const [feld, wert] of Object.entries(soll)) {
      meldung(z['ist_' + feld] === wert, `${z.full_name}: ${feld} ${z['ist_' + feld]} statt ${wert}`)
    }
  }

  // Titelentscheidungen: F1DB markiert sie, unabhängig von der eigenen Rechnung
  const entschieden = db
    .prepare("SELECT year, round FROM race WHERE drivers_title_decider = 1 AND year IN (2020, 2021, 2023, 2024)")
    .all()
  const erwartet = { 2020: 14, 2021: 22, 2023: 17, 2024: 22 }
  for (const [jahr, runde] of Object.entries(erwartet)) {
    const treffer = entschieden.find((e) => e.year === Number(jahr))
    meldung(treffer?.round === runde, `Titelentscheidung ${jahr}: Runde ${treffer?.round ?? '—'} statt ${runde}`)
  }

  return fehler
}

// -------------------------------------------------------------------- Lauf

const t0 = Date.now()
await fs.mkdir(path.dirname(ZIEL), { recursive: true })
let herkunft = { version: 'lokal', pruefsumme: null }
if (!CSV) {
  try {
    const geholt = await holeRelease()
    CSV = geholt.verzeichnis
    herkunft = geholt
  } catch (e) {
    // Sauber abbrechen statt mit Stapelspur - es ist kein Programmfehler,
    // sondern ein Befund: Das Archiv ist nicht das erwartete.
    console.error(`\nBESCHAFFUNG FEHLGESCHLAGEN: ${e.message}`)
    process.exit(1)
  }
}

/*
 * Gebaut wird in eine Nebendatei, und erst wenn alles bestanden ist, tritt sie
 * an die Stelle der alten. Vorher wurde die bestehende Datenbank als Erstes
 * gelöscht – ein abgebrochener Import ließ dann gar keine zurück.
 */
const NEU = `${ZIEL}.neu`
const verwerfen = async () => {
  for (const d of [NEU, `${NEU}-wal`, `${NEU}-shm`]) await fs.rm(d, { force: true })
}
await verwerfen()
const db = new DatabaseSync(NEU)
db.exec('PRAGMA journal_mode = WAL')
db.exec(await fs.readFile(path.join(HIER, 'schema.sql'), 'utf8'))

db.exec('BEGIN')
let zaehler
try {
  zaehler = await importiere(db)
  const meta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
  meta.run('f1db_version', herkunft.version)
  meta.run('f1db_sha256', herkunft.pruefsumme)
  db.exec('COMMIT')
} catch (e) {
  /*
   * Dieselbe Haltung wie bei den Proben unten: lieber die alte Datenbank als
   * eine aus einem Archiv, in dem etwas steht, das da nicht stehen sollte.
   */
  try {
    db.exec('ROLLBACK')
  } catch {
    /* Transaktion war schon beendet. */
  }
  db.close()
  await verwerfen()
  console.error(`\nIMPORT ABGEBROCHEN: ${e.message}`)
  console.error('Neue Datenbank verworfen, die bisherige bleibt unberührt.')
  process.exit(1)
}

const streich = markiereStreichresultate(db)
const sprintWochenenden = markiereSprints(db)
const deckung = zaehleDeckung(db)
const fehler = pruefe(db)

console.log('\nImportiert:')
for (const [t, n] of Object.entries(zaehler)) console.log(`  ${t.padEnd(28)} ${String(n).padStart(7)}`)

console.log('\nSaisons mit Streichresultaten:', streich.length ? `${streich.length} (${streich[0]}–${streich.at(-1)})` : 'keine')
console.log('Sprint-Wochenenden:', sprintWochenenden)

console.log('\nDeckung:')
for (const d of deckung) {
  const spanne = d.von === null ? '—' : `${d.von}–${d.bis}`
  console.log(`  ${d.note.padEnd(26)} ${spanne.padEnd(10)} ${(d.anteil * 100).toFixed(0).padStart(3)}% der Rennen`)
}

if (fehler.length) {
  console.error('\nPRÜFUNG FEHLGESCHLAGEN:')
  for (const f of fehler) console.error('  ✗ ' + f)
  db.close()
  await verwerfen()
  console.error('\nNeue Datenbank verworfen – lieber die alte als eine mit falschen Zahlen.')
  process.exit(1)
}

/*
 * Vor dem Umbenennen zurück auf ein einzelnes Datenbankfile: Im WAL-Modus
 * lägen Teile der Daten noch in der -wal-Datei neben dem alten Namen.
 */
db.exec('PRAGMA journal_mode = DELETE')
db.close()
for (const d of [`${ZIEL}-wal`, `${ZIEL}-shm`]) await fs.rm(d, { force: true })
await fs.rename(NEU, ZIEL)

const { size } = await fs.stat(ZIEL)
console.log(
  `\nAlle Prüfungen bestanden. F1DB ${herkunft.version}, ${path.relative(WURZEL, ZIEL)}, ` +
    `${(size / 1024 / 1024).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s.`,
)
