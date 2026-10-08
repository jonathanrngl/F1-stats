import { aktuellerStand } from '../../lib/aktuell.js'

/**
 * Der Stand der laufenden Saison für „Following“ auf der Startseite
 * (lib/aktuell.js). Geladen nur, wenn der Besucher jemandem folgt.
 */
export function GET() {
  return new Response(JSON.stringify(aktuellerStand()), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
