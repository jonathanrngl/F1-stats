/**
 * Was-wäre-wenn: dieselben Rennen, ein anderes Punktesystem.
 *
 * Die Frage „wer wäre 1988 nach heutigen Regeln Weltmeister geworden" ist die
 * älteste Stammtischfrage der Formel 1, und sie ist beantwortbar: Die
 * Ergebnisse stehen fest, nur die Bewertung ändert sich.
 *
 * Drei Dinge, die eine solche Rechnung leicht falsch machen:
 *
 *   Streichresultate. Bis 1990 zählten nur die besten N Ergebnisse. Wer sie
 *   ignoriert, rechnet ein anderes Szenario als gedacht – deshalb ist das
 *   hier eine eigene, ausweisbare Option.
 *
 *   Geteilte Fahrzeuge. In den 1950ern teilten sich zwei Fahrer ein Auto und
 *   damit einen Platz. Volle Punkte an beide zu vergeben, verdoppelt Siege.
 *
 *   Sprints. Seit 2021 gibt es Punkte außerhalb des Rennens. Ein Rennsystem
 *   auf sie anzuwenden wäre falsch, sie wegzulassen ebenso – sie werden
 *   deshalb unverändert übernommen und getrennt ausgewiesen.
 */

/** Bekannte Punktesysteme. Daten, kein Code – deshalb erweiterbar ohne Eingriff. */
export const SYSTEME = {
  heute: {
    name: "Today's system",
    beschreibung: '25-18-15-12-10-8-6-4-2-1 for the top ten.',
    punkte: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    seit: 2010,
  },
  '2003': {
    name: '2003–2009 system',
    beschreibung: '10-8-6-5-4-3-2-1 for the top eight.',
    punkte: [10, 8, 6, 5, 4, 3, 2, 1],
    seit: 2003,
  },
  '1991': {
    name: '1991–2002 system',
    beschreibung: '10-6-4-3-2-1 for the top six.',
    punkte: [10, 6, 4, 3, 2, 1],
    seit: 1991,
  },
  '1961': {
    name: '1961–1990 system',
    beschreibung: '9-6-4-3-2-1 for the top six.',
    punkte: [9, 6, 4, 3, 2, 1],
    seit: 1961,
  },
  '1950': {
    name: '1950–1959 system',
    beschreibung: '8-6-4-3-2 for the top five, plus one for the fastest lap.',
    punkte: [8, 6, 4, 3, 2],
    schnellsteRunde: 1,
    seit: 1950,
  },
}

/**
 * Eine Saison nach einem anderen Punktesystem neu rechnen.
 *
 * @param {object} db
 * @param {number} jahr
 * @param {string} systemId Schlüssel aus SYSTEME
 * @param {{ ohneAusfaelle?: boolean }} [optionen]
 */
export function saisonNeuRechnen(db, jahr, systemId, optionen = {}) {
  const system = SYSTEME[systemId]
  if (!system) throw new Error(`Unknown points system: ${systemId}`)

  const zeilen = db
    .prepare(
      `SELECT rr.race_id AS raceId, rr.driver_id AS driverId, d.full_name AS name,
              rr.position, rr.classified, rr.shared_car AS geteilt, rr.fastest_lap AS schnellste,
              rr.points AS echtePunkte, r.round
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
   * Wie viele Fahrer teilen sich einen Platz? Bei geteilten Fahrzeugen sind
   * es zwei oder drei. Die Punkte werden dann geteilt, wie es die Epoche auch
   * tat – sonst hätte ein Rennen zwei Sieger mit je voller Punktzahl.
   */
  const proRennenUndPlatz = new Map()
  for (const z of zeilen) {
    if (!z.classified || z.position === null) continue
    const k = `${z.raceId}|${z.position}`
    proRennenUndPlatz.set(k, (proRennenUndPlatz.get(k) ?? 0) + 1)
  }

  const proFahrer = new Map()
  const ergebnisseProFahrer = new Map()

  for (const z of zeilen) {
    const e = proFahrer.get(z.driverId) ?? {
      driverId: z.driverId,
      name: z.name,
      punkte: 0,
      siege: 0,
      geteilteFahrten: 0,
    }
    proFahrer.set(z.driverId, e)

    if (optionen.ohneAusfaelle && !z.classified) continue
    if (!z.classified || z.position === null) continue

    const platz = z.position
    let p = platz <= system.punkte.length ? system.punkte[platz - 1] : 0
    if (system.schnellsteRunde && z.schnellste) p += system.schnellsteRunde

    const teiler = proRennenUndPlatz.get(`${z.raceId}|${platz}`) ?? 1
    if (teiler > 1) {
      p /= teiler
      e.geteilteFahrten++
    }

    e.punkte += p
    if (platz === 1) e.siege++

    const liste = ergebnisseProFahrer.get(z.driverId) ?? []
    liste.push(p)
    ergebnisseProFahrer.set(z.driverId, liste)
  }

  // Sprintpunkte unverändert übernehmen: Ein Rennsystem gilt nicht für sie.
  let sprintSumme = 0
  for (const [id, p] of sprintPunkte) {
    const e = proFahrer.get(id)
    if (e) {
      e.punkte += p
      e.sprintPunkte = p
      sprintSumme += p
    }
  }

  const tabelle = [...proFahrer.values()]
    .filter((e) => e.punkte > 0)
    .sort((a, b) => b.punkte - a.punkte || b.siege - a.siege)
    .map((e, i) => ({ ...e, platz: i + 1 }))

  return {
    system,
    jahr,
    tabelle,
    sprintPunkte: sprintSumme,
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
      `SELECT sds.position AS platz, sds.driver_id AS driverId, d.full_name AS name,
              sds.points AS punkte, sds.championship_won AS meister
         FROM season_driver_standing sds JOIN driver d ON d.id = sds.driver_id
        WHERE sds.year = ? ORDER BY sds.position`,
    )
    .all(jahr)
}

/**
 * Welches Punktesystem galt in diesem Jahr tatsächlich?
 * Für die Anzeige: „nach heutigem System" ist für 2015 keine Was-wäre-wenn-Frage.
 */
export function systemDesJahres(jahr) {
  const passend = Object.entries(SYSTEME)
    .filter(([, s]) => jahr >= s.seit)
    .sort((a, b) => b[1].seit - a[1].seit)[0]
  return passend ? passend[0] : null
}
