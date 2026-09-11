import { useMemo } from 'react'
import type { SeasonData, StatusCount } from '../api/jolpica'
import DataTable, { type Column } from './DataTable'
import Leaderboard from './Leaderboard'
import PitStopSection from './PitStopSection'
import StatTiles, { type Tile } from './StatTiles'
import { raceDate, reachedFinish } from '../lib/format'
import { statusLabel } from '../lib/status'
import {
  byDriver,
  byTeam,
  hasFastestLap,
  isPodium,
  isPointsFinish,
  isRetirement,
  isWin,
  overview,
  positionsGained,
  startedFirst,
} from '../lib/seasonStats'

/*
 * Die Saison als Ganzes: Kennzahlen, Bestenlisten, jeder Rennsieger, die
 * Ausfallbilanz und – auf Wunsch – die Boxenstopps.
 *
 * Alles bis auf die Boxenstopps kommt aus zwei Quellen: den Ergebnissen der
 * ganzen Saison (fuenf Anfragen, seitenweise) und der serverseitig schon
 * gezaehlten Statusliste (eine Anfrage).
 */

interface WinnerRow {
  round: number
  raceName: string
  circuitName: string
  date: string
  driver: string
  team: string
  grid: number
}

export default function SeasonSummary({
  data,
  status,
  season,
  lastRound,
}: {
  data: SeasonData
  status: StatusCount[]
  season: string
  lastRound: number
}) {
  const { entries, races } = data

  const winners = useMemo<WinnerRow[]>(() => {
    const meta = new Map(races.map((r) => [r.round, r]))
    return entries
      .filter((e) => e.position === 1)
      .map((e) => ({
        round: e.round,
        raceName: e.raceName,
        circuitName: meta.get(e.round)?.circuitName ?? '',
        date: meta.get(e.round)?.date ?? '',
        driver: e.driver,
        team: e.team,
        grid: e.grid,
      }))
      .sort((a, b) => a.round - b.round)
  }, [entries, races])

  const summary = useMemo(() => overview(entries), [entries])

  const tiles: Tile[] = [
    { label: 'Rennen', value: String(summary.races), note: `Saison ${season}` },
    {
      label: 'Verschiedene Sieger',
      value: String(summary.winners),
      note: `aus ${summary.winnerTeams} ${summary.winnerTeams === 1 ? 'Team' : 'Teams'}`,
    },
    {
      label: 'Starts von Platz eins',
      value: String(summary.polesitters),
      note: 'verschiedene Fahrer',
    },
    {
      label: 'Ausfallquote',
      value: `${(summary.retirementShare * 100).toFixed(1).replace('.', ',')} %`,
      note: 'aller gewerteten Starts',
    },
  ]

  const columns: Column<WinnerRow>[] = [
    {
      key: 'round',
      label: 'Runde',
      shortLabel: '#',
      num: true,
      defaultDir: 'asc',
      sortBy: (w) => w.round,
      render: (w) => <span className="pos">{w.round}</span>,
    },
    {
      key: 'race',
      label: 'Rennen',
      sortBy: (w) => w.raceName,
      render: (w) => (
        <span className="name">
          {w.raceName}
          {w.circuitName && <span className="sub">{w.circuitName}</span>}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Datum',
      secondary: true,
      sortBy: (w) => w.date,
      render: (w) => (w.date ? raceDate(w.date) : ''),
    },
    {
      key: 'winner',
      label: 'Sieger',
      sortBy: (w) => w.driver,
      render: (w) => <span className="name">{w.driver}</span>,
    },
    {
      key: 'team',
      label: 'Team',
      sortBy: (w) => w.team,
      render: (w) => w.team,
    },
    {
      key: 'grid',
      label: 'Startplatz',
      shortLabel: 'Start',
      num: true,
      defaultDir: 'asc',
      sortBy: (w) => w.grid || 99,
      render: (w) =>
        w.grid === 1 ? (
          <abbr className="badge-pole" title="Sieg von Startplatz eins">
            1
          </abbr>
        ) : w.grid ? (
          String(w.grid)
        ) : (
          <abbr title="Aus der Boxengasse">Box</abbr>
        ),
    },
  ]

  const total = status.reduce((sum, s) => sum + s.count, 0)
  const finished = status.filter((s) => s.status === 'Finished').reduce((a, s) => a + s.count, 0)
  const lapped = status
    .filter((s) => s.status !== 'Finished' && reachedFinish(s.status))
    .reduce((a, s) => a + s.count, 0)
  const out = total - finished - lapped
  const causes = status.filter((s) => !reachedFinish(s.status))

  const share = (n: number) => (total ? (n / total) * 100 : 0)
  const percent = (n: number) => `${share(n).toFixed(1).replace('.', ',')} %`

  return (
    <div className="season">
      <section>
        <h3>Kennzahlen</h3>
        <StatTiles tiles={tiles} />
      </section>

      <section>
        <h3>Bestenlisten</h3>
        <div className="boards">
          <Leaderboard title="Meiste Rennsiege" ranks={byDriver(entries, isWin)} index={0} />
          <Leaderboard title="Meiste Podien" ranks={byDriver(entries, isPodium)} index={1} />
          <Leaderboard
            title="Meiste schnellste Runden"
            ranks={byDriver(entries, hasFastestLap)}
            index={2}
          />
          <Leaderboard
            title="Meiste Starts von Platz eins"
            note="Der Startplatz, nicht die Qualifying-Bestzeit – bei Strafen fallen die beiden auseinander."
            ranks={byDriver(entries, startedFirst)}
            index={3}
          />
          <Leaderboard
            title="Plätze gutgemacht"
            note="Startplatz minus Zielposition, über die Saison summiert. Das sind keine Überholmanöver: die Datenquelle zählt sie nicht, und aus Rundenpositionen wäre jeder Boxenstopp ein falscher Treffer."
            ranks={byDriver(entries, positionsGained)}
            index={4}
          />
          <Leaderboard
            title="Meiste Punkteplatzierungen"
            ranks={byDriver(entries, isPointsFinish)}
            index={5}
          />
          <Leaderboard title="Meiste Ausfälle" ranks={byDriver(entries, isRetirement)} index={6} />
          <Leaderboard
            title="Siege je Team"
            ranks={byTeam(entries, isWin)}
            index={7}
          />
        </div>
      </section>

      <section>
        <h3>Rennsieger {season}</h3>
        <DataTable
          rows={winners}
          columns={columns}
          rowKey={(w) => String(w.round)}
          empty="Für diese Saison liegen keine Rennergebnisse vor."
          caption={`Sieger aller Rennen der Saison ${season}`}
        />
      </section>

      {total > 0 && (
        <section>
          <h3>Wie die Starts endeten</h3>
          <p className="section-note">
            {total} gewertete Starts der Saison {season}, so wie die Autos das Rennen beendet
            haben.
          </p>

          <div
            className="split"
            role="img"
            aria-label={`${percent(finished)} Zielankunft, ${percent(lapped)} überrundet, ${percent(out)} Ausfall`}
          >
            <span className="split-seg finish" style={{ width: `${share(finished)}%` }} />
            <span className="split-seg lapped" style={{ width: `${share(lapped)}%` }} />
            <span className="split-seg out" style={{ width: `${share(out)}%` }} />
          </div>
          <ul className="split-key">
            <li>
              <span className="key finish" /> Zielankunft <b>{finished}</b>
              <span className="muted-cell">{percent(finished)}</span>
            </li>
            <li>
              <span className="key lapped" /> Überrundet <b>{lapped}</b>
              <span className="muted-cell">{percent(lapped)}</span>
            </li>
            <li>
              <span className="key out" /> Ausfall <b>{out}</b>
              <span className="muted-cell">{percent(out)}</span>
            </li>
          </ul>

          {causes.length > 0 && (
            <>
              <h4>Ausfallgründe</h4>
              <ul className="causes">
                {causes.map((c) => (
                  <li key={c.status}>
                    <span className="cause-name">{statusLabel(c.status)}</span>
                    <span
                      className="cause-bar"
                      style={
                        { '--w': `${(c.count / causes[0].count) * 100}%` } as React.CSSProperties
                      }
                    />
                    <span className="cause-count">{c.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <PitStopSection season={season} lastRound={lastRound} races={races} entries={entries} />
    </div>
  )
}
