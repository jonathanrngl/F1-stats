import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchSeasons,
  fetchRaces,
  fetchLatestRound,
  fetchDriverStandings,
  fetchConstructorStandings,
  fetchProgression,
  fetchRaceResults,
  fetchQualifying,
  fetchSprintResults,
  fetchSeasonResults,
  fetchSeasonStatus,
  type Race,
  type DriverStanding,
  type ConstructorStanding,
  type DriverProgression,
  type RaceResult,
  type QualifyingResult,
  type SeasonData,
  type StatusCount,
} from './api/jolpica'
import ProgressionChart from './ProgressionChart'
import StandingsTable from './components/StandingsTable'
import RaceResultTable from './components/RaceResultTable'
import QualifyingTable from './components/QualifyingTable'
import SeasonSummary from './components/SeasonSummary'
import WeekendSchedule from './components/WeekendSchedule'
import DriverCareer from './components/DriverCareer'
import StatTiles, { type Tile } from './components/StatTiles'
import Skeleton from './components/Skeleton'
import ThemeToggle from './components/ThemeToggle'
import { useAsync } from './lib/useAsync'
import { useTheme } from './lib/theme'
import { readHash, writeHash } from './lib/urlState'
import { pointsLabel, raceDateLong } from './lib/format'
import './App.css'

const TABS = [
  { id: 'drivers', label: 'Fahrerwertung' },
  { id: 'constructors', label: 'Konstrukteure' },
  { id: 'weekend', label: 'Wochenende' },
  { id: 'qualifying', label: 'Qualifying' },
  { id: 'race', label: 'Rennergebnis' },
  { id: 'progression', label: 'WM-Verlauf' },
  { id: 'season', label: 'Saison' },
  { id: 'driver', label: 'Fahrerkarriere' },
] as const

type Tab = (typeof TABS)[number]['id']

const isTab = (value: string | undefined): value is Tab => TABS.some((t) => t.id === value)

// Stabile Leerwerte: useAsync bekommt sie als Startwert und darf davon nicht neu laufen.
const NO_RESULTS: RaceResult[] = []
const NO_QUALIFYING: QualifyingResult[] = []
const NO_SEASON: SeasonData = { entries: [], races: [] }
const NO_STATUS: StatusCount[] = []
const NO_DRIVERS: DriverStanding[] = []
const NO_CONSTRUCTORS: ConstructorStanding[] = []

/** Sprintrennen gibt es erst ab 2021 – davor die Anfrage gar nicht stellen. */
const SPRINT_FROM = 2021

