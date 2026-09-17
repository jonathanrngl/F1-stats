import { useMemo } from 'react'
import type { DriverProgression } from './api/jolpica'
import type { TitleVerdict } from './analysis'
import SeasonChart, { type ChartRound, type ChartSeries } from './SeasonChart'

/*
 * Titelkampf: die Meisterschaft als Frage, nicht als Tabelle.
 *
 * Der Punkteverlauf zeigt, wer wie viel gesammelt hat. Er zeigt nicht, ob das
 * Rennen um den Titel noch läuft. Hier steht deshalb der Rückstand zur Spitze –
 * eine Linie, die nach unten wegläuft, ist ein erledigter Titelkampf – und die
 * Runde, nach der rechnerisch nichts mehr zu holen war.
 */

export default function TitleRace({
  verdict,
  progression,
  rounds,
  pending,
  dropped = false,
}: {
  verdict: TitleVerdict
  progression: DriverProgression[]
  rounds: ChartRound[]
  /** Noch nicht alle Runden geladen: dann steht der Befund noch nicht fest. */
  pending?: { done: number; total: number }
  /** Saison mit Streichresultaten – die Entscheidung fiel dann früher als gerechnet. */
  dropped?: boolean
}) {
  // Rückstand je Runde auf den, der zu diesem Zeitpunkt führte.
  const series = useMemo<ChartSeries[]>(() => {
    const n = rounds.length
    const leaderAt: number[] = []
    for (let i = 0; i < n; i++) {
      leaderAt.push(Math.max(0, ...progression.map((d) => d.points[i] ?? 0)))
    }
    return progression.map((d) => {
      const values = leaderAt.map((lead, i) => lead - (d.points[i] ?? 0))
      return {
        id: d.driverId,
        code: d.code,
        name: d.name,
        values,
        last: values.at(-1) ?? 0,
      }
    })
  }, [progression, rounds.length])

  const decidedRace = verdict.decidedRound
    ? rounds.find((r) => r.round === verdict.decidedRound)
    : undefined
  const alive = verdict.contenders.filter((c) => c.alive)
  const maxGap = Math.max(1, ...verdict.contenders.map((c) => c.gap))
  const showMath = !pending && verdict.roundsLeft > 0

  return (
    <div className="analysis">
      {/* Solange Runden fehlen, wäre jeder Befund falsch: Nach drei geladenen
          von 24 Rennen ist rechnerisch immer noch alles offen. */}
      <div className={`verdict${pending ? ' pending' : verdict.decidedRound ? ' settled' : ''}`}>
        {pending ? (
          <>
            <b>The title race is still being calculated</b>
            <span>
              {pending.done} of {pending.total} races loaded – the chart grows as they arrive.
            </span>
          </>
        ) : verdict.decidedRound ? (
          <>
            <b>
              {verdict.leader?.name} was confirmed as World Champion after round{' '}
              {verdict.decidedRound}
            </b>
            <span>
              {decidedRace ? `${decidedRace.name} – ` : ''}
              {verdict.totalRounds - verdict.decidedRound === 0
                ? 'decided in the final race of the season'
                : `with ${verdict.totalRounds - verdict.decidedRound} ${
                    verdict.totalRounds - verdict.decidedRound === 1 ? 'race' : 'races'
                  } still to run, the lead could no longer be caught`}
            </span>
          </>
        ) : verdict.roundsLeft > 0 ? (
          <>
            <b>
              The title is still open – {alive.length}{' '}
              {alive.length === 1 ? 'driver can' : 'drivers can'} still win it
            </b>
            <span>
              {verdict.roundsLeft} {verdict.roundsLeft === 1 ? 'race' : 'races'} remaining, worth
              at most {verdict.pointsLeft} points. {verdict.leader?.name} leads.
            </span>
          </>
        ) : (
          <>
            <b>{verdict.leader?.name} won the title in the final race</b>
            <span>Right to the end, the lead was never enough to settle the matter earlier.</span>
          </>
        )}
      </div>

      {dropped && !pending && (
        <p className="note">
          In this season not every result counted towards the championship: only a driver's best
          races went into the standings, the rest were dropped. The calculation above does not
          know that rule and assumes every point counts – so it dates the decision too late
          rather than too early. In 1988, for instance, Senna was already confirmed in Japan,
          because Prost's surplus points would have been dropped anyway.
        </p>
      )}

      <section className="block">
        <header>
          <h3>Gap to the leader</h3>
          <p>
            The gap to whoever led after each race. Zero at the top means leading the championship –
            a line running away downwards is out of the title fight.
          </p>
        </header>
        <SeasonChart series={series} rounds={rounds} yLabel="Gap" invert />
      </section>

      <section className="block">
        <header>
          <h3>{showMath ? 'The title arithmetic' : pending ? 'Standings so far' : 'Final standings'}</h3>
          {showMath && (
            <p>
              Best case means winning all {verdict.roundsLeft} remaining races, sprint and
              fastest lap included. A driver who still could not reach the top is out.
            </p>
          )}
        </header>
        <ul className="bars contenders">
          {verdict.contenders.map((c) => (
            <li key={c.driver.driverId} className={showMath && !c.alive ? 'out' : ''}>
              <span className="bar-name">
                <span className="code">{c.driver.code}</span>
                {c.driver.name}
              </span>
              <span className="bar-track">
                {/* Rot heißt „aus dem Titelkampf“ – das ist nur eine Aussage,
                    solange noch gefahren wird. Im Endstand bliebe sonst das
                    halbe Feld rot markiert, obwohl da nichts mehr zu verlieren
                    war: dort steht der Meister in Grün, der Rest neutral. */}
                <i
                  className={showMath ? (c.alive ? 'up' : 'down') : c.gap === 0 ? 'up' : 'neutral'}
                  style={{ width: `${100 - (c.gap / maxGap) * 100}%` }}
                />
              </span>
              <span className="bar-value">
                {c.gap === 0 ? 'leads' : `−${c.gap}`}
                {showMath && <em>{c.alive ? `up to ${c.maxPossible}` : 'out'}</em>}
              </span>
            </li>
          ))}
        </ul>
        {!pending && (
          <p className="foot">
            The maximum per race weekend is taken from the season itself – the highest race
            score plus the sprint bonus on sprint weekends. A points tie is settled by the number
            of wins; this calculation therefore treats a tie as still
            undecided.
          </p>
        )}
      </section>
    </div>
  )
}
