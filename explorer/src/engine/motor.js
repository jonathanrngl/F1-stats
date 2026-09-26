/**
 * Motorenhersteller.
 *
 * Die dritte Größe neben Fahrer und Team, und die am leichtesten übersehene.
 * Ein Ford-Cosworth DFV gewann in zehn verschiedenen Chassis; Ferrari kommt als
 * Motorlieferant auf einen Sieg mehr als als Rennstall, weil ein Kundenteam
 * gewann. Wer nur Fahrer und Teams zählt, sieht diese Geschichte nie.
 *
 * Gezählt wird je Hersteller und Rennen, nicht je Auto: Ein Motor, der vier
 * Wagen antreibt, war bei einem Rennen dabei, nicht bei vier. Ein Sieg ist der
 * kleinste Platz, den einer dieser Wagen belegt hat – ist er 1, hat der Motor
 * gewonnen.
 */

/*
 * Je Hersteller und Rennen zusammengefasst. Dieselbe Vorsicht wie überall:
 * In den 1950ern stehen mehrere Zeilen für dasselbe Auto, und ein Hersteller
 * belieferte ohnehin mehrere Teams.
 */
const JE_MOTOR_UND_RENNEN = `
  SELECT rr.engine_id AS motor, r.id AS rennen, r.year AS jahr,
         MAX(rr.started)             AS gestartet,
         MAX(rr.classified)          AS gewertet,
         MIN(rr.position)            AS platz,
         MIN(rr.qualifying_position) AS quali,
         MAX(rr.fastest_lap)         AS schnellste,
         SUM(rr.points)              AS punkte
    FROM race_result rr
    JOIN race r ON r.id = rr.race_id
   WHERE rr.engine_id IS NOT NULL
   GROUP BY rr.engine_id, r.id`

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

/** Alle Hersteller mit ihren Zahlen, die erfolgreichsten zuerst. */
export function motorenListe(db) {
  return db
    .prepare(
      `SELECT m.id, m.name, c.ioc AS land, c.name AS landName,
              m.f1db_championship_wins AS titel, x.*
         FROM (SELECT motor, ${ZAEHLUNGEN} FROM (${JE_MOTOR_UND_RENNEN}) GROUP BY motor) x
         JOIN engine_manufacturer m ON m.id = x.motor
         LEFT JOIN country c ON c.id = m.country_id
        ORDER BY x.siege DESC, x.starts DESC`,
    )
    .all()
}

/** Ein Hersteller mit seinen Zahlen, oder undefined. */
export function motorProfil(db, id) {
  return db
    .prepare(
      `SELECT m.id, m.name, c.ioc AS land, c.name AS landName,
              m.f1db_championship_wins AS titel,
              m.f1db_race_wins AS f1dbSiege, m.f1db_race_starts AS f1dbStarts,
              x.*
         FROM (SELECT motor, ${ZAEHLUNGEN} FROM (${JE_MOTOR_UND_RENNEN}) WHERE motor = ?1 GROUP BY motor) x
         JOIN engine_manufacturer m ON m.id = x.motor
         LEFT JOIN country c ON c.id = m.country_id`,
    )
    .get(id)
}

/**
 * Welche Teams diesen Motor benutzt haben, mit Jahren und Erfolg.
 *
 * Das ist der eigentliche Ertrag dieser Seite: Beim DFV stehen hier zwanzig
 * Namen, bei einem Werksmotor genau einer.
 */
export function motorTeams(db, id, anzahl = 40) {
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
                WHERE rr.engine_id = ?1
                GROUP BY rr.constructor_id, r.id) x
         JOIN constructor k ON k.id = x.team
        GROUP BY k.id
        ORDER BY siege DESC, rennen DESC
        LIMIT ?2`,
    )
    .all(id, anzahl)
}

/** Wer mit diesem Motor gewonnen hat. */
export function motorSieger(db, id, anzahl = 12) {
  return db
    .prepare(
      `SELECT d.id, d.display_name AS name, COUNT(DISTINCT rr.race_id) AS siege
         FROM race_result rr
         JOIN driver d ON d.id = rr.driver_id
        WHERE rr.engine_id = ?1 AND rr.position = 1
        GROUP BY d.id
        ORDER BY siege DESC, d.last_name
        LIMIT ?2`,
    )
    .all(id, anzahl)
}

/** Saison für Saison – daraus wird das Bild der Laufbahn eines Motors. */
export function motorProSaison(db, id) {
  return db
    .prepare(
      `SELECT jahr,
              COUNT(*) AS rennen,
              SUM(CASE WHEN gewertet = 1 AND platz = 1 THEN 1 ELSE 0 END)  AS siege,
              SUM(CASE WHEN gewertet = 1 AND platz <= 3 THEN 1 ELSE 0 END) AS podien,
              SUM(CASE WHEN gestartet = 1 THEN 1 ELSE 0 END)               AS starts
         FROM (${JE_MOTOR_UND_RENNEN})
        WHERE motor = ?1
        GROUP BY jahr
        ORDER BY jahr`,
    )
    .all(id)
}

/**
 * Die Titel, die mit diesem Motor gewonnen wurden.
 *
 * Über die Wertung, nicht über die Zahl aus F1DB: So steht daneben, wer ihn
 * gewonnen hat und in welchem Auto.
 */
export function motorTitel(db, id) {
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
             WHERE rr.driver_id = sds.driver_id AND r.year = sds.year AND rr.engine_id = ?1)
        ORDER BY sds.year`,
    )
    .all(id)
}
