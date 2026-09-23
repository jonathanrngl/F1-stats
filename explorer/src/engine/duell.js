/**
 * Eine Wertung aus Teamkollegen-Duellen.
 *
 * Die schwerste Frage dieses Sports lautet: Wie gut war der Fahrer, unabhängig
 * vom Auto? Sie ist nicht messbar – aber es gibt eine Annäherung, die ohne
 * Annahmen über die Autos auskommt: Zwei Teamkollegen fahren dasselbe Material.
 * Wer von beiden vorn ankam, ist eine Aussage über die Fahrer, nicht über das
 * Auto.
 *
 * Aus 8.854 solcher Duelle entsteht eine Kette. Hamilton fuhr gegen Alonso,
 * Alonso gegen Fisichella, Fisichella gegen Button – so hängen Epochen
 * zusammen, ohne dass irgendwo Autos verglichen würden.
 *
 * DAS IST EIN MODELL, KEINE MESSUNG. Die Seite muss das sagen, und zwar
 * deutlich. Drei Dinge unterstellt dieses Verfahren, und alle drei sind
 * bestenfalls ungefähr wahr:
 *
 *   Teamkollegen bekommen gleiches Material. Oft, aber nicht immer – es gab
 *   erste und zweite Fahrer, und es gab Rennställe, die den Titelanwärter
 *   bevorzugten.
 *
 *   Stärke ist übertragbar. Wenn A besser ist als B und B besser als C, dann
 *   A besser als C. Über lange Ketten häuft sich der Fehler.
 *
 *   Ein Duell ist ein faires Kräftemessen. Ein Ausfall ist keines, deshalb
 *   zählen nur Rennen, in denen beide ins Ziel kamen. Aber auch ein
 *   Boxenstopp-Fehler oder eine Kollision in Runde eins verzerrt.
 *
 * Wer das nicht dazusagt, verkauft eine Rechnung als Wahrheit. Die
 * Unsicherheit steht deshalb neben jeder Zahl: Eine Wertung aus drei Duellen
 * ist nicht dasselbe wie eine aus dreihundert.
 */

/** Startwert und Schrittweite wie beim Schach – nichts daran ist F1-spezifisch. */
const START = 1500
const K_ANFANG = 32
const K_SPAETER = 16
/** Ab wann ein Fahrer als eingespielt gilt; davor bewegt sich seine Wertung schneller. */
const EINGESPIELT = 20

/**
 * Alle Duelle in zeitlicher Reihenfolge.
 *
 * Nur Rennen, in denen beide Teamkollegen gewertet wurden: Ein Ausfall sagt
 * nichts über den Zweikampf. Geteilte Autos fallen heraus – dort ist nicht
 * entscheidbar, wer wen geschlagen hat.
 *
 * INDIANAPOLIS BLEIBT DRAUSSEN. Das Indy 500 zählte von 1950 bis 1960 zur
 * Weltmeisterschaft, war aber ein eigenes Rennen mit eigenem Reglement und
 * eigenem Feld – und, was hier entscheidet: Der Konstrukteur ist dort der
 * Chassisbauer, nicht der Rennstall. 1955 stellte Kurtis Kraft 23 der 35
 * Autos. Diese 23 Fahrer waren keine Teamkollegen, sondern unabhängige
 * Bewerber mit demselben gekauften Chassis; als Duelle gezählt ergäben sie
 * aus einem einzigen Rennen 253 Scheinvergleiche.
 *
 * Es kostet 1.867 der 8.854 Duelle. Mike Nazaruk, der ohne diesen Schnitt auf
 * Platz zehn der ewigen Wertung stand, hat ausschliesslich solche.
 *
 * @param {'rennen'|'qualifying'} art
 */
function duelle(db, art) {
  const feld = art === 'qualifying' ? 'qualifying_position' : 'position'
  const bedingung =
    art === 'qualifying'
      ? 'a.qualifying_position IS NOT NULL AND b.qualifying_position IS NOT NULL'
      : 'a.classified = 1 AND b.classified = 1'

  return db
    .prepare(
      `SELECT r.year AS jahr, r.round AS runde, r.id AS rennen,
              a.driver_id AS x, b.driver_id AS y,
              a.${feld} AS platzX, b.${feld} AS platzY
         FROM race_result a
         JOIN race_result b
           ON b.race_id = a.race_id
          AND b.constructor_id = a.constructor_id
          AND b.driver_id > a.driver_id
         JOIN race r ON r.id = a.race_id
        WHERE ${bedingung}
          AND a.shared_car = 0 AND b.shared_car = 0
          AND a.${feld} <> b.${feld}
          AND r.grand_prix_id <> 'indianapolis'
        ORDER BY r.year, r.round`,
    )
    .all()
}

