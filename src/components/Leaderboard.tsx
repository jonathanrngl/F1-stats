import type { Rank } from '../lib/seasonStats'

/*
 * Eine Bestenliste: Rang, Name, Balken, Zahl.
 *
 * Der Balken bezieht sich immer auf den Spitzenwert dieser einen Liste, nicht
 * auf eine über alle Listen gemeinsame Skala – zwischen "Siege" und
 * "gutgemachte Plätze" gibt es keine gemeinsame Einheit, ein geteilter
 * Maßstab würde eine Vergleichbarkeit behaupten, die nicht besteht.
 */
export default function Leaderboard({
  title,
  note,
  ranks,
  unit,
  index = 0,
}: {
  title: string
  note?: string
  ranks: Rank[]
  unit?: string
  index?: number
}) {
  if (ranks.length === 0) return null
  const top = Math.max(1, ...ranks.map((r) => r.value))

  return (
    <section className="board" style={{ '--i': index } as React.CSSProperties}>
      <h4>{title}</h4>
      {note && <p className="board-note">{note}</p>}
      <ol>
        {ranks.map((r, i) => (
          <li key={r.id}>
            <span className="board-rank">{i + 1}</span>
            <span className="board-name">
              {r.name}
              {r.detail && <span className="board-detail">{r.detail}</span>}
            </span>
            <span
              className="board-bar"
              style={{ '--w': `${(r.value / top) * 100}%` } as React.CSSProperties}
            />
            <span className="board-value">
              {r.value.toLocaleString('de-DE')}
              {unit && <span className="board-unit">{unit}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
