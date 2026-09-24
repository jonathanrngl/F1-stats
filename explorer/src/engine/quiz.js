/**
 * Das Quiz.
 *
 * Jede Frage entsteht beim Bauen aus der Datenbank; keine steht von Hand
 * irgendwo. Das hat zwei Gründe. Quizfragen veralten: „Wer hat die meisten
 * Siege?" hat seit Portugal 2020 eine andere Antwort als davor, und eine
 * gepflegte Liste merkt das nicht. Und so stimmt jede Antwort mit dem überein,
 * was die übrige Seite zeigt – sie kommt aus denselben Zeilen.
 *
 * Eine Frage hat genau eine richtige und drei falsche Antworten. Die falschen
 * sind nicht beliebig: Wer die Wertung eines Jahres kennt, soll zwischen dem
 * Meister und dem Zweiten wählen müssen, nicht zwischen dem Meister und einem
 * Fahrer aus einem anderen Jahrzehnt. Wo die Daten eine naheliegende
 * Verwechslung hergeben, kommen die falschen Antworten deshalb aus derselben
 * Saison, demselben Rennen oder derselben Bestenliste.
 *
 * Die Schwierigkeit hängt an zwei Dingen, die sich aus den Daten ablesen
 * lassen: wie lange etwas her ist und wie bekannt ist, wer darin vorkommt. Den
 * Weltmeister von 2016 kennt, wer die Formel 1 verfolgt; den von 1961 kennt,
 * wer ihre Geschichte kennt.
 *
 * Der Zufall, der die falschen Antworten wählt, ist gesät: Zwei Läufe über
 * dieselbe Datenbank ergeben dieselben Fragen. Gemischt wird erst im Browser.
 */
import { datum, ein, zahl } from '../lib/format.js'
import {
  altersrekord, altersrekordMeister, grandSlams, laengsteKarrieren, laengstePauseZwischenSiegen,
  laengsteSerien, meistePlaetzeGutgemacht, meistePodien, meistePoles, meisteSchnellsteRunden,
  meisteSiege, meisteStarts, teamRekorde, zielabstand,
} from './records.js'

export const BEREICHE = [
  { id: 'fahrer', label: 'Drivers' },
  { id: 'teams', label: 'Teams' },
  { id: 'saisons', label: 'Seasons' },
  { id: 'rennen', label: 'Races' },
  { id: 'strecken', label: 'Circuits' },
  { id: 'rekorde', label: 'Records' },
  { id: 'technik', label: 'Engines & tyres' },
]

export const STUFEN = [
  { id: 1, label: 'Easy' },
  { id: 2, label: 'Medium' },
  { id: 3, label: 'Hard' },
]

/*
 * Höchstzahl je Fragenart und Stufe. Ohne Grenze stellten allein die Saisons
 * fünf Fragen zu jedem der 75 Jahre, und eine gemischte Runde bestünde zur
 * Hälfte aus ihnen. Mit ihr bleibt die Datei bei gut 350 KB – ein Drittel
 * des Datenwürfels, den der Explorer lädt.
 */
const HOECHSTENS = 20

// ------------------------------------------------------------------ Zufall

/**
 * Ein gesäter Zufallsgenerator: gleicher Text, gleiche Folge.
 *
 * FNV-1a macht aus dem Text eine Zahl, mulberry32 daraus die Folge. Beides ist
 * nicht für Kryptographie gedacht, sondern dafür, dass ein Neubau über
 * unveränderte Daten dieselben falschen Antworten wählt – sonst änderte sich
 * die Datei bei jedem Lauf, und niemand sähe mehr, was sich wirklich geändert
 * hat.
 */
