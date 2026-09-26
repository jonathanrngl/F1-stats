import { rennenListe } from '../../../../lib/db.js'
import { rennDaten } from '../../../../lib/rennen.js'
import { json } from '../../../../lib/api.js'

export const getStaticPaths = () => rennenListe().map((r) => ({ params: { id: r.id } }))

/** Ein Rennen: Ergebnis, Qualifying, Startaufstellung, Sprint, Boxenstopps, schnellste Runden, Wertung danach. */
export function GET({ params }) {
  const d = rennDaten(params.id)
  return json({
    race: d.rennen,
    result: d.ergebnisse,
    qualifying: d.qualifying,
    grid: d.startaufstellung,
    sprint: d.sprint,
    pitStops: d.stopps,
    fastestLaps: d.schnellsteRunden,
    driverOfTheDay: d.fahrerDesTages,
    standingsAfter: { drivers: d.fahrerStand, constructors: d.teamStand },
  })
}
