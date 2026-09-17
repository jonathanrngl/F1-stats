import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

/*
 * Liniendiagramm über eine Saison: eine Linie je Fahrer, x = Rennen.
 * Zwei Ansichten teilen sich den Aufbau – der Punkteverlauf (y = Punkte,
 * aufsteigend) und der Rückstand zur Spitze (y = Abstand, 0 oben).
 *
 * Acht Fahrer bekommen eine eigene Farbe, der Rest läuft als graue
 * Sammelgruppe mit. Kategoriale Farben werden nie zyklisch weitergedreht – ab
 * Platz neun wäre jede weitere Farbe von einer der ersten acht nicht mehr
 * unterscheidbar. Die Farbe hängt am Fahrer, nicht an seinem Rang im Moment.
 *
 * Die Maße kommen aus der gemessenen Breite, nicht aus einer festen viewBox.
 * Eine feste viewBox von 900 skaliert auf einem 360 Pixel breiten Telefon auf
 * 0,4 – aus 11 Pixel Schrift werden dann gut vier, und die Achsen sind nicht
 * mehr zu lesen. Bei Maßstab 1 steht jede Beschriftung in ihrer echten Größe.
 */
const NAMED = 8
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

const seriesColor = (index: number) => (index < NAMED ? `var(--s${index + 1})` : 'var(--s-rest)')

export interface ChartRound {
  round: number
  name: string
}

export interface ChartSeries {
  id: string
  code: string
  name: string
  /** `values[i]` gilt nach Runde i+1. */
  values: number[]
  /** Wert am rechten Rand – bestimmt Endpunkt und Beschriftung. */
  last: number
}

