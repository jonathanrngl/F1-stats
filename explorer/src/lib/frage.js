/**
 * Eine Frage in eine Explorer-Abfrage übersetzen.
 *
 * Der wichtigste Satz der Spezifikation lautet: Die KI darf niemals Fakten
 * erfinden. Genau deshalb ist dieses Modul so gebaut, wie es gebaut ist.
 *
 * Es beantwortet keine Frage. Es übersetzt sie in eine Abfrage – Gruppierung,
 * Filter, Sortierung – und gibt diese Abfrage zurück. Gerechnet wird
 * anschließend über den echten Datenbestand, mit derselben Engine wie überall
 * sonst. Das Modell kann also nicht danebenliegen, sondern höchstens die
 * falsche Frage stellen, und die steht sichtbar auf dem Schirm, damit man sie
 * korrigieren kann.
 *
 * Diese Fassung arbeitet mit Mustern, nicht mit einem Sprachmodell. Das ist
 * Absicht: Die Schnittstelle steht damit fest, und ein späterer LLM-Endpunkt
 * ersetzt nur `uebersetze` – alles danach bleibt gleich. Er müsste dasselbe
 * liefern: eine Abfrage, keine Antwort.
 */

/** Was eine übersetzte Frage ergibt – dieselbe Form, die der Explorer versteht. */
export const LEERE_ABFRAGE = {
  dimension: 'fahrer',
  kennzahlen: ['starts', 'siege', 'podien'],
  sortiere: 'siege',
  filter: {},
  /** Welche Wörter zu welchem Teil der Abfrage geführt haben. */
  erkannt: [],
  /** Was nicht verstanden wurde – ehrlicher als stillschweigend zu raten. */
  unverstanden: [],
}

/*
 * Zahlwörter in gefalteter Schreibweise: Die Frage läuft durch `falte`, das
 * Umlaute auflöst – aus „fünf" wird „funf". Die Schlüssel müssen deshalb so
 * aussehen, wie sie nach der Faltung ankommen, sonst greift der Filter nicht.
 */
const ZAHLWORT = {
  ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, funf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwolf: 12,
  funfzehn: 15, zwanzig: 20, dreissig: 30, funfzig: 50,
}

const falte = (s) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * @param {string} frage
 * @param {{ strecken: {id: string, name: string}[], teams: {id: string, name: string}[],
 *           fahrer: {id: string, name: string}[] }} verzeichnis
 */
