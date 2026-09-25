/**
 * Bewegung in den Rekordlisten: was zuletzt gefallen ist und was als Nächstes fällt.
 *
 * Die Rekordseite zeigt einen Zustand. Diese hier zeigt seine Ableitung – wann
 * sich eine Bestmarke zuletzt bewegt hat, und wer ihr am nächsten kommt.
 *
 * Zwei Dinge stehen hier nebeneinander, die grundverschieden sind, und die
 * Seite muss sie auseinanderhalten:
 *
 *   Was geschehen ist, steht exakt in den Daten. Jedes Ereignis unten ist auf
 *   ein Rennen datiert. Der Verlauf wird aus den Ergebnissen nachgerechnet,
 *   nicht aus einer gepflegten Liste – es gibt also nichts, was veralten oder
 *   jemand zu pflegen vergessen könnte.
 *
 *   Was geschehen könnte, ist eine Fortschreibung. Sie unterstellt, dass ein
 *   Fahrer weiterfährt und sein bisheriges Tempo hält; beides kann falsch
 *   sein. Solche Werte treten deshalb als Kennzahl mit Stichprobe und
 *   Vorbehalt auf, nicht als nackte Zahl.
 *
 * Die Zählweisen sind dieselben wie in `records.js` – ein Sieg ist Platz 1,
 * ein Podium ein gewerteter Platz unter den ersten drei, eine Pole die
 * schnellste Zeit im Qualifying, nicht der Startplatz. Wer das dort ändert,
 * muss es hier auch ändern, sonst widersprechen sich zwei Seiten derselben
 * Anwendung.
 */

import { metric, unknown } from './metric.js'

/*
 * In den 1950ern übernahm ein Fahrer schon mal das Auto eines Teamkollegen;
 * dann stehen zwei Ergebniszeilen für denselben Fahrer im selben Rennen. Je
 * Fahrer und Rennen erst zusammenfassen, sonst zählte ein solches Rennen
 * doppelt und Fangio käme auf 58 statt 51 Starts.
 */
const JE_FAHRER_UND_RENNEN = `
  SELECT rr.driver_id AS wer, r.id AS rennen, r.year AS jahr, r.round AS runde,
         r.date AS datum, g.name AS grandPrix,
         MAX(rr.started)             AS gestartet,
         MAX(rr.classified)          AS gewertet,
         MIN(rr.position)            AS platz,
         MIN(rr.qualifying_position) AS quali,
         MAX(rr.fastest_lap)         AS schnellste,
         SUM(rr.points)              AS punkte
    FROM race_result rr
    JOIN race r ON r.id = rr.race_id
    JOIN grand_prix g ON g.id = r.grand_prix_id
   GROUP BY rr.driver_id, r.id
   ORDER BY r.year, r.round`

/*
 * Für Teams dieselbe Zusammenfassung, nur über den Konstrukteur. Ein Team
 * gewinnt ein Rennen einmal, auch wenn beide Autos ankommen – deshalb der
 * kleinste Platz je Team und Rennen, nicht eine Zeile je Auto.
 */
const JE_TEAM_UND_RENNEN = `
  SELECT rr.constructor_id AS wer, r.id AS rennen, r.year AS jahr, r.round AS runde,
         r.date AS datum, g.name AS grandPrix,
         MIN(rr.position)            AS platz,
         MIN(rr.qualifying_position) AS quali
    FROM race_result rr
    JOIN race r ON r.id = rr.race_id
    JOIN grand_prix g ON g.id = r.grand_prix_id
   GROUP BY rr.constructor_id, r.id
   ORDER BY r.year, r.round`

/**
 * Die Bestmarken, deren Verlauf nachgerechnet wird.
 *
 * Die ewige Punktewertung steht bewusst nicht darin. Die Punktesysteme haben
 * sich mehr als ein Dutzend Mal geändert; ein Punkterekord über Epochen hinweg
 * misst vor allem das System, nicht den Fahrer. Er stünde hier jedes Rennen
 * neu und sagte trotzdem nichts.
 */
