import { useEffect, useMemo, useState } from 'react'
import {
  fetchSeasons,
  fetchRaces,
  fetchLatestRound,
  fetchDriverStandings,
  fetchConstructorStandings,
  fetchProgression,
  type Race,
  type DriverStanding,
  type ConstructorStanding,
  type DriverProgression,
} from './api/jolpica'
import ProgressionChart from './ProgressionChart'
import './App.css'

type Tab = 'drivers' | 'constructors' | 'progression'

const TABS: { id: Tab; label: string }[] = [
  { id: 'drivers', label: 'Fahrerwertung' },
  { id: 'constructors', label: 'Konstrukteurswertung' },
  { id: 'progression', label: 'WM-Verlauf' },
]

export default function App() {
  const [seasons, setSeasons] = useState<string[]>([])
  const [season, setSeason] = useState('')
  const [races, setRaces] = useState<Race[]>([])
  const [round, setRound] = useState('')
  const [latestRound, setLatestRound] = useState(0)
  const [drivers, setDrivers] = useState<DriverStanding[]>([])
  const [constructors, setConstructors] = useState<ConstructorStanding[]>([])
  const [tab, setTab] = useState<Tab>('drivers')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [progression, setProgression] = useState<DriverProgression[]>([])
  const [progressionSeason, setProgressionSeason] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  useEffect(() => {
    fetchSeasons()
      .then((list) => {
        const years = list.map((s) => s.season).reverse()
        setSeasons(years)
        setSeason(years[0] ?? '')
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!season) return
    let cancelled = false
    setRaces([])
    setRound('')
    setLatestRound(0)
    setProgression([])
    setProgressionSeason('')
    setError('')
    Promise.all([fetchRaces(season), fetchLatestRound(season)])
      .then(([list, latest]) => {
        if (cancelled) return
        setRaces(list)
        setLatestRound(Number(latest) || 0)
        // In einer laufenden Saison stehen die letzten Runden noch aus – dann
        // ist die zuletzt gewertete Runde die sinnvolle Vorauswahl.
        setRound(latest || list.at(-1)?.round || '')
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [season])

  useEffect(() => {
    if (!season || !round) return
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      fetchDriverStandings(season, round),
      fetchConstructorStandings(season, round),
    ])
      .then(([d, c]) => {
        if (cancelled) return
        setDrivers(d)
        setConstructors(c)
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [season, round])

  // Der Verlauf kostet eine Anfrage je Rennen, deshalb erst beim Öffnen des
  // Tabs und genau einmal pro Saison.
  useEffect(() => {
    if (tab !== 'progression' || !season || latestRound === 0) return
    if (progressionSeason === season) return
    let cancelled = false
    setProgress({ done: 0, total: latestRound })
    setError('')
    fetchProgression(season, latestRound, (done, total) => {
      if (!cancelled) setProgress({ done, total })
    })
      .then((rows) => {
        if (cancelled) return
        setProgression(rows)
        setProgressionSeason(season)
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [tab, season, latestRound, progressionSeason])

  const selectedRace = races.find((r) => r.round === round)
  const isUpcoming = (r: Race) => latestRound > 0 && Number(r.round) > latestRound

  // Die Rennen-Auswahl begrenzt auch den Graphen. Die Reihenfolge bleibt dabei
  // die des Saisonendes: so behält jeder Fahrer seine Farbe, egal wie weit
  // zurück der Leser schaut.
  const shownRounds = Math.min(Number(round) || latestRound, latestRound)
  const chartDrivers = useMemo(
    () =>
      progression.map((d) => {
        const points = d.points.slice(0, shownRounds)
        return { ...d, points, total: points.at(-1) ?? 0 }
      }),
    [progression, shownRounds],
  )
  const chartRounds = useMemo(
    () =>
      races
        .slice(0, shownRounds)
        .map((r) => ({ round: Number(r.round), name: r.raceName })),
    [races, shownRounds],
  )

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <span className="eyebrow">Formel 1</span>
          <h1>Statistiken</h1>
          <p className="subtitle">
            Wähle eine Saison und ein Rennen: die Tabellen zeigen den Weltmeisterschaftsstand
            direkt danach, der WM-Verlauf den Weg dorthin.
          </p>
        </div>
      </header>

      <main className="app">
        <div className="panel controls">
          <label>
            <span>Saison</span>
            <select value={season} onChange={(e) => setSeason(e.target.value)}>
              {seasons.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Rennen</span>
            <select
              value={round}
              onChange={(e) => setRound(e.target.value)}
              disabled={races.length === 0}
            >
              {races.map((r) => (
                <option key={r.round} value={r.round} disabled={isUpcoming(r)}>
                  {r.round}. {r.raceName}
                  {isUpcoming(r) ? ' (noch nicht gefahren)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedRace && (
          <div className="race-info">
            <span className="race-round">Runde {selectedRace.round}</span>
            <strong>{selectedRace.raceName}</strong>
            <span>
              {selectedRace.Circuit.circuitName} · {selectedRace.Circuit.Location.locality},{' '}
              {selectedRace.Circuit.Location.country}
            </span>
            <span>{new Date(selectedRace.date).toLocaleDateString('de-DE')}</span>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="panel panel-body">
          {tab === 'progression' ? (
            progressionSeason !== season ? (
              <div className="status">
                Lade {progress.total} Rennen der Saison {season} …
                <div className="progress">
                  <i
                    style={{
                      width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ) : chartDrivers.length === 0 ? (
              <div className="status">Für diese Saison liegen keine Punktedaten vor.</div>
            ) : (
              <>
                <div className="chart-head">
                  <h2>Punkteverlauf {season}</h2>
                  <p>
                    Nach {shownRounds} von {races.length} Rennen · Farbe für die besten acht
                    nach Runde {latestRound}
                  </p>
                </div>
                <ProgressionChart drivers={chartDrivers} rounds={chartRounds} />
              </>
            )
          ) : loading ? (
            <div className="status">Lade Daten …</div>
          ) : tab === 'drivers' ? (
            <StandingsTable
              rows={drivers.map((d) => ({
                key: d.Driver.driverId,
                position: d.positionText,
                name: `${d.Driver.givenName} ${d.Driver.familyName}`,
                detail: d.Constructors.map((c) => c.name).join(', '),
                nationality: d.Driver.nationality,
                points: d.points,
                wins: d.wins,
              }))}
              detailLabel="Team"
              empty={
                selectedRace && isUpcoming(selectedRace)
                  ? 'Dieses Rennen wurde noch nicht gefahren.'
                  : 'Für dieses Rennen liegen keine Fahrerwertungsdaten vor.'
              }
            />
          ) : (
            <StandingsTable
              rows={constructors.map((c) => ({
                key: c.Constructor.constructorId,
                position: c.positionText,
                name: c.Constructor.name,
                detail: '',
                nationality: c.Constructor.nationality,
                points: c.points,
                wins: c.wins,
              }))}
              detailLabel=""
              empty={
                selectedRace && isUpcoming(selectedRace)
                  ? 'Dieses Rennen wurde noch nicht gefahren.'
                  : 'Die Konstrukteurswertung gibt es erst ab der Saison 1958.'
              }
            />
          )}
        </div>

        <footer>
          Daten von <a href="https://api.jolpi.ca">Jolpica-F1</a>. Kein offizielles Angebot der
          Formel 1.
        </footer>
      </main>
    </>
  )
}

interface Row {
  key: string
  position: string
  name: string
  detail: string
  nationality: string
  points: string
  wins: string
}

function StandingsTable({
  rows,
  detailLabel,
  empty,
}: {
  rows: Row[]
  detailLabel: string
  empty: string
}) {
  if (rows.length === 0) return <div className="status">{empty}</div>

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="pos">#</th>
            <th>Name</th>
            {detailLabel && <th>{detailLabel}</th>}
            <th>Nationalität</th>
            <th className="num">Punkte</th>
            <th className="num">Siege</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="pos">{r.position}</td>
              <td className="name">{r.name}</td>
              {detailLabel && <td>{r.detail}</td>}
              <td>{r.nationality}</td>
              <td className="num points">{r.points}</td>
              <td className="num">{r.wins}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
