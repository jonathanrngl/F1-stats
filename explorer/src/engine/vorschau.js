/**
 * Vorschau auf das nächste Rennen.
 *
 * Alles hier rechnet gegen den Stand, den die Datenbank beim Bauen hat. Die
 * Seite entsteht also nicht „jetzt“, sondern beim letzten Lauf – deshalb gibt
 * jede Funktion mit heraus, worauf sie sich bezieht, statt es zu verschweigen.
 *
 * Die Zählweisen sind dieselben wie in `driver.js`: gestartet ist `started`,
 * ein Sieg ist Platz 1 in der Wertung, eine Pole die schnellste Zeit im
 * Qualifying – nicht der Startplatz. Wer das ändert, muss es dort auch ändern.
 */
import { maxRennpunkte, maxSprintpunkte, streichregel } from './punkte.js'

/*
 * In den 1950ern übernahm ein Fahrer schon mal das Auto eines Teamkollegen;
 * dann stehen zwei Ergebniszeilen für denselben Fahrer im selben Rennen. Je
 * Fahrer und Rennen erst zusammenfassen, sonst zählt ein solches Rennen
 * doppelt – genau wie `driverRaces` es tut.
 */
const JE_RENNEN = `
  SELECT rr.driver_id AS fahrer, r.id AS rennen, r.circuit_id AS strecke,
         MAX(rr.started)             AS gestartet,
         MAX(rr.classified)          AS gewertet,
         MIN(rr.position)            AS platz,
         MIN(rr.qualifying_position) AS quali,
         MAX(rr.fastest_lap)         AS schnellste
    FROM race_result rr
    JOIN race r ON r.id = rr.race_id
   GROUP BY rr.driver_id, r.id`

/** Die Zählungen als SQL, an einer Stelle – damit sie überall gleich lauten. */
const ZAEHLUNGEN = `
  SUM(CASE WHEN gestartet = 1 THEN 1 ELSE 0 END)               AS starts,
  SUM(CASE WHEN gewertet = 1 AND platz = 1 THEN 1 ELSE 0 END)  AS siege,
  SUM(CASE WHEN gewertet = 1 AND platz <= 3 THEN 1 ELSE 0 END) AS podien,
  SUM(CASE WHEN quali = 1 THEN 1 ELSE 0 END)                   AS poles,
  SUM(CASE WHEN schnellste = 1 THEN 1 ELSE 0 END)              AS schnellsteRunden`

// ------------------------------------------------------------ nächstes Rennen

/**
 * Das nächste Rennen: das früheste, zu dem noch kein Ergebnis vorliegt.
 *
 * Nicht „Datum in der Zukunft“, und bewusst ohne das heutige Datum: Liegt ein
 * gefahrenes Rennen noch ohne Ergebnis in den Daten, weil das Release
 * hinterherhinkt, ist trotzdem dieses das nächste, über das es etwas zu sagen
 * gibt – und seine Punkte sind noch zu vergeben. Wie weit es zurückliegt,
 * rechnet der Browser beim Ansehen aus dem Datum (Countdown.astro).
 *
 * Damit hängt die Seite allein an den Daten: Dieselbe F1DB-Fassung ergibt
 * an jedem Tag dieselbe Vorschau.
 */
export function naechstesRennen(db) {
  return (
    db
      .prepare(
        `SELECT r.id, r.year AS jahr, r.round AS runde, r.date AS datum, r.time AS zeit,
                r.official_name AS offiziell, r.laps AS runden,
                r.distance_km AS distanz, r.course_length_km AS laenge,
                r.turns AS kurven, r.had_sprint AS mitSprint,
                r.qualifying_format AS qualiFormat,
                g.id AS grandPrixId, g.name AS grandPrix, g.full_name AS grandPrixVoll,
                z.id AS streckeId, z.name AS strecke, z.full_name AS streckeVoll,
                z.place_name AS ort, z.type AS art, z.direction AS richtung,
                z.length_km AS streckenlaenge, z.turns AS streckenkurven,
                c.name AS land, c.ioc AS ioc, c.demonym AS demonym,
                (SELECT COUNT(*) FROM race r2 WHERE r2.year = r.year) AS rennenImJahr
           FROM race r
           JOIN grand_prix g ON g.id = r.grand_prix_id
           JOIN circuit z ON z.id = r.circuit_id
           LEFT JOIN country c ON c.id = z.country_id
          WHERE NOT EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)
          ORDER BY r.date, r.round
          LIMIT 1`,
      )
      .get() ?? null
  )
}

