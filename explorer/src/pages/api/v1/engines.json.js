import { db } from '../../../lib/db.js'
import { json } from '../../../lib/api.js'
import { motorenListe } from '../../../engine/motor.js'

/** Jeder Motorenhersteller mit Rennen, Siegen, Podien und Titeln. */
export const GET = () => json({ engines: motorenListe(db()) })
