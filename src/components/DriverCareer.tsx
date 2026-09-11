import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchAllDrivers,
  fetchDriverCareer,
  type Career,
  type CareerRace,
  type DriverInfo,
} from '../api/jolpica'
import { careerSeasons, careerTotals, matchDrivers, type CareerSeason } from '../lib/careerStats'
import { nationCode, nationName } from '../lib/nationality'
import { pointsLabel, raceDate } from '../lib/format'
import { statusLabel } from '../lib/status'
import DataTable, { type Column } from './DataTable'
import StatTiles, { type Tile } from './StatTiles'
import Skeleton from './Skeleton'

/*
 * Fahrersuche und Karrierebilanz.
 *
 * Die Suche braucht die vollständige Fahrerliste – rund 880 Namen, die Jolpica
 * nur in Hundertergruppen herausgibt. Das sind neun Anfragen, weshalb die Liste
 * erst beim Öffnen dieser Ansicht geladen wird und danach im Cache liegt.
 *
 * Die Karriere selbst kostet drei bis vier Anfragen und wird komplett aus den
 * Rennergebnissen gerechnet: eine fahrerbezogene Jahreswertung bietet die
 * Schnittstelle nicht an.
 */

type ListState =
  | { phase: 'loading'; done: number; total: number }
  | { phase: 'ready'; drivers: DriverInfo[] }
  | { phase: 'error'; message: string }

type CareerState =
  | { phase: 'idle' }
  | { phase: 'loading'; id: string }
  | { phase: 'ready'; career: Career }
  | { phase: 'error'; message: string }

