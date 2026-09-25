import { useEffect, useMemo, useRef, useState } from 'react'
import { beschreibe, uebersetze } from '../lib/frage.js'
import {
  DIMENSIONEN, KENNZAHLEN, LEERER_FILTER, STANDARD_KENNZAHLEN,
  alsAdresse, ausAdresse, rechne, verzeichnis, zeige,
} from '../lib/abfrage.js'

/*
 * Der Data Explorer.
 *
 * Der gesamte Datenbestand liegt im Browser – jede Ergebniszeile seit 1950.
 * Jede Abfrage läuft deshalb ohne Netzzugriff, und ein verstellter Filter
 * wirkt sofort statt nach einer Anfrage.
 *
 * Gerechnet wird in lib/abfrage.js, nicht hier: Dieselbe Rechnung läuft in den
 * Tests, dort mit denselben Fragen, die ein Besucher stellt. Diese Datei ist
 * nur die Bedienung – und die Adresse: Jede Abfrage steht in der URL und lässt
 * sich so verschicken wie eine Seite.
 */

/* Vorsatz der Seite: auf GitHub Pages "/F1-stats", beim Entwickeln leer. */
const BASIS = import.meta.env.BASE_URL.replace(/\/$/, '')

const SCHRITT = 200

const STANDARD = {
  dimension: 'fahrer',
  kennzahlen: STANDARD_KENNZAHLEN,
  sortiere: 'siege',
  absteigend: true,
  filter: LEERER_FILTER,
}

const nachName = (ids, namen) =>
  ids.map((id, i) => ({ id, name: namen[i] })).sort((a, b) => a.name.localeCompare(b.name, 'en'))

