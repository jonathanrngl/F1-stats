/**
 * Abfragen über den Datenwürfel – im Browser und in den Tests dieselbe Rechnung.
 *
 * Der Explorer rechnete bisher in seiner React-Komponente. Damit ließ sich
 * nicht prüfen, ob „Who has the most wins at Monaco?“ am Ende Senna ergibt:
 * Die Übersetzung war testbar, das Ergebnis nicht. Jetzt steht die Rechnung
 * hier, ohne React und ohne Netz, und `scripts/test-engine.mjs` stellt ihr
 * dieselben Fragen wie ein Besucher.
 *
 * Eine Abfrage ist ein schlichtes Objekt – Gruppierung, Kennzahlen, Sortierung,
 * Filter – und genau das, was `uebersetze` in frage.js liefert und was in der
 * Adresse steht. Drei Formen, ein Inhalt.
 */

// ------------------------------------------------------------------ Gruppen

/**
 * Worüber gruppiert wird. `schluessel` liefert je Zeile den Gruppenwert,
 * `name` und `id` machen daraus, was in der Tabelle und im Link steht.
 */
export const DIMENSIONEN = {
  fahrer: {
    label: 'Driver', einzahl: 'driver', mehrzahl: 'drivers',
    schluessel: (s, i) => s.fahrer[i], name: (d, k) => d.fahrerNamen[k], id: (d, k) => d.fahrer[k],
    link: (id) => `/drivers/${id}/`,
  },
  team: {
    label: 'Team', einzahl: 'team', mehrzahl: 'teams',
    schluessel: (s, i) => s.team[i], name: (d, k) => d.teamNamen[k], id: (d, k) => d.team[k],
    link: (id) => `/teams/${id}/`,
  },
  motor: {
    label: 'Engine', einzahl: 'engine maker', mehrzahl: 'engine makers',
    schluessel: (s, i) => s.motor[i], name: (d, k) => d.motorNamen[k] ?? '–', id: (d, k) => d.motor[k],
    link: (id) => `/engines/${id}/`,
  },
  nation: {
    label: 'Nationality', einzahl: 'nationality', mehrzahl: 'nationalities',
    schluessel: (s, i, d) => d.fahrerLand[s.fahrer[i]], name: (d, k) => d.landNamen[k] ?? 'Unknown', id: (d, k) => d.land[k] ?? 'unbekannt',
  },
  saison: {
    label: 'Season', einzahl: 'season', mehrzahl: 'seasons',
    schluessel: (s, i) => s.jahr[i], name: (d, k) => String(k), id: (d, k) => k,
    link: (id) => `/seasons/${id}/`,
  },
  jahrzehnt: {
    label: 'Decade', einzahl: 'decade', mehrzahl: 'decades',
    schluessel: (s, i) => Math.floor(s.jahr[i] / 10) * 10, name: (d, k) => `${k}s`, id: (d, k) => k,
  },
  strecke: {
    label: 'Circuit', einzahl: 'circuit', mehrzahl: 'circuits',
    schluessel: (s, i) => s.strecke[i], name: (d, k) => d.streckenNamen[k], id: (d, k) => d.strecke[k],
    link: (id) => `/circuits/${id}/`,
  },
  gp: {
    label: 'Grand Prix', einzahl: 'Grand Prix', mehrzahl: 'Grands Prix',
    schluessel: (s, i) => s.gp[i], name: (d, k) => d.gpNamen[k], id: (d, k) => d.gp[k],
  },
}

// ------------------------------------------------------------------ Kennzahlen

/*
 * Die Kennzahlen. Drei Arten:
 *
 *   gezählt     `zaehle` addiert je Zeile. `art` sagt, welche Zeilen: Rennen,
 *               Sprints oder beide – ein Sprintsieg ist kein Sieg.
 *   gemittelt   dazu `nenner`; am Ende Summe durch Nenner.
 *   abgeleitet  `aus` nennt die Kennzahlen, aus denen `fertig` rechnet – eine
 *               Quote ist Siege durch Starts, nicht eine eigene Zählung.
 *
 * Eine Quote ohne Nenner ist null, nicht null Prozent: Wer nie gestartet ist,
 * hat keine Siegquote.
 */
const quote = (a, b) => (w) => (w[b] > 0 ? w[a] / w[b] : null)
const proz = (v) => `${Math.round(v * 100)}%`
const eineStelle = (v) => v.toFixed(1)
const zweiStellen = (v) => v.toFixed(2)

