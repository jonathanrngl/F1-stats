import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ein, plakette } from '../lib/format.js'
import { streichregel, systemFuer } from '../engine/punkte.js'
import { tabelleAusDaten } from '../engine/whatif.js'

/**
 * Ein selbst gebautes Punktesystem, angewandt auf eine Saison.
 *
 * Die eingebauten Systeme rechnet die Saisonseite beim Bauen vor. Ein eigenes
 * gibt es erst im Browser, also wird es auch dort gerechnet – mit derselben
 * Funktion wie die eingebauten (`tabelleAusDaten`), auf denselben Zeilen,
 * die als Datei je Saison nachgeladen werden. Geteilte Autos, die schnellste
 * Runde, fehlende Punkteberechtigung und Streichresultate gelten damit genauso.
 *
 * Gespeichert werden die Systeme im localStorage, nicht je Saison: Wer 1988
 * eines anlegt, findet es auf jeder anderen Saisonseite wieder.
 *
 * Gelesen wird der Speicher erst nach dem Hydrieren. Der Server kennt ihn
 * nicht und zeichnet die Insel leer; läse der Browser schon im ersten Render,
 * sähen beide verschieden aus, und React verwürfe das Gerüst.
 */

const BASIS = import.meta.env.BASE_URL.replace(/\/$/, '')
const SPEICHER = 'eigene-punktesysteme'
const VORLAGE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

function lesen() {
  try {
    const liste = JSON.parse(localStorage.getItem(SPEICHER) ?? '[]')
    return Array.isArray(liste) ? liste.filter(gueltig) : []
  } catch {
    return []
  }
}

function merken(liste) {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(liste))
  } catch {
    /* Privates Fenster oder gesperrter Speicher: Das System gilt dann nur für diesen Besuch. */
  }
}

/** Der Speicher ist fremde Eingabe – eine andere Fassung der Seite könnte ihn anders beschrieben haben. */
const gueltig = (s) =>
  s && typeof s.id === 'string' && typeof s.name === 'string' &&
  Array.isArray(s.rennen) && s.rennen.length > 0 && s.rennen.every((p) => Number.isFinite(p) && p >= 0)