export const KATEGORIEN = [
  {
    id: 'siege',
    titel: 'Most wins',
    einzahl: 'win',
    mehrzahl: 'wins',
    wer: 'fahrer',
    trifft: (z) => z.platz === 1,
  },
  {
    id: 'poles',
    titel: 'Most pole positions',
    einzahl: 'pole position',
    mehrzahl: 'pole positions',
    wer: 'fahrer',
    trifft: (z) => z.quali === 1,
  },
  {
    id: 'podien',
    titel: 'Most podiums',
    einzahl: 'podium',
    mehrzahl: 'podiums',
    wer: 'fahrer',
    trifft: (z) => z.gewertet === 1 && z.platz <= 3,
  },
  {
    id: 'schnellste',
    titel: 'Most fastest laps',
    einzahl: 'fastest lap',
    mehrzahl: 'fastest laps',
    wer: 'fahrer',
    trifft: (z) => z.schnellste === 1,
  },
  {
    id: 'starts',
    titel: 'Most starts',
    einzahl: 'start',
    mehrzahl: 'starts',
    wer: 'fahrer',
    trifft: (z) => z.gestartet === 1,
  },
  {
    id: 'teamSiege',
    titel: 'Most wins by a team',
    einzahl: 'win',
    mehrzahl: 'wins',
    wer: 'team',
    trifft: (z) => z.platz === 1,
  },
  {
    id: 'teamPoles',
    titel: 'Most pole positions by a team',
    einzahl: 'pole position',
    mehrzahl: 'pole positions',
    wer: 'team',
    trifft: (z) => z.quali === 1,
  },
]

/**
 * „1 win", nicht „1 wins".
 *
 * In der deutschen Fassung hing hier ein zweiter Satz Formen: Nach „mit"
 * verlangte der Dativ „mit 92 Siegen", und bei „schnellste Runde" beugte sich
 * zusätzlich das Adjektiv mit. Das Englische kennt keinen Kasus – nach jeder
 * Präposition steht dieselbe Form. Von der Tabelle bleiben deshalb Einzahl und
 * Mehrzahl übrig; die Dativformen und das Argument `kasus` sind ersatzlos
 * entfallen, statt als toter Code weitergeschleppt zu werden.
 */
export const zahlwort = (n, k) => `${n} ${n === 1 ? k.einzahl : k.mehrzahl}`

// --------------------------------------------------------------- Der Verlauf

/**
 * Den Verlauf einer Bestmarke nachrechnen.
 *
 * Läuft die Rennen in zeitlicher Reihenfolge durch und hält mit, wer wie oft
 * getroffen hat. Nach jedem Rennen steht fest, ob sich die Spitze bewegt hat
 * und wie:
 *
 *   erstmals    – die Marke entsteht (das erste Rennen der Geschichte)
 *   eingestellt – jemand hat sie erreicht und teilt sie nun
 *   alleinVorn  – die Marke war geteilt, einer der Halter zieht allein vorbei
 *   ausgebaut   – wer sie allein hielt, hat sie vergrößert
 *
 * Die Unterscheidung der letzten beiden ist keine Wortklauberei, sondern der
 * Grund, warum diese Seite existiert. Hamilton stellte Schumachers 91 Siege am
 * 11. Oktober 2020 ein und gewann zwei Wochen darauf den 92. Genau das ist der
 * Moment, in dem der Rekord fiel – als schlichter „Ausbau" verbucht wäre die
 * größte Rekordnachricht des Jahrzehnts eine Zeile unter Hunderten.
 *
 * `halter` ist stets die vollständige Menge derer, die auf dem Höchstwert
 * stehen – nicht nur der erste. Das ist keine Buchhaltung um ihrer selbst
 * willen, sondern die Bedingung dafür, dass „ausgebaut" und „alleinVorn"
 * überhaupt unterscheidbar sind.
 *
 * @param {{id: string, jahr: number, runde: number, datum: string, grandPrix: string, zeilen: object[]}[]} rennen
 * @param {(zeile: object) => boolean} trifft
 */