export function zufall(saat) {
  let h = 2166136261
  for (let i = 0; i < saat.length; i++) h = Math.imul(h ^ saat.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mische(rnd, liste) {
  const a = [...liste]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ------------------------------------------------------- falsche Antworten

/** Die ersten `n` Kandidaten, die weder doppelt noch die richtige Antwort sind. */
function erste(kandidaten, richtig, n = 3) {
  const aus = []
  for (const x of kandidaten) {
    const s = String(x ?? '')
    if (s && s !== String(richtig) && !aus.includes(s)) aus.push(s)
    if (aus.length === n) break
  }
  return aus
}

const zufaellige = (rnd, kandidaten, richtig, n = 3) => erste(mische(rnd, kandidaten), richtig, n)

/**
 * Drei falsche Zahlen um eine richtige herum.
 *
 * Wie viele davon unter der richtigen liegen, ist gleichverteilt. Nähme man
 * einfach Nachbarn aus beiden Richtungen, stünde die richtige Antwort fast
 * immer in der Mitte – und wer das einmal bemerkt hat, braucht keine Ahnung
 * mehr. Die Grenzen verhindern Unmögliches: kein Sieg vor dem Debüt, keine
 * Saison in der Zukunft.
 */
function zahlen(rnd, richtig, { schritt = 1, min = 0, max = Infinity } = {}) {
  const unten = [1, 2, 3, 4, 5].map((i) => richtig - i * schritt).filter((w) => w >= min)
  const oben = [1, 2, 3, 4, 5].map((i) => richtig + i * schritt).filter((w) => w <= max)
  const vonP = Math.max(0, 3 - oben.length)
  const bisP = Math.min(3, unten.length)
  if (vonP > bisP) return []
  const p = vonP + Math.floor(rnd() * (bisP - vonP + 1))
  // Nicht immer die direkten Nachbarn: aus einer Stufe mehr ziehen, als nötig.
  const u = mische(rnd, unten.slice(0, p + 1)).slice(0, p)
  const o = mische(rnd, oben.slice(0, 4 - p)).slice(0, 3 - p)
  return [...u, ...o]
}

/** Schritt für große Zahlen: Bei 105 Siegen sind 104 und 106 keine Auswahl. */
const schrittFuer = (n) => Math.max(1, Math.round(n * 0.05))

// ------------------------------------------------------------------ Texte

/** „1 win", „12 wins" – mit Tausendertrennung. */
const mal = (n, einzahl, mehrzahl = `${einzahl}s`) => `${zahl(n)} ${n === 1 ? einzahl : mehrzahl}`
const punkte = (n) => `${ein(n)} ${n === 1 ? 'point' : 'points'}`
/** „the 2021 Abu Dhabi Grand Prix" */
const rennenText = (r) => `the ${r.jahr} ${r.gp}`
const liste = (xs, einheit) => `${xs.map((x) => `${x.name} ${zahl(x.wert)}`).join(' · ')} ${einheit}.`
/** „A", „A and B", „A, B and C" */
const und = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
/** Höchstens vier Namen, der Rest als Zahl: „Cooper, BRM, Ferguson and 4 others". */
const undAndere = (xs) => (xs.length <= 4 ? und(xs) : `${xs.slice(0, 3).join(', ')} and ${xs.length - 3} others`)
/** „once", „twice", „3 times" */
const mals = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${zahl(n)} times`)
/** „for the United Kingdom", aber „for France". */
const mitArtikel = (land) =>
  /^(United |Netherlands|Czech Republic|Philippines|Dominican Republic)/.test(land) ? `the ${land}` : land

/**
 * Teilen zwei Namen ein Wort, verrät der eine den anderen: Nach dem Motor
 * von „Red Bull" zu fragen, wenn „Red Bull Ford" zur Wahl steht, ist keine
 * Frage.
 */
const woerter = (s) => s.toLowerCase().split(/[\s-]+/)
const teilenWort = (a, b) => woerter(a).some((w) => woerter(b).includes(w))

/** Ohne Akzente, klein – für den Vergleich, ob ein Name einen anderen verrät. */
const falte = (s) =>
  String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// ---------------------------------------------------------------- Sammler

/**
 * Nimmt Fragen entgegen und weist jede ab, die nicht eindeutig ist.
 *
 * Die Prüfung steht hier und nicht in jedem Erzeuger: Vier verschiedene
 * Antworten, keine leer, keine Kennung doppelt. Wo die Daten zu wenige
 * plausible Verwechslungen hergeben – ein Fahrer mit nur zwei Teams, eine
 * Saison ohne Dritten –, fällt die Frage weg, statt mit einer
 * offensichtlich falschen Antwort aufgefüllt zu werden.
 *
 * Ebenso fällt weg, was sich selbst verrät: „Für welches Team fuhr Jack
 * Brabham 1966?" – Brabham. „Welches Team wurde 2006 zu BMW Sauber?" – Sauber.
 */
function sammler() {
  const fragen = []
  const ids = new Set()
  const stelle = ({ id, bereich, stufe, text, richtig, falsch, erklaerung, link = null, thema = null, zahl: istZahl = false }) => {
    const o = [richtig, ...falsch].map((x) => String(x ?? ''))
    if (falsch.length !== 3 || new Set(o).size !== 4 || o.includes('') || ids.has(id)) return false
    if (!istZahl && text.includes(o[0])) return false
    ids.add(id)
    fragen.push({
      i: id,
      b: bereich,
      s: Math.min(3, Math.max(1, stufe)),
      f: text,
      // Die richtige Antwort steht vorn; gemischt wird im Browser.
      o,
      e: erklaerung,
      l: link,
      t: thema,
      ...(istZahl ? { n: 1 } : {}),
    })
    return true
  }
  return { fragen, stelle }
}

/**
 * „Wer von diesen vier hat die meisten …?"
 *
 * Die Stufe entscheidet, wer in den Topf kommt und wie weit der Erste vorn
 * liegen muss. Leicht: vier Bekannte, der Erste mit deutlichem Abstand. Schwer:
 * auch weniger Bekannte, und der Erste nur knapp vorn – dann muss man es
 * wissen, nicht schätzen.
 */
function vergleiche(stelle, { id, bereich, text, einheit, eintraege, stufen, link = 'records/', thema }) {
  for (const { stufe, topf, abstand, anzahl } of stufen) {
    const kandidaten = eintraege.filter(topf)
    const rnd = zufall(`${id}-${stufe}`)
    const gesehen = new Set()
    let gestellt = 0
    for (let versuch = 0; versuch < 400 && gestellt < anzahl && kandidaten.length >= 4; versuch++) {
      const vier = mische(rnd, kandidaten).slice(0, 4).sort((a, b) => b.wert - a.wert)
      const schluessel = vier.map((x) => x.name).sort().join('|')
      if (gesehen.has(schluessel) || !abstand(vier[0].wert, vier[1].wert)) continue
      gesehen.add(schluessel)
      const ok = stelle({
        id: `${id}-${stufe}-${gestellt + 1}`, bereich, stufe, thema, link, text,
        richtig: vier[0].name,
        falsch: vier.slice(1).map((x) => x.name),
        erklaerung: liste(vier, einheit),
      })
      if (ok) gestellt++
    }
  }
}

const deutlich = (a, b) => a >= b * 1.5 && a - b >= 3
const klar = (a, b) => a >= b * 1.15 && a - b >= 2
const knapp = (a, b) => a > b && a <= b * 1.2

// ----------------------------------------------------------------- Kontext

/** Was fast jeder Erzeuger braucht, einmal gelesen. */
function kontext(db) {
  const alle = (sql, ...p) => db.prepare(sql).all(...p)

  const saisons = alle(`
    SELECT s.year AS jahr, s.has_constructors_championship AS teamWM,
           COUNT(r.id) AS rennen,
           SUM(r.formula_one = 0) AS indy,
           SUM(NOT EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)) AS offen
      FROM season s JOIN race r ON r.year = s.year
     GROUP BY s.year ORDER BY s.year`)

  /*
   * Abgeschlossen ist eine Saison, wenn jedes ihrer Rennen ein Ergebnis hat.
   * Die laufende bekommt keine Fragen nach Meister und Endstand – die Antwort
   * stünde noch nicht fest.
   */
  const fertig = saisons.filter((s) => s.offen === 0)
  const aktuell = fertig.at(-1).jahr
  const neuestes = saisons.filter((s) => s.offen < s.rennen).at(-1).jahr

  const meisterJahre = alle(`
    SELECT year AS jahr, driver_id AS id FROM season_driver_standing
     WHERE championship_won = 1 ORDER BY year`)
  const titel = new Map()
  for (const m of meisterJahre) titel.set(m.id, [...(titel.get(m.id) ?? []), m.jahr])

  const fahrer = alle(`
    SELECT d.id, d.display_name AS name, c.name AS land, d.permanent_number AS nummer,
           COUNT(DISTINCT CASE WHEN rr.started = 1 THEN rr.race_id END) AS starts,
           COUNT(DISTINCT CASE WHEN rr.position = 1 THEN rr.race_id END) AS siege,
           COUNT(DISTINCT CASE WHEN rr.qualifying_position = 1 THEN rr.race_id END) AS poles,
           COUNT(DISTINCT CASE WHEN rr.classified = 1 AND rr.position <= 3 THEN rr.race_id END) AS podien,
           MIN(r.year) AS von, MAX(r.year) AS bis, MAX(r.formula_one) AS f1
      FROM driver d
      JOIN race_result rr ON rr.driver_id = d.id
      JOIN race r ON r.id = rr.race_id
      LEFT JOIN country c ON c.id = d.nationality_id
     GROUP BY d.id`).map((f) => ({ ...f, titel: titel.get(f.id) ?? [], aktiv: f.bis === neuestes }))

  const rennen = alle(`
    SELECT r.id, r.year AS jahr, r.round AS runde, r.date AS datum, r.formula_one AS f1,
           g.id AS gpId, g.full_name AS gp, z.id AS streckeId, z.name AS strecke,
           EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id) AS gefahren
      FROM race r
      JOIN grand_prix g ON g.id = r.grand_prix_id
      JOIN circuit z ON z.id = r.circuit_id
     ORDER BY r.date`)

  const teamsImJahr = db.prepare(`
    SELECT k.id, k.name, SUM(rr.points) AS punkte, COUNT(*) AS n
      FROM race_result rr
      JOIN race r ON r.id = rr.race_id
      JOIN constructor k ON k.id = rr.constructor_id
     WHERE r.year = ? AND r.formula_one = 1
     GROUP BY k.id ORDER BY punkte DESC, n DESC`)

  return {
    saisons,
    fertig,
    aktuell,
    neuestes,
    meisterJahre,
    fahrer,
    fahrerNach: new Map(fahrer.map((f) => [f.id, f])),
    rennen,
    rennenNach: new Map(rennen.map((r) => [r.id, r])),
    /** Teams eines Jahres, die stärksten zuerst – der Vorrat für falsche Antworten. */
    teamsImJahr: (jahr) => teamsImJahr.all(jahr),

    /**
     * Die zwölf jüngsten abgeschlossenen Saisons sind leicht, von 1985 an
     * mittel, davor schwer. 1985 ist keine Laune: Ab da laufen die Jahre, in
     * denen Senna, Prost und Schumacher fuhren, und die kennt auch, wer die
     * Formel 1 erst seit einigen Jahren verfolgt.
     */
    stufeNachJahr: (jahr) => (jahr >= aktuell - 12 ? 1 : jahr >= 1985 ? 2 : 3),

    /**
     * Wie bekannt ein Fahrer ist, abgelesen an Titeln, Siegen und Zeit.
     * Hamilton, Senna und Clark sind leicht, Coulthard und Moss mittel,
     * Wolfgang von Trips schwer.
     */
    bekanntheit: (f) => {
      const juengst = f.bis >= aktuell - 12
      if ((f.titel.length > 0 && f.bis >= 1985) || f.siege >= 20 || (juengst && f.siege >= 3)) return 1
      if (f.titel.length > 0 || f.siege >= 8 || (f.bis >= 1995 && f.siege >= 1)) return 2
      return 3
    },
  }
}

// ----------------------------------------------------------------- Saisons

function saisonFragen(db, k, { stelle }) {
  const wertung = db.prepare(`
    SELECT sds.driver_id AS id, d.display_name AS name, sds.position AS pos,
           sds.points AS punkte, sds.championship_won AS meister
      FROM season_driver_standing sds JOIN driver d ON d.id = sds.driver_id
     WHERE sds.year = ? AND sds.position IS NOT NULL
     ORDER BY sds.position LIMIT 8`)
  const kalender = db.prepare(`
    SELECT r.id, r.round AS runde, g.full_name AS gp, r.drivers_title_decider AS entscheidung
      FROM race r JOIN grand_prix g ON g.id = r.grand_prix_id
     WHERE r.year = ? ORDER BY r.round`)
  // Ohne Indianapolis: Dessen Sieger sollen nicht als falsche Antwort neben Moss stehen.
  const siegeImJahr = db.prepare(`
    SELECT rr.driver_id AS id, d.display_name AS name, COUNT(DISTINCT rr.race_id) AS n
      FROM race_result rr
      JOIN race r ON r.id = rr.race_id
      JOIN driver d ON d.id = rr.driver_id
     WHERE r.year = ? AND rr.position = 1 AND r.formula_one = 1
     GROUP BY rr.driver_id ORDER BY n DESC, d.last_name`)

  for (const s of k.fertig) {
    const w = wertung.all(s.jahr)
    const m = w.find((x) => x.meister)
    const z = w.find((x) => x.pos === 2 && x !== m)
    if (!m || !z) continue
    const dritter = w.find((x) => x.pos === 3)
    const stufe = k.stufeNachJahr(s.jahr)
    const thema = `s${s.jahr}`
    const link = `seasons/${s.jahr}/`

    stelle({
      id: `wm-${s.jahr}`, bereich: 'saisons', stufe, thema, link,
      text: `Who won the ${s.jahr} drivers' championship?`,
      // Die falschen Antworten sind die Nächstplatzierten: die Verwechslung,
      // die wirklich naheliegt.
      richtig: m.name,
      falsch: erste(w.filter((x) => x !== m).map((x) => x.name), m.name),
      erklaerung: `${m.name} took the title with ${punkte(m.punkte)}, ${punkte(m.punkte - z.punkte)} ahead of ${z.name}.`,
    })

    stelle({
      id: `vize-${s.jahr}`, bereich: 'saisons', stufe: stufe + 1, thema, link,
      text: `Who finished runner-up to ${m.name} in the ${s.jahr} championship?`,
      richtig: z.name,
      falsch: erste(w.filter((x) => x.pos > 2).map((x) => x.name), z.name),
      erklaerung:
        `${z.name} ended the season ${punkte(m.punkte - z.punkte)} behind ${m.name}` +
        (dritter ? `, with ${dritter.name} third.` : '.'),
    })

    /*
     * Die Entscheidung steht als Merkmal in den Daten. Die falschen Antworten
     * sind die Rennen rundherum – wer ungefähr weiß, wann es knapp wurde, soll
     * trotzdem wissen müssen, wo.
     */
    const kal = kalender.all(s.jahr)
    const e = kal.find((r) => r.entscheidung)
    if (e) {
      const umher = kal
        .filter((r) => r !== e)
        .sort((a, b) => Math.abs(a.runde - e.runde) - Math.abs(b.runde - e.runde) || b.runde - a.runde)
      const offen = kal.length - e.runde
      stelle({
        id: `entscheidung-${s.jahr}`, bereich: 'saisons', stufe: s.jahr >= k.aktuell - 12 ? 2 : 3, thema,
        link: `races/${e.id}/`,
        text: `At which race did ${m.name} clinch the ${s.jahr} title?`,
        richtig: e.gp,
        falsch: erste(umher.map((r) => r.gp), e.gp),
        erklaerung:
          offen === 0
            ? `It went down to the last race: the ${e.gp}, round ${e.runde} of ${kal.length}.`
            : `The title was settled at the ${e.gp}, round ${e.runde} of ${kal.length}, with ${mal(offen, 'race')} still to go.`,
      })
    }

    stelle({
      id: `rennzahl-${s.jahr}`, bereich: 'saisons', stufe: s.jahr >= k.aktuell - 5 ? 2 : 3, thema, link,
      zahl: true,
      text: `How many World Championship races were held in ${s.jahr}?`,
      richtig: String(s.rennen),
      falsch: zahlen(zufall(`rennzahl-${s.jahr}`), s.rennen, { min: 1 }).map(String),
      erklaerung: s.indy
        ? `${s.rennen}, including the Indianapolis 500, which counted towards the championship from 1950 to 1960.`
        : `The ${s.jahr} calendar had ${s.rennen} races.`,
    })

    const siege = siegeImJahr.all(s.jahr)
    const mSiege = siege.find((x) => x.id === m.id)?.n ?? 0
    const [a, b] = siege
    const mehrAlsMeister = a && a.id !== m.id && a.n > mSiege

    stelle({
      id: `meistersiege-${s.jahr}`, bereich: 'saisons', stufe: stufe + 1, thema, link, zahl: true,
      text: `How many races did ${m.name} win on the way to the ${s.jahr} title?`,
      richtig: String(mSiege),
      falsch: zahlen(zufall(`meistersiege-${s.jahr}`), mSiege, { max: s.rennen }).map(String),
      erklaerung:
        `${mal(mSiege, 'win')} from ${mal(s.rennen, 'race')}.` +
        (mehrAlsMeister ? ` ${a.name} won more (${a.n}) but not the title.` : ''),
    })

    /*
     * Die Fangfrage: Wer am meisten gewann, war nicht immer Meister – Massa
     * 2008, Prost 1984. Der Meister steht deshalb als erste falsche Antwort
     * zur Wahl.
     */
    if (mehrAlsMeister && (!b || a.n > b.n)) {
      stelle({
        id: `meistesiege-${s.jahr}`, bereich: 'saisons', stufe: stufe + 1, thema, link,
        text: `Who won the most races in ${s.jahr}?`,
        richtig: a.name,
        falsch: erste([m.name, ...siege.slice(1).map((x) => x.name), ...w.map((x) => x.name)], a.name),
        erklaerung: `${a.name} won ${a.n}, but the title went to ${m.name} with ${mSiege}.`,
      })
    }
  }
}

// ------------------------------------------------------------------ Fahrer