export function uebersetze(frage, verzeichnis) {
  const q = falte(frage)
  const a = {
    ...LEERE_ABFRAGE,
    kennzahlen: [...LEERE_ABFRAGE.kennzahlen],
    filter: {},
    erkannt: [],
    unverstanden: [],
  }
  const merke = (was, warum) => a.erkannt.push({ was, warum })

  // -------------------------------------------------- Worüber gruppiert wird

  if (/\b(team|teams|konstrukteur|konstrukteure|rennstall)\b/.test(q)) {
    a.dimension = 'team'
    merke('Gruppierung: Team', 'das Wort „Team" oder „Konstrukteur"')
  } else if (/\b(saison|saisons|jahr|jahre)\b/.test(q) && !/\bseit\b|\bvon\b|\bzwischen\b/.test(q)) {
    a.dimension = 'saison'
    merke('Gruppierung: Saison', 'das Wort „Saison" oder „Jahr"')
  } else if (/\b(strecke|strecken|kurs|rennstrecke)\b/.test(q)) {
    a.dimension = 'strecke'
    merke('Gruppierung: Strecke', 'das Wort „Strecke"')
  } else {
    merke('Gruppierung: Fahrer', 'Vorgabe, wenn nichts anderes genannt ist')
  }

  // -------------------------------------------------- Was gezählt wird

  const kennzahl = (muster, k, label) => {
    if (!muster.test(q)) return false
    if (!a.kennzahlen.includes(k)) a.kennzahlen.push(k)
    a.sortiere = k
    merke(`Sortiert nach ${label}`, `das Wort „${muster.source.replace(/\\b|\(|\)|\|.*/g, '')}"`)
    return true
  }

  // Reihenfolge zählt: Die zuletzt erkannte Kennzahl bestimmt die Sortierung,
  // deshalb stehen die spezifischeren Begriffe unten.
  kennzahl(/\bstarts?\b|\bteilnahmen?\b/, 'starts', 'Starts')
  kennzahl(/\bpunkte?\b/, 'punkte', 'Punkten')
  kennzahl(/\bausfall|\bausfaelle|\bdnf\b/, 'ausfaelle', 'Ausfällen')
  kennzahl(/\bschnellste runden?\b/, 'schnellste', 'schnellsten Runden')
  kennzahl(/\bpodi(um|en|este?)\b/, 'podien', 'Podien')
  kennzahl(/\bpoles?\b|\bpole.?position/, 'poles', 'Pole-Positions')
  kennzahl(/\bsiege?\b|\bgewonnen\b|\bsieger\b|\bgewinner\b/, 'siege', 'Siegen')
  if (/\baufgeholt\b|\bgutgemacht\b|\bpositionen gut/.test(q)) {
    if (!a.kennzahlen.includes('gutgemacht')) a.kennzahlen.push('gutgemacht')
    a.sortiere = 'gutgemacht'
    merke('Sortiert nach gutgemachten Plätzen', 'das Wort „aufgeholt" oder „gutgemacht"')
  }

  // -------------------------------------------------- Zeitraum

  const spanne = /\b(?:von|zwischen)\s*(\d{4})\s*(?:bis|-|–|und)\s*(\d{4})/.exec(q)
  const seit = /\bseit\s*(\d{4})/.exec(q)
  const einzeln = /\b(19\d{2}|20\d{2})\b/.exec(q)

  if (spanne) {
    a.filter.vonJahr = spanne[1]
    a.filter.bisJahr = spanne[2]
    merke(`Zeitraum ${spanne[1]}–${spanne[2]}`, 'die beiden Jahreszahlen')
  } else if (seit) {
    a.filter.vonJahr = seit[1]
    merke(`Ab ${seit[1]}`, 'das Wort „seit"')
  } else if (einzeln) {
    a.filter.vonJahr = einzeln[1]
    a.filter.bisJahr = einzeln[1]
    merke(`Nur ${einzeln[1]}`, 'die genannte Jahreszahl')
  }

  // -------------------------------------------------- Strecke, Team, Fahrer

  /** Längster Name zuerst, damit „Red Bull Ring" nicht als „Red Bull" gilt. */
  const suchen = (liste, feld, label) => {
    const sortiert = [...liste].sort((x, y) => y.name.length - x.name.length)
    for (const e of sortiert) {
      const n = falte(e.name)
      if (n.length >= 4 && q.includes(n)) {
        a.filter[feld] = e.id
        merke(`${label}: ${e.name}`, `der Name kommt in der Frage vor`)
        return true
      }
    }
    return false
  }

  suchen(verzeichnis.strecken ?? [], 'strecke', 'Strecke')
  suchen(verzeichnis.teams ?? [], 'team', 'Team')

  // -------------------------------------------------- Mindestwerte

  const mindest = (muster, feld, label) => {
    const m = muster.exec(q)
    if (!m) return
    const wert = ZAHLWORT[m[1]] ?? Number(m[1])
    if (!Number.isFinite(wert)) return
    a.filter[feld] = String(wert)
    merke(`Mindestens ${wert} ${label}`, 'das Wort „mindestens"')
  }
  mindest(/mindestens\s+(\w+)\s+siege/, 'minSiege', 'Siege')
  mindest(/mindestens\s+(\w+)\s+podi/, 'minPodien', 'Podien')
  mindest(/mindestens\s+(\w+)\s+(?:starts|rennen)/, 'minStarts', 'Starts')

  // -------------------------------------------------- Besondere Schalter

  if (/von (?:weit )?hinten|au(?:ss|ß)erhalb der (?:ersten )?(?:top.?)?(?:10|zehn)|hinter(?:en)? startpl/.test(q)) {
    a.filter.nurVonHinten = true
    merke('Nur Siege von jenseits Startplatz 10', 'die Formulierung „von hinten" oder „außerhalb der ersten zehn"')
  }

  // -------------------------------------------------- Was übrig blieb

  if (a.erkannt.length <= 1) {
    a.unverstanden.push(
      'Aus dieser Frage ließ sich kaum etwas ableiten. Nenne, worüber gezählt werden soll ' +
        '(Fahrer, Team, Saison, Strecke) und was (Siege, Podien, Poles, Punkte).',
    )
  }

  return a
}

/**
 * Die Abfrage in einen Satz zurückübersetzen.
 *
 * Damit sieht der Leser, was die Maschine verstanden hat, bevor er der Zahl
 * glaubt – das ist der eigentliche Zweck der ganzen Übung.
 */
export function beschreibe(abfrage, kennzahlNamen, dimensionNamen, namen = {}) {
  const teile = [`Gruppiert nach ${dimensionNamen[abfrage.dimension]}`]
  teile.push(`sortiert nach ${kennzahlNamen[abfrage.sortiere]}`)
  const f = abfrage.filter

  /*
   * Jeder gesetzte Filter muss hier auftauchen. Eine Beschreibung, die einen
   * Filter verschweigt, ist schlimmer als gar keine – der Leser hielte die
   * Zahl dann für allgemeiner, als sie ist.
   */
  if (f.strecke) teile.push(`nur ${namen.strecke?.[f.strecke] ?? f.strecke}`)
  if (f.team) teile.push(`nur ${namen.team?.[f.team] ?? f.team}`)
  if (f.fahrer) teile.push(`nur ${namen.fahrer?.[f.fahrer] ?? f.fahrer}`)
  if (f.vonJahr && f.bisJahr && f.vonJahr === f.bisJahr) teile.push(`nur ${f.vonJahr}`)
  else if (f.vonJahr && f.bisJahr) teile.push(`${f.vonJahr} bis ${f.bisJahr}`)
  else if (f.vonJahr) teile.push(`ab ${f.vonJahr}`)
  if (f.minSiege) teile.push(`mindestens ${f.minSiege} Siege`)
  if (f.minPodien) teile.push(`mindestens ${f.minPodien} Podien`)
  if (f.minStarts) teile.push(`mindestens ${f.minStarts} Starts`)
  if (f.nurSieger) teile.push('nur Siege')
  if (f.nurVonHinten) teile.push('nur Siege von jenseits Startplatz 10')
  return teile.join(', ') + '.'
}
