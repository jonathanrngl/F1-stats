import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { DriverProgression } from './api/jolpica'

/*
 * WM-Verlauf als Liniendiagramm: eine Linie je Fahrer, x = Rennen, y = Punkte.
 *
 * Acht Fahrer bekommen eine eigene Farbe, der Rest laeuft als graue
 * Sammelgruppe mit. Kategoriale Farben werden nie zyklisch weitergedreht – ab
 * Platz neun waere jede weitere Farbe von einer der ersten acht nicht mehr
 * unterscheidbar. Die Farbe haengt am Fahrer, nicht an seinem Rang im Moment.
 */
const W = 900
const H = 440
const PAD = { top: 18, right: 92, bottom: 38, left: 48 }
const NAMED = 8
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

const seriesColor = (index: number) =>
  index < NAMED ? `var(--s${index + 1})` : 'var(--s-rest)'

export interface ChartRound {
  round: number
  name: string
}

export default function ProgressionChart({
  drivers,
  rounds,
}: {
  drivers: DriverProgression[]
  rounds: ChartRound[]
}) {
  const [hoverRound, setHoverRound] = useState<number | null>(null)
  const [soloDriver, setSoloDriver] = useState<string | null>(null)

  const n = rounds.length

  const { yMax, yTicks, xTicks } = useMemo(() => {
    const max = Math.max(1, ...drivers.map((d) => d.total))
    const step = STEPS.find((s) => s >= max / 5) ?? 2000
    const top = Math.ceil(max / step) * step
    const ticks: number[] = []
    for (let v = 0; v <= top; v += step) ticks.push(v)
    // Bei vielen Rennen nur jede k-te Runde beschriften, sonst kleben die Zahlen.
    const every = Math.ceil(n / 12)
    return {
      yMax: top,
      yTicks: ticks,
      xTicks: rounds.filter((r) => r.round % every === 0 || r.round === n),
    }
  }, [drivers, rounds, n])

  const x = (round: number) => PAD.left + (round / n) * PLOT_W
  const y = (points: number) => PAD.top + PLOT_H - (points / yMax) * PLOT_H

  // Runde 0 mit 0 Punkten als Startpunkt: die Linien beginnen auf der Achse.
  const linePath = (points: number[]) =>
    [0, ...points]
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`)
      .join(' ')

  const named = drivers.slice(0, NAMED)

  // Direktlabels nur fuer die Spitze und nur, wo sie sich nicht ueberlagern.
  const endLabels: { driver: DriverProgression; yPos: number; color: string }[] = []
  named.slice(0, 3).forEach((d, i) => {
    const yPos = y(d.total)
    if (endLabels.every((l) => Math.abs(l.yPos - yPos) > 13)) {
      endLabels.push({ driver: d, yPos, color: seriesColor(i) })
    }
  })

  const readout = hoverRound === null
    ? null
    : {
        round: rounds[hoverRound - 1],
        rows: named
          .map((d, i) => ({ driver: d, color: seriesColor(i), value: d.points[hoverRound - 1] ?? 0 }))
          .sort((a, b) => b.value - a.value),
      }

  const pointerRound = (event: ReactPointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    const round = Math.round(ratio * n)
    setHoverRound(Math.min(n, Math.max(1, round)))
  }

  const stepHover = (delta: number) =>
    setHoverRound((prev) => Math.min(n, Math.max(1, (prev ?? 1) + delta)))

  return (
    <div className="chart-wrap">
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Punkteverlauf ueber ${n} Rennen, ${drivers.length} Fahrer. Die vollstaendigen Zahlen stehen in der Fahrerwertung.`}
      >
        {yTicks.map((value) => (
          <g key={value}>
            <line className="grid-line" x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} />
            <text
              className="tick"
              x={PAD.left - 9}
              y={y(value)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {value}
            </text>
          </g>
        ))}

        <line className="axis-line" x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={y(0)} />
        <line className="axis-line" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />

        {xTicks.map((r) => (
          <text key={r.round} className="tick" x={x(r.round)} y={y(0) + 17} textAnchor="middle">
            {r.round}
          </text>
        ))}
        <text className="tick" x={PAD.left + PLOT_W / 2} y={H - 4} textAnchor="middle">
          Rennen
        </text>
        <text className="tick" x={12} y={PAD.top + PLOT_H / 2} textAnchor="middle"
          transform={`rotate(-90 12 ${PAD.top + PLOT_H / 2})`}>
          Punkte
        </text>

        {/* Sammelgruppe zuerst zeichnen, damit die benannten Linien darueber liegen. */}
        {drivers.slice(NAMED).map((d) => (
          <path
            key={d.driverId}
            className={`series rest${soloDriver ? ' faded' : ''}`}
            stroke="var(--s-rest)"
            d={linePath(d.points)}
          />
        ))}

        {named.map((d, i) => (
          <path
            key={d.driverId}
            className={`series${soloDriver && soloDriver !== d.driverId ? ' faded' : ''}`}
            stroke={seriesColor(i)}
            d={linePath(d.points)}
          />
        ))}

        {named.map((d, i) => (
          <circle
            key={d.driverId}
            className={`end-dot${soloDriver && soloDriver !== d.driverId ? ' faded' : ''}`}
            cx={x(n)}
            cy={y(d.total)}
            r={4}
            fill={seriesColor(i)}
          />
        ))}

        {endLabels.map(({ driver, yPos }) => (
          <text
            key={driver.driverId}
            className="end-label"
            x={x(n) + 11}
            y={yPos}
            dominantBaseline="middle"
          >
            {driver.code}
          </text>
        ))}

        {hoverRound !== null && (
          <g pointerEvents="none">
            <line
              className="crosshair"
              x1={x(hoverRound)}
              x2={x(hoverRound)}
              y1={PAD.top}
              y2={y(0)}
            />
            {named.map((d, i) => (
              <circle
                key={d.driverId}
                className="end-dot"
                cx={x(hoverRound)}
                cy={y(d.points[hoverRound - 1] ?? 0)}
                r={4}
                fill={seriesColor(i)}
              />
            ))}
          </g>
        )}

        {/* Trefferflaeche: der Leser zielt auf ein Rennen, nie auf eine 2px-Linie. */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          tabIndex={0}
          aria-label="Rennen mit den Pfeiltasten durchgehen"
          onPointerMove={pointerRound}
          onPointerLeave={() => setHoverRound(null)}
          onFocus={() => setHoverRound(n)}
          onBlur={() => setHoverRound(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') stepHover(1)
            else if (e.key === 'ArrowLeft') stepHover(-1)
            else return
            e.preventDefault()
          }}
        />
      </svg>

      {readout && (
        <div
          className="tooltip"
          style={{
            left: `${(x(readout.round.round) / W) * 100}%`,
            top: 0,
            transform:
              readout.round.round > n * 0.6
                ? 'translateX(calc(-100% - 14px))'
                : 'translateX(14px)',
          }}
        >
          <h3>{readout.round.name}</h3>
          <ol>
            {readout.rows.map((row) => (
              <li key={row.driver.driverId}>
                <span className="key" style={{ background: row.color }} />
                <span className="who">{row.driver.name}</span>
                <span className="val">{row.value}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <ul className="legend">
        {named.map((d, i) => (
          <li
            key={d.driverId}
            onPointerEnter={() => setSoloDriver(d.driverId)}
            onPointerLeave={() => setSoloDriver(null)}
          >
            <span className="key" style={{ background: seriesColor(i) }} />
            <span>{d.name}</span>
            <span className="pts">{d.total}</span>
          </li>
        ))}
        {drivers.length > NAMED && (
          <li>
            <span className="key" style={{ background: 'var(--s-rest)' }} />
            <span>{drivers.length - NAMED} weitere Fahrer</span>
          </li>
        )}
      </ul>
    </div>
  )
}