function fahrerFragen(db, k, { stelle }) {
  const sieger = k.fahrer.filter((f) => f.siege > 0 && f.f1)
  const laender = [...new Set(sieger.map((f) => f.land).filter(Boolean))]
  const zeitraum = (f) =>
    f.aktiv ? `since ${f.von}` : f.von === f.bis ? `in ${f.von}` : `between ${f.von} and ${f.bis}`

  for (const f of sieger) {
    if (!f.land) continue
    stelle({
      id: `land-${f.id}`, bereich: 'fahrer', stufe: k.bekanntheit(f), thema: `d:${f.id}`,
      link: `drivers/${f.id}/`,
      text: `Which country ${f.aktiv ? 'does' : 'did'} ${f.name} race for?`,
      richtig: f.land,
      falsch: zufaellige(zufall(`land-${f.id}`), laender, f.land),
      erklaerung: `${f.name} ${f.aktiv ? 'races' : 'raced'} for ${mitArtikel(f.land)}: ${mal(f.starts, 'start')} and ${mal(f.siege, 'win')} ${zeitraum(f)}.`,
    })
  }

  for (const f of k.fahrer.filter((x) => x.titel.length > 0)) {
    const n = f.titel.length
    const letzter = f.titel.at(-1)
    stelle({
      id: `titelzahl-${f.id}`, bereich: 'fahrer', stufe: letzter >= 2000 ? 1 : letzter >= 1970 ? 2 : 3,
      thema: `d:${f.id}`, link: `drivers/${f.id}/`, zahl: true,
      text: f.aktiv
        ? `How many world championships has ${f.name} won?`
        : `How many world championships did ${f.name} win?`,
      richtig: String(n),
      falsch: zahlen(zufall(`titelzahl-${f.id}`), n, { min: 1 }).map(String),
      erklaerung: `${n === 1 ? 'One title' : `${n} titles`}: ${f.titel.join(', ')}.`,
    })
  }

  const ersterSieg = db.prepare(`
    SELECT r.id, r.year AS jahr, g.full_name AS gp,
           (SELECT COUNT(DISTINCT x.race_id) FROM race_result x JOIN race rx ON rx.id = x.race_id
             WHERE x.driver_id = rr.driver_id AND x.started = 1 AND rx.date <= r.date) AS start
      FROM race_result rr
      JOIN race r ON r.id = rr.race_id
      JOIN grand_prix g ON g.id = r.grand_prix_id
     WHERE rr.driver_id = ? AND rr.position = 1
     ORDER BY r.date LIMIT 1`)

  for (const f of sieger.filter((x) => x.siege >= 3)) {
    const e = ersterSieg.get(f.id)
    stelle({
      id: `erstersieg-${f.id}`, bereich: 'fahrer', stufe: k.bekanntheit(f) === 1 ? 2 : 3,
      thema: `d:${f.id}`, link: `races/${e.id}/`, zahl: true,
      text: `In which year did ${f.name} win a Grand Prix for the first time?`,
      richtig: String(e.jahr),
      falsch: zahlen(zufall(`erstersieg-${f.id}`), e.jahr, { min: f.von, max: k.neuestes }).map(String),
      erklaerung: `${f.name}'s first win came at ${rennenText(e)}, in career start number ${e.start}.`,
    })
  }

  // --- Meisterjahre: Team und Teamkollege

  const teamDesFahrers = db.prepare(`
    SELECT rr.constructor_id AS id, k.name, COUNT(*) AS n
      FROM race_result rr
      JOIN race r ON r.id = rr.race_id
      JOIN constructor k ON k.id = rr.constructor_id
     WHERE rr.driver_id = ? AND r.year = ?
     GROUP BY rr.constructor_id ORDER BY n DESC`)
  const karriereTeams = db.prepare(`
    SELECT k.name, COUNT(*) AS n
      FROM race_result rr JOIN constructor k ON k.id = rr.constructor_id
     WHERE rr.driver_id = ?
     GROUP BY k.id ORDER BY n DESC`)
  const kollegen = db.prepare(`
    SELECT rr.driver_id AS id, d.display_name AS name, COUNT(DISTINCT rr.race_id) AS n
      FROM race_result rr
      JOIN race r ON r.id = rr.race_id
      JOIN driver d ON d.id = rr.driver_id
     WHERE r.year = ? AND rr.constructor_id = ? AND rr.driver_id <> ? AND r.formula_one = 1
     GROUP BY rr.driver_id ORDER BY n DESC`)
  const fahrerImJahr = db.prepare(`
    SELECT d.display_name AS name
      FROM season_driver_standing sds JOIN driver d ON d.id = sds.driver_id
     WHERE sds.year = ? AND sds.position IS NOT NULL
     ORDER BY sds.position LIMIT 10`)
  const fahrerImTeam = db.prepare(`
    SELECT DISTINCT d.display_name AS name
      FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN driver d ON d.id = rr.driver_id
     WHERE r.year = ? AND rr.constructor_id = ?`)

  for (const { jahr, id } of k.meisterJahre) {
    const f = k.fahrerNach.get(id)
    const s = k.saisons.find((x) => x.jahr === jahr)
    if (!f || !k.fertig.includes(s)) continue

    /*
     * Fangio fuhr 1954 für Maserati und für Mercedes. Mit welchem Team er den
     * Titel gewann, hat dann keine eine Antwort – solche Jahre fallen heraus.
     */
    const teams = teamDesFahrers.all(f.id, jahr)
    if (teams.length !== 1) continue
    const team = teams[0]
    const rnd = zufall(`meisterteam-${jahr}`)
    const nummer = f.titel.indexOf(jahr) + 1

    stelle({
      id: `meisterteam-${jahr}`, bereich: 'fahrer', stufe: k.stufeNachJahr(jahr), thema: `s${jahr}`,
      link: `teams/${team.id}/`,
      text: `Which team did ${f.name} drive for when winning the ${jahr} title?`,
      // Erst die anderen Teams seiner Karriere, dann die Spitze des Jahres.
      richtig: team.name,
      falsch: erste(
        [...karriereTeams.all(f.id).map((t) => t.name), ...mische(rnd, k.teamsImJahr(jahr).slice(0, 5).map((t) => t.name))],
        team.name,
      ),
      erklaerung:
        `${f.name} won the ${jahr} championship with ${team.name}` +
        (f.titel.length > 1 ? ` – title ${nummer} of ${f.titel.length}.` : '.'),
    })

    /*
     * Der Teamkollege, aber nur, wenn es einen gab. In den 1950ern setzten
     * Teams drei, vier Wagen ein, und wer „der" Teamkollege war, ist dann
     * Ansichtssache. Verlangt wird einer, der den größten Teil der Saison
     * fuhr, und kein zweiter, der ihm das streitig macht.
     */
    const imJahr = k.rennen.filter((r) => r.jahr === jahr && r.f1).length
    const [k1, k2] = kollegen.all(jahr, team.id, f.id)
    if (!k1 || k1.n < imJahr * 0.6 || (k2 && k2.n > imJahr * 0.25)) continue
    // Falsch sind Fahrer anderer Teams – wer im selben Team saß, wäre es nicht.
    const imTeam = new Set(fahrerImTeam.all(jahr, team.id).map((x) => x.name))
    const andere = fahrerImJahr.all(jahr).map((x) => x.name).filter((n) => !imTeam.has(n))

    stelle({
      id: `kollege-${jahr}`, bereich: 'fahrer', stufe: k.stufeNachJahr(jahr), thema: `s${jahr}`,
      link: `drivers/${k1.id}/`,
      text: `Who was ${f.name}'s team-mate at ${team.name} in ${jahr}?`,
      richtig: k1.name,
      falsch: erste(mische(rnd, andere.slice(0, 6)), k1.name),
      erklaerung: `${k1.name} drove the other ${team.name} in ${k1.n} of the ${imJahr} races that year.`,
    })
  }

  /*
   * Startnummern gibt es seit 2014. F1DB führt sie nur für Fahrer, die heute
   * noch eine tragen oder deren Nummer gesperrt ist; eine zweimal vergebene
   * Nummer fiele trotzdem heraus, weil die Frage dann zwei Antworten hätte.
   */
  const mitNummer = k.fahrer.filter((f) => f.nummer && f.starts > 0)
  const vergeben = new Map()
  for (const f of mitNummer) vergeben.set(f.nummer, (vergeben.get(f.nummer) ?? 0) + 1)
  for (const f of mitNummer.filter((x) => vergeben.get(x.nummer) === 1)) {
    stelle({
      id: `nummer-${f.id}`, bereich: 'fahrer', stufe: f.starts >= 100 ? 1 : 2, thema: `d:${f.id}`,
      link: `drivers/${f.id}/`,
      text: `Which driver has ${f.nummer} as their permanent race number?`,
      richtig: f.name,
      falsch: zufaellige(zufall(`nummer-${f.id}`), mitNummer.map((x) => x.name), f.name),
      erklaerung: `Drivers have chosen a permanent number since 2014. Number ${f.nummer} belongs to ${f.name}.`,
    })
  }

  /*
   * Wer nie Meister wurde, obwohl er oft gewann. Die drei falschen Antworten
   * sind Meister aus denselben Jahren – Moss neben Hawthorn und Brabham, nicht
   * neben Verstappen.
   */
  const meister = k.fahrer.filter((f) => f.titel.length > 0 && f.f1)
  for (const f of k.fahrer.filter((x) => x.titel.length === 0 && x.siege >= 5 && x.f1)) {
    const zeitgleich = meister.filter((m) => m.von <= f.bis + 5 && m.bis >= f.von - 5)
    stelle({
      id: `niemeister-${f.id}`, bereich: 'fahrer', stufe: k.bekanntheit(f), thema: `d:${f.id}`,
      link: `drivers/${f.id}/`,
      text: 'Which of these drivers has never been world champion?',
      richtig: f.name,
      falsch: zufaellige(zufall(`niemeister-${f.id}`), zeitgleich.map((m) => m.name), f.name),
      erklaerung: `${f.name} has ${mal(f.siege, 'Grand Prix win')} but no title. The other three were all world champions.`,
    })
  }

  const eintraege = (feld) =>
    k.fahrer.filter((f) => f.f1).map((f) => ({ name: f.name, wert: f[feld], bek: k.bekanntheit(f) }))
  const stufen = (min) => [
    { stufe: 1, topf: (x) => x.bek === 1 && x.wert >= min, abstand: deutlich, anzahl: 8 },
    { stufe: 2, topf: (x) => x.bek <= 2 && x.wert >= min, abstand: klar, anzahl: 8 },
    { stufe: 3, topf: (x) => x.wert >= Math.max(2, min / 2), abstand: knapp, anzahl: 8 },
  ]
  vergleiche(stelle, {
    id: 'vgsiege', bereich: 'fahrer', thema: 'v:siege', einheit: 'wins', eintraege: eintraege('siege'),
    text: 'Which of these drivers has won the most Grands Prix?', stufen: stufen(4),
  })
  vergleiche(stelle, {
    id: 'vgpoles', bereich: 'fahrer', thema: 'v:poles', einheit: 'pole positions', eintraege: eintraege('poles'),
    text: 'Which of these drivers has taken the most pole positions?', stufen: stufen(4),
  })
  vergleiche(stelle, {
    id: 'vgpodien', bereich: 'fahrer', thema: 'v:podien', einheit: 'podiums', eintraege: eintraege('podien'),
    text: 'Which of these drivers has finished on the podium most often?', stufen: stufen(10),
  })
  vergleiche(stelle, {
    id: 'vgstarts', bereich: 'fahrer', thema: 'v:starts', einheit: 'starts', eintraege: eintraege('starts'),
    text: 'Which of these drivers has started the most Grands Prix?', stufen: stufen(50),
  })
}

// ------------------------------------------------------------------- Teams