export const KENNZAHLEN = {
  starts: { label: 'Starts', art: 'rennen', zaehle: (s, i) => s.gestartet[i] },
  siege: { label: 'Wins', art: 'rennen', zaehle: (s, i) => (s.platz[i] === 1 ? 1 : 0) },
  podien: { label: 'Podiums', art: 'rennen', zaehle: (s, i) => (s.gewertet[i] && s.platz[i] >= 1 && s.platz[i] <= 3 ? 1 : 0) },
  poles: { label: 'Poles', art: 'rennen', zaehle: (s, i) => (s.quali[i] === 1 ? 1 : 0) },
  schnellste: { label: 'Fastest laps', art: 'rennen', zaehle: (s, i) => s.schnellste[i] },
  punkte: { label: 'Points', art: 'rennen', zaehle: (s, i) => s.punkte[i] / 100, format: 'punkte' },
  sprintSiege: { label: 'Sprint wins', art: 'sprint', zaehle: (s, i) => (s.platz[i] === 1 ? 1 : 0) },
  sprintPunkte: { label: 'Sprint points', art: 'sprint', zaehle: (s, i) => s.punkte[i] / 100, format: 'punkte' },
  ausfaelle: { label: 'Retirements', art: 'rennen', zaehle: (s, i) => (s.gestartet[i] && !s.gewertet[i] ? 1 : 0) },
  oZiel: {
    label: 'Avg finish', art: 'rennen', aufsteigend: true,
    zaehle: (s, i) => (s.gewertet[i] && s.platz[i] > 0 ? s.platz[i] : 0),
    nenner: (s, i) => (s.gewertet[i] && s.platz[i] > 0 ? 1 : 0),
    format: eineStelle,
  },
  oStart: {
    label: 'Avg grid', art: 'rennen', aufsteigend: true,
    zaehle: (s, i) => (s.gestartet[i] && s.start[i] > 0 ? s.start[i] : 0),
    nenner: (s, i) => (s.gestartet[i] && s.start[i] > 0 ? 1 : 0),
    format: eineStelle,
  },
  gutgemacht: {
    label: 'Positions gained', art: 'rennen',
    zaehle: (s, i) => (s.gewertet[i] && s.platz[i] > 0 && s.start[i] > 0 ? s.start[i] - s.platz[i] : 0),
    format: (v) => (v > 0 ? '+' : '') + Math.round(v),
  },
  siegquote: { label: 'Win rate', aus: ['siege', 'starts'], fertig: quote('siege', 'starts'), format: proz },
  podiumquote: { label: 'Podium rate', aus: ['podien', 'starts'], fertig: quote('podien', 'starts'), format: proz },
  polequote: { label: 'Pole rate', aus: ['poles', 'starts'], fertig: quote('poles', 'starts'), format: proz },
  punkteJeStart: { label: 'Points per start', aus: ['punkte', 'starts'], fertig: quote('punkte', 'starts'), format: zweiStellen },
  normiert: {
    label: 'Share of possible points', art: 'alle',
    /*
     * Punkte durch das, was die gefahrenen Starts höchstens gebracht hätten –
     * je Epoche mit deren eigenem Punktesystem. Der einzige Punktevergleich
     * zwischen 1955 und 2024, der nicht an der Größe der Zahlen hängt.
     */
    zaehle: (s, i) => s.punkte[i] / 100,
    nenner: (s, i) => s.moeglich[i] / 100,
    format: proz,
  },
  verschiedeneSieger: { label: 'Different winners', art: 'rennen', verschieden: (s, i) => (s.platz[i] === 1 ? s.fahrer[i] : null) },
  titel: { label: 'Titles', titel: true },
}

export const STANDARD_KENNZAHLEN = ['starts', 'siege', 'podien', 'poles', 'punkte']

export const LEERER_FILTER = {
  vonJahr: '', bisJahr: '', strecke: '', gp: '', team: '', motor: '', fahrer: '', land: '',
  nurSieger: false, nurVonHinten: false, ohneIndy: false, bedingungen: [],
}

// ------------------------------------------------------------------ Rechnen

/** Welche Filter eine Titelzahl bedeutungslos machen: Ein Titel gehört keiner Strecke. */
const TITEL_OHNE_SINN = ['strecke', 'gp', 'motor', 'team', 'nurSieger', 'nurVonHinten']