function verlauf(rennen, trifft) {
  const stand = new Map()
  const ereignisse = []
  let rekord = 0
  let halter = new Set()

  for (const r of rennen) {
    /** Nur wer in diesem Rennen getroffen hat, kann die Spitze bewegt haben. */
    const gestiegen = new Map()
    for (const z of r.zeilen) {
      if (!trifft(z)) continue
      const neu = (stand.get(z.wer) ?? 0) + 1
      stand.set(z.wer, neu)
      gestiegen.set(z.wer, neu)
    }
    if (gestiegen.size === 0) continue

    const spitze = Math.max(...gestiegen.values())
    if (spitze < rekord) continue

    const erreicht = [...gestiegen].filter(([, n]) => n === spitze).map(([id]) => id)
    const vorher = { wert: rekord, halter: [...halter] }
    const wo = {
      rennen: r.id,
      jahr: r.jahr,
      runde: r.runde,
      datum: r.datum,
      grandPrix: r.grandPrix,
    }

    if (spitze > rekord) {
      /*
       * Wer die Marke überbietet, stand vorher selbst darauf. Alle Zählungen
       * hier wachsen in Einerschritten, und um von 91 auf 92 zu kommen, muss
       * man bei 91 gewesen sein – wer bei 91 stand, war Mitinhaber. Überholen
       * ohne vorheriges Gleichziehen gibt es also nicht: Jeder gefallene
       * Rekord wurde zuvor eingestellt, oft Wochen davor.
       *
       * Bleibt die eine Frage, die den Unterschied macht: Hielt er die Marke
       * allein, baut er sie aus. Teilte er sie, ist dies der Augenblick, in
       * dem er sie bricht.
       */
      ereignisse.push({
        art: rekord === 0 ? 'erstmals' : halter.size > 1 ? 'alleinVorn' : 'ausgebaut',
        wert: spitze,
        vorher,
        halter: erreicht,
        ...wo,
      })
      rekord = spitze
      halter = new Set(erreicht)
    } else {
      const neue = erreicht.filter((id) => !halter.has(id))
      if (neue.length === 0) continue
      for (const id of neue) halter.add(id)
      ereignisse.push({
        art: 'eingestellt',
        wert: rekord,
        vorher,
        halter: neue,
        ...wo,
      })
    }
  }

  return { rekord, halter: [...halter], ereignisse, stand }
}

/** Die Ergebniszeilen zu Rennen bündeln, in zeitlicher Reihenfolge. */
function nachRennen(zeilen) {
  const rennen = []
  let aktuell = null
  for (const z of zeilen) {
    if (!aktuell || aktuell.id !== z.rennen) {
      aktuell = {
        id: z.rennen,
        jahr: z.jahr,
        runde: z.runde,
        datum: z.datum,
        grandPrix: z.grandPrix,
        zeilen: [],
      }
      rennen.push(aktuell)
    }
    aktuell.zeilen.push(z)
  }
  return rennen
}

/*
 * Der Rufname, nicht der Name im Pass: „Lance Stroll" statt „Lance
 * Strulovitch", „Esteban Ocon" statt „Esteban José Jean-Pierre Ocon-Khelfane".
 * Die Fahrerseiten führen den vollen Namen, hier stehen Dutzende Namen in
 * engen Zeilen nebeneinander – dieselbe Entscheidung wie in `profil.js`.
 */
const fahrerNamen = (db) =>
  new Map(
    db
      .prepare(`SELECT id, first_name || ' ' || last_name AS name FROM driver`)
      .all()
      .map((z) => [z.id, z.name]),
  )

const teamNamen = (db) =>
  new Map(db.prepare('SELECT id, name FROM constructor').all().map((z) => [z.id, z.name]))

/**
 * Der Verlauf aller Bestmarken, jeweils mit ihrer Geschichte.
 *
 * Eine Abfrage je Bezugsgröße, der Rest in JavaScript: 27.599 Ergebniszeilen
 * durchzugehen kostet Millisekunden, und die Zählregeln stehen so als
 * lesbarer Ausdruck da statt als sieben Varianten derselben SQL-Bedingung.
 */
