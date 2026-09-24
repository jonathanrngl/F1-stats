/**
 * Die Punktesysteme der Weltmeisterschaft – als Daten, und gegen die Daten geprüft.
 *
 * Das Punktesystem hat sich seit 1950 achtmal geändert, das Sprintformat
 * zweimal, und bis 1990 zählte nur ein Teil der Ergebnisse. Wer das im Code
 * verstreut – „ein Sieg zu 25“ hier, „die besten elf“ dort –, rechnet 1988 mit
 * den Regeln von 2024 und merkt es nicht. Deshalb steht es an einer Stelle.
 *
 * Geprüft ist es in beide Richtungen (scripts/test-engine.mjs, Abschnitt 12):
 *
 *   – Die Tabelle rechnet 27.547 von 27.599 Ergebniszeilen auf den Punkt genau
 *     nach. Die übrigen 52 sind echte Einzelentscheidungen der Geschichte:
 *     geteilte schnellste Runden, Formel-2-Wagen ohne Punkteberechtigung,
 *     aberkannte Punkte. Sie stehen in den Daten, nicht in einer Regel.
 *   – Die Streichresultate reproduzieren den amtlichen WM-Stand jedes Fahrers
 *     in allen 41 Saisons von 1950 bis 1990.
 */

/*
 * Rennpunkte je Platz. `schnellsteRunde` ist der Bonuspunkt; bis 1959 gab es
 * ihn für jeden, auch für einen Ausfall, 2019–2024 nur unter den ersten zehn.
 */
export const PUNKTESYSTEME = [
  {
    id: '1950', von: 1950, bis: 1959, name: '1950–1959',
    rennen: [8, 6, 4, 3, 2], schnellsteRunde: 1,
    beschreibung: '8-6-4-3-2 for the top five, plus one for the fastest lap.',
  },
  {
    id: '1960', von: 1960, bis: 1960, name: '1960',
    rennen: [8, 6, 4, 3, 2, 1],
    beschreibung: '8-6-4-3-2-1 for the top six.',
  },
  {
    id: '1961', von: 1961, bis: 1990, name: '1961–1990',
    rennen: [9, 6, 4, 3, 2, 1],
    beschreibung: '9-6-4-3-2-1 for the top six.',
  },
  {
    id: '1991', von: 1991, bis: 2002, name: '1991–2002',
    rennen: [10, 6, 4, 3, 2, 1],
    beschreibung: '10-6-4-3-2-1 for the top six.',
  },
  {
    id: '2003', von: 2003, bis: 2009, name: '2003–2009',
    rennen: [10, 8, 6, 5, 4, 3, 2, 1],
    beschreibung: '10-8-6-5-4-3-2-1 for the top eight.',
  },
  {
    id: '2010', von: 2010, bis: 2018, name: '2010–2018',
    rennen: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    beschreibung: '25-18-15-12-10-8-6-4-2-1 for the top ten.',
  },
  {
    id: '2019', von: 2019, bis: 2024, name: '2019–2024',
    rennen: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], schnellsteRunde: 1, schnellsteRundeBis: 10,
    beschreibung: '25-18-15-12-10-8-6-4-2-1, plus one for the fastest lap inside the top ten.',
  },
  {
    id: '2025', von: 2025, bis: null, name: 'Since 2025',
    rennen: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    beschreibung: '25-18-15-12-10-8-6-4-2-1 for the top ten, no fastest-lap point.',
  },
]

/** Sprintpunkte je Platz, seit es Sprints gibt. */
export const SPRINTSYSTEME = [
  { von: 2021, bis: 2021, sprint: [3, 2, 1] },
  { von: 2022, bis: null, sprint: [8, 7, 6, 5, 4, 3, 2, 1] },
]

/*
 * Streichresultate: wie viele Ergebnisse zur Meisterschaft zählten.
 *
 * Eine Zahl heißt „die besten N der Saison“. Ein Paar teilt die Saison: von den
 * ersten `rennen` Läufen zählten die besten `beste`, vom Rest die besten des
 * zweiten Eintrags. So lief es 1967 bis 1980.
 *
 * Ohne Eintrag zählte alles. Dass die Liste stimmt, zeigt nicht ihre Herkunft,
 * sondern die Prüfung: Mit ihr ergibt sich der amtliche Stand jedes Fahrers.
 */
export const STREICHRESULTATE = {
  1950: 4, 1951: 4, 1952: 4, 1953: 4, 1954: 5, 1955: 5, 1956: 5, 1957: 5, 1958: 6, 1959: 5,
  1960: 6, 1961: 5, 1962: 5, 1963: 6, 1964: 6, 1965: 6, 1966: 5,
  1967: [{ rennen: 6, beste: 5 }, { beste: 4 }],
  1968: [{ rennen: 6, beste: 5 }, { beste: 5 }],
  1969: [{ rennen: 6, beste: 5 }, { beste: 4 }],
  1970: [{ rennen: 7, beste: 6 }, { beste: 5 }],
  1971: [{ rennen: 6, beste: 5 }, { beste: 4 }],
  1972: [{ rennen: 6, beste: 5 }, { beste: 5 }],
  1973: [{ rennen: 8, beste: 7 }, { beste: 6 }],
  1974: [{ rennen: 8, beste: 7 }, { beste: 6 }],
  1975: [{ rennen: 7, beste: 6 }, { beste: 6 }],
  1976: [{ rennen: 8, beste: 7 }, { beste: 7 }],
  1977: [{ rennen: 9, beste: 8 }, { beste: 7 }],
  1978: [{ rennen: 8, beste: 7 }, { beste: 7 }],
  1979: [{ rennen: 7, beste: 4 }, { beste: 4 }],
  1980: [{ rennen: 7, beste: 5 }, { beste: 5 }],
  1981: 11, 1982: 11, 1983: 11, 1984: 11, 1985: 11, 1986: 11, 1987: 11, 1988: 11, 1989: 11, 1990: 11,
}

