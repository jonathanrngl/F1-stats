/**
 * Eine Kennzahl ist nicht nur eine Zahl.
 *
 * Der häufigste Fehler in F1-Statistiken ist die Null, die wie eine Aussage
 * aussieht: „Fangio, Führungsrunden: 0". Fangio hat geführt – nur weiß es die
 * Datenquelle nicht, weil sie Rundendaten erst ab 1996 führt. Eine Kennzahl
 * muss deshalb sagen können, worauf sie beruht, statt nur ein Ergebnis zu
 * behaupten.
 *
 * Darum trägt jede Kennzahl vier Dinge:
 *   value       der Wert, oder null wenn nicht ermittelbar
 *   sampleSize  auf wie vielen Rennen er beruht
 *   coverage    welcher Zeitraum belegt ist, oder null
 *   caveat      was die Oberfläche dazusagen muss
 */

/** @typedef {{ firstYear: number, lastYear: number }} Coverage */

/**
 * @template T
 * @typedef {object} Metric
 * @property {T|null} value
 * @property {number} sampleSize
 * @property {Coverage|null} coverage
 * @property {string} [caveat]
 */

/**
 * Belastbare Kennzahl.
 * @template T
 * @param {T} value
 * @param {number} sampleSize
 * @param {Coverage|null} [coverage]
 * @param {string} [caveat]
 * @returns {Metric<T>}
 */
export function metric(value, sampleSize, coverage = null, caveat) {
  return caveat === undefined
    ? { value, sampleSize, coverage }
    : { value, sampleSize, coverage, caveat }
}

/**
 * Nicht ermittelbar – aus Datenmangel, nicht weil der Wert null wäre.
 * @param {string} caveat Was fehlt, in einem Satz für die Oberfläche.
 * @param {number} [sampleSize]
 * @returns {Metric<never>}
 */
export function unknown(caveat, sampleSize = 0) {
  return { value: null, sampleSize, coverage: null, caveat }
}

/**
 * Anteil zweier Zählungen, mit Schutz gegen die Division durch null.
 *
 * Ohne Nenner gibt es keine Quote – und `0/0 = 0` wäre gelogen: Wer nie
 * gestartet ist, hat keine Siegquote von null Prozent, sondern gar keine.
 *
 * @param {number} part
 * @param {number} whole
 * @param {Coverage|null} [coverage]
 * @returns {Metric<number>}
 */
export function rate(part, whole, coverage = null) {
  if (whole <= 0) return unknown('Keine Rennen in diesem Zeitraum.')
  return metric(part / whole, whole, coverage)
}

/**
 * Mittelwert einer Liste. Leere Liste heißt: kein Mittelwert, nicht null.
 *
 * `minSample` markiert Werte, die aus zu wenig Rennen stammen, statt sie zu
 * verschweigen – ein Fahrer mit einem einzigen Rennen führt sonst jede
 * Bestenliste an.
 *
 * @param {number[]} werte
 * @param {{ minSample?: number, coverage?: Coverage|null }} [opts]
 * @returns {Metric<number>}
 */
export function mean(werte, opts = {}) {
  const { minSample = 1, coverage = null } = opts
  if (werte.length === 0) return unknown('Keine Werte vorhanden.')
  const wert = werte.reduce((a, b) => a + b, 0) / werte.length
  return werte.length < minSample
    ? metric(wert, werte.length, coverage, `Beruht auf nur ${werte.length} Rennen.`)
    : metric(wert, werte.length, coverage)
}

/**
 * Längste ununterbrochene Folge, in der `trifft` zutrifft.
 *
 * Gezählt wird über Rennen in zeitlicher Reihenfolge, nicht über Treffer:
 * Eine Siegesserie reißt beim ersten Rennen ohne Sieg, auch wenn der Fahrer
 * danach weitergewinnt.
 *
 * @template T
 * @param {T[]} rennen In zeitlicher Reihenfolge.
 * @param {(r: T) => boolean} trifft
 * @returns {{ length: number, from: T|null, to: T|null }}
 */
export function longestStreak(rennen, trifft) {
  let beste = { length: 0, from: null, to: null }
  let lauf = 0
  let start = null

  for (const r of rennen) {
    if (trifft(r)) {
      if (lauf === 0) start = r
      lauf++
      if (lauf > beste.length) beste = { length: lauf, from: start, to: r }
    } else {
      lauf = 0
      start = null
    }
  }
  return beste
}
