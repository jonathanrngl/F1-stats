/**
 * Eine Frage in eine Explorer-Abfrage übersetzen.
 *
 * Der wichtigste Satz der Spezifikation lautet: Die KI darf niemals Fakten
 * erfinden. Genau deshalb ist dieses Modul so gebaut, wie es gebaut ist.
 *
 * Es beantwortet keine Frage. Es übersetzt sie in eine Abfrage – Gruppierung,
 * Filter, Sortierung – und gibt diese Abfrage zurück. Gerechnet wird
 * anschließend über den echten Datenbestand, mit derselben Engine wie überall
 * sonst. Das Modul kann also nicht danebenliegen, sondern höchstens die
 * falsche Frage stellen, und die steht sichtbar auf dem Schirm, damit man sie
 * korrigieren kann.
 *
 * Diese Fassung arbeitet mit Mustern, nicht mit einem Sprachmodell. Das ist
 * Absicht: Die Schnittstelle steht damit fest, und ein späterer LLM-Endpunkt
 * ersetzt nur `uebersetze` – alles danach bleibt gleich. Er müsste dasselbe
 * liefern: eine Abfrage, keine Antwort.
 *
 * Verstanden werden englische und deutsche Fragen. Zwei Regeln halten die
 * Übersetzung ehrlich:
 *
 *   Jedes Wort, das zu einem Teil der Abfrage geführt hat, wird verbraucht.
 *   Was am Ende übrig bleibt und kein Füllwort ist, wird gemeldet – auch
 *   dann, wenn der Rest der Frage verstanden wurde. Vorher meldete das Modul
 *   nur, wenn fast nichts erkannt war; „Hamilton" fiel still unter den Tisch.
 *
 *   Was mehrdeutig ist, wird nicht geraten. „Schumacher" sind drei Fahrer;
 *   die Übersetzung sagt das, statt einen davon zu nehmen.
 */

/** Was eine übersetzte Frage ergibt – dieselbe Form, die der Explorer versteht. */
export const LEERE_ABFRAGE = {
  dimension: 'fahrer',
  kennzahlen: ['starts', 'siege', 'podien'],
  sortiere: 'siege',
  absteigend: true,
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
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
  a: 1, an: 1, single: 1,
  ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7, acht: 8,
  neun: 9, zehn: 10, zwanzig: 20, dreissig: 30, fuenfzig: 50, hundert: 100,
}
const ZAHL = `(\\d+|${Object.keys(ZAHLWORT).join('|')})`
const alsZahl = (w) => ZAHLWORT[w] ?? Number(w)

