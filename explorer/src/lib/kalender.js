/**
 * Der Rennkalender als iCalendar-Datei (RFC 5545).
 *
 * Die Vorschau zeigt die Startzeiten jedes Wochenendes schon in der Ortszeit
 * des Besuchers. Wer sie im eigenen Kalender haben wollte, musste sie
 * abschreiben. Diese Datei trägt jede Session der laufenden Saison: einmal
 * geladen oder – über webcal:// – abonniert, dann zieht der Kalender nach
 * jedem Neubau von selbst nach.
 *
 * Nichts hängt am Tag des Bauens: Der Zeitstempel jedes Eintrags ist der
 * Datenstand, nicht die Uhr. Derselbe Commit ergibt dieselbe Datei, und ein
 * abonnierender Kalender meldet keine Änderung, wo keine ist.
 */

/*
 * Wie lange eine Session dauert, steht nicht in den Daten – nur, wann sie
 * beginnt. Die Längen sind die üblichen des Reglements; ein Rennen bekommt
 * zwei Stunden, sein Zeitlimit.
 */
export const SESSIONS = [
  { k: 'fp1', name: 'Practice 1', minuten: 60 },
  { k: 'fp2', name: 'Practice 2', minuten: 60 },
  { k: 'fp3', name: 'Practice 3', minuten: 60 },
  { k: 'sprint_qualifying', name: 'Sprint qualifying', minuten: 45 },
  { k: 'sprint', name: 'Sprint', minuten: 60 },
  { k: 'qualifying', name: 'Qualifying', minuten: 60 },
  { k: 'race', name: 'Race', minuten: 120 },
]

/**
 * Alle Sessions einer Saison, in zeitlicher Reihenfolge.
 * Fehlt eine Uhrzeit, wird die Session ein ganztägiger Eintrag.
 */
export function kalenderEintraege(db, jahr) {
  const rennen = db
    .prepare(
      `SELECT r.*, COALESCE(g.full_name, g.name || ' Grand Prix') AS gp,
              z.name AS strecke, z.place_name AS ort, c.name AS land
         FROM race r
         JOIN grand_prix g ON g.id = r.grand_prix_id
         JOIN circuit z ON z.id = r.circuit_id
         LEFT JOIN country c ON c.id = z.country_id
        WHERE r.year = ?
        ORDER BY r.round`,
    )
    .all(jahr)

  const liste = []
  for (const r of rennen) {
    for (const s of SESSIONS) {
      const datum = s.k === 'race' ? r.date : r[`${s.k}_date`]
      if (!datum) continue
      const zeit = s.k === 'race' ? r.time : r[`${s.k}_time`]
      liste.push({
        uid: `${r.id}-${s.k.replace('_', '-')}@jonathanrngl.github.io`,
        titel: `${r.gp}: ${s.name}`,
        ort: [r.strecke, r.ort && r.ort !== r.strecke ? r.ort : null, r.land].filter(Boolean).join(', '),
        datum,
        zeit: zeit ?? null,
        minuten: s.minuten,
        rennen: r.id,
        runde: r.round,
        rennenInSaison: rennen.length,
      })
    }
  }
  return liste.sort((a, b) => `${a.datum}${a.zeit ?? ''}`.localeCompare(`${b.datum}${b.zeit ?? ''}`))
}

/* ------------------------------------------------------------ Schreiben */

/** Für Textfelder: Backslash, Semikolon, Komma und Zeilenwechsel maskieren. */
const text = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n')

/**
 * Lange Zeilen umbrechen: höchstens 75 Oktette, Fortsetzung mit einem
 * Leerzeichen. In Bytes gezählt, nicht in Zeichen – „São Paulo“ ist ein
 * Zeichen kürzer als seine UTF-8-Form, und ein Schnitt mitten in einem
 * Zeichen zerbräche es.
 */
export function falte(zeile) {
  const kodierer = new TextEncoder()
  const teile = []
  let aktuell = ''
  let bytes = 0
  for (const zeichen of zeile) {
    const n = kodierer.encode(zeichen).length
    const grenze = teile.length ? 74 : 75
    if (bytes + n > grenze) {
      teile.push(aktuell)
      aktuell = ''
      bytes = 0
    }
    aktuell += zeichen
    bytes += n
  }
  teile.push(aktuell)
  return teile.join('\r\n ')
}

/* Uhrzeiten kommen als HH:MM; Sekunden, falls F1DB sie einmal mitliefert, fallen weg. */
const kompakt = (datum, zeit) => `${datum.replaceAll('-', '')}T${zeit.slice(0, 5).replace(':', '')}00Z`

/** Ein Tag später, für das Ende eines ganztägigen Eintrags. */
function naechsterTag(datum) {
  const t = new Date(`${datum}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10).replaceAll('-', '')
}

function ende(datum, zeit, minuten) {
  const t = new Date(`${datum}T${zeit.slice(0, 5)}:00Z`)
  t.setUTCMinutes(t.getUTCMinutes() + minuten)
  return t.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
}

/**
 * Die Datei. `stand` ist das Datum des Datenstands (JJJJ-MM-TT), `url` bildet
 * aus einer Rennkennung die Adresse der Rennseite.
 */
export function ics(eintraege, { name, stand, url }) {
  const stempel = `${stand.replaceAll('-', '')}T000000Z`
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Formula 1 Statistics//Race calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(name)}`,
    'X-WR-TIMEZONE:UTC',
    // Abonnierende Kalender fragen zweimal am Tag nach – öfter ändert sich nichts.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ]
  for (const e of eintraege) {
    zeilen.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stempel}`)
    if (e.zeit) {
      zeilen.push(`DTSTART:${kompakt(e.datum, e.zeit)}`, `DTEND:${ende(e.datum, e.zeit, e.minuten)}`)
    } else {
      zeilen.push(`DTSTART;VALUE=DATE:${e.datum.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${naechsterTag(e.datum)}`)
    }
    zeilen.push(
      `SUMMARY:${text(e.titel)}`,
      `LOCATION:${text(e.ort)}`,
      `DESCRIPTION:${text(`Round ${e.runde} of ${e.rennenInSaison}. Results, standings and records: ${url(e.rennen)}`)}`,
      `URL:${url(e.rennen)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }
  zeilen.push('END:VCALENDAR')
  return zeilen.map(falte).join('\r\n') + '\r\n'
}
