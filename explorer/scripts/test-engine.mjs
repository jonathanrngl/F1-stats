/**
 * Prüfung der Statistik-Engine.
 *
 *   node scripts/test-engine.mjs
 *
 * Drei Ebenen, von der breitesten zur genauesten:
 *
 *   1. Massenabgleich – die Engine zählt Starts, Siege, Poles und schnellste
 *      Runden für alle Fahrer neu und vergleicht mit den Gesamtzahlen, die
 *      F1DB selbst mitliefert. Zwei unabhängige Wege zum selben Wert.
 *   2. Einzelfälle gegen die Rekordbücher, inklusive bekannter Serien.
 *   3. Randfälle – leere Eingaben, Division durch null, Fahrer mit einem
 *      einzigen Rennen, geteilte Fahrten.
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  calculateAverageFinish, calculateAverageStart, calculateChampionships,
  calculateDNFRate, calculateEntries, calculateFastestLaps, calculatePodiums,
  calculatePoints, calculatePoles, calculatePoleToWinRate, calculatePositionsGained,
  calculatePolesF1DB, calculateStarts, calculateStartsFromPole, calculateStreaks, calculateTeamMateComparison,
  calculateTrackPerformance, calculateWinRate, calculateWins, driverRaces,
} from '../src/engine/driver.js'
import { longestStreak, mean, rate } from '../src/engine/metric.js'
import {
  datenstand, inReichweite, juengsteAenderungen, laufendeSerien, rekordVerlaeufe, saisonMarken,
} from '../src/engine/aenderungen.js'
import {
  meistePodien, meistePoles, meisteSchnellsteRunden, meisteSiege, meisteStarts, teamRekorde,
  grandSlams, zielabstand, groessteAufholjagden, meistePlaetzeGutgemacht, altersrekord,
} from '../src/engine/records.js'
import {
  motorProfil, motorTeams, motorTitel, motorenListe,
} from '../src/engine/motor.js'
import { fahrerWertung, rangliste, zusammenhang } from '../src/engine/duell.js'
import { BEREICHE, erzeugeFragen, quizFragen, quizUebersicht } from '../src/engine/quiz.js'
import {
  STREICHRESULTATE, maxRennpunkte, maxSprintpunkte, punkteFuer, rennFaktoren, streiche, streichregel,
  systemFuer, systemNachId,
} from '../src/engine/punkte.js'
import { amtlicherEndstand, saisonNeuRechnen, systemDesJahres } from '../src/engine/whatif.js'
import { naechstesRennen, standVorRennen, titelKannFallen } from '../src/engine/vorschau.js'

// fileURLToPath statt .pathname: Dort bliebe ein Leerzeichen im Pfad als %20 stehen.
const HIER = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(HIER, '..', 'data', 'f1.sqlite')

let bestanden = 0
const fehler = []

function pruefe(name, ok, detail = '') {
  if (ok) bestanden++
  else fehler.push(`${name}${detail ? ' – ' + detail : ''}`)
}
const gleich = (name, ist, soll) =>
  pruefe(name, ist === soll, `${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
const nahe = (name, ist, soll, toleranz = 0.005) =>
  pruefe(name, ist !== null && Math.abs(ist - soll) <= toleranz, `${ist} statt ~${soll}`)

const db = new DatabaseSync(DB, { readOnly: true })

// -------------------------------------------------- 1. Massenabgleich

console.log('1. Massenabgleich gegen die Gesamtzahlen von F1DB')

const fahrer = db
  .prepare(
    `SELECT id, full_name, f1db_race_entries, f1db_race_starts, f1db_race_wins,
            f1db_podiums, f1db_pole_positions, f1db_fastest_laps, f1db_championship_wins
       FROM driver WHERE f1db_race_entries > 0`,
  )
  .all()

const abweichungen = { entries: [], starts: [], wins: [], podiums: [], poles: [], fastestLaps: [], titles: [] }

for (const f of fahrer) {
  const rennen = driverRaces(db, f.id)
  const vergleich = [
    ['entries', calculateEntries(rennen).value, f.f1db_race_entries],
    ['starts', calculateStarts(rennen).value, f.f1db_race_starts],
    ['wins', calculateWins(rennen).value, f.f1db_race_wins],
    ['podiums', calculatePodiums(rennen).value, f.f1db_podiums],
    // F1DBs Gesamtzahl folgt seinem eigenen Flag; die sportliche Zählung
    // steht darunter als eigene Prüfung.
    ['poles', calculatePolesF1DB(rennen).value, f.f1db_pole_positions],
    ['fastestLaps', calculateFastestLaps(rennen).value, f.f1db_fastest_laps],
    ['titles', calculateChampionships(db, f.id).titles.value, f.f1db_championship_wins],
  ]
  for (const [feld, ist, soll] of vergleich) {
    if (soll !== null && ist !== soll) abweichungen[feld].push(`${f.full_name} ${ist}≠${soll}`)
  }
}

for (const [feld, liste] of Object.entries(abweichungen)) {
  pruefe(
    `alle ${fahrer.length} Fahrer: ${feld}`,
    liste.length === 0,
    liste.length ? `${liste.length} Abweichungen, z. B. ${liste.slice(0, 3).join(', ')}` : '',
  )
  if (liste.length === 0) console.log(`   ✓ ${feld.padEnd(12)} stimmt für alle ${fahrer.length} Fahrer`)
}

// -------------------------------------------------- 2. Einzelfälle

console.log('\n2. Einzelfälle gegen die Rekordbücher')

const fangio = driverRaces(db, 'juan-manuel-fangio')
gleich('Fangio Starts', calculateStarts(fangio).value, 51)
gleich('Fangio Siege', calculateWins(fangio).value, 24)
gleich('Fangio Poles', calculatePoles(fangio).value, 29)
gleich('Fangio Podien', calculatePodiums(fangio).value, 35)
gleich('Fangio Titel', calculateChampionships(db, 'juan-manuel-fangio').titles.value, 5)
nahe('Fangio Siegquote', calculateWinRate(fangio).value, 24 / 51)

const senna = driverRaces(db, 'ayrton-senna')
gleich('Senna Starts', calculateStarts(senna).value, 161)
gleich('Senna Nennungen', calculateEntries(senna).value, 162)
gleich('Senna Siege', calculateWins(senna).value, 41)
gleich('Senna Poles', calculatePoles(senna).value, 65)

// Poles und Startplatz 1 gehen in der Strafenära auseinander.
const ver = driverRaces(db, 'max-verstappen')
const polesVer = calculatePoles(ver).value
const vonPlatz1 = calculateStartsFromPole(ver).value
pruefe(
  'Verstappen: mehr Poles als Starts von Platz 1',
  polesVer > vonPlatz1,
  `${polesVer} Poles, ${vonPlatz1} von Platz 1`,
)
console.log(`   ✓ Verstappen ${polesVer} Poles, davon ${vonPlatz1}× wirklich von Platz 1 gestartet`)

// In der Frühzeit fallen beide Zählungen zusammen.
gleich('Fangio: Poles = Starts von Platz 1', calculatePoles(fangio).value, calculateStartsFromPole(fangio).value)
gleich('Senna: Poles = Starts von Platz 1', calculatePoles(senna).value, calculateStartsFromPole(senna).value)

// Bekannte Serien
const schumi = driverRaces(db, 'michael-schumacher')
const serien = calculateStreaks(schumi)
gleich('Schumacher längste Siegesserie', serien.wins.length, 7)
console.log(`   ✓ längste Siegesserie ${serien.wins.length} (${serien.wins.from?.year} ${serien.wins.from?.grandPrixId} – ${serien.wins.to?.year} ${serien.wins.to?.grandPrixId})`)

// Teamkollegen: Hamilton gegen Rosberg 2014
const duelle = calculateTeamMateComparison(db, 'lewis-hamilton', { fromYear: 2014, toYear: 2014 })
const rosberg = duelle.find((d) => d.driverId === 'nico-rosberg')
pruefe('Hamilton vs. Rosberg 2014 gefunden', !!rosberg)
if (rosberg) {
  console.log(`   ✓ Hamilton–Rosberg 2014: Rennen ${rosberg.raceWins}:${rosberg.raceDuels - rosberg.raceWins}, Quali ${rosberg.qualiWins}:${rosberg.qualiDuels - rosberg.qualiWins}, Punkte ${rosberg.pointsSelf}:${rosberg.pointsOther}`)
  pruefe('Hamilton hatte 2014 mehr Punkte als Rosberg', rosberg.pointsSelf > rosberg.pointsOther)
  pruefe('Qualifying-Duelle 2014 plausibel', rosberg.qualiDuels >= 15 && rosberg.qualiDuels <= 19, `${rosberg.qualiDuels}`)
}

// Strecken: Senna in Monaco
const strecken = calculateTrackPerformance(db, 'ayrton-senna')
const monaco = strecken.find((s) => s.circuitId === 'monaco')
gleich('Senna Siege in Monaco', monaco?.wins.value, 6)

// -------------------------------------------------- 3. Randfälle

console.log('\n3. Randfälle')

gleich('leere Liste: Mittelwert ist null', mean([]).value, null)
pruefe('leere Liste: mit Hinweis', typeof mean([]).caveat === 'string')
gleich('Quote ohne Nenner ist null', rate(0, 0).value, null)
gleich('Quote 3 von 4', rate(3, 4).value, 0.75)
gleich('Serie in leerer Liste', longestStreak([], () => true).length, 0)
gleich('Serie ohne Treffer', longestStreak([1, 2, 3], () => false).length, 0)
gleich('Serie reißt zwischendrin', longestStreak([1, 1, 0, 1, 1, 1], (x) => x === 1).length, 3)

// Fahrer ohne jeden Start
const nurGenannt = db
  .prepare(
    `SELECT d.id, d.full_name FROM driver d
      WHERE d.f1db_race_entries > 0 AND d.f1db_race_starts = 0 LIMIT 1`,
  )
  .get()
if (nurGenannt) {
  const r = driverRaces(db, nurGenannt.id)
  gleich(`${nurGenannt.full_name}: Starts null`, calculateStarts(r).value, 0)
  gleich(`${nurGenannt.full_name}: Siegquote nicht ermittelbar`, calculateWinRate(r).value, null)
  pruefe(`${nurGenannt.full_name}: Hinweis statt Null`, typeof calculateWinRate(r).caveat === 'string')
  console.log(`   ✓ ${nurGenannt.full_name}: ${calculateEntries(r).value} Nennungen, 0 Starts, Siegquote „${calculateWinRate(r).caveat}"`)
}

// Fahrer mit genau einem Start: Mittelwerte müssen als dünn gekennzeichnet sein
const einRennen = db
  .prepare('SELECT id, full_name FROM driver WHERE f1db_race_starts = 1 LIMIT 1')
  .get()
if (einRennen) {
  const r = driverRaces(db, einRennen.id)
  const schnitt = calculateAverageFinish(r)
  pruefe(
    `${einRennen.full_name}: dünne Stichprobe gekennzeichnet`,
    schnitt.value === null || typeof schnitt.caveat === 'string',
    JSON.stringify(schnitt),
  )
}

// Geteilte Fahrten: je Rennen eine Zeile, nie zwei
const doppelt = db
  .prepare(
    `SELECT driver_id, race_id, COUNT(*) n FROM race_result
      GROUP BY driver_id, race_id HAVING n > 1 LIMIT 1`,
  )
  .get()
if (doppelt) {
  const r = driverRaces(db, doppelt.driver_id)
  const treffer = r.filter((x) => x.raceId === doppelt.race_id)
  gleich('geteilte Fahrt ergibt genau eine Zeile', treffer.length, 1)
  const name = db.prepare('SELECT full_name FROM driver WHERE id = ?').get(doppelt.driver_id).full_name
  console.log(`   ✓ ${name} in ${doppelt.race_id}: ${doppelt.n} Rohzeilen → 1 Rennen`)
}

// Poles ohne Start: Pole-zu-Sieg darf nicht durch null teilen
const ohnePole = driverRaces(db, 'juan-manuel-fangio', { fromYear: 1958, toYear: 1958 })
const p2w = calculatePoleToWinRate(ohnePole)
pruefe('Pole-zu-Sieg ohne Poles: null statt Division durch null', p2w.value === null || p2w.value >= 0)

// Startplätze aus Jahren ohne Überlieferung
const frueh = driverRaces(db, 'juan-manuel-fangio', { fromYear: 1950, toYear: 1950 })
const schnittStart = calculateAverageStart(frueh)
pruefe('früher Ø Startplatz ist Zahl oder begründetes null',
  schnittStart.value === null || schnittStart.value > 0, JSON.stringify(schnittStart))

// Plätze gutgemacht summiert sich über alle Fahrer nahe null
const summeGewinne = db
  .prepare('SELECT SUM(positions_gained) s FROM race_result WHERE positions_gained IS NOT NULL')
  .get().s
console.log(`   ✓ Summe aller Positionsgewinne laut Rohdaten: ${summeGewinne}`)
const fangioGewinn = calculatePositionsGained(fangio)
pruefe('Positionsgewinn liefert Zahl', typeof fangioGewinn.value === 'number', JSON.stringify(fangioGewinn))

// Punkte: Rennpunkte dürfen nie unter dem WM-Stand liegen
const punkteFangio = calculatePoints(fangio).value
const wmFangio = calculateChampionships(db, 'juan-manuel-fangio').seasons.reduce((s, z) => s + z.points, 0)
pruefe(
  'Rennpunkte ≥ WM-Punkte (Streichresultate)',
  punkteFangio >= wmFangio - 0.001,
  `${punkteFangio} vs ${wmFangio}`,
)
console.log(`   ✓ Fangio: ${punkteFangio} Rennpunkte, ${wmFangio} davon gewertet (Streichresultate)`)

// DNF-Quote zwischen 0 und 1
const dnf = calculateDNFRate(senna)
pruefe('Ausfallquote im gültigen Bereich', dnf.value > 0 && dnf.value < 1, `${dnf.value}`)

// -------------------------------------------------- 4. Verlauf der Bestmarken

console.log('\n4. Verlauf der Bestmarken')

const verlaeufe = rekordVerlaeufe(db)

/*
 * Derselbe Wert auf zwei Wegen: Die Rekordseite fragt die Datenbank mit einem
 * GROUP BY, der Verlauf zählt 1172 Rennen einzeln durch. Weichen sie ab, ist
 * eine der beiden Zählweisen falsch – und dann widersprächen sich zwei Seiten
 * derselben Anwendung, ohne dass es jemandem auffiele.
 */