/** Kleinschreibung, keine Akzente, Umlaute als ae/oe/ue, Satzzeichen als Leerzeichen. */
export const falte = (s) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/['’`]s\b/g, '')
    .replace(/[^\p{L}\p{N}\s\-–.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/*
 * Die Kennzahlen und ihre Wörter. Längere Wendungen vorn: „sprint wins“ muss
 * greifen, bevor „wins“ es tut, „points per race“ vor „points“.
 */
const KENNZAHL_WOERTER = [
  ['normiert', /points per possible point|share of (?:the )?possible points|normali[sz]ed points|punkte (?:je|pro) moeglichem punkt/],
  ['punkteJeStart', /points per (?:race|start|grand prix)|punkte (?:je|pro) (?:rennen|start)/],
  ['siegquote', /win(?:ning)? (?:rate|ratio|percentage|share)|siegquote|siegesquote/],
  ['podiumquote', /podium (?:rate|ratio|percentage)|podiumsquote|podiumquote/],
  ['polequote', /pole (?:rate|ratio|percentage)|polequote/],
  ['verschiedeneSieger', /different winners|distinct winners|verschiedene(?:n)? sieger/],
  ['sprintSiege', /sprint (?:race )?(?:wins?|victor(?:y|ies))|sprintsiege?/],
  ['sprintPunkte', /sprint points|sprintpunkte/],
  ['titel', /world championships?|world titles?|drivers titles?|\bchampionships?\b|\btitles?\b|weltmeistertitel|\bwm.titel\b|\btitel\b/],
  ['schnellste', /fastest laps?|schnellste(?:n)? runden?/],
  ['ausfaelle', /retirements?|\bretired\b|\bdnfs?\b|\bausfaelle?\b/],
  ['gutgemacht', /(?:positions?|places?) gained|\bgained\b|\bmade up\b|gutgemacht/],
  ['oStart', /average (?:grid|starting) position|average start|durchschnittliche(?:r|n)? startplatz/],
  ['oZiel', /average finish(?:ing position)?|durchschnittliche(?:r|n)? (?:zielplatz|platzierung|platz)/],
  ['podien', /\bpodiums?\b|podium finishes|\bpodien\b|\bpodestplaetze?\b/],
  ['poles', /pole.?positions?|\bpoles?\b/],
  ['punkte', /\bpoints?\b|\bpunkte?n?\b/],
  ['starts', /\bstarts?\b|\bappearances?\b|\bentries\b|grands? prix (?:started|entered)|\bstarted\b|\bmost races\b|\braces entered\b|\bgestartet\b/],
  ['siege', /\bwins?\b|\bwon\b|\bwinners?\b|\bvictor(?:y|ies)\b|\bsiege?n?\b|\bgewonnen\b|\bgewann\b/],
]

const KENNZAHL_LABEL = {
  starts: 'starts', siege: 'wins', podien: 'podiums', poles: 'pole positions', schnellste: 'fastest laps',
  punkte: 'points', ausfaelle: 'retirements', gutgemacht: 'positions gained', oZiel: 'average finish',
  oStart: 'average grid position', siegquote: 'win rate', podiumquote: 'podium rate', polequote: 'pole rate',
  punkteJeStart: 'points per start', normiert: 'share of possible points', titel: 'titles',
  verschiedeneSieger: 'different winners', sprintSiege: 'sprint wins', sprintPunkte: 'sprint points',
}

/** Für Bedingungen: das Wort nach der Zahl. „at least five wins“, „mindestens 20 Podien“. */
const BEDINGUNG_WOERTER = [
  ['sprintSiege', 'sprint wins?'],
  ['siege', 'wins?|victories|siege?n?'],
  ['podien', 'podiums?|podien|podestplaetze?'],
  ['poles', 'pole positions?|poles?'],
  ['starts', 'starts?|races|grands prix|rennen'],
  ['punkte', 'points?|punkte?n?'],
  ['schnellste', 'fastest laps?|schnellste runden'],
  ['titel', 'titles?|championships?|titel'],
]
const BEDINGUNG_METRIK = BEDINGUNG_WOERTER.map(([, w]) => `(?:${w})`).join('|')

/** Wofür gruppiert werden kann, und mit welchen Wörtern. Plural reicht, Singular braucht ein „which“. */
const DIMENSION_WOERTER = [
  ['team', 'teams?|constructors?|outfits?|rennstaelle?|konstrukteure?'],
  ['motor', 'engines?|engine manufacturers?|engine makers?|motoren|motorenhersteller|motor'],
  ['nation', 'nations?|nationalit(?:y|ies)|countr(?:y|ies)|laender|land|nationen'],
  ['jahrzehnt', 'decades?|jahrzehnte?'],
  ['saison', 'seasons?|years?|saisons?|saisonen|jahre?n?'],
  ['strecke', 'circuits?|tracks?|venues?|strecken?|rennstrecken?'],
  ['gp', 'grands? prix|races|rennen'],
  ['fahrer', 'drivers?|fahrer(?:n|innen)?|men|racers'],
]
const DIMENSION_LABEL = {
  fahrer: 'driver', team: 'team', motor: 'engine', nation: 'nationality', saison: 'season',
  jahrzehnt: 'decade', strecke: 'circuit', gp: 'Grand Prix',
}

/** Wege zu Strecken, die man nicht beim Namen nennt, den F1DB führt. */
const STRECKEN_ALIASE = {
  spa: 'spa-francorchamps', cota: 'austin', 'circuit of the americas': 'austin', austin: 'austin',
  interlagos: 'interlagos', imola: 'imola', 'the nordschleife': 'nurburgring', nordschleife: 'nurburgring',
  'the ring': 'nurburgring', 'yas marina': 'yas-marina', 'abu dhabi': 'yas-marina', 'albert park': 'melbourne',
  melbourne: 'melbourne', 'marina bay': 'marina-bay', singapore: 'marina-bay', montreal: 'montreal',
  'mexico city': 'mexico-city', barcelona: 'catalunya', montmelo: 'catalunya', budapest: 'hungaroring',
  baku: 'baku', sakhir: 'bahrain', 'red bull ring': 'spielberg', 'a1 ring': 'spielberg', 'oesterreichring': 'spielberg',
}

/*
 * Füllwörter, die nichts zur Abfrage beitragen und deshalb nicht als
 * „nicht verstanden“ gemeldet werden. Alles andere, was übrig bleibt, schon.
 */
const FUELLWOERTER = new Set(`
  who whom whose what which when where how many much the a an of in at on for with by to from and or
  is are was were has have had do does did most more than least ever all time alltime history career
  formula one f1 grand prix gp show me list give top best highest lowest fewest greatest biggest largest
  number total per each every only that this these those their his her its as there been be get got
  scored score finished finish finishes record records holder held any drivers driver team teams racing
  among across overall sorted sort order ranked rank table let see find tell i want know please over
  wer was welche welcher welches welchen wie viele der die das den dem des ein eine einen einer von vom
  im am an auf fuer mit bei zu zum zur und oder ist sind war waren hat haben hatte hatten meisten mehr
  als wenigsten jemals aller zeiten geschichte karriere formel zeige zeig liste gib top beste besten
  anzahl gesamt pro je nur insgesamt alle im es gibt sich
`.split(/\s+/).filter(Boolean))

/**
 * @typedef {{ id: string, name: string, namen?: string[] }} Eintrag
 * @param {string} frage
 * @param {{ strecken?: Eintrag[], teams?: Eintrag[], fahrer?: Eintrag[], gps?: Eintrag[],
 *           motoren?: Eintrag[], laender?: Eintrag[], letztesJahr?: number }} verzeichnis
 *   Je Eintrag ein Name oder mehrere (`namen`): Für einen Grand Prix sind das
 *   „British Grand Prix“ und „British GP“, für eine Nationalität „British“.
 */
export function uebersetze(frage, verzeichnis = {}) {
  const q = falte(frage)
  const a = {
    ...LEERE_ABFRAGE,
    kennzahlen: [],
    filter: {},
    erkannt: [],
    unverstanden: [],
  }
  const merke = (was, warum) => a.erkannt.push({ was, warum })

  /*
   * `rest` ist die Frage, aus der jedes verstandene Stück getilgt wird. Was
   * am Ende darin steht, war nicht zu gebrauchen. Getilgt wird durch
   * Leerzeichen, nicht durch Löschen, damit Wortgrenzen erhalten bleiben.
   */
  let rest = ` ${q} `
  const verbrauche = (text) => {
    rest = rest.replace(text, ' '.repeat(text.length))
  }
  const findeUndVerbrauche = (re) => {
    const m = re.exec(rest)
    if (m) verbrauche(m[0])
    return m
  }

  // -------------------------------------------------- Bedingungen

  /*
   * „at least five wins and twenty podiums“ nennt das „at least“ nur einmal;
   * das angehängte Glied erbt es. Ohne das fiele die Hälfte der Bedingung
   * still unter den Tisch – und die Zahl wäre allgemeiner, als der Leser denkt.
   */
  const bedingungen = []
  const metrikVon = (wort) => BEDINGUNG_WOERTER.find(([, w]) => new RegExp(`^(?:${w})$`).test(wort))?.[0]
  const OPERATOR = [
    [/^(?:at least|a minimum of|minimum of|min|mindestens|wenigstens)$/, '>=', 0],
    [/^(?:more than|over|mehr als|ueber)$/, '>=', 1],
    [/^(?:at most|no more than|maximal|hoechstens|up to)$/, '<=', 0],
    [/^(?:fewer than|less than|under|weniger als|unter)$/, '<=', -1],
  ]
  const BED = new RegExp(
    `\\b(at least|a minimum of|minimum of|min|mindestens|wenigstens|more than|over|mehr als|ueber|at most|no more than|maximal|hoechstens|fewer than|less than|under|weniger als|unter)\\s+${ZAHL}\\s+(${BEDINGUNG_METRIK})\\b((?:\\s*(?:,|and|und)\\s+${ZAHL}\\s+(?:${BEDINGUNG_METRIK})\\b)*)`,
    'g',
  )
  for (const m of [...rest.matchAll(BED)]) {
    const [, op, plus] = OPERATOR.find(([re]) => re.test(m[1]))
    const glieder = [[m[2], m[3]]]
    for (const g of m[4].matchAll(new RegExp(`${ZAHL}\\s+(${BEDINGUNG_METRIK})`, 'g'))) glieder.push([g[1], g[2]])
    for (const [zahl, wort] of glieder) {
      const k = metrikVon(wort)
      if (!k) continue
      bedingungen.push({ kennzahl: k, op, wert: alsZahl(zahl) + plus })
      merke(`${op === '>=' ? 'At least' : 'At most'} ${alsZahl(zahl) + plus} ${KENNZAHL_LABEL[k]}`, `the words “${m[1]} ${zahl} ${wort}”`)
    }
    verbrauche(m[0])
  }
  // „without a win“, „never won“ – eine Obergrenze von null.
  const nie = findeUndVerbrauche(/\b(without (?:a |ever )?(?:win|winning|victory)|never (?:won|winning)|winless|no wins|ohne (?:einen )?sieg|nie gewonnen|sieglos)\b/)
  if (nie) {
    bedingungen.push({ kennzahl: 'siege', op: '<=', wert: 0 })
    merke('No wins', `the words “${nie[1]}”`)
  }
  if (bedingungen.length) a.filter.bedingungen = bedingungen

  // -------------------------------------------------- Zeitraum

  const jahr = (s) => Number(s.length === 2 ? `19${s}` : s)
  const spanne = findeUndVerbrauche(/\b(?:from|between|zwischen|von)\s+(\d{4})\s*(?:to|-|–|and|until|till|und|bis)\s*(\d{4})\b/)
  if (spanne) {
    a.filter.vonJahr = spanne[1]
    a.filter.bisJahr = spanne[2]
    merke(`Period ${spanne[1]}–${spanne[2]}`, 'the two years given')
  }
  const jahrzehnt = !spanne && findeUndVerbrauche(/\b(?:the |in den |den |die )?((?:19|20)?[0-9]0)(?:s|er(?:n|jahren?)?)\b/)
  if (jahrzehnt) {
    const von = jahrzehnt[1].length === 2 ? jahr(jahrzehnt[1]) : Number(jahrzehnt[1])
    if (von >= 1950) {
      a.filter.vonJahr = String(von)
      a.filter.bisJahr = String(von + 9)
      merke(`The ${von}s: ${von}–${von + 9}`, `the decade “${jahrzehnt[1]}s”`)
    }
  }
  const seit = findeUndVerbrauche(/\b(since|after|seit|nach|from|ab)\s+(\d{4})\b/)
  if (seit) {
    const nachher = /after|nach/.test(seit[1])
    a.filter.vonJahr = String(Number(seit[2]) + (nachher ? 1 : 0))
    merke(`From ${a.filter.vonJahr} onwards`, `the word “${seit[1]}”`)
  }
  const vor = findeUndVerbrauche(/\b(before|prior to|vor|until|till|up to|through|bis)\s+(\d{4})\b/)
  if (vor) {
    const davor = /before|prior|vor/.test(vor[1]) && vor[1] !== 'bis'
    a.filter.bisJahr = String(Number(vor[2]) - (davor ? 1 : 0))
    merke(`Up to ${a.filter.bisJahr}`, `the word “${vor[1]}”`)
  }
  if (!a.filter.vonJahr && !a.filter.bisJahr) {
    const einzeln = findeUndVerbrauche(/\b(?:in |im jahr |the )?(19[5-9]\d|20\d{2})(?: season| saison)?\b/)
    if (einzeln) {
      a.filter.vonJahr = einzeln[1]
      a.filter.bisJahr = einzeln[1]
      merke(`${einzeln[1]} only`, 'the year given')
    } else if (verzeichnis.letztesJahr && findeUndVerbrauche(/\b(?:this|the current|diese[rsn]?|der aktuellen|aktuelle[rn]?) (?:season|year|saison|jahr)\b/)) {
      a.filter.vonJahr = a.filter.bisJahr = String(verzeichnis.letztesJahr)
      merke(`${verzeichnis.letztesJahr} only`, 'the words “this season”')
    }
  }

  // -------------------------------------------------- Namen

  /*
   * Alle Namen in eine Liste, längster zuerst: So gilt „Red Bull Ring“ als
   * Strecke, bevor „Red Bull“ als Team greifen kann, und „British Grand Prix“
   * als Rennen, bevor „British“ als Nationalität greift. Jeder Treffer wird
   * verbraucht, bevor der nächste Name gesucht wird.
   */
  const kandidaten = []
  const nimm = (art, liste, mindest = 4) => {
    for (const e of liste ?? []) {
      for (const n of e.namen ?? [e.name]) {
        const f = falte(n)
        if (f.length >= mindest) kandidaten.push({ art, id: e.id, name: e.name, text: f })
      }
    }
  }
  nimm('strecke', verzeichnis.strecken)
  nimm('team', verzeichnis.teams)
  nimm('gp', verzeichnis.gps)
  nimm('land', verzeichnis.laender)
  for (const [text, id] of Object.entries(STRECKEN_ALIASE)) {
    const s = verzeichnis.strecken?.find((x) => x.id === id)
    if (s) kandidaten.push({ art: 'strecke', id, name: s.name, text, alias: true })
  }
  // Motoren nur mit dem Wort dazu: „Ferrari“ allein ist das Team.
  for (const m of verzeichnis.motoren ?? []) {
    const f = falte(m.name)
    for (const text of [`${f} engines`, `${f} engine`, `${f}-engined`, `${f}-powered`, `${f} powered`, `${f} power`, `${f}-motor`, `${f} motoren`]) {
      kandidaten.push({ art: 'motor', id: m.id, name: m.name, text })
    }
  }

  /*
   * Fahrer: voller Name, und der Nachname allein, wenn er eindeutig ist.
   * Ist er es nicht, wird er gemerkt – dann sagt die Übersetzung, dass sie
   * nicht weiß, welcher gemeint ist.
   */
  /*
   * Ein Nachname, der zugleich ein gewöhnliches Wort der Frage ist, gilt nur
   * mit Vornamen: Sonst machte „Drivers with the most wins“ Paddy Driver zum
   * Filter, und die Tabelle hätte eine Zeile.
   */
  const gewoehnlich = (w) =>
    FUELLWOERTER.has(w) ||
    DIMENSION_WOERTER.some(([, muster]) => new RegExp(`^(?:${muster})$`).test(w)) ||
    KENNZAHL_WOERTER.some(([, re]) => new RegExp(`^(?:${re.source})$`).test(w))
  const nachnamen = new Map()
  for (const e of verzeichnis.fahrer ?? []) {
    const f = falte(e.name)
    kandidaten.push({ art: 'fahrer', id: e.id, name: e.name, text: f })
    const nach = falte(e.nachname ?? e.name.split(' ').slice(1).join(' '))
    if (nach.length >= 4 && !gewoehnlich(nach)) nachnamen.set(nach, [...(nachnamen.get(nach) ?? []), e])
  }
  /*
   * Mehrere Fahrer mit demselben Nachnamen: Überragt einer die anderen um das
   * Dreifache an Starts, ist er gemeint – „Hamilton“ heißt Lewis, nicht
   * Duncan mit seinen fünf Rennen in den 1950ern. Sonst wird nicht geraten.
   */
  const mehrdeutig = new Map()
  for (const [nach, liste] of nachnamen) {
    const nachStarts = [...liste].sort((x, y) => (y.starts ?? 0) - (x.starts ?? 0))
    if (liste.length === 1) kandidaten.push({ art: 'fahrer', id: liste[0].id, name: liste[0].name, text: nach })
    else if ((nachStarts[0].starts ?? 0) >= 3 * Math.max(1, nachStarts[1].starts ?? 0)) {
      kandidaten.push({ art: 'fahrer', id: nachStarts[0].id, name: nachStarts[0].name, text: nach, ueberragt: true })
    } else mehrdeutig.set(nach, nachStarts)
  }

  kandidaten.sort((x, y) => y.text.length - x.text.length)
  const gesetzt = new Set()
  const FELD = { strecke: 'strecke', team: 'team', gp: 'gp', land: 'land', motor: 'motor', fahrer: 'fahrer' }
  const WORT = { strecke: 'Circuit', team: 'Team', gp: 'Grand Prix', land: 'Nationality', motor: 'Engine', fahrer: 'Driver' }
  for (const k of kandidaten) {
    if (gesetzt.has(k.art)) continue
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(k.text)}(?:s)?(?![\\p{L}\\p{N}])`, 'u')
    const m = re.exec(rest)
    if (!m) continue
    verbrauche(m[0])
    gesetzt.add(k.art)
    a.filter[FELD[k.art]] = k.id
    merke(
      `${WORT[k.art]}: ${k.name}`,
      k.alias
        ? `“${k.text}” stands for it`
        : k.ueberragt
          ? `“${k.text}” – of the drivers with that name, by far the most starts`
          : 'the name appears in the question',
    )
  }

  for (const [nach, liste] of mehrdeutig) {
    if (gesetzt.has('fahrer')) break
    const re = new RegExp(`(?<![\\p{L}])${escape(nach)}(?![\\p{L}])`, 'u')
    if (re.test(rest)) {
      verbrauche(re.exec(rest)[0])
      a.unverstanden.push(
        `“${nach}” fits ${liste.length} drivers (${liste.slice(0, 4).map((e) => e.name).join(', ')}) – name the first name as well.`,
      )
    }
  }

  // „drivers from Brazil“: das Land statt der Nationalität.
  if (!gesetzt.has('land')) {
    for (const l of verzeichnis.laender ?? []) {
      if (!l.land) continue
      const re = new RegExp(`\\b(?:from|aus) (?:the )?${escape(falte(l.land))}\\b`)
      const m = re.exec(rest)
      if (m) {
        verbrauche(m[0])
        a.filter.land = l.id
        merke(`Nationality: ${l.name}`, `the words “${m[0].trim()}”`)
        break
      }
    }
  }

  // -------------------------------------------------- Besondere Schalter

  const hinten = findeUndVerbrauche(/from (?:the )?back|outside the (?:first |top.?)?(?:10|ten)|from the rear|lower (?:half of the )?grid|von (?:ganz )?hinten/)
  if (hinten) {
    a.filter.nurVonHinten = true
    merke('Only wins from beyond grid position 10', `the words “${hinten[0]}”`)
  }
  const indy = findeUndVerbrauche(/\b(?:without|excluding|except|ohne) (?:the )?indy(?:anapolis)?(?: 500)?\b|\bformula one races only\b|\bgrands prix only\b/)
  if (indy) {
    a.filter.ohneIndy = true
    merke('Without the Indianapolis 500', `the words “${indy[0]}”`)
  }

  // -------------------------------------------------- Worüber gruppiert wird

  /*
   * Gruppiert wird nach dem, wonach gefragt ist – nicht nach jedem Wort, das
   * vorkommt. „Wins at the Monaco circuit“ fragt nach Fahrern, nicht nach
   * Strecken, und „team-mates“ ist kein Team. Deshalb zählt ein Wort nur mit
   * „which“, „per“, „by“ davor, oder im Plural als Gegenstand der Frage.
   */
  rest = rest.replace(/team.?mates?|teamkollegen/g, (m) => ' '.repeat(m.length))
  let dimension = null
  for (const [dim, woerter] of DIMENSION_WOERTER) {
    const gefragt = new RegExp(
      `\\b(which|what|per|by|each|every|for each|most successful|welche[rsn]?|pro|je|nach)\\s+(?:the\\s+)?(${woerter})\\b`,
    ).exec(rest)
    if (gefragt) {
      dimension = dim
      verbrauche(gefragt[0])
      merke(`Grouping: ${DIMENSION_LABEL[dim]}`, `the words “${gefragt[0].trim()}”`)
      break
    }
  }
  if (!dimension) {
    /*
     * Mehrzahl als Gegenstand: „teams with the most wins“, „seasons with …“.
     * Nicht „years“ – „over the years“ fragt nach nichts – und nicht „races“,
     * das meist die Rennen meint, über die gezählt wird.
     */
    const MEHRZAHL = /\b(teams|constructors|outfits|engines|engine manufacturers|nations|nationalities|countries|decades|seasons|circuits|tracks|venues|rennstaelle|konstrukteure|motoren|nationen|laender|jahrzehnte|saisons|strecken|rennstrecken)\b/
    const m = MEHRZAHL.exec(rest)
    if (m) {
      dimension = DIMENSION_WOERTER.find(([, w]) => new RegExp(`^(?:${w})$`).test(m[1]))?.[0] ?? null
      if (dimension) {
        verbrauche(m[0])
        merke(`Grouping: ${DIMENSION_LABEL[dimension]}`, `the word “${m[1]}”`)
      }
    }
  }
  a.dimension = dimension ?? 'fahrer'
  if (!dimension) merke('Grouping: driver', 'the default when nothing else is asked for')

  // -------------------------------------------------- Was gezählt wird

  /*
   * Welche Kennzahlen genannt sind, und welche davon die Sortierung bestimmt:
   * die nach „most“ oder „fewest“. Ohne ein solches Wort die zuerst genannte.
   */
  const MEISTE = /\b(most|meisten?|highest|hoechste[nr]?|best(?:en?)?|greatest|largest|biggest|top)\s+/g
  const WENIGSTE = /\b(fewest|least|lowest|wenigsten?|niedrigste[nr]?|worst|schlechteste[nr]?)\s+/g
  const signale = [
    ...[...rest.matchAll(MEISTE)].map((m) => ({ ende: m.index + m[0].length, ab: false, wort: m[1] })),
    ...[...rest.matchAll(WENIGSTE)].map((m) => ({ ende: m.index + m[0].length, ab: true, wort: m[1] })),
  ]
  // „won the most races“ heißt Siege, nicht Starts.
  const gewonnen = /\b(?:won|gewann|gewonnen)\s+(?:the\s+)?(?:most|meisten)\s+(?:races|grands prix|rennen)\b/.exec(rest)

  const genannt = []
  for (const [k, re] of KENNZAHL_WOERTER) {
    const g = new RegExp(re.source, 'g')
    for (const m of rest.matchAll(g)) {
      genannt.push({ k, stelle: m.index, text: m[0] })
      verbrauche(m[0])
    }
  }
  genannt.sort((x, y) => x.stelle - y.stelle)
  const gefunden = [...new Set(genannt.map((g) => g.k))]
  if (gewonnen && !gefunden.includes('siege')) gefunden.unshift('siege')

  let sortiere = null
  let absteigend = true
  if (gewonnen) {
    sortiere = 'siege'
    verbrauche(gewonnen[0])
  } else {
    for (const s of signale) {
      const naechste = genannt.find((g) => g.stelle >= s.ende - 1 && g.stelle - s.ende < 30)
      if (naechste) {
        sortiere = naechste.k
        absteigend = !s.ab
        verbrauche(s.wort)
        // Bei Durchschnittsplätzen ist weniger besser: „best average finish“ steigt auf.
        if (sortiere === 'oZiel' || sortiere === 'oStart') absteigend = /worst|schlechteste/.test(s.wort)
        break
      }
    }
  }
  if (!sortiere) sortiere = gefunden[0] ?? (bedingungen[0]?.kennzahl ?? 'siege')
  if (sortiere === 'oZiel' || sortiere === 'oStart') {
    if (!signale.length) absteigend = false
  }
  if (sortiere === 'verschiedeneSieger' && a.dimension === 'fahrer') {
    a.dimension = 'saison'
    merke('Grouping: season', '“different winners” only makes sense over seasons, circuits or teams')
  }

  a.sortiere = sortiere
  a.absteigend = absteigend
  const spalten = new Set(['starts', ...gefunden, ...bedingungen.map((b) => b.kennzahl), sortiere])
  if (spalten.size < 3) for (const k of ['siege', 'podien']) spalten.add(k)
  a.kennzahlen = [...spalten]
  merke(
    `Sorted by ${KENNZAHL_LABEL[sortiere]}${absteigend ? '' : ', lowest first'}`,
    genannt.find((g) => g.k === sortiere) ? `the word “${genannt.find((g) => g.k === sortiere).text}”` : 'the default',
  )

  /*
   * Eine Quote aus einem einzigen Rennen führt jede Liste an: ein Start, ein
   * Sieg, hundert Prozent. Ohne eigene Grenze gilt deshalb eine – und sie
   * steht da, damit niemand sie für einen Teil der Frage hält.
   */
  const QUOTEN = ['siegquote', 'podiumquote', 'polequote', 'punkteJeStart', 'normiert', 'oZiel', 'oStart']
  if (QUOTEN.includes(sortiere) && !bedingungen.some((b) => b.kennzahl === 'starts')) {
    a.filter.bedingungen = [...(a.filter.bedingungen ?? []), { kennzahl: 'starts', op: '>=', wert: 20 }]
    merke('At least 20 starts', 'added, so that a single lucky race cannot top a rate')
  }

  // -------------------------------------------------- Was übrig blieb

  const uebrig = rest
    .split(/[\s\-–.]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !FUELLWOERTER.has(w) && !/^\d+$/.test(w) && !(w in ZAHLWORT))
  if (uebrig.length) {
    a.unverstanden.push(`Not used: ${[...new Set(uebrig)].map((w) => `“${w}”`).join(', ')}. The table does not reflect these words.`)
  }
  if (a.erkannt.length <= 2 && !genannt.length && !Object.keys(a.filter).length) {
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
  teile.push(`sorted by ${kennzahlNamen[abfrage.sortiere]}${abfrage.absteigend === false ? ' (lowest first)' : ''}`)
  const f = abfrage.filter

  /*
   * Jeder gesetzte Filter muss hier auftauchen. Eine Beschreibung, die einen
   * Filter verschweigt, ist schlimmer als gar keine – der Leser hielte die
   * Zahl dann für allgemeiner, als sie ist.
   */
  for (const [feld, wort] of [['strecke', ''], ['gp', ''], ['team', ''], ['motor', ' engines'], ['fahrer', ''], ['land', ' drivers']]) {
    if (f[feld]) teile.push(`${namen[feld]?.[f[feld]] ?? f[feld]}${wort} only`)
  }
  if (f.vonJahr && f.bisJahr && f.vonJahr === f.bisJahr) teile.push(`${f.vonJahr} only`)
  else if (f.vonJahr && f.bisJahr) teile.push(`${f.vonJahr} to ${f.bisJahr}`)
  else if (f.vonJahr) teile.push(`from ${f.vonJahr} onwards`)
  else if (f.bisJahr) teile.push(`up to ${f.bisJahr}`)
  for (const b of f.bedingungen ?? []) {
    teile.push(`${b.op === '>=' ? 'at least' : 'at most'} ${b.wert} ${(kennzahlNamen[b.kennzahl] ?? b.kennzahl).toLowerCase()}`)
  }
  if (f.nurSieger) teile.push('wins only')
  if (f.nurVonHinten) teile.push('only wins from beyond grid position 10')
  if (f.ohneIndy) teile.push('without the Indianapolis 500')
  return teile.join(', ') + '.'
}
