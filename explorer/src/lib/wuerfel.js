import { alle } from './db.js'

/**
 * Der Datenwürfel für den Explorer.
 *
 * Eine Zeile je Ergebnis, 27.599 insgesamt – die komplette Formel-1-Geschichte.
 * Damit lässt sich jede Frage beantworten, auch solche, die eine Vorab-
 * Verdichtung nicht mehr hergäbe: „Siege von außerhalb der ersten zehn
 * Startplätze" braucht den einzelnen Startplatz, nicht seine Jahressumme.
 *
 * Zwei Kniffe halten das klein genug für den Browser:
 *
 *   Spaltenweise statt zeilenweise. 27.599 Objekte mit je dreizehn
 *   Schlüsselnamen wären fast nur Schlüsselnamen. Als dreizehn Arrays steht
 *   jeder Name genau einmal da.
 *
 *   Wörterbücher für alles, was sich wiederholt. Ein Fahrer heißt im Würfel
 *   nicht „max-verstappen", sondern 42 – und 42 steht einmal in der Liste.
 *
 * Das Ergebnis liegt bei rund 1,5 MB, gepackt deutlich unter einem halben.
 * Der Explorer lädt es einmal und filtert danach ohne jede weitere Anfrage.
 */
export function wuerfel() {
  const zeilen = alle(`
    SELECT r.year AS jahr, r.round AS runde,
           rr.driver_id AS fahrer, rr.constructor_id AS team,
           r.circuit_id AS strecke, r.grand_prix_id AS gp,
           rr.position AS platz, rr.started AS gestartet, rr.classified AS gewertet,
           rr.grid_position AS start, rr.qualifying_position AS quali,
           rr.points AS punkte, rr.pole_position AS poleFlag,
           rr.fastest_lap AS schnellste, rr.laps AS runden
      FROM race_result rr
      JOIN race r ON r.id = rr.race_id
     ORDER BY r.year, r.round`)

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
  const strecke = woerterbuch()
  const gp = woerterbuch()

  const s = {
    jahr: [], runde: [], fahrer: [], team: [], strecke: [], gp: [],
    platz: [], gestartet: [], gewertet: [], start: [], quali: [],
    punkte: [], pole: [], schnellste: [],
  }

  for (const z of zeilen) {
    s.jahr.push(z.jahr)
    s.runde.push(z.runde)
    s.fahrer.push(fahrer.index(z.fahrer))
    s.team.push(team.index(z.team))
    s.strecke.push(strecke.index(z.strecke))
    s.gp.push(gp.index(z.gp))
    // -1 statt null: Ein Array aus Zahlen packt besser als eines mit null darin,
    // und die Abfrage muss die Lücke ohnehin kennen.
    s.platz.push(z.platz ?? -1)
    s.gestartet.push(z.gestartet)
    s.gewertet.push(z.gewertet)
    s.start.push(z.start ?? -1)
    s.quali.push(z.quali ?? -1)
    // Punkte können Brüche sein (geteilte Fahrzeuge, halbe Punkte bei Abbruch).
    // Zehntel als ganze Zahl: 3,5 wird zu 35 und bleibt exakt.
    s.punkte.push(Math.round((z.punkte ?? 0) * 10))
    s.pole.push(z.poleFlag)
    s.schnellste.push(z.schnellste)
  }

  // Namen zu den Kennungen, damit der Explorer sie anzeigen kann.
  const namen = (tabelle, ids) => {
    const karte = new Map(
      alle(`SELECT id, ${tabelle === 'driver' ? 'display_name' : 'name'} AS name FROM ${tabelle}`).map(
        (z) => [z.id, z.name],
      ),
    )
    return ids.map((id) => karte.get(id) ?? id)
  }

  return {
    zeilen: zeilen.length,
    fahrer: fahrer.liste,
    fahrerNamen: namen('driver', fahrer.liste),
    team: team.liste,
    teamNamen: namen('constructor', team.liste),
    strecke: strecke.liste,
    streckenNamen: namen('circuit', strecke.liste),
    gp: gp.liste,
    gpNamen: namen('grand_prix', gp.liste),
    spalten: s,
  }
}