const AUS_REKORDEN = {
  siege: () => meisteSiege(db, 1)[0].wert,
  poles: () => meistePoles(db, 1)[0].wert,
  podien: () => meistePodien(db, 1)[0].wert,
  schnellste: () => meisteSchnellsteRunden(db, 1)[0].wert,
  starts: () => meisteStarts(db, 1)[0].wert,
  teamSiege: () => teamRekorde(db, 'siege', 1)[0].wert,
  teamPoles: () => teamRekorde(db, 'poles', 1)[0].wert,
}

for (const v of verlaeufe) {
  const soll = AUS_REKORDEN[v.kategorie.id]()
  gleich(`Verlauf trifft Rekordliste: ${v.kategorie.id}`, v.rekord, soll)
  pruefe(`${v.kategorie.id}: Marke hat mindestens einen Halter`, v.halter.length > 0)

  /* Eine Bestmarke kann nur steigen, und jedes Ereignis muss dort ansetzen,
   * wo das vorige aufhörte – sonst fehlte ein Schritt in der Kette. */
  let vorigerWert = 0
  let lueckenlos = true
  for (const e of v.ereignisse) {
    if (e.wert < vorigerWert || e.vorher.wert !== vorigerWert) lueckenlos = false
    vorigerWert = e.wert
  }
  pruefe(`${v.kategorie.id}: Kette lückenlos und monoton`, lueckenlos)
  gleich(`${v.kategorie.id}: Kette endet auf dem Rekord`, vorigerWert, v.rekord)
}
console.log(`   ✓ ${verlaeufe.length} Bestmarken nachgerechnet, Ketten geschlossen`)

