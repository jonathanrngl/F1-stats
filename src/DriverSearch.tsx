import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import type { DriverInfo } from './api/jolpica'
import { nation } from './nations'

/*
 * Suche über alle 881 Fahrer seit 1950.
 *
 * Die API kennt keine Namenssuche, also liegt das Verzeichnis komplett im
 * Browser und wird hier gefiltert. Das hat den Vorteil, dass die Trefferliste
 * ohne Netzverkehr bei jedem Tastendruck steht.
 */

/**
 * Diakritika weg, damit "raikkonen" auch Räikkönen findet.
 *
 * Nimmt auch `undefined`: Die Nationalität fehlt im Verzeichnis bei 16 Fahrern,
 * und die Suche darf daran nicht scheitern.
 */
const falte = (s: string | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Rang eines Treffers – kleiner ist besser, -1 heißt kein Treffer.
 *
 * Die Reihenfolge ist der eigentliche Wert der Suche: Bei „ver“ will man
 * Verstappen sehen, nicht die dreißig Fahrer, die ein „ver“ irgendwo in der
 * Mitte tragen. Deshalb zählt zuerst das Kürzel, dann der Beginn des
 * Nachnamens, dann des Vornamens – und erst am Ende ein Vorkommen irgendwo.
 */
function rang(d: DriverInfo, q: string): number {
  const nach = falte(d.familyName)
  const vor = falte(d.givenName)
  const code = falte(d.code ?? '')
  const voll = `${vor} ${nach}`

  if (code && code === q) return 0
  if (nach === q) return 1
  if (nach.startsWith(q)) return 2
  if (vor.startsWith(q)) return 3
  if (voll.startsWith(q)) return 3
  if (nach.includes(q)) return 4
  if (vor.includes(q)) return 5
  if (falte(d.nationality).startsWith(q)) return 6
  return -1
}

const TREFFER = 8

export default function DriverSearch({
  drivers,
  onPick,
  autoFocus = false,
}: {
  drivers: DriverInfo[]
  onPick: (d: DriverInfo) => void
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [aktiv, setAktiv] = useState(0)
  const [offen, setOffen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const listId = useId()

  const treffer = useMemo(() => {
    const q = falte(query.trim())
    if (q.length < 2) return []
    return drivers
      .map((d) => ({ d, r: rang(d, q) }))
      .filter((x) => x.r >= 0)
      .sort(
        (a, b) =>
          a.r - b.r ||
          // Bei gleichem Rang der jüngere zuerst: wer sucht, meint meistens
          // den Fahrer, den er im Fernsehen gesehen hat.
          (b.d.dateOfBirth ?? '').localeCompare(a.d.dateOfBirth ?? '') ||
          a.d.familyName.localeCompare(b.d.familyName),
      )
      .slice(0, TREFFER)
      .map((x) => x.d)
  }, [drivers, query])

  // Gegen eine verkürzte Trefferliste absichern: `aktiv` darf nie hinter das
  // Ende zeigen. Zurückgesetzt wird beim Tippen, also dort, wo es entsteht.
  const zeiger = Math.min(aktiv, Math.max(0, treffer.length - 1))

  // Klick daneben schließt die Liste.
  useEffect(() => {
    if (!offen) return
    const zu = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOffen(false)
    }
    document.addEventListener('pointerdown', zu)
    return () => document.removeEventListener('pointerdown', zu)
  }, [offen])

  const waehle = (d: DriverInfo) => {
    onPick(d)
    setQuery('')
    setOffen(false)
  }

  const taste = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') setAktiv(Math.min(treffer.length - 1, zeiger + 1))
    else if (e.key === 'ArrowUp') setAktiv(Math.max(0, zeiger - 1))
    else if (e.key === 'Enter' && treffer[zeiger]) waehle(treffer[zeiger])
    else if (e.key === 'Escape') setOffen(false)
    else return
    e.preventDefault()
  }

  const zeigen = offen && treffer.length > 0

  return (
    <div className="search" ref={box}>
      <input
        type="search"
        value={query}
        placeholder="Search for a driver – name or code"
        aria-label="Search for a driver"
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={zeigen}
        aria-controls={listId}
        aria-activedescendant={zeigen ? `${listId}-${zeiger}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value)
          setAktiv(0)
          setOffen(true)
        }}
        onFocus={() => setOffen(true)}
        onKeyDown={taste}
      />

      {zeigen && (
        <ul className="search-list" id={listId} role="listbox">
          {treffer.map((d, i) => {
            const n = nation(d.nationality)
            return (
              <li
                key={d.driverId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === zeiger}
                className={i === zeiger ? 'on' : ''}
                onPointerEnter={() => setAktiv(i)}
                onPointerDown={(e) => {
                  e.preventDefault()
                  waehle(d)
                }}
              >
                <span className="code" title={n.name}>
                  {n.code}
                </span>
                <span className="such-name">
                  {d.givenName} {d.familyName}
                </span>
                {d.dateOfBirth && <span className="such-jahr">b. {d.dateOfBirth.slice(0, 4)}</span>}
              </li>
            )
          })}
        </ul>
      )}

      {query.trim().length >= 2 && treffer.length === 0 && (
        <p className="such-leer">No driver found.</p>
      )}
    </div>
  )
}