function teamFragen(db, k, { stelle }) {
  /*
   * Nur Formel-1-Rennen: Die Chassisbauer des Indianapolis 500 der 1950er –
   * Kurtis Kraft, Watson, Epperly – zählen zur Meisterschaft, sind aber
   * keine Formel-1-Teams, und nach ihnen zu fragen hieße raten lassen.
   */
  const teams = db
    .prepare(`
      SELECT k.id, k.name, c.name AS land,
             COUNT(DISTINCT CASE WHEN rr.position = 1 THEN rr.race_id END) AS siege,
             COUNT(DISTINCT CASE WHEN rr.qualifying_position = 1 THEN rr.race_id END) AS poles,
             MIN(r.year) AS von, MAX(r.year) AS bis,
             (SELECT COUNT(*) FROM season_constructor_standing s
               WHERE s.constructor_id = k.id AND s.championship_won = 1) AS titel
        FROM constructor k
        JOIN race_result rr ON rr.constructor_id = k.id
        JOIN race r ON r.id = rr.race_id
        LEFT JOIN country c ON c.id = k.nationality_id
       WHERE r.formula_one = 1
       GROUP BY k.id`)
    .all()
    .map((t) => ({ ...t, aktiv: t.bis === k.neuestes }))

  const bekanntheit = (t) =>
    t.siege >= 100 ? 1 : t.siege >= 10 || (t.bis >= k.aktuell - 3 && t.siege > 0) ? 2 : 3

  const teamWertung = db.prepare(`
    SELECT scs.constructor_id AS id, k.name, scs.position AS pos, scs.points AS punkte,
           scs.championship_won AS meister
      FROM season_constructor_standing scs JOIN constructor k ON k.id = scs.constructor_id
     WHERE scs.year = ? AND scs.position IS NOT NULL
     ORDER BY scs.position LIMIT 6`)

  for (const s of k.fertig.filter((x) => x.teamWM)) {
    const w = teamWertung.all(s.jahr)
    const m = w.find((x) => x.meister)
    const z = w.find((x) => x !== m)
    if (!m || !z) continue
    stelle({
      id: `teamwm-${s.jahr}`, bereich: 'teams', stufe: k.stufeNachJahr(s.jahr), thema: `s${s.jahr}`,
      link: `teams/${m.id}/`,
      text: `Which team won the ${s.jahr} constructors' championship?`,
      richtig: m.name,
      falsch: erste(w.filter((x) => x !== m).map((x) => x.name), m.name),
      erklaerung: `${m.name} scored ${punkte(m.punkte)}, ${punkte(m.punkte - z.punkte)} more than ${z.name}.`,
    })
  }

  /*
   * Die Nationalität eines Teams folgt seiner Lizenz, nicht dem Werk: Red
   * Bull ist Österreicher, obwohl es in Milton Keynes baut, Benetton war
   * Italiener. Das ist die eigentliche Pointe der Frage, und die Erklärung
   * sagt es dazu.
   */
  const mitSieg = teams.filter((t) => t.siege > 0 && t.land)
  const teamLaender = [...new Set(mitSieg.map((t) => t.land))]
  for (const t of mitSieg) {
    stelle({
      id: `teamland-${t.id}`, bereich: 'teams', stufe: bekanntheit(t), thema: `t:${t.id}`,
      link: `teams/${t.id}/`,
      text: `Which country ${t.aktiv ? 'does' : 'did'} ${t.name} represent?`,
      richtig: t.land,
      falsch: zufaellige(zufall(`teamland-${t.id}`), teamLaender, t.land),
      erklaerung: `${t.name} ${t.aktiv ? 'races' : 'raced'} under the flag of ${mitArtikel(t.land)}. A team's nationality follows its licence, not necessarily the country its factory is in.`,
    })
  }

  /*
   * Namenswechsel: Jaguar wurde Red Bull, Brawn wurde Mercedes. Gefragt wird
   * vom neuen Namen zurück, denn den kennt man – den alten zu wissen, ist
   * die Leistung.
   *
   * Die falschen Antworten sind Teams, die im Jahr davor ihre letzte Saison
   * fuhren – aus denen hätte das neue Team ebenso gut hervorgehen können.
   * Danach kommt das hintere Feld desselben Jahres. Ferrari als Vorgänger von
   * BMW Sauber anzubieten, wäre keine Verwechslung, sondern ein Geschenk.
   */
  const letztesJahr = new Map(teams.map((t) => [t.name, t.bis]))
  const kette = db
    .prepare(`
      SELECT cc.parent_id AS linie, cc.constructor_id AS id, k.name, cc.sort_order,
             cc.year_from AS von, cc.year_to AS bis
        FROM constructor_chronology cc JOIN constructor k ON k.id = cc.constructor_id
       ORDER BY cc.parent_id, cc.sort_order`)
    .all()
  const linien = new Map()
  for (const e of kette) linien.set(e.linie, [...(linien.get(e.linie) ?? []), e])
  const gesehen = new Set()
  for (const glieder of linien.values()) {
    const namen = new Set(glieder.map((g) => g.name))
    const heute = glieder.at(-1)
    for (let i = 1; i < glieder.length; i++) {
      const [a, b] = [glieder[i - 1], glieder[i]]
      const schluessel = `${a.id}>${b.id}@${b.von}`
      if (a.name === b.name || gesehen.has(schluessel)) continue
      gesehen.add(schluessel)
      const rnd = zufall(schluessel)
      const damals = k.teamsImJahr(b.von - 1).map((t) => t.name).filter((n) => !namen.has(n))
      const aufgehoert = damals.filter((n) => letztesJahr.get(n) === b.von - 1)
      const hinten = damals.slice(3).filter((n) => !aufgehoert.includes(n))
      stelle({
        id: `vorgaenger-${a.id}-${b.id}-${b.von}`, bereich: 'teams',
        stufe: b.von >= k.aktuell - 8 ? 1 : b.von >= 1995 ? 2 : 3, thema: `t:${b.id}`,
        link: `teams/${b.id}/`,
        text: `Which team became ${b.name} in ${b.von}?`,
        richtig: a.name,
        falsch: erste([...mische(rnd, aufgehoert), ...mische(rnd, hinten), ...damals], a.name),
        erklaerung:
          `${a.name} raced from ${a.von} to ${a.bis} and continued as ${b.name} from ${b.von}.` +
          (heute !== b && heute.bis === null ? ` Today the team races as ${heute.name}.` : ''),
      })
    }
  }

  const ersteRennen = db.prepare(`
    SELECT r.id, r.year AS jahr, g.full_name AS gp
      FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN grand_prix g ON g.id = r.grand_prix_id
     WHERE rr.constructor_id = ? AND r.formula_one = 1
     ORDER BY r.date LIMIT 1`)
  for (const t of mitSieg) {
    const e = ersteRennen.get(t.id)
    stelle({
      id: `debuet-${t.id}`, bereich: 'teams', stufe: bekanntheit(t) === 1 ? 2 : 3, thema: `t:${t.id}`,
      link: `teams/${t.id}/`, zahl: true,
      text: `In which year did ${t.name} make its World Championship debut?`,
      richtig: String(e.jahr),
      falsch: zahlen(zufall(`debuet-${t.id}`), e.jahr, { min: 1950, max: k.neuestes }).map(String),
      erklaerung: `${t.name} first raced at ${rennenText(e)}.`,
    })
  }

  const titelJahre = db.prepare(`
    SELECT year FROM season_constructor_standing
     WHERE constructor_id = ? AND championship_won = 1 ORDER BY year`)
  for (const t of teams.filter((x) => x.titel > 0)) {
    const jahre = titelJahre.all(t.id).map((x) => x.year)
    stelle({
      id: `teamtitel-${t.id}`, bereich: 'teams', stufe: bekanntheit(t) === 1 ? 2 : 3, thema: `t:${t.id}`,
      link: `teams/${t.id}/`, zahl: true,
      text: t.aktiv
        ? `How many constructors' championships has ${t.name} won?`
        : `How many constructors' championships did ${t.name} win?`,
      richtig: String(t.titel),
      falsch: zahlen(zufall(`teamtitel-${t.id}`), t.titel, { min: 1 }).map(String),
      erklaerung: `${t.titel === 1 ? 'One title' : `${t.titel} titles`}: ${jahre.join(', ')}.`,
    })
  }

  const siegerFuer = db.prepare(`
    SELECT rr.driver_id AS id, d.display_name AS name, COUNT(DISTINCT rr.race_id) AS n, MAX(r.year) AS bis
      FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN driver d ON d.id = rr.driver_id
     WHERE rr.constructor_id = ? AND rr.position = 1
     GROUP BY rr.driver_id ORDER BY n DESC, d.last_name LIMIT 6`)
  for (const t of teams.filter((x) => x.siege >= 20)) {
    const [a, b, ...rest] = siegerFuer.all(t.id)
    if (!b || a.n === b.n) continue
    stelle({
      id: `teamsieger-${t.id}`, bereich: 'teams',
      stufe: a.bis >= k.aktuell - 12 ? 1 : bekanntheit(t) <= 2 ? 2 : 3, thema: `t:${t.id}`,
      link: `teams/${t.id}/`,
      text: `Who has won more races for ${t.name} than any other driver?`,
      richtig: a.name,
      falsch: erste([b, ...rest].map((x) => x.name), a.name),
      erklaerung: `${a.name} won ${a.n} times for ${t.name}; ${b.name} follows with ${b.n}.`,
    })
  }

  /*
   * Nur fünf Teams haben hundert Siege. Vier davon mit deutlichem Abstand
   * gibt es kaum, deshalb reicht für „leicht" schon ein bekanntes Team im
   * Mittelfeld der Geschichte – Ferrari gegen Tyrrell ist trotzdem leicht.
   */
  const eintraege = (feld) => teams.map((t) => ({ name: t.name, wert: t[feld], bek: bekanntheit(t) }))
  const stufen = (min) => [
    { stufe: 1, topf: (x) => x.bek <= 2 && x.wert >= min * 5, abstand: deutlich, anzahl: 6 },
    { stufe: 2, topf: (x) => x.bek <= 2 && x.wert >= min, abstand: klar, anzahl: 6 },
    { stufe: 3, topf: (x) => x.wert >= min, abstand: knapp, anzahl: 6 },
  ]
  vergleiche(stelle, {
    id: 'vgteamsiege', bereich: 'teams', thema: 'v:teamsiege', einheit: 'wins', eintraege: eintraege('siege'),
    text: 'Which of these teams has won the most Grands Prix?', stufen: stufen(2),
  })
  vergleiche(stelle, {
    id: 'vgteampoles', bereich: 'teams', thema: 'v:teampoles', einheit: 'pole positions', eintraege: eintraege('poles'),
    text: 'Which of these teams has taken the most pole positions?', stufen: stufen(2),
  })
}

// ------------------------------------------------------------------ Rennen

function rennenFragen(db, k, { stelle }) {
  /*
   * Ohne Indianapolis: Wer 1953 das Indy 500 gewann, ist eine Frage an die
   * amerikanische Rennsportgeschichte, nicht an die Formel 1.
   */
  const gefahren = k.rennen.filter((r) => r.gefahren && r.f1).reverse()

  const ergebnis = db.prepare(`
    SELECT rr.driver_id AS id, d.display_name AS name, rr.position AS pos, rr.grid_position AS grid,
           k.name AS team
      FROM race_result rr JOIN driver d ON d.id = rr.driver_id JOIN constructor k ON k.id = rr.constructor_id
     WHERE rr.race_id = ? AND rr.position IS NOT NULL
     ORDER BY rr.position LIMIT 6`)
  const quali = db.prepare(`
    SELECT DISTINCT rr.driver_id AS id, d.display_name AS name, rr.qualifying_position AS q
      FROM race_result rr JOIN driver d ON d.id = rr.driver_id
     WHERE rr.race_id = ? AND rr.qualifying_position IS NOT NULL
     ORDER BY rr.qualifying_position LIMIT 6`)

  /*
   * Die zwölf jüngsten Rennen sind leicht – wer die Formel 1 verfolgt, hat
   * sie gesehen. Die nächsten gut drei Dutzend sind mittel, und aus allen
   * älteren zieht der gesäte Zufall eine Auswahl über alle Jahrzehnte.
   */
  const rnd = zufall('sieger')
  const auswahl = [
    ...gefahren.slice(0, 12).map((r) => [r, 1]),
    ...gefahren.slice(12, 48).map((r) => [r, 2]),
    ...mische(rnd, gefahren.slice(48)).slice(0, 60).map((r) => [r, 3]),
  ]
  for (const [r, stufe] of auswahl) {
    const e = ergebnis.all(r.id)
    // Geteilte Wagen der 1950er: zwei Sieger, keine eine Antwort.
    if (e.filter((x) => x.pos === 1).length !== 1 || e.length < 4) continue
    const [s, z, d] = e
    stelle({
      id: `sieger-${r.id}`, bereich: 'rennen', stufe, thema: `r:${r.id}`, link: `races/${r.id}/`,
      text: `Who won ${rennenText(r)}?`,
      richtig: s.name,
      falsch: erste(e.slice(1).map((x) => x.name), s.name),
      erklaerung:
        `${s.name} won for ${s.team}${s.grid ? ` from P${s.grid} on the grid` : ''}, ahead of ${z.name}` +
        (d ? ` and ${d.name}.` : '.'),
    })
  }

  const poleAuswahl = [
    ...gefahren.slice(0, 24).map((r) => [r, 2]),
    ...mische(zufall('pole'), gefahren.slice(24)).slice(0, 40).map((r) => [r, 3]),
  ]
  for (const [r, stufe] of poleAuswahl) {
    const q = quali.all(r.id)
    if (q.filter((x) => x.q === 1).length !== 1) continue
    const sieger = ergebnis.all(r.id).find((x) => x.pos === 1)
    const pole = q[0]
    stelle({
      id: `pole-${r.id}`, bereich: 'rennen', stufe, thema: `r:${r.id}`, link: `races/${r.id}/`,
      text: `Who took pole position for ${rennenText(r)}?`,
      richtig: pole.name,
      falsch: erste(q.slice(1).map((x) => x.name), pole.name),
      erklaerung: !sieger
        ? `${pole.name} was fastest in qualifying.`
        : sieger.id === pole.id
          ? `${pole.name} took pole and went on to win.`
          : `${pole.name} took pole; the race went to ${sieger.name}.`,
    })
  }

  /* Wer einen Grand Prix am häufigsten gewann – nur bei klarer Antwort. */
  const grandsPrix = db
    .prepare(`
      SELECT g.id, g.full_name AS gp, COUNT(DISTINCT r.id) AS n
        FROM race r JOIN grand_prix g ON g.id = r.grand_prix_id
       WHERE r.formula_one = 1 AND EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)
       GROUP BY g.id HAVING n >= 12`)
    .all()
  const gpSieger = db.prepare(`
    SELECT rr.driver_id AS id, d.display_name AS name, COUNT(DISTINCT r.id) AS n
      FROM race r JOIN race_result rr ON rr.race_id = r.id JOIN driver d ON d.id = rr.driver_id
     WHERE r.grand_prix_id = ? AND rr.position = 1
     GROUP BY rr.driver_id ORDER BY n DESC, d.last_name LIMIT 6`)
  for (const g of grandsPrix) {
    const [a, b, ...rest] = gpSieger.all(g.id)
    if (!b || a.n === b.n || a.n < 3) continue
    stelle({
      id: `gprekord-${g.id}`, bereich: 'rennen', stufe: g.n >= 50 ? 2 : 3, thema: `gp:${g.id}`,
      link: `drivers/${a.id}/`,
      text: `Who has won the ${g.gp} more often than anyone else?`,
      richtig: a.name,
      falsch: erste([b, ...rest].map((x) => x.name), a.name),
      erklaerung: `${a.name} won it ${mals(a.n)}; next is ${b.name} with ${b.n}.`,
    })
  }

  /* Siege von weit hinten. Nur Rennen mit überliefertem Startplatz. */
  const vonHinten = db
    .prepare(`
      SELECT rr.driver_id AS id, d.display_name AS name, rr.grid_position AS grid, r.id AS raceId
        FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN driver d ON d.id = rr.driver_id
       WHERE rr.position = 1 AND rr.grid_position IS NOT NULL AND r.formula_one = 1
       ORDER BY rr.grid_position DESC, r.date LIMIT 14`)
    .all()
  for (const [i, v] of vonHinten.entries()) {
    const r = k.rennenNach.get(v.raceId)
    stelle({
      id: `aufholjagd-${r.id}`, bereich: 'rennen', stufe: 3, thema: `r:${r.id}`, link: `races/${r.id}/`,
      zahl: true,
      text: `From which grid position did ${v.name} win ${rennenText(r)}?`,
      richtig: `P${v.grid}`,
      falsch: zahlen(zufall(`aufholjagd-${r.id}`), v.grid, { min: 1, schritt: 2 }).map((n) => `P${n}`),
      erklaerung:
        `${v.name} came through from P${v.grid} to win.` +
        (i === 0 && v.grid > vonHinten[1].grid ? ' No one has won a Grand Prix from further back.' : ''),
    })
  }

  /* Das allererste Rennen der Weltmeisterschaft. */
  const erstes = gefahren.at(-1)
  const erstesErgebnis = ergebnis.all(erstes.id)
  const ersteWertung = db
    .prepare(`
      SELECT d.display_name AS name FROM season_driver_standing sds JOIN driver d ON d.id = sds.driver_id
       WHERE sds.year = ? AND sds.position IS NOT NULL ORDER BY sds.position LIMIT 6`)
    .all(erstes.jahr)
    .map((x) => x.name)
  if (erstesErgebnis[0]?.pos === 1) {
    const s = erstesErgebnis[0]
    stelle({
      id: `erstesrennen-${erstes.id}`, bereich: 'rennen', stufe: 2, thema: `r:${erstes.id}`,
      link: `races/${erstes.id}/`,
      text: `Who won the very first World Championship Grand Prix, at ${erstes.strecke} in ${erstes.jahr}?`,
      richtig: s.name,
      falsch: erste(ersteWertung, s.name),
      erklaerung: `${s.name} won ${rennenText(erstes)} on ${datum(erstes.datum)}, the opening round of the first World Championship.`,
    })
  }
}