/**
 * Eine Abfrage über den Würfel rechnen.
 *
 * @returns {{ reihen: {id, name, link?, werte: Record<string, number|null>}[],
 *             betrachtet: number, gesamt: number, titelOhneSinn: boolean }}
 */
export function rechne(daten, abfrage) {
  const s = daten.spalten
  const n = daten.zeilen
  const f = { ...LEERER_FILTER, ...abfrage.filter }
  const dim = DIMENSIONEN[abfrage.dimension] ?? DIMENSIONEN.fahrer

  // Filter einmal in Indizes übersetzen, statt je Zeile Zeichenketten zu vergleichen.
  const index = (liste, id) => (id ? liste.indexOf(id) : -2)
  const streckeIdx = index(daten.strecke, f.strecke)
  const gpIdx = index(daten.gp, f.gp)
  const teamIdx = index(daten.team, f.team)
  const motorIdx = index(daten.motor, f.motor)
  const fahrerIdx = index(daten.fahrer, f.fahrer)
  const landIdx = index(daten.land, f.land)
  const vonJahr = f.vonJahr ? Number(f.vonJahr) : -Infinity
  const bisJahr = f.bisJahr ? Number(f.bisJahr) : Infinity

  /*
   * Welche Kennzahlen wirklich gerechnet werden müssen: die gezeigten, die
   * sortierte, die in Bedingungen – und alles, woraus eine abgeleitete
   * entsteht. Sonst hinge das Ergebnis davon ab, welche Spalten gerade
   * sichtbar sind; ein Filter, der still nichts tut, ist schlimmer als keiner.
   */
  const noetig = new Set([...abfrage.kennzahlen, abfrage.sortiere, ...(f.bedingungen ?? []).map((b) => b.kennzahl)])
  for (const k of [...noetig]) for (const x of KENNZAHLEN[k]?.aus ?? []) noetig.add(x)
  const gezaehlt = [...noetig].filter((k) => KENNZAHLEN[k] && !KENNZAHLEN[k].aus && !KENNZAHLEN[k].titel)

  const gruppen = new Map()
  let betrachtet = 0

  for (let i = 0; i < n; i++) {
    if (s.jahr[i] < vonJahr || s.jahr[i] > bisJahr) continue
    if (streckeIdx !== -2 && s.strecke[i] !== streckeIdx) continue
    if (gpIdx !== -2 && s.gp[i] !== gpIdx) continue
    if (teamIdx !== -2 && s.team[i] !== teamIdx) continue
    if (motorIdx !== -2 && s.motor[i] !== motorIdx) continue
    if (fahrerIdx !== -2 && s.fahrer[i] !== fahrerIdx) continue
    if (landIdx !== -2 && daten.fahrerLand[s.fahrer[i]] !== landIdx) continue
    if (f.ohneIndy && !s.f1[i]) continue
    const sprint = s.sprint[i] === 1
    // „Nur Siege“ und „von hinten“ meinen Rennen; Sprints fallen dann heraus.
    if (f.nurSieger && (sprint || s.platz[i] !== 1)) continue
    if (f.nurVonHinten && (sprint || !(s.platz[i] === 1 && s.start[i] > 10))) continue

    if (!sprint) betrachtet++
    const schluessel = dim.schluessel(s, i, daten)
    let g = gruppen.get(schluessel)
    if (!g) {
      g = { schluessel, werte: {}, nenner: {}, mengen: {} }
      for (const k of gezaehlt) {
        g.werte[k] = 0
        g.nenner[k] = 0
        if (KENNZAHLEN[k].verschieden) g.mengen[k] = new Set()
      }
      gruppen.set(schluessel, g)
    }

    for (const k of gezaehlt) {
      const kz = KENNZAHLEN[k]
      if (kz.art === 'rennen' && sprint) continue
      if (kz.art === 'sprint' && !sprint) continue
      if (kz.verschieden) {
        const w = kz.verschieden(s, i)
        if (w !== null) g.mengen[k].add(w)
        continue
      }
      g.werte[k] += kz.zaehle(s, i)
      if (kz.nenner) g.nenner[k] += kz.nenner(s, i)
    }
  }

  const titelOhneSinn = TITEL_OHNE_SINN.some((k) => f[k])
  const titelZahl = titelZaehler(daten, abfrage.dimension, { vonJahr, bisJahr, fahrerIdx, landIdx })

  let reihen = [...gruppen.values()].map((g) => {
    const werte = {}
    for (const k of gezaehlt) {
      const kz = KENNZAHLEN[k]
      werte[k] = kz.verschieden
        ? g.mengen[k].size
        : kz.nenner
          ? (g.nenner[k] > 0 ? g.werte[k] / g.nenner[k] : null)
          : g.werte[k]
    }
    for (const k of noetig) {
      const kz = KENNZAHLEN[k]
      if (kz?.aus) werte[k] = kz.fertig(werte)
      if (kz?.titel) werte[k] = titelOhneSinn ? null : titelZahl(g.schluessel)
    }
    const id = dim.id(daten, g.schluessel)
    return { id, name: dim.name(daten, g.schluessel), link: dim.link && id !== undefined ? dim.link(id) : null, werte }
  })

  for (const b of f.bedingungen ?? []) {
    reihen = reihen.filter((r) => {
      const v = r.werte[b.kennzahl]
      if (v === null || v === undefined) return false
      return b.op === '<=' ? v <= b.wert : v >= b.wert
    })
  }

  const auf = abfrage.absteigend === false
  reihen.sort((a, b) => {
    const x = a.werte[abfrage.sortiere]
    const y = b.werte[abfrage.sortiere]
    // Fehlende Werte ans Ende, in beide Richtungen: Ein „–“ ist kein Minimum.
    if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1
    if (y === null || y === undefined) return -1
    return auf ? x - y : y - x
  })

  return { reihen, betrachtet, gesamt: daten.rennzeilen ?? n, titelOhneSinn }
}

