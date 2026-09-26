import { saisonListe } from '../../../lib/db.js'
import { json } from '../../../lib/api.js'

/** Jede Saison mit Zahl der Rennen und den beiden Meistern. */
export const GET = () => json({ seasons: saisonListe() })