// ---------------------------------------------------------------- Strecken

function streckenFragen(db, k, { stelle }) {
  const strecken = db
    .prepare(`
      SELECT z.id, z.name, COALESCE(z.full_name, z.name) AS voll, z.place_name AS ort, c.name AS land,
             COUNT(r.id) AS rennen, MIN(r.year) AS von, MAX(r.year) AS bis,
             MAX(r.course_length_km) AS laengste
        FROM circuit z
        JOIN race r ON r.circuit_id = z.id
        LEFT JOIN country c ON c.id = z.country_id
       WHERE r.formula_one = 1
       GROUP BY z.id`)
    .all()
    .map((z) => ({ ...z, aktuell: z.bis >= k.neuestes - 1, label: streckenLabel(z) }))
  const labelNach = new Map(strecken.map((z) => [z.id, z.label]))

  const laender = [...new Set(strecken.map((z) => z.land).filter(Boolean))]
  /*
   * Verrät der Streckenname die Antwort? Geprüft wird jedes Wort ab drei
   * Buchstaben, gekürzt auf seinen Stamm: „Hungaroring" verrät Hungary, „Circuit
   * de Spa-Francorchamps" verrät Spa, „Korea International Circuit" verrät
   * South Korea.
   */
  const verraet = (z, wort) =>
    falte(wort)
      .split(/[\s-]+/)
      .filter((w) => w.length >= 3)
      .some((w) => falte(z.voll).includes(w.slice(0, 5)) || falte(z.name).includes(w.slice(0, 5)))

  for (const z of strecken.filter((x) => x.rennen >= 3 && x.land)) {
    /* „Circuit de Monaco" in welchem Land? Wo der Name die Antwort enthält, fällt die Frage weg. */
    if (verraet(z, z.land) || falte(z.ort) === falte(z.land)) continue
    stelle({
      id: `streckenland-${z.id}`, bereich: 'strecken', stufe: z.aktuell ? 1 : z.rennen >= 20 ? 2 : 3,
      thema: `c:${z.id}`, link: `circuits/${z.id}/`,
      text: `In which country is ${z.voll}?`,
      richtig: z.land,
      falsch: zufaellige(zufall(`streckenland-${z.id}`), laender, z.land),
      erklaerung: `${z.voll} is at ${z.ort}, ${z.land}. It ${z.aktuell ? 'has hosted' : 'hosted'} ${mal(z.rennen, 'World Championship race')}.`,
    })
  }

  /*
   * Der Ort, und zwar gegen andere Orte im selben Land, wo es sie gibt:
   * Interlagos liegt in São Paulo, nicht in Rio. Orte, die im Streckennamen
   * stehen – Monza, Silverstone, Suzuka –, fallen heraus.
   */
  for (const z of strecken.filter((x) => x.rennen >= 5 && x.ort)) {
    if (verraet(z, z.ort)) continue
    const rnd = zufall(`streckenort-${z.id}`)
    const imLand = strecken.filter((x) => x.land === z.land && x !== z).map((x) => x.ort)
    const sonst = strecken.filter((x) => x.land !== z.land).map((x) => x.ort)
    stelle({
      id: `streckenort-${z.id}`, bereich: 'strecken', stufe: z.aktuell ? 2 : 3, thema: `c:${z.id}`,
      link: `circuits/${z.id}/`,
      text: `Where is ${z.voll}?`,
      richtig: z.ort,
      falsch: erste([...mische(rnd, imLand), ...mische(rnd, sonst)], z.ort),
      erklaerung: `${z.voll} is at ${z.ort}, ${z.land}.`,
    })
  }

  for (const z of strecken.filter((x) => x.rennen >= 5)) {
    const erstes = k.rennen.find((r) => r.streckeId === z.id && r.f1)
    stelle({
      id: `streckenjahr-${z.id}`, bereich: 'strecken', stufe: z.aktuell ? 2 : 3, thema: `c:${z.id}`,
      link: `circuits/${z.id}/`, zahl: true,
      text: `In which year did ${z.voll} first host a World Championship race?`,
      richtig: String(erstes.jahr),
      falsch: zahlen(zufall(`streckenjahr-${z.id}`), erstes.jahr, { min: 1950, max: k.neuestes }).map(String),
      erklaerung: `It opened with ${rennenText(erstes)} and ${z.aktuell ? 'has hosted' : 'hosted'} ${mal(z.rennen, 'race')} in all.`,
    })
  }

  /*
   * Grands Prix, die umgezogen sind: der Große Preis von Deutschland am
   * Nürburgring, in Hockenheim und auf der AVUS. Je Strecke eine Frage, und
   * die falschen Antworten sind die anderen Austragungsorte desselben Grand
   * Prix – der Schweizer Grand Prix 1982 fand in Dijon statt, in Frankreich.
   */
  const gpOrte = db
    .prepare(`
      SELECT r.grand_prix_id AS gpId, r.circuit_id AS id, c.name AS land, COUNT(*) AS n
        FROM race r JOIN circuit z ON z.id = r.circuit_id LEFT JOIN country c ON c.id = z.country_id
       WHERE r.formula_one = 1 AND EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)
       GROUP BY r.grand_prix_id, r.circuit_id ORDER BY r.grand_prix_id, n DESC`)
    .all()
    .map((o) => ({ ...o, name: labelNach.get(o.id) }))
  const proGP = new Map()
  for (const o of gpOrte) proGP.set(o.gpId, [...(proGP.get(o.gpId) ?? []), o])
  for (const [gpId, orte] of proGP) {
    if (orte.length < 2) continue
    for (const o of orte) {
      const rnd = zufall(`gport-${gpId}-${o.id}`)
      const kandidaten = k.rennen.filter((r) => r.gpId === gpId && r.streckeId === o.id && r.f1 && r.gefahren)
      const r = kandidaten[Math.floor(rnd() * kandidaten.length)]
      const nachbarn = strecken.filter((x) => x.land === o.land).map((x) => x.label)
      stelle({
        id: `gport-${r.id}`, bereich: 'strecken', stufe: r.jahr >= 2000 ? 2 : 3, thema: `gp:${gpId}`,
        link: `races/${r.id}/`,
        text: `Where was ${rennenText(r)} held?`,
        richtig: o.name,
        falsch: erste(
          [...orte.filter((x) => x !== o).map((x) => x.name), ...mische(rnd, nachbarn), ...mische(rnd, strecken.map((x) => x.label))],
          o.name,
        ),
        erklaerung: `The ${r.gp} has been held at ${und(orte.map((x) => `${x.name} ${mals(x.n)}`))}.`,
      })
    }
  }

  const bek = (z) => (z.aktuell && z.rennen >= 25 ? 1 : z.rennen >= 15 ? 2 : 3)
  vergleiche(stelle, {
    id: 'vgstrecken', bereich: 'strecken', thema: 'v:strecken', einheit: 'races', link: 'circuits/',
    eintraege: strecken.map((z) => ({ name: z.label, wert: z.rennen, bek: bek(z) })),
    text: 'Which of these circuits has hosted the most World Championship races?',
    stufen: [
      { stufe: 1, topf: (x) => x.bek === 1, abstand: deutlich, anzahl: 6 },
      { stufe: 2, topf: (x) => x.bek <= 2, abstand: klar, anzahl: 6 },
      { stufe: 3, topf: (x) => x.wert >= 5, abstand: knapp, anzahl: 6 },
    ],
  })

  /*
   * Die Rundenlänge im aktuellen Kalender, gemessen am jüngsten Rennen dort –
   * nicht am Stammsatz der Strecke, der eine längst umgebaute Fassung meinen
   * kann.
   */
  const kalender = db
    .prepare(`
      SELECT r.circuit_id AS id, MAX(r.course_length_km) AS wert
        FROM race r
       WHERE r.year = ? AND r.course_length_km IS NOT NULL
       GROUP BY r.circuit_id`)
    .all(k.neuestes)
  vergleiche(stelle, {
    id: 'vgrunde', bereich: 'strecken', thema: 'v:runde', einheit: 'km', link: 'circuits/',
    eintraege: kalender.map((x) => ({ name: labelNach.get(x.id), wert: x.wert, bek: 1 })),
    text: `Which of these circuits on the ${k.neuestes} calendar has the longest lap?`,
    stufen: [
      { stufe: 1, topf: () => true, abstand: (a, b) => a >= b * 1.15, anzahl: 5 },
      { stufe: 2, topf: () => true, abstand: (a, b) => a > b && a < b * 1.06, anzahl: 5 },
    ],
  })

  /*
   * Die längsten Runden der Geschichte: Pescara mit gut 25 km, die
   * Nordschleife, das alte Spa. Erst ab 6 km in den Topf – sonst gewönne
   * Silverstone gegen Kyalami, und das weiß niemand, der die alten Kurse
   * nicht kennt, aber es sagt auch nichts über sie.
   */
  vergleiche(stelle, {
    id: 'vglangrunde', bereich: 'strecken', thema: 'v:runde', einheit: 'km', link: 'circuits/',
    eintraege: strecken.filter((z) => z.laengste).map((z) => ({ name: z.label, wert: z.laengste, bek: 3 })),
    text: 'Which of these circuits had the longest lap, in any layout used for a World Championship race?',
    stufen: [{ stufe: 3, topf: (x) => x.wert >= 6, abstand: (a, b) => a > b * 1.03, anzahl: 6 }],
  })
}

/**
 * Wie eine Strecke als Antwort heißt.
 *
 * F1DBs Kurzname ist oft ein Mensch: Jacarepaguá heißt „Nelson Piquet",
 * Imola „Enzo e Dino Ferrari", Interlagos „José Carlos Pace". Als
 * Antwortmöglichkeit zwischen Fahrernamen sähe das aus wie ein Fahrer. Wo der
 * volle Name mit „Autódromo" oder „Circuit" beginnt und der Kurzname aus
 * mehreren Wörtern besteht, kommt deshalb der Ort dazu: „Enzo e Dino Ferrari
 * (Imola)".
 */
