import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchSeasons,
  fetchRaces,
  fetchLatestRound,
  fetchDriverStandings,
  fetchConstructorStandings,
  fetchProgression,
  fetchSeasonResults,
  fetchSprintRounds,
  type Race,
  type DriverStanding,
  type ConstructorStanding,
  type DriverProgression,
  type RaceResults,
  type SprintInfo,
} from './api/jolpica'
import { hadDroppedScores, roundCaps, titleRace } from './analysis'
import SeasonChart, { type ChartRound } from './SeasonChart'
import RaceAnalysis from './RaceAnalysis'
import TitleRace from './TitleRace'
import ThemeSwitch from './ThemeSwitch'
import { nation } from './nations'
import './App.css'

type Tab = 'drivers' | 'constructors' | 'progression' | 'analysis' | 'title'

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: 'drivers', label: 'Fahrerwertung', short: 'Fahrer' },
  { id: 'constructors', label: 'Konstrukteurswertung', short: 'Teams' },
  { id: 'progression', label: 'WM-Verlauf', short: 'Verlauf' },
  { id: 'analysis', label: 'Rennanalyse', short: 'Analyse' },
  { id: 'title', label: 'Titelkampf', short: 'Titel' },
]

/** Tabs, die den rundenweisen Punkteverlauf brauchen (teuer: eine Anfrage je Rennen). */
const NEEDS_PROGRESSION: Tab[] = ['progression', 'title']
/** Tabs, die die Ergebnisliste der Saison brauchen (fünf Anfragen, unabhängig von der Rennzahl). */
const NEEDS_RESULTS: Tab[] = ['analysis', 'title']

/** Eine einzige leere Liste: als frisches [] je Render würde jedes Memo daran hängen. */
const NO_RACES: Race[] = []

interface Loaded<T> {
  season: string
  data: T
  done: number
  total: number
  complete: boolean
}

const EMPTY = <T,>(data: T): Loaded<T> => ({
  season: '',
  data,
  done: 0,
  total: 0,
  complete: false,
})

