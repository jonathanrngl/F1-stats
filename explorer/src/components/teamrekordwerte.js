import { db } from '../lib/db.js'
import { teamRekorde } from '../engine/records.js'

/**
 * Die Allzeitrekorde der Teamzählungen, die die Kopfleiste einer Teamseite
 * zeigt: Konstrukteurstitel, Siege, Pole-Positionen. Wer einen davon hält
 * oder mit ihm gleichauf liegt, dessen Wert steht in Lila – der Farbe der
 * absoluten Bestmarke (docs/DESIGN.md 8.6).
 *
 * Aus denselben Bestenlisten wie die Rekordseite und das Quiz, einmal je Bau
 * (Muster: rekordwerte.js). Geprüft: Für alle 187 Teams zählen
 * calculateTeamWins, calculateTeamPoles und calculateTeamChampionships genau
 * dasselbe wie teamRekorde – Rennen mit einem Auto auf Platz eins, Rennen mit
 * einem Auto auf Startplatz eins aus der Qualifikation, gewonnene Wertungen.
 * Für Rennen, Doppelsiege und Podien liefert die Engine keine Bestenliste;
 * dort gibt es kein Lila.
 */
let gespeichert = null

export function teamrekordwerte() {
  gespeichert ??= {
    titel: teamRekorde(db(), 'titel', 1)[0]?.wert ?? null,
    siege: teamRekorde(db(), 'siege', 1)[0]?.wert ?? null,
    poles: teamRekorde(db(), 'poles', 1)[0]?.wert ?? null,
  }
  return gespeichert
}
