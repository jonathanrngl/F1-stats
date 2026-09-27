import { db, eine, herkunft } from '../lib/db.js'
import { ics, kalenderEintraege } from '../lib/kalender.js'

/**
 * /calendar.ics – jede Session der laufenden Saison, zum Laden oder Abonnieren.
 * Die Rechnung steht in lib/kalender.js und wird dort auch geprüft.
 */
const SEITE = 'https://jonathanrngl.github.io'
const BASIS = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

export function GET() {
  const jahr = eine('SELECT MAX(year) AS jahr FROM race').jahr
  const { stand } = herkunft()
  const inhalt = ics(kalenderEintraege(db(), jahr), {
    name: `Formula 1 ${jahr}`,
    stand: stand?.datum ?? `${jahr}-01-01`,
    url: (id) => `${SEITE}${BASIS}/races/${id}/`,
  })
  return new Response(inhalt, { headers: { 'content-type': 'text/calendar; charset=utf-8' } })
}
