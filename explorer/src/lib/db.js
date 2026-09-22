import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Zugriff auf die importierte Datenbank – nur zur Build-Zeit.
 *
 * Die Seiten werden vorgerendert, also läuft diese Datei nie im Browser. Was
 * der Browser braucht, reicht Astro als fertige Daten an die Komponenten
 * weiter; der Explorer bekommt später einen eigenen, kompakten Datensatz.
 */

/*
 * Der Pfad hängt am Projektverzeichnis, nicht am Modul: Beim Bauen bündelt
 * Astro diese Datei nach dist/.prerender/chunks/, und ein relativ zu
 * import.meta.url berechneter Pfad zeigte dann auf dist/data/f1.sqlite.
 */
const PFAD = process.env.F1_DB ?? path.join(process.cwd(), 'data', 'f1.sqlite')

let verbindung = null

export function db() {
  if (verbindung) return verbindung
  if (!fs.existsSync(PFAD)) {
    throw new Error(
      `The database is missing (${path.relative(process.cwd(), PFAD)}).\n` +
        'Import it first:  npm run import',
    )
  }
  verbindung = new DatabaseSync(PFAD, { readOnly: true })
  return verbindung
}

/** Abfrage mit allen Zeilen. */
export const alle = (sql, ...p) => db().prepare(sql).all(...p)
/** Abfrage mit der ersten Zeile, oder undefined. */
export const eine = (sql, ...p) => db().prepare(sql).get(...p)

// ------------------------------------------------------------------ Deckung

/**
 * Ab wann eine Kennzahl belegt ist. Seiten fragen das, bevor sie eine Null
 * anzeigen – sonst wird aus einer Datenlücke eine Aussage.
 */
export function deckung() {
  const zeilen = alle('SELECT metric, first_year, last_year, completeness, source, note FROM coverage')
  return Object.fromEntries(
    zeilen.map((z) => [
      z.metric,
      { firstYear: z.first_year, lastYear: z.last_year, completeness: z.completeness, source: z.source, note: z.note },
    ]),
  )
}

// ------------------------------------------------------------------ Adressen

/** Aus einem Namen ein Adresssegment machen – nur als Rückfall, wenn keine Kennung vorliegt. */
export const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/*
 * Der Vorsatz, unter dem die Seite liegt. Auf GitHub Pages ist das
 * "/F1-stats/", beim Entwickeln schlicht "/". Ohne ihn zeigte jeder Verweis
 * an das Repo-Verzeichnis vorbei auf die Wurzel der Domain. Der Rückfall auf
 * "/" greift, falls diese Datei einmal außerhalb von Astro geladen wird.
 */
const BASIS = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '')

export const pfad = {
  fahrer: (id) => `${BASIS}/drivers/${id}/`,
  team: (id) => `${BASIS}/teams/${id}/`,
  saison: (jahr) => `${BASIS}/seasons/${jahr}/`,
  rennen: (id) => `${BASIS}/races/${id}/`,
  strecke: (id) => `${BASIS}/circuits/${id}/`,
  /** Für Verweise, die nicht auf einen Datensatz zeigen: Übersichten, Startseite. */
  seite: (weg = '/') => `${BASIS}${weg}`,
}

// ------------------------------------------------------------------ Listen

/** Alle Fahrer mit den Eckdaten für Übersicht und Suche. */
export function fahrerListe() {
  return alle(`
    SELECT d.id, d.display_name AS name, d.first_name AS vorname, d.last_name AS nachname,
           d.abbreviation AS kuerzel, d.date_of_birth AS geboren, d.date_of_death AS gestorben,
           c.ioc AS land, c.name AS landName,
           d.f1db_race_starts AS starts, d.f1db_race_wins AS siege,
           d.f1db_podiums AS podien, d.f1db_championship_wins AS titel,
           MIN(r.year) AS von, MAX(r.year) AS bis
      FROM driver d
      LEFT JOIN country c ON c.id = d.nationality_id
      LEFT JOIN race_result rr ON rr.driver_id = d.id
      LEFT JOIN race r ON r.id = rr.race_id
     GROUP BY d.id
     HAVING von IS NOT NULL
     ORDER BY d.last_name, d.first_name`)
}

export function teamListe() {
  return alle(`
    SELECT k.id, k.name, k.full_name AS vollerName, c.ioc AS land, c.name AS landName,
           k.f1db_race_starts AS starts, k.f1db_race_wins AS siege,
           k.f1db_championship_wins AS titel, k.f1db_one_twos AS doppelsiege,
           MIN(r.year) AS von, MAX(r.year) AS bis
      FROM constructor k
      LEFT JOIN country c ON c.id = k.nationality_id
      LEFT JOIN race_result rr ON rr.constructor_id = k.id
      LEFT JOIN race r ON r.id = rr.race_id
     GROUP BY k.id
     HAVING von IS NOT NULL
     ORDER BY k.name`)
}

export function saisonListe() {
  return alle(`
    SELECT s.year AS jahr, s.race_count AS rennen, s.dropped_scores AS streichresultate,
           s.has_constructors_championship AS mitTeamWM,
           (SELECT d.display_name FROM season_driver_standing sds
              JOIN driver d ON d.id = sds.driver_id
             WHERE sds.year = s.year AND sds.championship_won = 1 LIMIT 1) AS meister,
           (SELECT sds.driver_id FROM season_driver_standing sds
             WHERE sds.year = s.year AND sds.championship_won = 1 LIMIT 1) AS meisterId,
           (SELECT k.name FROM season_constructor_standing scs
              JOIN constructor k ON k.id = scs.constructor_id
             WHERE scs.year = s.year AND scs.championship_won = 1 LIMIT 1) AS teamMeister
      FROM season s
     ORDER BY s.year DESC`)
}

export function streckenListe() {
  return alle(`
    SELECT z.id, z.name, z.full_name AS vollerName, z.place_name AS ort,
           c.ioc AS land, c.name AS landName, z.length_km AS laenge, z.turns AS kurven,
           COUNT(r.id) AS rennen, MIN(r.year) AS von, MAX(r.year) AS bis
      FROM circuit z
      LEFT JOIN race r ON r.circuit_id = z.id
      LEFT JOIN country c ON c.id = z.country_id
     GROUP BY z.id
     HAVING rennen > 0
     ORDER BY rennen DESC, z.name`)
}

export function rennenListe(jahr) {
  return alle(
    `SELECT r.id, r.year AS jahr, r.round AS runde, g.name AS name, r.date AS datum,
            r.circuit_id AS streckeId, z.name AS strecke, c.ioc AS land,
            r.drivers_title_decider AS titelentscheidung,
            (SELECT d.display_name FROM race_result rr JOIN driver d ON d.id = rr.driver_id
              WHERE rr.race_id = r.id AND rr.position = 1 LIMIT 1) AS sieger,
            (SELECT rr.driver_id FROM race_result rr
              WHERE rr.race_id = r.id AND rr.position = 1 LIMIT 1) AS siegerId
       FROM race r
       JOIN grand_prix g ON g.id = r.grand_prix_id
       JOIN circuit z ON z.id = r.circuit_id
       LEFT JOIN country c ON c.id = z.country_id
      ${jahr ? 'WHERE r.year = ?' : ''}
      ORDER BY r.year DESC, r.round`,
    ...(jahr ? [jahr] : []),
  )
}