export default function App() {
  const [themeChoice, setThemeChoice] = useTheme()

  // Der Deep-Link wird genau einmal gelesen; danach schreibt die App ihn nur
  // noch. Als State und nicht als Ref, damit der Wert im Render gelesen werden
  // darf – die Initialisierungsfunktion laeuft ohnehin nur beim ersten Mal.
  const [fromLink] = useState(readHash)
  const [seasons, setSeasons] = useState<string[]>([])
  const [season, setSeason] = useState(fromLink.season ?? '')
  const [races, setRaces] = useState<Race[]>([])
  const [round, setRound] = useState('')
  const [latestRound, setLatestRound] = useState(0)
  const [tab, setTab] = useState<Tab>(isTab(fromLink.tab) ? fromLink.tab : 'drivers')
  // Der gewaehlte Fahrer der Karriere-Ansicht steht im Link, damit ein
  // geteilter Link dieselbe Laufbahn zeigt.
  const [driver, setDriver] = useState(fromLink.driver ?? '')
  const [fatal, setFatal] = useState('')

  // Runde aus dem Link: gilt nur, bis der Rennkalender der Saison da ist.
  const wantedRound = useRef(fromLink.round ?? '')

  const [progression, setProgression] = useState<DriverProgression[]>([])
  const [progressionSeason, setProgressionSeason] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [progressionError, setProgressionError] = useState('')

  useEffect(() => {
    fetchSeasons()
      .then((list) => {
        const years = list.map((s) => s.season).reverse()
        setSeasons(years)
        // Eine Saison aus dem Link behalten, sonst die neueste zeigen.
        setSeason((current) => (current && years.includes(current) ? current : (years[0] ?? '')))
      })
      .catch((e: Error) => setFatal(e.message))
  }, [])

  useEffect(() => {
    if (!season) return
    let cancelled = false
    setRaces([])
    setRound('')
    setLatestRound(0)
    setProgression([])
    setProgressionSeason('')
    setProgressionError('')
    setFatal('')
    Promise.all([fetchRaces(season), fetchLatestRound(season)])
      .then(([list, latest]) => {
        if (cancelled) return
        setRaces(list)
        setLatestRound(Number(latest) || 0)
        const wanted = wantedRound.current
        wantedRound.current = ''
        // In einer laufenden Saison stehen die letzten Runden noch aus – dann
        // ist die zuletzt gewertete Runde die sinnvolle Vorauswahl.
        const valid = wanted && list.some((r) => r.round === wanted)
        setRound(valid ? wanted : latest || list.at(-1)?.round || '')
      })
      .catch((e: Error) => !cancelled && setFatal(e.message))
    return () => {
      cancelled = true
    }
  }, [season])

  useEffect(() => {
    writeHash({ season, round, tab, driver })
  }, [season, round, tab, driver])

  // Ein von Hand geänderter Link soll wirken, ohne dass man neu lädt.
  useEffect(() => {
    const onHashChange = () => {
      const next = readHash()
      if (isTab(next.tab)) setTab(next.tab)
      if (next.driver) setDriver(next.driver)
      if (next.round) setRound(next.round)
      if (next.season) {
        wantedRound.current = next.round ?? ''
        setSeason(next.season)
      }
    }
    addEventListener('hashchange', onHashChange)
    return () => removeEventListener('hashchange', onHashChange)
  }, [])

  const at = season && round ? `${season}/${round}` : ''
  const driversQ = useAsync(at, () => fetchDriverStandings(season, round), NO_DRIVERS)
  const constructorsQ = useAsync(at, () => fetchConstructorStandings(season, round), NO_CONSTRUCTORS)

  const resultsQ = useAsync(
    tab === 'race' && at ? `r/${at}` : '',
    () => fetchRaceResults(season, round),
    NO_RESULTS,
  )
  const sprintQ = useAsync(
    tab === 'race' && at && Number(season) >= SPRINT_FROM ? `s/${at}` : '',
    () => fetchSprintResults(season, round),
    NO_RESULTS,
  )
  const qualifyingQ = useAsync(
    tab === 'qualifying' && at ? `q/${at}` : '',
    () => fetchQualifying(season, round),
    NO_QUALIFYING,
  )
  const seasonKey = tab === 'season' && season ? `y/${season}` : ''
  const seasonQ = useAsync(seasonKey, () => fetchSeasonResults(season), NO_SEASON)
  const statusQ = useAsync(seasonKey, () => fetchSeasonStatus(season), NO_STATUS)

  // Der Verlauf kostet eine Anfrage je Rennen, deshalb erst beim Öffnen des
  // Tabs und genau einmal pro Saison.
  //
  // Der Fehler wird hier eigens gehalten und nicht in `fatal` geworfen: bei
  // zwei Dutzend Anfragen ist ein endgültiger Fehlschlag realistisch, und dann
  // muss er *im Panel* stehen. Sonst bliebe dort "Lade 24 Rennen …" für immer
  // sichtbar, während die Meldung in einem Banner darüber hängt.
  useEffect(() => {
    if (tab !== 'progression' || !season || latestRound === 0) return
    if (progressionSeason === season) return
    let cancelled = false
    setProgress({ done: 0, total: latestRound })
    fetchProgression(season, latestRound, (done, total) => {
      if (!cancelled) setProgress({ done, total })
    })
      .then((rows) => {
        if (cancelled) return
        setProgression(rows)
        setProgressionSeason(season)
        setProgressionError('')
      })
      .catch((e: Error) => !cancelled && setProgressionError(e.message))
    return () => {
      cancelled = true
    }
  }, [tab, season, latestRound, progressionSeason])

  const drivers = driversQ.data
  const constructors = constructorsQ.data
  const selectedRace = races.find((r) => r.round === round)
  const isUpcoming = (r: Race) => latestRound > 0 && Number(r.round) > latestRound
  const upcoming = Boolean(selectedRace && isUpcoming(selectedRace))

  // Nur gefahrene Rennen: die Pfeile sollen nicht in leere Ansichten führen.
  const driveable = useMemo(
    () => races.filter((r) => !(latestRound > 0 && Number(r.round) > latestRound)),
    [races, latestRound],
  )
  const atIndex = driveable.findIndex((r) => r.round === round)
  const step = (delta: number) => {
    const next = driveable[atIndex + delta]
    if (next) setRound(next.round)
  }

  const tiles = useMemo<Tile[]>(() => {
    const list: Tile[] = []
    const [leader, second] = drivers
    if (leader) {
      list.push({
        label: 'WM-Führung',
        value: `${leader.Driver.givenName[0]}. ${leader.Driver.familyName}`,
        note: `${pointsLabel(Number(leader.points))} Punkte`,
      })
      if (second) {
        const gap = Number(leader.points) - Number(second.points)
        list.push({
          label: 'Vorsprung',
          value: gap === 0 ? 'punktgleich' : `+${pointsLabel(gap)}`,
          note: `auf ${second.Driver.familyName}`,
        })
      }
    }
    const [topTeam] = constructors
    if (topTeam) {
      list.push({
        label: 'Konstrukteure',
        value: topTeam.Constructor.name,
        note: `${pointsLabel(Number(topTeam.points))} Punkte`,
      })
    }
    if (races.length) {
      list.push({
        label: 'Saisonstand',
        value: `${Math.min(Number(round) || 0, latestRound || races.length)} / ${races.length}`,
        note: 'Rennen gewertet',
      })
    }
    return list
  }, [drivers, constructors, races.length, round, latestRound])

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
    () => races.slice(0, shownRounds).map((r) => ({ round: Number(r.round), name: r.raceName })),
    [races, shownRounds],
  )

  const noRaceYet = upcoming ? 'Dieses Rennen wurde noch nicht gefahren.' : ''
  const error = fatal || driversQ.error || resultsQ.error || qualifyingQ.error || seasonQ.error

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="masthead-top">
            <span className="eyebrow">Formel 1</span>
            <ThemeToggle choice={themeChoice} onChange={setThemeChoice} />
          </div>
          <h1>Statistiken</h1>
          <p className="subtitle">
            Jedes Rennen seit 1950: Weltmeisterschaftsstand, Rennergebnis, Qualifying und der
            Punkteverlauf einer ganzen Saison. Der Link in der Adresszeile zeigt immer genau das,
            was gerade zu sehen ist.
          </p>
        </div>
      </header>

      <main className="app">
        <div className="panel controls">
          <label className="control">
            <span>Saison</span>
            <select value={season} onChange={(e) => setSeason(e.target.value)}>
              {seasons.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <div className="control">
            <span id="race-label">Rennen</span>
            <div className="stepper">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={atIndex <= 0}
                aria-label="Vorheriges Rennen"
                title="Vorheriges Rennen"
              >
                &lsaquo;
              </button>
              <select
                aria-labelledby="race-label"
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
              <button
                type="button"
                onClick={() => step(1)}
                disabled={atIndex < 0 || atIndex >= driveable.length - 1}
                aria-label="Nächstes Rennen"
                title="Nächstes Rennen"
              >
                &rsaquo;
              </button>
            </div>
          </div>
        </div>

        {selectedRace && (
          <div className="race-info">
            <span className="race-round">Runde {selectedRace.round}</span>
            <strong>{selectedRace.raceName}</strong>
            <span>
              {selectedRace.Circuit.circuitName} · {selectedRace.Circuit.Location.locality},{' '}
              {selectedRace.Circuit.Location.country}
            </span>
            <span>{raceDateLong(selectedRace.date)}</span>
          </div>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <StatTiles tiles={tiles} />

        <div className="tabs" role="tablist" aria-label="Ansicht">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="tabpanel"
              tabIndex={tab === t.id ? 0 : -1}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                if (!delta) return
                e.preventDefault()
                const next = TABS[(i + delta + TABS.length) % TABS.length]
                setTab(next.id)
                document.getElementById(`tab-${next.id}`)?.focus()
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Der Key erzwingt einen neuen Knoten pro Ansicht: nur so läuft der
            Einblend-Effekt bei jedem Wechsel erneut. */}
        <div
          className="panel panel-body"
          id="tabpanel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          tabIndex={-1}
          key={tab === 'driver' ? `driver-${driver}` : `${tab}-${season}-${round}`}
        >
          {tab === 'drivers' &&
            (driversQ.loading ? (
              <Skeleton label="Fahrerwertung wird geladen" />
            ) : (
              <StandingsTable
                caption={`Fahrerwertung ${season} nach Runde ${round}`}
                detailLabel="Team"
                rows={drivers.map((d) => ({
                  key: d.Driver.driverId,
                  position: d.positionText,
                  name: `${d.Driver.givenName} ${d.Driver.familyName}`,
                  detail: d.Constructors.map((c) => c.name).join(', '),
                  nationality: d.Driver.nationality,
                  points: Number(d.points),
                  wins: Number(d.wins),
                }))}
                empty={noRaceYet || 'Für dieses Rennen liegen keine Fahrerwertungsdaten vor.'}
              />
            ))}

          {tab === 'constructors' &&
            (constructorsQ.loading ? (
              <Skeleton label="Konstrukteurswertung wird geladen" />
            ) : (
              <StandingsTable
                caption={`Konstrukteurswertung ${season} nach Runde ${round}`}
                detailLabel=""
                rows={constructors.map((c) => ({
                  key: c.Constructor.constructorId,
                  position: c.positionText,
                  name: c.Constructor.name,
                  detail: '',
                  nationality: c.Constructor.nationality,
                  points: Number(c.points),
                  wins: Number(c.wins),
                }))}
                empty={noRaceYet || 'Die Konstrukteurswertung gibt es erst ab der Saison 1958.'}
              />
            ))}

          {tab === 'weekend' &&
            (selectedRace ? (
              <WeekendSchedule race={selectedRace} onOpen={setTab} />
            ) : (
              <Skeleton label="Rennkalender wird geladen" rows={6} />
            ))}

          {tab === 'race' &&
            (resultsQ.loading ? (
              <Skeleton label="Rennergebnis wird geladen" />
            ) : (
              <>
                <RaceResultTable
                  results={resultsQ.data}
                  caption={`Rennergebnis ${selectedRace?.raceName ?? ''} ${season}`}
                  empty={noRaceYet || 'Für dieses Rennen liegt kein Ergebnis vor.'}
                />
                {sprintQ.data.length > 0 && (
                  <section className="sub-section">
                    <h3>Sprint</h3>
                    <RaceResultTable
                      results={sprintQ.data}
                      caption={`Sprintergebnis ${selectedRace?.raceName ?? ''} ${season}`}
                      empty=""
                    />
                  </section>
                )}
              </>
            ))}

          {tab === 'qualifying' &&
            (qualifyingQ.loading ? (
              <Skeleton label="Qualifying wird geladen" />
            ) : (
              <QualifyingTable
                results={qualifyingQ.data}
                caption={`Qualifying ${selectedRace?.raceName ?? ''} ${season}`}
                empty={
                  noRaceYet ||
                  'Für dieses Rennen sind keine Qualifying-Zeiten hinterlegt – in den Daten stehen sie erst für die neueren Saisons.'
                }
              />
            ))}

          {tab === 'driver' && <DriverCareer driverId={driver} onSelect={setDriver} />}

          {tab === 'season' &&
            (seasonQ.loading || statusQ.loading ? (
              <Skeleton label="Saisonbilanz wird geladen" rows={10} />
            ) : (
              <SeasonSummary
                data={seasonQ.data}
                status={statusQ.data}
                season={season}
                lastRound={latestRound}
              />
            ))}

          {tab === 'progression' &&
            (progressionError ? (
              <div className="status">
                <p className="error">{progressionError}</p>
                <button
                  type="button"
                  className="load-button"
                  // Neu laden statt nur den Effekt anstossen: nach einem
                  // Abbruch mitten in zwei Dutzend Anfragen ist der saubere
                  // Neustart die verlaessliche Variante.
                  onClick={() => location.reload()}
                >
                  Erneut versuchen
                </button>
              </div>
            ) : progressionSeason !== season ? (
              <p className="status">
                Lade {progress.total} Rennen der Saison {season} …
                <span className="progress">
                  <i
                    style={{
                      width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                    }}
                  />
                </span>
              </p>
            ) : chartDrivers.length === 0 ? (
              <p className="status">Für diese Saison liegen keine Punktedaten vor.</p>
            ) : (
              <>
                <div className="chart-head">
                  <h2>Punkteverlauf {season}</h2>
                  <p>
                    Nach {shownRounds} von {races.length} Rennen · Farbe für die besten acht nach
                    Runde {latestRound}
                  </p>
                </div>
                <ProgressionChart drivers={chartDrivers} rounds={chartRounds} />
              </>
            ))}
        </div>

        <footer>
          Daten von <a href="https://api.jolpi.ca">Jolpica-F1</a>. Kein offizielles Angebot der
          Formel 1.
        </footer>
      </main>
    </>
  )
}
