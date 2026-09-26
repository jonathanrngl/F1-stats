import { db, eine, streckenListe } from '../../../../lib/db.js'
import { json } from '../../../../lib/api.js'
import {
  circuitLapRecords, circuitLayouts, circuitLeaders, circuitRaces, circuitTeamLeaders,
} from '../../../../engine/circuit.js'

export const getStaticPaths = () => streckenListe().map((z) => ({ params: { id: z.id } }))

/** Eine Strecke: Stammdaten, Layouts mit Rundenrekord, Bestenlisten, alle Rennen. */
export function GET({ params }) {
  const rekorde = new Map(circuitLapRecords(db(), params.id).map((r) => [r.layout, r]))
  return json({
    circuit: eine('SELECT * FROM circuit WHERE id = ?', params.id),
    layouts: circuitLayouts(db(), params.id).map((l) => ({ ...l, lapRecord: rekorde.get(l.id) ?? null })),
    mostWins: circuitLeaders(db(), params.id, 'siege'),
    mostPoles: circuitLeaders(db(), params.id, 'poles'),
    mostSuccessfulTeams: circuitTeamLeaders(db(), params.id),
    races: circuitRaces(db(), params.id),
  })
}
