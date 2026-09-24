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
