import { db } from '../../lib/db.js'
import { quizFragen } from '../../engine/quiz.js'

/**
 * Der Fragenvorrat des Quiz, beim Bauen erzeugt.
 *
 * Die Quizseite lädt ihn einmal und stellt jede Runde danach im Browser
 * zusammen – eine neue Runde kostet keine weitere Anfrage.
 */
export function GET() {
  return new Response(JSON.stringify(quizFragen(db())), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
