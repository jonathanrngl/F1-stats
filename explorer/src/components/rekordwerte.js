import { db } from '../lib/db.js'
import {
  meisteSchnellsteRunden, meistePodien, meistePoles, meisteSiege, meisteStarts, meisteTitel,
} from '../engine/records.js'

/**
 * Die Allzeitrekorde der Zählungen, die die Kopfleiste einer Fahrerseite
 * zeigt. Wer einen davon hält oder mit ihm gleichauf liegt, dessen Wert steht
 * in Lila – der Farbe der absoluten Bestmarke (docs/DESIGN.md 5.1).
 *
 * Aus denselben Bestenlisten wie die Rekordseite, einmal je Bau: Auf 862
 * Fahrerseiten je sechs Gruppierungen über alle Ergebnisse kosteten sonst über
 * eine Minute.
 */
let gespeichert = null

export function rekordwerte() {
  gespeichert ??= {
    starts: meisteStarts(db(), 1)[0]?.wert ?? null,
    siege: meisteSiege(db(), 1)[0]?.wert ?? null,
    podien: meistePodien(db(), 1)[0]?.wert ?? null,
    poles: meistePoles(db(), 1)[0]?.wert ?? null,
    schnellste: meisteSchnellsteRunden(db(), 1)[0]?.wert ?? null,
    titel: meisteTitel(db(), 1)[0]?.wert ?? null,
  }
  return gespeichert
}