function streckenLabel(z) {
  // „Americas" allein ist kein Name; „Circuit of the Americas" ist einer.
  if (/\bof the\b/.test(falte(z.voll))) return z.voll
  const personenname =
    /^(autodromo|circuit|circuito|autodrome)\b/.test(falte(z.voll)) &&
    z.name.includes(' ') &&
    z.ort &&
    !falte(z.name).includes(falte(z.ort))
  return personenname ? `${z.name} (${z.ort})` : z.name
}

// ----------------------------------------------------------------- Rekorde

function rekordFragen(db, k, { stelle }) {
  /** Jeder Fahrer nur einmal – Altersrekorde führen denselben Fahrer oft mehrfach. */
  const einzeln = (xs) => xs.filter((x, i) => xs.findIndex((y) => y.driverId === x.driverId) === i)

  const BESTENLISTEN = [
    { art: 'siege', fn: meisteSiege, label: 'Grand Prix wins', einheit: 'wins', stufe: [1, 1, 2] },
    { art: 'poles', fn: meistePoles, label: 'pole positions', einheit: 'poles', stufe: [1, 2, 2] },
    { art: 'podien', fn: meistePodien, label: 'podium finishes', einheit: 'podiums', stufe: [1, 3, 2] },
    { art: 'starts', fn: meisteStarts, label: 'Grand Prix starts', einheit: 'starts', stufe: [1, 3, 3] },
    { art: 'runden', fn: meisteSchnellsteRunden, label: 'fastest laps', einheit: 'fastest laps', stufe: [2, 3, 3] },
  ]
  for (const { art, fn, label, einheit, stufe: [sHalter, sZahl, sZweiter] } of BESTENLISTEN) {
    const l = fn(db, 8)
    const [a, b, c] = l
    if (!a || !b || a.wert === b.wert) continue
    stelle({
      id: `rekord-${art}`, bereich: 'rekorde', stufe: sHalter, thema: `rek:${art}`, link: 'records/',
      text: `Who holds the record for the most ${label}?`,
      richtig: a.name,
      falsch: erste(l.slice(1).map((x) => x.name), a.name),
      erklaerung: liste(l.slice(0, 4), einheit),
    })
    stelle({
      id: `rekordzahl-${art}`, bereich: 'rekorde', stufe: sZahl, thema: `rek:${art}`, link: 'records/',
      zahl: true,
      text: `What is ${a.name}'s record tally of ${label}?`,
      richtig: zahl(a.wert),
      falsch: zahlen(zufall(`rekordzahl-${art}`), a.wert, { schritt: schrittFuer(a.wert), min: b.wert + 1 }).map(zahl),
      erklaerung: `${a.name}: ${zahl(a.wert)}. Next on the list is ${b.name} with ${zahl(b.wert)}.`,
    })
    if (c && b.wert > c.wert) {
      stelle({
        id: `rekordzweiter-${art}`, bereich: 'rekorde', stufe: sZweiter, thema: `rek2:${art}`, link: 'records/',
        text: `Who is second on the all-time list for ${label}?`,
        // Der Rekordhalter selbst ist die naheliegendste Verwechslung.
        richtig: b.name,
        falsch: erste([a, ...l.slice(2)].map((x) => x.name), b.name),
        erklaerung: liste(l.slice(0, 4), einheit),
      })
    }
  }

  /*
   * Das Alter steht nur in ganzen Jahren da. Die Rekordliste rechnet mit
   * 365,25 Tagen je Jahr; auf den Tag genau wäre das nicht immer, und eine
   * um einen Tag falsche Zahl in einer Erklärung wäre schlimmer als keine.
   */
  /*
   * Titel: Schumacher und Hamilton teilen sich die Bestmarke. „Wer hält den
   * Rekord?" hätte zwei Antworten. Gefragt wird deshalb, wer von vieren so
   * viele Titel gewann – und nur einer der beiden steht zur Wahl.
   */
  const meister = k.fahrer
    .filter((f) => f.titel.length > 0)
    .sort((a, b) => b.titel.length - a.titel.length || a.titel[0] - b.titel[0])
  const spitze = meister[0].titel.length
  const halter = meister.filter((f) => f.titel.length === spitze)
  stelle({
    id: 'rekord-titel', bereich: 'rekorde', stufe: 1, thema: 'rek:titel', link: 'records/',
    text: halter.length === 1
      ? 'Who holds the record for the most world championships?'
      : `Which of these drivers has won ${spitze} world championships?`,
    richtig: halter[0].name,
    falsch: erste(meister.filter((f) => f.titel.length < spitze).map((f) => f.name), halter[0].name),
    erklaerung: halter.length === 1
      ? `${halter[0].name} won ${spitze}.`
      : `${und(halter.map((f) => f.name))} share the record with ${spitze} titles each.`,
  })

  /** Längste Folge aufeinanderfolgender Jahre in einer sortierten Liste. */
  const laengsteFolge = (jahre) => {
    let lauf = 1
    let beste = { wert: 1, bis: jahre[0] }
    for (let i = 1; i < jahre.length; i++) {
      lauf = jahre[i] === jahre[i - 1] + 1 ? lauf + 1 : 1
      if (lauf > beste.wert) beste = { wert: lauf, bis: jahre[i] }
    }
    return beste
  }
  const folgen = meister
    .map((f) => ({ name: f.name, id: f.id, ...laengsteFolge(f.titel) }))
    .sort((a, b) => b.wert - a.wert)
  if (folgen[0].wert > folgen[1].wert) {
    const a = folgen[0]
    stelle({
      id: 'rekord-titelserie', bereich: 'rekorde', stufe: 2, thema: 'rek:titelserie', link: `drivers/${a.id}/`,
      text: 'Who holds the record for the most consecutive world championships?',
      richtig: a.name,
      falsch: erste(folgen.slice(1).map((x) => x.name), a.name),
      erklaerung: `${a.name} won ${a.wert} in a row, from ${a.bis - a.wert + 1} to ${a.bis}.`,
    })
  }

  const teamTitel = new Map()
  for (const z of db
    .prepare(`
      SELECT scs.constructor_id AS id, k.name, scs.year AS jahr
        FROM season_constructor_standing scs JOIN constructor k ON k.id = scs.constructor_id
       WHERE scs.championship_won = 1 ORDER BY scs.year`)
    .all()) {
    const e = teamTitel.get(z.id) ?? { id: z.id, name: z.name, jahre: [] }
    e.jahre.push(z.jahr)
    teamTitel.set(z.id, e)
  }
  const teamFolgen = [...teamTitel.values()]
    .map((t) => ({ ...t, ...laengsteFolge(t.jahre) }))
    .sort((a, b) => b.wert - a.wert)
  if (teamFolgen.length >= 4 && teamFolgen[0].wert > teamFolgen[1].wert) {
    const a = teamFolgen[0]
    stelle({
      id: 'teamrekord-titelserie', bereich: 'rekorde', stufe: 2, thema: 'rekt:titelserie', link: `teams/${a.id}/`,
      text: "Which team holds the record for the most consecutive constructors' championships?",
      richtig: a.name,
      falsch: erste(teamFolgen.slice(1).map((x) => x.name), a.name),
      erklaerung: `${a.name} won ${a.wert} in a row, from ${a.bis - a.wert + 1} to ${a.bis}.`,
    })
  }

  /* Die Kehrseiten: viel gewonnen ohne Titel, oft gestartet ohne Sieg. */
  const ohneTitel = k.fahrer.filter((f) => f.titel.length === 0 && f.siege > 0).sort((a, b) => b.siege - a.siege)
  if (ohneTitel[0].siege > ohneTitel[1].siege) {
    stelle({
      id: 'rekord-ohnetitel', bereich: 'rekorde', stufe: 2, thema: 'rek:ohnetitel', link: `drivers/${ohneTitel[0].id}/`,
      text: 'Who has won the most Grands Prix without winning the world championship?',
      richtig: ohneTitel[0].name,
      falsch: erste(ohneTitel.slice(1).map((f) => f.name), ohneTitel[0].name),
      erklaerung: liste(ohneTitel.slice(0, 4).map((f) => ({ name: f.name, wert: f.siege })), 'wins'),
    })
  }
  const ohneSieg = k.fahrer.filter((f) => f.siege === 0).sort((a, b) => b.starts - a.starts)
  if (ohneSieg[0].starts > ohneSieg[1].starts) {
    stelle({
      id: 'rekord-ohnesieg', bereich: 'rekorde', stufe: 2, thema: 'rek:ohnesieg', link: `drivers/${ohneSieg[0].id}/`,
      text: 'Who has started the most Grands Prix without ever winning one?',
      richtig: ohneSieg[0].name,
      falsch: erste(ohneSieg.slice(1).map((f) => f.name), ohneSieg[0].name),
      erklaerung: liste(ohneSieg.slice(0, 4).map((f) => ({ name: f.name, wert: f.starts })), 'starts'),
    })
  }

  const ALTER = [
    { art: 'jungsieg', l: () => altersrekord(db, 'sieg', 'jung', 40), stufe: 1, text: 'Who is the youngest Grand Prix winner in history?', wann: (r) => `when winning ${rennenText(r)}` },
    { art: 'jungmeister', l: () => altersrekordMeister(db, 'jung', 40), stufe: 1, text: 'Who is the youngest world champion?', wann: (r) => `when the ${r.jahr} season ended` },
    { art: 'jungpole', l: () => altersrekord(db, 'pole', 'jung', 40), stufe: 2, text: 'Who is the youngest driver to take pole position?', wann: (r) => `when taking pole for ${rennenText(r)}` },
    { art: 'jungstart', l: () => altersrekord(db, 'start', 'jung', 40), stufe: 2, text: 'Who is the youngest driver ever to start a Grand Prix?', wann: (r) => `at ${rennenText(r)}` },
    { art: 'altmeister', l: () => altersrekordMeister(db, 'alt', 40), stufe: 2, text: 'Who is the oldest world champion?', wann: (r) => `when the ${r.jahr} season ended` },
    { art: 'jungpodium', l: () => altersrekord(db, 'podium', 'jung', 40), stufe: 3, text: 'Who is the youngest driver to finish on the podium?', wann: (r) => `when finishing on the podium at ${rennenText(r)}` },
    { art: 'altsieg', l: () => altersrekord(db, 'sieg', 'alt', 40), stufe: 3, text: 'Who is the oldest Grand Prix winner in history?', wann: (r) => `when winning ${rennenText(r)}` },
  ]
  for (const { art, l, stufe, text, wann } of ALTER) {
    const [a, ...rest] = einzeln(l())
    if (!a || rest.length < 3) continue
    const alter = Math.floor(a.wert)
    const erklaerung = `${a.name} was ${alter} ${wann(k.rennenNach.get(a.raceId))}.`
    stelle({
      id: `alter-${art}`, bereich: 'rekorde', stufe, thema: `rek:${art}`, link: `drivers/${a.driverId}/`,
      text,
      richtig: a.name,
      falsch: erste(rest.map((x) => x.name), a.name),
      erklaerung,
    })
    if (art === 'jungsieg' || art === 'jungmeister') {
      stelle({
        id: `alterzahl-${art}`, bereich: 'rekorde', stufe: 2, thema: `rek:${art}`, link: `drivers/${a.driverId}/`,
        zahl: true,
        text: art === 'jungsieg'
          ? `How old was ${a.name} on becoming the youngest Grand Prix winner?`
          : `How old was ${a.name} on becoming the youngest world champion?`,
        richtig: String(alter),
        falsch: zahlen(zufall(`alterzahl-${art}`), alter, { min: 16 }).map(String),
        erklaerung,
      })
    }
  }

  const teamStarts = db
    .prepare(`
      SELECT rr.constructor_id AS id, k.name, COUNT(DISTINCT rr.race_id) AS wert
        FROM race_result rr JOIN constructor k ON k.id = rr.constructor_id
       WHERE rr.started = 1
       GROUP BY rr.constructor_id ORDER BY wert DESC LIMIT 6`)
    .all()
  if (teamStarts.length >= 4 && teamStarts[0].wert > teamStarts[1].wert) {
    stelle({
      id: 'teamrekord-starts', bereich: 'rekorde', stufe: 1, thema: 'rekt:starts', link: `teams/${teamStarts[0].id}/`,
      text: 'Which team has started the most Grands Prix?',
      richtig: teamStarts[0].name,
      falsch: erste(teamStarts.slice(1).map((x) => x.name), teamStarts[0].name),
      erklaerung: liste(teamStarts.slice(0, 4), 'races'),
    })
  }

  const TEAMS = [
    { art: 'siege', text: 'Which team has won the most Grands Prix?', einheit: 'wins', stufe: 1 },
    { art: 'titel', text: "Which team has won the most constructors' championships?", einheit: 'titles', stufe: 1 },
    { art: 'poles', text: 'Which team has taken the most pole positions?', einheit: 'poles', stufe: 2 },
  ]
  for (const { art, text, einheit, stufe } of TEAMS) {
    const l = teamRekorde(db, art, 8)
    if (l.length < 4 || l[0].wert === l[1].wert) continue
    stelle({
      id: `teamrekord-${art}`, bereich: 'rekorde', stufe, thema: `rekt:${art}`, link: `teams/${l[0].id}/`,
      text,
      richtig: l[0].name,
      falsch: erste(l.slice(1).map((x) => x.name), l[0].name),
      erklaerung: liste(l.slice(0, 4), einheit),
    })
    stelle({
      id: `teamrekordzahl-${art}`, bereich: 'rekorde', stufe: 3, thema: `rekt:${art}`, link: `teams/${l[0].id}/`,
      zahl: true,
      text: `How many ${art === 'titel' ? "constructors' championships" : art === 'siege' ? 'Grands Prix' : 'pole positions'} has record holder ${l[0].name} ${art === 'poles' ? 'taken' : 'won'}?`,
      richtig: zahl(l[0].wert),
      falsch: zahlen(zufall(`teamrekordzahl-${art}`), l[0].wert, { schritt: schrittFuer(l[0].wert), min: l[1].wert + 1 }).map(zahl),
      erklaerung: `${l[0].name}: ${zahl(l[0].wert)}. Next is ${l[1].name} with ${zahl(l[1].wert)}.`,
    })
  }

  /* Doppelsiege: Sieger und Zweiter aus demselben Team. */
  const doppel = db
    .prepare(`
      SELECT a.constructor_id AS id, k.name, COUNT(DISTINCT a.race_id) AS wert
        FROM race_result a
        JOIN race_result b ON b.race_id = a.race_id AND b.position = 2 AND b.constructor_id = a.constructor_id
        JOIN constructor k ON k.id = a.constructor_id
       WHERE a.position = 1
       GROUP BY a.constructor_id ORDER BY wert DESC LIMIT 6`)
    .all()
  if (doppel.length >= 4 && doppel[0].wert > doppel[1].wert) {
    stelle({
      id: 'teamrekord-doppel', bereich: 'rekorde', stufe: 3, thema: 'rekt:doppel', link: `teams/${doppel[0].id}/`,
      text: 'Which team has scored the most one-two finishes?',
      richtig: doppel[0].name,
      falsch: erste(doppel.slice(1).map((x) => x.name), doppel[0].name),
      erklaerung: liste(doppel.slice(0, 4), 'one-twos'),
    })
  }

  /* Nationen: Siege und Titel nach der Nationalität des Fahrers. */
  const NATIONEN = [
    {
      art: 'siege', einheit: 'wins', text: 'Drivers from which country have won the most Grands Prix?',
      sql: `SELECT c.name, COUNT(*) AS wert FROM race_result rr JOIN driver d ON d.id = rr.driver_id
              JOIN country c ON c.id = d.nationality_id WHERE rr.position = 1
             GROUP BY c.id ORDER BY wert DESC LIMIT 6`,
    },
    {
      art: 'titel', einheit: 'titles', text: 'Drivers from which country have won the most world championships?',
      sql: `SELECT c.name, COUNT(*) AS wert FROM season_driver_standing s JOIN driver d ON d.id = s.driver_id
              JOIN country c ON c.id = d.nationality_id WHERE s.championship_won = 1
             GROUP BY c.id ORDER BY wert DESC LIMIT 6`,
    },
  ]
  for (const { art, einheit, text, sql } of NATIONEN) {
    const l = db.prepare(sql).all()
    if (l.length < 4 || l[0].wert === l[1].wert) continue
    stelle({
      id: `nation-${art}`, bereich: 'rekorde', stufe: 2, thema: `rekn:${art}`, link: 'records/',
      text,
      richtig: l[0].name,
      falsch: erste(l.slice(1).map((x) => x.name), l[0].name),
      erklaerung: liste(l.slice(0, 4), einheit),
    })
  }

  /* Die meisten Siege in einer Saison. */
  const saisonSiege = einzeln(
    db
      .prepare(`
        SELECT rr.driver_id AS driverId, d.display_name AS name, r.year AS jahr, COUNT(DISTINCT r.id) AS wert
          FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN driver d ON d.id = rr.driver_id
         WHERE rr.position = 1
         GROUP BY rr.driver_id, r.year ORDER BY wert DESC, r.year LIMIT 40`)
      .all(),
  )
  if (saisonSiege.length >= 4 && saisonSiege[0].wert > saisonSiege[1].wert) {
    const [a, b] = saisonSiege
    stelle({
      id: 'rekord-saisonsiege', bereich: 'rekorde', stufe: 1, thema: 'rek:saisonsiege', link: `seasons/${a.jahr}/`,
      text: 'Who holds the record for the most wins in a single season?',
      richtig: a.name,
      falsch: erste(saisonSiege.slice(1).map((x) => x.name), a.name),
      erklaerung: `${a.name} won ${a.wert} races in ${a.jahr}. Next best: ${b.name} with ${b.wert} in ${b.jahr}.`,
    })
  }

  const EINZELNE = [
    {
      art: 'serie', stufe: 2, l: () => laengsteSerien(db, 'siege', 12),
      text: 'Who holds the record for the most consecutive Grand Prix wins?',
      erklaerung: (a) => `${a.name} won ${a.wert} in a row (${a.rennen}).`,
    },
    {
      art: 'podiumserie', stufe: 3, l: () => laengsteSerien(db, 'podien', 12),
      text: 'Who holds the record for the most consecutive podium finishes?',
      erklaerung: (a) => `${a.name} finished on the podium ${a.wert} times in a row (${a.rennen}).`,
    },
    {
      art: 'slams', stufe: 3, l: () => grandSlams(db, 8),
      text: 'Who has the most grand slams – pole, win, fastest lap and every lap led in the same race?',
      erklaerung: (a, b) => `${a.name} managed it ${mals(a.wert)}; ${b.name} follows with ${b.wert}.`,
    },
    {
      art: 'punkteserie', stufe: 3, l: () => laengsteSerien(db, 'punkte', 12),
      text: 'Who holds the record for the most consecutive points finishes?',
      erklaerung: (a) => `${a.name} scored in ${a.wert} races in a row (${a.rennen}).`,
    },
    {
      art: 'karriere', stufe: 3, l: () => laengsteKarrieren(db, 12),
      text: 'Whose Grand Prix career spanned the most years, from first start to last?',
      erklaerung: (a) => `${a.name} started Grands Prix across more than ${Math.floor(a.wert)} years (${a.rennen}).`,
    },
    {
      art: 'pause', stufe: 3, l: () => laengstePauseZwischenSiegen(db, 20),
      text: 'Who waited the longest between two Grand Prix wins?',
      erklaerung: (a) => `${a.name} went more than ${Math.floor(a.wert)} years without a win (${a.rennen}).`,
    },
    {
      art: 'plaetze', stufe: 3, l: () => meistePlaetzeGutgemacht(db, 20),
      text: 'Who gained the most places in a single Grand Prix?',
      erklaerung: (a) => `${a.name} made up ${a.wert} places at ${rennenText(k.rennenNach.get(a.raceId))}.`,
    },
  ]
  for (const { art, stufe, l, text, erklaerung } of EINZELNE) {
    const [a, b, ...rest] = einzeln(l())
    if (!b || a.wert === b.wert) continue
    stelle({
      id: `rekord-${art}`, bereich: 'rekorde', stufe, thema: `rek:${art}`, link: 'records/',
      text,
      richtig: a.name,
      falsch: erste([b, ...rest].map((x) => x.name), a.name),
      erklaerung: erklaerung(a, b),
    })
  }

  /*
   * Das knappste Rennen – als Rennen gefragt, nicht als Fahrer. Ohne
   * Indianapolis: Das Indy 500 von 1952 stünde sonst als falsche Antwort
   * zwischen lauter Grands Prix und fiele sofort auf.
   */
  const knappste = zielabstand(db, 'knapp', 12).filter((x) => k.rennenNach.get(x.raceId).f1)
  if (knappste.length >= 4 && knappste[0].wert < knappste[1].wert) {
    const r = (x) => k.rennenNach.get(x.raceId)
    const a = knappste[0]
    stelle({
      id: 'rekord-knapp', bereich: 'rekorde', stufe: 3, thema: 'rek:knapp', link: `races/${a.raceId}/`,
      text: 'Which Grand Prix had the closest finish in World Championship history?',
      richtig: `${r(a).jahr} ${r(a).gp}`,
      falsch: erste(knappste.slice(1).map((x) => `${r(x).jahr} ${r(x).gp}`), `${r(a).jahr} ${r(a).gp}`),
      erklaerung: `${a.name} won by ${a.wert.toFixed(3)} seconds.`,
    })
  }

  /* Und das Gegenteil – ohne Rennen, in denen der Zweite überrundet war. */
  const weiteste = zielabstand(db, 'weit', 12).filter((x) => k.rennenNach.get(x.raceId).f1)
  if (weiteste.length >= 4 && weiteste[0].wert > weiteste[1].wert) {
    const r = (x) => `${k.rennenNach.get(x.raceId).jahr} ${k.rennenNach.get(x.raceId).gp}`
    const a = weiteste[0]
    const minuten = Math.floor(a.wert / 60)
    stelle({
      id: 'rekord-weit', bereich: 'rekorde', stufe: 3, thema: 'rek:weit', link: `races/${a.raceId}/`,
      text: 'Which Grand Prix was won by the biggest margin, with the runner-up on the lead lap?',
      richtig: r(a),
      falsch: erste(weiteste.slice(1).map(r), r(a)),
      erklaerung: `${a.name} won by ${minuten ? `${minuten} min ` : ''}${(a.wert - minuten * 60).toFixed(1)} s.`,
    })
  }
}