export function rekordVerlaeufe(db) {
  const fahrerRennen = nachRennen(db.prepare(JE_FAHRER_UND_RENNEN).all())
  const teamRennen = nachRennen(db.prepare(JE_TEAM_UND_RENNEN).all())
  const fahrer = fahrerNamen(db)
  const teams = teamNamen(db)

  return KATEGORIEN.map((k) => {
    const quelle = k.wer === 'team' ? teamRennen : fahrerRennen
    const namen = k.wer === 'team' ? teams : fahrer
    const v = verlauf(quelle, k.trifft)
    const benenne = (ids) => ids.map((id) => ({ id, name: namen.get(id) ?? id }))

    return {
      kategorie: k,
      rekord: v.rekord,
      halter: benenne(v.halter),
      stand: v.stand,
      ereignisse: v.ereignisse.map((e) => ({
        ...e,
        halter: benenne(e.halter),
        vorher: { wert: e.vorher.wert, halter: benenne(e.vorher.halter) },
      })),
    }
  })
}

// ------------------------------------------------------- Was zuletzt geschah

/**
 * Die jüngsten Bewegungen, über alle Bestmarken zusammengeführt.
 *
 * Übernahmen und eingestellte Marken stehen einzeln – das sind die
 * Ereignisse, um die es geht. Ausbauten dagegen werden gebündelt: Dass der
 * Halter des Startrekords ihn in jedem Rennen um eins vergrößert, ist keine
 * Nachricht, sondern ein Nebeneffekt davon, dass er noch fährt. Als eine
 * Zeile mit Zeitraum und Zuwachs ist es wieder eine.
 *
 * @param {ReturnType<typeof rekordVerlaeufe>} verlaeufe
 * @param {{ seit?: string }} optionen `seit` als ISO-Datum.
 */
export function juengsteAenderungen(verlaeufe, { seit } = {}) {
  const grenze = seit ?? '0000-01-01'
  const einzeln = []
  const ausbauten = []

  for (const v of verlaeufe) {
    const alle = v.ereignisse
    const jung = alle.filter((e) => e.datum >= grenze)
    const zusatz = { kategorie: v.kategorie, rekordJetzt: v.rekord }

    /*
     * Ein Bruch nimmt sein Gleichziehen mit. Beides sind zwei Ereignisse und
     * bleiben es, aber als zwei Einträge gelesen wäre es dieselbe Geschichte
     * zweimal – und die Liste doppelt so lang, ohne doppelt so viel zu sagen.
     */
    const gepaart = new Set()
    alle.forEach((e, i) => {
      if (e.art !== 'alleinVorn' || e.datum < grenze) return
      const davor = alle[i - 1]
      const passt = davor?.art === 'eingestellt' && davor.wert === e.wert - 1
      if (passt) gepaart.add(davor)
      einzeln.push({ ...e, ...zusatz, zuvorEingestellt: passt ? davor : null })
    })

    /* Wer eine Marke erreicht hat und noch nicht daran vorbei ist, steht für
     * sich – das ist der Fahrer, bei dem es als Nächstes geschehen kann. */
    for (const e of jung) {
      if (e.art !== 'eingestellt' || gepaart.has(e)) continue
      einzeln.push({ ...e, ...zusatz, zuvorEingestellt: null })
    }

    /*
     * Ausbauten desselben Halters am Stück zusammenfassen. Ein Wechsel des
     * Halters dazwischen trennt zwei Läufe – sonst verschmölzen zwei
     * verschiedene Geschichten zu einer falschen.
     */
    let lauf = null
    for (const e of jung) {
      const wer = e.halter.map((h) => h.id).join('+')
      if (e.art !== 'ausgebaut') {
        lauf = null
        continue
      }
      if (lauf && lauf.wer === wer) {
        lauf.bis = e
        lauf.schritte++
      } else {
        lauf = {
          wer,
          halter: e.halter,
          von: e,
          bis: e,
          schritte: 1,
          kategorie: v.kategorie,
          rekordJetzt: v.rekord,
        }
        ausbauten.push(lauf)
      }
    }
  }

  const neueste = (a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0)
  return {
    einzeln: einzeln.sort(neueste),
    ausbauten: ausbauten
      .map((l) => ({
        kategorie: l.kategorie,
        halter: l.halter,
        schritte: l.schritte,
        /** Der Wert vor dem ersten Schritt des Laufs – der Zuwachs ist die Differenz. */
        von: l.von.vorher.wert,
        bis: l.bis.wert,
        seit: l.von,
        zuletzt: l.bis,
        datum: l.bis.datum,
        /*
         * Steht die Marke noch dort, wo dieser Lauf sie hinterließ? Nur dann
         * baut hier jemand *gerade* aus. Ein abgeschlossener Lauf ist
         * Geschichte und gehört nicht unter eine Überschrift im Präsens.
         */
        laeuftNoch: l.bis.wert === l.rekordJetzt,
      }))
      .sort(neueste),
  }
}