/**
 * Der Zeitplan des Wochenendes: jede Session mit Datum und Startzeit (UTC).
 *
 * F1DB führt die Zeiten erst für jüngere Jahre; fehlt eine, fehlt sie – eine
 * Session ohne Uhrzeit steht mit Datum allein da.
 */
export function zeitplan(db, raceId) {
  const r = db.prepare('SELECT * FROM race WHERE id = ?').get(raceId)
  if (!r) return []
  const SESSIONS = [
    ['fp1', 'Practice 1'],
    ['fp2', 'Practice 2'],
    ['fp3', 'Practice 3'],
    ['sprint_qualifying', 'Sprint qualifying'],
    ['sprint', 'Sprint'],
    ['qualifying', 'Qualifying'],
  ]
  const liste = SESSIONS.filter(([k]) => r[`${k}_date`]).map(([k, name]) => ({
    name,
    datum: r[`${k}_date`],
    zeit: r[`${k}_time`] ?? null,
  }))
  liste.push({ name: 'Race', datum: r.date, zeit: r.time ?? null, rennen: true })
  return liste.sort((a, b) => `${a.datum}${a.zeit ?? ''}`.localeCompare(`${b.datum}${b.zeit ?? ''}`))
}

/** Wie oft auf dieser Strecke schon gefahren wurde, und wann zuletzt. */
export function streckenHistorie(db, streckeId) {
  return db
    .prepare(
      `SELECT COUNT(*) AS rennen, MIN(r.year) AS von, MAX(r.year) AS bis
         FROM race r
        WHERE r.circuit_id = ?
          AND EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)`,
    )
    .get(streckeId)
}

// -------------------------------------------------------------- Stand der WM

/**
 * Der Stand vor dem Rennen.
 *
 * Gerechnet wird auf dem letzten Rennen der Saison *vor* diesem, zu dem ein
 * Ergebnis vorliegt – nicht auf `season_driver_standing`, das den Endstand
 * führt. Für das nächste Rennen ist das schlicht das zuletzt gewertete; die
 * Einschränkung auf frühere Runden macht dieselbe Rechnung aber auch für
 * vergangene Rennen richtig, und nur so lässt sie sich an der Geschichte
 * prüfen. Steht das Rennen am Saisonanfang, gibt es den Bezugspunkt noch
 * nicht; dann kommt der Endstand der Vorsaison, und `vorsaison` sagt das.
 */
export function standVorRennen(db, rennen) {
  const letztes = db
    .prepare(
      `SELECT r.id, r.year AS jahr, r.round AS runde, r.date AS datum,
              g.name AS grandPrix
         FROM race r
         JOIN grand_prix g ON g.id = r.grand_prix_id
        WHERE r.year = ? AND r.round < ?
          AND EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)
        ORDER BY r.round DESC
        LIMIT 1`,
    )
    .get(rennen.jahr, rennen.runde)

  const bezug = letztes ?? letztesRennenVor(db, rennen.jahr)
  if (!bezug) return null

  return {
    vorsaison: !letztes,
    streichresultate: streichregel(rennen.jahr) !== null,
    bezug,
    fahrer: fahrerStand(db, bezug.id),
    teams: teamStand(db, bezug.id),
    ...offeneRennen(db, rennen),
  }
}

/** Das letzte Rennen mit Ergebnis vor einem Jahr – für den Saisonauftakt. */
function letztesRennenVor(db, jahr) {
  return (
    db
      .prepare(
        `SELECT r.id, r.year AS jahr, r.round AS runde, r.date AS datum,
                g.name AS grandPrix
           FROM race r
           JOIN grand_prix g ON g.id = r.grand_prix_id
          WHERE r.year < ?
            AND EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)
          ORDER BY r.year DESC, r.round DESC
          LIMIT 1`,
      )
      .get(jahr) ?? null
  )
}

