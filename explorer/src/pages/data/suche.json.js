import { suchindex } from '../../lib/suchindex.js'

/**
 * Der Suchindex als eine Datei, beim Bauen erzeugt.
 *
 * Die Suche in der Kopfleiste lädt ihn beim ersten Tastendruck und filtert
 * danach im Browser – ohne weitere Anfrage, weil die ganze Liste dann da ist.
 */
export function GET() {
  return new Response(JSON.stringify(suchindex()), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
