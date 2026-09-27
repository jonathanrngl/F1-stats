import { tageskalender } from '../../lib/heute.js'

/**
 * Der Kalender für „On this day" auf der Startseite (lib/heute.js). Geladen
 * erst, wenn die Startseite steht – er ist das Einzige dort, das den Tag des
 * Besuchers kennen muss.
 */
export function GET() {
  return new Response(JSON.stringify(tageskalender()), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