export default function Explorer({ groesse = '' }) {
  const [daten, setDaten] = useState(null)
  const [fehler, setFehler] = useState('')
  const [abfrage, setAbfrage] = useState(STANDARD)
  const [frage, setFrage] = useState('')
  /** Die zuletzt übersetzte Frage – gilt, bis jemand selbst etwas verstellt. */
  const [uebersetzt, setUebersetzt] = useState(null)
  const [sichtbar, setSichtbar] = useState(SCHRITT)
  const [kopiert, setKopiert] = useState('')
  const gelesen = useRef(false)
  /** Die Frage aus der Adresse, gelesen, bevor der erste Schreibvorgang sie tilgt. */
  const frageAusAdresse = useRef('')

  /*
   * Erst nach dem Einhängen die Adresse lesen und den Würfel holen. Läse schon
   * der erste Render die Adresse, sähe er anders aus als das HTML vom Server,
   * und React verwürfe beim Hydrieren das Gerüst – der Fehler, den der
   * Vergleich schon einmal hatte.
   */
  useEffect(() => {
    const aus = ausAdresse(window.location.search)
    setAbfrage(aus.abfrage)
    setFrage(aus.frage)
    frageAusAdresse.current = aus.frage
    gelesen.current = true
    fetch(`${BASIS}/data/wuerfel.json`)
      .then((r) => {
        if (!r.ok) throw new Error('The data cube could not be loaded.')
        return r.json()
      })
      .then(setDaten)
      .catch((e) => setFehler(e.message))
  }, [])

  // Jede Änderung in die Adresse – ersetzen, nicht anhängen: Der Zurück-Knopf
  // soll die Seite verlassen, nicht durch jeden Filterklick zurücklaufen.
  useEffect(() => {
    if (!gelesen.current) return
    const suche = alsAdresse(abfrage, uebersetzt ? frage : '')
    window.history.replaceState(null, '', suche ? `?${suche}` : window.location.pathname)
  }, [abfrage, uebersetzt, frage])

  const verz = useMemo(() => (daten ? verzeichnis(daten) : null), [daten])

  /*
   * Kam die Seite mit einer Frage in der Adresse, steht ihre Übersetzung
   * wieder darüber – so sieht, wer einen Link bekommt, was gefragt war. Die
   * Abfrage selbst kommt aus der Adresse, nicht aus einer neuen Übersetzung:
   * Sie ist das, was der Absender gesehen hat.
   */
  useEffect(() => {
    if (verz && frageAusAdresse.current) setUebersetzt(uebersetze(frageAusAdresse.current, verz))
  }, [verz])
  const listen = useMemo(
    () =>
      daten && {
        strecken: nachName(daten.strecke, daten.streckenNamen),
        gps: nachName(daten.gp, daten.gpNamen),
        teams: nachName(daten.team, daten.teamNamen),
        motoren: nachName(daten.motor, daten.motorNamen),
        fahrer: nachName(daten.fahrer, daten.fahrerNamen),
        laender: nachName(daten.land, daten.landNamen),
      },
    [daten],
  )
  const namen = useMemo(
    () =>
      daten && {
        strecke: Object.fromEntries(daten.strecke.map((id, i) => [id, daten.streckenNamen[i]])),
        gp: Object.fromEntries(daten.gp.map((id, i) => [id, daten.gpNamen[i]])),
        team: Object.fromEntries(daten.team.map((id, i) => [id, daten.teamNamen[i]])),
        motor: Object.fromEntries(daten.motor.map((id, i) => [id, daten.motorNamen[i]])),
        fahrer: Object.fromEntries(daten.fahrer.map((id, i) => [id, daten.fahrerNamen[i]])),
        land: Object.fromEntries(daten.land.map((id, i) => [id, daten.landNamen[i]])),
      },
    [daten],
  )

  const ergebnis = useMemo(() => (daten ? rechne(daten, abfrage) : null), [daten, abfrage])

  /** Eine Änderung von Hand: Die übersetzte Frage gilt dann nicht mehr. */
  const aendere = (neu) => {
    setAbfrage((a) => ({ ...a, ...neu }))
    setUebersetzt(null)
    setSichtbar(SCHRITT)
  }
  const setzeFilter = (k, v) => aendere({ filter: { ...abfrage.filter, [k]: v } })

  /*
   * Eine Frage anwenden heißt: die Bedienelemente stellen, nicht eine Antwort
   * ausgeben. Was danach in der Tabelle steht, hat der Explorer über die
   * echten Daten gerechnet – die Übersetzung kann höchstens die falsche Frage
   * gestellt haben, und die steht sichtbar darüber.
   */
  const wendeFrageAn = (e) => {
    e?.preventDefault()
    if (!frage.trim() || !verz) return
    const a = uebersetze(frage, verz)
    setAbfrage({
      dimension: a.dimension,
      kennzahlen: a.kennzahlen,
      sortiere: a.sortiere,
      absteigend: a.absteigend,
      filter: { ...LEERER_FILTER, ...a.filter },
    })
    setUebersetzt(a)
    setSichtbar(SCHRITT)
  }

  const kippeKennzahl = (k) => {
    const alt = abfrage.kennzahlen
    if (alt.includes(k)) {
      if (alt.length > 1) aendere({ kennzahlen: alt.filter((x) => x !== k) })
    } else aendere({ kennzahlen: [...alt, k] })
  }

  const sortiereNach = (k) => {
    if (abfrage.sortiere === k) aendere({ absteigend: !abfrage.absteigend })
    else aendere({ sortiere: k, absteigend: !KENNZAHLEN[k].aufsteigend })
  }

  const bedingungen = abfrage.filter.bedingungen ?? []
  const setzeBedingung = (i, neu) =>
    setzeFilter('bedingungen', bedingungen.map((b, j) => (j === i ? { ...b, ...neu } : b)))

  /** Export als CSV – mit Komma, dem Trennzeichen des englischen Gebietsschemas. */
  const exportiere = (art) => {
    if (!ergebnis) return
    const dim = DIMENSIONEN[abfrage.dimension]
    let inhalt
    let typ
    let name
    if (art === 'csv') {
      const kopf = [dim.label, ...abfrage.kennzahlen.map((k) => KENNZAHLEN[k].label)]
      const zeilen = ergebnis.reihen.map((r) => [
        r.name,
        ...abfrage.kennzahlen.map((k) => (r.werte[k] === null || r.werte[k] === undefined ? '' : String(r.werte[k]))),
      ])
      inhalt = [kopf, ...zeilen].map((z) => z.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n')
      typ = 'text/csv;charset=utf-8'
      name = 'f1-explorer.csv'
    } else {
      inhalt = JSON.stringify(
        {
          abfrage: beschreibe(abfrage, labels.kennzahlen, labels.dimensionen, namen),
          adresse: window.location.href,
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

  const kopiereLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setKopiert('Link copied.')
    } catch {
      setKopiert('Copy the address from the address bar – this browser did not allow it here.')
    }
  }

  if (fehler) return <p className="fehler" role="alert">{fehler}</p>
  if (!daten || !ergebnis) {
    return <p className="status" role="status">Loading the dataset{groesse && ` (${groesse}, once only)`} …</p>
  }

  const dim = DIMENSIONEN[abfrage.dimension]
  const f = abfrage.filter
  const zeigtTitel = abfrage.kennzahlen.includes('titel')

  return (
    <div className="explorer">
      <form className="frage" onSubmit={wendeFrageAn}>
        <label htmlFor="frage-feld">Ask a question – in English or German</label>
        <div className="zeile">
          <input
            id="frage-feld"
            type="search"
            value={frage}
            placeholder="Who has the most wins at Monaco?"
            onChange={(e) => setFrage(e.target.value)}
          />
          <button type="submit">Ask</button>
        </div>
        {uebersetzt && (
          <div className="verstanden" aria-live="polite">
            <p><b>Understood as:</b></p>
            <ul>
              {uebersetzt.erkannt.map((e, i) => (
                <li key={i}>{e.was} <span>– {e.warum}</span></li>
              ))}
            </ul>
            {uebersetzt.unverstanden.map((u, i) => <p key={i} className="luecke">{u}</p>)}
            <p className="quelle">
              The question only sets the controls below. The calculation runs over all{' '}
              {daten.rennzeilen.toLocaleString('en-GB')} result rows – the figures come from the
              data, not from the translation.
            </p>
          </div>
        )}
      </form>

      <div className="steuerung">
        <fieldset>
          <legend>Group by</legend>
          <div className="wahl-chips">
            {Object.entries(DIMENSIONEN).map(([k, d]) => (
              <label key={k} className="wahl-chip">
                <input
                  type="radio"
                  name="explorer-dimension"
                  checked={abfrage.dimension === k}
                  onChange={() => aendere({ dimension: k })}
                />
                <span>{d.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Columns</legend>
          <div className="wahl-chips">
            {Object.entries(KENNZAHLEN).map(([k, z]) => (
              <label key={k} className="wahl-chip">
                <input type="checkbox" checked={abfrage.kennzahlen.includes(k)} onChange={() => kippeKennzahl(k)} />
                <span>{z.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Filters</legend>
          <div className="felder">
            <label>
              Year from
              <input type="number" inputMode="numeric" min="1950" max={daten.letztesJahr} value={f.vonJahr}
                onChange={(e) => setzeFilter('vonJahr', e.target.value)} placeholder="1950" />
            </label>
            <label>
              Year to
              <input type="number" inputMode="numeric" min="1950" max={daten.letztesJahr} value={f.bisJahr}
                onChange={(e) => setzeFilter('bisJahr', e.target.value)} placeholder={String(daten.letztesJahr)} />
            </label>
            {[
              ['fahrer', 'Driver', listen.fahrer],
              ['team', 'Team', listen.teams],
              ['motor', 'Engine', listen.motoren],
              ['land', 'Nationality', listen.laender],
              ['strecke', 'Circuit', listen.strecken],
              ['gp', 'Grand Prix', listen.gps],
            ].map(([feld, label, liste]) => (
              <label key={feld}>
                {label}
                <select value={f[feld]} onChange={(e) => setzeFilter(feld, e.target.value)}>
                  <option value="">all</option>
                  {liste.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="bedingungen">
            {bedingungen.map((b, i) => (
              <div key={i} className="bedingung" role="group" aria-label={`Condition ${i + 1}`}>
                <select aria-label="Metric" value={b.kennzahl} onChange={(e) => setzeBedingung(i, { kennzahl: e.target.value })}>
                  {Object.entries(KENNZAHLEN).map(([k, z]) => <option key={k} value={k}>{z.label}</option>)}
                </select>
                <select aria-label="Comparison" value={b.op} onChange={(e) => setzeBedingung(i, { op: e.target.value })}>
                  <option value=">=">at least</option>
                  <option value="<=">at most</option>
                </select>
                <input aria-label="Value" type="number" inputMode="decimal" step="any" value={b.wert}
                  onChange={(e) => setzeBedingung(i, { wert: Number(e.target.value) })} />
                <button type="button" className="leise-knopf"
                  onClick={() => setzeFilter('bedingungen', bedingungen.filter((_, j) => j !== i))}>
                  Remove<span className="sr-only"> condition {i + 1}</span>
                </button>
              </div>
            ))}
            <button type="button" className="leise-knopf"
              onClick={() => setzeFilter('bedingungen', [...bedingungen, { kennzahl: 'siege', op: '>=', wert: 1 }])}>
              + Add a condition
            </button>
          </div>

          <div className="schalter">
            <label>
              <input type="checkbox" checked={f.nurSieger} onChange={(e) => setzeFilter('nurSieger', e.target.checked)} />
              wins only
            </label>
            <label>
              <input type="checkbox" checked={f.nurVonHinten} onChange={(e) => setzeFilter('nurVonHinten', e.target.checked)} />
              wins from outside the top ten on the grid only
            </label>
            <label>
              <input type="checkbox" checked={f.ohneIndy} onChange={(e) => setzeFilter('ohneIndy', e.target.checked)} />
              without the Indianapolis 500 (1950–1960)
            </label>
          </div>
        </fieldset>
      </div>

      <div className="kopfzeile">
        <p aria-live="polite">
          <b>{ergebnis.reihen.length.toLocaleString('en-GB')}</b>{' '}
          {ergebnis.reihen.length === 1 ? dim.einzahl : dim.mehrzahl}, counted over{' '}
          <b>{ergebnis.betrachtet.toLocaleString('en-GB')}</b>{' '}
          of {ergebnis.gesamt.toLocaleString('en-GB')} result rows
        </p>
        <div className="export">
          <button type="button" onClick={kopiereLink}>Copy link</button>
          <button type="button" onClick={() => exportiere('csv')}>CSV</button>
          <button type="button" onClick={() => exportiere('json')}>JSON</button>
          <button type="button" onClick={() => { setAbfrage(STANDARD); setUebersetzt(null); setFrage('') }}>Reset</button>
        </div>
      </div>
      <p className="beschreibung">
        {beschreibe(abfrage, labels.kennzahlen, labels.dimensionen, namen)}
        {kopiert && <span role="status"> {kopiert}</span>}
      </p>
      {zeigtTitel && ergebnis.titelOhneSinn && (
        <p className="hinweis">
          Titles belong to a season, not to a circuit, a team or an engine – with those filters set,
          the title column stays empty.
        </p>
      )}

      {/* Ab 25 Zeilen mit fester Höhe und klebendem Kopf, wie auf den Teamseiten –
          sonst ist die Sortierung nach dem ersten Bildschirm aus dem Blick. */}
      <div className={`tabelle${Math.min(sichtbar, ergebnis.reihen.length) > 25 ? ' lang' : ''}`}>
        <table>
          <thead>
            <tr>
              <th scope="col">{dim.label}</th>
              {abfrage.kennzahlen.map((k) => {
                const aktiv = abfrage.sortiere === k
                return (
                  <th key={k} scope="col" className="num"
                    aria-sort={aktiv ? (abfrage.absteigend ? 'descending' : 'ascending') : 'none'}>
                    <button type="button" data-aktiv={aktiv ? '1' : undefined}
                      data-richtung={abfrage.absteigend ? 'ab' : 'auf'} onClick={() => sortiereNach(k)}>
                      {KENNZAHLEN[k].label}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ergebnis.reihen.slice(0, sichtbar).map((r) => (
              <tr key={r.id}>
                <td>{r.link ? <a href={`${BASIS}${r.link}`}>{r.name}</a> : r.name}</td>
                {abfrage.kennzahlen.map((k) => (
                  <td key={k} className="num">{zeige(k, r.werte[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ergebnis.reihen.length > sichtbar && (
        <p className="mehr-zeilen">
          Showing {sichtbar.toLocaleString('en-GB')} of {ergebnis.reihen.length.toLocaleString('en-GB')} rows.{' '}
          <button type="button" className="leise-knopf" onClick={() => setSichtbar((n) => n + SCHRITT)}>
            Show {Math.min(SCHRITT, ergebnis.reihen.length - sichtbar)} more
          </button>{' '}
          The export always contains all of them.
        </p>
      )}
      {ergebnis.reihen.length === 0 && (
        <p className="hinweis">No row meets these conditions. Loosen a filter or a condition.</p>
      )}
    </div>
  )
}

const labels = {
  kennzahlen: Object.fromEntries(Object.entries(KENNZAHLEN).map(([k, v]) => [k, v.label])),
  dimensionen: Object.fromEntries(Object.entries(DIMENSIONEN).map(([k, v]) => [k, v.label])),
}