/**
 * Titel je Gruppe. Fahrertitel für Fahrer, Nationen, Jahrzehnte und Saisons,
 * Konstrukteurstitel für Teams – und für alles andere keine Zahl.
 */
function titelZaehler(daten, dimension, { vonJahr, bisJahr, fahrerIdx, landIdx }) {
  const imZeitraum = ([, j]) => j >= vonJahr && j <= bisJahr
  const fahrerTitel = (daten.titel?.fahrer ?? []).filter(imZeitraum)
    .filter(([fi]) => fahrerIdx === -2 || fi === fahrerIdx)
    .filter(([fi]) => landIdx === -2 || daten.fahrerLand[fi] === landIdx)
  const zaehle = (liste, schluessel) => {
    const m = new Map()
    for (const t of liste) m.set(schluessel(t), (m.get(schluessel(t)) ?? 0) + 1)
    return (k) => m.get(k) ?? 0
  }
  switch (dimension) {
    case 'fahrer': return zaehle(fahrerTitel, ([fi]) => fi)
    case 'nation': return zaehle(fahrerTitel, ([fi]) => daten.fahrerLand[fi])
    case 'jahrzehnt': return zaehle(fahrerTitel, ([, j]) => Math.floor(j / 10) * 10)
    case 'saison': return zaehle(fahrerTitel, ([, j]) => j)
    case 'team': return zaehle((daten.titel?.team ?? []).filter(imZeitraum), ([ti]) => ti)
    default: return () => null
  }
}

/** Ein Wert für die Anzeige – mit dem Format der Kennzahl und britischer Tausendertrennung. */
const ZAHL = new Intl.NumberFormat('en-GB')
const PUNKTE = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
export function zeige(k, v) {
  if (v === null || v === undefined) return '–'
  const f = KENNZAHLEN[k]?.format
  if (f === 'punkte') return PUNKTE.format(v)
  if (typeof f === 'function') return f(v)
  return ZAHL.format(v)
}

// ------------------------------------------------------------------ Verzeichnis

/**
 * Die Namen, die `uebersetze` in einer Frage sucht – gebaut aus dem Würfel,
 * damit die Übersetzung genau die Kennungen liefert, die `rechne` kennt.
 */