/*
 * Das Team kommt aus dem letzten Rennen der Saison, in dem der Fahrer
 * überhaupt gefahren ist – nicht aus dem Bezugsrennen selbst. Wer dort
 * aussetzte oder ersetzt wurde, stünde sonst ohne Team da, obwohl er in der
 * Wertung steht.
 */
function fahrerStand(db, raceId, anzahl = 10) {
  return db
    .prepare(
      `SELECT s.driver_id AS id, d.display_name AS name, s.position, s.points AS punkte,
              (SELECT rr.constructor_id
                 FROM race_result rr
                 JOIN race r2 ON r2.id = rr.race_id
                WHERE rr.driver_id = s.driver_id
                  AND r2.year = (SELECT year FROM race WHERE id = s.race_id)
                ORDER BY r2.round DESC
                LIMIT 1) AS teamId,
              (SELECT k.name
                 FROM race_result rr
                 JOIN race r2 ON r2.id = rr.race_id
                 JOIN constructor k ON k.id = rr.constructor_id
                WHERE rr.driver_id = s.driver_id
                  AND r2.year = (SELECT year FROM race WHERE id = s.race_id)
                ORDER BY r2.round DESC
                LIMIT 1) AS team
         FROM race_driver_standing s
         JOIN driver d ON d.id = s.driver_id
        WHERE s.race_id = ?
        ORDER BY s.position
        LIMIT ?`,
    )
    .all(raceId, anzahl)
}

function teamStand(db, raceId, anzahl = 10) {
  return db
    .prepare(
      `SELECT s.constructor_id AS id, k.name, s.position, s.points AS punkte
         FROM race_constructor_standing s
         JOIN constructor k ON k.id = s.constructor_id
        WHERE s.race_id = ?
        ORDER BY s.position
        LIMIT ?`,
    )
    .all(raceId, anzahl)
}

/*
 * Wie viel noch zu holen ist. Gezählt werden die Rennen der Saison ab diesem,
 * jedes mit dem Höchstwert seines Jahres aus `punkte.js`: 2024 waren es 26
 * (Sieg und schnellste Runde), seit 2025 sind es 25, und ein Sprintsieg bringt
 * 8. Eine feste Zahl im Code stimmte immer nur für ein paar Jahre.
 *
 * Das ist die Obergrenze für einen einzelnen Fahrer, nicht für ein Team – ein
 * Team holt je Rennen bis zu 25 und 18. Wer die Zahl auf die Teamwertung
 * anwendet, rechnet falsch; deshalb heißt sie nach dem, was sie meint.
 */
function offeneRennen(db, rennen) {
  const z = db
    .prepare(
      `SELECT COUNT(*) AS offen,
              SUM(CASE WHEN had_sprint = 1 THEN 1 ELSE 0 END) AS sprints
         FROM race
        WHERE year = ? AND round >= ?`,
    )
    .get(rennen.jahr, rennen.runde)

  const offen = z?.offen ?? 0
  const sprints = z?.sprints ?? 0
  const sieg = maxRennpunkte(rennen.jahr)
  const sprintsieg = maxSprintpunkte(rennen.jahr)
  const maxFuerEinenFahrer = offen * sieg + sprints * sprintsieg
  const maxDiesesRennen = sieg + (rennen.mitSprint ? sprintsieg : 0)

  return {
    offen,
    sprints,
    maxFuerEinenFahrer,
    /** Was an diesem Wochenende selbst zu holen ist. */
    maxDiesesRennen,
    /** Dasselbe für die Zeit *nach* diesem Rennen – für die Titelfrage. */
    maxDanach: Math.max(0, maxFuerEinenFahrer - maxDiesesRennen),
  }
}

