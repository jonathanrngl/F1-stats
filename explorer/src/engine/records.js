/**
 * Die Rekorddatenbank.
 *
 * Jeder Rekord verweist auf einen Fahrer und, wo es einen gibt, auf das
 * Rennen, in dem er aufgestellt wurde. Ein Rekord ohne Beleg ist eine
 * Behauptung – und genau das soll diese Seite nicht sein.
 *
 * Zwei Regeln:
 *
 *   Bestenlisten zählen über Starts, nicht über Nennungen. Wer sich nicht
 *   qualifizierte, war nicht dabei.
 *
 *   Altersrekorde brauchen ein Geburtsdatum. Fehlt es, fällt der Fahrer aus
 *   der Liste – nicht mit Alter null hinein.
 */

/** Ein Eintrag der Bestenliste. */
const eintrag = (z) => ({
  driverId: z.driverId,
  name: z.name,
  wert: z.wert,
  raceId: z.raceId ?? null,
  rennen: z.rennen ?? null,
  jahr: z.jahr ?? null,
})

/**
 * Bestenlisten nach einer einfachen Zählung.
 *
 * `bedingung` filtert die Ergebniszeilen, `distinct` zählt Rennen statt
 * Zeilen – nötig, weil in den 1950ern ein Fahrer zweimal im selben Rennen
 * stehen kann.
 */
function bestenliste(db, bedingung, anzahl = 10) {
  return db
    .prepare(
      `SELECT rr.driver_id AS driverId, d.full_name AS name,
              COUNT(DISTINCT rr.race_id) AS wert
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE ${bedingung}
        GROUP BY rr.driver_id
        ORDER BY wert DESC, d.last_name
        LIMIT ?`,
    )
    .all(anzahl)
    .map(eintrag)
}

export const meisteStarts = (db, n) => bestenliste(db, 'rr.started = 1', n)
export const meisteSiege = (db, n) => bestenliste(db, 'rr.position = 1', n)
export const meistePodien = (db, n) => bestenliste(db, 'rr.classified = 1 AND rr.position <= 3', n)
export const meistePoles = (db, n) => bestenliste(db, 'rr.qualifying_position = 1', n)
export const meisteSchnellsteRunden = (db, n) => bestenliste(db, 'rr.fastest_lap = 1', n)

/**
 * Meiste Punkte – über die Rennergebnisse, nicht über die Wertung.
 *
 * Die Wertung wäre für einen epochenübergreifenden Vergleich unbrauchbar:
 * Bis 1990 verfielen Streichresultate, und die Punktesysteme haben sich mehr
 * als ein Dutzend Mal geändert. Beides macht die Zahl ohnehin nur bedingt
 * vergleichbar; die Seite sagt das dazu.
 */
export function meistePunkte(db, anzahl = 10) {
  return db
    .prepare(
      `SELECT rr.driver_id AS driverId, d.full_name AS name, SUM(rr.points) AS wert
         FROM race_result rr JOIN driver d ON d.id = rr.driver_id
        GROUP BY rr.driver_id HAVING wert > 0
        ORDER BY wert DESC LIMIT ?`,
    )
    .all(anzahl)
    .map(eintrag)
}

export function meisteTitel(db, anzahl = 10) {
  return db
    .prepare(
      `SELECT sds.driver_id AS driverId, d.full_name AS name,
              COUNT(*) AS wert, MIN(sds.year) AS jahr
         FROM season_driver_standing sds JOIN driver d ON d.id = sds.driver_id
        WHERE sds.championship_won = 1
        GROUP BY sds.driver_id ORDER BY wert DESC, jahr LIMIT ?`,
    )
    .all(anzahl)
    .map(eintrag)
}

/**
 * Längste ununterbrochene Serien.
 *
 * Gezählt wird über die Starts eines Fahrers in zeitlicher Reihenfolge: Eine
 * Siegesserie reißt beim ersten Rennen ohne Sieg, auch wenn er danach
 * weitergewinnt. Rennen, die der Fahrer ausließ, unterbrechen sie nicht – er
 * war nicht dabei, also konnte er nichts verlieren.
 */
