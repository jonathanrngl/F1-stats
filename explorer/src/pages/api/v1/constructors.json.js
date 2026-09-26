import { teamListe } from '../../../lib/db.js'
import { json } from '../../../lib/api.js'

/** Jeder Konstrukteur mit mindestens einem Rennen. */
export const GET = () => json({ constructors: teamListe() })
