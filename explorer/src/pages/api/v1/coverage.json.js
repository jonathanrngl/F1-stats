import { deckung } from '../../../lib/db.js'
import { json } from '../../../lib/api.js'

/**
 * Ab wann welche Kennzahl belegt ist. Wer eine Null in dieser API liest, kann
 * hier nachsehen, ob sie eine Aussage ist oder eine Lücke.
 */
export const GET = () => json({ coverage: deckung() })
