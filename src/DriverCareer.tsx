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

const zahl = (v: number) => v.toLocaleString('de-DE')
const eine = (v: number) => v.toFixed(1).replace('.', ',')
const quote = (teil: number, ganz: number) =>
  ganz > 0 ? `${((teil / ganz) * 100).toFixed(0)} %` : '–'

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
        Für {driver.givenName} {driver.familyName} liegen keine Rennergebnisse vor.
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
            {driver.dateOfBirth && <> · geboren {new Date(driver.dateOfBirth).toLocaleDateString('de-DE')}</>}
            {t.seasonCount > 0 && (
              <>
                {' · '}
                {t.firstSeason === t.lastSeason
                  ? t.firstSeason
                  : `${t.firstSeason}–${t.lastSeason}`}{' '}
                ({t.seasonCount} {t.seasonCount === 1 ? 'Saison' : 'Saisons'})
              </>
            )}
          </p>
        </div>
      </header>

      <ul className="tiles">
        <Tile value={zahl(t.starts)} label="Starts" />
        <Tile value={zahl(t.wins)} label="Siege" hint={quote(t.wins, t.starts) + ' der Starts'} />
        <Tile value={zahl(t.podiums)} label="Podien" hint={quote(t.podiums, t.starts)} />
        <Tile value={zahl(t.fromPole)} label="Von Startplatz 1" />
        <Tile
          value={vollstaendig ? zahl(titel) : '–'}
          label={titel === 1 ? 'WM-Titel' : 'WM-Titel'}
          hint={vollstaendig ? undefined : 'lädt'}
        />
        <Tile
          value={t.bestFinish === null ? '–' : `P${t.bestFinish}`}
          label="Bestes Ergebnis"
          hint={t.avgFinish === null ? undefined : `Ø P${eine(t.avgFinish)}`}
        />
      </ul>

      {pending && (
        <div className="status">
          Lade Meisterschaftsplätze … {pending.done} von {pending.total} Saisons
          <div className="progress">
            <i style={{ width: `${pending.total ? (pending.done / pending.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <section className="block">
        <header>
          <h3>Saison für Saison</h3>
          <p>
            WM-Platz und WM-Punkte kommen aus der Meisterschaftswertung, alles übrige aus den
            Rennergebnissen. Bis 1990 zählten nur die besten Ergebnisse einer Saison – dort liegt
            der WM-Stand unter der Summe der Rennpunkte.
          </p>
        </header>
        <div className="table-scroll">
          <table className="compact">
            <thead>
              <tr>
                <th>Saison</th>
                <th className="hide-sm">Team</th>
                <th className="num">Rennen</th>
                <th className="num">Siege</th>
                <th className="num hide-sm">Podien</th>
                <th className="num hide-sm">Bestes</th>
                <th className="num">WM-Platz</th>
                <th className="num">Punkte</th>
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
            Summe der WM-Punkte über die Karriere: {zahl(wmPunkte)}
            {podestJahre > 0 && <> · {podestJahre}× unter den ersten drei der Meisterschaft</>}
          </p>
        )}
      </section>

      <section className="block">
        <header>
          <h3>Zahlen zur Karriere</h3>
        </header>
        <ul className="daten">
          <Datum k="Gewertete Rennen" v={`${zahl(t.classified)} von ${zahl(t.starts)} (${quote(t.classified, t.starts)})`} />
          <Datum k="Ohne Wertung" v={`${zahl(t.retired)} (${quote(t.retired, t.starts)})`} />
          <Datum k="Rennen mit Punkten" v={`${zahl(t.scoring)} (${quote(t.scoring, t.starts)})`} />
          <Datum
            k="Schnellste Rennrunden"
            v={t.fastestLapsKnown ? zahl(t.fastestLaps) : 'nicht überliefert'}
          />
          <Datum k="Ø Startplatz" v={t.avgGrid === null ? '–' : eine(t.avgGrid)} />
          <Datum k="Ø Zielposition" v={t.avgFinish === null ? '–' : eine(t.avgFinish)} />
          <Datum k="Punkte in Rennen" v={zahl(t.racePoints)} />
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
          „Von Startplatz 1“ ist nicht dasselbe wie eine Pole-Position: Strafversetzungen
          verschieben den Startplatz. Für die frühen Jahrzehnte fallen beide zusammen – Fangio
          kommt so auf seine 29, Senna auf seine 65 –, ab den 2010ern gehen sie auseinander.
          Gezählt wird durchgehend der Startplatz, weil nur er seit 1950 überliefert ist.
          {!t.fastestLapsKnown &&
            ' Schnellste Rennrunden führt die Datenquelle erst ab 2004; für diese Karriere liegen sie nicht vor.'}
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