// ------------------------------------------------------------- Nachschlagen

const gilt = (s, jahr) => jahr >= s.von && (s.bis === null || jahr <= s.bis)

/** Das Punktesystem eines Jahres. Für künftige Jahre das jüngste. */
export const systemFuer = (jahr) => PUNKTESYSTEME.find((s) => gilt(s, jahr)) ?? PUNKTESYSTEME.at(-1)

export const systemNachId = (id) => PUNKTESYSTEME.find((s) => s.id === id) ?? null

/** Sprintpunkte eines Jahres, oder null vor 2021. */
export const sprintFuer = (jahr) => SPRINTSYSTEME.find((s) => gilt(s, jahr))?.sprint ?? null

/** Die Streichregel eines Jahres, oder null, wenn alles zählte. */
export const streichregel = (jahr) => STREICHRESULTATE[jahr] ?? null

/**
 * Das Meiste, was ein einzelner Fahrer an einem Wochenende holen kann: Sieg,
 * dazu der Bonus für die schnellste Runde, wo es ihn gab, und der Sprintsieg.
 *
 * Doppelte Punkte (Abu Dhabi 2014) sind nicht darin – sie standen vorher fest,
 * sind aber kein Teil des Systems, sondern eine Entscheidung für ein Rennen.
 */
export function maxRennpunkte(jahr) {
  const s = systemFuer(jahr)
  return s.rennen[0] + (s.schnellsteRunde ?? 0)
}

export const maxSprintpunkte = (jahr) => sprintFuer(jahr)?.[0] ?? 0

// -------------------------------------------------------------- Anwenden

const summeDerBesten = (werte, n) =>
  [...werte].sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0)

/**
 * Streichresultate auf die Punkte einer Saison anwenden.
 *
 * @param {number[]} jeRennen Punkte je Rennen in Kalenderreihenfolge, 0 für
 *   Rennen ohne Punkte oder ohne Teilnahme – die Stellung im Kalender zählt,
 *   denn die geteilten Saisons trennten nach Rennen, nicht nach Ergebnissen.
 * @param {number | {rennen?: number, beste: number}[] | null} regel
 */
export function streiche(jeRennen, regel) {
  if (regel === null || regel === undefined) return jeRennen.reduce((a, b) => a + b, 0)
  if (typeof regel === 'number') return summeDerBesten(jeRennen, regel)
  const [erste, zweite] = regel
  return (
    summeDerBesten(jeRennen.slice(0, erste.rennen), erste.beste) +
    summeDerBesten(jeRennen.slice(erste.rennen), zweite.beste)
  )
}

/**
 * Halbe und doppelte Punkte, aus den Daten erkannt.
 *
 * Abgebrochene Rennen wurden halb gewertet (Spanien 1975, Monaco 1984,
 * Belgien 2021 …), Abu Dhabi 2014 doppelt. Eine gepflegte Liste davon würde
 * beim nächsten Abbruch veralten; die Punkte des Siegers sagen es von selbst.
 * Gerundet wird auf den nächsten der drei möglichen Faktoren, weil geteilte
 * schnellste Runden in den 1950ern krumme Siegerpunkte ergeben (8,5 bei 8).
 *
 * @returns {Map<string, number>} Rennen → Faktor, nur für Rennen ungleich 1
 */
export function rennFaktoren(db) {
  const zeilen = db
    .prepare(
      `SELECT r.id, r.year AS jahr, rr.points AS punkte, rr.fastest_lap AS schnellste
         FROM race r
         JOIN race_result rr ON rr.race_id = r.id AND rr.position = 1 AND rr.shared_car = 0`,
    )
    .all()
  const faktoren = new Map()
  for (const z of zeilen) {
    const s = systemFuer(z.jahr)
    const ohneBonus = z.punkte - (s.schnellsteRunde && z.schnellste ? s.schnellsteRunde : 0)
    const roh = ohneBonus / s.rennen[0]
    const f = [0.5, 1, 2].reduce((a, b) => (Math.abs(b - roh) < Math.abs(a - roh) ? b : a))
    if (f !== 1) faktoren.set(z.id, f)
  }
  return faktoren
}

/**
 * Die Rennpunkte einer Ergebniszeile nach einem Punktesystem.
 *
 * @param {object} z Zeile mit position, classified, schnellste (0/1)
 * @param {object} system aus PUNKTESYSTEME
 * @param {{ faktor?: number, teiler?: number, schnellsteTeiler?: number }} [umstaende]
 *   teiler: wie viele Fahrer sich diesen Platz teilten (geteiltes Auto),
 *   schnellsteTeiler: wie viele sich die schnellste Runde teilten
 */
export function punkteFuer(z, system, umstaende = {}) {
  const { faktor = 1, teiler = 1, schnellsteTeiler = 1 } = umstaende
  let p = 0
  if (z.classified && z.position !== null && z.position <= system.rennen.length) {
    p += (system.rennen[z.position - 1] * faktor) / teiler
  }
  const bonusBerechtigt =
    system.schnellsteRunde &&
    z.schnellste &&
    (!system.schnellsteRundeBis || (z.classified && z.position !== null && z.position <= system.schnellsteRundeBis))
  if (bonusBerechtigt) p += system.schnellsteRunde / schnellsteTeiler
  return p
}
