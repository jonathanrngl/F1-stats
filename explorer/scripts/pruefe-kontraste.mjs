/**
 * Kontraste der Farbrollen, hell und dunkel, nach WCAG 2.1.
 *
 *   node scripts/pruefe-kontraste.mjs            Prüfung, Exit 1 bei einem Verstoß
 *   node scripts/pruefe-kontraste.mjs --tabelle  alle Paare als Tabelle (für docs/DESIGN.md)
 *   node scripts/pruefe-kontraste.mjs --teams    jede Teamfarbe gegen beide Flächen
 *
 * Die Werte stehen nur in theme.css und teams.css, als `light-dark()`. Wer eine
 * Rolle ändert, soll nicht von Hand nachrechnen müssen, ob Text auf der neuen
 * Fläche noch lesbar ist – und eine Kommentarzeile „5,9:1 auf Weiß“ stimmt
 * nach der dritten Änderung nicht mehr. Das Skript liest dieselbe Datei, die
 * der Browser liest.
 *
 * Halbtransparente Rollen (rgba) werden auf ihre Fläche gerechnet, wie der
 * Browser sie mischt.
 */
import fs from 'node:fs'
import path from 'node:path'

const WURZEL = process.cwd()
const THEME = fs.readFileSync(process.env.THEME_CSS ?? path.join(WURZEL, 'src/styles/theme.css'), 'utf8')
const TEAMS = fs.readFileSync(path.join(WURZEL, 'src/styles/teams.css'), 'utf8')

// ------------------------------------------------------------------ Farben

function hexZuRgb(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }
}

function farbe(text) {
  const t = text.trim()
  if (t.startsWith('#')) return hexZuRgb(t)
  const m = t.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
  return null
}

/** Eine halbtransparente Farbe auf ihren Grund gemischt. */
const auf = (vorne, grund) =>
  vorne.a >= 1
    ? vorne
    : {
        r: vorne.r * vorne.a + grund.r * (1 - vorne.a),
        g: vorne.g * vorne.a + grund.g * (1 - vorne.a),
        b: vorne.b * vorne.a + grund.b * (1 - vorne.a),
        a: 1,
      }

const kanal = (c) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const leuchte = ({ r, g, b }) => 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b)

