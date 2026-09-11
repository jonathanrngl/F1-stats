import type { QualifyingResult } from '../api/jolpica'
import DataTable, { type Column } from './DataTable'
import { driverName, gapLabel, lapSeconds } from '../lib/format'

/*
 * Qualifying mit den drei Abschnitten und dem Abstand auf die Bestzeit.
 *
 * Der Abstand bezieht sich bewusst auf die schnellste Runde des ganzen
 * Qualifyings, nicht auf die Bestzeit des jeweiligen Abschnitts: so steht in
 * der Spalte fuer jeden Fahrer dieselbe Bezugsgroesse. Vor 2006 gab es die
 * Abschnitte noch nicht, dann fuellt die API nur Q1.
 */

const best = (r: QualifyingResult) => {
  const times = [r.Q1, r.Q2, r.Q3].map(lapSeconds).filter((s) => !Number.isNaN(s) && s > 0)
  return times.length ? Math.min(...times) : NaN
}

export default function QualifyingTable({
  results,
  caption,
  empty,
}: {
  results: QualifyingResult[]
  caption: string
  empty: string
}) {
  const pole = Math.min(...results.map(best).filter((s) => !Number.isNaN(s)))
  // Saisons ohne K.o.-Qualifying: leere Spalten gar nicht erst anzeigen.
  const hasQ2 = results.some((r) => r.Q2)
  const hasQ3 = results.some((r) => r.Q3)

  const session = (key: 'Q1' | 'Q2' | 'Q3'): Column<QualifyingResult> => ({
    key,
    label: key,
    num: true,
    defaultDir: 'asc',
    sortBy: (r) => {
      const s = lapSeconds(r[key])
      return Number.isNaN(s) || s === 0 ? NaN : s
    },
    render: (r) => r[key] || <span className="zero">–</span>,
  })

  const columns: Column<QualifyingResult>[] = [
    {
      key: 'pos',
      label: 'Platz',
      shortLabel: '#',
      sortBy: (r) => Number(r.position) || 999,
      render: (r) => <span className="pos">{r.position}</span>,
    },
    {
      key: 'driver',
      label: 'Fahrer',
      sortBy: (r) => r.Driver.familyName,
      render: (r) => <span className="name">{driverName(r.Driver)}</span>,
    },
    {
      key: 'team',
      label: 'Team',
      sortBy: (r) => r.Constructor.name,
      render: (r) => r.Constructor.name,
    },
    session('Q1'),
    ...(hasQ2 ? [session('Q2')] : []),
    ...(hasQ3 ? [session('Q3')] : []),
    {
      key: 'gap',
      label: 'Δ Bestzeit',
      shortLabel: 'Δ',
      num: true,
      defaultDir: 'asc',
      sortBy: (r) => best(r) - pole,
      render: (r) => {
        const delta = best(r) - pole
        if (Number.isNaN(delta)) return ''
        return <span className={delta === 0 ? 'delta up' : 'muted-cell'}>{gapLabel(delta)}</span>
      },
    },
  ]

  return (
    <DataTable
      rows={results}
      columns={columns}
      rowKey={(r) => r.Driver.driverId}
      rowClass={(r) => (Number(r.position) <= 3 ? `podium p${r.position}` : '')}
      empty={empty}
      caption={caption}
    />
  )
}
