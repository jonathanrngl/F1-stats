/**
 * Ein Vergleichsbogen: die Bildschirmfotos zweier Stände nebeneinander, als
 * HTML-Datei zum Öffnen im Browser.
 *
 *   node scripts/vergleichsbogen.mjs .design/vorher .design/prototyp .design/vergleich.html
 *
 * Gezeigt werden nur Seiten, die es in beiden Ordnern gibt, je Breite und
 * Modus eine Zeile. Die Bilder werden verlinkt, nicht eingebettet – der Bogen
 * liegt neben ihnen in .design/ und wird nicht veröffentlicht.
 */
import fs from 'node:fs'
import path from 'node:path'

const [links, rechts, ziel] = process.argv.slice(2)
if (!links || !rechts || !ziel) {
  console.error('Aufruf: node scripts/vergleichsbogen.mjs <vorher> <nachher> <ziel.html>')
  process.exit(1)
}

const beide = fs.readdirSync(rechts).filter((d) => d.endsWith('.png') && fs.existsSync(path.join(links, d))).sort()
const rel = (ordner, datei) => path.relative(path.dirname(ziel), path.join(ordner, datei)).replaceAll('\\', '/')

const zeilen = beide
  .map((d) => `<section><h2>${d.replace('.png', '')}</h2><div class="paar">
<figure><figcaption>${path.basename(links)}</figcaption><a href="${rel(links, d)}"><img src="${rel(links, d)}" loading="lazy" alt=""></a></figure>
<figure><figcaption>${path.basename(rechts)}</figcaption><a href="${rel(rechts, d)}"><img src="${rel(rechts, d)}" loading="lazy" alt=""></a></figure>
</div></section>`)
  .join('\n')

fs.writeFileSync(
  ziel,
  `<!doctype html><meta charset="utf-8"><title>Vergleich ${path.basename(links)} / ${path.basename(rechts)}</title>
<style>
body{margin:0;padding:16px;font:14px/1.4 system-ui,sans-serif;background:#ddd;color:#111}
section{margin:0 0 32px}h2{font-size:15px;margin:0 0 8px}
.paar{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}
figure{margin:0;background:#fff;padding:6px}figcaption{font-weight:600;margin-bottom:4px}
img{display:block;width:100%;max-height:1400px;object-fit:cover;object-position:top}
</style>
<h1>${beide.length} Bilder: ${path.basename(links)} links, ${path.basename(rechts)} rechts</h1>
${zeilen}`,
)
console.log(`${beide.length} Paare → ${ziel}`)
