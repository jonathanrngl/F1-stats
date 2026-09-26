import { db, eine, teamListe } from '../../../../lib/db.js'
import { json } from '../../../../lib/api.js'
import {
  calculateLineage, calculateTeamChampionships, calculateTeamDrivers, calculateTeamStarts, calculateTeamWins,
  constructorRaces,
} from '../../../../engine/constructor.js'

export const getStaticPaths = () => teamListe().map((t) => ({ params: { id: t.id } }))

/** Ein Konstrukteur: Summen, Saisons, Fahrer und die Linie seiner Namen. */
export function GET({ params }) {
  const rennen = constructorRaces(db(), params.id)
  const titel = calculateTeamChampionships(db(), params.id)
  return json({
    id: params.id,
    name: eine('SELECT name FROM constructor WHERE id = ?', params.id)?.name,
    races: calculateTeamStarts(rennen).value,
    wins: calculateTeamWins(rennen).value,
    titles: titel.titles.value,
    seasons: titel.seasons,
    drivers: calculateTeamDrivers(db(), params.id),
    lineage: calculateLineage(db(), params.id),
  })
}
