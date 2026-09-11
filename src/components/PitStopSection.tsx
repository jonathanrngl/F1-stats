import { useState } from 'react'
import type { SeasonEntry, SeasonRace } from '../api/jolpica'
import { fetchSeasonPitStops, PITSTOPS_FROM, type SeasonPitStops } from '../api/pitstops'
import { pitStats, type RaceFastest } from '../lib/seasonStats'
import DataTable, { type Column } from './DataTable'
import Leaderboard from './Leaderboard'

/*
 * Boxenstopps aus zwei Quellen – siehe api/pitstops.ts, welche wann greift.
 *
 * Zwei Zahlen, die man auseinanderhalten muss, und genau darum stehen sie hier
 * in getrennten Spalten:
 *
 * Die *Standzeit* ist die Zeit am Auto, die bekannten rund zwei Sekunden. Sie
 * hängt nur an der Mannschaft und ist deshalb die einzige der beiden, die man
 * über Strecken hinweg vergleichen darf – als Saisonbestzeit taugt nur sie.
 *
 * Die *Boxengassen-Zeit* umfasst den ganzen Weg von der Einfahrt bis zur
 * Ausfahrt. Sie hängt an der Länge der Boxengasse und an der Rennsituation:
 * unter Safety Car fällt sie deutlich kürzer aus, in Rotphasen dauert sie
 * Minuten. Sie steht deshalb nur je Rennen und immer neben dem Median
 * desselben Rennens.
 */

type State =
  | { phase: 'idle' }
  | { phase: 'loading'; done: number; total: number }
  | { phase: 'ready'; data: SeasonPitStops }
  | { phase: 'error'; message: string }

const seconds = (value: number, digits = 3) =>
  `${value.toFixed(digits).replace('.', ',')} s`

export default function PitStopSection({
  season,
  lastRound,
  races,
  entries,
}: {
  season: string
  lastRound: number
  races: SeasonRace[]
  entries: SeasonEntry[]
}) {
  const [state, setState] = useState<State>({ phase: 'idle' })

  if (Number(season) < PITSTOPS_FROM) {
    return (
      <section>
        <h3>Boxenstopps</h3>
        <p className="data-note">
          <strong>Erst ab {PITSTOPS_FROM}.</strong> Für frühere Saisons sind keine Boxenstopps
          hinterlegt.
        </p>
      </section>
    )
  }

  const load = () => {
    setState({ phase: 'loading', done: 0, total: lastRound })
    fetchSeasonPitStops(season, lastRound, races, (done, total) =>
      setState((prev) => (prev.phase === 'loading' ? { phase: 'loading', done, total } : prev)),
    )
      .then((data) => setState({ phase: 'ready', data }))
      .catch((e: Error) => setState({ phase: 'error', message: e.message }))
  }

  return (
    <section>
      <h3>Boxenstopps</h3>

      {state.phase === 'idle' && (
        <>
          <p className="section-note">
            Boxenstopps liegen in einer eigenen Abfrage – für ältere Saisons sogar einzeln je
            Rennen. Deshalb erst auf Wunsch.
          </p>
          <button type="button" className="load-button" onClick={load}>
            Boxenstopps der Saison {season} auswerten
          </button>
        </>
      )}

      {state.phase === 'loading' && (
        <p className="status">
          Lade Boxenstopps{state.total > 2 ? `, Rennen ${state.done} von ${state.total}` : ' …'}
          <span className="progress">
            <i style={{ width: `${state.total ? (state.done / state.total) * 100 : 0}%` }} />
          </span>
        </p>
      )}

      {state.phase === 'error' && <p className="error">{state.message}</p>}

      {state.phase === 'ready' && <PitStopResult data={state.data} entries={entries} />}
    </section>
  )
}