// ---------------------------------------------------------- Motoren, Reifen

function technikFragen(db, k, { stelle }) {
  const motorDesFahrers = db.prepare(`
    SELECT e.id, e.name, COUNT(*) AS n
      FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN engine_manufacturer e ON e.id = rr.engine_id
     WHERE rr.driver_id = ? AND r.year = ?
     GROUP BY e.id ORDER BY n DESC`)
  const teamDesFahrers = db.prepare(`
    SELECT k.name, COUNT(*) AS n
      FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN constructor k ON k.id = rr.constructor_id
     WHERE rr.driver_id = ? AND r.year = ?
     GROUP BY k.id ORDER BY n DESC`)
  const motorenImJahr = db.prepare(`
    SELECT e.id, e.name, COUNT(DISTINCT CASE WHEN rr.position = 1 THEN rr.race_id END) AS siege, COUNT(*) AS n
      FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN engine_manufacturer e ON e.id = rr.engine_id
     WHERE r.year = ? AND r.formula_one = 1
     GROUP BY e.id ORDER BY siege DESC, n DESC`)
  const reifenImJahr = db.prepare(`
    SELECT t.id, t.name, COUNT(*) AS n
      FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN tyre_manufacturer t ON t.id = rr.tyre_id
     WHERE r.year = ? AND r.formula_one = 1
     GROUP BY t.id ORDER BY n DESC`)
  const reifenDesFahrers = db.prepare(`
    SELECT t.id, t.name, COUNT(*) AS n
      FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN tyre_manufacturer t ON t.id = rr.tyre_id
     WHERE rr.driver_id = ? AND r.year = ?
     GROUP BY t.id ORDER BY n DESC`)

  const reifenJahre = db
    .prepare(`
      SELECT t.id, t.name, MIN(r.year) AS von, MAX(r.year) AS bis
        FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN tyre_manufacturer t ON t.id = rr.tyre_id
       WHERE r.formula_one = 1
       GROUP BY t.id`)
    .all()

  const titelMotoren = new Map()

  for (const { jahr, id } of k.meisterJahre) {
    const f = k.fahrerNach.get(id)
    if (!f || !k.fertig.some((s) => s.jahr === jahr)) continue
    const motoren = motorDesFahrers.all(id, jahr)
    const teams = teamDesFahrers.all(id, jahr)
    if (motoren.length !== 1 || teams.length !== 1) continue
    const [motor] = motoren
    const [team] = teams
    titelMotoren.set(motor.name, [...(titelMotoren.get(motor.name) ?? []), { jahr, id: motor.id }])

    /* Ferrari mit Ferrari-Motor ist keine Frage. */
    if (!teilenWort(team.name, motor.name)) {
      stelle({
        id: `meistermotor-${jahr}`, bereich: 'technik', stufe: k.stufeNachJahr(jahr), thema: `s${jahr}`,
        link: `engines/${motor.id}/`,
        text: `Which engine powered ${f.name}'s ${team.name} to the ${jahr} title?`,
        richtig: motor.name,
        falsch: erste(motorenImJahr.all(jahr).map((m) => m.name), motor.name),
        erklaerung: `${f.name} won the ${jahr} championship in a ${team.name}-${motor.name}.`,
      })
    }

    /*
     * Reifen nur in Jahren mit Wettbewerb. In einer Einheitsreifen-Ära hätte
     * die Frage nur eine denkbare Antwort; dafür gibt es unten eine eigene.
     */
    const imJahr = reifenImJahr.all(jahr)
    const [reifen, ...weitere] = reifenDesFahrers.all(id, jahr)
    if (imJahr.length < 2 || !reifen || weitere.length) continue
    const damals = reifenJahre.filter((t) => t.von <= jahr + 10 && t.bis >= jahr - 10).map((t) => t.name)
    stelle({
      id: `meisterreifen-${jahr}`, bereich: 'technik', stufe: jahr >= 1997 ? 2 : 3, thema: `s${jahr}`,
      link: `seasons/${jahr}/`,
      text: `Which tyres did ${f.name} race on in the ${jahr} title season?`,
      richtig: reifen.name,
      falsch: erste([...imJahr.map((t) => t.name), ...mische(zufall(`reifen-${jahr}`), damals)], reifen.name),
      erklaerung: `${f.name} won the ${jahr} title on ${reifen.name} tyres; ${und(imJahr.map((t) => t.name).filter((n) => n !== reifen.name))} also supplied teams that year.`,
    })
  }

  /*
   * Welcher Motor im Heck welches Teams saß. Die beiden jüngsten Jahre sind
   * leicht und fragen jedes Team ab; ältere Jahre nur die drei stärksten
   * Teams, sonst wäre die Frage eine nach Hinterbänklern.
   */
  const teamMotor = db.prepare(`
    SELECT e.id, e.name, COUNT(*) AS n
      FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN engine_manufacturer e ON e.id = rr.engine_id
     WHERE rr.constructor_id = ? AND r.year = ? AND r.formula_one = 1
     GROUP BY e.id ORDER BY n DESC`)
  const kunden = db.prepare(`
    SELECT DISTINCT k.name
      FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN constructor k ON k.id = rr.constructor_id
     WHERE r.year = ? AND rr.engine_id = ? AND rr.constructor_id <> ?`)

  const paare = []
  for (const s of k.saisons.filter((x) => x.jahr >= 1958 && x.offen < x.rennen)) {
    const juengst = s.jahr >= k.neuestes - 1
    const teams = k.teamsImJahr(s.jahr)
    for (const t of juengst ? teams : teams.slice(0, 3)) {
      paare.push({ jahr: s.jahr, team: t, stufe: juengst ? 1 : s.jahr >= 1995 ? 2 : 3 })
    }
  }
  for (const { jahr, team, stufe } of paare) {
    const [m, ...rest] = teamMotor.all(team.id, jahr)
    const summe = [m, ...rest].reduce((x, y) => x + (y?.n ?? 0), 0)
    if (!m || m.n < summe * 0.9 || teilenWort(team.name, m.name)) continue
    // Kunden, nicht das Werksteam: „as did Kick Sauber and Ferrari" läse sich, als kaufe Ferrari zu.
    const andere = kunden.all(jahr, m.id, team.id).map((x) => x.name).filter((n) => !teilenWort(n, m.name))
    const jetzt = jahr === k.neuestes
    stelle({
      id: `teammotor-${team.id}-${jahr}`, bereich: 'technik', stufe, thema: `t:${team.id}`,
      link: `engines/${m.id}/`,
      text: `Which engine ${jetzt ? 'does' : 'did'} ${team.name} use in ${jahr}?`,
      richtig: m.name,
      falsch: erste(motorenImJahr.all(jahr).map((x) => x.name), m.name),
      erklaerung:
        `${team.name} ${jetzt ? 'races' : 'raced'} with ${m.name} power in ${jahr}` +
        (andere.length ? `, as ${jetzt ? 'do' : 'did'} ${undAndere(andere)}.` : '.'),
    })
  }

  /*
   * Einheitsreifen. Gesucht werden Folgen von Jahren mit genau einem
   * Hersteller; die laufende ist die bekannte Frage („seit 2011"), die
   * früheren sind die schwereren.
   */
  const proJahr = k.saisons
    .filter((s) => s.offen < s.rennen)
    .map((s) => ({ jahr: s.jahr, reifen: reifenImJahr.all(s.jahr) }))
  const folgen = []
  for (const j of proJahr) {
    const einzig = j.reifen.length === 1 ? j.reifen[0].name : null
    const letzte = folgen.at(-1)
    if (einzig && letzte?.name === einzig && letzte.bis === j.jahr - 1) letzte.bis = j.jahr
    else if (einzig) folgen.push({ name: einzig, von: j.jahr, bis: j.jahr })
  }
  for (const fo of folgen.filter((x) => x.bis - x.von >= 1)) {
    const laufend = fo.bis === k.neuestes
    // Falsch sind Hersteller, die um diese Zeit herum lieferten – die nächsten zuerst.
    const abstand = (t) => Math.max(0, t.von - fo.bis, fo.von - t.bis)
    const naheste = [...reifenJahre].sort((a, b) => abstand(a) - abstand(b)).map((t) => t.name)
    stelle({
      id: `einheitsreifen-${fo.von}`, bereich: 'technik', stufe: laufend ? 1 : fo.bis >= 2000 ? 2 : 3,
      thema: 'reifen', link: `seasons/${fo.von}/`,
      text: laufend
        ? `Which company has been Formula 1's only tyre supplier since ${fo.von}?`
        : `Which company was Formula 1's only tyre supplier from ${fo.von} to ${fo.bis}?`,
      richtig: fo.name,
      falsch: erste(naheste, fo.name),
      erklaerung: laufend
        ? `${fo.name} has supplied every car since ${fo.von}.`
        : `${fo.name} supplied every car from ${fo.von} to ${fo.bis}.`,
    })
  }

  const reifenSiege = db
    .prepare(`
      SELECT t.name, COUNT(DISTINCT rr.race_id) AS wert
        FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN tyre_manufacturer t ON t.id = rr.tyre_id
       WHERE rr.position = 1 AND r.formula_one = 1
       GROUP BY t.id ORDER BY wert DESC`)
    .all()
  if (reifenSiege.length >= 4 && reifenSiege[0].wert > reifenSiege[1].wert) {
    stelle({
      id: 'reifenrekord-siege', bereich: 'technik', stufe: 2, thema: 'reifen', link: 'records/',
      text: 'Which tyre manufacturer has won the most Grands Prix?',
      richtig: reifenSiege[0].name,
      falsch: erste(reifenSiege.slice(1).map((x) => x.name), reifenSiege[0].name),
      erklaerung: liste(reifenSiege.slice(0, 4), 'wins'),
    })
  }

  const motoren = db
    .prepare(`
      SELECT e.id, e.name,
             COUNT(DISTINCT CASE WHEN rr.position = 1 THEN rr.race_id END) AS siege,
             COUNT(DISTINCT rr.constructor_id) AS teams,
             MAX(r.year) AS bis
        FROM race_result rr JOIN race r ON r.id = rr.race_id JOIN engine_manufacturer e ON e.id = rr.engine_id
       WHERE r.formula_one = 1
       GROUP BY e.id`)
    .all()

  const MOTORREKORDE = [
    { art: 'siege', feld: 'siege', stufe: 2, einheit: 'wins', text: 'Which engine manufacturer has won the most Grands Prix?' },
    { art: 'teams', feld: 'teams', stufe: 3, einheit: 'teams', text: 'Which engine manufacturer has supplied the most different teams?' },
  ]
  for (const { art, feld, stufe, einheit, text } of MOTORREKORDE) {
    const l = [...motoren].sort((a, b) => b[feld] - a[feld]).map((m) => ({ ...m, wert: m[feld] }))
    if (l[0].wert === l[1].wert) continue
    stelle({
      id: `motorrekord-${art}`, bereich: 'technik', stufe, thema: `motor:${art}`, link: `engines/${l[0].id}/`,
      text,
      richtig: l[0].name,
      falsch: erste(l.slice(1).map((x) => x.name), l[0].name),
      erklaerung: liste(l.slice(0, 4), einheit),
    })
  }

  const titel = [...titelMotoren].map(([name, jahre]) => ({ name, wert: jahre.length, id: jahre[0].id }))
  titel.sort((a, b) => b.wert - a.wert)
  if (titel.length >= 4 && titel[0].wert > titel[1].wert) {
    stelle({
      id: 'motorrekord-titel', bereich: 'technik', stufe: 3, thema: 'motor:titel', link: `engines/${titel[0].id}/`,
      text: "Which engine manufacturer has powered the most drivers' champions?",
      richtig: titel[0].name,
      falsch: erste(titel.slice(1).map((x) => x.name), titel[0].name),
      erklaerung: `${liste(titel.slice(0, 4), 'titles')} Only seasons in which the champion used a single make of engine are counted.`,
    })
  }

  vergleiche(stelle, {
    id: 'vgmotor', bereich: 'technik', thema: 'v:motor', einheit: 'wins', link: 'engines/',
    eintraege: motoren.map((m) => ({ name: m.name, wert: m.siege, bek: m.siege >= 80 || m.bis >= k.aktuell - 3 ? 1 : 2 })),
    text: 'Which of these engine manufacturers has won the most Grands Prix?',
    stufen: [
      { stufe: 1, topf: (x) => x.bek === 1 && x.wert >= 1, abstand: deutlich, anzahl: 5 },
      { stufe: 2, topf: (x) => x.wert >= 3, abstand: klar, anzahl: 6 },
      { stufe: 3, topf: (x) => x.wert >= 1, abstand: knapp, anzahl: 6 },
    ],
  })
}

