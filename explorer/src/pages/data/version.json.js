import { herkunft } from '../../lib/db.js'

/**
 * Aus welchen Daten diese Fassung der Seite entstand.
 *
 * Für Menschen steht dasselbe im Fuß jeder Seite. Diese Datei ist für
 * Maschinen: Wer die JSON-API nutzt, kann hier nachsehen, ob sich seit dem
 * letzten Abruf etwas geändert hat, ohne alles neu zu laden.
 */
export function GET() {
  const { version, pruefsumme, stand } = herkunft()
  return new Response(
    JSON.stringify({
      f1db: version,
      sha256: pruefsumme,
      lizenz: 'CC BY 4.0',
      stand: stand && { rennen: stand.id, jahr: stand.jahr, runde: stand.runde, datum: stand.datum },
    }),
    { headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
}
