import { db } from '../../../lib/db.js'
import { json } from '../../../lib/api.js'
import {
  altersrekord, altersrekordMeister, grandSlams, laengsteSerien, meistePodien, meistePoles, meistePunkte,
  meisteSchnellsteRunden, meisteSiege, meisteStarts, meisteTitel, teamRekorde, zielabstand,
} from '../../../engine/records.js'

/** Die Rekordlisten der Seite /records/, je die ersten 20. */
export function GET() {
  const d = db()
  const N = 20
  return json({
    wins: meisteSiege(d, N),
    podiums: meistePodien(d, N),
    poles: meistePoles(d, N),
    starts: meisteStarts(d, N),
    fastestLaps: meisteSchnellsteRunden(d, N),
    titles: meisteTitel(d, N),
    points: meistePunkte(d, N),
    grandSlams: grandSlams(d, N),
    streaks: {
      wins: laengsteSerien(d, 'siege', N),
      podiums: laengsteSerien(d, 'podien', N),
      points: laengsteSerien(d, 'punkte', N),
    },
    age: {
      youngestWinners: altersrekord(d, 'sieg', 'jung', N),
      oldestWinners: altersrekord(d, 'sieg', 'alt', N),
      youngestChampions: altersrekordMeister(d, 'jung', N),
      oldestChampions: altersrekordMeister(d, 'alt', N),
    },
    margins: { closest: zielabstand(d, 'knapp', N), biggest: zielabstand(d, 'weit', N) },
    teams: { wins: teamRekorde(d, 'siege', N), titles: teamRekorde(d, 'titel', N) },
  })
}