export function verzeichnis(daten) {
  const s = daten.spalten
  const starts = new Array(daten.fahrer.length).fill(0)
  for (let i = 0; i < daten.zeilen; i++) if (!s.sprint[i] && s.gestartet[i]) starts[s.fahrer[i]]++
  const mehrzahl = (w) => (/(?:an|ian|man)$/.test(w) ? [w, `${w}s`] : [w])
  return {
    strecken: daten.strecke.map((id, i) => ({
      id, name: daten.streckenNamen[i],
      namen: [daten.streckenNamen[i], daten.streckenOrte?.[i]].filter(Boolean),
    })),
    teams: daten.team.map((id, i) => ({ id, name: daten.teamNamen[i] })),
    motoren: daten.motor.map((id, i) => ({ id, name: daten.motorNamen[i] })),
    gps: daten.gp.map((id, i) => ({
      id, name: daten.gpNamen[i],
      namen: [daten.gpNamen[i], daten.gpKurz?.[i]].filter(Boolean),
    })),
    fahrer: daten.fahrer.map((id, i) => ({
      id, name: daten.fahrerNamen[i], nachname: daten.fahrerNachnamen?.[i], starts: starts[i],
    })),
    laender: daten.land.map((id, i) => ({
      id, name: daten.landNamen[i], namen: mehrzahl(daten.landNamen[i] ?? ''), land: daten.landLaender?.[i],
    })),
    letztesJahr: daten.letztesJahr,
  }
}

// ------------------------------------------------------------------ Adresse

/*
 * Die Abfrage in der Adresse, damit sich ein Ergebnis verlinken lässt – bisher
 * ging das nur im Vergleich. Kurze Schlüssel, und nur, was vom Standard
 * abweicht: /explorer/?d=team&s=titel&von=2000 ist lesbar genug, um es in
 * einer Nachricht zu verschicken.
 */
const FILTER_SCHLUESSEL = { von: 'vonJahr', bis: 'bisJahr', strecke: 'strecke', gp: 'gp', team: 'team', motor: 'motor', fahrer: 'fahrer', land: 'land' }
const SCHALTER = { sieger: 'nurSieger', hinten: 'nurVonHinten', ohneindy: 'ohneIndy' }

export function alsAdresse(abfrage, frage = '') {
  const p = new URLSearchParams()
  if (frage) p.set('q', frage)
  if (abfrage.dimension !== 'fahrer') p.set('d', abfrage.dimension)
  if (abfrage.kennzahlen.join() !== STANDARD_KENNZAHLEN.join()) p.set('k', abfrage.kennzahlen.join(','))
  if (abfrage.sortiere !== 'siege') p.set('s', abfrage.sortiere)
  if (abfrage.absteigend === false) p.set('r', 'auf')
  const f = abfrage.filter ?? {}
  for (const [kurz, lang] of Object.entries(FILTER_SCHLUESSEL)) if (f[lang]) p.set(kurz, f[lang])
  for (const [kurz, lang] of Object.entries(SCHALTER)) if (f[lang]) p.set(kurz, '1')
  if (f.bedingungen?.length) p.set('b', f.bedingungen.map((b) => `${b.kennzahl}${b.op}${b.wert}`).join(','))
  return p.toString()
}

/** Aus der Adresse zurück – und alles verwerfen, was es nicht gibt. */
export function ausAdresse(suche) {
  const p = new URLSearchParams(suche)
  const kennzahlen = (p.get('k') ?? '').split(',').filter((k) => KENNZAHLEN[k])
  const filter = { ...LEERER_FILTER, bedingungen: [] }
  for (const [kurz, lang] of Object.entries(FILTER_SCHLUESSEL)) {
    const v = p.get(kurz)
    if (v && /^[a-z0-9-]{1,100}$/.test(v)) filter[lang] = v
  }
  for (const [kurz, lang] of Object.entries(SCHALTER)) filter[lang] = p.get(kurz) === '1'
  for (const b of (p.get('b') ?? '').split(',')) {
    const m = /^([a-zA-Z]+)(>=|<=)(-?\d+(?:\.\d+)?)$/.exec(b)
    if (m && KENNZAHLEN[m[1]]) filter.bedingungen.push({ kennzahl: m[1], op: m[2], wert: Number(m[3]) })
  }
  const dimension = DIMENSIONEN[p.get('d')] ? p.get('d') : 'fahrer'
  const sortiere = KENNZAHLEN[p.get('s')] ? p.get('s') : 'siege'
  return {
    frage: (p.get('q') ?? '').slice(0, 300),
    abfrage: {
      dimension,
      kennzahlen: kennzahlen.length ? kennzahlen : STANDARD_KENNZAHLEN,
      sortiere,
      absteigend: p.get('r') !== 'auf',
      filter,
    },
  }
}
