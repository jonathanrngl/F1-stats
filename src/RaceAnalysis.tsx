import { useMemo } from 'react'
import type { RaceResults } from './api/jolpica'
import { driverRaceStats, retirementReasons, teamDuels } from './analysis'
import { nation } from './nations'

/*
 * Rennanalyse: was die Wertungstabelle nicht zeigt.
 *
 * Die Punktetabelle sagt, wer vorn steht. Sie sagt nicht, wer sein Auto
 * geschlagen hat, wer im Rennen Plätze gewinnt statt sie zu verwalten und wen
 * die Technik im Stich ließ. Genau das steht hier – alles aus den
 * Rennergebnissen der Saison, ohne eine einzige zusätzliche Anfrage pro Rennen.
 */

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
const one = (v: number) => v.toFixed(1).replace('.', ',')

export default function RaceAnalysis({ races }: { races: RaceResults[] }) {
  const stats = useMemo(() => driverRaceStats(races), [races])
  const duels = useMemo(() => teamDuels(races), [races])
  const reasons = useMemo(() => retirementReasons(races), [races])

  const entries = stats.reduce((n, s) => n + s.entries, 0)
  const retired = stats.reduce((n, s) => n + s.retired, 0)
  const winners = stats.filter((s) => s.wins > 0).length
  const polesitters = stats.filter((s) => s.poles > 0).length

  // Plätze gutgemacht: nur Fahrer mit genug Vergleichsrennen, sonst führt ein
  // einzelnes Rennen die Liste an.
  const movers = useMemo(
    () =>
      stats
        .filter((s) => s.gainRaces >= Math.min(3, races.length))
        .sort((a, b) => b.placesGained - a.placesGained),
    [stats, races.length],
  )
  const moverMax = Math.max(1, ...movers.map((s) => Math.abs(s.placesGained)))

  const reliability = useMemo(
    () =>
      stats
        .filter((s) => s.entries >= Math.min(3, races.length))
        .sort((a, b) => pct(b.classified, b.entries) - pct(a.classified, a.entries)),
    [stats, races.length],
  )

  if (races.length === 0) {
    return <p className="status">Für diese Saison liegen keine Rennergebnisse vor.</p>
  }

  return (
    <div className="analysis">
      <ul className="tiles">
        <Tile value={String(races.length)} label="Rennen" />
        <Tile value={String(winners)} label={winners === 1 ? 'Sieger' : 'verschiedene Sieger'} />
        <Tile value={String(polesitters)} label="Polesetter" />
        <Tile
          value={`${Math.round(pct(retired, entries))} %`}
          label="Antritte ohne Wertung"
          hint={`${retired} von ${entries}`}
        />
      </ul>

      <section className="block">
        <header>
          <h3>Teamduell</h3>
          <p>
            Gleiches Auto, zwei Fahrer – die einzige halbwegs faire Gegenüberstellung. Gezählt
            wird nur, wo beide ins Ziel kamen; ein Ausfall sagt nichts über den Zweikampf.
          </p>
        </header>
        <ul className="duels">
          {duels.map((d) => (
            <li key={d.constructorId}>
              <span className="team">{d.team}</span>
              <div className="duel-row">
                <span className="duel-name left">{d.a.name}</span>
                <span className="duel-score">
                  <b className={d.a.races > d.b.races ? 'lead' : ''}>{d.a.races}</b>
                  <i>:</i>
                  <b className={d.b.races > d.a.races ? 'lead' : ''}>{d.b.races}</b>
                </span>
                <span className="duel-name right">{d.b.name}</span>
              </div>
              <div
                className="duel-bar"
                role="img"
                aria-label={`Rennduelle ${d.a.name} ${d.a.races}, ${d.b.name} ${d.b.races}`}
              >
                <i style={{ width: `${pct(d.a.races, d.raceDuels)}%` }} />
              </div>
              <span className="duel-note">
                {d.raceDuels} Rennduelle
                {d.gridDuels > 0 && (
                  <>
                    {' · Startplatz '}
                    {d.a.grids}:{d.b.grids}
                  </>
                )}
                {' · Punkte '}
                {d.a.points}:{d.b.points}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <header>
          <h3>Startplatz zu Ziel</h3>
          <p>
            Summe aus Startplatz minus Zielposition über alle gewerteten Rennen. Wer oben steht,
            holt im Rennen mehr heraus, als die Qualifikation hergab.
          </p>
        </header>
        <ul className="bars diverging">
          {movers.map((s) => (
            <li key={s.driverId}>
              <span className="bar-name">
                <span className="code">{s.code}</span>
                {s.name}
              </span>
              <span className="bar-track">
                <i
                  className={s.placesGained >= 0 ? 'up' : 'down'}
                  style={{
                    width: `${(Math.abs(s.placesGained) / moverMax) * 50}%`,
                    [s.placesGained >= 0 ? 'left' : 'right']: '50%',
                  }}
                />
              </span>
              <span className="bar-value">
                {s.placesGained > 0 ? '+' : ''}
                {s.placesGained}
              </span>
            </li>
          ))}
        </ul>
        <p className="foot">
          Ø Startplatz und Ø Ziel je Fahrer stehen in der Tabelle unten.
        </p>
      </section>

      <section className="block">
        <header>
          <h3>Zuverlässigkeit</h3>
          <p>Anteil der Antritte, die in der Wertung endeten.</p>
        </header>
        <ul className="bars">
          {reliability.map((s) => (
            <li key={s.driverId}>
              <span className="bar-name">
                <span className="code">{s.code}</span>
                {s.name}
              </span>
              <span className="bar-track">
                <i className="up" style={{ width: `${pct(s.classified, s.entries)}%` }} />
              </span>
              <span className="bar-value">
                {s.classified}/{s.entries}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {reasons.length > 0 && (
        <section className="block">
          <header>
            <h3>Ausfallgründe</h3>
            <p>
              Für die jüngeren Jahre fasst die API den Grund zu „Aufgegeben“ zusammen, ältere
              Saisons nennen ihn genau.
            </p>
          </header>
          <ul className="chips">
            {reasons.slice(0, 16).map((r) => (
              <li key={r.reason}>
                {r.reason} <b>{r.count}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <header>
          <h3>Alle Fahrer</h3>
        </header>
        <div className="table-scroll">
          <table className="compact">
            <thead>
              <tr>
                <th>Fahrer</th>
                <th className="hide-sm">Team</th>
                <th className="num">Starts</th>
                <th className="num hide-sm">Ø Start</th>
                <th className="num">Ø Ziel</th>
                <th className="num hide-sm">Siege</th>
                <th className="num hide-sm">Podien</th>
                <th className="num">Punkte</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.driverId}>
                  <td className="name">
                    <span className="code" title={nation(s.nationality).name}>
                      {nation(s.nationality).code}
                    </span>
                    {s.name}
                  </td>
                  <td className="hide-sm muted">{s.team}</td>
                  <td className="num">{s.entries}</td>
                  <td className="num hide-sm">{s.avgGrid === null ? '–' : one(s.avgGrid)}</td>
                  <td className="num">{s.avgFinish === null ? '–' : one(s.avgFinish)}</td>
                  <td className="num hide-sm">{s.wins}</td>
                  <td className="num hide-sm">{s.podiums}</td>
                  <td className="num points">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="foot">
          Ø Ziel zählt nur gewertete Rennen. Punkte sind die im Rennen erzielten – bis 1990
          gingen nicht alle davon in die Meisterschaft ein.
        </p>
      </section>
    </div>
  )
}

function Tile({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <li className="tile">
      <b>{value}</b>
      <span>{label}</span>
      {hint && <i>{hint}</i>}
    </li>
  )
}
