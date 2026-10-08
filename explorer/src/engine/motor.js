/**
 * Motoren- und Reifenhersteller.
 *
 * Die dritte Größe neben Fahrer und Team, und die am leichtesten übersehene.
 * Ein Ford-Cosworth DFV gewann in zehn verschiedenen Chassis; Ferrari kommt als
 * Motorlieferant auf einen Sieg mehr als als Rennstall, weil ein Kundenteam
 * gewann. Wer nur Fahrer und Teams zählt, sieht diese Geschichte nie.
 *
 * Für Reifen gilt dasselbe, nur mit anderer Spalte: Goodyear gewann in 368
 * Rennen, und in 45 Saisons stritten zwei oder mehr Hersteller um dieselben
 * Siege. Beide Arten laufen deshalb durch dieselben Abfragen – die Zählregel
 * steht an einer Stelle, und sie ist für Motor und Reifen dieselbe.
 *
 * Gezählt wird je Hersteller und Rennen, nicht je Auto: Ein Motor, der vier
 * Wagen antreibt, war bei einem Rennen dabei, nicht bei vier. Ein Sieg ist der
 * kleinste Platz, den einer dieser Wagen belegt hat – ist er 1, hat der Motor
 * gewonnen.
 */

/** Spalte in race_result und Tabelle der Hersteller, je Art. Feste Werte, nie aus einer Eingabe. */
const MOTOR = { spalte: 'engine_id', tabelle: 'engine_manufacturer' }
const REIFEN = { spalte: 'tyre_id', tabelle: 'tyre_manufacturer' }

/*
 * Je Hersteller und Rennen zusammengefasst. Dieselbe Vorsicht wie überall:
 * In den 1950ern stehen mehrere Zeilen für dasselbe Auto, und ein Hersteller
 * belieferte ohnehin mehrere Teams.
 */
const jeHerstellerUndRennen = ({ spalte }) => `
  SELECT rr.${spalte} AS hersteller, r.id AS rennen, r.year AS jahr,
         MAX(rr.started)             AS gestartet,
         MAX(rr.classified)          AS gewertet,
         MIN(rr.position)            AS platz,
         MIN(rr.qualifying_position) AS quali,
         MAX(rr.fastest_lap)         AS schnellste,
         SUM(rr.points)              AS punkte
    FROM race_result rr
    JOIN race r ON r.id = rr.race_id
   WHERE rr.${spalte} IS NOT NULL
   GROUP BY rr.${spalte}, r.id`

const ZAEHLUNGEN = `
  COUNT(*)                                                     AS rennen,
  SUM(CASE WHEN gestartet = 1 THEN 1 ELSE 0 END)               AS starts,
  SUM(CASE WHEN gewertet = 1 AND platz = 1 THEN 1 ELSE 0 END)  AS siege,
  SUM(CASE WHEN gewertet = 1 AND platz <= 3 THEN 1 ELSE 0 END) AS podien,
  SUM(CASE WHEN quali = 1 THEN 1 ELSE 0 END)                   AS poles,
  SUM(CASE WHEN schnellste = 1 THEN 1 ELSE 0 END)              AS schnellsteRunden,
  SUM(punkte)                                                  AS punkte,
  MIN(jahr)                                                    AS von,
  MAX(jahr)                                                    AS bis`

/*
 * Fahrertitel, die auf diesem Hersteller gewonnen wurden: Der Meister fuhr
 * in der Saison mindestens ein Rennen damit. Für Motoren führt F1DB eine
 * eigene Zahl (Konstrukteurstitel); für Reifen nicht – dort zählt diese.
 */
const fahrertitel = ({ spalte }, wer) => `
  (SELECT COUNT(*) FROM season_driver_standing sds
    WHERE sds.championship_won = 1
      AND EXISTS (SELECT 1 FROM race_result rr JOIN race r ON r.id = rr.race_id
                   WHERE rr.driver_id = sds.driver_id AND r.year = sds.year AND rr.${spalte} = ${wer}))`

function liste(db, art, titel) {
  return db
    .prepare(
      `SELECT m.id, m.name, c.ioc AS land, c.name AS landName,
              ${titel} AS titel, x.*
         FROM (SELECT hersteller, ${ZAEHLUNGEN} FROM (${jeHerstellerUndRennen(art)}) GROUP BY hersteller) x
         JOIN ${art.tabelle} m ON m.id = x.hersteller
         LEFT JOIN country c ON c.id = m.country_id
        ORDER BY x.siege DESC, x.starts DESC`,
    )
    .all()
}

