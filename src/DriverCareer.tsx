import { useMemo } from 'react'
import type { CareerRace, DriverInfo, SeasonStanding } from './api/jolpica'
import { careerBySeason, careerTotals } from './analysis'
import { nation } from './nations'

/*
 * Die Karriere eines Fahrers auf einer Seite.
 *
 * Zwei Quellen mit unterschiedlichem Preis: Die Rennergebnisse kosten drei bis
 * fünf Anfragen und tragen alles, was aus Rennen ableitbar ist. Die
 * Meisterschaftsplätze kosten eine Anfrage je Saison und kommen deshalb
 * nachgeladen – sie sind aber die einzige Quelle, die Streichresultate kennt
 * und damit die Titelzahl richtig stellt.
 */

const zahl = (v: number) => v.toLocaleString('en-GB')
const eine = (v: number) => v.toFixed(1)
const quote = (teil: number, ganz: number) =>
  ganz > 0 ? `${((teil / ganz) * 100).toFixed(0)}%` : '–'

export default function DriverCareer({
  driver,
  races,
  standings,
  pending,
}: {
  driver: DriverInfo
  races: CareerRace[]
  /** WM-Endstände je Saison, sobald geladen – Schlüssel ist das Jahr. */
  standings: Map<string, SeasonStanding>
  pending?: { done: number; total: number }
}) {
  const t = useMemo(() => careerTotals(races), [races])
  const saisons = useMemo(() => careerBySeason(races), [races])
  const n = nation(driver.nationality)

  const titel = [...standings.values()].filter((s) => s.position === 1).length
  const podestJahre = [...standings.values()].filter(
    (s) => s.position !== null && s.position <= 3,
  ).length
  const wmPunkte = [...standings.values()].reduce((sum, s) => sum + s.points, 0)
  const vollstaendig = standings.size >= saisons.length && saisons.length > 0

  // Die Balken der Saisontabelle beziehen sich auf die beste Saison.
  const maxPunkte = Math.max(1, ...saisons.map((s) => s.racePoints))

  if (races.length === 0 && !pending) {
    return (
      <p className="status">
        No race results are available for {driver.givenName} {driver.familyName}.
      </p>
    )
  }

  return (
    <div className="analysis">
      <header className="fahrer-kopf">
        <span className="code gross" title={n.name}>
          {n.code}
        </span>
        <div>
          <h2>
            {driver.givenName} {driver.familyName}
          </h2>
          <p>
            {n.name}
            {driver.dateOfBirth && <> · born {new Date(driver.dateOfBirth).toLocaleDateString('en-GB')}</>}
            {t.seasonCount > 0 && (
              <>
                {' · '}
                {t.firstSeason === t.lastSeason
                  ? t.firstSeason
                  : `${t.firstSeason}–${t.lastSeason}`}{' '}
                ({t.seasonCount} {t.seasonCount === 1 ? 'season' : 'seasons'})
              </>
            )}
          </p>
        </div>
      </header>

      <ul className="tiles">
        <Tile value={zahl(t.starts)} label="Starts" />
        <Tile value={zahl(t.wins)} label="Wins" hint={quote(t.wins, t.starts) + ' of starts'} />
        <Tile value={zahl(t.podiums)} label="Podiums" hint={quote(t.podiums, t.starts)} />
        <Tile value={zahl(t.fromPole)} label="From P1 on the grid" />
        <Tile
          value={vollstaendig ? zahl(titel) : '–'}
          label="World Championships"
          hint={vollstaendig ? undefined : 'loading'}
        />
        <Tile
          value={t.bestFinish === null ? '–' : `P${t.bestFinish}`}
          label="Best finish"
          hint={t.avgFinish === null ? undefined : `Avg P${eine(t.avgFinish)}`}
        />
      </ul>

      {pending && (
        <div className="status">
          Loading championship positions … {pending.done} of {pending.total} seasons
          <div className="progress">
            <i style={{ width: `${pending.total ? (pending.done / pending.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <section className="block">
        <header>
          <h3>Season by season</h3>
          <p>
            Championship position and championship points come from the championship standings,
            everything else from the race results. Until 1990 only a driver’s best results in a
            season counted – for those years the championship points sit below the sum of the race
            points.
          </p>
        </header>
        <div className="table-scroll">
          <table className="compact">
            <thead>
              <tr>
                <th>Season</th>
                <th className="hide-sm">Team</th>
                <th className="num">Races</th>
                <th className="num">Wins</th>
                <th className="num hide-sm">Podiums</th>
                <th className="num hide-sm">Best</th>
                <th className="num">Championship</th>
                <th className="num">Points</th>
              </tr>
            </thead>
            <tbody>
              {saisons.map((s) => {
                const st = standings.get(s.season)
                return (
                  <tr key={s.season}>
                    <td className="name">{s.season}</td>
                    <td className="hide-sm muted">{s.teams.join(', ')}</td>
                    <td className="num">{s.races}</td>
                    <td className="num">{s.wins || ''}</td>
                    <td className="num hide-sm">{s.podiums || ''}</td>
                    <td className="num hide-sm">{s.bestFinish === null ? '–' : `P${s.bestFinish}`}</td>
                    <td className={`num${st?.position === 1 ? ' meister' : ''}`}>
                      {st ? (st.position === null ? '–' : `P${st.position}`) : '…'}
                    </td>
                    <td className="num points">
                      {/* Balken hinter der Zahl: der Verlauf einer Karriere wird
                          in der Spalte sichtbar, ohne einen zweiten Graphen. */}
                      <span className="saison-balken">
                        <i style={{ width: `${(s.racePoints / maxPunkte) * 100}%` }} />
                        <b>{st ? zahl(st.points) : zahl(s.racePoints)}</b>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {vollstaendig && (
          <p className="foot">
            Championship points across the career: {zahl(wmPunkte)}
            {podestJahre > 0 && <> · {podestJahre}× in the top three of the championship</>}
          </p>
        )}
      </section>

      <section className="block">
        <header>
          <h3>Career numbers</h3>
        </header>
        <ul className="daten">
          <Datum k="Classified races" v={`${zahl(t.classified)} of ${zahl(t.starts)} (${quote(t.classified, t.starts)})`} />
          <Datum k="Not classified" v={`${zahl(t.retired)} (${quote(t.retired, t.starts)})`} />
          <Datum k="Races in the points" v={`${zahl(t.scoring)} (${quote(t.scoring, t.starts)})`} />
          <Datum
            k="Fastest laps"
            v={t.fastestLapsKnown ? zahl(t.fastestLaps) : 'not recorded'}
          />
          <Datum k="Avg grid position" v={t.avgGrid === null ? '–' : eine(t.avgGrid)} />
          <Datum k="Avg finish" v={t.avgFinish === null ? '–' : eine(t.avgFinish)} />
          <Datum k="Points scored in races" v={zahl(t.racePoints)} />
          <Datum
            k="Teams"
            v={t.teams
              .map((x) =>
                x.seasons.length === 1
                  ? `${x.name} (${x.seasons[0]})`
                  : `${x.name} (${x.seasons[0]}–${x.seasons[x.seasons.length - 1]})`,
              )
              .join(', ')}
          />
        </ul>
        <p className="foot">
          “From P1 on the grid” is not the same as a pole position: grid penalties move a driver
          away from the slot his qualifying time earned him. For the early decades the two
          coincide – that is how Fangio arrives at his 29 and Senna at his 65 – but from the 2010s
          they come apart. What is counted throughout is the grid position, because that is the
          only one of the two recorded since 1950.
          {!t.fastestLapsKnown &&
            ' The data source carries fastest laps only from 2004 onwards; for this career none are recorded.'}
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

function Datum({ k, v }: { k: string; v: string }) {
  return (
    <li>
      <span>{k}</span>
      <b>{v}</b>
    </li>
  )
}
