import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Das Quiz im Browser.
 *
 * Die Fragen entstehen beim Bauen (engine/quiz.js); hier wird nur ausgewählt,
 * gemischt und gezählt. Der Vorrat kommt als eine Datei, danach braucht keine
 * Runde mehr eine Anfrage.
 *
 * Gemischt wird erst beim Klick auf „Start", nie im ersten Render. Der Server
 * zeichnet die Seite ohne Zufall; zöge der Browser schon beim Hydrieren
 * andere Fragen, sähen beide verschieden aus, und React verwürfe das ganze
 * Gerüst – derselbe Fehler, den der Fahrervergleich mit der Adresse hatte.
 */

const BASIS = import.meta.env.BASE_URL.replace(/\/$/, '')

const LAENGEN = [5, 10, 20]

const STUFEN_TEXT = {
  0: { label: 'Mixed', dazu: 'Starts easy, ends hard' },
  1: { label: 'Easy', dazu: 'Recent seasons and famous names' },
  2: { label: 'Medium', dazu: 'Forty years of racing, in more detail' },
  3: { label: 'Hard', dazu: 'The early decades and the fine print' },
}

/** Wohin der Verweis unter einer Auflösung führt – am Pfad abgelesen. */
const ZIEL = {
  drivers: 'Driver profile',
  teams: 'Team page',
  seasons: 'Season',
  races: 'Race result',
  circuits: 'Circuit page',
  records: 'Records',
  engines: 'Engine page',
}

const BUCHSTABEN = ['A', 'B', 'C', 'D']

/*
 * Welche Fragen jemand schon gesehen hat, merkt sich der Browser – die
 * letzten 400. Eine neue Runde nimmt zuerst, was noch nicht dran war; erst
 * wenn der Vorrat einer Auswahl erschöpft ist, kommt Bekanntes wieder.
 * localStorage kann fehlen oder werfen (privates Fenster, gesperrte
 * Website-Daten); dann gibt es eben kein Gedächtnis, aber ein Quiz.
 */
const SPEICHER = 'quiz-gesehen'
const MERKEN = 400

function gesehenLesen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SPEICHER) ?? '[]'))
  } catch {
    return new Set()
  }
}

function gesehenMerken(id) {
  try {
    const alt = JSON.parse(localStorage.getItem(SPEICHER) ?? '[]').filter((x) => x !== id)
    localStorage.setItem(SPEICHER, JSON.stringify([...alt, id].slice(-MERKEN)))
  } catch {}
}

