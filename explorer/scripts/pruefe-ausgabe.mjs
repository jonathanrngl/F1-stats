/**
 * Prüfung der gebauten Ausgabe: zusammengeklebter Text und tote Verweise.
 *
 *   node scripts/pruefe-ausgabe.mjs [verzeichnis]
 *
 * Tote Verweise: Jeder seiteninterne Link muss auf eine Datei zeigen, die der
 * Bau erzeugt hat. Eine Seite, die auf /drivers/<id>/ verlinkt, obwohl es für
 * diesen Fahrer keine Seite gibt, fällt sonst erst dem Besucher auf.
 *
 * In JSX endet eine Zeile auf ein Wort und die nächste beginnt mit einem
 * Ausdruck – dazwischen verschluckt der Übersetzer das Leerzeichen, und auf der
 * Seite steht „Las Vegason 24/11/2024". Der Fehler ist im Quelltext unsichtbar,
 * weil die Zeilen dort ordentlich untereinander stehen; erst die Ausgabe zeigt
 * ihn. Genau deshalb prüft diese Datei die Ausgabe und nicht den Quelltext.
 *
 * Er ist in diesem Projekt viermal aufgetreten – „917Fahrer" auf der
 * Startseite, in der Fußzeile, auf 78 Streckenseiten und auf 76 Saisonseiten.
 * Dreimal davon fiel er nur zufällig beim Ansehen auf. Deshalb steht er jetzt
 * im Build.
 */
import fs from 'node:fs'
import path from 'node:path'

const VERZEICHNIS = process.argv[2] ?? path.join(process.cwd(), 'dist')

/*
 * Nur Stellen, an denen ein Element unmittelbar an einem Wort klebt. Ziffern
 * und Großbuchstaben bleiben außen vor: „P7" oder „24/11" sind gewollt, und
 * Astro schreibt eigene Kennungen wie `uid="Z1Ixvnc"` in seine Inseln.
 */
const MUSTER = [
  {
    name: 'Wort klebt hinter einem schließenden Element',
    re: /<\/(?:a|b|i|em|span|strong)>([a-z]{2,})/g,
  },
  /*
   * Vor einem öffnenden Element nur Links prüfen. Ein <span> ist hier oft per
   * CSS ein Block – `<td>Most wins<span class="neben">…` liest sich auf der
   * Seite als zwei Zeilen, nicht als ein zusammengeklebtes Wort. Die Regel
   * meldete das sechsmal, und jedes Mal zu Unrecht. Ein <a> dagegen ist
   * verlässlich im Fluss: Dort ist fehlender Abstand immer ein Fehler.
   */
  {
    name: 'Wort klebt vor einem Link',
    re: /([a-z]{3,})<a[ >]/g,
  },
]

function sammle(verzeichnis, treffer = []) {
  for (const e of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
    const p = path.join(verzeichnis, e.name)
    if (e.isDirectory()) sammle(p, treffer)
    else if (e.name.endsWith('.html')) treffer.push(p)
  }
  return treffer
}

if (!fs.existsSync(VERZEICHNIS)) {
  console.error(`Kein gebautes Verzeichnis unter ${VERZEICHNIS}. Erst: npm run build`)
  process.exit(1)
}

const seiten = sammle(VERZEICHNIS)
/** Je Fundstelle die Zahl der betroffenen Seiten und ein Beispiel. */
const funde = new Map()

/*
 * Der Vorsatz, unter dem die Seite liegt. Verweise ohne ihn zeigten auf GitHub
 * Pages an der Seite vorbei auf die Wurzel der Domain – auch das ist tot.
 */
const BASIS = '/F1-stats/'
const gibtEs = new Map()
const vorhanden = (weg) => {
  if (!gibtEs.has(weg)) {
    const rel = decodeURIComponent(weg.slice(BASIS.length))
    const ziel = path.join(VERZEICHNIS, rel)
    gibtEs.set(
      weg,
      fs.existsSync(ziel) && (fs.statSync(ziel).isFile() || fs.existsSync(path.join(ziel, 'index.html'))),
    )
  }
  return gibtEs.get(weg)
}
/** Tote Verweise: Ziel → Zahl der Vorkommen und eine Seite als Beispiel. */
const tot = new Map()

for (const datei of seiten) {
  const roh = fs.readFileSync(datei, 'utf8')

  for (const m of roh.matchAll(/\b(?:href|src)="(\/[^"#?]*)/g)) {
    const weg = m[1]
    if (weg.startsWith('//')) continue
    if (!weg.startsWith(BASIS) || !vorhanden(weg)) {
      const e = tot.get(weg) ?? { n: 0, seite: path.relative(VERZEICHNIS, datei).replace(/\\/g, '/') }
      e.n++
      tot.set(weg, e)
    }
  }

  const html = roh
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')

  for (const m of MUSTER) {
    m.re.lastIndex = 0
    let x
    while ((x = m.re.exec(html)) !== null) {
      const schluessel = `${m.name}|${x[0]}`
      if (!funde.has(schluessel)) {
        funde.set(schluessel, {
          name: m.name,
          stelle: x[0],
          umfeld: html.slice(Math.max(0, x.index - 55), x.index + x[0].length + 30).replace(/\s+/g, ' '),
          seite: path.relative(VERZEICHNIS, datei).replace(/\\/g, '/'),
          n: 0,
        })
      }
      funde.get(schluessel).n++
    }
  }
}

console.log(`${seiten.length} Seiten geprüft, ${gibtEs.size} verschiedene Verweisziele.`)

let fehlgeschlagen = false

if (funde.size === 0) {
  console.log('Kein zusammengeklebter Text.')
} else {
  fehlgeschlagen = true
  const sortiert = [...funde.values()].sort((a, b) => b.n - a.n)
  console.error(`\n${sortiert.length} Stelle(n) mit fehlendem Leerzeichen:\n`)
  for (const f of sortiert) {
    console.error(`  ${f.n}× ${f.stelle}   (${f.name})`)
    console.error(`     …${f.umfeld}…`)
    console.error(`     z. B. ${f.seite}\n`)
  }
  console.error('Im Quelltext fehlt dort ein {\' \'} zwischen Wort und Ausdruck.')
}

if (tot.size === 0) {
  console.log('Kein toter Verweis.')
} else {
  fehlgeschlagen = true
  const sortiert = [...tot.entries()].sort((a, b) => b[1].n - a[1].n)
  console.error(`\n${sortiert.length} tote(r) Verweis(e):\n`)
  for (const [weg, e] of sortiert.slice(0, 30)) console.error(`  ${e.n}× ${weg}   (z. B. auf ${e.seite})`)
}

process.exit(fehlgeschlagen ? 1 : 0)
