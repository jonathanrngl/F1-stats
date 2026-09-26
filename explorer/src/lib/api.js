/**
 * Hilfen für die JSON-API unter /api/v1/.
 *
 * Die Dateien entstehen beim Bauen aus denselben Modulen wie die Seiten –
 * lib/rennen.js, lib/saison.js, die Engine. Es gibt keinen zweiten Rechenweg,
 * der auseinanderlaufen könnte: Was auf der Seite steht, steht auch hier.
 */
import { herkunft } from './db.js'

/** Eine JSON-Antwort, mit der F1DB-Fassung, aus der sie entstand. */
export const json = (daten) =>
  new Response(JSON.stringify({ f1db: herkunft().version, ...daten }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