/** Misst die Breite des Containers und meldet jede Änderung. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

export default function SeasonChart({
  series,
  rounds,
  yLabel,
  invert = false,
  emptyLabel = 'No data',
}: {
  series: ChartSeries[]
  rounds: ChartRound[]
  yLabel: string
  /** true: 0 liegt oben, die Werte wachsen nach unten (Rückstand). */
  invert?: boolean
  emptyLabel?: string
}) {
  const [box, width] = useWidth<HTMLDivElement>()
  const [hoverRound, setHoverRound] = useState<number | null>(null)
  const [solo, setSolo] = useState<string | null>(null)

  const n = rounds.length
  const narrow = width > 0 && width < 560

  const geo = useMemo(() => {
    const W = Math.max(300, Math.round(width) || 900)
    const H = narrow ? 300 : 420
    // Auf schmalen Anzeigen entfällt die Beschriftung am Linienende, damit der
    // Zeichenbereich nicht auf die halbe Breite zusammenschrumpft.
    const pad = {
      top: 16,
      right: narrow ? 14 : 84,
      bottom: 36,
      left: narrow ? 34 : 46,
    }
    return { W, H, pad, plotW: W - pad.left - pad.right, plotH: H - pad.top - pad.bottom }
  }, [width, narrow])

  const { yMax, yTicks, xTicks } = useMemo(() => {
    const max = Math.max(1, ...series.flatMap((s) => s.values))
    const step = STEPS.find((s) => s >= max / 5) ?? 2000
    const top = Math.ceil(max / step) * step
    const ticks: number[] = []
    for (let v = 0; v <= top; v += step) ticks.push(v)
    // Bei vielen Rennen nur jede k-te Runde beschriften, sonst kleben die Zahlen.
    const every = Math.ceil(n / (narrow ? 6 : 12))
    return {
      yMax: top,
      yTicks: ticks,
      xTicks: rounds.filter((r) => r.round % every === 0 || r.round === n),
    }
  }, [series, rounds, n, narrow])

  if (n === 0 || series.length === 0) {
    return (
      <div className="chart-wrap" ref={box}>
        <p className="status">{emptyLabel}</p>
      </div>
    )
  }

  const { W, H, pad, plotW, plotH } = geo
  const x = (round: number) => pad.left + (round / n) * plotW
  const y = (value: number) =>
    invert
      ? pad.top + (value / yMax) * plotH
      : pad.top + plotH - (value / yMax) * plotH

  // Runde 0 mit Wert 0 als Startpunkt: die Linien beginnen auf der Achse.
  const linePath = (values: number[]) =>
    [0, ...values]
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ')

  const named = series.slice(0, NAMED)
  const baseline = invert ? pad.top : y(0)

  // Direktlabels nur für die Spitze und nur, wo sie sich nicht überlagern.
  const endLabels: { id: string; code: string; yPos: number }[] = []
  if (!narrow) {
    named.slice(0, 4).forEach((s) => {
      const yPos = y(s.last)
      if (endLabels.every((l) => Math.abs(l.yPos - yPos) > 13)) {
        endLabels.push({ id: s.id, code: s.code, yPos })
      }
    })
  }

  const readout =
    hoverRound === null
      ? null
      : {
          round: rounds[hoverRound - 1],
          rows: named
            .map((s, i) => ({ s, color: seriesColor(i), value: s.values[hoverRound - 1] ?? 0 }))
            .sort((a, b) => (invert ? a.value - b.value : b.value - a.value)),
        }

  const pointerRound = (event: ReactPointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    setHoverRound(Math.min(n, Math.max(1, Math.round(ratio * n))))
  }

  const stepHover = (delta: number) =>
    setHoverRound((prev) => Math.min(n, Math.max(1, (prev ?? n) + delta)))

  return (
    <div className={`chart-wrap${narrow ? ' narrow' : ''}`} ref={box}>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`${yLabel} across ${n} races for ${series.length} drivers. The full figures are in the tables.`}
      >
        {yTicks.map((value) => (
          <g key={value}>
            <line className="grid-line" x1={pad.left} x2={W - pad.right} y1={y(value)} y2={y(value)} />
            <text
              className="tick"
              x={pad.left - 8}
              y={y(value)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {value}
            </text>
          </g>
        ))}

        <line className="axis-line" x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} />
        <line className="axis-line" x1={pad.left} x2={W - pad.right} y1={baseline} y2={baseline} />

        {xTicks.map((r) => (
          <text
            key={r.round}
            className="tick"
            x={x(r.round)}
            y={pad.top + plotH + 16}
            textAnchor="middle"
          >
            {r.round}
          </text>
        ))}
        <text className="tick" x={pad.left + plotW / 2} y={H - 3} textAnchor="middle">
          Rennen
        </text>
        {!narrow && (
          <text
            className="tick"
            x={11}
            y={pad.top + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90 11 ${pad.top + plotH / 2})`}
          >
            {yLabel}
          </text>
        )}

        {/* Sammelgruppe zuerst zeichnen, damit die benannten Linien darüber liegen. */}
        {series.slice(NAMED).map((s) => (
          <path
            key={s.id}
            className={`series rest${solo ? ' faded' : ''}`}
            stroke="var(--s-rest)"
            d={linePath(s.values)}
          />
        ))}

        {named.map((s, i) => (
          <path
            key={s.id}
            className={`series${solo && solo !== s.id ? ' faded' : ''}`}
            stroke={seriesColor(i)}
            d={linePath(s.values)}
          />
        ))}

        {named.map((s, i) => (
          <circle
            key={s.id}
            className={`end-dot${solo && solo !== s.id ? ' faded' : ''}`}
            cx={x(n)}
            cy={y(s.last)}
            r={3.5}
            fill={seriesColor(i)}
          />
        ))}

        {endLabels.map((l) => (
          <text key={l.id} className="end-label" x={x(n) + 10} y={l.yPos} dominantBaseline="middle">
            {l.code}
          </text>
        ))}

        {hoverRound !== null && (
          <g pointerEvents="none">
            <line
              className="crosshair"
              x1={x(hoverRound)}
              x2={x(hoverRound)}
              y1={pad.top}
              y2={pad.top + plotH}
            />
            {named.map((s, i) => (
              <circle
                key={s.id}
                className="end-dot"
                cx={x(hoverRound)}
                cy={y(s.values[hoverRound - 1] ?? 0)}
                r={3.5}
                fill={seriesColor(i)}
              />
            ))}
          </g>
        )}

        {/* Trefferfläche: der Leser zielt auf ein Rennen, nie auf eine 2px-Linie. */}
        <rect
          x={pad.left}
          y={pad.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          tabIndex={0}
          aria-label="Step through the races with the arrow keys"
          onPointerDown={pointerRound}
          onPointerMove={pointerRound}
          /* Nur der Mauszeiger räumt den Auszug beim Verlassen weg. Ein Finger
             erzeugt beim Abheben ebenfalls ein pointerleave – der angetippte
             Wert verschwände dann im selben Moment, in dem man ihn lesen will.
             Am Telefon bleibt er deshalb stehen, bis woanders hingetippt wird. */
          onPointerLeave={(e) => e.pointerType === 'mouse' && setHoverRound(null)}
          /* Beim Tippen setzt schon pointerdown die Runde; der Fokus folgt erst
             danach und darf sie nicht mit der letzten überschreiben. Wer per
             Tastatur herkommt, hat noch keine – und landet am rechten Rand. */
          onFocus={() => setHoverRound((prev) => prev ?? n)}
          onBlur={() => setHoverRound(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') stepHover(1)
            else if (e.key === 'ArrowLeft') stepHover(-1)
            else return
            e.preventDefault()
          }}
        />
      </svg>

      {/* Am Telefon steht der Auszug fest unter dem Graphen: ein schwebendes
          Kästchen würde dort über den Rand hinauslaufen oder den Finger verdecken. */}
      {readout && (
        <div
          className="tooltip"
          style={
            narrow
              ? undefined
              : {
                  left: `${(x(readout.round.round) / W) * 100}%`,
                  transform:
                    readout.round.round > n * 0.6
                      ? 'translateX(calc(-100% - 14px))'
                      : 'translateX(14px)',
                }
          }
        >
          <h3>{readout.round.name}</h3>
          <ol>
            {readout.rows.map((row) => (
              <li key={row.s.id}>
                <span className="key" style={{ background: row.color }} />
                <span className="who">{row.s.name}</span>
                <span className="val">{row.value}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <ul className="legend">
        {named.map((s, i) => (
          <li
            key={s.id}
            onPointerEnter={() => setSolo(s.id)}
            onPointerLeave={() => setSolo(null)}
          >
            <span className="key" style={{ background: seriesColor(i) }} />
            <span className="who">{s.name}</span>
            <span className="pts">{s.last}</span>
          </li>
        ))}
        {series.length > NAMED && (
          <li>
            <span className="key" style={{ background: 'var(--s-rest)' }} />
            <span className="who">{series.length - NAMED} weitere Fahrer</span>
          </li>
        )}
      </ul>
    </div>
  )
}
