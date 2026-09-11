import DataTable, { type Column } from './DataTable'
import { pointsLabel } from '../lib/format'
import { nationCode, nationName } from '../lib/nationality'

/*
 * Fahrer- und Konstrukteurswertung teilen sich diese Tabelle; sie
 * unterscheiden sich nur in der Team-Spalte.
 */

export interface StandingRow {
  key: string
  position: string
  name: string
  detail: string
  nationality: string
  points: number
  wins: number
}

export default function StandingsTable({
  rows,
  detailLabel,
  empty,
  caption,
}: {
  rows: StandingRow[]
  detailLabel: string
  empty: string
  caption: string
}) {
  // Bezug fuer die Balkenbreite ist der Spitzenwert, nicht die Punktsumme:
  // gefragt ist der Abstand zur Spitze, nicht der Anteil am Ganzen.
  const top = Math.max(1, ...rows.map((r) => r.points))

  const columns: Column<StandingRow>[] = [
    {
      key: 'pos',
      label: 'Platz',
      shortLabel: '#',
      sortBy: (r) => Number(r.position) || 999,
      render: (r) => <span className="pos">{r.position}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      sortBy: (r) => r.name,
      render: (r) => <span className="name">{r.name}</span>,
    },
    ...(detailLabel
      ? [
          {
            key: 'detail',
            label: detailLabel,
            sortBy: (r: StandingRow) => r.detail,
            render: (r: StandingRow) => r.detail,
          },
        ]
      : []),
    {
      key: 'nat',
      label: 'Nationalität',
      shortLabel: 'Nat.',
      secondary: true,
      sortBy: (r) => nationName(r.nationality),
      render: (r) => (
        <span className="nation">
          {nationCode(r.nationality) && (
            <span className="nation-code">{nationCode(r.nationality)}</span>
          )}
          <span className="nation-name">{nationName(r.nationality)}</span>
        </span>
      ),
    },
    {
      key: 'points',
      label: 'Punkte',
      shortLabel: 'Pkt.',
      num: true,
      sortBy: (r) => r.points,
      render: (r) => (
        <span className="bar-cell">
          <span className="bar-value">{pointsLabel(r.points)}</span>
          <span
            className="bar"
            style={{ '--w': `${(r.points / top) * 100}%` } as React.CSSProperties}
          />
        </span>
      ),
    },
    {
      key: 'wins',
      label: 'Siege',
      num: true,
      sortBy: (r) => r.wins,
      render: (r) => (r.wins > 0 ? r.wins : <span className="zero">0</span>),
    },
  ]

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.key}
      rowClass={(r) => (Number(r.position) <= 3 ? `podium p${r.position}` : '')}
      empty={empty}
      caption={caption}
    />
  )
}
