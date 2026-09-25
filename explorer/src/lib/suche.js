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
