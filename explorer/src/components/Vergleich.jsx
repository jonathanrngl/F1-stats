import { useEffect, useMemo, useState } from 'react'
import { ein, prozent as proz, zahl } from '../lib/format.js'

/*
 * Fahrervergleich im Browser.
 *
 * Die Seite ist statisch, der Vergleich nicht: 881 Fahrer ergeben 387.640
 * Paarungen, das lässt sich nicht vorrendern. Der Client lädt stattdessen zwei
 * Profile aus der JSON-API und rechnet selbst – mit derselben Logik, die auch
 * die Seiten benutzen.
 *
 * Die Profile liefern Summen je Saison, keine fertigen Karrierezahlen. Nur so
 * lässt sich der Zeitraum einschränken: Aus Summen kann man jeden Ausschnitt
 * bilden, aus Durchschnitten nicht.
 */

/* Vorsatz der Seite: auf GitHub Pages "/F1-stats", beim Entwickeln leer. */
const BASIS = import.meta.env.BASE_URL.replace(/\/$/, '')

const zwei = (v) => (v === null || v === undefined ? '–' : zahl(Math.round(v * 100) / 100))

/** Summiert die Saisons eines Profils im gewählten Zeitraum. */
function summe(profil, von, bis) {
  const s = profil.saisons.filter((x) => x.jahr >= von && x.jahr <= bis)
  const g = (f) => s.reduce((a, x) => a + f(x), 0)

  const starts = g((x) => x.starts)
  const gewertet = g((x) => x.gewertet)
  const gridRennen = g((x) => x.gridRennen)
  const zielRennen = g((x) => x.zielRennen)
  const poles = g((x) => x.poles)
  const siege = g((x) => x.siege)

  return {
    jahre: s.length,
    von: s.length ? s[0].jahr : null,
    bis: s.length ? s.at(-1).jahr : null,
    nennungen: g((x) => x.nennungen),
    starts,
    gewertet,
    ausfaelle: g((x) => x.ausfaelle),
    siege,
    podien: g((x) => x.podien),
    poles,
    vonPlatz1: g((x) => x.vonPlatz1),
    schnellsteRunden: g((x) => x.schnellsteRunden),
    punkte: g((x) => x.punkte),
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
    siegeProStart: starts > 0 ? siege / starts : null,
    teams: [...new Set(s.flatMap((x) => x.teams))],
  }
}

/**
 * Die Zeilen des Vergleichs.
 *
 * `besser` sagt, welche Richtung gut ist: Bei der Zielposition gewinnt der
 * kleinere Wert, bei Siegen der größere. Ohne diese Angabe würde die
 * Hervorhebung bei jeder zweiten Zeile lügen.
 */
const ZEILEN = [
  { gruppe: 'Scope' },
  { k: 'starts', label: 'Starts', f: zahl, besser: 'gross' },
  { k: 'jahre', label: 'Seasons', f: zahl, besser: 'gross' },
  { gruppe: 'Achievements' },
  { k: 'siege', label: 'Wins', f: zahl, besser: 'gross' },
  { k: 'podien', label: 'Podiums', f: zahl, besser: 'gross' },
  { k: 'poles', label: 'Pole positions', f: zahl, besser: 'gross' },
  { k: 'schnellsteRunden', label: 'Fastest laps', f: zahl, besser: 'gross' },
  { k: 'titel', label: 'World Championships', f: zahl, besser: 'gross' },
  { k: 'besterWMPlatz', label: 'Best championship finish', f: (v) => (v ? 'P' + v : '–'), besser: 'klein' },
  { gruppe: 'Rates' },
  { k: 'siegquote', label: 'Win rate', f: proz, besser: 'gross' },
  { k: 'podestquote', label: 'Podium rate', f: proz, besser: 'gross' },
  { k: 'poleZuSieg', label: 'Pole-to-win conversion', f: proz, besser: 'gross', hinweis: 'Share of pole positions that were turned into wins.' },
  { k: 'ausfallquote', label: 'Retirement rate', f: proz, besser: 'klein' },
  { gruppe: 'Averages' },
  { k: 'oStart', label: 'Avg grid position', f: ein, besser: 'klein' },
  { k: 'oZiel', label: 'Avg finish', f: ein, besser: 'klein' },
  { gruppe: 'Normalised' },
  {
    k: 'punkteProStart',
    label: 'Points per start',
    f: zwei,
    besser: 'gross',
    hinweis: 'Comparable across eras only up to a point: the points system has changed many times.',
  },
  { k: 'siegeProStart', label: 'Wins per start', f: zwei, besser: 'gross' },
]

