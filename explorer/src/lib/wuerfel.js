import { alle, db } from './db.js'
import { maxRennpunkte, maxSprintpunkte, rennFaktoren } from '../engine/punkte.js'

/**
 * Der Datenwürfel für den Explorer.
 *
 * Eine Zeile je Ergebnis – 27.599 Rennergebnisse und 590 Sprints, die
 * komplette Formel-1-Geschichte. Damit lässt sich jede Frage beantworten, auch
 * solche, die eine Vorab-Verdichtung nicht mehr hergäbe: „Siege von außerhalb
 * der ersten zehn Startplätze" braucht den einzelnen Startplatz, nicht seine
 * Jahressumme.
 *
 * Zwei Kniffe halten das klein genug für den Browser:
 *
 *   Spaltenweise statt zeilenweise. 28.000 Objekte mit je fünfzehn
 *   Schlüsselnamen wären fast nur Schlüsselnamen. Als fünfzehn Arrays steht
 *   jeder Name genau einmal da.
 *
 *   Wörterbücher für alles, was sich wiederholt. Ein Fahrer heißt im Würfel
 *   nicht „max-verstappen", sondern 42 – und 42 steht einmal in der Liste.
 *
 * Sprints stehen als eigene Zeilen darin, mit `sprint = 1`. Die Kennzahlen des
 * Explorers zählen Rennen und Sprints getrennt: Ein Sprintsieg ist kein Sieg.
 */