// ------------------------------------------------------------------ Ausgabe

/**
 * Alle Fragen, ungekürzt. Für die Prüfungen – dort soll eine bestimmte
 * Frage auffindbar sein, auch wenn die Begrenzung sie aus der Datei nimmt.
 */
export function erzeugeFragen(db) {
  const k = kontext(db)
  const s = sammler()
  for (const erzeuger of [saisonFragen, fahrerFragen, teamFragen, rennenFragen, streckenFragen, rekordFragen, technikFragen]) {
    erzeuger(db, k, s)
  }
  return s.fragen
}

/**
 * Höchstens HOECHSTENS Fragen je Art und Stufe. Welche bleiben, entscheidet
 * wieder der gesäte Zufall – nicht die Reihenfolge, sonst blieben von den
 * Saisonfragen nur die ältesten.
 */
function begrenze(fragen) {
  const gruppen = new Map()
  fragen.forEach((f, i) => {
    const g = `${f.i.split('-')[0]}|${f.s}`
    gruppen.set(g, [...(gruppen.get(g) ?? []), i])
  })
  const behalten = new Set()
  for (const [g, idx] of gruppen) for (const i of mische(zufall(g), idx).slice(0, HOECHSTENS)) behalten.add(i)
  return fragen.filter((_, i) => behalten.has(i))
}

const ZWISCHENSPEICHER = new WeakMap()

/**
 * Der Fragenvorrat für die Seite. Seite und Datei fragen ihn beide ab; er
 * wird einmal je Datenbank gebildet.
 */
export function quizFragen(db) {
  if (!ZWISCHENSPEICHER.has(db)) ZWISCHENSPEICHER.set(db, begrenze(erzeugeFragen(db)))
  return ZWISCHENSPEICHER.get(db)
}

/** Wie viele Fragen es je Bereich und Stufe gibt – für die Auswahl auf der Seite. */
export function quizUebersicht(fragen) {
  return BEREICHE.map((b) => ({
    ...b,
    n: Object.fromEntries(STUFEN.map((s) => [s.id, fragen.filter((f) => f.b === b.id && f.s === s.id).length])),
  }))
}
