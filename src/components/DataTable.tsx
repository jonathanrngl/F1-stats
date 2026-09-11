import { useMemo, useState, type ReactNode } from 'react'

/*
 * Eine Tabelle fuer alle vier Ansichten: Sortierung, klebender Kopf und der
 * gestaffelte Einlauf der Zeilen stehen dadurch nur einmal hier.
 *
 * Der Klick auf eine Spalte laeuft im Dreierschritt: Vorzugsrichtung, Gegen-
 * richtung, wieder die Reihenfolge der Quelle. Der dritte Klick ist wichtiger,
 * als er klingt – die Reihenfolge des Rennergebnisses ist selbst eine Aussage,
 * und ohne Rueckweg waere sie nach einem Sortierklick verloren.
 */

export interface Column<T> {
  key: string
  label: string
  /** Kurzform fuer den Spaltenkopf auf schmalen Schirmen. */
  shortLabel?: string
  /** Rechts ausgerichtet und mit Tabellenziffern gesetzt. */
  num?: boolean
  /** Ohne diese Funktion ist die Spalte nicht sortierbar. */
  sortBy?: (row: T) => number | string
  /** Richtung des ersten Klicks. Zahlen fangen absteigend an, Text aufsteigend. */
  defaultDir?: Dir
  /** Beiwerk: faellt unter 40rem aus der Tabelle. */
  secondary?: boolean
  render: (row: T) => ReactNode
}

type Dir = 'asc' | 'desc'
type Sort = { key: string; dir: Dir } | null

export default function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowClass,
  empty,
  caption,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  rowClass?: (row: T, index: number) => string
  empty: string
  caption: string
}) {
  const [sort, setSort] = useState<Sort>(null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortBy) return rows
    const pick = column.sortBy
    const factor = sort.dir === 'asc' ? 1 : -1
    // Kopie: die Quellreihenfolge bleibt erhalten, sonst gibt es keinen Rueckweg.
    return [...rows].sort((a, b) => {
      const x = pick(a)
      const y = pick(b)
      if (typeof x === 'number' && typeof y === 'number') {
        // Fehlende Zahlen (kein Ergebnis, keine Zeit) immer nach hinten.
        if (Number.isNaN(x)) return 1
        if (Number.isNaN(y)) return -1
        return (x - y) * factor
      }
      return String(x).localeCompare(String(y), 'de') * factor
    })
  }, [rows, columns, sort])

  const toggle = (column: Column<T>) => {
    const first = column.defaultDir ?? (column.num ? 'desc' : 'asc')
    setSort((prev) => {
      if (prev?.key !== column.key) return { key: column.key, dir: first }
      if (prev.dir === first) return { key: column.key, dir: first === 'asc' ? 'desc' : 'asc' }
      return null
    })
  }

  if (rows.length === 0) return <p className="status">{empty}</p>

  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  className={[c.num ? 'num' : '', c.secondary ? 'secondary' : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {c.sortBy ? (
                    <button
                      type="button"
                      className={`sorter${active ? ' active' : ''}`}
                      onClick={() => toggle(c)}
                      title={`Nach ${c.label} sortieren`}
                    >
                      <span className="full">{c.label}</span>
                      {c.shortLabel && <span className="short">{c.shortLabel}</span>}
                      <span className="arrow" aria-hidden="true">
                        {active ? (sort.dir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
                      </span>
                    </button>
                  ) : (
                    <>
                      <span className="full">{c.label}</span>
                      {c.shortLabel && <span className="short">{c.shortLabel}</span>}
                    </>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={rowKey(row)}
              className={rowClass?.(row, i)}
              // Der Einlauf staffelt sich, laeuft aber nach 16 Zeilen synchron
              // weiter: sonst warten lange Tabellen sichtbar auf sich selbst.
              style={{ '--i': Math.min(i, 16) } as React.CSSProperties}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={[c.num ? 'num' : '', c.secondary ? 'secondary' : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