// ------------------------------------------------------------- Diese Saison

/** Das letzte Rennen, zu dem ein Ergebnis vorliegt – der Stand dieser Seite. */
export function datenstand(db) {
  return (
    db
      .prepare(
        `SELECT r.id, r.year AS jahr, r.round AS runde, r.date AS datum,
                g.name AS grandPrix,
                (SELECT COUNT(*) FROM race WHERE year = r.year) AS rennenImJahr,
                (SELECT COUNT(*) FROM race r2
                  WHERE r2.year = r.year AND r2.round > r.round) AS offen
           FROM race r
           JOIN grand_prix g ON g.id = r.grand_prix_id
          WHERE EXISTS (SELECT 1 FROM race_result rr WHERE rr.race_id = r.id)
          ORDER BY r.year DESC, r.round DESC
          LIMIT 1`,
      )
      .get() ?? null
  )
}

/**
 * Saisonbestmarken: was in dieser Saison noch erreichbar ist.
 *
 * Anders als die ewigen Marken ist das keine Hochrechnung, sondern eine
 * Rechnung: Es fehlen so und so viele Erfolge, und es sind so und so viele
 * Rennen übrig. Ist der Bedarf größer als das Angebot, ist die Marke für
 * diese Saison erledigt – und taucht gar nicht erst auf.
 *
 * Die Bestmarke selbst stammt aus allen Saisons einschließlich der laufenden.
 * Führt jemand bereits vor der alten Marke, steht das als solches da.
 *
 * Die Sprint-Frage stellt sich hier nicht: Gezählt werden Grands Prix, und ein
 * Sprint ist keiner. Ein Rennwochenende bringt deshalb höchstens einen Sieg,
 * eine Pole und eine schnellste Runde – und damit ist die Zahl der offenen
 * Rennen zugleich die Obergrenze dessen, was noch zu holen ist.
 */
export function saisonMarken(db, stand) {
  if (!stand) return []

  const ARTEN = [
    { id: 'siege', titel: 'Wins in a season', einzahl: 'win', mehrzahl: 'wins', bedingung: 'rr.position = 1' },
    { id: 'poles', titel: 'Pole positions in a season', einzahl: 'pole position', mehrzahl: 'pole positions', bedingung: 'rr.qualifying_position = 1' },
    { id: 'podien', titel: 'Podiums in a season', einzahl: 'podium', mehrzahl: 'podiums', bedingung: 'rr.classified = 1 AND rr.position <= 3' },
    { id: 'schnellste', titel: 'Fastest laps in a season', einzahl: 'fastest lap', mehrzahl: 'fastest laps', bedingung: 'rr.fastest_lap = 1' },
  ]

  const marken = []
  for (const a of ARTEN) {
    const jeSaison = `
      SELECT rr.driver_id AS id, r.year AS jahr, COUNT(DISTINCT rr.race_id) AS wert
        FROM race_result rr JOIN race r ON r.id = rr.race_id
       WHERE ${a.bedingung}
       GROUP BY rr.driver_id, r.year`

    const best = db
      .prepare(
        `SELECT x.id, d.first_name || ' ' || d.last_name AS name, x.jahr, x.wert
           FROM (${jeSaison}) x JOIN driver d ON d.id = x.id
          ORDER BY x.wert DESC, x.jahr LIMIT 1`,
      )
      .get()
    if (!best) continue

    const jetzt = db
      .prepare(
        `SELECT x.id, d.first_name || ' ' || d.last_name AS name, x.wert
           FROM (${jeSaison}) x JOIN driver d ON d.id = x.id
          WHERE x.jahr = ? ORDER BY x.wert DESC LIMIT 3`,
      )
      .all(stand.jahr)
    if (jetzt.length === 0) continue

    const fuehrender = jetzt[0]
    const fehltZumEinstellen = best.wert - fuehrender.wert
    /*
     * Die schnellste Runde eines Rennens gibt es genau einmal, ein Sieg
     * ebenso: Je verbleibendem Rennen ist höchstens einer zu holen. Damit ist
     * die Obergrenze schlicht die Zahl der offenen Rennen.
     */
    if (fehltZumEinstellen > stand.offen) continue

    marken.push({
      art: a,
      rekord: best,
      fuehrender,
      verfolger: jetzt.slice(1),
      fehltZumEinstellen,
      fehltZumBrechen: fehltZumEinstellen + 1,
      brechenMoeglich: fehltZumEinstellen + 1 <= stand.offen,
      haeltSchon: fehltZumEinstellen <= 0,
    })
  }

  return marken.sort((a, b) => a.fehltZumEinstellen - b.fehltZumEinstellen)
}

