/**
 * Zahlen, Daten und Anteile – an einer Stelle.
 *
 * Vorher hatte fast jede Seite ihre eigenen drei Zeilen dafür, und genau das
 * ging schief: Das Datum stand einmal als „13 September 2026" und einmal als
 * „24/11/2024", der Anteil einmal als „9%" und einmal als „9 %" mit deutschem
 * Leerzeichen, und in den Meta-Beschreibungen fehlte die Tausendertrennung
 * ganz. Keine dieser Abweichungen war eine Entscheidung; sie sind entstanden,
 * weil dieselbe Sache an sechs Orten geschrieben wurde.
 *
 * Britisches Englisch, passend zur Oberfläche.
 */

const ZAHL = new Intl.NumberFormat('en-GB')
const EINE_STELLE = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

/** Ganze Zahl mit Tausendertrennung: 27599 → „27,599". */
export const zahl = (n) => (n === null || n === undefined ? '–' : ZAHL.format(n))

/**
 * Höchstens eine Nachkommastelle, und keine überflüssige.
 * 3434.5 → „3,434.5", 1566 → „1,566" (nicht „1,566.0").
 */
export const ein = (n) => (n === null || n === undefined ? '–' : EINE_STELLE.format(n))

const DREI_STELLEN = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/**
 * Eine Streckenlänge: drei Nachkommastellen, wie sie die Formel 1 selbst
 * angibt. Mit einer Stelle stand Baku als „6 km“ da – 6,003 km gerundet, und
 * genau die drei Meter unterscheiden eine Streckenführung von der nächsten.
 */
export const km = (n) => (n === null || n === undefined ? '–' : `${DREI_STELLEN.format(n)} km`)

/*
 * Zwei Datumsformen, und das ist Absicht: Im Fließtext liest sich der volle
 * Monat besser, in einer Tabelle mit tausend Zeilen kostet er Breite, ohne
 * etwas hinzuzufügen. Was es nicht mehr gibt, ist die rein numerische Form –
 * „03/09/1950" ist für ein internationales Publikum zweideutig.
 */
const LANG = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' })
const KURZ = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Mittags in UTC, damit die Zeitzone kein Datum um einen Tag verschiebt. */
const alsDatum = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00Z`)

/** „13 September 2026" – für Fließtext. */
export const datum = (s) => (s ? LANG.format(alsDatum(s)) : '–')

/** „13 Sep 2026" – für Tabellen. */
export const datumKurz = (s) => (s ? KURZ.format(alsDatum(s)) : '–')

const TAG_MONAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** „13 Sep" – für eine Tabelle, über der das Jahr schon steht. */
export const tagMonat = (s) => (s ? TAG_MONAT.format(alsDatum(s)) : '–')

/**
 * Anteil als Prozent, ohne Leerzeichen davor.
 *
 * Nimmt eine Kennzahl (`{ value }`) oder eine nackte Zahl. Ein `null` bleibt
 * ein Gedankenstrich: Die Seite zeigt nie eine Null, wo ihr der Wert fehlt.
 */
export function prozent(x) {
  const v = x && typeof x === 'object' ? x.value : x
  return v === null || v === undefined ? '–' : `${Math.round(v * 100)}%`
}

/**
 * Eine Zeit in Sekunden, mit Leerzeichen vor der Einheit – überall gleich.
 * Unter zehn Sekunden auf Tausendstel, darüber auf Zehntel: Bei einem
 * Zielabstand von 0,010 s ist jede Stelle die Geschichte, bei 312 s keine.
 */
export const sekunden = (s) =>
  s === null || s === undefined ? '–' : `${s < 10 ? s.toFixed(3) : EINE_STELLE.format(Math.round(s * 10) / 10)} s`

/**
 * Millisekunden als Renn- oder Rundenzeit: „1:32:07.986“, „1:23.456“, „58.114“.
 * Eine Stunde nur, wenn es eine gibt; unter einer Minute ohne Minuten.
 */
export function zeit(ms) {
  if (ms === null || ms === undefined) return ''
  const s = ms / 1000
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = (s % 60).toFixed(3)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${rest.padStart(6, '0')}`
  if (m > 0) return `${m}:${rest.padStart(6, '0')}`
  return rest
}

/** Ein Alter aus Jahren und Tagen: „18y 228d“. */
export const alter = (a) => (!a ? '–' : `${a.jahre}y ${a.tage}d`)

/**
 * Ränge einer sortierten Liste, Gleichstand eingeschlossen.
 *
 * Vorher zählte ein CSS-Zähler durch: Schumacher und Hamilton, beide mit
 * sieben Titeln, standen als 1 und 2 da, und nur der Erste bekam Gold. Jetzt
 * teilen sich Gleiche den Rang und sagen es: [7, 7, 4] → „=1“, „=1“, „3“.
 * `vorn` markiert alle auf Rang eins.
 *
 * Wer am Ende einer gekürzten Liste mit jemandem gleichauf liegt, der nicht
 * mehr darin steht, bekommt kein „=“ – das lässt sich aus der Liste nicht sehen.
 */
export function raenge(liste, wert = (x) => x.wert) {
  return liste.map((x, i) => {
    let erster = i
    while (erster > 0 && wert(liste[erster - 1]) === wert(x)) erster--
    const geteilt =
      (i > 0 && wert(liste[i - 1]) === wert(x)) || (i < liste.length - 1 && wert(liste[i + 1]) === wert(x))
    return { ...x, rang: `${geteilt ? '=' : ''}${erster + 1}`, vorn: erster === 0 }
  })
}

/**
 * Klassen für eine Platzziffer als Plakette (`.pos` in theme.css). Die ersten
 * drei bekommen Gold, Silber und Bronze; alles ohne Ziffer – ein Ausfall –
 * steht leiser als Umriss.
 */
export const plakette = (p) => (!p ? 'pos aus' : p <= 3 ? `pos p${p}` : 'pos')

/**
 * Der Wert einer Kennzahl, oder ein Gedankenstrich.
 *
 * `metric()` liefert `{ value, sampleSize, coverage, caveat }`; hier geht es
 * nur um die Anzeige des Wertes selbst.
 */
export const wert = (m, formatiere = zahl) =>
  !m || m.value === null || m.value === undefined ? '–' : formatiere(m.value)