const neueId = () => `eigen-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Text aus dem Zahlenfeld: leer heißt null Punkte, Negatives gibt es nicht. */
const alsPunkte = (s) => {
  const n = Number(String(s).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export default function EigenesSystem({ jahr, amtlich, mitStreichung }) {
  const [systeme, setSysteme] = useState(null)
  const [gewaehlt, setGewaehlt] = useState('')
  const [streich, setStreich] = useState(false)
  const [entwurf, setEntwurf] = useState(null)
  const [daten, setDaten] = useState(null)
  const [fehler, setFehler] = useState('')
  const angefragt = useRef(false)
  const nameId = useId()

  useEffect(() => {
    const geladen = lesen()
    setSysteme(geladen)
    setGewaehlt(geladen[0]?.id ?? '')

    // Ein anderer Tab hat gespeichert: dieselbe Liste auch hier.
    const anderswo = (e) => {
      if (e.key !== SPEICHER) return
      const neu = lesen()
      setSysteme(neu)
      setGewaehlt((g) => (neu.some((s) => s.id === g) ? g : (neu[0]?.id ?? '')))
    }
    window.addEventListener('storage', anderswo)
    return () => window.removeEventListener('storage', anderswo)
  }, [])

  const system = systeme?.find((s) => s.id === gewaehlt) ?? null

  // Die Zeilen der Saison erst, wenn es etwas zu rechnen gibt – und nur einmal.
  useEffect(() => {
    if (!system || angefragt.current) return
    angefragt.current = true
    setFehler('')
    fetch(`${BASIS}/data/ergebnisse/${jahr}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then(setDaten)
      // Ein Fehler sagt, was trotzdem geht (docs/DESIGN.md 8.14) – nicht die Meldung des Browsers.
      .catch(() => {
        angefragt.current = false
        setFehler(`Could not load the results of ${jahr}. The points systems above still work.`)
      })
  }, [system, jahr])

  const ergebnis = useMemo(() => {
    if (!system || !daten) return null
    return tabelleAusDaten(
      {
        zeilen: daten.zeilen,
        sprintPunkte: new Map(Object.entries(daten.sprintPunkte)),
        kalenderIds: daten.kalenderIds,
        faktoren: new Map(Object.entries(daten.faktoren)),
        ausgeschlossen: daten.ausgeschlossen,
        eigenesSystem: systemFuer(jahr),
      },
      { id: system.id, name: system.name, rennen: system.rennen },
      { regel: mitStreichung && streich ? streichregel(jahr) : null },
    )
  }, [system, daten, streich, mitStreichung, jahr])

  const speichern = (liste) => {
    setSysteme(liste)
    merken(liste)
  }

  const abschicken = (e) => {
    e.preventDefault()
    const fertig = {
      id: entwurf.id,
      name: entwurf.name.trim() || 'My points system',
      rennen: entwurf.punkte.map(alsPunkte),
    }
    const da = systeme.some((s) => s.id === fertig.id)
    speichern(da ? systeme.map((s) => (s.id === fertig.id ? fertig : s)) : [...systeme, fertig])
    setGewaehlt(fertig.id)
    setEntwurf(null)
  }

  const loeschen = () => {
    if (!system || !window.confirm(`Delete “${system.name}”? It disappears from every season page.`)) return
    const rest = systeme.filter((s) => s.id !== system.id)
    speichern(rest)
    setGewaehlt(rest[0]?.id ?? '')
  }

  const setzePunkt = (i, wert) =>
    setEntwurf((d) => ({ ...d, punkte: d.punkte.map((p, j) => (j === i ? wert : p)) }))

  // Vor dem Lesen des Speichers: nichts zeichnen, was gleich wieder verschwindet.
  if (systeme === null) return <div className="eigenes" />

  const meister = amtlich.find((f) => f.meister)
  const amtlichNach = new Map(amtlich.map((f) => [f.id, f]))

  return (
    <div className="eigenes">
      {systeme.length > 0 && (
        <fieldset className="whatif-wahl">
          <legend className="sr-only">Your points systems</legend>
          <div className="chips wahl-chips">
            {systeme.map((s) => (
              <label key={s.id} className="chip wahl-chip">
                <input
                  type="radio"
                  name={`eigen-${jahr}`}
                  value={s.id}
                  checked={s.id === gewaehlt}
                  onChange={() => setGewaehlt(s.id)}
                />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
          {mitStreichung && (
            <label className="schalter">
              <input type="checkbox" checked={streich} onChange={(e) => setStreich(e.target.checked)} />
              <span>Apply this season's dropped-scores rule</span>
            </label>
          )}
        </fieldset>
      )}

      {entwurf ? (
        <form className="eigenes-entwurf" onSubmit={abschicken}>
          <label className="eigenes-name" htmlFor={nameId}>
            Name
          </label>
          <input
            id={nameId}
            type="text"
            value={entwurf.name}
            maxLength={40}
            placeholder="My points system"
            onChange={(e) => setEntwurf((d) => ({ ...d, name: e.target.value }))}
          />

          <p className="eigenes-hilfe">
            Points for each finishing position. Positions below the last one score nothing.
          </p>
          <ol className="eigenes-plaetze">
            {entwurf.punkte.map((p, i) => (
              <li key={i}>
                <label>
                  <span>P{i + 1}</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={p}
                    aria-label={`Points for position ${i + 1}`}
                    onChange={(e) => setzePunkt(i, e.target.value)}
                  />
                </label>
              </li>
            ))}
          </ol>
          <div className="eigenes-zeile">
            <button
              type="button"
              className="leise-knopf"
              onClick={() => setEntwurf((d) => ({ ...d, punkte: [...d.punkte, '0'] }))}
            >
              + Add a position
            </button>
            <button
              type="button"
              className="leise-knopf"
              disabled={entwurf.punkte.length <= 1}
              onClick={() => setEntwurf((d) => ({ ...d, punkte: d.punkte.slice(0, -1) }))}
            >
              − Remove the last
            </button>
          </div>

          <div className="eigenes-zeile">
            <button type="submit" className="knopf">
              Save and apply
            </button>
            <button type="button" className="knopf leise" onClick={() => setEntwurf(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="eigenes-zeile">
          <button
            type="button"
            className="leise-knopf"
            onClick={() => setEntwurf({ id: neueId(), name: '', punkte: VORLAGE.map(String) })}
          >
            + New points system
          </button>
          {system && (
            <>
              <button
                type="button"
                className="leise-knopf"
                onClick={() => setEntwurf({ id: system.id, name: system.name, punkte: system.rennen.map(String) })}
              >
                Edit “{system.name}”
              </button>
              <button type="button" className="leise-knopf" onClick={loeschen}>
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {systeme.length === 0 && !entwurf && (
        <p className="eigenes-hilfe">
          Set the points for every finishing position yourself and see how {jahr} would have ended.
          Your systems are saved in this browser and ready on every season page.
        </p>
      )}

      {fehler && <p className="hinweis">{fehler}</p>}
      {system && !ergebnis && !fehler && <p className="eigenes-hilfe">Loading the results of {jahr} …</p>}

      {system && ergebnis && !entwurf && (
        <div className="eigenes-ergebnis">
          <p className="whatif-text">
            Scored <b>{system.rennen.map((p) => ein(p)).join('-')}</b>
            {mitStreichung && streich ? ', with the dropped-scores rule of the time.' : ', every result counted.'}
          </p>

          {ergebnis.tabelle.length === 0 ? (
            <p className="hinweis">Nobody scores a point under this system.</p>
          ) : (
            <>
              {meister && ergebnis.tabelle[0].driverId !== meister.id ? (
                <p className="hinweis akzent">
                  <span>
                    The title would have changed hands:{' '}
                    <a href={`${BASIS}/drivers/${ergebnis.tabelle[0].driverId}/`}>{ergebnis.tabelle[0].name}</a>
                    {' '}instead of {meister.name}.
                  </span>
                </p>
              ) : meister ? (
                <p className="hinweis gut">The World Champion would be the same.</p>
              ) : null}

              <div className="tabelle">
                <table>
                  <thead>
                    <tr>
                      <th className="num">Pos</th>
                      <th>Driver</th>
                      <th className="num">Points</th>
                      {mitStreichung && streich && <th className="num">Dropped</th>}
                      <th className="num">Official points</th>
                      <th className="num">Official position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ergebnis.tabelle.map((t) => {
                      const a = amtlichNach.get(t.driverId)
                      const verschoben = a?.position && a.position !== t.platz
                      return (
                        <tr key={t.driverId}>
                          <td className="num">
                            <span className={plakette(t.platz)}>{t.platz}</span>
                          </td>
                          <td>
                            <a className="zeile" href={`${BASIS}/drivers/${t.driverId}/`}>
                              {t.name}
                            </a>
                          </td>
                          <td className="num fett">{ein(t.punkte)}</td>
                          {mitStreichung && streich && (
                            <td className="num leise">{t.gestrichen ? `−${ein(t.gestrichen)}` : ''}</td>
                          )}
                          <td className="num leise">{a ? ein(a.points) : '–'}</td>
                          <td className={`num ${verschoben ? 'verschoben' : 'leise'}`}>
                            {a?.position ? `P${a.position}` : '–'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="fussnote">
            Amber: the position differs from the official result.{' '}
            {ergebnis.mitGeteiltenFahrten > 0 &&
              `Points for a shared car are split, as the era split them – ${ergebnis.mitGeteiltenFahrten} drivers are affected. `}
            {ergebnis.sprintPunkte > 0 && 'Sprint points are left unchanged. '}
            {ergebnis.ausgeschlossen.length > 0 &&
              `${ergebnis.ausgeschlossen.map((a) => a.name).join(' and ')} stays excluded from the championship, as decided at the time. `}
            Drivers who were not eligible for points at the time score nothing here either.
          </p>
        </div>
      )}
    </div>
  )
}
