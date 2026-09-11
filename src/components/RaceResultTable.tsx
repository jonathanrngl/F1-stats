import type { RaceResult } from '../api/jolpica'
import DataTable, { type Column } from './DataTable'
import { deltaLabel, driverName, isClassified, pointsLabel, positionDelta } from '../lib/format'
import { statusLabel } from '../lib/status'

/*
 * Das Rennergebnis selbst – und die beiden Zahlen, die es erst erzaehlen:
 * der Startplatz daneben und die Differenz dazu. Ohne sie sieht ein siebter
 * Platz gleich aus, ob er von Startplatz zwei oder von Startplatz achtzehn kam.
 */

export default function RaceResultTable({
  results,
  caption,
  empty,
}: {
  results: RaceResult[]
  caption: string
  empty: string
}) {
  const columns: Column<RaceResult>[] = [
    {
      key: 'pos',
      label: 'Platz',
      shortLabel: '#',
      sortBy: (r) => Number(r.position) || 999,
      render: (r) => (
        <span className={isClassified(r.positionText) ? 'pos' : 'pos out'}>{r.positionText}</span>
      ),
    },
    {
      key: 'driver',
      label: 'Fahrer',
      sortBy: (r) => r.Driver.familyName,
      render: (r) => (
        <span className="name">
          {driverName(r.Driver)}
          {r.FastestLap?.rank === '1' && (
            <abbr className="badge-fl" title={`Schnellste Rennrunde: ${r.FastestLap.Time.time}`}>
              SR
            </abbr>
          )}
        </span>
      ),
    },
    {
      key: 'team',
      label: 'Team',
      sortBy: (r) => r.Constructor.name,
      render: (r) => r.Constructor.name,
    },
    {
      key: 'grid',
      label: 'Start',
      num: true,
      defaultDir: 'asc',
      // Startplatz 0 heisst in den Daten: aus der Boxengasse losgefahren.
      sortBy: (r) => Number(r.grid) || 99,
      render: (r) => (Number(r.grid) ? r.grid : <abbr title="Aus der Boxengasse">Box</abbr>),
    },
    {
      key: 'delta',
      label: 'Plätze',
      shortLabel: 'Δ',
      num: true,
      sortBy: (r) => positionDelta(r.grid, r.position) ?? -99,
      render: (r) => {
        const delta = positionDelta(r.grid, r.position)
        if (delta === null) return ''
        const tone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
        return <span className={`delta ${tone}`}>{deltaLabel(delta)}</span>
      },
    },
    {
      key: 'laps',
      label: 'Runden',
      shortLabel: 'Rd.',
      num: true,
      secondary: true,
      sortBy: (r) => Number(r.laps),
      render: (r) => r.laps,
    },
    {
      key: 'time',
      // Beim Sieger die absolute Zeit, bei allen anderen der Rueckstand auf ihn,
      // bei Ausfaellen der Grund – eine Spalte, drei Bedeutungen, wie im Livetiming.
      label: 'Zeit / Grund',
      render: (r) =>
        r.Time ? (
          <span className="time">{r.Time.time}</span>
        ) : (
          <span className="muted-cell">{statusLabel(r.status)}</span>
        ),
    },
    {
      key: 'points',
      label: 'Punkte',
      shortLabel: 'Pkt.',
      num: true,
      sortBy: (r) => Number(r.points),
      render: (r) =>
        Number(r.points) > 0 ? (
          <strong>{pointsLabel(Number(r.points))}</strong>
        ) : (
          <span className="zero">0</span>
        ),
    },
  ]

  return (
    <DataTable
      rows={results}
      columns={columns}
      rowKey={(r) => r.Driver.driverId}
      rowClass={(r) => (Number(r.position) <= 3 && isClassified(r.positionText) ? `podium p${r.position}` : '')}
      empty={empty}
      caption={caption}
    />
  )
}