function profil(db, art, id, titel) {
  return db
    .prepare(
      `SELECT m.id, m.name, c.ioc AS land, c.name AS landName,
              ${titel} AS titel,
              m.f1db_race_wins AS f1dbSiege, m.f1db_race_starts AS f1dbStarts,
              x.*
         FROM (SELECT hersteller, ${ZAEHLUNGEN} FROM (${jeHerstellerUndRennen(art)}) WHERE hersteller = ?1 GROUP BY hersteller) x
         JOIN ${art.tabelle} m ON m.id = x.hersteller
         LEFT JOIN country c ON c.id = m.country_id`,
    )
    .get(id)
}

function teams({ spalte }, db, id, anzahl) {
  return db
    .prepare(
      `SELECT k.id, k.name,
              COUNT(DISTINCT x.rennen) AS rennen,
              COUNT(DISTINCT CASE WHEN x.platz = 1 THEN x.rennen END) AS siege,
              MIN(x.jahr) AS von, MAX(x.jahr) AS bis
         FROM (SELECT rr.constructor_id AS team, r.id AS rennen, r.year AS jahr,
                      MIN(rr.position) AS platz
                 FROM race_result rr
                 JOIN race r ON r.id = rr.race_id
                WHERE rr.${spalte} = ?1
                GROUP BY rr.constructor_id, r.id) x
         JOIN constructor k ON k.id = x.team
        GROUP BY k.id
        ORDER BY siege DESC, rennen DESC
        LIMIT ?2`,
    )
    .all(id, anzahl)
}

function sieger({ spalte }, db, id, anzahl) {
  return db
    .prepare(
      `SELECT d.id, d.display_name AS name, COUNT(DISTINCT rr.race_id) AS siege
         FROM race_result rr
         JOIN driver d ON d.id = rr.driver_id
        WHERE rr.${spalte} = ?1 AND rr.position = 1
        GROUP BY d.id
        ORDER BY siege DESC, d.last_name
        LIMIT ?2`,
    )
    .all(id, anzahl)
}

function proSaison(art, db, id) {
  return db
    .prepare(
      `SELECT jahr,
              COUNT(*) AS rennen,
              SUM(CASE WHEN gewertet = 1 AND platz = 1 THEN 1 ELSE 0 END)  AS siege,
              SUM(CASE WHEN gewertet = 1 AND platz <= 3 THEN 1 ELSE 0 END) AS podien,
              SUM(CASE WHEN gestartet = 1 THEN 1 ELSE 0 END)               AS starts
         FROM (${jeHerstellerUndRennen(art)})
        WHERE hersteller = ?1
        GROUP BY jahr
        ORDER BY jahr`,
    )
    .all(id)
}

function titelListe({ spalte }, db, id) {
  return db
    .prepare(
      `SELECT sds.year AS jahr, d.id AS fahrerId, d.display_name AS fahrer,
              (SELECT k.name FROM race_result rr
                 JOIN race r ON r.id = rr.race_id
                 JOIN constructor k ON k.id = rr.constructor_id
                WHERE rr.driver_id = sds.driver_id AND r.year = sds.year
                ORDER BY r.round DESC LIMIT 1) AS team,
              (SELECT rr.constructor_id FROM race_result rr JOIN race r ON r.id = rr.race_id
                WHERE rr.driver_id = sds.driver_id AND r.year = sds.year
                ORDER BY r.round DESC LIMIT 1) AS teamId
         FROM season_driver_standing sds
         JOIN driver d ON d.id = sds.driver_id
        WHERE sds.championship_won = 1
          AND EXISTS (
            SELECT 1 FROM race_result rr
              JOIN race r ON r.id = rr.race_id
             WHERE rr.driver_id = sds.driver_id AND r.year = sds.year AND rr.${spalte} = ?1)
        ORDER BY sds.year`,
    )
    .all(id)
}

// ------------------------------------------------------------------ Motoren

/** Alle Motorenhersteller mit ihren Zahlen, die erfolgreichsten zuerst. */
export const motorenListe = (db) => liste(db, MOTOR, 'm.f1db_championship_wins')

/** Ein Motorenhersteller mit seinen Zahlen, oder undefined. */
export const motorProfil = (db, id) => profil(db, MOTOR, id, 'm.f1db_championship_wins')

/**
 * Welche Teams diesen Motor benutzt haben, mit Jahren und Erfolg.
 *
 * Das ist der eigentliche Ertrag dieser Seite: Beim DFV stehen hier zwanzig
 * Namen, bei einem Werksmotor genau einer.
 */
