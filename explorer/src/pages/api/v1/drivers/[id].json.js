import { fahrerIndex, fahrerProfil, teamkollegen } from '../../../../lib/profil.js'

export function getStaticPaths() {
  return fahrerIndex().map((f) => ({ params: { id: f.id } }))
}

/**
 * Das vollständige Profil eines Fahrers, mit Summen je Saison.
 *
 * Diese Dateien sind die API: statisch, cachebar, von jedem Client nutzbar.
 * Der Vergleich im Browser lädt zwei davon und rechnet daraus jeden Zeitraum.
 */
export function GET({ params }) {
  const profil = fahrerProfil(params.id)
  if (!profil) return new Response('Not found', { status: 404 })
  return new Response(JSON.stringify({ ...profil, teamkollegen: teamkollegen(params.id) }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