export default function App() {
  const [seasons, setSeasons] = useState<string[]>([])
  const [season, setSeason] = useState('')
  /*
   * Rennkalender und zuletzt gewertete Runde in einem Zustand, samt der Saison,
   * zu der sie gehören.
   *
   * Getrennt gehalten passte beides kurzzeitig nicht zur gewählten Saison: Beim
   * Wechsel von 2026 auf 2023 lief der Verlaufs-Effekt noch mit der Rundenzahl
   * des Vorjahres an und lud 13 statt 22 Rennen – die Saison wirkte dann wie
   * eine laufende, der Titelrechner erklärte den längst entschiedenen Titel für
   * offen. Als ein Zustand kann das Paar gar nicht erst auseinanderlaufen.
   */
  const [calendar, setCalendar] = useState<{
    season: string
    races: Race[]
    latestRound: number
  }>({ season: '', races: [], latestRound: 0 })
  const [round, setRound] = useState('')
  const [drivers, setDrivers] = useState<DriverStanding[]>([])
  const [constructors, setConstructors] = useState<ConstructorStanding[]>([])
  const [tab, setTab] = useState<Tab>('drivers')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [prog, setProg] = useState<Loaded<DriverProgression[]>>(() => EMPTY([]))
  const [results, setResults] = useState<Loaded<RaceResults[]>>(() => EMPTY([]))
  const [sprint, setSprint] = useState<Loaded<SprintInfo>>(() =>
    EMPTY({ rounds: [], maxPoints: 0 }),
  )

  // Solange der Kalender einer anderen Saison gehört, gilt er als nicht da –
  // lieber ein Ladezustand als Zahlen aus dem falschen Jahr. Steht vor den
  // Effekten, weil die Ladeläufe an der Rundenzahl hängen.
  const races = calendar.season === season ? calendar.races : NO_RACES
  const latestRound = calendar.season === season ? calendar.latestRound : 0

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
    setRound('')
    setError('')
    Promise.all([fetchRaces(season), fetchLatestRound(season)])
      .then(([list, latest]) => {
        if (cancelled) return
        setCalendar({ season, races: list, latestRound: Number(latest) || 0 })
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
    Promise.all([fetchDriverStandings(season, round), fetchConstructorStandings(season, round)])
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

  /*
   * Welche Saison gerade geladen wird – als Ref, nicht als State.
   *
   * Mit einem Abbruch-Flag im Cleanup ginge es nicht: Der Effekt trägt beim
   * Start die Saison in den Ladezustand ein, und sobald der in der
   * Abhängigkeitsliste steht, löst er sein eigenes Cleanup aus und storniert
   * genau die Anfrage, die er eben begonnen hat. Ein Wechsel des Tabs täte
   * dasselbe, obwohl der Nachbartab dieselben Daten braucht. Der Ref ändert
   * keine Abhängigkeit; ob eine Antwort noch gebraucht wird, entscheidet der
   * Vergleich beim Eintreffen.
   */
  const wanted = useRef({ prog: '', results: '' })

  // Der Verlauf kostet eine Anfrage je Rennen, deshalb erst beim Öffnen eines
  // Tabs, der ihn braucht, und genau einmal pro Saison. Die Zwischenstände
  // gehen direkt in die Ansicht: der Graph wächst, statt zu warten.
  useEffect(() => {
    if (!NEEDS_PROGRESSION.includes(tab) || !season || latestRound === 0) return
    if (wanted.current.prog === season) return
    const mine = season
    wanted.current.prog = mine
    setProg({ season: mine, data: [], done: 0, total: latestRound, complete: false })
    setError('')
    fetchProgression(mine, latestRound, (done, total, partial) => {
      if (wanted.current.prog === mine) {
        setProg({ season: mine, data: partial, done, total, complete: false })
      }
    })
      .then((rows) => {
        if (wanted.current.prog !== mine) return
        setProg({ season: mine, data: rows, done: latestRound, total: latestRound, complete: true })
      })
      .catch((e) => {
        if (wanted.current.prog !== mine) return
        wanted.current.prog = '' // Fehlschlag nicht merken, damit ein neuer Versuch greift.
        setProg(EMPTY([]))
        setError(e.message)
      })
  }, [tab, season, latestRound])

  // Die Ergebnisliste zählt Ergebniszeilen, nicht Rennen: eine moderne Saison
  // kostet fünf Anfragen statt 24. Die Sprintrunden kommen für den Titelrechner
  // dazu – ohne sie wäre die Obergrenze je Wochenende zu grob.
  useEffect(() => {
    if (!NEEDS_RESULTS.includes(tab) || !season) return
    if (wanted.current.results === season) return
    const mine = season
    wanted.current.results = mine
    setResults({ season: mine, data: [], done: 0, total: 0, complete: false })
    setError('')
    Promise.all([
      fetchSeasonResults(mine, (done, total) => {
        if (wanted.current.results === mine) {
          setResults((p) => ({ ...p, season: mine, done, total }))
        }
      }),
      // Ohne Sprints ist die Saison nicht kaputt, nur die Obergrenze gröber.
      fetchSprintRounds(mine).catch(() => ({ rounds: [], maxPoints: 0 })),
    ])
      .then(([rows, sprintInfo]) => {
        if (wanted.current.results !== mine) return
        setResults({ season: mine, data: rows, done: 1, total: 1, complete: true })
        setSprint({ season: mine, data: sprintInfo, done: 1, total: 1, complete: true })
      })
      .catch((e) => {
        if (wanted.current.results !== mine) return
        wanted.current.results = ''
        setResults(EMPTY([]))
        setError(e.message)
      })
  }, [tab, season])

  const selectedRace = races.find((r) => r.round === round)
  const isUpcoming = (r: Race) => latestRound > 0 && Number(r.round) > latestRound
  // Gleiche Regel wie isUpcoming, hier ausgeschrieben: als Aufruf hinge das Memo
  // an einer Funktion, die bei jedem Rendern neu entsteht.
  const available = useMemo(
    () => races.filter((r) => !(latestRound > 0 && Number(r.round) > latestRound)),
    [races, latestRound],
  )
  const atRace = available.findIndex((r) => r.round === round)

  /*
   * Der Verlauf gehört immer zu genau einer Saison. Nach einem Saisonwechsel
   * steht der alte noch vollständig im State – bis der neue Abruf anläuft, und
   * das dauert, weil erst die Rundenzahl geholt werden muss. Ohne diese Sperre
   * zeigte der Titelkampf in dieser Lücke den fertigen Befund des Vorjahres:
   * für 1988 stand dort Verstappen.
   */
  const progRows = useMemo(
    () => (prog.season === season ? prog.data : []),
    [prog.season, prog.data, season],
  )
  const progReady = prog.season === season && prog.complete

  // Die Rennen-Auswahl begrenzt auch die Graphen. Die Reihenfolge bleibt dabei
  // die des Saisonendes: so behält jeder Fahrer seine Farbe, egal wie weit
  // zurück der Leser schaut.
  const shownRounds = Math.min(Number(round) || latestRound, progRows[0]?.points.length ?? 0)
  const chartSeries = useMemo(
    () =>
      progRows.map((d) => {
        const values = d.points.slice(0, shownRounds)
        return {
          id: d.driverId,
          code: d.code,
          name: d.name,
          values,
          last: values.at(-1) ?? 0,
        }
      }),
    [progRows, shownRounds],
  )
  const chartRounds = useMemo<ChartRound[]>(
    () => races.slice(0, shownRounds).map((r) => ({ round: Number(r.round), name: r.raceName })),
    [races, shownRounds],
  )

  // Die Rennen-Auswahl begrenzt auch die Analyse: Wer auf Runde 5 zurückgeht,
  // sieht das Teamduell nach fünf Rennen, nicht das des Saisonendes.
  const analysisRaces = useMemo(() => {
    const upto = Number(round) || results.data.length
    return results.data.filter((r) => r.round <= upto)
  }, [results.data, round])

  const verdict = useMemo(() => {
    const shown = progRows.map((d) => {
      const points = d.points.slice(0, shownRounds)
      return { ...d, points, total: points.at(-1) ?? 0 }
    })
    const caps =
      results.complete && results.season === season
        ? roundCaps(results.data, sprint.data.rounds, sprint.data.maxPoints, races.length)
        : undefined
    return titleRace(
      [...shown].sort((a, b) => b.total - a.total),
      races.length,
      caps?.length ? caps : undefined,
    )
  }, [progRows, shownRounds, results, sprint.data, races.length, season])

  // Streichresultate lassen sich nur erkennen, wenn beide Quellen da sind.
  const dropped = useMemo(
    () =>
      results.complete && results.season === season && progReady
        ? hadDroppedScores(results.data, progRows)
        : false,
    [results, season, progReady, progRows],
  )

  const progressBar = (done: number, total: number, label: string) => (
    <div className="status">
      {label}
      <div className="progress">
        <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </div>
  )

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="masthead-top">
            <span className="eyebrow">Formel 1</span>
            <ThemeSwitch />
          </div>
          <h1>Statistiken</h1>
          <p className="subtitle">
            Jede Saison seit 1950, zu jedem Rennen: Weltmeisterschaftsstand, Punkteverlauf, das
            Kräfteverhältnis in den Teams und die Frage, wann der Titel entschieden war.
          </p>
        </div>
      </header>

      <main className="app">
        <div className="panel controls">
          <label className="field">
            <span>Saison</span>
            <select value={season} onChange={(e) => setSeason(e.target.value)}>
              {seasons.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <div className="field race-field">
            <span id="race-label">Rennen</span>
            <div className="stepper">
              <button
                type="button"
                aria-label="Vorheriges Rennen"
                disabled={atRace <= 0}
                onClick={() => setRound(available[atRace - 1].round)}
              >
                ‹
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
                aria-label="Nächstes Rennen"
                disabled={atRace < 0 || atRace >= available.length - 1}
                onClick={() => setRound(available[atRace + 1].round)}
              >
                ›
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
            <span>{new Date(selectedRace.date).toLocaleDateString('de-DE')}</span>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <nav className="tabs" aria-label="Ansicht">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              <span className="long">{t.label}</span>
              <span className="short">{t.short}</span>
            </button>
          ))}
        </nav>

        <div className="panel panel-body">
          {tab === 'drivers' || tab === 'constructors' ? (
            loading ? (
              <TableSkeleton />
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
            )
          ) : tab === 'progression' ? (
            chartSeries.length === 0 ? (
              !progReady ? (
                progressBar(prog.done, prog.total, `Lade ${prog.total} Rennen der Saison ${season} …`)
              ) : (
                <p className="status">Für diese Saison liegen keine Punktedaten vor.</p>
              )
            ) : (
              <>
                <div className="chart-head">
                  <h2>Punkteverlauf {season}</h2>
                  <p>
                    Nach {shownRounds} von {races.length} Rennen
                    {!progReady && ` · lädt noch (${prog.done}/${prog.total})`}
                  </p>
                </div>
                <SeasonChart series={chartSeries} rounds={chartRounds} yLabel="Punkte" />
              </>
            )
          ) : tab === 'analysis' ? (
            !results.complete || results.season !== season ? (
              progressBar(results.done, results.total || 1, `Lade Rennergebnisse ${season} …`)
            ) : (
              <RaceAnalysis races={analysisRaces} />
            )
          ) : chartSeries.length === 0 ? (
            !progReady ? (
              progressBar(prog.done, prog.total, `Lade ${prog.total} Rennen der Saison ${season} …`)
            ) : (
              <p className="status">Für diese Saison liegen keine Punktedaten vor.</p>
            )
          ) : (
            <TitleRace
              verdict={verdict}
              progression={progRows.map((d) => ({
                ...d,
                points: d.points.slice(0, shownRounds),
                total: d.points.slice(0, shownRounds).at(-1) ?? 0,
              }))}
              rounds={chartRounds}
              pending={progReady ? undefined : { done: prog.done, total: prog.total }}
              dropped={dropped}
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

function TableSkeleton() {
  return (
    <div className="skeleton" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="skeleton-row">
          <i style={{ width: '1.5rem' }} />
          <i style={{ width: `${45 + ((i * 13) % 30)}%` }} />
          <i style={{ width: '3rem' }} />
        </div>
      ))}
      <span className="sr-only">Lade Daten</span>
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
  if (rows.length === 0) return <p className="status">{empty}</p>

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="pos">#</th>
            <th>Name</th>
            {detailLabel && <th className="hide-sm">{detailLabel}</th>}
            <th className="hide-sm">Nationalität</th>
            <th className="num">Punkte</th>
            <th className="num">Siege</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const nat = nation(r.nationality)
            return (
              <tr key={r.key}>
                <td className="pos">{r.position}</td>
                <td className="name">
                  <span className="code" title={nat.name}>
                    {nat.code}
                  </span>
                  {r.name}
                  {/* Auf schmalen Anzeigen steht das Team unter dem Namen,
                      statt in einer eigenen Spalte weit rechts. */}
                  {r.detail && <span className="sub">{r.detail}</span>}
                </td>
                {detailLabel && <td className="hide-sm">{r.detail}</td>}
                <td className="hide-sm">{nat.name}</td>
                <td className="num points">{r.points}</td>
                <td className="num">{r.wins}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
