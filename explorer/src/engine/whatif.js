/**
 * Was-wäre-wenn: dieselben Rennen, ein anderes Punktesystem.
 *
 * Die Frage „wer wäre 1988 nach heutigen Regeln Weltmeister geworden" ist die
 * älteste Stammtischfrage der Formel 1, und sie ist beantwortbar: Die
 * Ergebnisse stehen fest, nur die Bewertung ändert sich.
 *
 * Die Systeme selbst stehen in `punkte.js`, geprüft gegen die Daten. Hier
 * geht es um vier Dinge, die eine solche Rechnung leicht falsch machen:
 *
 *   Streichresultate. Bis 1990 zählten nur die besten N Ergebnisse. Wer sie
 *   ignoriert, rechnet ein anderes Szenario als gedacht – deshalb sind sie
 *   eine eigene, ausweisbare Option und nicht stillschweigend an oder aus.
 *
 *   Geteilte Fahrzeuge. In den 1950ern teilten sich zwei Fahrer ein Auto und
 *   damit einen Platz. Volle Punkte an beide zu vergeben, verdoppelt Siege.
 *
 *   Der Bonus für die schnellste Runde. Bis 1959 bekam ihn auch, wer danach
 *   ausfiel. Wer nur gewertete Fahrer betrachtet, verliert diese Punkte.
 *
 *   Sprints. Seit 2021 gibt es Punkte außerhalb des Rennens. Ein Rennsystem
 *   auf sie anzuwenden wäre falsch, sie wegzulassen ebenso – sie werden
 *   deshalb unverändert übernommen und getrennt ausgewiesen.
 *
 * Was die Rechnung bewusst nicht nachbildet: Fahrer ohne Punkteberechtigung,
 * deren Plätze damals an den Nächsten weitergereicht wurden (Formel-2-Wagen
 * am Nürburgring 1967 und 1969). Sie bekommen hier keine Punkte, ihre Plätze
 * rücken aber nicht auf. Das betrifft eine Handvoll Zeilen in zwei Rennen.
 */
import { rennFaktoren, punkteFuer, streiche, streichregel, systemFuer, systemNachId } from './punkte.js'

/** Die Faktoren kosten eine Abfrage über alle Rennen; einmal je Datenbank reicht. */
const faktorenJeDb = new WeakMap()
const faktoren = (db) => {
  if (!faktorenJeDb.has(db)) faktorenJeDb.set(db, rennFaktoren(db))
  return faktorenJeDb.get(db)
}

/**
 * Wer bei Punktgleichheit vorn liegt: mehr Siege, dann mehr zweite Plätze und
 * so fort – die Regel der Weltmeisterschaft seit 1950.
 */