export default function Vergleich({ index }) {
  const [ids, setIds] = useState(() => {
    if (typeof window === 'undefined') return ['', '']
    const p = new URLSearchParams(window.location.search)
    return [p.get('a') ?? '', p.get('b') ?? '']
  })
  const [profile, setProfile] = useState({})
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState('')
  const [zeitraum, setZeitraum] = useState(null)

  // Profile nachladen, sobald eine Auswahl steht.
  useEffect(() => {
    const fehlend = ids.filter((id) => id && !profile[id])
    if (fehlend.length === 0) return
    let abgebrochen = false
    setLaedt(true)
    Promise.all(
      fehlend.map((id) =>
        fetch(`${BASIS}/api/v1/drivers/${id}.json`).then((r) => {
          if (!r.ok) throw new Error(`Profile ${id} not found.`)
          return r.json()
        }),
      ),
    )
      .then((geladen) => {
        if (abgebrochen) return
        setProfile((p) => ({ ...p, ...Object.fromEntries(geladen.map((g) => [g.id, g])) }))
        setFehler('')
      })
      .catch((e) => !abgebrochen && setFehler(e.message))
      .finally(() => !abgebrochen && setLaedt(false))
    return () => {
      abgebrochen = true
    }
  }, [ids, profile])

  // Die Adresse mitführen, damit ein Vergleich teilbar ist.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams()
    if (ids[0]) p.set('a', ids[0])
    if (ids[1]) p.set('b', ids[1])
    const neu = p.toString() ? `?${p}` : window.location.pathname
    window.history.replaceState(null, '', neu)
  }, [ids])

  const beide = ids.map((id) => profile[id]).filter(Boolean)
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

  const spanne = zeitraum ?? (grenzen ? [grenzen.von, grenzen.bis] : null)

  const werte = useMemo(
    () => (vollstaendig && spanne ? beide.map((p) => summe(p, spanne[0], spanne[1])) : null),
    [vollstaendig, beide, spanne],
  )

  /** Fuhren die beiden je im selben Team? Dann gibt es eine direkte Bilanz. */
  const duell = useMemo(() => {
    if (!vollstaendig) return null
    return beide[0].teamkollegen?.find((t) => t.driverId === beide[1].id) ?? null
  }, [vollstaendig, beide])

  const waehle = (i, id) => setIds((alt) => alt.map((x, j) => (j === i ? id : x)))

  /*
   * Zwei leere Felder sind eine Sackgasse: Wer die Seite öffnet, muss erst
   * einen Namen wissen, bevor sie irgendetwas zeigt. Diese Paarungen sind
   * deshalb keine Zierde, sondern der Einstieg – und weil sie Teamkollegen
   * waren, liefert jede auch die direkte Bilanz, die den Vergleich erst
   * interessant macht.
   *
   * Gefiltert gegen das geladene Verzeichnis: Fehlt ein Fahrer in den Daten,
   * verschwindet der Vorschlag, statt auf einen leeren Vergleich zu führen.
   */
  const vorschlaege = useMemo(() => {
    const alle = [
      { ids: ['ayrton-senna', 'alain-prost'], titel: 'Senna vs Prost', warum: 'Team-mates at McLaren, 1988–1989' },
      { ids: ['lewis-hamilton', 'michael-schumacher'], titel: 'Hamilton vs Schumacher', warum: 'The two largest win tallies' },
      { ids: ['max-verstappen', 'lewis-hamilton'], titel: 'Verstappen vs Hamilton', warum: 'The 2021 title fight' },
      { ids: ['lewis-hamilton', 'nico-rosberg'], titel: 'Hamilton vs Rosberg', warum: 'Team-mates at Mercedes, 2013–2016' },
      { ids: ['niki-lauda', 'james-hunt'], titel: 'Lauda vs Hunt', warum: 'The 1976 season' },
      { ids: ['lando-norris', 'oscar-piastri'], titel: 'Norris vs Piastri', warum: 'Team-mates at McLaren today' },
      { ids: ['juan-manuel-fangio', 'jim-clark'], titel: 'Fangio vs Clark', warum: 'Two eras, both dominant' },
    ]
    if (!index?.length) return []
    const bekannt = new Set(index.map((f) => f.id))
    return alle.filter((v) => v.ids.every((id) => bekannt.has(id)))
  }, [index])

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
            onWahl={(id) => waehle(i, id)}
          />
        ))}
      </div>

      {fehler && <p className="fehler">{fehler}</p>}
      {laedt && <p className="status">Loading profiles …</p>}

      {!vollstaendig && !laedt && (
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
                    <button type="button" onClick={() => setIds(v.ids)}>
                      <b>{v.titel}</b>
                      <span>{v.warum}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {vollstaendig && werte && grenzen && (
        <>
          <div className="zeitwahl">
            <span>Period</span>
            <div className="knoepfe">
              <button
                type="button"
                className={!zeitraum ? 'on' : ''}
                onClick={() => setZeitraum(null)}
              >
                Full careers
              </button>
              {grenzen.gibtUeberschneidung && (
                <button
                  type="button"
                  className={
                    zeitraum &&
                    zeitraum[0] === grenzen.gemeinsamVon &&
                    zeitraum[1] === grenzen.gemeinsamBis
                      ? 'on'
                      : ''
                  }
                  onClick={() => setZeitraum([grenzen.gemeinsamVon, grenzen.gemeinsamBis])}
                >
                  Overlapping years {grenzen.gemeinsamVon}–{grenzen.gemeinsamBis}
                </button>
              )}
            </div>
            <div className="regler">
              <label>
                from
                <input
                  type="number"
                  min={grenzen.von}
                  max={spanne[1]}
                  value={spanne[0]}
                  onChange={(e) => setZeitraum([Number(e.target.value), spanne[1]])}
                />
              </label>
              <label>
                to
                <input
                  type="number"
                  min={spanne[0]}
                  max={grenzen.bis}
                  value={spanne[1]}
                  onChange={(e) => setZeitraum([spanne[0], Number(e.target.value)])}
                />
              </label>
            </div>
          </div>

          <div className="kopf">
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
            <tbody>
              {ZEILEN.map((z) =>
                z.gruppe ? (
                  <tr key={z.gruppe} className="gruppe">
                    <td colSpan={3}>{z.gruppe}</td>
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
                  <Zeile
                    z={{ label: 'Race head-to-head', f: zahl, besser: 'gross' }}
                    a={duell.rennSiege}
                    b={duell.rennDuelle - duell.rennSiege}
                  />
                  <Zeile
                    z={{ label: 'Qualifying head-to-head', f: zahl, besser: 'gross' }}
                    a={duell.qualiSiege}
                    b={duell.qualiDuelle - duell.qualiSiege}
                  />
                  <Zeile
                    z={{ label: 'Points in those years', f: ein, besser: 'gross' }}
                    a={duell.punkteSelbst}
                    b={duell.punkteAndere}
                  />
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

/** Eine Vergleichszeile mit Balken. Der bessere Wert trägt die Akzentfarbe. */
function Zeile({ z, a, b }) {
  const zahlen = [a, b].map((v) => (typeof v === 'number' ? v : null))
  const max = Math.max(...zahlen.map((v) => (v === null ? 0 : Math.abs(v))), 0.0001)

  let fuehrt = null
  if (zahlen[0] !== null && zahlen[1] !== null && zahlen[0] !== zahlen[1]) {
    const groesser = zahlen[0] > zahlen[1] ? 0 : 1
    fuehrt = z.besser === 'klein' ? 1 - groesser : groesser
  }

  return (
    <tr>
      <td className={`wert links${fuehrt === 0 ? ' fuehrt' : ''}`}>
        <b>{z.f(a)}</b>
        <span className="balken" style={{ width: `${((zahlen[0] ?? 0) / max) * 100}%` }} />
      </td>
      <th scope="row">
        {z.label}
        {z.hinweis && <i title={z.hinweis}>?</i>}
      </th>
      <td className={`wert rechts${fuehrt === 1 ? ' fuehrt' : ''}`}>
        <b>{z.f(b)}</b>
        <span className="balken" style={{ width: `${((zahlen[1] ?? 0) / max) * 100}%` }} />
      </td>
    </tr>
  )
}

/** Suchfeld über alle Fahrer, gleiche Rangfolge wie die Fahrersuche. */
function Auswahl({ index, wert, gesperrt, label, onWahl }) {
  const [frage, setFrage] = useState('')
  const [offen, setOffen] = useState(false)

  const gewaehlt = index.find((f) => f.id === wert)

  const treffer = useMemo(() => {
    const q = frage
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
    if (q.length < 2) return []
    const rang = (f) => {
      const n = f.name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
      const k = (f.kuerzel ?? '').toLowerCase()
      const nach = n.split(' ').at(-1)
      if (k === q) return 0
      if (nach.startsWith(q)) return 1
      if (n.startsWith(q)) return 2
      if (n.includes(q)) return 3
      return -1
    }
    return index
      .map((f) => ({ f, r: rang(f) }))
      .filter((x) => x.r >= 0 && x.f.id !== gesperrt)
      .sort((a, b) => a.r - b.r || (b.f.siege ?? 0) - (a.f.siege ?? 0))
      .slice(0, 8)
      .map((x) => x.f)
  }, [index, frage, gesperrt])

  return (
    <div className="auswahl">
      <label>{label}</label>
      {gewaehlt && !offen ? (
        <button type="button" className="gewaehlt" onClick={() => setOffen(true)}>
          <span className="kuerzel">{gewaehlt.land ?? '—'}</span>
          <b>{gewaehlt.name}</b>
          <i>{gewaehlt.von}–{gewaehlt.bis}</i>
        </button>
      ) : (
        <div className="feld">
          <input
            type="search"
            value={frage}
            autoFocus={offen}
            placeholder="Name or code"
            onChange={(e) => setFrage(e.target.value)}
          />
          {treffer.length > 0 && (
            <ul>
              {treffer.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onWahl(f.id)
                      setFrage('')
                      setOffen(false)
                    }}
                  >
                    <span className="kuerzel">{f.land ?? '—'}</span>
                    <b>{f.name}</b>
                    <i>{f.siege ? `${f.siege} wins` : `${f.starts ?? 0} starts`}</i>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