// ---------------------------------------------------------- Ewige Marken

/** Wer in der laufenden Saison gestartet ist – nur für die zählt eine Aussicht. */
function aktiveFahrer(db, jahr) {
  return db
    .prepare(
      `SELECT DISTINCT rr.driver_id AS id,
              d.first_name || ' ' || d.last_name AS name,
              d.date_of_birth AS geboren
         FROM race_result rr
         JOIN race r ON r.id = rr.race_id
         JOIN driver d ON d.id = rr.driver_id
        WHERE r.year = ? AND rr.started = 1`,
    )
    .all(jahr)
}

/**
 * Wie oft ein Fahrer zuletzt getroffen hat, gemessen an seinen Starts.
 *
 * Das Fenster ist bewusst kurz: Die Karrierequote eines Spätzünders unterschätzt
 * sein heutiges Tempo, die eines abgestiegenen Weltmeisters überschätzt es. Drei
 * Saisons sind lang genug, um nicht an einem Ausreißer zu hängen, und kurz genug,
 * um die Gegenwart zu treffen.
 */
function tempoFenster(db, jahr, saisons) {
  const ab = jahr - saisons + 1
  const zeilen = db
    .prepare(
      `SELECT wer, COUNT(*) AS starts,
              SUM(CASE WHEN platz = 1 THEN 1 ELSE 0 END)                  AS siege,
              SUM(CASE WHEN quali = 1 THEN 1 ELSE 0 END)                  AS poles,
              SUM(CASE WHEN gewertet = 1 AND platz <= 3 THEN 1 ELSE 0 END) AS podien,
              SUM(CASE WHEN schnellste = 1 THEN 1 ELSE 0 END)             AS schnellste
         FROM (${JE_FAHRER_UND_RENNEN})
        WHERE gestartet = 1 AND jahr >= ?
        GROUP BY wer`,
    )
    .all(ab)
  return { ab, karte: new Map(zeilen.map((z) => [z.wer, z])) }
}

/**
 * Wer einer ewigen Bestmarke nahekommt – und was das bei seinem Tempo hieße.
 *
 * Der Abstand ist eine Tatsache, die Hochrechnung ist es nicht. Deshalb
 * kommen beide getrennt heraus, und die Hochrechnung als Kennzahl: mit der
 * Zahl der Starts, auf denen sie beruht, und mit einem Vorbehalt, wenn diese
 * Zahl klein ist. Wer in drei Saisons nie getroffen hat, bekommt keine
 * Hochrechnung „unendlich", sondern gar keine – das ist der ehrlichere Wert.
 *
 * Es gibt hier absichtlich keine Schranke, ab wann etwas „zu weit weg" ist.
 * Jede solche Zahl wäre gegriffen. Stattdessen steht je Bestmarke der nächste
 * Verfolger da – das ist eine vollständige und nicht willkürliche Auskunft –
 * und die Hochrechnung sagt selbst, wie fern das ist: „zwölf Saisons" braucht
 * keine Einordnung durch die Seite. Dazu kommt jeder, dem höchstens `nah`
 * fehlt, denn das kann in Wochen geschehen und gehört unabhängig vom Rang
 * gezeigt.
 *
 * @param {{ saisons?: number, jeKategorie?: number, minStarts?: number, nah?: number }} optionen
 */