export default function DriverCareer({
  driverId,
  onSelect,
}: {
  driverId: string
  onSelect: (id: string) => void
}) {
  const [list, setList] = useState<ListState>({ phase: 'loading', done: 0, total: 9 })
  const [career, setCareer] = useState<CareerState>({ phase: 'idle' })
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetchAllDrivers((done, total) => {
      if (!cancelled) setList((prev) => (prev.phase === 'loading' ? { phase: 'loading', done, total } : prev))
    })
      .then((drivers) => !cancelled && setList({ phase: 'ready', drivers }))
      .catch((e: Error) => !cancelled && setList({ phase: 'error', message: e.message }))
    return () => {
      cancelled = true
    }
  }, [])

  // Der Fahrer aus dem Link wird geladen, sobald er sich ändert – so zeigt ein
  // geteilter Link direkt die richtige Karriere.
  useEffect(() => {
    if (!driverId) {
      setCareer({ phase: 'idle' })
      return
    }
    let cancelled = false
    setCareer({ phase: 'loading', id: driverId })
    fetchDriverCareer(driverId, () => {})
      .then((data) => !cancelled && setCareer({ phase: 'ready', career: data }))
      .catch((e: Error) => !cancelled && setCareer({ phase: 'error', message: e.message }))
    return () => {
      cancelled = true
    }
  }, [driverId])

  // Klick nach draussen schliesst die Vorschlagsliste.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const hits = useMemo(
    () => (list.phase === 'ready' ? matchDrivers(list.drivers, query) : []),
    [list, query],
  )

  const pick = (driver: DriverInfo) => {
    setQuery('')
    setOpen(false)
    onSelect(driver.driverId)
  }

  return (
    <div className="career">
      <div className="search" ref={box}>
        <label htmlFor="driver-search">Fahrer suchen</label>
        <input
          id="driver-search"
          type="search"
          autoComplete="off"
          placeholder={
            list.phase === 'ready'
              ? `Name eingeben – ${list.drivers.length} Fahrer seit 1950`
              : 'Fahrerliste wird geladen …'
          }
          value={query}
          disabled={list.phase !== 'ready'}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hits.length > 0) pick(hits[0])
            else if (e.key === 'Escape') setOpen(false)
          }}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls="driver-hits"
        />

        {list.phase === 'loading' && (
          <span className="progress search-progress">
            <i style={{ width: `${(list.done / Math.max(1, list.total)) * 100}%` }} />
          </span>
        )}
        {list.phase === 'error' && <p className="error">{list.message}</p>}

        {open && query.trim().length >= 2 && (
          <ul className="hits" id="driver-hits" role="listbox">
            {hits.length === 0 ? (
              <li className="hits-empty">Kein Fahrer gefunden.</li>
            ) : (
              hits.map((d) => (
                <li key={d.driverId}>
                  <button type="button" role="option" aria-selected={false} onClick={() => pick(d)}>
                    <span className="hit-name">{d.name}</span>
                    <span className="hit-meta">
                      {nationCode(d.nationality) && (
                        <span className="nation-code">{nationCode(d.nationality)}</span>
                      )}
                      {nationName(d.nationality)}
                      {d.born && <> · geboren {raceDate(d.born)}</>}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {career.phase === 'idle' && (
        <p className="status">
          Such einen Fahrer, um seine Laufbahn zu sehen: Starts, Siege, Podien und jede Saison
          einzeln.
        </p>
      )}
      {career.phase === 'loading' && <Skeleton label="Karriere wird geladen" rows={10} />}
      {career.phase === 'error' && <p className="error">{career.message}</p>}
      {career.phase === 'ready' && <CareerView career={career.career} />}
    </div>
  )
}

function CareerView({ career }: { career: Career }) {
  const { driver, races } = career
  const totals = useMemo(() => careerTotals(races), [races])
  const seasons = useMemo(() => careerSeasons(races), [races])

  const tiles: Tile[] = [
    {
      label: 'Starts',
      value: String(totals.starts),
      note:
        totals.firstSeason === totals.lastSeason
          ? `Saison ${totals.firstSeason}`
          : `${totals.firstSeason} bis ${totals.lastSeason}`,
    },
    {
      label: 'Siege',
      value: String(totals.wins),
      note: totals.starts ? `${((totals.wins / totals.starts) * 100).toFixed(1).replace('.', ',')} % der Starts` : '',
    },
    { label: 'Podien', value: String(totals.podiums), note: `beste Platzierung: ${totals.bestFinish || '–'}` },
    { label: 'Punkte', value: pointsLabel(totals.points), note: `in ${totals.seasons} ${totals.seasons === 1 ? 'Saison' : 'Saisons'}` },
    {
      label: 'Starts von Platz eins',
      value: String(totals.polePositions),
      note: 'Startplatz, nicht Qualifying-Bestzeit',
    },
    { label: 'Schnellste Runden', value: String(totals.fastestLaps), note: 'in der Wertung' },
    {
      label: 'Ausfälle',
      value: String(totals.retirements),
      note: `${(totals.finishRate * 100).toFixed(0)} % der Rennen im Ziel`,
    },
  ]

  const topPoints = Math.max(1, ...seasons.map((s) => s.points))

  const seasonColumns: Column<CareerSeason>[] = [
    {
      key: 'season',
      label: 'Saison',
      defaultDir: 'desc',
      sortBy: (s) => s.season,
      render: (s) => <span className="name">{s.season}</span>,
    },
    {
      key: 'teams',
      label: 'Team',
      sortBy: (s) => s.teams,
      render: (s) => s.teams,
    },
    {
      key: 'starts',
      label: 'Starts',
      num: true,
      sortBy: (s) => s.starts,
      render: (s) => s.starts,
    },
    {
      key: 'wins',
      label: 'Siege',
      num: true,
      sortBy: (s) => s.wins,
      render: (s) => (s.wins ? <strong>{s.wins}</strong> : <span className="zero">0</span>),
    },
    {
      key: 'podiums',
      label: 'Podien',
      num: true,
      secondary: true,
      sortBy: (s) => s.podiums,
      render: (s) => (s.podiums ? s.podiums : <span className="zero">0</span>),
    },
    {
      key: 'best',
      label: 'Bestes Ergebnis',
      shortLabel: 'Best',
      num: true,
      secondary: true,
      defaultDir: 'asc',
      sortBy: (s) => s.bestFinish || 99,
      render: (s) => (s.bestFinish ? s.bestFinish : <span className="zero">–</span>),
    },
    {
      key: 'points',
      label: 'Punkte',
      shortLabel: 'Pkt.',
      num: true,
      sortBy: (s) => s.points,
      render: (s) => (
        <span className="bar-cell">
          <span className="bar-value">{pointsLabel(s.points)}</span>
          <span
            className="bar"
            style={{ '--w': `${(s.points / topPoints) * 100}%` } as React.CSSProperties}
          />
        </span>
      ),
    },
  ]

  const raceColumns: Column<CareerRace>[] = [
    {
      key: 'date',
      label: 'Datum',
      defaultDir: 'desc',
      sortBy: (r) => r.date,
      render: (r) => <span className="time">{raceDate(r.date)}</span>,
    },
    {
      key: 'race',
      label: 'Rennen',
      sortBy: (r) => r.raceName,
      render: (r) => (
        <span className="name">
          {r.raceName}
          <span className="sub">
            {r.season} · Runde {r.round}
          </span>
        </span>
      ),
    },
    {
      key: 'team',
      label: 'Team',
      secondary: true,
      sortBy: (r) => r.team,
      render: (r) => r.team,
    },
    {
      key: 'grid',
      label: 'Start',
      num: true,
      secondary: true,
      defaultDir: 'asc',
      sortBy: (r) => r.grid || 99,
      render: (r) => (r.grid ? r.grid : <abbr title="Aus der Boxengasse">Box</abbr>),
    },
    {
      key: 'pos',
      label: 'Ziel',
      num: true,
      defaultDir: 'asc',
      sortBy: (r) => (/^\d+$/.test(r.positionText) ? Number(r.position) : 999),
      render: (r) =>
        /^\d+$/.test(r.positionText) ? (
          <strong>{r.positionText}</strong>
        ) : (
          <span className="muted-cell">{statusLabel(r.status)}</span>
        ),
    },
    {
      key: 'points',
      label: 'Punkte',
      shortLabel: 'Pkt.',
      num: true,
      sortBy: (r) => r.points,
      render: (r) => (r.points ? pointsLabel(r.points) : <span className="zero">0</span>),
    },
  ]

  return (
    <>
      <div className="career-head">
        <h2>{driver.name}</h2>
        <p>
          {nationName(driver.nationality)}
          {driver.born && <> · geboren am {raceDate(driver.born)}</>}
          {driver.code && <> · {driver.code}</>}
        </p>
        <p className="career-teams">{totals.teams.join(' → ')}</p>
      </div>

      <StatTiles tiles={tiles} />

      <section className="sub-section">
        <h3>Saison für Saison</h3>
        <DataTable
          rows={seasons}
          columns={seasonColumns}
          rowKey={(s) => s.season}
          rowClass={(s) => (s.wins > 0 ? 'podium p1' : '')}
          empty="Keine Saisondaten."
          caption={`Laufbahn von ${driver.name}, Saison für Saison`}
        />
      </section>

      <section className="sub-section">
        <h3>Alle Rennen</h3>
        <p className="section-note">
          {races.length} Starts, neueste zuerst. Die Spaltenköpfe sortieren – nach „Ziel"
          stehen die besten Ergebnisse der Laufbahn oben.
        </p>
        <DataTable
          rows={[...races].reverse()}
          columns={raceColumns}
          rowKey={(r) => `${r.season}-${r.round}`}
          rowClass={(r) => (r.position === 1 ? 'podium p1' : '')}
          empty="Keine Rennen."
          caption={`Alle Rennen von ${driver.name}`}
        />
      </section>
    </>
  )
}
