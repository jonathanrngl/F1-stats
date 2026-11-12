import { alle, eine, saisonListe } from '../lib/db.js'
import { fahrerProfil } from '../lib/profil.js'

/**
 * Die Balken des Meisterbands (Meisterband.astro, docs/DESIGN.md 8.4): je
 * Saison der Fahrermeister, das Team, für das er in dem Jahr die meisten
 * Rennen fuhr, und sein Anteil an den Punkten, die in den gefahrenen Rennen zu
 * holen waren – Rennen und Sprints.
 *
 * Gerechnet wird hier nichts Neues. Der Anteil ist dieselbe Größe wie im
 * Vergleich und im Explorer – `moeglich` aus lib/profil.js, je Start das
 * Höchste nach dem System der Zeit, doppelte und halbe Punkte eingerechnet.
 * Dort ist sie der einzige Punktevergleich über Epochen, der nicht an der Größe
 * der Zahlen hängt. Gezählt werden die Punkte vor der Streichung: 1988 hatte
 * Senna 65 % und Prost 73 %, Meister wurde Senna. Das Band zeigt das so, wie es
 * war.
 *
 * Die Startseite und jede der 77 Saisonseiten zeigen das Band. Gerechnet wird
 * es einmal je Bau – das Profil eines Fahrers kostet einige Millisekunden, und
 * 34 Meister mal 78 Seiten wären eine halbe Minute.
 */
let gespeichert = null

export function meisterbandDaten() {
  if (gespeichert) return gespeichert

  const teamNamen = new Map(alle('SELECT id, name FROM constructor').map((t) => [t.id, t.name]))
  /* Eine Saison läuft, solange eines ihrer Rennen noch kein Ergebnis hat. */
  const laufend = new Set(
    alle(
      `SELECT DISTINCT r.year AS jahr FROM race r
        WHERE NOT EXISTS (SELECT 1 FROM race_result x WHERE x.race_id = r.id)`,
    ).map((r) => r.jahr),
  )
  const profile = new Map()
  const profil = (id) => {
    if (!profile.has(id)) profile.set(id, fahrerProfil(id))
    return profile.get(id)
  }

  gespeichert = saisonListe()
    .slice()
    .reverse()
    .map((s) => {
      /* Noch ohne Meister: wer die Wertung anführt. Ohne Wertung (vor dem ersten Rennen) bleibt das Feld leer. */
      const fahrerId =
        s.meisterId ??
        eine(
          `SELECT driver_id AS id FROM season_driver_standing WHERE year = ? ORDER BY position LIMIT 1`,
          s.jahr,
        )?.id ??
        null
      const p = fahrerId ? profil(fahrerId) : null
      const j = p?.saisons.find((x) => x.jahr === s.jahr)
      if (!p || !j || !j.moeglich) return { jahr: s.jahr, leer: true, laufend: laufend.has(s.jahr) }

      const team = eine(
        `SELECT rr.constructor_id AS id FROM race_result rr JOIN race r ON r.id = rr.race_id
          WHERE rr.driver_id = ? AND r.year = ?
          GROUP BY rr.constructor_id ORDER BY COUNT(*) DESC LIMIT 1`,
        fahrerId,
        s.jahr,
      )?.id

      return {
        jahr: s.jahr,
        fahrerId,
        name: p.name,
        meister: Boolean(s.meisterId),
        teamId: team ?? null,
        team: team ? (teamNamen.get(team) ?? null) : null,
        punkte: j.punkte + j.sprintPunkte,
        moeglich: j.moeglich,
        starts: j.starts,
        anteil: (j.punkte + j.sprintPunkte) / j.moeglich,
        laufend: laufend.has(s.jahr),
      }
    })
  return gespeichert
}
