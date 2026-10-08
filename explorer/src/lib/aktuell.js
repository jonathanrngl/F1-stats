import { alle, db, eine } from './db.js'
import { naechstesRennen } from '../engine/vorschau.js'

/**
 * Der Stand nach dem jüngsten gefahrenen Rennen, für „Following“ auf der
 * Startseite.
 *
 * Wem jemand folgt, weiß nur der Browser – er merkt es sich, ein Konto gibt es
 * nicht. Die Seite liefert deshalb den Stand aller Fahrer und Teams der
 * laufenden Saison in einer kleinen Datei, und die Startseite sucht sich die
 * heraus, denen der Besucher folgt. Wer nicht in dieser Saison fährt, steht
 * nicht darin; für ihn liest die Startseite die Datei seiner Karriere aus der
 * API (/api/v1/drivers/<id>.json).
 *
 * Kompakt als Listen, wie heute.json:
 *
 *   fahrer: { id: [Name, Teamname, Teamkennung, WM-Platz, Punkte, Ergebnis im letzten Rennen] }
 *   teams:  { id: [Name, WM-Platz, Punkte, bestes Ergebnis im letzten Rennen] }
 *
 * Das Ergebnis ist der Text aus der Ergebnisliste („1“, „DNF“), damit ein
 * Ausfall als Ausfall dasteht und nicht als Lücke.
 */
export function aktuellerStand() {
  const letztes = eine(
    `SELECT r.id, r.year AS jahr, r.round AS runde, COALESCE(g.full_name, g.name || ' Grand Prix') AS name
       FROM race r
       JOIN grand_prix g ON g.id = r.grand_prix_id
      WHERE EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)
      ORDER BY r.year DESC, r.round DESC
      LIMIT 1`,
  )
  if (!letztes) return null

  const ergebnis = new Map(
    alle(
      `SELECT driver_id AS id, position_text AS text, constructor_id AS team, position
         FROM race_result WHERE race_id = ? ORDER BY display_order`,
      letztes.id,
    ).map((z) => [z.id, z]),
  )

  const fahrer = {}
  for (const s of alle(
    `SELECT s.driver_id AS id, d.display_name AS name, s.position, s.points AS punkte
       FROM race_driver_standing s JOIN driver d ON d.id = s.driver_id
      WHERE s.race_id = ? ORDER BY s.position`,
    letztes.id,
  )) {
    const e = ergebnis.get(s.id)
    // Das Team aus dem jüngsten Rennen dieser Saison – Fahrer wechseln mitten im Jahr.
    const team = eine(
      `SELECT k.id, k.name FROM race_result rr
         JOIN race r ON r.id = rr.race_id JOIN constructor k ON k.id = rr.constructor_id
        WHERE rr.driver_id = ? AND r.year = ? ORDER BY r.round DESC LIMIT 1`,
      s.id,
      letztes.jahr,
    )
    fahrer[s.id] = [s.name, team?.name ?? null, team?.id ?? null, s.position, s.punkte, e?.text ?? null]
  }

  const teams = {}
  for (const s of alle(
    `SELECT s.constructor_id AS id, k.name, s.position, s.points AS punkte
       FROM race_constructor_standing s JOIN constructor k ON k.id = s.constructor_id
      WHERE s.race_id = ? ORDER BY s.position`,
    letztes.id,
  )) {
    const bestes = [...ergebnis.values()]
      .filter((z) => z.team === s.id && z.position !== null)
      .sort((a, b) => a.position - b.position)[0]
    teams[s.id] = [s.name, s.position, s.punkte, bestes ? String(bestes.position) : null]
  }

  const n = naechstesRennen(db())
  return {
    jahr: letztes.jahr,
    letztes: { id: letztes.id, name: letztes.name, runde: letztes.runde },
    naechstes: n ? { id: n.id, name: `${n.grandPrixVoll ?? n.grandPrix} ${n.jahr}`, datum: n.datum } : null,
    fahrer,
    teams,
  }
}
