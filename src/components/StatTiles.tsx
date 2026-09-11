/*
 * Vier Kennzahlen ueber den Tabellen: was gerade gilt, ohne dass man eine
 * Tabelle lesen muss. Die Zahl traegt die Kachel, das Label steht klein
 * darueber, die Einordnung klein darunter.
 */

export interface Tile {
  label: string
  value: string
  note?: string
}

export default function StatTiles({ tiles }: { tiles: Tile[] }) {
  if (tiles.length === 0) return null

  return (
    <dl className="tiles">
      {tiles.map((t, i) => (
        <div key={t.label} className="tile" style={{ '--i': i } as React.CSSProperties}>
          <dt>{t.label}</dt>
          <dd>
            <span className="tile-value">{t.value}</span>
            {t.note && <span className="tile-note">{t.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
