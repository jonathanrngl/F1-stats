import { useEffect, useMemo, useState } from 'react'
import { beschreibe, uebersetze } from '../lib/frage.js'

/*
 * Der Data Explorer.
 *
 * Der gesamte Datenbestand liegt im Browser – 27.599 Ergebniszeilen, 130 KB
 * gepackt. Jede Abfrage läuft deshalb ohne Netzzugriff, und ein verstellter
 * Filter wirkt sofort statt nach einer Anfrage.
 *
 * Gruppieren und Kennzahlen sind getrennt gedacht: Man wählt, *worüber*
 * gezählt wird (Fahrer, Team, Saison, Strecke) und *was* gezählt wird. Daraus
 * ergeben sich die Fragen der Spezifikation von selbst – „meiste Siege in
 * Monaco" ist Gruppierung nach Fahrer, Filter auf Strecke, Sortierung nach
 * Siegen.
 */

/** Worüber gruppiert wird. `schluessel` liefert je Zeile den Gruppenwert. */
const DIMENSIONEN = {
  fahrer: { label: 'Fahrer', spalte: 'fahrer', namen: 'fahrerNamen', ids: 'fahrer', link: (id) => `/fahrer/${id}/` },
  team: { label: 'Team', spalte: 'team', namen: 'teamNamen', ids: 'team', link: (id) => `/teams/${id}/` },
  saison: { label: 'Saison', spalte: 'jahr', link: (id) => `/saisons/${id}/` },
  strecke: { label: 'Strecke', spalte: 'strecke', namen: 'streckenNamen', ids: 'strecke', link: (id) => `/strecken/${id}/` },
  gp: { label: 'Grand Prix', spalte: 'gp', namen: 'gpNamen', ids: 'gp' },
}

/**
 * Die Kennzahlen.
 *
 * `zaehle` addiert je Zeile, `fertig` rechnet am Ende – so entstehen auch
 * Durchschnitte, ohne alle Zeilen aufzuheben. Jede Kennzahl sagt über
 * `nenner`, worauf sie sich bezieht, damit eine Quote nicht durch null teilt.
 */
const KENNZAHLEN = {
  starts: { label: 'Starts', zaehle: (r) => (r.gestartet ? 1 : 0) },
  siege: { label: 'Siege', zaehle: (r) => (r.platz === 1 ? 1 : 0) },
  podien: { label: 'Podien', zaehle: (r) => (r.gewertet && r.platz >= 1 && r.platz <= 3 ? 1 : 0) },
  poles: { label: 'Poles', zaehle: (r) => (r.quali === 1 ? 1 : 0) },
  schnellste: { label: 'Schnellste Runden', zaehle: (r) => r.schnellste },
  punkte: { label: 'Punkte', zaehle: (r) => r.punkte / 10, format: (v) => v.toFixed(1).replace('.', ',') },
  ausfaelle: { label: 'Ausfälle', zaehle: (r) => (r.gestartet && !r.gewertet ? 1 : 0) },
  oZiel: {
    label: 'Ø Zielposition',
    zaehle: (r) => (r.gewertet && r.platz > 0 ? r.platz : 0),
    nenner: (r) => (r.gewertet && r.platz > 0 ? 1 : 0),
    format: (v) => v.toFixed(1).replace('.', ','),
  },
  oStart: {
    label: 'Ø Startplatz',
    zaehle: (r) => (r.gestartet && r.start > 0 ? r.start : 0),
    nenner: (r) => (r.gestartet && r.start > 0 ? 1 : 0),
    format: (v) => v.toFixed(1).replace('.', ','),
  },
  gutgemacht: {
    label: 'Plätze gutgemacht',
    zaehle: (r) => (r.gewertet && r.platz > 0 && r.start > 0 ? r.start - r.platz : 0),
    format: (v) => (v > 0 ? '+' : '') + Math.round(v),
  },
}

/* Vorsatz der Seite: auf GitHub Pages "/F1-stats", beim Entwickeln leer. */
const BASIS = import.meta.env.BASE_URL.replace(/\/$/, '')

const STANDARD = ['starts', 'siege', 'podien', 'poles', 'punkte']

