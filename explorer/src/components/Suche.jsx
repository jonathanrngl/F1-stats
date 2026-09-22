import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Suche in der Kopfleiste über Fahrer, Teams und Strecken.
 *
 * Die Seite hat 917 Fahrer, 187 Teams und 78 Strecken, und bis hierher führte
 * der einzige Weg dorthin über eine Indexseite mit 860 Zeilen. Wer Jim Clark
 * suchte, musste scrollen.
 *
 * Der Index wird erst beim ersten Tastendruck geladen, nicht beim Seitenaufruf:
 * Die meisten Besucher tippen nie etwas ein, und 2.384 Seiten sollen nicht
 * jeweils 60 KB mitschleppen, die niemand braucht.
 */

const BASIS = import.meta.env.BASE_URL.replace(/\/$/, '')

const ART = {
  f: { label: 'Driver', pfad: 'drivers' },
  t: { label: 'Team', pfad: 'teams' },
  s: { label: 'Circuit', pfad: 'circuits' },
}

const falte = (s) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Rang eines Eintrags für eine Eingabe – kleiner ist besser, -1 heißt daneben.
 *
 * Die Reihenfolge ist nicht beliebig: Ein Kürzel ist eine eindeutige Eingabe
 * („VER"), ein Nachname der übliche Sucheinstieg („hamilton"), und erst danach
 * kommt, was den Text irgendwo enthält. Ohne diese Stufen stünde bei „ham"
 * Graham Hill vor Lewis Hamilton, weil sein Name die Zeichen ebenfalls enthält.
 */
function rang(e, q) {
  const n = falte(e.n)
  const k = (e.k ?? '').toLowerCase()

  /*
   * Ein Kürzel schlägt alles – aber nur, wenn es je eines war. Die FIA machte
   * die drei Buchstaben erst 2014 verbindlich; für frühere Fahrer hat F1DB sie
   * abgeleitet, und niemand hat Mike Sparken je „SPA" genannt. Ohne diese
   * Schranke stand er bei „spa" vor Spa-Francorchamps, wo er 1955 ein einziges
   * Rennen bestritt.
   */
  if (k && k === q && e.b >= 2014) return 0

  /*
   * Was einen Eintrag identifiziert, hängt an seiner Art: Bei einem Fahrer
   * ist es der Nachname – niemand sucht Hamilton unter „Lewis" –, bei einem
   * Team oder einer Strecke der ganze Name. Ohne diese Unterscheidung stand
   * bei „spa" der Fahrer Mike Sparken vor Spa-Francorchamps, weil sein
   * Nachname vorn traf und der Streckenname nur als Ganzes.
   */
  const woerter = n.split(' ')
  const identifizierend = e.a === 'f' ? woerter.at(-1) : n
  if (identifizierend.startsWith(q)) return 1
  if (n.startsWith(q)) return 2
  if (woerter.some((w) => w.startsWith(q))) return 3
  if (n.includes(q)) return 4
  return -1
}

export default function Suche() {
  const [index, setIndex] = useState(null)
  const [laedt, setLaedt] = useState(false)
  const [frage, setFrage] = useState('')
  const [aktiv, setAktiv] = useState(0)
  const [offen, setOffen] = useState(false)
  const feld = useRef(null)
  const huelle = useRef(null)

  /* Index beim ersten Tippen holen, danach nie wieder. */
  useEffect(() => {
    if (index || laedt || frage.length === 0) return
    setLaedt(true)
    fetch(`${BASIS}/data/suche.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('index'))))
      .then(setIndex)
      .catch(() => setIndex([]))
      .finally(() => setLaedt(false))
  }, [frage, index, laedt])

  /* „/" öffnet die Suche, wie in jedem Werkzeug, das eine hat. */
  useEffect(() => {
    const auf = (e) => {
      const imFeld = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      if (e.key === '/' && !imFeld && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        feld.current?.focus()
      }
      if (e.key === 'Escape') setOffen(false)
    }
    window.addEventListener('keydown', auf)
    return () => window.removeEventListener('keydown', auf)
  }, [])

  /* Klick daneben schließt die Liste. */
  useEffect(() => {
    const zu = (e) => {
      if (huelle.current && !huelle.current.contains(e.target)) setOffen(false)
    }
    document.addEventListener('pointerdown', zu)
    return () => document.removeEventListener('pointerdown', zu)
  }, [])

  const treffer = useMemo(() => {
    const q = falte(frage).trim()
    if (q.length < 2 || !index) return []
    return index
      .map((e) => ({ e, r: rang(e, q) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || b.e.g - a.e.g)
      .slice(0, 8)
      .map((x) => x.e)
  }, [index, frage])

  useEffect(() => setAktiv(0), [frage])

  const gehe = (e) => {
    window.location.href = `${BASIS}/${ART[e.a].pfad}/${e.i}/`
  }

  const taste = (ev) => {
    if (treffer.length === 0) return
    if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      setAktiv((i) => (i + 1) % treffer.length)
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      setAktiv((i) => (i - 1 + treffer.length) % treffer.length)
    } else if (ev.key === 'Enter') {
      ev.preventDefault()
      gehe(treffer[aktiv])
    }
  }

  const zeigen = offen && frage.trim().length >= 2

  return (
    <div className="suche" ref={huelle}>
      <input
        ref={feld}
        type="search"
        value={frage}
        placeholder="Search"
        aria-label="Search drivers, teams and circuits"
        autoComplete="off"
        onChange={(e) => {
          setFrage(e.target.value)
          setOffen(true)
        }}
        onFocus={() => setOffen(true)}
        onKeyDown={taste}
      />
      {zeigen && (
        <ul className="ergebnisse">
          {treffer.length === 0 && (
            <li className="leer">{laedt || !index ? 'Loading…' : 'Nothing found.'}</li>
          )}
          {treffer.map((e, i) => (
            <li key={`${e.a}-${e.i}`}>
              <a
                href={`${BASIS}/${ART[e.a].pfad}/${e.i}/`}
                className={i === aktiv ? 'an' : undefined}
                onMouseEnter={() => setAktiv(i)}
              >
                <span className="kuerzel">{e.l ?? '—'}</span>
                <b>{e.n}</b>
                <i>
                  {ART[e.a].label} · {e.v === e.b ? e.v : `${e.v}–${e.b}`}
                </i>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
