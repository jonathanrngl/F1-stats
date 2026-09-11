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
            <b>Der Titelkampf wird noch gerechnet</b>
            <span>
              {pending.done} von {pending.total} Rennen geladen – der Graph wächst mit.
            </span>
          </>
        ) : verdict.decidedRound ? (
          <>
            <b>
              {verdict.leader?.name} stand nach Runde {verdict.decidedRound} als Weltmeister fest
            </b>
            <span>
              {decidedRace ? `${decidedRace.name} – ` : ''}
              {verdict.totalRounds - verdict.decidedRound === 0
                ? 'im letzten Rennen der Saison entschieden'
                : `${verdict.totalRounds - verdict.decidedRound} Rennen vor Schluss war der Vorsprung nicht mehr einzuholen`}
            </span>
          </>
        ) : verdict.roundsLeft > 0 ? (
          <>
            <b>
              Der Titel ist offen – {alive.length}{' '}
              {alive.length === 1 ? 'Fahrer kann' : 'Fahrer können'} ihn noch gewinnen
            </b>
            <span>
              Noch {verdict.roundsLeft} {verdict.roundsLeft === 1 ? 'Rennen' : 'Rennen'} mit
              höchstens {verdict.pointsLeft} Punkten. {verdict.leader?.name} führt.
            </span>
          </>
        ) : (
          <>
            <b>{verdict.leader?.name} gewann den Titel im letzten Rennen</b>
            <span>Der Vorsprung reichte bis zum Schluss nicht, um die Sache vorher zu klären.</span>
          </>
        )}
      </div>

      {dropped && !pending && (
        <p className="note">
          In dieser Saison zählten nicht alle Ergebnisse zur Meisterschaft: Nur die besten
          Rennen eines Fahrers gingen in die Wertung ein, der Rest verfiel. Die Rechnung oben
          kennt diese Regel nicht und nimmt an, jeder Punkt zähle – sie datiert die
          Entscheidung deshalb eher zu spät als zu früh. 1988 etwa stand Senna schon in Japan
          fest, weil Prosts Mehrpunkte ohnehin gestrichen worden wären.
        </p>
      )}

      <section className="block">
        <header>
          <h3>Rückstand zur Spitze</h3>
          <p>
            Abstand zum jeweils Führenden nach jedem Rennen. Null oben heißt Tabellenführung –
            wer nach unten wegläuft, ist aus dem Titelkampf heraus.
          </p>
        </header>
        <SeasonChart series={series} rounds={rounds} yLabel="Rückstand" invert />
      </section>

      <section className="block">
        <header>
          <h3>{showMath ? 'Rechnung zum Titel' : pending ? 'Zwischenstand' : 'Endstand'}</h3>
          {showMath && (
            <p>
              Bestfall heißt: alle {verdict.roundsLeft} ausstehenden Rennen gewonnen, samt
              Sprint und schnellster Runde. Wer damit nicht an die Spitze käme, ist raus.
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
                {c.gap === 0 ? 'führt' : `−${c.gap}`}
                {showMath && <em>{c.alive ? `bis ${c.maxPossible}` : 'raus'}</em>}
              </span>
            </li>
          ))}
        </ul>
        {!pending && (
          <p className="foot">
            Die Obergrenze je Rennwochenende kommt aus der Saison selbst – höchste
            Rennpunktzahl plus Sprintbonus an den Sprint-Wochenenden. Bei Punktgleichheit
            entscheidet die Zahl der Siege; die Rechnung hier führt Gleichstand deshalb als
            noch offen.
          </p>
        )}
      </section>
    </div>
  )
}