/**
 * Kann der Fahrertitel an diesem Wochenende fallen?
 *
 * Ja, wenn der Führende im besten Fall – er gewinnt alles, der Verfolger holt
 * nichts – danach mehr Vorsprung hat, als noch zu vergeben ist. Das muss für
 * jeden Verfolger gelten; der knappste ist der Zweite. Es ist die notwendige
 * Bedingung, nicht die hinreichende: Ob der Titel wirklich fällt, entscheidet
 * das Ergebnis. Die Seite sagt deshalb „kann“, nicht „wird“.
 *
 * In Saisons mit Streichresultaten sagt die Rechnung nichts: Dort zählt nicht
 * jeder Punkt, und der Vorsprung in der Tabelle ist nicht der, um den es geht.
 */
export function titelKannFallen(stand) {
  if (!stand || stand.vorsaison || stand.streichresultate) return false
  const [erster, zweiter] = stand.fahrer
  if (!erster || !zweiter) return false
  return erster.punkte - zweiter.punkte + stand.maxDiesesRennen > stand.maxDanach
}

// ------------------------------------------------------------------- Das Feld

/** Wer im letzten gefahrenen Rennen am Start stand. */
export function feld(db, raceId) {
  return db
    .prepare(
      `SELECT rr.driver_id AS id, d.display_name AS name, d.abbreviation AS kuerzel,
              MIN(k.name) AS team, MIN(rr.display_order) AS reihenfolge
         FROM race_result rr
         JOIN driver d ON d.id = rr.driver_id
         JOIN constructor k ON k.id = rr.constructor_id
        WHERE rr.race_id = ? AND rr.started = 1
        GROUP BY rr.driver_id, d.display_name, d.abbreviation
        ORDER BY reihenfolge`,
    )
    .all(raceId)
}

// ----------------------------------------------------------------- Rekorde

/** Karrierezahlen für eine Handvoll Fahrer. */
function karriere(db, ids) {
  if (ids.length === 0) return new Map()
  const platzhalter = ids.map(() => '?').join(', ')
  const zeilen = db
    .prepare(
      `SELECT fahrer, ${ZAEHLUNGEN}
         FROM (${JE_RENNEN})
        WHERE fahrer IN (${platzhalter})
        GROUP BY fahrer`,
    )
    .all(...ids)
  return new Map(zeilen.map((z) => [z.fahrer, z]))
}

/** Die ewige Bestenliste einer Zählung, absteigend. */
function bestenliste(db, feldName, anzahl = 3) {
  return db
    .prepare(
      `SELECT x.fahrer AS id, d.display_name AS name, x.${feldName} AS anzahl
         FROM (SELECT fahrer, ${ZAEHLUNGEN} FROM (${JE_RENNEN}) GROUP BY fahrer) x
         JOIN driver d ON d.id = x.fahrer
        ORDER BY x.${feldName} DESC
        LIMIT ?`,
    )
    .all(anzahl)
}

/** Siege je Fahrer auf einer Strecke, die meisten zuerst. */
function siegeAufStrecke(db, streckeId) {
  return db
    .prepare(
      `SELECT fahrer AS id, COUNT(*) AS anzahl
         FROM (${JE_RENNEN})
        WHERE strecke = ? AND gewertet = 1 AND platz = 1
        GROUP BY fahrer
        ORDER BY anzahl DESC`,
    )
    .all(streckeId)
}

/**
 * Was bei diesem Rennen fallen oder erreicht werden kann.
 *
 * Die Auswahl ist bewusst eng: Nur was ein einzelnes Rennen tatsächlich
 * bewegen kann, steht darin. „Ihm fehlen 40 Siege zur Bestmarke“ ist keine
 * Marke in Reichweite, sondern eine Tabellenzeile.
 *
 * Drei Arten:
 *   marke       – eine runde Zahl in der Karriere, die dieses Rennen erreicht
 *   strecke     – die Bestmarke auf dieser Strecke, einzustellen oder zu brechen
 *   bestenliste – Gleichstand oder Führung in einer ewigen Wertung
 */
/**
 * Englische Ordnungszahl: 1st, 2nd, 3rd, 4th – und 11th, 12th, 13th.
 *
 * Im Deutschen genügte der Punkt hinter der Ziffer („sein 250. Grand Prix"),
 * im Englischen hängt die Endung an der Zahl selbst. Die Ausnahme der Zehner
 * elf bis dreizehn steht zuerst, sonst käme „111st" heraus.
 */
