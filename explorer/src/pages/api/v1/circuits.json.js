import { streckenListe } from '../../../lib/db.js'
import { json } from '../../../lib/api.js'

/** Jede Strecke mit Rennen, samt Koordinaten. */
export const GET = () => json({ circuits: streckenListe() })
