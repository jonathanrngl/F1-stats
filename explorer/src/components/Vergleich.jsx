import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ein, prozent as proz, zahl } from '../lib/format.js'

/*
 * Fahrervergleich im Browser.
 *
 * Die Seite ist statisch, der Vergleich nicht: 860 Fahrer ergeben über
 * 369.000 Paarungen, das lässt sich nicht vorrendern. Der Client lädt
 * stattdessen zwei Profile aus der JSON-API und rechnet selbst.
 *
 * Die Profile liefern Summen je Saison, keine fertigen Karrierezahlen. Nur so
 * lässt sich der Zeitraum einschränken: Aus Summen kann man jeden Ausschnitt
 * bilden, aus Durchschnitten nicht.
 *
 * Der Fahrerindex kommt nicht mehr eingebettet in die Seite (289 KB HTML),
 * sondern aus /api/v1/drivers.json – derselben Datei, die jeder andere Client
 * auch bekommt, und nur, wenn der Vergleich wirklich startet.
 */

/* Vorsatz der Seite: auf GitHub Pages "/F1-stats", beim Entwickeln leer. */
const BASIS = import.meta.env.BASE_URL.replace(/\/$/, '')

const zwei = (v) => (v === null || v === undefined ? '–' : zahl(Math.round(v * 100) / 100))
const KENNUNG = /^[a-z0-9][a-z0-9-]{0,99}$/

/** Summiert die Saisons eines Profils im gewählten Zeitraum. */
function summe(profil, von, bis) {
  const s = profil.saisons.filter((x) => x.jahr >= von && x.jahr <= bis)
  const g = (f) => s.reduce((a, x) => a + (f(x) ?? 0), 0)

  const starts = g((x) => x.starts)
  const gridRennen = g((x) => x.gridRennen)
  const zielRennen = g((x) => x.zielRennen)
  const poles = g((x) => x.poles)
  const siege = g((x) => x.siege)
  const moeglich = g((x) => x.moeglich)

  return {
    jahre: s.length,
    von: s.length ? s[0].jahr : null,
    bis: s.length ? s.at(-1).jahr : null,
    starts,
    siege,
    podien: g((x) => x.podien),
    poles,
    schnellsteRunden: g((x) => x.schnellsteRunden),
    sprintSiege: g((x) => x.sprintSiege),
    punkte: g((x) => x.punkte) + g((x) => x.sprintPunkte),
    titel: s.filter((x) => x.meister).length,
    besterWMPlatz: s.map((x) => x.wmPlatz).filter((p) => p !== null).sort((a, b) => a - b)[0] ?? null,
    // Durchschnitte aus Summen – deshalb liefert die API Summen.
    oStart: gridRennen > 0 ? g((x) => x.gridSumme) / gridRennen : null,
    oZiel: zielRennen > 0 ? g((x) => x.zielSumme) / zielRennen : null,
    siegquote: starts > 0 ? siege / starts : null,
    podestquote: starts > 0 ? g((x) => x.podien) / starts : null,
    ausfallquote: starts > 0 ? g((x) => x.ausfaelle) / starts : null,
    poleZuSieg: poles > 0 ? g((x) => x.polesGewonnen) / poles : null,
    punkteProStart: starts > 0 ? g((x) => x.punkte) / starts : null,
    anteilMoeglich: moeglich > 0 ? (g((x) => x.punkte) + g((x) => x.sprintPunkte)) / moeglich : null,
    teams: [...new Set(s.flatMap((x) => x.teams))],
  }
}

/**
 * Die Zeilen des Vergleichs.
 *
 * `besser` sagt, welche Richtung gut ist: Bei der Zielposition gewinnt der
 * kleinere Wert, bei Siegen der größere. Ohne diese Angabe würde die
 * Hervorhebung bei jeder zweiten Zeile lügen. Die Erklärung steht sichtbar
 * unter dem Namen der Zeile – vorher war sie ein „?“ mit einem Tooltip, den
 * weder ein Finger noch ein Vorleser erreichte.
 */