export function wuerfel() {
  const rennen = alle(`
    SELECT r.id AS rennen, r.year AS jahr, r.formula_one AS f1,
           rr.driver_id AS fahrer, rr.constructor_id AS team, rr.engine_id AS motor,
           r.circuit_id AS strecke, r.grand_prix_id AS gp,
           rr.position AS platz, rr.started AS gestartet, rr.classified AS gewertet,
           rr.grid_position AS start, rr.qualifying_position AS quali,
           rr.points AS punkte, rr.fastest_lap AS schnellste
      FROM race_result rr
      JOIN race r ON r.id = rr.race_id
     ORDER BY r.year, r.round, rr.display_order`)

  // Der Motor eines Sprints ist der seines Rennens am selben Wochenende.
  const sprints = alle(`
    SELECT r.id AS rennen, r.year AS jahr, r.formula_one AS f1,
           sr.driver_id AS fahrer, sr.constructor_id AS team,
           (SELECT rr.engine_id FROM race_result rr
             WHERE rr.race_id = sr.race_id AND rr.driver_id = sr.driver_id LIMIT 1) AS motor,
           r.circuit_id AS strecke, r.grand_prix_id AS gp,
           sr.position AS platz, sr.position_text NOT IN ('DNS', 'DNQ', 'WD', 'DNP', 'EX') AS gestartet,
           sr.classified AS gewertet, sr.grid_position AS start, sr.points AS punkte
      FROM sprint_result sr
      JOIN race r ON r.id = sr.race_id
     ORDER BY r.year, r.round, sr.position`)

  /** Baut ein Wörterbuch und gibt eine Funktion zurück, die Werte auf Indizes abbildet. */
  const woerterbuch = () => {
    const zuIndex = new Map()
    const liste = []
    return {
      liste,
      index: (wert) => {
        if (wert === null || wert === undefined) return -1
        let i = zuIndex.get(wert)
        if (i === undefined) {
          i = liste.length
          liste.push(wert)
          zuIndex.set(wert, i)
        }
        return i
      },
    }
  }

  const fahrer = woerterbuch()
  const team = woerterbuch()
  const motor = woerterbuch()
  const strecke = woerterbuch()
  const gp = woerterbuch()

  const s = {
    jahr: [], fahrer: [], team: [], motor: [], strecke: [], gp: [],
    platz: [], gestartet: [], gewertet: [], start: [], quali: [],
    punkte: [], schnellste: [], f1: [], sprint: [], moeglich: [],
  }

  /*
   * Wie viele Punkte ein Start höchstens bringen konnte – die Grundlage für
   * „Anteil der möglichen Punkte“, den einzigen Punktevergleich über Epochen,
   * der nicht an der Größe der Zahlen hängt: 9 für einen Sieg 1955, 26 im
   * Jahr 2024. Abgebrochene Rennen zählen halb, Abu Dhabi 2014 doppelt.
   */
  const faktoren = rennFaktoren(db())

  const fuege = (z, istSprint) => {
    s.jahr.push(z.jahr)
    s.fahrer.push(fahrer.index(z.fahrer))
    s.team.push(team.index(z.team))
    s.motor.push(motor.index(z.motor))
    s.strecke.push(strecke.index(z.strecke))
    s.gp.push(gp.index(z.gp))
    // -1 statt null: Ein Array aus Zahlen packt besser als eines mit null darin,
    // und die Abfrage muss die Lücke ohnehin kennen.
    s.platz.push(z.platz ?? -1)
    s.gestartet.push(z.gestartet ? 1 : 0)
    s.gewertet.push(z.gewertet ? 1 : 0)
    s.start.push(z.start ?? -1)
    s.quali.push(istSprint ? -1 : (z.quali ?? -1))
    // Punkte können Brüche sein (geteilte Fahrzeuge, halbe Punkte bei Abbruch).
    // Hundertstel als ganze Zahl: 3,5 wird zu 350, 1/7 Punkt zu 14.
    s.punkte.push(Math.round((z.punkte ?? 0) * 100))
    s.schnellste.push(istSprint ? 0 : z.schnellste)
    s.f1.push(z.f1)
    s.sprint.push(istSprint ? 1 : 0)
    const max = istSprint ? maxSprintpunkte(z.jahr) : maxRennpunkte(z.jahr) * (faktoren.get(z.rennen) ?? 1)
    s.moeglich.push(z.gestartet ? Math.round(max * 100) : 0)
  }
  for (const z of rennen) fuege(z, false)
  for (const z of sprints) fuege(z, true)

  // Namen zu den Kennungen, damit der Explorer sie anzeigen kann.
  const karte = (sql) => new Map(alle(sql).map((z) => [z.id, z]))
  const fahrerDaten = karte(`
    SELECT d.id, d.display_name AS name, d.last_name AS nachname, d.nationality_id AS land
      FROM driver d`)
  const laenderDaten = karte('SELECT id, name, demonym FROM country')
  const teamDaten = karte('SELECT id, name FROM constructor')
  const motorDaten = karte('SELECT id, name FROM engine_manufacturer')
  const streckenDaten = karte('SELECT id, name, place_name AS ort FROM circuit')
  const gpDaten = karte('SELECT id, name, full_name AS voll, short_name AS kurz FROM grand_prix')

  // Nationalitäten als eigenes Wörterbuch: je Fahrer ein Index darauf.
  const land = woerterbuch()
  const fahrerLand = fahrer.liste.map((id) => land.index(fahrerDaten.get(id)?.land ?? null))

  const idx = (w) => (id) => w.liste.indexOf(id)
  const titel = {
    fahrer: alle('SELECT driver_id AS id, year AS jahr FROM season_driver_standing WHERE championship_won = 1')
      .map((t) => [idx(fahrer)(t.id), t.jahr])
      .filter(([i]) => i >= 0),
    team: alle('SELECT constructor_id AS id, year AS jahr FROM season_constructor_standing WHERE championship_won = 1')
      .map((t) => [idx(team)(t.id), t.jahr])
      .filter(([i]) => i >= 0),
  }

  return {
    zeilen: s.jahr.length,
    rennzeilen: rennen.length,
    letztesJahr: Math.max(...s.jahr),
    fahrer: fahrer.liste,
    fahrerNamen: fahrer.liste.map((id) => fahrerDaten.get(id)?.name ?? id),
    fahrerNachnamen: fahrer.liste.map((id) => fahrerDaten.get(id)?.nachname ?? ''),
    fahrerLand,
    land: land.liste,
    landNamen: land.liste.map((id) => laenderDaten.get(id)?.demonym ?? laenderDaten.get(id)?.name ?? id),
    landLaender: land.liste.map((id) => laenderDaten.get(id)?.name ?? id),
    team: team.liste,
    teamNamen: team.liste.map((id) => teamDaten.get(id)?.name ?? id),
    motor: motor.liste,
    motorNamen: motor.liste.map((id) => motorDaten.get(id)?.name ?? id),
    strecke: strecke.liste,
    streckenNamen: strecke.liste.map((id) => streckenDaten.get(id)?.name ?? id),
    streckenOrte: strecke.liste.map((id) => streckenDaten.get(id)?.ort ?? ''),
    gp: gp.liste,
    gpNamen: gp.liste.map((id) => gpDaten.get(id)?.voll ?? gpDaten.get(id)?.name ?? id),
    gpKurz: gp.liste.map((id) => gpDaten.get(id)?.kurz ?? ''),
    titel,
    spalten: s,
  }
}
