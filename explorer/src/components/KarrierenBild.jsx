import { useEffect, useRef, useState } from 'react'

/*
 * Zwei Karrieren als Linien: Siege, Podien oder Poles, aufsummiert über die
 * Zahl der Starts.
 *
 * Über Starts, nicht über Jahre – sonst wären Fangio und Verstappen zwei
 * Linien siebzig Jahre auseinander, und die Frage, die man eigentlich stellt,
 * bliebe offen: Wer war nach hundert Rennen weiter?
 *
 * Die Profile der API führen Summen je Saison, nicht je Rennen. Jeder Punkt
 * ist deshalb ein Saisonende, und zwischen zwei Punkten verläuft die Linie
 * gerade – wie die Saison sich verteilte, steht nicht in diesen Daten. Die
 * Bildunterschrift sagt das.
 *
 * Farben wie in den Köpfen darüber: erster Fahrer rot, zweiter blau (das
 * geprüfte Paar der Seite). Namen stehen am Ende jeder Linie, die Farbe trägt
 * nie allein. Keine style-Attribute: Die Inhaltsrichtlinie blockiert sie.
 */

const MASSE = [
  { k: 'siege', label: 'Wins' },
  { k: 'podien', label: 'Podiums' },
  { k: 'poles', label: 'Pole positions' },
]

function useBreite() {
  const ref = useRef(null)
  const [breite, setBreite] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const b = new ResizeObserver(([e]) => setBreite(Math.floor(e.contentRect.width)))
    b.observe(ref.current)
    return () => b.disconnect()
  }, [])
  return [ref, breite]
}

/** Eine runde Schrittweite für die Achse: 1, 2, 5, 10, 20, 50 … */
function schrittweite(max, ziel = 4) {
  const roh = max / ziel
  const zehner = 10 ** Math.floor(Math.log10(Math.max(roh, 1)))
  return [1, 2, 5, 10].map((f) => f * zehner).find((s) => s >= roh) ?? zehner * 10
}

/** Die Punkte einer Karriere: je Saisonende die aufsummierten Starts und Werte. */
function verlauf(profil, von, bis, k) {
  let starts = 0
  let wert = 0
  const punkte = [{ starts: 0, wert: 0, jahr: null, meister: false }]
  for (const s of profil.saisons) {
    if (s.jahr < von || s.jahr > bis || !s.starts) continue
    starts += s.starts
    wert += s[k] ?? 0
    punkte.push({ starts, wert, jahr: s.jahr, meister: !!s.meister })
  }
  return punkte
}