export function inReichweite(db, verlaeufe, stand, optionen = {}) {
  if (!stand) return []
  const { saisons = 3, jeKategorie = 1, minStarts = 6, nah = 3 } = optionen

  const aktive = aktiveFahrer(db, stand.jahr)
  const aktivIds = new Set(aktive.map((f) => f.id))
  const { ab, karte } = tempoFenster(db, stand.jahr, saisons)
  const proSaison = stand.rennenImJahr || 1
  const aussichten = []

  for (const v of verlaeufe) {
    const k = v.kategorie
    if (k.wer !== 'fahrer') continue
    /* Starts sind keine Leistung, sondern Anwesenheit – als Aussicht taugt das
     * nur, weil der Rekord real ist; das Tempo ist per Definition eins. */
    const tempoFeld = k.id === 'starts' ? null : k.id

    for (const f of aktive) {
      const eigene = v.stand.get(f.id) ?? 0
      if (eigene >= v.rekord) continue
      const fehlt = v.rekord - eigene + 1

      const jung = karte.get(f.id)
      const starts = jung?.starts ?? 0
      let hochrechnung
      if (tempoFeld === null) {
        hochrechnung = metric(fehlt, starts)
      } else if (starts < minStarts) {
        hochrechnung = unknown(
          `Too few starts since ${ab} to measure a strike rate.`,
          starts,
        )
      } else if ((jung?.[tempoFeld] ?? 0) === 0) {
        hochrechnung = unknown(
          `Not a single success of this kind since ${ab} – a strike rate of zero yields no number.`,
          starts,
        )
      } else {
        const rate = jung[tempoFeld] / starts
        hochrechnung = metric(Math.ceil(fehlt / rate), starts)
      }

      /* Ohne Hochrechnung bleibt nur der Abstand. Der ist ab einer gewissen
       * Größe keine Aussicht mehr, sondern eine Tabellenzeile – die steht auf
       * der Rekordseite und muss hier nicht noch einmal stehen. */
      if (hochrechnung.value === null && fehlt > 3) continue

      const rennenNoetig = hochrechnung.value
      const saisonNoetig = rennenNoetig === null ? null : rennenNoetig / proSaison
      const alter = alterAm(f.geboren, stand.datum)

      aussichten.push({
        kategorie: k,
        fahrer: f,
        eigene,
        rekord: v.rekord,
        halter: v.halter,
        fehlt,
        /** Reicht das nächste Rennen? Nur dann ist es wirklich unmittelbar. */
        naechstesRennen: fehlt === 1,
        /*
         * Fährt der Rekordhalter selbst noch, wächst die Marke weiter: Der
         * Abstand unten gilt für den Datenstand, nicht für den Tag, an dem der
         * Verfolger dort ankäme. Verschwiege die Seite das, verspräche sie ein
         * Ziel, das sich mitbewegt.
         */
        halterAktiv: v.halter.some((h) => aktivIds.has(h.id)),
        hochrechnung,
        saisonNoetig,
        alter,
        /** Wie alt er wäre, wenn die Fortschreibung aufginge – oft die Antwort selbst. */
        alterAmZiel: alter === null || saisonNoetig === null ? null : alter + saisonNoetig,
        tempo:
          tempoFeld === null || starts < minStarts
            ? null
            : metric((jung[tempoFeld] ?? 0) / starts, starts),
      })
    }
  }

  /* Was am schnellsten fallen kann, zuerst; ohne Hochrechnung ans Ende. */
  const rang = (a) => a.hochrechnung.value ?? Number.POSITIVE_INFINITY
  aussichten.sort((a, b) => rang(a) - rang(b) || a.fehlt - b.fehlt)

  const gezaehlt = new Map()
  return aussichten.filter((a) => {
    const n = (gezaehlt.get(a.kategorie.id) ?? 0) + 1
    gezaehlt.set(a.kategorie.id, n)
    return n <= jeKategorie || a.fehlt <= nah
  })
}