export default function Explorer() {
  const [daten, setDaten] = useState(null)
  const [fehler, setFehler] = useState('')
  const [dimension, setDimension] = useState('fahrer')
  const [kennzahlen, setKennzahlen] = useState(STANDARD)
  const [sortiere, setSortiere] = useState('siege')
  const [absteigend, setAbsteigend] = useState(true)
  const [frage, setFrage] = useState('')
  const [uebersetzt, setUebersetzt] = useState(null)
  const [filter, setFilter] = useState({
    vonJahr: '', bisJahr: '', strecke: '', team: '', fahrer: '',
    minStarts: '', minSiege: '', minPodien: '',
    nurSieger: false, nurVonHinten: false,
  })

  useEffect(() => {
    fetch(`${BASIS}/data/wuerfel.json`)
      .then((r) => {
        if (!r.ok) throw new Error('Der Datenwürfel konnte nicht geladen werden.')
        return r.json()
      })
      .then(setDaten)
      .catch((e) => setFehler(e.message))
  }, [])

  const ergebnis = useMemo(() => {
    if (!daten) return null
    const s = daten.spalten
    const n = daten.zeilen
    const dim = DIMENSIONEN[dimension]

    // Filter einmal in Indizes übersetzen, statt je Zeile Zeichenketten zu vergleichen.
    const streckeIdx = filter.strecke ? daten.strecke.indexOf(filter.strecke) : -2
    const teamIdx = filter.team ? daten.team.indexOf(filter.team) : -2
    const fahrerIdx = filter.fahrer ? daten.fahrer.indexOf(filter.fahrer) : -2
    const vonJahr = filter.vonJahr ? Number(filter.vonJahr) : -Infinity
    const bisJahr = filter.bisJahr ? Number(filter.bisJahr) : Infinity

/*
     * Ein Mindestfilter braucht seine Kennzahl, auch wenn sie nicht als
     * Spalte gewählt ist. Sonst hinge das Ergebnis davon ab, welche Spalten
     * gerade sichtbar sind – ein Filter, der still nichts tut, ist schlimmer
     * als keiner.
     */
    const noetig = new Set(kennzahlen)
    if (filter.minStarts) noetig.add('starts')
    if (filter.minSiege) noetig.add('siege')
    if (filter.minPodien) noetig.add('podien')
    const gerechnet = [...noetig]

    const gruppen = new Map()
    let betrachtet = 0

    for (let i = 0; i < n; i++) {
      if (s.jahr[i] < vonJahr || s.jahr[i] > bisJahr) continue
      if (streckeIdx !== -2 && s.strecke[i] !== streckeIdx) continue
      if (teamIdx !== -2 && s.team[i] !== teamIdx) continue
      if (fahrerIdx !== -2 && s.fahrer[i] !== fahrerIdx) continue
      if (filter.nurSieger && s.platz[i] !== 1) continue
      // „Von weit hinten": Sieg aus einem Startplatz jenseits der ersten zehn.
      if (filter.nurVonHinten && !(s.platz[i] === 1 && s.start[i] > 10)) continue

      betrachtet++
      const schluessel = s[dim.spalte][i]
      let g = gruppen.get(schluessel)
      if (!g) {
        g = { schluessel, werte: {}, nenner: {} }
        for (const k of gerechnet) {
          g.werte[k] = 0
          g.nenner[k] = 0
        }
        gruppen.set(schluessel, g)
      }

      const zeile = {
        platz: s.platz[i], gestartet: s.gestartet[i], gewertet: s.gewertet[i],
        start: s.start[i], quali: s.quali[i], punkte: s.punkte[i],
        pole: s.pole[i], schnellste: s.schnellste[i],
      }
      for (const k of gerechnet) {
        const kz = KENNZAHLEN[k]
        g.werte[k] += kz.zaehle(zeile)
        if (kz.nenner) g.nenner[k] += kz.nenner(zeile)
      }
    }


    let reihen = [...gruppen.values()].map((g) => {
      const werte = {}
      for (const k of gerechnet) {
        const kz = KENNZAHLEN[k]
        werte[k] = kz.nenner ? (g.nenner[k] > 0 ? g.werte[k] / g.nenner[k] : null) : g.werte[k]
      }
      const id = dim.ids ? daten[dim.ids][g.schluessel] : g.schluessel
      const name = dim.namen ? daten[dim.namen][g.schluessel] : String(g.schluessel)
      return { id, name, werte, roh: g.werte }
    })

    for (const [feld, k] of [['minStarts', 'starts'], ['minSiege', 'siege'], ['minPodien', 'podien']]) {
      if (!filter[feld]) continue
      const grenze = Number(filter[feld])
      reihen = reihen.filter((r) => (r.werte[k] ?? 0) >= grenze)
    }

    reihen.sort((a, b) => {
      const x = a.werte[sortiere] ?? -Infinity
      const y = b.werte[sortiere] ?? -Infinity
      return absteigend ? y - x : x - y
    })

    return { reihen, betrachtet, gesamt: n }
  }, [daten, dimension, kennzahlen, filter, sortiere, absteigend])

  const setzeFilter = (k, v) => setFilter((f) => ({ ...f, [k]: v }))

  /*
   * Eine Frage anwenden heißt: die Bedienelemente stellen, nicht eine Antwort
   * ausgeben. Was danach in der Tabelle steht, hat der Explorer über die
   * echten Daten gerechnet – die Übersetzung kann höchstens die falsche Frage
   * gestellt haben, und die steht sichtbar darüber.
   */
  const wendeFrageAn = (e) => {
    e?.preventDefault()
    if (!frage.trim() || !daten) return
    const a = uebersetze(frage, {
      strecken: daten.strecke.map((id, i) => ({ id, name: daten.streckenNamen[i] })),
      teams: daten.team.map((id, i) => ({ id, name: daten.teamNamen[i] })),
      fahrer: daten.fahrer.map((id, i) => ({ id, name: daten.fahrerNamen[i] })),
    })
    setDimension(a.dimension)
    setKennzahlen(a.kennzahlen)
    setSortiere(a.sortiere)
    setAbsteigend(a.sortiere !== 'oZiel' && a.sortiere !== 'oStart')
    setFilter({
      vonJahr: '', bisJahr: '', strecke: '', team: '', fahrer: '',
      minStarts: '', minSiege: '', minPodien: '',
      nurSieger: false, nurVonHinten: false,
      ...a.filter,
    })
    setUebersetzt(a)
  }

  const kippeKennzahl = (k) =>
    setKennzahlen((alt) => {
      if (alt.includes(k)) return alt.length > 1 ? alt.filter((x) => x !== k) : alt
      return [...alt, k]
    })

  /** Export als CSV – mit Semikolon, damit Excel im deutschen Gebiet mitspielt. */
  const exportiere = (art) => {
    if (!ergebnis) return
    const dim = DIMENSIONEN[dimension]
    let inhalt
    let typ
    let name
    if (art === 'csv') {
      const kopf = [dim.label, ...kennzahlen.map((k) => KENNZAHLEN[k].label)]
      const zeilen = ergebnis.reihen.map((r) => [
        r.name,
        ...kennzahlen.map((k) => (r.werte[k] === null ? '' : String(r.werte[k]).replace('.', ','))),
      ])
      inhalt = [kopf, ...zeilen].map((z) => z.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(';')).join('\n')
      typ = 'text/csv;charset=utf-8'
      name = 'f1-explorer.csv'
    } else {
      inhalt = JSON.stringify(
        {
          gruppierung: dim.label,
          kennzahlen: kennzahlen.map((k) => KENNZAHLEN[k].label),
          filter,
          zeilen: ergebnis.reihen.map((r) => ({ id: r.id, name: r.name, ...r.werte })),
        },
        null,
        2,
      )
      typ = 'application/json;charset=utf-8'
      name = 'f1-explorer.json'
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([inhalt], { type: typ }))
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (fehler) return <p className="fehler">{fehler}</p>
  if (!daten) return <p className="status">Lade den Datenbestand … (130 KB, einmalig)</p>

  const dim = DIMENSIONEN[dimension]

  return (
    <div className="explorer">
      <form className="frage" onSubmit={wendeFrageAn}>
        <label htmlFor="frage-feld">Frage stellen</label>
        <div className="zeile">
          <input
            id="frage-feld"
            type="search"
            value={frage}
            placeholder="Wer hat die meisten Siege in Monaco?"
            onChange={(e) => setFrage(e.target.value)}
          />
          <button type="submit">Übersetzen</button>
        </div>
        {uebersetzt && (
          <div className="verstanden">
            <p>
              <b>Verstanden als:</b>{' '}
              {beschreibe(
                uebersetzt,
                Object.fromEntries(Object.entries(KENNZAHLEN).map(([k, v]) => [k, v.label])),
                Object.fromEntries(Object.entries(DIMENSIONEN).map(([k, v]) => [k, v.label])),
                {
                  strecke: Object.fromEntries(daten.strecke.map((id, i) => [id, daten.streckenNamen[i]])),
                  team: Object.fromEntries(daten.team.map((id, i) => [id, daten.teamNamen[i]])),
                  fahrer: Object.fromEntries(daten.fahrer.map((id, i) => [id, daten.fahrerNamen[i]])),
                },
              )}
            </p>
            {uebersetzt.unverstanden.map((u) => <p className="luecke">{u}</p>)}
            <p className="quelle">
              Die Frage stellt nur die Filter ein. Gerechnet wird über alle{' '}
              {daten.zeilen.toLocaleString('de-DE')} Ergebniszeilen – die Zahlen unten stammen
              aus den Daten, nicht aus der Übersetzung.
            </p>
          </div>
        )}
      </form>

      <div className="steuerung">
        <fieldset>
          <legend>Gruppieren nach</legend>
          <div className="chips">
            {Object.entries(DIMENSIONEN).map(([k, d]) => (
              <button
                key={k}
                type="button"
                className={dimension === k ? 'on' : ''}
                onClick={() => setDimension(k)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Kennzahlen</legend>
          <div className="chips">
            {Object.entries(KENNZAHLEN).map(([k, z]) => (
              <button
                key={k}
                type="button"
                className={kennzahlen.includes(k) ? 'on' : ''}
                onClick={() => kippeKennzahl(k)}
              >
                {z.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Filter</legend>
          <div className="felder">
            <label>
              Jahr von
              <input type="number" min="1950" max="2030" value={filter.vonJahr}
                onChange={(e) => setzeFilter('vonJahr', e.target.value)} placeholder="1950" />
            </label>
            <label>
              bis
              <input type="number" min="1950" max="2030" value={filter.bisJahr}
                onChange={(e) => setzeFilter('bisJahr', e.target.value)} placeholder="2026" />
            </label>
            <label>
              Strecke
              <select value={filter.strecke} onChange={(e) => setzeFilter('strecke', e.target.value)}>
                <option value="">alle</option>
                {daten.strecke.map((id, i) => (
                  <option key={id} value={id}>{daten.streckenNamen[i]}</option>
                ))}
              </select>
            </label>
            <label>
              Team
              <select value={filter.team} onChange={(e) => setzeFilter('team', e.target.value)}>
                <option value="">alle</option>
                {daten.team.map((id, i) => (
                  <option key={id} value={id}>{daten.teamNamen[i]}</option>
                ))}
              </select>
            </label>
            <label>
              min. Starts
              <input type="number" min="0" value={filter.minStarts}
                onChange={(e) => setzeFilter('minStarts', e.target.value)} />
            </label>
            <label>
              min. Siege
              <input type="number" min="0" value={filter.minSiege}
                onChange={(e) => setzeFilter('minSiege', e.target.value)} />
            </label>
            <label>
              min. Podien
              <input type="number" min="0" value={filter.minPodien}
                onChange={(e) => setzeFilter('minPodien', e.target.value)} />
            </label>
          </div>
          <div className="schalter">
            <label>
              <input type="checkbox" checked={filter.nurSieger}
                onChange={(e) => setzeFilter('nurSieger', e.target.checked)} />
              nur Siege
            </label>
            <label>
              <input type="checkbox" checked={filter.nurVonHinten}
                onChange={(e) => setzeFilter('nurVonHinten', e.target.checked)} />
              nur Siege von jenseits Startplatz 10
            </label>
          </div>
        </fieldset>
      </div>

      <div className="kopfzeile">
        <p>
          <b>{ergebnis.reihen.length.toLocaleString('de-DE')}</b> {dim.label.toLowerCase()}
          {ergebnis.reihen.length === 1 ? '' : dimension === 'saison' ? '' : ''} aus{' '}
          <b>{ergebnis.betrachtet.toLocaleString('de-DE')}</b> von{' '}
          {ergebnis.gesamt.toLocaleString('de-DE')} Ergebniszeilen
        </p>
        <div className="export">
          <button type="button" onClick={() => exportiere('csv')}>CSV</button>
          <button type="button" onClick={() => exportiere('json')}>JSON</button>
        </div>
      </div>

      <div className="tabelle">
        <table>
          <thead>
            <tr>
              <th>{dim.label}</th>
              {kennzahlen.map((k) => (
                <th key={k} className="num">
                  <button
                    type="button"
                    className={sortiere === k ? 'sortiert' : ''}
                    onClick={() => {
                      if (sortiere === k) setAbsteigend((a) => !a)
                      else {
                        setSortiere(k)
                        setAbsteigend(true)
                      }
                    }}
                  >
                    {KENNZAHLEN[k].label}
                    {sortiere === k && <i>{absteigend ? '▾' : '▴'}</i>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ergebnis.reihen.slice(0, 200).map((r) => (
              <tr key={r.id}>
                <td>
                  {dim.link ? <a href={dim.link(r.id)}>{r.name}</a> : r.name}
                </td>
                {kennzahlen.map((k) => {
                  const v = r.werte[k]
                  const f = KENNZAHLEN[k].format
                  return (
                    <td key={k} className="num">
                      {v === null ? '–' : f ? f(v) : v.toLocaleString('de-DE')}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ergebnis.reihen.length > 200 && (
        <p className="hinweis">
          Angezeigt sind die ersten 200 von {ergebnis.reihen.length.toLocaleString('de-DE')}{' '}
          Zeilen. Der Export enthält alle.
        </p>
      )}
      {ergebnis.reihen.length === 0 && (
        <p className="hinweis">Keine Zeile erfüllt diese Bedingungen.</p>
      )}
    </div>
  )
}
