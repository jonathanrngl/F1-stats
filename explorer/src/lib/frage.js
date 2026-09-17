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
 *
 * Die Muster erkennen englische Fragen, seit die Oberfläche englisch ist. Der
 * Kommentar bleibt deutsch, weil der Quelltext es tut; die Zeichenketten, die
 * der Leser zu sehen bekommt, sind es nicht.
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
 * diakritische Zeichen auflöst und kleinschreibt. Die Schlüssel müssen deshalb
 * so aussehen, wie sie nach der Faltung ankommen.
 */
const ZAHLWORT = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, a: 1, an: 1,
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

  /*
   * „since 2000" oder „from 1990 to 2000" nennt ein Jahr, meint aber keine
   * Gruppierung nach Saison – sonst kippte jede Zeitspanne die Auswertung.
   */
  const nenntZeitraum = /\b(since|from|between|after|before)\b/.test(q)

  if (/\b(team|teams|constructor|constructors|outfit)\b/.test(q)) {
    a.dimension = 'team'
    merke('Grouping: team', 'the word “team” or “constructor”')
  } else if (/\b(season|seasons|year|years)\b/.test(q) && !nenntZeitraum) {
    a.dimension = 'saison'
    merke('Grouping: season', 'the word “season” or “year”')
  } else if (/\b(circuit|circuits|track|tracks|venue|venues)\b/.test(q)) {
    a.dimension = 'strecke'
    merke('Grouping: circuit', 'the word “circuit” or “track”')
  } else {
    merke('Grouping: driver', 'the default when nothing else is named')
  }

  // -------------------------------------------------- Was gezählt wird

  const kennzahl = (muster, k, label, wort) => {
    if (!muster.test(q)) return false
    if (!a.kennzahlen.includes(k)) a.kennzahlen.push(k)
    a.sortiere = k
    merke(`Sorted by ${label}`, `the word “${wort}”`)
    return true
  }

  // Reihenfolge zählt: Die zuletzt erkannte Kennzahl bestimmt die Sortierung,
  // deshalb stehen die spezifischeren Begriffe unten.
  kennzahl(/\bstarts?\b|\bappearances?\b|\bentries\b/, 'starts', 'starts', 'starts')
  kennzahl(/\bpoints?\b/, 'punkte', 'points', 'points')
  kennzahl(/\bretirements?\b|\bretired\b|\bdnfs?\b/, 'ausfaelle', 'retirements', 'retirements')
  kennzahl(/\bfastest laps?\b/, 'schnellste', 'fastest laps', 'fastest lap')
  kennzahl(/\bpodiums?\b|\bpodium finishes\b/, 'podien', 'podiums', 'podium')
  kennzahl(/\bpoles?\b|\bpole.?positions?\b/, 'poles', 'pole positions', 'pole')
  kennzahl(/\bwins?\b|\bwon\b|\bwinners?\b|\bvictor(y|ies)\b/, 'siege', 'wins', 'win')

  if (/\bgained\b|\bmade up\b|\bpositions? gained\b|\bovertook\b/.test(q)) {
    if (!a.kennzahlen.includes('gutgemacht')) a.kennzahlen.push('gutgemacht')
    a.sortiere = 'gutgemacht'
    merke('Sorted by positions gained', 'the word “gained” or “made up”')
  }

  // -------------------------------------------------- Zeitraum

  const spanne = /\b(?:from|between)\s*(\d{4})\s*(?:to|-|–|and|until)\s*(\d{4})/.exec(q)
  const seit = /\b(?:since|after|from)\s*(\d{4})/.exec(q)
  const einzeln = /\b(19\d{2}|20\d{2})\b/.exec(q)

  if (spanne) {
    a.filter.vonJahr = spanne[1]
    a.filter.bisJahr = spanne[2]
    merke(`Period ${spanne[1]}–${spanne[2]}`, 'the two years given')
  } else if (seit) {
    a.filter.vonJahr = seit[1]
    merke(`From ${seit[1]} onwards`, 'the word “since”')
  } else if (einzeln) {
    a.filter.vonJahr = einzeln[1]
    a.filter.bisJahr = einzeln[1]
    merke(`${einzeln[1]} only`, 'the year given')
  }

  // -------------------------------------------------- Strecke, Team, Fahrer

  /*
   * Namen suchen, längster zuerst, damit „Red Bull Ring" nicht als „Red Bull"
   * gilt. Das genügt aber nur innerhalb einer Liste: „wins at the Red Bull
   * Ring" traf früher die Strecke *und* das Team, weil beide Listen dieselbe
   * Stelle im Text lasen. Ein Treffer wird deshalb aus `rest` gestrichen,
   * bevor die nächste Liste drübergeht.
   */
  let rest = q
  const suchen = (liste, feld, label) => {
    const sortiert = [...liste].sort((x, y) => y.name.length - x.name.length)
    for (const e of sortiert) {
      const n = falte(e.name)
      if (n.length >= 4 && rest.includes(n)) {
        a.filter[feld] = e.id
        rest = rest.split(n).join(' ')
        merke(`${label}: ${e.name}`, 'the name appears in the question')
        return true
      }
    }
    return false
  }

  suchen(verzeichnis.strecken ?? [], 'strecke', 'Circuit')
  suchen(verzeichnis.teams ?? [], 'team', 'Team')

  // -------------------------------------------------- Mindestwerte

  const mindest = (muster, feld, label) => {
    /* Das erste Muster gewinnt: Es ist das genauere, weil „at least" darin steht. */
    if (a.filter[feld] !== undefined) return
    const m = muster.exec(q)
    if (!m) return
    const wert = ZAHLWORT[m[1]] ?? Number(m[1])
    if (!Number.isFinite(wert)) return
    a.filter[feld] = String(wert)
    merke(`At least ${wert} ${label}`, 'the words “at least”')
  }

  /*
   * „at least five wins and twenty podiums" nennt das „at least" nur einmal.
   * Deshalb zwei Muster je Kennzahl: eines mit dem Wort davor, eines für das
   * angehängte Glied. Ohne das zweite fiele die Hälfte der Bedingung still
   * unter den Tisch – und die Zahl wäre allgemeiner, als der Leser denkt.
   */
  const NACHGESTELLT = '(?:and|,)\\s+(\\w+)\\s+'
  mindest(/at least\s+(\w+)\s+wins?/, 'minSiege', 'wins')
  mindest(new RegExp(`${NACHGESTELLT}wins?\\b`), 'minSiege', 'wins')
  mindest(/at least\s+(\w+)\s+podiums?/, 'minPodien', 'podiums')
  mindest(new RegExp(`${NACHGESTELLT}podiums?\\b`), 'minPodien', 'podiums')
  mindest(/at least\s+(\w+)\s+(?:starts|races)/, 'minStarts', 'starts')
  mindest(new RegExp(`${NACHGESTELLT}(?:starts|races)\\b`), 'minStarts', 'starts')

  // -------------------------------------------------- Besondere Schalter

  if (/from (?:the )?back|outside the (?:first |top.?)?(?:10|ten)|from the rear|lower (?:half of the )?grid/.test(q)) {
    a.filter.nurVonHinten = true
    merke(
      'Only wins from beyond grid position 10',
      'the phrase “from the back” or “outside the top ten”',
    )
  }

  // -------------------------------------------------- Was übrig blieb

  if (a.erkannt.length <= 1) {
    a.unverstanden.push(
      'Almost nothing could be derived from this question. Name what should be counted over ' +
        '(drivers, teams, seasons, circuits) and what should be counted (wins, podiums, poles, points).',
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
  const teile = [`Grouped by ${dimensionNamen[abfrage.dimension]}`]
  teile.push(`sorted by ${kennzahlNamen[abfrage.sortiere]}`)
  const f = abfrage.filter

  /*
   * Jeder gesetzte Filter muss hier auftauchen. Eine Beschreibung, die einen
   * Filter verschweigt, ist schlimmer als gar keine – der Leser hielte die
   * Zahl dann für allgemeiner, als sie ist.
   */
  if (f.strecke) teile.push(`${namen.strecke?.[f.strecke] ?? f.strecke} only`)
  if (f.team) teile.push(`${namen.team?.[f.team] ?? f.team} only`)
  if (f.fahrer) teile.push(`${namen.fahrer?.[f.fahrer] ?? f.fahrer} only`)
  if (f.vonJahr && f.bisJahr && f.vonJahr === f.bisJahr) teile.push(`${f.vonJahr} only`)
  else if (f.vonJahr && f.bisJahr) teile.push(`${f.vonJahr} to ${f.bisJahr}`)
  else if (f.vonJahr) teile.push(`from ${f.vonJahr} onwards`)
  if (f.minSiege) teile.push(`at least ${f.minSiege} wins`)
  if (f.minPodien) teile.push(`at least ${f.minPodien} podiums`)
  if (f.minStarts) teile.push(`at least ${f.minStarts} starts`)
  if (f.nurSieger) teile.push('wins only')
  if (f.nurVonHinten) teile.push('only wins from beyond grid position 10')
  return teile.join(', ') + '.'
}