const ordnung = (n) => {
  const zehner = n % 100
  if (zehner >= 11 && zehner <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}

export function rekordeInReichweite(db, rennen, dasFeld) {
  const ids = dasFeld.map((f) => f.id)
  if (ids.length === 0) return []

  const zahlen = karriere(db, ids)
  const name = new Map(dasFeld.map((f) => [f.id, f.name]))
  const imFeld = new Set(ids)
  const treffer = []

  // ---- runde Zahlen in der Karriere
  const MARKEN = [
    { feld: 'starts', schritt: 50, wort: 'Grand Prix' },
    { feld: 'siege', schritt: 10, wort: 'win' },
    { feld: 'podien', schritt: 25, wort: 'podium' },
    { feld: 'poles', schritt: 10, wort: 'pole position' },
  ]
  for (const id of ids) {
    const k = zahlen.get(id)
    if (!k) continue
    for (const m of MARKEN) {
      const naechste = (k[m.feld] ?? 0) + 1
      if (naechste % m.schritt !== 0) continue
      treffer.push({
        art: 'marke',
        fahrer: id,
        name: name.get(id),
        // Ein Start kommt, sobald er losfährt. Ein Sieg muss er sich holen –
        // das trennt die Formulierung, sonst verspricht die Seite etwas.
        text:
          m.feld === 'starts'
            ? `It would be their ${ordnung(naechste)} ${m.wort}.`
            : `A success would be their ${ordnung(naechste)} ${m.wort}.`,
      })
    }
  }

  /** „1 Sieg", nicht „1 Siegen" – die Zahl bestimmt die Form. */
  const siegWort = (n) => (n === 1 ? '1 win' : `${n} wins`)

  // ---- Bestmarke auf dieser Strecke
  const aufStrecke = siegeAufStrecke(db, rennen.streckeId)
  const spitze = aufStrecke[0]?.anzahl ?? 0
  const gleichauf = aufStrecke.filter((x) => x.anzahl === spitze).length
  if (spitze > 0) {
    for (const z of aufStrecke) {
      if (!imFeld.has(z.id)) continue
      if (z.anzahl === spitze) {
        treffer.push({
          art: 'strecke',
          fahrer: z.id,
          name: name.get(z.id),
          text:
            gleichauf > 1
              ? `Shares the record here on ${siegWort(z.anzahl)} – one more would make it theirs alone.`
              : `Holds the record here on ${siegWort(z.anzahl)} and could extend it.`,
        })
      } else if (z.anzahl === spitze - 1) {
        treffer.push({
          art: 'strecke',
          fahrer: z.id,
          name: name.get(z.id),
          text: `On ${siegWort(z.anzahl)}, one behind the record of ${spitze} – a win would equal it.`,
        })
      }
    }
  }

  // ---- ewige Bestenlisten
  const LISTEN = [
    { feld: 'siege', wort: 'wins' },
    { feld: 'poles', wort: 'pole positions' },
    { feld: 'podien', wort: 'podiums' },
    { feld: 'schnellsteRunden', wort: 'fastest laps' },
  ]
  for (const l of LISTEN) {
    const liste = bestenliste(db, l.feld, 3)
    const best = liste[0]?.anzahl ?? 0
    if (best <= 1) continue
    const fuehrende = liste.filter((x) => x.anzahl === best)
    for (const id of ids) {
      const eigene = zahlen.get(id)?.[l.feld] ?? 0
      if (eigene === best) {
        // Führt er allein, bewegt ein weiterer Erfolg keine Bestmarke.
        if (fuehrende.length === 1) continue
        treffer.push({
          art: 'bestenliste',
          fahrer: id,
          name: name.get(id),
          text: `Shares the all-time record on ${eigene} ${l.wort} – one more, and it is theirs alone.`,
        })
      } else if (eigene === best - 1) {
        const halter = fuehrende.map((x) => x.name).join(', ')
        treffer.push({
          art: 'bestenliste',
          fahrer: id,
          name: name.get(id),
          text: `One short of the all-time record of ${best} ${l.wort} (${halter}).`,
        })
      }
    }
  }

  return treffer
}