function PitStopResult({ data, entries }: { data: SeasonPitStops; entries: SeasonEntry[] }) {
  const stats = pitStats(data.races, entries)

  if (stats.totalStops === 0) {
    return <p className="status">Für diese Saison sind keine Boxenstopps hinterlegt.</p>
  }

  const hasStill = data.withStill > 0
  const coverage = data.total ? Math.round((data.withStill / data.total) * 100) : 0

  const columns: Column<RaceFastest>[] = [
    {
      key: 'round',
      label: 'Runde',
      shortLabel: '#',
      num: true,
      defaultDir: 'asc',
      sortBy: (r) => r.round,
      render: (r) => <span className="pos">{r.round}</span>,
    },
    {
      key: 'race',
      label: 'Rennen',
      sortBy: (r) => r.raceName,
      render: (r) => <span className="name">{r.raceName}</span>,
    },
    ...(hasStill
      ? [
          {
            key: 'still',
            label: 'Schnellste Standzeit',
            shortLabel: 'Standzeit',
            num: true,
            defaultDir: 'asc' as const,
            sortBy: (r: RaceFastest) => r.still ?? NaN,
            render: (r: RaceFastest) =>
              r.still === undefined ? (
                <span className="zero">–</span>
              ) : (
                <span className="time strong-cell">{seconds(r.still, 2)}</span>
              ),
          },
          {
            key: 'stillWho',
            label: 'Standzeit von',
            shortLabel: 'von',
            secondary: true,
            sortBy: (r: RaceFastest) => r.stillTeam ?? '',
            render: (r: RaceFastest) =>
              r.stillDriver ? (
                <span className="name">
                  {r.stillDriver}
                  <span className="sub">{r.stillTeam}</span>
                </span>
              ) : (
                ''
              ),
          },
        ]
      : []),
    {
      key: 'lane',
      label: 'Kürzeste Zeit in der Boxengasse',
      shortLabel: 'Boxengasse',
      num: true,
      defaultDir: 'asc',
      sortBy: (r) => r.lane,
      render: (r) => <span className="time">{seconds(r.lane)}</span>,
    },
    {
      key: 'median',
      // Der Bezug gehoert in die Tabelle, nicht in eine Fussnote: erst neben
      // dem Median dieses Rennens ist die Zeit links ueberhaupt zu lesen.
      label: 'Median des Rennens',
      shortLabel: 'Median',
      num: true,
      secondary: true,
      defaultDir: 'asc',
      sortBy: (r) => r.laneMedian,
      render: (r) => <span className="muted-cell">{seconds(r.laneMedian)}</span>,
    },
    {
      key: 'laneWho',
      label: 'Boxengasse von',
      shortLabel: 'von',
      secondary: true,
      sortBy: (r) => r.laneTeam,
      render: (r) => (
        <span className="name">
          {r.laneDriver}
          <span className="sub">{r.laneTeam}</span>
        </span>
      ),
    },
  ]

  return (
    <>
      <p className="data-note">
        <strong>Zwei verschiedene Zeiten.</strong> Die <em>Standzeit</em> ist die Zeit am Auto –
        die bekannten rund zwei Sekunden. Sie hängt nur an der Mannschaft und ist darum über
        Strecken hinweg vergleichbar. Die <em>Zeit in der Boxengasse</em> umfasst den ganzen Weg
        von der Ein- bis zur Ausfahrt; sie hängt an der Länge der Boxengasse und an der
        Rennsituation – unter Safety Car fällt sie deutlich kürzer aus, Rotphasen dauern Minuten.
        Sie steht deshalb nur je Rennen und immer neben dem Median desselben Rennens, nie als
        Saisonrekord.
      </p>

      {data.source === 'jolpica' && (
        <p className="data-note">
          <strong>Keine Standzeiten für diese Saison.</strong> Sie kommen von OpenF1, das erst ab
          2023 Daten führt. Für ältere Saisons bleibt nur die Zeit in der Boxengasse.
        </p>
      )}

      {data.failed.length > 0 && (
        <p className="error">
          {data.failed.length} von {data.failed.length + stats.races}{' '}
          {data.failed.length === 1 ? 'Rennen war' : 'Rennen waren'} nicht abrufbar (Runde{' '}
          {data.failed.join(', ')}). Die Auswertung lässt{' '}
          {data.failed.length === 1 ? 'es' : 'sie'} aus.
        </p>
      )}

      <dl className="tiles">
        {hasStill && stats.bestStill && (
          <div className="tile tile-wide" style={{ '--i': 0 } as React.CSSProperties}>
            <dt>Schnellste Standzeit der Saison</dt>
            <dd>
              <span className="tile-value">{seconds(stats.bestStill.still, 2)}</span>
              <span className="tile-note">
                {stats.bestStill.driver} · {stats.bestStill.team} · {stats.bestStill.raceName},
                Rennrunde {stats.bestStill.lap}
              </span>
              <span className="tile-note">
                Median aller Standzeiten: {stats.stillMedian ? seconds(stats.stillMedian, 2) : '–'}{' '}
                · Grundlage: {data.withStill} von {data.total} Stopps ({coverage} %)
              </span>
            </dd>
          </div>
        )}
        <div className="tile" style={{ '--i': 1 } as React.CSSProperties}>
          <dt>Rennen ausgewertet</dt>
          <dd>
            <span className="tile-value">{stats.races}</span>
            <span className="tile-note">mit Boxenstopp-Daten</span>
          </dd>
        </div>
        <div className="tile" style={{ '--i': 2 } as React.CSSProperties}>
          <dt>Stopps gezählt</dt>
          <dd>
            <span className="tile-value">{stats.totalStops.toLocaleString('de-DE')}</span>
            <span className="tile-note">ohne die Rotphasen</span>
          </dd>
        </div>
      </dl>

      <div className="boards">
        <section className="board" style={{ '--i': 0 } as React.CSSProperties}>
          <h4>Boxenstopp-Wertung</h4>
          <p className="board-note">
            Wie oft ein Team den schnellsten Stopp eines Rennens hatte.{' '}
            {stats.rankedBy === 'still'
              ? 'Entschieden nach der Standzeit am Auto.'
              : stats.rankedBy === 'lane'
                ? 'Entschieden nach der Zeit in der Boxengasse, je Rennen verglichen.'
                : 'Je Rennen nach der Standzeit, wo sie vorliegt, sonst nach der Zeit in der Boxengasse.'}
          </p>
          <ol>
            {stats.ranking.slice(0, 10).map((team, i) => (
              <li key={team.id}>
                <span className="board-rank">{i + 1}</span>
                <span className="board-name">
                  {team.team}
                  <span className="board-detail">
                    {team.topThree}× unter den besten drei · {team.races} Rennen
                  </span>
                </span>
                <span
                  className="board-bar"
                  style={
                    {
                      '--w': `${(team.wins / Math.max(1, stats.ranking[0].wins)) * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span className="board-value">{team.wins}</span>
              </li>
            ))}
          </ol>
        </section>

        <Leaderboard
          title="Meiste Boxenstopps"
          note="Häufiges Stoppen heißt nicht langsam – es heißt meist eine andere Reifenstrategie oder einen Schaden."
          ranks={stats.mostStops}
          index={1}
        />
      </div>

      <div className="sub-section">
        <h4>Schnellster Stopp je Rennen</h4>
        <DataTable
          rows={stats.perRace}
          columns={columns}
          rowKey={(r) => String(r.round)}
          empty="Keine auswertbaren Stopps."
          caption="Je Rennen die schnellste Standzeit und die kürzeste Zeit in der Boxengasse, daneben der Median des Rennens"
        />
      </div>
    </>
  )
}