/**
 * Die Wertung über alle Duelle.
 *
 * @param {'rennen'|'qualifying'} art
 * @returns {Map<string, {wertung: number, duelle: number, siege: number,
 *                        hoechste: number, hoechsteJahr: number|null,
 *                        von: number|null, bis: number|null,
 *                        gegner: Set<string>}>}
 */
export function wertung(db, art = 'rennen') {
  const stand = new Map()
  const hole = (id) => {
    if (!stand.has(id)) {
      stand.set(id, {
        wertung: START,
        duelle: 0,
        siege: 0,
        hoechste: START,
        hoechsteJahr: null,
        von: null,
        bis: null,
        gegner: new Set(),
      })
    }
    return stand.get(id)
  }

  for (const d of duelle(db, art)) {
    const a = hole(d.x)
    const b = hole(d.y)

    const erwartetA = 1 / (1 + 10 ** ((b.wertung - a.wertung) / 400))
    const aGewinnt = d.platzX < d.platzY ? 1 : 0

    const kA = a.duelle < EINGESPIELT ? K_ANFANG : K_SPAETER
    const kB = b.duelle < EINGESPIELT ? K_ANFANG : K_SPAETER

    a.wertung += kA * (aGewinnt - erwartetA)
    b.wertung += kB * (1 - aGewinnt - (1 - erwartetA))

    for (const [seite, gegen, gewonnen] of [
      [a, d.y, aGewinnt === 1],
      [b, d.x, aGewinnt === 0],
    ]) {
      seite.duelle++
      if (gewonnen) seite.siege++
      seite.gegner.add(gegen)
      seite.von ??= d.jahr
      seite.bis = d.jahr
      if (seite.wertung > seite.hoechste) {
        seite.hoechste = seite.wertung
        seite.hoechsteJahr = d.jahr
      }
    }
  }

  return stand
}

/**
 * Die Wertung als Liste, mit Namen und Unsicherheit.
 *
 * `minDuelle` ist keine Kosmetik: Nach drei Duellen steht die Wertung noch
 * fast auf dem Startwert, und eine Liste, die solche Fahrer neben Hamilton
 * stellt, führt in die Irre. Die Grenze steht sichtbar auf der Seite.
 */
export function rangliste(db, { art = 'rennen', minDuelle = 30, anzahl = 40 } = {}) {
  const stand = wertung(db, art)
  const namen = new Map(
    db
      .prepare('SELECT id, display_name AS name FROM driver')
      .all()
      .map((d) => [d.id, d.name]),
  )

  return [...stand]
    .filter(([, w]) => w.duelle >= minDuelle)
    .map(([id, w]) => ({
      id,
      name: namen.get(id) ?? id,
      wertung: Math.round(w.wertung),
      hoechste: Math.round(w.hoechste),
      hoechsteJahr: w.hoechsteJahr,
      duelle: w.duelle,
      siege: w.siege,
      quote: w.duelle > 0 ? w.siege / w.duelle : null,
      gegner: w.gegner.size,
      von: w.von,
      bis: w.bis,
    }))
    .sort((a, b) => b.wertung - a.wertung)
    .slice(0, anzahl)
}

/** Die Wertung eines einzelnen Fahrers, oder null. */
export function fahrerWertung(db, id, art = 'rennen') {
  const w = wertung(db, art).get(id)
  if (!w) return null
  return {
    wertung: Math.round(w.wertung),
    hoechste: Math.round(w.hoechste),
    hoechsteJahr: w.hoechsteJahr,
    duelle: w.duelle,
    siege: w.siege,
    gegner: w.gegner.size,
  }
}

/**
 * Wie viele Fahrer über die Kette überhaupt zusammenhängen.
 *
 * Eine Wertung vergleicht nur, was verbunden ist. Zerfiele das Feld in
 * Inseln, verglichen zwei Zahlen aus verschiedenen Inseln nichts – deshalb
 * gehört diese Auskunft auf die Seite.
 */
export function zusammenhang(db, art = 'rennen') {
  const stand = wertung(db, art)
  const nachbarn = new Map([...stand].map(([id, w]) => [id, w.gegner]))

  const gesehen = new Set()
  let groesste = 0
  for (const start of nachbarn.keys()) {
    if (gesehen.has(start)) continue
    let n = 0
    const stapel = [start]
    gesehen.add(start)
    while (stapel.length) {
      const k = stapel.pop()
      n++
      for (const g of nachbarn.get(k) ?? []) {
        if (!gesehen.has(g)) {
          gesehen.add(g)
          stapel.push(g)
        }
      }
    }
    if (n > groesste) groesste = n
  }

  return { fahrer: stand.size, groessteGruppe: groesste }
}
