import { useEffect, useRef, useState } from 'react'

/*
 * Das Ergebnis des Explorers als Bild, über der Tabelle.
 *
 * Zwei Formen, je nachdem, wonach gruppiert ist:
 *
 *   nach Saison oder Jahrzehnt  Säulen in zeitlicher Reihenfolge – die Frage
 *                               ist dann „wie hat sich das entwickelt?“, und
 *                               die Antwort ist eine Form über die Zeit.
 *   nach allem anderen          die Spitze als waagerechte Balken, in der
 *                               Reihenfolge der Tabelle. Namen lesen sich
 *                               waagerecht, und die Länge ist die Aussage.
 *
 * Eine Reihe, eine Farbe, keine Legende – die Überschrift nennt die Kennzahl.
 * Gezeichnet wird in Bildschirmpixeln: Die Breite wird gemessen, statt ein
 * festes viewBox zu strecken, sonst schrumpfte die Schrift am Telefon auf
 * sechs Pixel. Keine style-Attribute: Die Inhaltsrichtlinie blockiert sie.
 * Alle Werte stehen auch in der Tabelle darunter.
 */

const SPITZE = 12

function useBreite() {
  const ref = useRef(null)
  const [breite, setBreite] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const beobachter = new ResizeObserver(([e]) => setBreite(Math.floor(e.contentRect.width)))
    beobachter.observe(ref.current)
    return () => beobachter.disconnect()
  }, [])
  return [ref, breite]
}

/** Namen kürzen, die nicht in die Beschriftungsspalte passen – geschätzt, nicht gemessen. */
const kuerze = (s, platz) => {
  const max = Math.max(4, Math.floor(platz / 7.2))
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

export default function ErgebnisBild({ reihen, kennzahl, label, zeitlich, zeige, basis, aufsteigend }) {
  const [ref, breite] = useBreite()
  const [ziel, setZiel] = useState(null)

  const mitWert = reihen.filter((r) => typeof r.werte[kennzahl] === 'number' && Number.isFinite(r.werte[kennzahl]))
  const liste = zeitlich
    ? [...mitWert].sort((a, b) => Number(a.id) - Number(b.id))
    : mitWert.slice(0, SPITZE)

  if (liste.length < 2) return null

  const werte = liste.map((r) => r.werte[kennzahl])
  const min = Math.min(0, ...werte)
  const max = Math.max(0, ...werte)
  const spanne = max - min || 1

  const titel = zeitlich
    ? `${label}, ${liste[0].name}–${liste.at(-1).name}`
    : `${label}: the top ${liste.length}${aufsteigend ? ', lowest first' : ''}`

  /* Die Zeile über dem Bild: der Wert unter dem Zeiger, sonst der höchste. */
  const vorn = ziel ?? liste[werte.indexOf(Math.max(...werte))]
  const anzeige = vorn ? `${vorn.name}: ${zeige(kennzahl, vorn.werte[kennzahl])}` : ''

  return (
    <figure className="ergebnisbild" ref={ref}>
      <figcaption>
        <b>{titel}</b>
        {zeitlich && <span aria-live="polite">{ziel ? anzeige : `Highest – ${anzeige}`}</span>}
      </figcaption>
      {breite > 0 && (zeitlich
        ? <Saeulen liste={liste} kennzahl={kennzahl} breite={breite} min={min} spanne={spanne} ziel={ziel} setZiel={setZiel} zeige={zeige} label={label} />
        : <Balken liste={liste} kennzahl={kennzahl} breite={breite} min={min} spanne={spanne} ziel={ziel} setZiel={setZiel} zeige={zeige} basis={basis} label={label} />)}
    </figure>
  )
}

function Balken({ liste, kennzahl, breite, min, spanne, ziel, setZiel, zeige, basis, label }) {
  const ZEILE = 28
  const namenBreite = Math.min(Math.round(breite * 0.34), 190)
  const wertPlatz = 64
  const x0 = namenBreite + 12
  const flaeche = Math.max(breite - x0 - wertPlatz, 40)
  const x = (v) => x0 + ((v - min) / spanne) * flaeche
  const hoehe = liste.length * ZEILE + 4

  return (
    <svg width={breite} height={hoehe} viewBox={`0 0 ${breite} ${hoehe}`} role="img"
      aria-label={`${label}, bar chart of the top ${liste.length}. The values are in the table below.`}>
      {min < 0 && <line className="null" x1={x(0)} x2={x(0)} y1={0} y2={hoehe} />}
      {liste.map((r, i) => {
        const v = r.werte[kennzahl]
        const y = i * ZEILE + 2
        const links = Math.min(x(0), x(v))
        const b = Math.max(Math.abs(x(v) - x(0)), 1.5)
        const name = kuerze(r.name, namenBreite)
        return (
          <g key={r.id} className={ziel?.id === r.id ? 'reihe an' : 'reihe'}
            onPointerEnter={() => setZiel(r)} onPointerLeave={() => setZiel(null)}>
            <rect className="treffer" x={0} y={y} width={breite} height={ZEILE} />
            <text className="name" x={namenBreite} y={y + ZEILE / 2} textAnchor="end" dominantBaseline="central">
              {r.link ? <a href={`${basis}${r.link}`}>{name}</a> : name}
            </text>
            <rect className="balken" x={links} y={y + 6} width={b} height={ZEILE - 12} rx={2} />
            <text className="wert" x={Math.max(x(v), x(0)) + 6} y={y + ZEILE / 2} dominantBaseline="central">
              {zeige(kennzahl, v)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Saeulen({ liste, kennzahl, breite, min, spanne, ziel, setZiel, zeige, label }) {
  const HOEHE = 180
  const unten = 22
  const links = 36
  const flaeche = breite - links - 4
  const schritt = flaeche / liste.length
  const b = Math.max(Math.min(schritt * 0.72, 28), 1.5)
  const y = (v) => 8 + (1 - (v - min) / spanne) * (HOEHE - unten - 8)
  const max = Math.max(...liste.map((r) => r.werte[kennzahl]))

  /* Beschriftet wird jede Säule, deren Jahr auf ein Jahrzehnt fällt – bei Jahrzehnten jede. */
  const beschriften = (r, i) => liste.length <= 12 || Number(r.id) % 10 === 0 || i === 0 || i === liste.length - 1

  return (
    <svg width={breite} height={HOEHE} viewBox={`0 0 ${breite} ${HOEHE}`} role="img"
      aria-label={`${label} over time, ${liste.length} columns. The values are in the table below.`}
      onPointerLeave={() => setZiel(null)}>
      <line className="gitter" x1={links} x2={breite} y1={y(max)} y2={y(max)} />
      <text className="achse" x={links - 6} y={y(max)} textAnchor="end" dominantBaseline="central">{zeige(kennzahl, max)}</text>
      <line className="grundlinie" x1={links} x2={breite} y1={y(0)} y2={y(0)} />
      {liste.map((r, i) => {
        const v = r.werte[kennzahl]
        const mitte = links + schritt * i + schritt / 2
        return (
          <g key={r.id} className={ziel?.id === r.id ? 'reihe an' : 'reihe'} onPointerEnter={() => setZiel(r)}>
            <rect className="treffer" x={links + schritt * i} y={0} width={schritt} height={HOEHE} />
            <rect className="balken" x={mitte - b / 2} y={Math.min(y(v), y(0))} width={b}
              height={Math.max(Math.abs(y(0) - y(v)), 1)} rx={b > 6 ? 2 : 0} />
            {beschriften(r, i) && (
              <text className="achse" x={mitte} y={HOEHE - 6} textAnchor="middle">{r.name}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