const ZEILEN = [
  { gruppe: 'Scope' },
  { k: 'starts', label: 'Starts', f: zahl, besser: 'gross' },
  { k: 'jahre', label: 'Seasons', f: zahl, besser: 'gross' },
  { gruppe: 'Achievements' },
  { k: 'siege', label: 'Wins', f: zahl, besser: 'gross' },
  { k: 'podien', label: 'Podiums', f: zahl, besser: 'gross' },
  { k: 'poles', label: 'Pole positions', f: zahl, besser: 'gross', hinweis: 'Fastest in qualifying.' },
  { k: 'schnellsteRunden', label: 'Fastest laps', f: zahl, besser: 'gross' },
  { k: 'sprintSiege', label: 'Sprint wins', f: zahl, besser: 'gross', hinweis: 'Sprints exist since 2021.' },
  { k: 'titel', label: 'World Championships', f: zahl, besser: 'gross' },
  { k: 'besterWMPlatz', label: 'Best championship finish', f: (v) => (v ? 'P' + v : '–'), besser: 'klein' },
  { gruppe: 'Rates' },
  { k: 'siegquote', label: 'Win rate', f: proz, besser: 'gross', hinweis: 'Wins per start.' },
  { k: 'podestquote', label: 'Podium rate', f: proz, besser: 'gross' },
  { k: 'poleZuSieg', label: 'Pole-to-win conversion', f: proz, besser: 'gross', hinweis: 'Share of pole positions turned into wins.' },
  { k: 'ausfallquote', label: 'Retirement rate', f: proz, besser: 'klein', hinweis: 'Started but not classified.' },
  { gruppe: 'Averages' },
  { k: 'oStart', label: 'Avg grid position', f: ein, besser: 'klein' },
  { k: 'oZiel', label: 'Avg finish', f: ein, besser: 'klein', hinweis: 'Classified finishes only.' },
  { gruppe: 'Across eras' },
  {
    k: 'anteilMoeglich',
    label: 'Share of possible points',
    f: proz,
    besser: 'gross',
    hinweis: 'Points scored against the most each start could have brought under the rules of its own year – a win was 9 points in 1955 and 26 in 2024.',
  },
  {
    k: 'punkteProStart',
    label: 'Points per start',
    f: zwei,
    besser: 'gross',
    hinweis: 'Not comparable across eras: the points system has changed seven times.',
  },
]

/** Einstiege, weil zwei leere Felder eine Sackgasse sind. */
const VORSCHLAEGE = [
  { ids: ['ayrton-senna', 'alain-prost'], titel: 'Senna vs Prost', warum: 'Team-mates at McLaren, 1988–1989' },
  { ids: ['lewis-hamilton', 'michael-schumacher'], titel: 'Hamilton vs Schumacher', warum: 'The two largest win tallies' },
  { ids: ['max-verstappen', 'lewis-hamilton'], titel: 'Verstappen vs Hamilton', warum: 'The 2021 title fight' },
  { ids: ['lewis-hamilton', 'nico-rosberg'], titel: 'Hamilton vs Rosberg', warum: 'Team-mates at Mercedes, 2013–2016' },
  { ids: ['niki-lauda', 'james-hunt'], titel: 'Lauda vs Hunt', warum: 'The 1976 season' },
  { ids: ['lando-norris', 'oscar-piastri'], titel: 'Norris vs Piastri', warum: 'Team-mates at McLaren today' },
  { ids: ['juan-manuel-fangio', 'jim-clark'], titel: 'Fangio vs Clark', warum: 'Two eras, both dominant' },
]

