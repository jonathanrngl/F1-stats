import { fahrerIndex } from '../../../lib/profil.js'

/** Schlanker Suchindex aller Fahrer. Eine Datei, beim Bauen erzeugt. */
export function GET() {
  return new Response(JSON.stringify(fahrerIndex()), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
