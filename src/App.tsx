import { useEffect, useState } from 'react'
import {
  fetchSeasons,
  fetchRaces,
  fetchDriverStandings,
  fetchConstructorStandings,
  type Race,
  type DriverStanding,
  type ConstructorStanding,
} from './api/jolpica'
import './App.css'

type Tab = 'drivers' | 'constructors'

export default function App() {
  const [seasons, setSeasons] = useState<string[]>([])
  const [season, setSeason] = useState('')
  const [races, setRaces] = useState<Race[]>([])
  const [round, setRound] = useState('')
  const [drivers, setDrivers] = useState<DriverStanding[]>([])
  const [constructors, setConstructors] = useState<ConstructorStanding[]>([])
  const [tab, setTab] = useState<Tab>('drivers')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    setRaces([])
    setRound('')
    setError('')
    fetchRaces(season)
      .then((list) => {
        setRaces(list)
        setRound(list.at(-1)?.round ?? '')
      })
      .catch((e) => setError(e.message))
  }, [season])

  useEffect(() => {
    if (!season || !round) return
    setLoading(true)
    setError('')
    Promise.all([
      fetchDriverStandings(season, round),
      fetchConstructorStandings(season, round),
    ])
      .then(([d, c]) => {
        setDrivers(d)
        setConstructors(c)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [season, round])

  const selectedRace = races.find((r) => r.round === round)

  return (
    <div className="app">
      <header>
        <h1>Formel 1 Statistiken</h1>
        <p className="subtitle">
          Wähle ein Rennen und sieh den Weltmeisterschaftsstand direkt danach.
        </p>
      </header>

      <div className="controls">
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
              <option key={r.round} value={r.round}>
                {r.round}. {r.raceName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedRace && (
        <div className="race-info">
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
        <button
          className={tab === 'drivers' ? 'active' : ''}
          onClick={() => setTab('drivers')}
        >
          Fahrerwertung
        </button>
        <button
          className={tab === 'constructors' ? 'active' : ''}
          onClick={() => setTab('constructors')}
        >
          Konstrukteurswertung
        </button>
      </div>

      {loading ? (
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
          empty="Für dieses Rennen liegen keine Fahrerwertungsdaten vor."
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
          empty="Die Konstrukteurswertung gibt es erst ab der Saison 1958."
        />
      )}

      <footer>
        Daten von <a href="https://api.jolpi.ca">Jolpica-F1</a>. Kein offizielles Angebot der
        Formel 1.
      </footer>
    </div>
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
            <td className="num">{r.points}</td>
            <td className="num">{r.wins}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
