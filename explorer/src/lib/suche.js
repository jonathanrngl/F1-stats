/**
 * Treffer der Suche in der Kopfleiste – ohne Browser, damit die Tests sie prüfen.
 *
 * Eine Eingabe aus mehreren Wörtern trifft nur, was alle enthält: „senna
 * monaco“ findet Sennas Rennen in Monaco nicht, weil kein Eintrag beides ist,
 * wohl aber „monaco 1988“ das Rennen. Vorher zählte der ganze Text als ein
 * Stück, und schon ein zweites Wort ergab nichts.
 */

export const ARTEN = {
  f: { label: 'Driver', pfad: 'drivers' },
  t: { label: 'Team', pfad: 'teams' },
  s: { label: 'Circuit', pfad: 'circuits' },
  m: { label: 'Engine', pfad: 'engines' },
  j: { label: 'Season', pfad: 'seasons' },
  r: { label: 'Race', pfad: 'races' },
}

/** Kleinschreibung ohne Akzente – „Pérez“ findet man auch als „perez“. */
export const falte = (s) =>
  String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Das Jahr, ab dem die drei Buchstaben einer Startnummer verbindlich waren.
 * Für frühere Fahrer hat F1DB sie abgeleitet, und niemand hat Mike Sparken je
 * „SPA“ genannt – ohne diese Schranke stünde er bei „spa“ vor Spa-Francorchamps.
 */
export const KUERZEL_AB = 2014

/**
 * Rang eines Eintrags für eine Eingabe – kleiner ist besser, -1 heißt daneben.
 *
 * Die Reihenfolge ist nicht beliebig: Ein Kürzel ist eine eindeutige Eingabe
 * („VER"), ein Nachname der übliche Sucheinstieg („hamilton"), und erst danach
 * kommt, was den Text irgendwo enthält. Ohne diese Stufen stünde bei „ham"
 * Graham Hill vor Lewis Hamilton, weil sein Name die Zeichen ebenfalls enthält.
 */
export function rang(e, woerter) {
  const n = falte(e.n)
  const namensWoerter = n.split(/[\s\-–]+/)
  const alle = [...namensWoerter, ...(e.o ? falte(e.o).split(/[\s\-–]+/) : [])]
  const q = woerter.join(' ')

  // Jedes Wort der Eingabe muss irgendwo vorn in einem Wort des Eintrags stehen.
  if (!woerter.every((w) => alle.some((x) => x.startsWith(w)) || n.includes(w))) return -1

  const k = (e.k ?? '').toLowerCase()
  if (woerter.length === 1 && k && k === q && e.b >= KUERZEL_AB) return 0

  /*
   * Was einen Eintrag identifiziert, hängt an seiner Art: Bei einem Fahrer
   * ist es der Nachname – niemand sucht Hamilton unter „Lewis" –, bei allem
   * anderen der ganze Name.
   */
  const identifizierend = e.a === 'f' ? namensWoerter.at(-1) : n
  let r
  if (identifizierend.startsWith(q)) r = 1
  else if (n.startsWith(q)) r = 2
  else if (woerter.every((w) => alle.some((x) => x.startsWith(w)))) r = 3
  else r = 4

  /*
   * Rennen gibt es über tausend, und fast jedes teilt seinen Namen mit einer
   * Strecke oder einem Land. Bei „monaco“ soll die Strecke vorn stehen, nicht
   * 70 Rennen. Nennt die Eingabe ein Jahr, ist das Rennen gemeint.
   */
  const mitJahr = woerter.some((w) => /^(19|20)\d\d$/.test(w))
  if ((e.a === 'r' || e.a === 'j') && !mitJahr) r += 3
  return r
}

const UEBERSICHTEN = new Set(Object.values(ARTEN).map((a) => a.pfad))

/**
 * Aus einer Adresse, die es nicht gibt, die Suchanfrage machen, die
 * vermutlich gemeint war – für die Vorschläge auf der Fehlerseite.
 *
 *   "/drivers/lewis-hamiltn/"      → "lewis hami"
 *   "/races/monaco-grand-prix-88/" → "mona grand prix 1988"
 *   "/fahrer/senna"                → "senna"
 *   "/drivers/", "/"               → ""   (nichts zu raten)
 *
 * Gesucht wird nur mit dem letzten Stück: Davor steht die Art der Seite, und
 * die ist bei einer falschen Adresse oft selbst falsch („fahrer“).
 *
 * @param {string} weg Pfad ohne den Vorsatz /F1-stats, z. B. "/drivers/hamilton/"
 * @returns {string} Anfrage für treffer(), oder "" wenn nichts Brauchbares darin steht
 */
export function anfrageAusPfad(weg) {
  const teile = falte(weg)
    .split('/')
    .map((t) => t.replace(/\.html?$/, ''))
    .filter((t) => t && t !== 'index')
  const letztes = teile.at(-1)
  if (!letztes || UEBERSICHTEN.has(letztes)) return ''

  const woerter = letztes.split(/[-_+.\s]+/).filter(Boolean)
  const mitName = woerter.some((w) => !/^\d+$/.test(w))
  return woerter
    .map((w) => {
      // „88“ neben einem Namen ist ein Jahr – und mit Jahr bevorzugt rang() das Rennen.
      if (mitName && /^\d\d$/.test(w)) return String((Number(w) >= 50 ? 1900 : 2000) + Number(w))
      /*
       * treffer() verlangt, dass jedes Wort vorn passt, und ein Tippfehler
       * sitzt selten in den ersten vier Buchstaben: Über „hami“ findet
       * „hamiltn“ zu Hamilton. Kürzere Wörter bleiben ganz: Bei ihnen ist
       * jeder Buchstabe schon Unterscheidung.
       */
      return w.length >= 6 && !/^\d+$/.test(w) ? w.slice(0, 4) : w
    })
    .join(' ')
}

/**
 * Die besten Treffer für eine Eingabe.
 * @param {object[]} index aus /data/suche.json
 * @param {string} eingabe
 */
export function treffer(index, eingabe, anzahl = 8) {
  const woerter = falte(eingabe).trim().split(/\s+/).filter(Boolean)
  if (woerter.join('').length < 2) return []
  return index
    .map((e) => ({ e, r: rang(e, woerter) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || b.e.g - a.e.g)
    .slice(0, anzahl)
    .map((x) => x.e)
}

/**
 * Vorschläge für eine Adresse, die es nicht gibt.
 *
 * Findet die Anfrage aus dem Pfad nichts, folgt ein zweiter Versuch mit drei
 * Buchstaben je Wort: „ferari“ scheitert an „fera“, weil der Fehler schon im
 * vierten Buchstaben sitzt, „fer“ findet Ferrari.
 */
export function vorschlaege(index, weg, anzahl = 6) {
  const anfrage = anfrageAusPfad(weg)
  if (!anfrage) return []
  const erste = treffer(index, anfrage, anzahl)
  if (erste.length) return erste
  const kuerzer = anfrage
    .split(' ')
    .map((w) => (/^\d+$/.test(w) ? w : w.slice(0, 3)))
    .join(' ')
  return kuerzer === anfrage ? [] : treffer(index, kuerzer, anzahl)
}