export const motorTeams = (db, id, anzahl = 40) => teams(MOTOR, db, id, anzahl)

/** Wer mit diesem Motor gewonnen hat. */
export const motorSieger = (db, id, anzahl = 12) => sieger(MOTOR, db, id, anzahl)

/** Saison für Saison – daraus wird das Bild der Laufbahn eines Motors. */
export const motorProSaison = (db, id) => proSaison(MOTOR, db, id)

/**
 * Die Titel, die mit diesem Motor gewonnen wurden.
 *
 * Über die Wertung, nicht über die Zahl aus F1DB: So steht daneben, wer ihn
 * gewonnen hat und in welchem Auto.
 */
export const motorTitel = (db, id) => titelListe(MOTOR, db, id)

// ------------------------------------------------------------------- Reifen

/** Alle Reifenhersteller, die erfolgreichsten zuerst. Titel sind Fahrertitel. */
export const reifenListe = (db) => liste(db, REIFEN, fahrertitel(REIFEN, 'm.id'))

/** Ein Reifenhersteller mit seinen Zahlen, oder undefined. */
export const reifenProfil = (db, id) => profil(db, REIFEN, id, fahrertitel(REIFEN, 'm.id'))

/** Welche Teams auf diesen Reifen fuhren. */
export const reifenTeams = (db, id, anzahl = 40) => teams(REIFEN, db, id, anzahl)

/** Wer auf diesen Reifen gewonnen hat. */
export const reifenSieger = (db, id, anzahl = 12) => sieger(REIFEN, db, id, anzahl)

/** Fahrertitel auf diesen Reifen, mit Fahrer und Team. */
export const reifenTitel = (db, id) => titelListe(REIFEN, db, id)

/**
 * Saison für Saison, mit den Gegnern derselben Saison.
 *
 * Ein Reifenhersteller war entweder allein – dann gewann er jedes Rennen und
 * die Zahl sagt nichts – oder im Reifenkrieg. `gegner` nennt die anderen
 * Hersteller dieser Saison, `anteil` den Anteil der Siege: In einem Krieg ist
 * das die eigentliche Wertung, wie 2005 Michelin gegen Bridgestone, 18 zu 1.
 */
export function reifenProSaison(db, id) {
  const anderer = db.prepare(
    `SELECT DISTINCT t.id, t.name FROM race_result rr
       JOIN race r ON r.id = rr.race_id
       JOIN tyre_manufacturer t ON t.id = rr.tyre_id
      WHERE r.year = ?1 AND rr.tyre_id <> ?2
      ORDER BY t.name`,
  )
  const siegeImJahr = db.prepare(
    `SELECT COUNT(DISTINCT race_id) AS n FROM race_result rr JOIN race r ON r.id = rr.race_id
      WHERE r.year = ? AND rr.position = 1`,
  )
  return proSaison(REIFEN, db, id).map((s) => {
    const alle = siegeImJahr.get(s.jahr).n
    return { ...s, gegner: anderer.all(s.jahr, id), anteil: alle ? s.siege / alle : null }
  })
}

/**
 * Die Saisons, in denen mehrere Hersteller lieferten – mit den Siegen jedes
 * einzelnen. Ohne Wettbewerb ist eine Reifenstatistik nur eine Liste der
 * Jahre, in denen jemand Alleinlieferant war.
 */
export function reifenkriege(db) {
  const zeilen = db
    .prepare(
      `SELECT jahr, hersteller, COUNT(*) AS rennen,
              SUM(CASE WHEN gewertet = 1 AND platz = 1 THEN 1 ELSE 0 END) AS siege
         FROM (${jeHerstellerUndRennen(REIFEN)})
        GROUP BY jahr, hersteller
        ORDER BY jahr, siege DESC, rennen DESC`,
    )
    .all()
  const namen = new Map(db.prepare('SELECT id, name FROM tyre_manufacturer').all().map((t) => [t.id, t.name]))
  const jeJahr = new Map()
  for (const z of zeilen) {
    if (!jeJahr.has(z.jahr)) jeJahr.set(z.jahr, [])
    jeJahr.get(z.jahr).push({ id: z.hersteller, name: namen.get(z.hersteller), rennen: z.rennen, siege: z.siege })
  }
  return [...jeJahr].filter(([, h]) => h.length > 1).map(([jahr, hersteller]) => ({ jahr, hersteller }))
}