function vergleiche(a, b) {
  if (b.punkte !== a.punkte) return b.punkte - a.punkte
  const n = Math.max(a.plaetze.length, b.plaetze.length)
  for (let i = 1; i < n; i++) {
    const d = (b.plaetze[i] ?? 0) - (a.plaetze[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/**
 * Eine Saison nach einem anderen Punktesystem neu rechnen.
 *
 * @param {object} db
 * @param {number} jahr
 * @param {string} systemId Kennung aus PUNKTESYSTEME
 * @param {{ streichresultate?: boolean }} [optionen]
 *   streichresultate: die Streichregel der Saison auch auf das neue System
 *   anwenden. Wirkt nur in Saisons, die eine hatten.
 */
export function saisonNeuRechnen(db, jahr, systemId, optionen = {}) {
  const system = systemNachId(systemId)
  if (!system) throw new Error(`Unknown points system: ${systemId}`)
  const eigenes = systemFuer(jahr)
  const regel = optionen.streichresultate ? streichregel(jahr) : null

  const kalender = db.prepare('SELECT id FROM race WHERE year = ? ORDER BY round').all(jahr)
  const stelle = new Map(kalender.map((r, i) => [r.id, i]))

  const zeilen = db
    .prepare(
      `SELECT rr.race_id AS raceId, rr.driver_id AS driverId, d.display_name AS name,
              rr.position, rr.classified, rr.shared_car AS geteilt, rr.fastest_lap AS schnellste,
              rr.points AS echtePunkte
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE r.year = ?
        ORDER BY r.round`,
    )
    .all(jahr)

  const sprints = db
    .prepare(
      `SELECT sr.driver_id AS driverId, SUM(sr.points) AS punkte
         FROM sprint_result sr JOIN race r ON r.id = sr.race_id
        WHERE r.year = ? GROUP BY sr.driver_id`,
    )
    .all(jahr)
  const sprintPunkte = new Map(sprints.map((s) => [s.driverId, s.punkte]))

  /*
   * Wie viele Fahrer teilen sich einen Platz, wie viele die schnellste Runde?
   * Bei geteilten Fahrzeugen sind es zwei oder drei, bei der schnellsten Runde
   * in Silverstone 1954 sieben. Die Punkte werden geteilt, wie es die Epoche
   * auch tat – sonst hätte ein Rennen zwei Sieger mit je voller Punktzahl.
   */
  const jePlatz = new Map()
  const jeSchnellste = new Map()
  for (const z of zeilen) {
    if (z.classified && z.position !== null) {
      const k = `${z.raceId}|${z.position}`
      jePlatz.set(k, (jePlatz.get(k) ?? 0) + 1)
    }
    if (z.schnellste) jeSchnellste.set(z.raceId, (jeSchnellste.get(z.raceId) ?? 0) + 1)
  }

  const f = faktoren(db)
  const gleichesSystem = system.id === eigenes.id
  const proFahrer = new Map()

  for (const z of zeilen) {
    const e = proFahrer.get(z.driverId) ?? {
      driverId: z.driverId,
      name: z.name,
      jeRennen: new Array(kalender.length).fill(0),
      plaetze: [],
      siege: 0,
      geteilteFahrten: 0,
    }
    proFahrer.set(z.driverId, e)

    const teiler = z.classified && z.position !== null ? (jePlatz.get(`${z.raceId}|${z.position}`) ?? 1) : 1

    /*
     * Nach dem eigenen System gilt, was damals vergeben wurde – einschließlich
     * aller Einzelentscheidungen. Nach einem anderen bekommt keine Punkte, wer
     * damals auf einem Punkteplatz stand und trotzdem leer ausging: Er war
     * nicht punkteberechtigt, und das ändert kein Punktesystem.
     */
    let p
    if (gleichesSystem) p = z.echtePunkte
    else {
      const ohneBerechtigung =
        z.classified && z.position !== null && z.position <= eigenes.rennen.length &&
        z.echtePunkte === 0 && !z.geteilt
      p = ohneBerechtigung
        ? 0
        : punkteFuer(z, system, {
            faktor: f.get(z.raceId) ?? 1,
            teiler,
            schnellsteTeiler: jeSchnellste.get(z.raceId) ?? 1,
          })
    }

    if (teiler > 1) e.geteilteFahrten++
    e.jeRennen[stelle.get(z.raceId)] += p
    if (z.classified && z.position !== null) {
      e.plaetze[z.position] = (e.plaetze[z.position] ?? 0) + 1
      if (z.position === 1) e.siege++
    }
  }

  /*
   * Wer aus der Meisterschaft genommen wurde, bleibt es auch unter einem
   * anderen System: Schumachers Ausschluss 1997 war eine sportliche
   * Entscheidung, keine Frage der Punkteverteilung. Er steht nicht in der
   * Tabelle, aber die Seite kann ihn nennen.
   */
  const ausgeschlossen = db
    .prepare(
      `SELECT sds.driver_id AS driverId, d.display_name AS name
         FROM season_driver_standing sds JOIN driver d ON d.id = sds.driver_id
        WHERE sds.year = ? AND sds.position IS NULL AND sds.position_text = 'DSQ'`,
    )
    .all(jahr)
  const raus = new Set(ausgeschlossen.map((a) => a.driverId))

  // Sprintpunkte unverändert übernehmen: Ein Rennsystem gilt nicht für sie.
  let sprintSumme = 0
  const tabelle = [...proFahrer.values()]
    .filter((e) => !raus.has(e.driverId))
    .map((e) => {
      const roh = e.jeRennen.reduce((a, b) => a + b, 0)
      const gewertet = streiche(e.jeRennen, regel)
      const sprint = sprintPunkte.get(e.driverId) ?? 0
      sprintSumme += sprint
      return {
        driverId: e.driverId,
        name: e.name,
        punkte: gewertet + sprint,
        gestrichen: roh - gewertet,
        sprintPunkte: sprint,
        siege: e.siege,
        geteilteFahrten: e.geteilteFahrten,
        plaetze: e.plaetze,
      }
    })
    .filter((e) => e.punkte > 0)
    .sort(vergleiche)

  // Gleiche Punkte und gleiche Platzierungen heißen gleicher Rang.
  tabelle.forEach((e, i) => {
    e.platz = i > 0 && vergleiche(tabelle[i - 1], e) === 0 ? tabelle[i - 1].platz : i + 1
  })

  return {
    system,
    jahr,
    tabelle: tabelle.map(({ plaetze: _plaetze, ...rest }) => rest),
    sprintPunkte: sprintSumme,
    streichresultate: regel !== null,
    ausgeschlossen,
    /** Fahrer, deren Punkte wegen geteilter Fahrzeuge aufgeteilt wurden. */
    mitGeteiltenFahrten: tabelle.filter((e) => e.geteilteFahrten > 0).length,
  }
}

/**
 * Der amtliche Endstand zum Vergleich.
 *
 * Aus der Wertung, nicht aus den Rennpunkten: Nur sie kennt die
 * Streichresultate. Genau die Differenz macht die Was-wäre-wenn-Rechnung
 * interessant – 1988 fuhr Prost mehr Punkte ein als Senna und verlor trotzdem.
 */
export function amtlicherEndstand(db, jahr) {
  return db
    .prepare(
      `SELECT sds.position AS platz, sds.driver_id AS driverId, d.display_name AS name,
              sds.points AS punkte, sds.championship_won AS meister
         FROM season_driver_standing sds JOIN driver d ON d.id = sds.driver_id
        WHERE sds.year = ? ORDER BY sds.position`,
    )
    .all(jahr)
}

/** Welches Punktesystem galt in diesem Jahr tatsächlich? Die Kennung aus PUNKTESYSTEME. */
export const systemDesJahres = (jahr) => systemFuer(jahr).id