export default function Vergleich() {
  const [index, setIndex] = useState(null)
  /*
   * Die Auswahl steht in der Adresse (?a=…&b=…&von=…&bis=…), gelesen wird sie
   * aber erst nach dem Einhängen, nicht im Anfangswert. Der Server rendert die
   * Seite ohne Adresse – las der erste Render im Browser sie schon, sahen beide
   * verschieden aus, und React verwarf beim Hydrieren das ganze Gerüst.
   */
  const [ids, setIds] = useState(['', ''])
  const [zeitraum, setZeitraum] = useState(null)
  const [bereit, setBereit] = useState(false)
  const [profile, setProfile] = useState({})
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const aus = [p.get('a') ?? '', p.get('b') ?? ''].map((x) => (KENNUNG.test(x) ? x : ''))
    const von = Number(p.get('von'))
    const bis = Number(p.get('bis'))
    fetch(`${BASIS}/api/v1/drivers.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('The driver list could not be loaded.'))))
      .then((liste) => {
        const bekannt = new Set(liste.map((f) => f.id))
        setIndex(liste)
        // Nur, was es gibt: Eine Adresse darf keinen Abruf beliebiger Pfade auslösen.
        setIds(aus.map((x) => (bekannt.has(x) ? x : '')))
        if (von >= 1950 && bis >= von) setZeitraum([von, bis])
        setBereit(true)
      })
      .catch((e) => {
        setFehler(e.message)
        setBereit(true)
      })
  }, [])

  // Profile nachladen, sobald eine Auswahl steht.
  const fehlend = ids.filter((id) => id && !profile[id])
  const laedt = fehlend.length > 0 && !fehler
  const fehlendSchluessel = fehlend.join('|')
  useEffect(() => {
    if (!fehlendSchluessel) return
    let abgebrochen = false
    Promise.all(
      fehlendSchluessel.split('|').map((id) =>
        fetch(`${BASIS}/api/v1/drivers/${id}.json`).then((r) => {
          if (!r.ok) throw new Error(`The profile of ${id} could not be loaded.`)
          return r.json()
        }),
      ),
    )
      .then((geladen) => {
        if (!abgebrochen) setProfile((p) => ({ ...p, ...Object.fromEntries(geladen.map((g) => [g.id, g])) }))
      })
      .catch((e) => !abgebrochen && setFehler(e.message))
    return () => {
      abgebrochen = true
    }
  }, [fehlendSchluessel])

  // Die Adresse mitführen, damit ein Vergleich teilbar ist – der Zeitraum eingeschlossen.
  useEffect(() => {
    if (!bereit) return
    const p = new URLSearchParams()
    if (ids[0]) p.set('a', ids[0])
    if (ids[1]) p.set('b', ids[1])
    if (zeitraum) {
      p.set('von', String(zeitraum[0]))
      p.set('bis', String(zeitraum[1]))
    }
    window.history.replaceState(null, '', p.toString() ? `?${p}` : window.location.pathname)
  }, [ids, zeitraum, bereit])

  const beide = useMemo(() => ids.map((id) => profile[id]).filter(Boolean), [ids, profile])
  const vollstaendig = beide.length === 2 && ids.every(Boolean)

  /** Gemeinsamer Zeitraum als Vorschlag – dort ist der Vergleich am fairsten. */
  const grenzen = useMemo(() => {
    if (!vollstaendig) return null
    const von = Math.min(...beide.map((p) => p.von))
    const bis = Math.max(...beide.map((p) => p.bis))
    const gemeinsamVon = Math.max(...beide.map((p) => p.von))
    const gemeinsamBis = Math.min(...beide.map((p) => p.bis))
    return { von, bis, gemeinsamVon, gemeinsamBis, gibtUeberschneidung: gemeinsamVon <= gemeinsamBis }
  }, [vollstaendig, beide])

  const spanneVon = zeitraum?.[0] ?? grenzen?.von
  const spanneBis = zeitraum?.[1] ?? grenzen?.bis
  const werte = useMemo(
    () => (vollstaendig && spanneVon ? beide.map((p) => summe(p, spanneVon, spanneBis)) : null),
    [vollstaendig, beide, spanneVon, spanneBis],
  )

  /** Fuhren die beiden je im selben Team? Dann gibt es eine direkte Bilanz. */
  const duell = useMemo(() => {
    if (!vollstaendig) return null
    return beide[0].teamkollegen?.find((t) => t.driverId === beide[1].id) ?? null
  }, [vollstaendig, beide])

  const waehle = (i, id) => {
    setIds((alt) => alt.map((x, j) => (j === i ? id : x)))
    setZeitraum(null)
    setFehler('')
  }

  const vorschlaege = useMemo(() => {
    if (!index) return []
    const bekannt = new Set(index.map((f) => f.id))
    return VORSCHLAEGE.filter((v) => v.ids.every((id) => bekannt.has(id)))
  }, [index])

  if (!index) {
    return fehler
      ? <p className="fehler" role="alert">{fehler}</p>
      : <p className="status" role="status">Loading the list of drivers …</p>
  }

  return (
    <div className="vgl">
      <div className="waehler">
        {[0, 1].map((i) => (
          <Auswahl
            key={i}
            index={index}
            wert={ids[i]}
            gesperrt={ids[1 - i]}
            label={i === 0 ? 'First driver' : 'Second driver'}
            // Kommt man mit ?a= von einer Fahrerseite, wartet das zweite Feld.
            fokus={i === 1 && bereit && !!ids[0] && !ids[1]}
            onWahl={(id) => waehle(i, id)}
          />
        ))}
      </div>

      {fehler && <p className="fehler" role="alert">{fehler}</p>}
      {laedt && <p className="status" role="status">Loading profiles …</p>}

      {bereit && !vollstaendig && !laedt && (
        <div className="leer">
          <p className="status">
            Choose two drivers. The comparison is worked out in your browser – including for a
            period you set yourself.
          </p>
          {vorschlaege.length > 0 && (
            <>
              <p className="anstoss">Or start from one of these:</p>
              <ul className="paarungen">
                {vorschlaege.map((v) => (
                  <li key={v.ids.join('-')}>
                    <a
                      href={`?a=${v.ids[0]}&b=${v.ids[1]}`}
                      onClick={(e) => {
                        e.preventDefault()
                        setIds(v.ids)
                        setZeitraum(null)
                      }}
                    >
                      <b>{v.titel}</b>
                      <span>{v.warum}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {vollstaendig && werte && grenzen && (
        <>
          <fieldset className="zeitwahl">
            <legend>Period</legend>
            <div className="knoepfe">
              <button type="button" aria-pressed={!zeitraum} onClick={() => setZeitraum(null)}>
                Full careers
              </button>
              {grenzen.gibtUeberschneidung && (
                <button
                  type="button"
                  aria-pressed={!!zeitraum && zeitraum[0] === grenzen.gemeinsamVon && zeitraum[1] === grenzen.gemeinsamBis}
                  onClick={() => setZeitraum([grenzen.gemeinsamVon, grenzen.gemeinsamBis])}
                >
                  Overlapping years {grenzen.gemeinsamVon}–{grenzen.gemeinsamBis}
                </button>
              )}
            </div>
            <div className="regler">
              <label>
                from
                <input type="number" inputMode="numeric" min={grenzen.von} max={spanneBis} value={spanneVon}
                  onChange={(e) => setZeitraum([Number(e.target.value), spanneBis])} />
              </label>
              <label>
                to
                <input type="number" inputMode="numeric" min={spanneVon} max={grenzen.bis} value={spanneBis}
                  onChange={(e) => setZeitraum([spanneVon, Number(e.target.value)])} />
              </label>
            </div>
          </fieldset>

          <div className="vgl-kopf">
            {beide.map((p, i) => (
              <div key={p.id} className={`kopfkarte s${i}`}>
                <span className="kuerzel">{p.land.code}</span>
                <a href={`${BASIS}/drivers/${p.id}/`}>{p.name}</a>
                <i>
                  {werte[i].von ? `${werte[i].von}–${werte[i].bis}` : 'no races in this period'}
                  {werte[i].teams.length > 0 && ` · ${werte[i].teams.slice(0, 3).join(', ')}`}
                </i>
              </div>
            ))}
          </div>

          {werte.some((w) => w.starts === 0) && (
            <p className="hinweis">
              At least one of the two did not contest a race in this period. The rates stay empty
              rather than claim a zero.
            </p>
          )}

          <table className="gegen">
            <caption className="sr-only">{beide[0].name} and {beide[1].name} compared, {spanneVon}–{spanneBis}</caption>
            <thead className="sr-only">
              <tr><th scope="col">{beide[0].name}</th><th scope="col">Figure</th><th scope="col">{beide[1].name}</th></tr>
            </thead>
            <tbody>
              {ZEILEN.map((z) =>
                z.gruppe ? (
                  <tr key={z.gruppe} className="gruppe">
                    <th colSpan={3} scope="colgroup">{z.gruppe}</th>
                  </tr>
                ) : (
                  <Zeile key={z.k} z={z} a={werte[0][z.k]} b={werte[1][z.k]} />
                ),
              )}
            </tbody>
          </table>

          {duell && duell.rennDuelle + duell.qualiDuelle > 0 && (
            <section className="duell">
              <h2>As team-mates</h2>
              <p>
                The two of them drove the same car in {duell.jahre.join(', ')}. That is the only
                genuinely fair comparison there is – same machinery, same races.
              </p>
              <table className="gegen">
                <tbody>
                  <Zeile z={{ label: 'Race head-to-head', f: zahl, besser: 'gross' }} a={duell.rennSiege} b={duell.rennDuelle - duell.rennSiege} />
                  <Zeile z={{ label: 'Qualifying head-to-head', f: zahl, besser: 'gross' }} a={duell.qualiSiege} b={duell.qualiDuelle - duell.qualiSiege} />
                  <Zeile z={{ label: 'Points in those years', f: ein, besser: 'gross' }} a={duell.punkteSelbst} b={duell.punkteAndere} />
                </tbody>
              </table>
              <p className="fuss">
                In the race, only those in which both reached the finish are counted – a
                retirement says nothing about the head-to-head.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/*
 * Eine Vergleichszeile mit Balken. Der bessere Wert trägt die Akzentfarbe.
 * Die Balkenbreite geht über eine CSS-Variable in einer Klasse von 0 bis 20:
 * Die Inhaltsrichtlinie blockiert style-Attribute nicht bei React (es setzt
 * sie über die CSSOM), aber so bleibt es auch dann richtig, wenn sie es täte.
 */
function Zeile({ z, a, b }) {
  const zahlen = [a, b].map((v) => (typeof v === 'number' ? v : null))
  const max = Math.max(...zahlen.map((v) => (v === null ? 0 : Math.abs(v))), 0.0001)

  let fuehrt = null
  if (zahlen[0] !== null && zahlen[1] !== null && zahlen[0] !== zahlen[1]) {
    const groesser = zahlen[0] > zahlen[1] ? 0 : 1
    fuehrt = z.besser === 'klein' ? 1 - groesser : groesser
  }
  const stufe = (v) => `b${Math.round(((v ?? 0) / max) * 20)}`

  return (
    <tr>
      <td className={`wert links${fuehrt === 0 ? ' fuehrt' : ''}`}>
        <b>{z.f(a)}</b>
        {fuehrt === 0 && <span className="sr-only"> (ahead)</span>}
        <span className={`balken ${stufe(zahlen[0])}`} aria-hidden="true" />
      </td>
      <th scope="row">
        {z.label}
        {z.hinweis && <small>{z.hinweis}</small>}
      </th>
      <td className={`wert rechts${fuehrt === 1 ? ' fuehrt' : ''}`}>
        <b>{z.f(b)}</b>
        {fuehrt === 1 && <span className="sr-only"> (ahead)</span>}
        <span className={`balken ${stufe(zahlen[1])}`} aria-hidden="true" />
      </td>
    </tr>
  )
}

const falte = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Auswahlfeld über alle Fahrer: eine Combobox wie die Suche in der Kopfleiste.
 * Pfeiltasten wählen, Enter übernimmt, und wenn nichts passt, steht das da.
 */
function Auswahl({ index, wert, gesperrt, label, fokus, onWahl }) {
  const [frage, setFrage] = useState('')
  const [offen, setOffen] = useState(false)
  const [aktiv, setAktiv] = useState(0)
  const feld = useRef(null)
  const id = useId()

  const gewaehlt = index.find((f) => f.id === wert)

  useEffect(() => {
    if (fokus) feld.current?.focus()
  }, [fokus])

  const treffer = useMemo(() => {
    const woerter = falte(frage).trim().split(/\s+/).filter(Boolean)
    if (woerter.join('').length < 2) return []
    const rang = (f) => {
      const n = falte(f.name)
      const teile = n.split(/[\s-]+/)
      if (!woerter.every((w) => teile.some((t) => t.startsWith(w)) || n.includes(w))) return -1
      const q = woerter.join(' ')
      const k = (f.kuerzel ?? '').toLowerCase()
      if (k === q) return 0
      if (teile.at(-1).startsWith(q)) return 1
      if (n.startsWith(q)) return 2
      return 3
    }
    return index
      .map((f) => ({ f, r: rang(f) }))
      .filter((x) => x.r >= 0 && x.f.id !== gesperrt)
      .sort((a, b) => a.r - b.r || (b.f.starts ?? 0) - (a.f.starts ?? 0))
      .slice(0, 8)
      .map((x) => x.f)
  }, [index, frage, gesperrt])

  const nimm = (f) => {
    onWahl(f.id)
    setFrage('')
    setOffen(false)
    setAktiv(0)
  }

  const taste = (e) => {
    if (!treffer.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAktiv((i) => (i + 1) % treffer.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAktiv((i) => (i - 1 + treffer.length) % treffer.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      nimm(treffer[aktiv] ?? treffer[0])
    } else if (e.key === 'Escape') {
      setFrage('')
      if (gewaehlt) setOffen(false)
    }
  }

  const zeigeListe = frage.trim().length >= 2

  return (
    <div className="auswahl">
      <label htmlFor={`${id}-feld`}>{label}</label>
      {gewaehlt && !offen ? (
        <button type="button" id={`${id}-feld`} className="gewaehlt" onClick={() => setOffen(true)}
          aria-label={`${label}: ${gewaehlt.name}. Change`}>
          <span className="kuerzel" aria-hidden="true">{gewaehlt.land ?? '—'}</span>
          <b>{gewaehlt.name}</b>
          <i>{gewaehlt.von}–{gewaehlt.bis} · change</i>
        </button>
      ) : (
        <div className="feld">
          <input
            ref={feld}
            id={`${id}-feld`}
            type="search"
            role="combobox"
            aria-expanded={zeigeListe}
            aria-controls={`${id}-liste`}
            aria-autocomplete="list"
            aria-activedescendant={zeigeListe && treffer.length ? `${id}-o${aktiv}` : undefined}
            autoComplete="off"
            value={frage}
            autoFocus={offen}
            placeholder="Name or three-letter code"
            onChange={(e) => {
              setFrage(e.target.value)
              setAktiv(0)
            }}
            onKeyDown={taste}
          />
          {zeigeListe && (
            <ul id={`${id}-liste`} role="listbox" aria-label={`${label} – matches`}>
              {treffer.length === 0 && <li className="kein-treffer">No driver matches “{frage.trim()}”.</li>}
              {treffer.map((f, i) => (
                <li key={f.id} id={`${id}-o${i}`} role="option" aria-selected={i === aktiv}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => nimm(f)} onMouseEnter={() => setAktiv(i)}>
                  <span className="kuerzel" aria-hidden="true">{f.land ?? '—'}</span>
                  <b>{f.name}</b>
                  <i>{f.von}–{f.bis} · {f.siege ? `${f.siege} wins` : `${f.starts ?? 0} starts`}</i>
                </li>
              ))}
            </ul>
          )}
          <p className="sr-only" role="status" aria-live="polite">
            {zeigeListe ? `${treffer.length} matches` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