export function kontrast(a, b) {
  const [x, y] = [leuchte(a), leuchte(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// ------------------------------------------------------------------- Rollen

/*
 * Nur der erste :root-Block zählt – darin stehen die Rollen. Ein Wert ist
 * `light-dark(a, b)`, eine Farbe für beide Modi oder ein Verweis var(--x).
 * Kommata innerhalb von rgba() trennen nicht die beiden Modi; deshalb wird
 * mit Klammertiefe getrennt.
 */
function teile(innen) {
  let tiefe = 0
  for (let i = 0; i < innen.length; i++) {
    const c = innen[i]
    if (c === '(') tiefe++
    else if (c === ')') tiefe--
    else if (c === ',' && tiefe === 0) return [innen.slice(0, i), innen.slice(i + 1)]
  }
  return [innen, innen]
}

function rollenAus(css) {
  const block = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')))
  const rollen = {}
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const wert = m[2].trim()
    const ld = wert.match(/^light-dark\((.*)\)$/s)
    if (ld) {
      const [hell, dunkel] = teile(ld[1])
      rollen[m[1]] = { hell: hell.trim(), dunkel: dunkel.trim() }
    } else rollen[m[1]] = { hell: wert, dunkel: wert }
  }
  return rollen
}

const ROLLEN = rollenAus(THEME)

export function wert(name, modus, tiefe = 0) {
  const r = ROLLEN[name]
  if (!r || tiefe > 8) return null
  const roh = r[modus]
  const v = roh.match(/^var\((--[\w-]+)\)$/)
  if (v) return wert(v[1], modus, tiefe + 1)
  return farbe(roh)
}

// -------------------------------------------------------------------- Paare

/*
 * Welche Rolle auf welcher Fläche steht, und was sie dort mindestens braucht:
 * 4,5 für Text, 3 für große Schrift, Bedienelemente und Grafik (1.4.11).
 * Fehlt eine Rolle in theme.css, wird das Paar übersprungen und gemeldet –
 * so bleibt das Skript beim Umbau der Rollen brauchbar.
 */
const PAARE = [
  // Text
  ['--ink', '--plane', 4.5], ['--ink', '--surface', 4.5], ['--ink', '--surface-2', 4.5], ['--ink', '--zebra', 4.5],
  ['--ink-2', '--plane', 4.5], ['--ink-2', '--surface', 4.5], ['--ink-2', '--surface-2', 4.5], ['--ink-2', '--zebra', 4.5],
  ['--muted', '--plane', 4.5], ['--muted', '--surface', 4.5], ['--muted', '--surface-2', 4.5], ['--muted', '--zebra', 4.5],
  ['--plane', '--ink', 4.5], ['--plane', '--lila', 4.5],
  ['--lila', '--plane', 4.5], ['--lila', '--surface', 4.5], ['--lila', '--zebra', 4.5],
  ['--good', '--plane', 4.5], ['--good', '--surface', 4.5], ['--good', '--zebra', 4.5],
  ['--warn', '--plane', 4.5], ['--warn', '--surface', 4.5],
  ['--danger-fg', '--danger-bg', 4.5], ['--danger-fg', '--surface', 4.5],
  ['--podest-ink', '--gold', 4.5], ['--podest-ink', '--silber', 4.5], ['--podest-ink', '--bronze', 4.5],
  ['--ink', '--gold-wash', 4.5],
  // Bedienelemente und Grafik
  ['--border-input', '--plane', 3], ['--border-input', '--surface', 3],
  ['--ink', '--plane', 3], ['--ink', '--surface', 3],
  ['--danger-border', '--danger-bg', 3],
  ['--s-rest', '--surface', 3],
  ['--s1', '--surface', 3], ['--s2', '--surface', 3], ['--s3', '--surface', 3], ['--s4', '--surface', 3],
  ['--s5', '--surface', 3], ['--s6', '--surface', 3], ['--s7', '--surface', 3], ['--s8', '--surface', 3],
  ['--flagge-gelb', '--surface', 3], ['--flagge-blau', '--surface', 3],
]

/*
 * Gemeldet, aber nicht gezählt – jeweils mit dem Grund, warum die Farbe dort
 * nicht allein trägt:
 *   Serienfarben hell: Namen an den Linien und eine Tabellenansicht (DESIGN.md 5.6).
 *   Flaggen: Der Hinweis beginnt mit einem Wort, das die Art sagt (DESIGN.md 8.8).
 *   Der Rand eines Ausfalls: Darin steht „Ret“ oder „DNQ“.
 */
const NUR_MELDEN = (vorn, modus) =>
  (modus === 'hell' && /^--s\d$/.test(vorn)) || vorn.startsWith('--flagge-') || vorn === '--danger-border'

function pruefePaare() {
  const zeilen = []
  for (const [vorn, grund, min] of PAARE) {
    for (const modus of ['hell', 'dunkel']) {
      const g = wert(grund, modus)
      const v = wert(vorn, modus)
      if (!g || !v) {
        zeilen.push({ vorn, grund, modus, min, wert: null })
        continue
      }
      const gemischt = auf(v, auf(g, wert('--plane', modus) ?? { r: 255, g: 255, b: 255, a: 1 }))
      zeilen.push({ vorn, grund, modus, min, wert: kontrast(gemischt, auf(g, wert('--plane', modus))) })
    }
  }
  return zeilen
}

// -------------------------------------------------------------------- Teams

function teamFarben() {
  const out = []
  for (const m of TEAMS.matchAll(/--t-([\w-]+):\s*light-dark\(([^,]+),\s*([^)]+)\)/g)) {
    out.push({ id: m[1], hell: farbe(m[2]), dunkel: farbe(m[3]), hellText: m[2].trim(), dunkelText: m[3].trim() })
  }
  return out
}

// ------------------------------------------------------------------ Ausgabe

const f = (x) => (x === null ? '—' : x.toFixed(2).replace('.', ','))

if (process.argv.includes('--teams')) {
  const flaechen = ['--plane', '--surface']
  console.log(`| Team | hell | ${flaechen.map((x) => `auf ${x}`).join(' | ')} | dunkel | ${flaechen.map((x) => `auf ${x}`).join(' | ')} |`)
  console.log('|---|---|' + flaechen.map(() => '---:').join('|') + '|---|' + flaechen.map(() => '---:').join('|') + '|')
  for (const t of teamFarben()) {
    const h = flaechen.map((x) => f(kontrast(t.hell, wert(x, 'hell'))))
    const d = flaechen.map((x) => f(kontrast(t.dunkel, wert(x, 'dunkel'))))
    console.log(`| ${t.id} | \`${t.hellText}\` | ${h.join(' | ')} | \`${t.dunkelText}\` | ${d.join(' | ')} |`)
  }
} else {
  const zeilen = pruefePaare()
  if (process.argv.includes('--tabelle')) {
    console.log('| Vordergrund | Fläche | nötig | hell | dunkel |')
    console.log('|---|---|---:|---:|---:|')
    const gesehen = new Set()
    for (const z of zeilen) {
      const k = `${z.vorn}|${z.grund}|${z.min}`
      if (gesehen.has(k)) continue
      gesehen.add(k)
      const h = zeilen.find((y) => y.vorn === z.vorn && y.grund === z.grund && y.min === z.min && y.modus === 'hell')
      const d = zeilen.find((y) => y.vorn === z.vorn && y.grund === z.grund && y.min === z.min && y.modus === 'dunkel')
      const mark = (y) => (y.wert === null ? '—' : `${f(y.wert)}${y.wert < y.min ? ' ✗' : ''}`)
      console.log(`| \`${z.vorn}\` | \`${z.grund}\` | ${z.min} | ${mark(h)} | ${mark(d)} |`)
    }
  } else {
    const fehlt = zeilen.filter((z) => z.wert === null)
    const schlecht = zeilen.filter((z) => z.wert !== null && z.wert < z.min)
    const zaehlt = schlecht.filter((z) => !NUR_MELDEN(z.vorn, z.modus))
    for (const z of schlecht) {
      console.log(`${NUR_MELDEN(z.vorn, z.modus) ? '  ·' : '  ✗'} ${z.vorn} auf ${z.grund} (${z.modus}): ${f(z.wert)} < ${z.min}`)
    }
    if (fehlt.length) console.log(`  (${new Set(fehlt.map((z) => z.vorn + ' ' + z.grund)).size} Paare ohne Rolle übersprungen)`)
    console.log(`${zeilen.length - fehlt.length - zaehlt.length} Kontraste bestanden, ${zaehlt.length} zu schwach.`)
    if (zaehlt.length) process.exit(1)
  }
}