/*
 * Zwei datierte Ereignisse gegen die Rekordbücher. Beide sind in Starts
 * gezählt; Hamiltons Siege sind davon unberührt, Alonsos Starts nicht – dort
 * nennen die Bücher den Termin der 350. Nennung, nicht des 350. Starts.
 */
const siegeVerlauf = verlaeufe.find((v) => v.kategorie.id === 'siege')
const hamilton91 = siegeVerlauf.ereignisse.find((e) => e.wert === 91 && e.art === 'eingestellt')
const hamilton92 = siegeVerlauf.ereignisse.find((e) => e.wert === 92)

pruefe('Hamilton stellt Schumachers 91 Siege ein', !!hamilton91)
gleich('… am 11. Oktober 2020 (Eifel)', hamilton91?.datum, '2020-10-11')
gleich('… und bricht die Marke am 25. Oktober 2020 (Portugal)', hamilton92?.datum, '2020-10-25')
gleich('… und zwar als geteilte Marke, nicht als Ausbau', hamilton92?.art, 'alleinVorn')
console.log('   ✓ Hamilton 91 eingestellt (Eifel 2020), 92 gebrochen (Portugal 2020)')

/* Jeder Bruch einer geteilten Marke folgt auf einen Wert, den zuvor mehrere
 * hielten – sonst wäre „alleinVorn" die falsche Einordnung gewesen. */
let brueche = 0
let brueche_sauber = true
for (const v of verlaeufe) {
  v.ereignisse.forEach((e, i) => {
    if (e.art !== 'alleinVorn') return
    brueche++
    const davor = v.ereignisse[i - 1]
    if (!davor || davor.wert !== e.wert - 1 || e.vorher.halter.length < 2) brueche_sauber = false
  })
}
pruefe(`alle ${brueche} Rekordbrüche folgen auf eine geteilte Marke`, brueche_sauber)
pruefe('es gibt überhaupt Rekordbrüche', brueche > 0, `${brueche}`)

// -------------------------------------------------- 5. Aussichten

console.log('\n5. Aussichten – Saison, ewige Marken, Serien')

const standJetzt = datenstand(db)
pruefe('Datenstand vorhanden', !!standJetzt)

const markenJetzt = saisonMarken(db, standJetzt)
pruefe(
  'keine Saisonmarke, die rechnerisch nicht mehr erreichbar ist',
  markenJetzt.every((m) => m.fehltZumEinstellen <= standJetzt.offen),
  markenJetzt.map((m) => `${m.art.id}: ${m.fehltZumEinstellen}/${standJetzt.offen}`).join(', '),
)
pruefe(
  'brechbar heißt: Bedarf passt in die offenen Rennen',
  markenJetzt.every((m) => m.brechenMoeglich === m.fehltZumBrechen <= standJetzt.offen),
)

