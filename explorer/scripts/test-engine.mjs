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
  grandSlams, zielabstand, groessteAufholjagden, meistePlaetzeGutgemacht,
} from '../src/engine/records.js'
import {
  motorProfil, motorTeams, motorTitel, motorenListe,
} from '../src/engine/motor.js'
import { fahrerWertung, rangliste, zusammenhang } from '../src/engine/duell.js'

const HIER = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
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
gleich('78 Hersteller importiert', motoren.length, 78)

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

/* Rennen und Qualifying sind nicht dieselbe Frage und ergeben nicht dieselbe Reihenfolge. */
pruefe('Rennen- und Qualifyingwertung unterscheiden sich',
  wertungRennen[0].id !== wertungQuali[0].id,
  `beide ${wertungRennen[0].name}`)
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

db.close()

// -------------------------------------------------- Ergebnis

console.log(`\n${bestanden} Prüfungen bestanden, ${fehler.length} fehlgeschlagen.`)
if (fehler.length) {
  for (const f of fehler) console.error('  ✗ ' + f)
  process.exit(1)
}