function mische(liste) {
  const a = [...liste]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const alsZahl = (s) => Number(String(s).replace(/[^\d.-]/g, ''))

/** Eine gemischte Runde: ein Drittel je Stufe, der Rest in die Mitte. 10 → 3 · 4 · 3. */
function verteile(laenge) {
  const je = Math.floor(laenge / 3)
  const rest = laenge - je * 3
  return { 1: je + (rest >= 2 ? 1 : 0), 2: je + (rest >= 1 ? 1 : 0), 3: je }
}

/**
 * Zieht `anzahl` Fragen aus den Kandidaten.
 *
 * Drei Wünsche, in dieser Reihenfolge: Ungesehenes vor Gesehenem. Die
 * Bereiche reihum, wobei der bisher seltenste zuerst drankommt – wer „alle
 * Bereiche" wählt, soll auch alle sehen und nicht sieben Fahrerfragen. Und
 * kein Thema zweimal: Wer gerade nach dem Weltmeister von 2008 gefragt wurde,
 * soll nicht in der nächsten Frage dessen Teamkollegen erraten, weil die
 * Saison schon auf dem Tisch liegt. Reicht der Vorrat dafür nicht, darf ein
 * Thema doppelt vorkommen – eine kürzere Runde wäre schlechter.
 */
function waehle(kandidaten, anzahl, gesehen, themen, zaehler) {
  const geordnet = [
    ...mische(kandidaten.filter((f) => !gesehen.has(f.i))),
    ...mische(kandidaten.filter((f) => gesehen.has(f.i))),
  ]
  const schlangen = new Map()
  for (const f of geordnet) schlangen.set(f.b, [...(schlangen.get(f.b) ?? []), f])

  const aus = []
  const nimm = (f) => {
    aus.push(f)
    if (f.t) themen.add(f.t)
    zaehler.set(f.b, (zaehler.get(f.b) ?? 0) + 1)
    schlangen.set(f.b, schlangen.get(f.b).filter((x) => x !== f))
  }

  while (aus.length < anzahl) {
    const reihe = mische([...schlangen.keys()]).sort((a, b) => (zaehler.get(a) ?? 0) - (zaehler.get(b) ?? 0))
    const bereich = reihe.find((b) => schlangen.get(b).some((f) => !f.t || !themen.has(f.t)))
    if (!bereich) break
    nimm(schlangen.get(bereich).find((f) => !f.t || !themen.has(f.t)))
  }
  for (const f of geordnet) {
    if (aus.length >= anzahl) break
    if (!aus.includes(f)) nimm(f)
  }
  return aus
}

function neueRunde(pool, wahl) {
  const passend = pool.filter((f) => wahl.bereiche.includes(f.b) && (wahl.stufe === 0 || f.s === wahl.stufe))
  const gesehen = gesehenLesen()
  const themen = new Set()
  const zaehler = new Map()
  const ziel = wahl.stufe === 0 ? verteile(wahl.laenge) : { [wahl.stufe]: wahl.laenge }

  let fragen = []
  for (const [stufe, anzahl] of Object.entries(ziel)) {
    fragen.push(...waehle(passend.filter((f) => f.s === Number(stufe)), anzahl, gesehen, themen, zaehler))
  }
  // Fehlt einer Stufe der Vorrat, füllen die anderen auf.
  if (fragen.length < wahl.laenge) {
    const uebrig = passend.filter((f) => !fragen.includes(f))
    fragen.push(...waehle(uebrig, wahl.laenge - fragen.length, gesehen, themen, zaehler))
  }
  // Gemischt heißt: von leicht nach schwer. Sonst bleibt die Reihenfolge zufällig.
  fragen = wahl.stufe === 0 ? fragen.sort((a, b) => a.s - b.s) : mische(fragen)

  return fragen.map((f) => ({
    ...f,
    // Zahlen der Größe nach, damit man nicht erst sortieren muss; alles andere gemischt.
    optionen: f.n ? [...f.o].sort((a, b) => alsZahl(a) - alsZahl(b)) : mische(f.o),
  }))
}

function urteil(richtig, gesamt) {
  const anteil = gesamt ? richtig / gesamt : 0
  if (anteil === 1) return 'Grand slam – every answer right.'
  if (anteil >= 0.8) return 'On the podium.'
  if (anteil >= 0.5) return 'In the points.'
  if (anteil > 0) return 'Outside the points this time.'
  return 'Retired on the first lap. Another go?'
}

export default function Quiz({ bereiche, stufen }) {
  const [pool, setPool] = useState(null)
  const [fehler, setFehler] = useState('')
  const [wahl, setWahl] = useState({ bereiche: bereiche.map((b) => b.id), stufe: 0, laenge: 10 })
  const [spiel, setSpiel] = useState(null)

  const frageKopf = useRef(null)
  const weiterKnopf = useRef(null)
  const endeKopf = useRef(null)

  useEffect(() => {
    fetch(`${BASIS}/data/quiz.json`)
      .then((r) => {
        if (!r.ok) throw new Error('The questions could not be loaded.')
        return r.json()
      })
      .then(setPool)
      .catch((e) => setFehler(e.message))
  }, [])

  /* Die Zahlen für die Auswahl kommen vorgerendert mit – sie stehen, bevor der Vorrat geladen ist. */
  const anzahlFuer = (stufe) =>
    bereiche
      .filter((b) => wahl.bereiche.includes(b.id))
      .reduce((s, b) => s + (stufe === 0 ? b.n[1] + b.n[2] + b.n[3] : b.n[stufe]), 0)
  const verfuegbar = anzahlFuer(wahl.stufe)

  const frage = spiel && spiel.index < spiel.fragen.length ? spiel.fragen[spiel.index] : null
  const antwort = frage ? spiel.antworten[spiel.index] : undefined
  const beantwortet = antwort !== undefined
  const istRichtig = (f, a) => a !== undefined && f.optionen[a] === f.o[0]
  const punkte = spiel ? spiel.fragen.filter((f, i) => istRichtig(f, spiel.antworten[i])).length : 0
  const vorbei = spiel && spiel.index >= spiel.fragen.length

  const starte = () => {
    if (!pool) return
    const fragen = neueRunde(pool, wahl)
    if (fragen.length) setSpiel({ fragen, antworten: [], index: 0, stufe: wahl.stufe })
  }

  const antworte = (j) => {
    if (!frage || beantwortet) return
    gesehenMerken(frage.i)
    setSpiel((s) => {
      const antworten = [...s.antworten]
      antworten[s.index] = j
      return { ...s, antworten }
    })
  }

  const weiter = () => setSpiel((s) => ({ ...s, index: s.index + 1 }))

  /* Der Fokus folgt dem Geschehen: neue Frage → ihr Text, Antwort → „Weiter", Ende → Ergebnis. */
  useEffect(() => {
    if (frage && !beantwortet) frageKopf.current?.focus()
    else if (frage && beantwortet) weiterKnopf.current?.focus()
    else if (vorbei) endeKopf.current?.focus()
  }, [spiel?.index, beantwortet, vorbei])

  /*
   * Tasten: 1–4 oder A–D antworten. Weiter geht es mit Enter, ohne eigene
   * Regel – nach der Antwort steht der Fokus ohnehin auf dem Knopf.
   */
  useEffect(() => {
    if (!frage || beantwortet) return
    const taste = (e) => {
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      const j = '1234'.includes(e.key) ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase())
      if (j >= 0 && j < frage.optionen.length) {
        e.preventDefault()
        antworte(j)
      }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [frage, beantwortet])

  const nachStufe = useMemo(() => {
    if (!vorbei || spiel.stufe !== 0) return null
    return stufen.map((s) => {
      const hier = spiel.fragen.map((f, i) => [f, spiel.antworten[i]]).filter(([f]) => f.s === s.id)
      return { ...s, gesamt: hier.length, richtig: hier.filter(([f, a]) => istRichtig(f, a)).length }
    })
  }, [vorbei, spiel, stufen])

  const labelBereich = (id) => bereiche.find((b) => b.id === id)?.label ?? id
  const labelStufe = (id) => stufen.find((s) => s.id === id)?.label ?? ''
  const verweis = (f) =>
    f.l && (
      <a className="quiz-verweis" href={`${BASIS}/${f.l}`} target="_blank" rel="noopener">
        {ZIEL[f.l.split('/')[0]] ?? 'More'} →<span className="sr-only"> (opens in a new tab)</span>
      </a>
    )

  // ------------------------------------------------------------ Auswahl

  if (!spiel) {
    const alleAn = wahl.bereiche.length === bereiche.length
    const umschalten = (id) =>
      setWahl((w) => ({
        ...w,
        bereiche: w.bereiche.includes(id) ? w.bereiche.filter((x) => x !== id) : [...w.bereiche, id],
      }))

    return (
      <div className="quiz">
        <div className="quiz-wahl">
          <fieldset>
            <legend>Difficulty</legend>
            <div className="stufenwahl">
              {[0, 1, 2, 3].map((s) => (
                <label key={s} className={wahl.stufe === s ? 'an' : undefined}>
                  <input
                    type="radio"
                    name="stufe"
                    checked={wahl.stufe === s}
                    onChange={() => setWahl((w) => ({ ...w, stufe: s }))}
                  />
                  <b>{STUFEN_TEXT[s].label}</b>
                  <span>{STUFEN_TEXT[s].dazu}</span>
                  <i>{anzahlFuer(s).toLocaleString('en-GB')} questions</i>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Topics</legend>
            <div className="themenwahl">
              {bereiche.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={wahl.bereiche.includes(b.id)}
                  onClick={() => umschalten(b.id)}
                >
                  {b.label}
                </button>
              ))}
              {/* Wer nur ein Thema will, leert erst alles – sonst wären es sechs Klicks. */}
              <button
                type="button"
                className="alle"
                onClick={() => setWahl((w) => ({ ...w, bereiche: alleAn ? [] : bereiche.map((b) => b.id) }))}
              >
                {alleAn ? 'Clear all' : 'Select all'}
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Questions per round</legend>
            <div className="laengenwahl">
              {LAENGEN.map((n) => (
                <label key={n} className={wahl.laenge === n ? 'an' : undefined}>
                  <input
                    type="radio"
                    name="laenge"
                    checked={wahl.laenge === n}
                    onChange={() => setWahl((w) => ({ ...w, laenge: n }))}
                  />
                  {n}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="quiz-start">
            <button type="button" className="quiz-knopf" onClick={starte} disabled={!pool || verfuegbar === 0}>
              {pool || fehler ? 'Start the quiz' : 'Loading questions …'}
            </button>
            <p>
              {wahl.bereiche.length === 0
                ? 'Choose at least one topic.'
                : verfuegbar < wahl.laenge
                  ? `Only ${verfuegbar} questions match – the round will be shorter.`
                  : `${verfuegbar.toLocaleString('en-GB')} questions match. Questions you have already seen come last.`}
            </p>
          </div>
          {fehler && <p className="quiz-fehler">{fehler}</p>}
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------- Ergebnis

  if (vorbei) {
    return (
      <div className="quiz">
        <section className="quiz-ende" aria-labelledby="quiz-ergebnis">
          <h2 id="quiz-ergebnis" ref={endeKopf} tabIndex={-1}>
            <span>Your result</span>
            <b>
              {punkte} <small>/ {spiel.fragen.length}</small>
            </b>
          </h2>
          <p className="urteil">{urteil(punkte, spiel.fragen.length)}</p>
          {nachStufe && (
            <ul className="nach-stufe">
              {nachStufe.filter((s) => s.gesamt).map((s) => (
                <li key={s.id}>
                  <span>{s.label}</span> <b>{s.richtig}/{s.gesamt}</b>
                </li>
              ))}
            </ul>
          )}
          <div className="quiz-knoepfe">
            <button type="button" className="quiz-knopf" onClick={starte}>
              Play again
            </button>
            <button type="button" className="quiz-knopf leise" onClick={() => setSpiel(null)}>
              Change settings
            </button>
          </div>
        </section>

        <h3 className="rueckblick-kopf">Your answers</h3>
        <ol className="rueckblick">
          {spiel.fragen.map((f, i) => {
            const a = spiel.antworten[i]
            const ok = istRichtig(f, a)
            return (
              <li key={f.i} className={ok ? 'gut' : 'schlecht'}>
                <span className="marke" aria-label={ok ? 'Correct' : 'Wrong'}>{ok ? '✓' : '✗'}</span>
                <div>
                  <p className="frage-text">{f.f}</p>
                  <p className="antwort-text">
                    {!ok && <><s>{f.optionen[a]}</s>{' '}</>}
                    <b>{f.o[0]}</b>
                  </p>
                  <p className="erklaer-text">
                    {f.e} {verweis(f)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  // ---------------------------------------------------------------- Frage

  const korrekt = istRichtig(frage, antwort)
  const letzte = spiel.index === spiel.fragen.length - 1

  return (
    <div className="quiz">
      <section className="quiz-frage" aria-labelledby="quiz-frage-text">
        <div className="quiz-kopf">
          <span className="zaehler">
            Question <b>{spiel.index + 1}</b> of {spiel.fragen.length}
          </span>
          <span className="etikett">{labelBereich(frage.b)}</span>
          <span className={`etikett stufe-${frage.s}`}>{labelStufe(frage.s)}</span>
          <span className="stand">
            Score <b>{punkte}</b>
          </span>
        </div>

        <ol className="quiz-leiste" aria-hidden="true">
          {spiel.fragen.map((f, i) => (
            <li
              key={f.i}
              className={
                i === spiel.index && !beantwortet
                  ? 'jetzt'
                  : spiel.antworten[i] === undefined
                    ? undefined
                    : istRichtig(f, spiel.antworten[i])
                      ? 'gut'
                      : 'schlecht'
              }
            />
          ))}
        </ol>

        <h2 id="quiz-frage-text" ref={frageKopf} tabIndex={-1}>
          {frage.f}
        </h2>

        <ul className="antworten">
          {frage.optionen.map((o, j) => {
            const richtigeOption = o === frage.o[0]
            const zustand = !beantwortet
              ? undefined
              : richtigeOption
                ? 'gut'
                : j === antwort
                  ? 'schlecht'
                  : 'still'
            return (
              <li key={o}>
                <button type="button" className={zustand} onClick={() => antworte(j)} disabled={beantwortet}>
                  <kbd aria-hidden="true">{BUCHSTABEN[j]}</kbd>
                  <span>{o}</span>
                  {zustand === 'gut' && <i aria-hidden="true">✓</i>}
                  {zustand === 'schlecht' && <i aria-hidden="true">✗</i>}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="aufloesung-platz" role="status">
          {beantwortet && (
            <div className={`aufloesung ${korrekt ? 'gut' : 'schlecht'}`}>
              <p>
                <b>{korrekt ? 'Correct.' : `Not quite – it's ${frage.o[0]}.`}</b> {frage.e}
              </p>
              <div className="aufloesung-fuss">
                {verweis(frage)}
                <button type="button" ref={weiterKnopf} className="quiz-knopf" onClick={weiter}>
                  {letzte ? 'See your result' : 'Next question'}
                </button>
              </div>
            </div>
          )}
        </div>

        {!beantwortet && <p className="tastenhinweis">Keys 1–4 or A–D pick an answer.</p>}
      </section>

      <button type="button" className="quiz-abbruch" onClick={() => setSpiel(null)}>
        Leave this round
      </button>
    </div>
  )
}