const aussichtenJetzt = inReichweite(db, verlaeufe, standJetzt)
pruefe('Aussichten vorhanden', aussichtenJetzt.length > 0)
pruefe(
  'niemand verfolgt eine Marke, die er selbst hält',
  aussichtenJetzt.every((a) => a.eigene < a.rekord && a.fehlt >= 1),
)
pruefe(
  'Hochrechnung ist eine positive ganze Zahl oder begründet keine',
  aussichtenJetzt.every(
    (a) =>
      (a.hochrechnung.value === null && typeof a.hochrechnung.caveat === 'string') ||
      (Number.isInteger(a.hochrechnung.value) && a.hochrechnung.value > 0),
  ),
)
pruefe(
  'ein noch aktiver Rekordhalter ist als solcher markiert',
  aussichtenJetzt.every((a) => typeof a.halterAktiv === 'boolean'),
)
console.log(`   ✓ ${markenJetzt.length} Saisonmarken, ${aussichtenJetzt.length} Aussichten`)

const serienJetzt = laufendeSerien(db, standJetzt)
pruefe(
  'keine laufende Serie ist länger als die Bestmarke ihrer Art',
  serienJetzt.every((s) => s.laenge <= s.rekord),
  serienJetzt.map((s) => `${s.name} ${s.laenge}/${s.rekord}`).join(', '),
)
pruefe(
  'Abstand zur Serienbestmarke passt zur Länge',
  serienJetzt.every((s) => s.fehlt === Math.max(0, s.rekord - s.laenge + 1)),
)

/* Die gebündelten Ausbauten dürfen keinen Schritt verschlucken: Der Zuwachs
 * eines Laufs ist genau die Zahl seiner Schritte. */
const { ausbauten: alleAusbauten } = juengsteAenderungen(verlaeufe, { seit: '1950-01-01' })
pruefe(
  'gebündelte Ausbauten verlieren keinen Schritt',
  alleAusbauten.every((a) => a.bis - a.von === a.schritte),
  alleAusbauten.find((a) => a.bis - a.von !== a.schritte)?.kategorie?.id ?? '',
)

/* Ein Bruch trägt sein Gleichziehen bei sich, und dieses darf nicht zusätzlich
 * als eigener Eintrag auftauchen – sonst stünde dieselbe Geschichte zweimal. */
const { einzeln: alleEinzeln } = juengsteAenderungen(verlaeufe, { seit: '2000-01-01' })
const angehaengt = alleEinzeln.filter((e) => e.zuvorEingestellt)
pruefe('mindestens ein Bruch trägt sein Gleichziehen', angehaengt.length > 0)
pruefe(
  'das angehängte Gleichziehen liegt eine Marke tiefer und davor',
  angehaengt.every(
    (e) => e.zuvorEingestellt.wert === e.wert - 1 && e.zuvorEingestellt.datum <= e.datum,
  ),
)
pruefe(
  'kein angehängtes Gleichziehen steht zusätzlich für sich',
  angehaengt.every(
    (e) => !alleEinzeln.some((x) => x.art === 'eingestellt' && x.rennen === e.zuvorEingestellt.rennen && x.kategorie.id === e.kategorie.id),
  ),
)
console.log(`   ✓ ${serienJetzt.length} laufende Serien, ${alleAusbauten.length} Ausbauläufe`)

// -------------------------------------------------- 6. Motorenhersteller

console.log('\n6. Motorenhersteller')

const motoren = motorenListe(db)
/*
 * Keine feste Zahl: Hier stand „78 Hersteller importiert“, und der nächste
 * neue Hersteller hätte jeden Deploy angehalten, obwohl die Daten stimmen.
 * Geprüft wird, was stimmen muss – jeder Hersteller, der je ein Rennen
 * bestritt, steht in der Liste, und keiner sonst.
 */
gleich(
  'jeder Hersteller mit Rennen steht in der Liste',
  motoren.length,
  db.prepare('SELECT COUNT(DISTINCT engine_id) AS n FROM race_result WHERE engine_id IS NOT NULL').get().n,
)

/*
 * Derselbe Massenabgleich wie bei Fahrern und Teams: F1DB liefert die
 * Gesamtzahlen mit, und sie entstehen auf einem anderen Weg als unsere. Weicht
 * einer ab, ist eine Annahme ueber die Daten falsch - etwa die, dass ein Motor
 * je Rennen einmal zaehlt und nicht je Auto.
 */
const motorAbweichungen = []
for (const m of motoren) {
  const p = motorProfil(db, m.id)
  if (p.siege !== p.f1dbSiege) motorAbweichungen.push(`${p.name}: ${p.siege} statt ${p.f1dbSiege}`)
}
pruefe(
  'Siege stimmen fuer alle Motorenhersteller mit F1DB ueberein',
  motorAbweichungen.length === 0,
  motorAbweichungen.slice(0, 3).join(', '),
)
console.log(`   ✓ ${motoren.length} Hersteller, Siege gegen F1DB abgeglichen`)

/* Ein Motor gewinnt nicht oefter, als er Rennen bestritten hat. */
pruefe(
  'kein Hersteller hat mehr Siege als Rennen',
  motoren.every((m) => m.siege <= m.rennen && m.podien <= m.rennen),
)

/*
 * Der Grund, warum es diese Seiten gibt: Ferrari kommt als Motor auf einen
 * Sieg mehr als als Rennstall, weil ein Kundenteam gewann. Faellt diese
 * Pruefung, ist die Trennung von Motor und Team verlorengegangen.
 */
const ferrariMotor = motorProfil(db, 'ferrari')
const ferrariTeam = teamRekorde(db, 'siege', 20).find((t) => t.id === 'ferrari')
pruefe(
  'Ferrari hat als Motor mehr Siege als als Team',
  ferrariMotor.siege > ferrariTeam.wert,
  `${ferrariMotor.siege} vs ${ferrariTeam.wert}`,
)
console.log(`   ✓ Ferrari: ${ferrariMotor.siege} Siege als Motor, ${ferrariTeam.wert} als Team`)

/* Der Ford-Cosworth belieferte ein halbes Feld - das ist die Geschichte. */
const fordTeams = motorTeams(db, 'ford', 200)
pruefe('Ford belieferte mehr als fuenfzig Teams', fordTeams.length > 50, `${fordTeams.length}`)
pruefe('Ford-Titel ueber mehrere Konstrukteure', new Set(motorTitel(db, 'ford').map((t) => t.team)).size >= 5)
console.log(`   ✓ Ford: ${fordTeams.length} Teams, ${motorTitel(db, 'ford').length} Fahrertitel`)

// -------------------------------------------------- 7. Neue Rekordlisten