/** Alter in Jahren an einem Stichtag; ohne Geburtsdatum kein Alter, nicht null. */
function alterAm(geboren, stichtag) {
  if (!geboren || !stichtag) return null
  return (Date.parse(`${stichtag}T12:00:00Z`) - Date.parse(`${geboren}T12:00:00Z`)) / (365.25 * 86400000)
}

// ---------------------------------------------------------- Laufende Serien

/**
 * Serien, die gerade laufen – gemessen an der Bestmarke derselben Art.
 *
 * Eine laufende Serie endet am letzten Start des Fahrers, nicht am letzten
 * Rennen der Saison: Wer aussetzte, hat nichts verloren. Gezählt wird nur über
 * Starts, genau wie in `records.js`, sonst risse jede Serie an einem Rennen,
 * bei dem der Fahrer gar nicht dabei war.
 */
export function laufendeSerien(db, stand, { minLaenge = 3, jeArt = 3 } = {}) {
  if (!stand) return []

  const ARTEN = [
    { id: 'siege', titel: 'Consecutive wins', trifft: (z) => z.platz === 1 },
    { id: 'podien', titel: 'Consecutive podiums', trifft: (z) => z.gewertet === 1 && z.platz <= 3 },
    { id: 'punkte', titel: 'Consecutive races in the points', trifft: (z) => (z.punkte ?? 0) > 0 },
  ]

  const zeilen = db.prepare(JE_FAHRER_UND_RENNEN).all().filter((z) => z.gestartet === 1)
  const namen = fahrerNamen(db)

  const jeFahrer = new Map()
  for (const z of zeilen) {
    const liste = jeFahrer.get(z.wer) ?? []
    liste.push(z)
    jeFahrer.set(z.wer, liste)
  }

  const aktive = new Set(aktiveFahrer(db, stand.jahr).map((f) => f.id))
  const ergebnis = []

  for (const a of ARTEN) {
    let rekord = { laenge: 0, halter: [] }
    const laufende = []

    for (const [id, liste] of jeFahrer) {
      let lauf = 0
      let beste = 0
      for (const z of liste) {
        lauf = a.trifft(z) ? lauf + 1 : 0
        if (lauf > beste) beste = lauf
      }
      if (beste > rekord.laenge) rekord = { laenge: beste, halter: [id] }
      else if (beste === rekord.laenge && beste > 0) rekord.halter.push(id)

      /* `lauf` steht nach der Schleife auf der Serie, die am letzten Start
       * dieses Fahrers noch offen war – genau die laufende. */
      if (lauf >= minLaenge && aktive.has(id)) {
        laufende.push({ id, name: namen.get(id) ?? id, laenge: lauf, letztes: liste[liste.length - 1] })
      }
    }

    for (const l of laufende.sort((x, y) => y.laenge - x.laenge).slice(0, jeArt)) {
      ergebnis.push({
        art: a,
        ...l,
        rekord: rekord.laenge,
        rekordHalter: rekord.halter.map((id) => ({ id, name: namen.get(id) ?? id })),
        fehlt: Math.max(0, rekord.laenge - l.laenge + 1),
        haeltRekord: l.laenge >= rekord.laenge,
      })
    }
  }

  return ergebnis.sort((a, b) => a.fehlt - b.fehlt || b.laenge - a.laenge)
}

/** Ein Ereignis in einen Satz – die Formulierung trägt die Unterscheidung. */
export function beschreibeAenderung(e) {
  const wer = e.halter.map((h) => h.name).join(' and ')
  /** Wer die Marke bisher hielt und sie nun nicht mehr allein hat. */
  const alt = e.vorher.halter
    .filter((h) => !e.halter.some((n) => n.id === h.id))
    .map((h) => h.name)
    .join(' and ')

  if (e.art === 'eingestellt') {
    return `${wer} reaches ${zahlwort(e.wert, e.kategorie)} and now shares the record${alt ? ` with ${alt}` : ''}.`
  }
  return `${wer} moves clear with ${zahlwort(e.wert, e.kategorie)}${
    alt ? ` – ${alt} no longer shares it` : ''
  }.`
}
