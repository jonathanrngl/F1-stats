import { db, saisonListe } from '../../../lib/db.js'
import { rohdatenDerSaison } from '../../../engine/whatif.js'

export function getStaticPaths() {
  return saisonListe().map((s) => ({ params: { jahr: String(s.jahr) } }))
}

/**
 * Die Rohzeilen einer Saison für das selbst gebaute Punktesystem.
 *
 * Die eingebauten Systeme rechnet die Saisonseite beim Bauen vor. Ein eigenes
 * kennt der Bau nicht – es entsteht erst im Browser. Dorthin geht deshalb
 * dasselbe, womit der Bau rechnet, und nichts davon fertig gerechnet. Geladen
 * erst, wenn jemand ein eigenes System anwendet.
 */
export function GET({ params }) {
  const r = rohdatenDerSaison(db(), Number(params.jahr))
  const body = {
    ...r,
    sprintPunkte: Object.fromEntries(r.sprintPunkte),
    faktoren: Object.fromEntries(r.faktoren),
  }
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