console.log('\n7. Zielabstaende und Grand Slams')

const knappste = zielabstand(db, 'knapp', 5)
const weiteste = zielabstand(db, 'weit', 5)

pruefe('knappster Zielabstand ist Monza 1971', knappste[0]?.rennen === 'Italy 1971', knappste[0]?.rennen)
nahe('… und betraegt 0,010 s', knappste[0]?.wert, 0.01, 0.0005)
pruefe('knappste aufsteigend sortiert', knappste.every((x, i, a) => i === 0 || a[i - 1].wert <= x.wert))
pruefe('weiteste absteigend sortiert', weiteste.every((x, i, a) => i === 0 || a[i - 1].wert >= x.wert))
pruefe('kein Zielabstand ueber eine Runde in der Liste', weiteste.every((x) => x.wert < 3600))
console.log(`   ✓ knappster ${knappste[0]?.wert.toFixed(3)} s (${knappste[0]?.rennen}), weitester ${weiteste[0]?.wert.toFixed(1)} s`)

const slamListe = grandSlams(db, 5)
pruefe('Jim Clark fuehrt die Grand Slams an', slamListe[0]?.name === 'Jim Clark', slamListe[0]?.name)
gleich('… mit acht', slamListe[0]?.wert, 8)
console.log(`   ✓ Grand Slams: ${slamListe.map((s) => `${s.name} ${s.wert}`).join(', ')}`)

// -------------------------------------------------- 8. Teamkollegen-Wertung

console.log('\n8. Teamkollegen-Wertung')

const netz = zusammenhang(db, 'rennen')
pruefe('die Kette haengt weitgehend zusammen', netz.groessteGruppe / netz.fahrer > 0.9,
  `${netz.groessteGruppe} von ${netz.fahrer}`)

const wertungRennen = rangliste(db, { art: 'rennen', minDuelle: 30, anzahl: 40 })
const wertungQuali = rangliste(db, { art: 'qualifying', minDuelle: 30, anzahl: 40 })

pruefe('Rangliste absteigend sortiert',
  wertungRennen.every((x, i, a) => i === 0 || a[i - 1].wertung >= x.wertung))
pruefe('Mindestzahl an Duellen eingehalten', wertungRennen.every((x) => x.duelle >= 30))
pruefe('Siege nie mehr als Duelle', wertungRennen.every((x) => x.siege <= x.duelle))

/*
 * Indianapolis muss draussen bleiben. Mike Nazaruk bestritt ausschliesslich
 * Indy-Rennen und stand ohne diesen Schnitt auf Platz zehn der ewigen Wertung
 * - weil Kurtis Kraft 1955 dreiundzwanzig der fuenfunddreissig Autos stellte
 * und deren Fahrer als Teamkollegen galten. Faellt diese Pruefung, ist der
 * Schnitt verlorengegangen.
 */
gleich('Indy-Fahrer ohne Wertung (Nazaruk)', fahrerWertung(db, 'mike-nazaruk'), null)

/*
 * Der Kern der Sache: Die Wertung soll ungefaehr die Fahrer nach vorn bringen,
 * die als gross gelten. Das ist keine mathematische Notwendigkeit, sondern die
 * Probe darauf, ob das Verfahren ueberhaupt etwas misst.
 */
const obenRennen = new Set(wertungRennen.slice(0, 12).map((x) => x.id))
for (const id of ['juan-manuel-fangio', 'jim-clark', 'ayrton-senna', 'max-verstappen']) {
  pruefe(`${id} unter den ersten zwoelf der Rennwertung`, obenRennen.has(id))
}
console.log(`   ✓ Rennwertung: ${wertungRennen.slice(0, 5).map((x) => x.name).join(', ')}`)

/*
 * Rennen und Qualifying sind nicht dieselbe Frage und ergeben nicht dieselbe
 * Reihenfolge. Verglichen werden die ersten zehn, nicht nur der Erste: Dass
 * beide Wertungen denselben Spitzenreiter haben, wäre kein Fehler.
 */
pruefe('Rennen- und Qualifyingwertung unterscheiden sich',
  wertungRennen.slice(0, 10).map((x) => x.id).join() !== wertungQuali.slice(0, 10).map((x) => x.id).join(),
  'dieselben zehn in derselben Reihenfolge')
console.log(`   ✓ Qualifying:  ${wertungQuali.slice(0, 5).map((x) => x.name).join(', ')}`)

// -------------------------------------------------- 9. Nur Formel 1

console.log('\n9. Was Formel 1 ist und was nicht')

/*
 * Das Indianapolis 500 zaehlte von 1950 bis 1960 zur Fahrerweltmeisterschaft,
 * war aber eine andere Rennserie: anderes Reglement, andere Autos, anderes
 * Feld. Von 107 Fahrern dort sassen vier je in einem Formel-1-Wagen.
 *
 * Die Punkte zaehlten, also bleibt das Rennen in jeder Wertung. Bestenlisten,
 * die Fahren in der Formel 1 vergleichen, darf es nicht fuellen - bei 33
 * Startern fuellte es acht der zehn Plaetze bei den gutgemachten Positionen.
 */
gleich(
  'elf Rennen sind als nicht-Formel-1 markiert',
  db.prepare('SELECT COUNT(*) AS n FROM race WHERE formula_one = 0').get().n,
  11,
)

