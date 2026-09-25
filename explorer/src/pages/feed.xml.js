import { db, herkunft, rennenListe } from '../lib/db.js'
import { beschreibeAenderung, datenstand, juengsteAenderungen, rekordVerlaeufe } from '../engine/aenderungen.js'

/**
 * Ein Atom-Feed: neue Rennergebnisse und jede Bewegung einer Bestmarke.
 *
 * Die Seite wird nach jedem Rennwochenende neu gebaut; wer das mitbekommen
 * will, musste bisher nachsehen. Ein Feedreader tut das von selbst – und
 * liest dieselben Sätze wie die Seite „Changes“, aus derselben Rechnung.
 *
 * Jeder Eintrag hat eine feste Kennung aus Rennen und Art. Ein Neubau mit
 * denselben Daten erzeugt deshalb denselben Feed, und kein Reader meldet ein
 * altes Ereignis zweimal.
 */
const SEITE = 'https://jonathanrngl.github.io'
const BASIS = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const url = (weg) => `${SEITE}${BASIS}${weg}`

/** Für XML: die fünf Zeichen, die dort etwas bedeuten. */
const x = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

export function GET() {
  const d = db()
  const stand = datenstand(d)
  const { version } = herkunft()

  /* Rekordbewegungen der letzten fünf Jahre – mehr liest in einem Feed niemand. */
  const { einzeln } = stand
    ? juengsteAenderungen(rekordVerlaeufe(d), { seit: `${stand.jahr - 5}-01-01` })
    : { einzeln: [] }

  const marken = einzeln.slice(0, 30).map((e) => ({
    id: `tag:jonathanrngl.github.io,2026:marke/${e.kategorie.id}/${e.rennen}/${e.art}`,
    titel: `${e.kategorie.titel}: ${beschreibeAenderung(e)}`,
    link: url(`/races/${e.rennen}/`),
    datum: e.datum,
    text: `${beschreibeAenderung(e)} ${e.grandPrix} ${e.jahr}.`,
  }))

  /* Die jüngsten Rennen mit Ergebnis. */
  const rennen = rennenListe()
    .filter((r) => r.siegerId)
    .sort((a, b) => (a.datum < b.datum ? 1 : -1))
    .slice(0, 15)
    .map((r) => ({
      id: `tag:jonathanrngl.github.io,2026:rennen/${r.id}`,
      titel: `${r.nameVoll} ${r.jahr}: won by ${r.sieger}`,
      link: url(`/races/${r.id}/`),
      datum: r.datum,
      text: `Round ${r.runde} of the ${r.jahr} season at ${r.strecke}, won by ${r.sieger}.`,
    }))

  const eintraege = [...marken, ...rennen].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0))
  const zuletzt = eintraege[0]?.datum ?? '2026-01-01'

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Formula 1 Statistics – results and record changes</title>
  <subtitle>${x(`New race results and every movement of an all-time mark, from F1DB ${version ?? ''}.`)}</subtitle>
  <id>${x(url('/'))}</id>
  <link rel="self" href="${x(url('/feed.xml'))}"/>
  <link rel="alternate" href="${x(url('/changes/'))}"/>
  <updated>${zuletzt}T00:00:00Z</updated>
  <author><name>Formula 1 Statistics</name></author>
  <rights>Data from F1DB, CC BY 4.0</rights>
${eintraege
  .map(
    (e) => `  <entry>
    <id>${x(e.id)}</id>
    <title>${x(e.titel)}</title>
    <link rel="alternate" href="${x(e.link)}"/>
    <updated>${e.datum}T00:00:00Z</updated>
    <summary>${x(e.text)}</summary>
  </entry>`,
  )
  .join('\n')}
</feed>
`
  return new Response(xml, { headers: { 'content-type': 'application/atom+xml; charset=utf-8' } })
}