export default function KarrierenBild({ profile, von, bis }) {
  const [ref, breite] = useBreite()
  const [mass, setMass] = useState('siege')
  const [zeigerStarts, setZeigerStarts] = useState(null)

  const label = MASSE.find((m) => m.k === mass).label
  const reihen = profile.map((p, i) => ({ p, i, punkte: verlauf(p, von, bis, mass) }))
  if (reihen.every((r) => r.punkte.length < 2)) return null

  const H = 260
  /* Rechts steht der Name am Linienende; am Telefon reicht dafür weniger Platz. */
  const RAND = { oben: 14, rechts: breite < 520 ? 76 : 118, unten: 30, links: 34 }
  const maxX = Math.max(...reihen.map((r) => r.punkte.at(-1).starts), 1)
  const maxY = Math.max(...reihen.map((r) => r.punkte.at(-1).wert), 1)
  const sx = schrittweite(maxX, 5)
  const sy = schrittweite(maxY, 4)
  const obenY = Math.ceil(maxY / sy) * sy
  const B = Math.max(breite - RAND.links - RAND.rechts, 60)
  const x = (v) => RAND.links + (v / maxX) * B
  const y = (v) => RAND.oben + (1 - v / obenY) * (H - RAND.oben - RAND.unten)

  const tickX = []
  for (let v = 0; v <= maxX; v += sx) tickX.push(v)
  const tickY = []
  for (let v = 0; v <= obenY; v += sy) tickY.push(v)

  /* Die Beschriftungen am Linienende dürfen sich nicht überdecken – notfalls auseinanderschieben. */
  const enden = reihen.map((r) => ({ i: r.i, y: y(r.punkte.at(-1).wert) }))
  if (enden.length === 2 && Math.abs(enden[0].y - enden[1].y) < 16) {
    const [a, b] = enden[0].y <= enden[1].y ? [enden[0], enden[1]] : [enden[1], enden[0]]
    const mitte = (a.y + b.y) / 2
    a.y = mitte - 8
    b.y = mitte + 8
  }

  /* Der Stand am Zeiger: je Fahrer das letzte Saisonende bis zu dieser Startzahl. */
  const stand = zeigerStarts === null ? null : reihen.map((r) => {
    const bis = r.punkte.filter((q) => q.starts <= zeigerStarts)
    return { ...r, q: bis.at(-1) }
  })

  const bewege = (e) => {
    const rahmen = e.currentTarget.getBoundingClientRect()
    const v = ((e.clientX - rahmen.left - RAND.links) / B) * maxX
    setZeigerStarts(v < 0 || v > maxX ? null : Math.round(v))
  }

  const nachname = (p) => p.name.split(' ').slice(-1)[0]

  return (
    <figure className="karrieren" ref={ref}>
      <div className="karrieren-kopf">
        <figcaption>
          <b>{label} over career starts</b>
          <span>Each point is the end of a season; a larger one marks a title.</span>
        </figcaption>
        <div className="masswahl" role="group" aria-label="Figure to plot">
          {MASSE.map((m) => (
            <button key={m.k} type="button" aria-pressed={mass === m.k} onClick={() => setMass(m.k)}>{m.label}</button>
          ))}
        </div>
      </div>

      <p className="karrieren-stand" aria-live="polite">
        {stand
          ? stand.map((s) => (
              <span key={s.i} className={`s${s.i}`}>
                <i />
                {s.p.name}: <b>{s.q.wert}</b> after {s.q.starts} {s.q.starts === 1 ? 'start' : 'starts'}
                {s.q.jahr ? ` (end of ${s.q.jahr})` : ''}
              </span>
            ))
          : reihen.map((r) => (
              <span key={r.i} className={`s${r.i}`}>
                <i />
                {r.p.name}: <b>{r.punkte.at(-1).wert}</b> in {r.punkte.at(-1).starts} starts
              </span>
            ))}
      </p>

      {breite > 0 && (
        <svg width={breite} height={H} viewBox={`0 0 ${breite} ${H}`} role="img"
          aria-label={`${label} over career starts: ${reihen.map((r) => `${r.p.name} ${r.punkte.at(-1).wert} in ${r.punkte.at(-1).starts} starts`).join(', ')}.`}
          onPointerMove={bewege} onPointerLeave={() => setZeigerStarts(null)}>
          {tickY.map((v) => (
            <g key={`y${v}`}>
              <line className={v === 0 ? 'grundlinie' : 'gitter'} x1={RAND.links} x2={RAND.links + B} y1={y(v)} y2={y(v)} />
              <text className="achse" x={RAND.links - 6} y={y(v)} textAnchor="end" dominantBaseline="central">{v}</text>
            </g>
          ))}
          {tickX.map((v) => (
            <text key={`x${v}`} className="achse" x={x(v)} y={H - 10} textAnchor="middle">{v}</text>
          ))}
          <text className="achse" x={RAND.links + B} y={H - 10} dx={10} textAnchor="start">starts</text>

          {zeigerStarts !== null && (
            <line className="fadenkreuz" x1={x(zeigerStarts)} x2={x(zeigerStarts)} y1={RAND.oben} y2={H - RAND.unten} />
          )}

          {reihen.map((r) => (
            <g key={r.i} className={`linie s${r.i}`}>
              <polyline points={r.punkte.map((q) => `${x(q.starts)},${y(q.wert)}`).join(' ')} />
              {r.punkte.slice(1).map((q) => (
                <circle key={q.jahr} cx={x(q.starts)} cy={y(q.wert)} r={q.meister ? 4.5 : 2.4} className={q.meister ? 'titel' : undefined} />
              ))}
              <text className="ende" x={x(r.punkte.at(-1).starts) + 8} y={enden.find((e) => e.i === r.i).y} dominantBaseline="central">
                {nachname(r.p)} {r.punkte.at(-1).wert}
              </text>
            </g>
          ))}

          {stand && stand.map((s) => (
            <circle key={`z${s.i}`} className={`zeiger s${s.i}`} cx={x(s.q.starts)} cy={y(s.q.wert)} r={5} />
          ))}
        </svg>
      )}
    </figure>
  )
}