const nurIndy = db
  .prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT rr.driver_id FROM race_result rr JOIN race r ON r.id = rr.race_id
        GROUP BY rr.driver_id
       HAVING MAX(r.formula_one) = 0)`,
  )
  .get().n
gleich('103 Fahrer bestritten nie ein Formel-1-Rennen', nurIndy, 103)

/* Die beiden Listen, die das Startfeld verzerrte, sind jetzt reine F1-Listen. */
const indyRennen = new Set(
  db
    .prepare("SELECT id FROM race WHERE formula_one = 0")
    .all()
    .map((r) => r.id),
)
for (const [name, liste] of [
  ['Aufholjagden', groessteAufholjagden(db, 10)],
  ['gutgemachte Plaetze', meistePlaetzeGutgemacht(db, 10)],
]) {
  pruefe(
    `${name}: kein Indianapolis in der Liste`,
    liste.every((e) => !indyRennen.has(e.raceId)),
    liste.filter((e) => indyRennen.has(e.raceId)).map((e) => e.rennen).join(', '),
  )
}

const vonHinten = groessteAufholjagden(db, 3)
pruefe('Sieg von P22 fuehrt die Aufholjagden an', vonHinten[0]?.wert === 22, `P${vonHinten[0]?.wert}`)
console.log(`   ✓ ${vonHinten[0]?.name} von P${vonHinten[0]?.wert} (${vonHinten[0]?.rennen})`)
console.log(`   ✓ ${nurIndy} Fahrer markiert, die nie ein Formel-1-Rennen bestritten`)

// -------------------------------------------------- 10. Streckenkarte

console.log('\n10. Streckenkarte')

const orte = db
  .prepare(
    `SELECT z.id, z.name, z.latitude AS la, z.longitude AS lo
       FROM circuit z
      WHERE EXISTS (SELECT 1 FROM race r WHERE r.circuit_id = z.id)`,
  )
  .all()

pruefe(
  'jede gefahrene Strecke hat Koordinaten',
  orte.every((o) => o.la !== null && o.lo !== null),
  orte.filter((o) => o.la === null).map((o) => o.name).join(', '),
)
pruefe(
  'Koordinaten im gueltigen Bereich',
  orte.every((o) => o.la >= -90 && o.la <= 90 && o.lo >= -180 && o.lo <= 180),
)

/*
 * Der Ausschnitt der Karte reicht von 62 Grad Nord bis 46 Grad Sued. Faende
 * ein kuenftiges Rennen ausserhalb statt - Las Vegas liegt schon bei 36 Grad,
 * ein Rennen in Skandinavien waere denkbar -, fiele sein Punkt heraus, ohne
 * dass es jemandem auffiele.
 */
const ausserhalb = orte.filter((o) => o.la > 62 || o.la < -46 || o.lo < -128 || o.lo > 152)
pruefe(
  'alle Strecken liegen im Kartenausschnitt',
  ausserhalb.length === 0,
  ausserhalb.map((o) => `${o.name} (${o.la.toFixed(1)}/${o.lo.toFixed(1)})`).join(', '),
)

const noerdlichste = orte.reduce((a, b) => (b.la > a.la ? b : a))
const suedlichste = orte.reduce((a, b) => (b.la < a.la ? b : a))
console.log(
  `   ✓ ${orte.length} Strecken verortet, ${noerdlichste.name} (${noerdlichste.la.toFixed(1)}°N) ` +
    `bis ${suedlichste.name} (${Math.abs(suedlichste.la).toFixed(1)}°S)`,
)

// -------------------------------------------------- 11. Quiz

console.log('\n11. Quiz')

/*
 * Die Fragen entstehen aus den Daten; geprüft wird deshalb weniger der
 * einzelne Text als die Form, die jede Frage haben muss – und an einigen
 * Stellen, ob die Antwort mit dem übereinstimmt, was die übrige Engine sagt.
 */
const quizAlle = erzeugeFragen(db)
const quiz = quizFragen(db)
const quizNach = new Map(quizAlle.map((f) => [f.i, f]))

pruefe('Quiz hat Fragen', quiz.length > 500, `${quiz.length}`)
pruefe(
  'jede Frage hat vier verschiedene, nicht leere Antworten',
  quiz.every((f) => f.o.length === 4 && new Set(f.o).size === 4 && f.o.every((o) => o.trim() !== '')),
  quiz.filter((f) => new Set(f.o).size !== 4).map((f) => f.i).join(', '),
)
pruefe('Kennungen eindeutig', new Set(quizAlle.map((f) => f.i)).size === quizAlle.length)
pruefe(
  'Bereich und Stufe gültig',
  quiz.every((f) => BEREICHE.some((b) => b.id === f.b) && [1, 2, 3].includes(f.s)),
)
pruefe(
  'jeder Fragetext endet mit einem Fragezeichen',
  quiz.every((f) => f.f.endsWith('?')),
  quiz.filter((f) => !f.f.endsWith('?')).map((f) => f.i).join(', '),
)
pruefe(
  'keine Frage nennt ihre Antwort im Text',
  quiz.every((f) => f.n || !f.f.includes(f.o[0])),
  quiz.filter((f) => !f.n && f.f.includes(f.o[0])).map((f) => f.i).join(', '),
)
pruefe(
  'Zahlenfragen haben nur Zahlen zur Wahl',
  quiz.filter((f) => f.n).every((f) => f.o.every((o) => /^P?[\d,.]+$/.test(o))),
)

// Keine Jahreszahl in der Zukunft, keine vor der ersten Saison.
const jahrFragen = quiz.filter((f) => /^(erstersieg|debuet|streckenjahr)-/.test(f.i))
const letztesJahr = db.prepare('SELECT MAX(year) AS j FROM race').get().j
pruefe(
  'Jahreszahlen liegen zwischen 1950 und heute',
  jahrFragen.length > 0 && jahrFragen.every((f) => f.o.every((o) => +o >= 1950 && +o <= letztesJahr)),
)

/*
 * Das Indianapolis 500 zählte zur Meisterschaft, war aber kein Formel-1-
 * Rennen. Als Antwort zwischen Grands Prix fiele es sofort auf – zweimal ist
 * es beim Bauen dieses Quiz dort gelandet.
 */
pruefe(
  'das Indianapolis 500 steht nirgends zur Wahl',
  quiz.every((f) => f.o.every((o) => !o.includes('Indianapolis 500'))),
)

const uebersicht = quizUebersicht(quiz)
const zuWenig = uebersicht.flatMap((b) => [1, 2, 3].filter((s) => b.n[s] < 10).map((s) => `${b.id}/${s}: ${b.n[s]}`))
pruefe('jeder Bereich hat je Stufe mindestens zehn Fragen', zuWenig.length === 0, zuWenig.join(', '))

pruefe('zwei Läufe ergeben dieselben Fragen', JSON.stringify(erzeugeFragen(db)) === JSON.stringify(quizAlle))

// Einzelne Antworten gegen die übrige Engine und die Geschichtsbücher.
gleich('Weltmeister 2008', quizNach.get('wm-2008')?.o[0], 'Lewis Hamilton')
gleich('Weltmeister 2021', quizNach.get('wm-2021')?.o[0], 'Max Verstappen')
gleich('Konstrukteurs-Weltmeister 2009', quizNach.get('teamwm-2009')?.o[0], 'Brawn')
gleich('Jaguar wurde 2005 Red Bull', quizNach.get('vorgaenger-jaguar-red-bull-2005')?.o[0], 'Jaguar')
gleich('Schumachers Titelzahl', quizNach.get('titelzahl-michael-schumacher')?.o[0], '7')
gleich('Sieger des ersten WM-Rennens', quizNach.get('erstesrennen-great-britain-grand-prix-1950')?.o[0], 'Nino Farina')
gleich('Siegrekord wie in der Rekordliste', quizNach.get('rekord-siege')?.o[0], meisteSiege(db, 1)[0].name)
gleich('jüngster Sieger wie in der Rekordliste', quizNach.get('alter-jungsieg')?.o[0], altersrekord(db, 'sieg', 'jung', 1)[0].name)

// Die Fangfrage: 2008 gewann Massa mehr Rennen, Hamilton den Titel – und steht zur Wahl.
const massa = quizNach.get('meistesiege-2008')
gleich('meiste Siege 2008', massa?.o[0], 'Felipe Massa')
pruefe('der Meister steht bei der Fangfrage zur Wahl', massa?.o.includes('Lewis Hamilton'))

console.log(`   ✓ ${quiz.length} Fragen im Vorrat, ${quizAlle.length} vor der Begrenzung`)

// -------------------------------------------------- 12. Punktesysteme

console.log('\n12. Punktesysteme')

/*
 * Die Tabelle in punkte.js ist nur dann Daten und nicht Behauptung, wenn sie
 * die Geschichte nachrechnet. Zwei Richtungen: jede Ergebniszeile einzeln,
 * und der amtliche WM-Stand über die Streichresultate.
 */
const faktorKarte = rennFaktoren(db)
gleich('Belgien 2021 halb gewertet', faktorKarte.get('belgium-grand-prix-2021'), 0.5)
gleich('Abu Dhabi 2014 doppelt gewertet', faktorKarte.get('abu-dhabi-grand-prix-2014'), 2)
pruefe('Faktoren sind halb oder doppelt, nichts sonst',
  [...faktorKarte.values()].every((f) => f === 0.5 || f === 2))

const alleZeilen = db
  .prepare(
    `SELECT rr.race_id AS raceId, r.year AS jahr, rr.position, rr.classified, rr.fastest_lap AS schnellste,
            rr.points AS echt
       FROM race_result rr JOIN race r ON r.id = rr.race_id`,
  )
  .all()
const jePlatzAlle = new Map()
const jeSchnellsteAlle = new Map()
for (const z of alleZeilen) {
  if (z.classified && z.position !== null) {
    const k = `${z.raceId}|${z.position}`
    jePlatzAlle.set(k, (jePlatzAlle.get(k) ?? 0) + 1)
  }
  if (z.schnellste) jeSchnellsteAlle.set(z.raceId, (jeSchnellsteAlle.get(z.raceId) ?? 0) + 1)
}
const zeilenAbweichung = alleZeilen.filter((z) => {
  const p = punkteFuer(z, systemFuer(z.jahr), {
    faktor: faktorKarte.get(z.raceId) ?? 1,
    teiler: z.classified && z.position !== null ? jePlatzAlle.get(`${z.raceId}|${z.position}`) : 1,
    schnellsteTeiler: jeSchnellsteAlle.get(z.raceId) ?? 1,
  })
  return Math.abs(p - z.echt) > 0.01
})
/*
 * Die Ausnahmen gehören der Frühzeit: nicht punkteberechtigte Formel-2-Wagen,
 * aberkannte Punkte, auf Hundertstel gerundete geteilte Bonuspunkte. Seit
 * 1991 muss jede Zeile aufgehen.
 */
pruefe('seit 1991 rechnet jede Ergebniszeile auf den Punkt nach',
  zeilenAbweichung.every((z) => z.jahr < 1991),
  zeilenAbweichung.filter((z) => z.jahr >= 1991).slice(0, 3).map((z) => z.raceId).join(', '))
pruefe('vor 1991 weniger als ein halbes Prozent Einzelfälle',
  zeilenAbweichung.length < alleZeilen.length * 0.005, `${zeilenAbweichung.length} von ${alleZeilen.length}`)
console.log(`   ✓ ${alleZeilen.length - zeilenAbweichung.length} von ${alleZeilen.length} Zeilen exakt, ${zeilenAbweichung.length} historische Einzelfälle`)

// Streichresultate: der amtliche Stand jedes Fahrers, 1950 bis 1990.
const streichAbweichung = []
for (const jahr of Object.keys(STREICHRESULTATE).map(Number)) {
  const kal = db.prepare('SELECT id FROM race WHERE year = ? ORDER BY round').all(jahr)
  const stelle = new Map(kal.map((r, i) => [r.id, i]))
  const jeFahrer = new Map()
  for (const z of db
    .prepare(
      `SELECT rr.race_id AS raceId, rr.driver_id AS id, SUM(rr.points) AS p FROM race_result rr
         JOIN race r ON r.id = rr.race_id WHERE r.year = ? GROUP BY rr.race_id, rr.driver_id`,
    )
    .all(jahr)) {
    if (!jeFahrer.has(z.id)) jeFahrer.set(z.id, new Array(kal.length).fill(0))
    jeFahrer.get(z.id)[stelle.get(z.raceId)] += z.p
  }
  for (const s of db.prepare('SELECT driver_id AS id, points FROM season_driver_standing WHERE year = ?').all(jahr)) {
    const ist = streiche(jeFahrer.get(s.id) ?? [], streichregel(jahr))
    if (Math.abs(ist - s.points) > 0.01) streichAbweichung.push(`${jahr} ${s.id} ${ist}≠${s.points}`)
  }
}
pruefe('Streichresultate ergeben den amtlichen Stand jedes Fahrers 1950–1990',
  streichAbweichung.length === 0, streichAbweichung.slice(0, 3).join(', '))
pruefe('jede Saison, in der gestrichen wurde, hat eine Regel',
  db.prepare('SELECT year FROM season WHERE dropped_scores = 1').all().every((s) => streichregel(s.year) !== null))

gleich('Höchstwert 2024: Sieg und schnellste Runde', maxRennpunkte(2024), 26)
gleich('Höchstwert 2025: nur der Sieg', maxRennpunkte(2025), 25)
gleich('Höchstwert 1955: Sieg und schnellste Runde', maxRennpunkte(1955), 9)
gleich('Sprintsieg 2021', maxSprintpunkte(2021), 3)
gleich('Sprintsieg 2026', maxSprintpunkte(2026), 8)
gleich('Bonus 1950er auch für einen Ausfall',
  punkteFuer({ classified: 0, position: null, schnellste: 1 }, systemNachId('1950')), 1)
gleich('Bonus 2019–2024 nur unter den ersten zehn',
  punkteFuer({ classified: 1, position: 11, schnellste: 1 }, systemNachId('2019')), 0)
console.log('   ✓ Streichresultate 1950–1990 exakt, Höchstwerte je Epoche')

// -------------------------------------------------- 13. Was-wäre-wenn

console.log('\n13. Was-wäre-wenn')

/*
 * Mit dem eigenen System und den eigenen Streichresultaten muss die Rechnung
 * den amtlichen Endstand treffen – sonst wäre jede andere Variante auf Sand
 * gebaut.
 */
const wmAbweichung = []
for (const { year: jahr } of db.prepare('SELECT year FROM season WHERE year < (SELECT MAX(year) FROM season)').all()) {
  const eigen = saisonNeuRechnen(db, jahr, systemDesJahres(jahr), { streichresultate: true })
  // Wer aus der Wertung genommen wurde (Schumacher 1997), steht dort ohne Platz.
  const amtlich = amtlicherEndstand(db, jahr).filter((f) => f.punkte > 0 && f.platz !== null)
  const ist = new Map(eigen.tabelle.map((e) => [e.driverId, e.punkte]))
  for (const f of amtlich) {
    if (Math.abs((ist.get(f.driverId) ?? 0) - f.punkte) > 0.01) wmAbweichung.push(`${jahr} ${f.name}`)
  }
  const meisterAmtlich = amtlich.find((f) => f.meister)
  if (meisterAmtlich && eigen.tabelle[0]?.driverId !== meisterAmtlich.driverId) wmAbweichung.push(`${jahr} Meister`)
}
gleich('1997: Schumacher bleibt aus der Wertung ausgeschlossen',
  saisonNeuRechnen(db, 1997, '2025').ausgeschlossen.map((a) => a.driverId).join(), 'michael-schumacher')
pruefe('eigenes System mit Streichresultaten trifft jeden amtlichen Endstand',
  wmAbweichung.length === 0, wmAbweichung.slice(0, 5).join(', '))

const prost88 = saisonNeuRechnen(db, 1988, systemDesJahres(1988))
pruefe('1988 ohne Streichresultate: Prost vor Senna',
  prost88.tabelle[0]?.driverId === 'alain-prost', prost88.tabelle[0]?.name)
const jetzt88 = saisonNeuRechnen(db, 1988, '2025')
pruefe('1988 nach heutigem System: keine Punkte verloren gegangen',
  jetzt88.tabelle.every((e) => e.gestrichen === 0))
const mitStreich88 = saisonNeuRechnen(db, 1988, '2025', { streichresultate: true })
pruefe('Streichresultate lassen sich auf ein neues System anwenden',
  mitStreich88.streichresultate && mitStreich88.tabelle.some((e) => e.gestrichen > 0))
pruefe('Gleichstand teilt den Rang',
  saisonNeuRechnen(db, 1950, '2025').tabelle.every((e, i, a) => i === 0 || e.platz >= a[i - 1].platz))
console.log(`   ✓ ${db.prepare('SELECT COUNT(*) n FROM season').get().n - 1} Endstände nachgerechnet`)

// -------------------------------------------------- 14. Vorschau und Titelrechner

console.log('\n14. Vorschau und Titelrechner')

const naechstesJetzt = naechstesRennen(db)
if (naechstesJetzt) {
  const frueher = db
    .prepare(
      `SELECT COUNT(*) AS n FROM race r
        WHERE (r.date < ? OR (r.date = ? AND r.round < ?))
          AND NOT EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)`,
    )
    .get(naechstesJetzt.datum, naechstesJetzt.datum, naechstesJetzt.runde).n
  gleich('vor dem nächsten Rennen fehlt kein Ergebnis', frueher, 0)
  gleich('das nächste Rennen liegt in der jüngsten Saison',
    naechstesJetzt.jahr, db.prepare('SELECT MAX(year) AS j FROM race').get().j)
  const standJetzt2 = standVorRennen(db, naechstesJetzt)
  if (!standJetzt2.vorsaison) gleich('Bezug ist die Runde davor', standJetzt2.bezug.runde, naechstesJetzt.runde - 1)
}

/** Ein vergangenes Rennen in der Form, die naechstesRennen liefert. */
const alsRennen = (jahr, runde) => {
  const r = db.prepare('SELECT id, year, round, had_sprint FROM race WHERE year = ? AND round = ?').get(jahr, runde)
  return { id: r.id, jahr: r.year, runde: r.round, mitSprint: r.had_sprint }
}
const kannFallen = (jahr, runde) => titelKannFallen(standVorRennen(db, alsRennen(jahr, runde)))

// Die Fälle aus dem README, an der Geschichte nachgeprüft.
pruefe('2024 Las Vegas: Titel konnte fallen', kannFallen(2024, 22))
pruefe('2024 Brasilien: noch nicht', !kannFallen(2024, 21))
pruefe('2023 Katar (Sprint): Titel konnte fallen', kannFallen(2023, 17))
pruefe('2023 Japan: noch nicht', !kannFallen(2023, 16))

/*
 * Und breit: In jeder Saison seit 1991 – ohne Streichresultate – muss die
 * Rechnung an dem Rennen, an dem der Titel tatsächlich fiel, „kann fallen“
 * sagen. Sonst wäre sie zu streng.
 */
const entscheidungen = db
  .prepare('SELECT year, round FROM race WHERE drivers_title_decider = 1 AND year >= 1991 ORDER BY year')
  .all()
const verfehlt = entscheidungen.filter((e) => !kannFallen(e.year, e.round))
pruefe(`an allen ${entscheidungen.length} Titelentscheidungen seit 1991 „kann fallen“`,
  verfehlt.length === 0, verfehlt.map((e) => `${e.year} R${e.round}`).join(', '))

// Pole-zu-Sieg zählt dieselben Poles wie die Pole-Zählung.
gleich('Pole-zu-Sieg beruht auf den sportlichen Poles',
  calculatePoleToWinRate(ver).sampleSize, calculatePoles(ver).value)
console.log(`   ✓ ${entscheidungen.length} Titelentscheidungen nachgeprüft`)

db.close()

// -------------------------------------------------- Ergebnis

console.log(`\n${bestanden} Prüfungen bestanden, ${fehler.length} fehlgeschlagen.`)
if (fehler.length) {
  for (const f of fehler) console.error('  ✗ ' + f)
  process.exit(1)
}