export function laengsteSerien(db, art, anzahl = 10) {
  const trifft = {
    siege: (r) => r.position === 1,
    podien: (r) => r.classified === 1 && r.position <= 3,
    punkte: (r) => (r.points ?? 0) > 0,
    zielankuenfte: (r) => r.classified === 1,
  }[art]

  const zeilen = db
    .prepare(
      `SELECT rr.driver_id AS driverId, d.full_name AS name,
              r.id AS raceId, r.year, r.round,
              g.name AS grandPrix,
              MIN(rr.position) AS position, MAX(rr.classified) AS classified,
              SUM(rr.points) AS points
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN grand_prix g ON g.id = r.grand_prix_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE rr.started = 1
        GROUP BY rr.driver_id, r.id
        ORDER BY rr.driver_id, r.year, r.round`,
    )
    .all()

  const proFahrer = new Map()
  for (const z of zeilen) {
    const e = proFahrer.get(z.driverId) ?? { name: z.name, rennen: [] }
    e.rennen.push(z)
    proFahrer.set(z.driverId, e)
  }

  const beste = []
  for (const [driverId, f] of proFahrer) {
    let lauf = 0
    let start = null
    let rekord = { length: 0, von: null, bis: null }
    for (const r of f.rennen) {
      if (trifft(r)) {
        if (lauf === 0) start = r
        lauf++
        if (lauf > rekord.length) rekord = { length: lauf, von: start, bis: r }
      } else lauf = 0
    }
    if (rekord.length > 1) beste.push({ driverId, name: f.name, ...rekord })
  }

  return beste
    .sort((a, b) => b.length - a.length || a.von.year - b.von.year)
    .slice(0, anzahl)
    .map((b) => ({
      driverId: b.driverId,
      name: b.name,
      wert: b.length,
      raceId: b.bis.raceId,
      rennen: `${b.von.grandPrix} ${b.von.year} – ${b.bis.grandPrix} ${b.bis.year}`,
      jahr: b.von.year,
    }))
}

/**
 * Altersrekorde.
 *
 * `richtung` 'jung' sucht den jüngsten, 'alt' den ältesten. Fahrer ohne
 * Geburtsdatum bleiben draußen: Ein fehlendes Datum ist kein Alter null.
 */
export function altersrekord(db, ereignis, richtung = 'jung', anzahl = 10) {
  const bedingung = {
    sieg: 'rr.position = 1',
    pole: 'rr.qualifying_position = 1',
    podium: 'rr.classified = 1 AND rr.position <= 3',
    start: 'rr.started = 1',
  }[ereignis]

  return db
    .prepare(
      `SELECT rr.driver_id AS driverId, d.full_name AS name,
              r.id AS raceId, r.year AS jahr, g.name AS grandPrix, r.date,
              (julianday(r.date) - julianday(d.date_of_birth)) / 365.25 AS alter_jahre
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN grand_prix g ON g.id = r.grand_prix_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE ${bedingung} AND d.date_of_birth IS NOT NULL
        ORDER BY alter_jahre ${richtung === 'jung' ? 'ASC' : 'DESC'}
        LIMIT ?`,
    )
    .all(anzahl)
    .map((z) => ({
      driverId: z.driverId,
      name: z.name,
      wert: z.alter_jahre,
      raceId: z.raceId,
      rennen: `${z.grandPrix} ${z.jahr}`,
      jahr: z.jahr,
    }))
}

/** Jüngste und älteste Weltmeister – über das letzte Rennen der Saison datiert. */
export function altersrekordMeister(db, richtung = 'jung', anzahl = 10) {
  return db
    .prepare(
      `SELECT sds.driver_id AS driverId, d.full_name AS name, sds.year AS jahr,
              (julianday(letztes.date) - julianday(d.date_of_birth)) / 365.25 AS alter_jahre,
              letztes.id AS raceId, g.name AS grandPrix
         FROM season_driver_standing sds
         JOIN driver d ON d.id = sds.driver_id
         JOIN (SELECT year, id, date, grand_prix_id,
                      ROW_NUMBER() OVER (PARTITION BY year ORDER BY round DESC) AS rn
                 FROM race) letztes ON letztes.year = sds.year AND letztes.rn = 1
         JOIN grand_prix g ON g.id = letztes.grand_prix_id
        WHERE sds.championship_won = 1 AND d.date_of_birth IS NOT NULL
        ORDER BY alter_jahre ${richtung === 'jung' ? 'ASC' : 'DESC'}
        LIMIT ?`,
    )
    .all(anzahl)
    .map((z) => ({
      driverId: z.driverId,
      name: z.name,
      wert: z.alter_jahre,
      raceId: z.raceId,
      rennen: `Titel ${z.jahr}`,
      jahr: z.jahr,
    }))
}

/**
 * Größte Aufholjagden zum Sieg: von welchem Startplatz aus wurde gewonnen?
 *
 * Nur Rennen mit überliefertem Startplatz – in den frühesten Jahren fehlt er
 * gelegentlich, und ein fehlender Startplatz ist keine Pole.
 */
