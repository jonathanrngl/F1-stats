/**
 * Prüfung der gebauten Ausgabe auf zusammengeklebten Text.
 *
 *   node scripts/pruefe-ausgabe.mjs [verzeichnis]
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

for (const datei of seiten) {
  const html = fs
    .readFileSync(datei, 'utf8')
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

console.log(`${seiten.length} Seiten geprüft.`)

if (funde.size === 0) {
  console.log('Kein zusammengeklebter Text.')
  process.exit(0)
}

const sortiert = [...funde.values()].sort((a, b) => b.n - a.n)
console.error(`\n${sortiert.length} Stelle(n) mit fehlendem Leerzeichen:\n`)
for (const f of sortiert) {
  console.error(`  ${f.n}× ${f.stelle}   (${f.name})`)
  console.error(`     …${f.umfeld}…`)
  console.error(`     z. B. ${f.seite}\n`)
}
console.error('Im Quelltext fehlt dort ein {\' \'} zwischen Wort und Ausdruck.')
process.exit(1)
