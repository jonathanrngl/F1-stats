import { rennenListe } from '../../../lib/db.js'
import { json } from '../../../lib/api.js'

/** Jedes Rennen seit 1950, auch die noch ausstehenden – dort ohne Sieger. */
export const GET = () => json({ races: rennenListe() })
