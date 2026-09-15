import { wuerfel } from '../../lib/wuerfel.js'

/**
 * Der Datenwürfel für den Explorer. Eine Datei, beim Bauen erzeugt – der
 * Explorer lädt sie einmal und filtert danach ohne jede weitere Anfrage.
 */
export function GET() {
  return new Response(JSON.stringify(wuerfel()), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