export function groessteAufholjagden(db, anzahl = 10) {
  return db
    .prepare(
      `SELECT rr.driver_id AS driverId, d.full_name AS name, rr.grid_position AS wert,
              r.id AS raceId, r.year AS jahr, g.name AS grandPrix
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN grand_prix g ON g.id = r.grand_prix_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE rr.position = 1 AND rr.grid_position IS NOT NULL
        ORDER BY rr.grid_position DESC LIMIT ?`,
    )
    .all(anzahl)
    .map((z) => ({ ...eintrag(z), rennen: `${z.grandPrix} ${z.jahr}` }))
}

/** Meiste in einem einzelnen Rennen gutgemachte Plätze. */
export function meistePlaetzeGutgemacht(db, anzahl = 10) {
  return db
    .prepare(
      `SELECT rr.driver_id AS driverId, d.full_name AS name,
              rr.grid_position - rr.position AS wert,
              r.id AS raceId, r.year AS jahr, g.name AS grandPrix
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN grand_prix g ON g.id = r.grand_prix_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE rr.classified = 1 AND rr.grid_position IS NOT NULL
        ORDER BY wert DESC LIMIT ?`,
    )
    .all(anzahl)
    .map((z) => ({ ...eintrag(z), rennen: `${z.grandPrix} ${z.jahr}` }))
}

/**
 * Längste Karrieren, gemessen vom ersten bis zum letzten Start.
 *
 * Nicht die Zahl der Starts, sondern die Spanne: Wer mit Unterbrechungen
 * zurückkehrt, steht hier vorn – das ist die interessantere Frage.
 */
export function laengsteKarrieren(db, anzahl = 10) {
  return db
    .prepare(
      `SELECT rr.driver_id AS driverId, d.full_name AS name,
              (julianday(MAX(r.date)) - julianday(MIN(r.date))) / 365.25 AS wert,
              MIN(r.year) AS jahr, MAX(r.year) AS bis
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE rr.started = 1
        GROUP BY rr.driver_id
        ORDER BY wert DESC LIMIT ?`,
    )
    .all(anzahl)
    .map((z) => ({ ...eintrag(z), rennen: `${z.jahr}–${z.bis}` }))
}

/**
 * Längste Durststrecke zwischen zwei Siegen desselben Fahrers.
 *
 * Gemessen in Jahren zwischen zwei aufeinanderfolgenden Siegen – die
 * Geschichte von Rückkehrern und langen Fehlzeiten.
 */
export function laengstePauseZwischenSiegen(db, anzahl = 10) {
  const siege = db
    .prepare(
      `SELECT rr.driver_id AS driverId, d.full_name AS name, r.id AS raceId,
              r.date, r.year, g.name AS grandPrix
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN grand_prix g ON g.id = r.grand_prix_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE rr.position = 1
        ORDER BY rr.driver_id, r.date`,
    )
    .all()

  const proFahrer = new Map()
  for (const s of siege) {
    const e = proFahrer.get(s.driverId) ?? []
    e.push(s)
    proFahrer.set(s.driverId, e)
  }

  const luecken = []
  for (const [driverId, liste] of proFahrer) {
    for (let i = 1; i < liste.length; i++) {
      const jahre =
        (new Date(liste[i].date) - new Date(liste[i - 1].date)) / (365.25 * 24 * 3600 * 1000)
      luecken.push({
        driverId,
        name: liste[i].name,
        wert: jahre,
        raceId: liste[i].raceId,
        rennen: `${liste[i - 1].grandPrix} ${liste[i - 1].year} → ${liste[i].grandPrix} ${liste[i].year}`,
        jahr: liste[i].year,
      })
    }
  }

  return luecken.sort((a, b) => b.wert - a.wert).slice(0, anzahl)
}

/** Teams mit den meisten Siegen, Titeln oder Doppelsiegen. */
export function teamRekorde(db, art, anzahl = 10) {
  if (art === 'titel') {
    return db
      .prepare(
        `SELECT scs.constructor_id AS id, k.name, COUNT(*) AS wert, MIN(scs.year) AS jahr
           FROM season_constructor_standing scs JOIN constructor k ON k.id = scs.constructor_id
          WHERE scs.championship_won = 1
          GROUP BY scs.constructor_id ORDER BY wert DESC, jahr LIMIT ?`,
      )
      .all(anzahl)
  }
  const bedingung = art === 'siege' ? 'rr.position = 1' : 'rr.qualifying_position = 1'
  return db
    .prepare(
      `SELECT rr.constructor_id AS id, k.name, COUNT(DISTINCT rr.race_id) AS wert
         FROM race_result rr JOIN constructor k ON k.id = rr.constructor_id
        WHERE ${bedingung}
        GROUP BY rr.constructor_id ORDER BY wert DESC LIMIT ?`,
    )
    .all(anzahl)
}
