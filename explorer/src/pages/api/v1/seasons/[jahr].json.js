import { saisonListe } from '../../../../lib/db.js'
import { saisonDaten } from '../../../../lib/saison.js'
import { json } from '../../../../lib/api.js'

export const getStaticPaths = () => saisonListe().map((s) => ({ params: { jahr: String(s.jahr) } }))

/** Eine Saison: Wertungen, Kalender, Ergebnismatrix, Nennliste, Punktesystem. */
export function GET({ params }) {
  const d = saisonDaten(Number(params.jahr))
  return json({
    year: Number(params.jahr),
    races: d.saison.rennen,
    droppedScores: d.saison.dropped_scores === 1,
    pointsSystem: {
      race: d.punkte.system.rennen,
      fastestLap: d.punkte.system.schnellsteRunde ?? null,
      sprint: d.punkte.sprint,
      dropped: d.punkte.regelText,
    },
    drivers: d.fahrerWertung,
    constructors: d.teamWertung,
    calendar: d.kalender,
    results: [...d.zellen.values()],
    entries: d.nennungen.map(({ fahrerIds: _ids, ...n }) => n),
  })
}
