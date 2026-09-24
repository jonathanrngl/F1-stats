/**
 * Gibt es eine neuere F1DB-Fassung als die gepinnte?
 *
 *   node scripts/f1db-neueste.mjs
 *
 * Schreibt `version=<tag>` auf die Standardausgabe, wenn ja, und nichts, wenn
 * nein – genau die Form, die GitHub Actions als Ausgabe eines Schritts liest
 * (`>> "$GITHUB_OUTPUT"`). Der Tag ist fremde Eingabe und wird geprüft, bevor
 * er irgendwo weiterverwendet wird: in einer Adresse, einer Datei, einem
 * Commit.
 *
 * Nur neuer, nie älter: Zöge F1DB ein Release zurück, sodass „latest“ auf
 * eine frühere Fassung zeigt, bliebe die Seite bei der gepinnten.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HIER = path.dirname(fileURLToPath(import.meta.url))
const TAG = /^v(\d{4})\.(\d{1,3})\.(\d{1,3})$/

const teile = (tag) => TAG.exec(tag)?.slice(1).map(Number) ?? null
const neuer = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

const gepinnt = (await fs.readFile(path.join(HIER, '..', 'f1db-version.txt'), 'utf8')).trim()
if (!teile(gepinnt)) throw new Error(`f1db-version.txt enthaelt keinen gueltigen Tag: ${JSON.stringify(gepinnt)}`)

const headers = { accept: 'application/vnd.github+json', 'user-agent': 'f1-stats-update' }
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
const res = await fetch('https://api.github.com/repos/f1db/f1db/releases/latest', {
  headers,
  signal: AbortSignal.timeout(60_000),
})
if (!res.ok) throw new Error(`GitHub-API nicht erreichbar (HTTP ${res.status})`)
const neueste = (await res.json()).tag_name
if (!teile(neueste)) throw new Error(`GitHub-API nennt keinen gueltigen Tag: ${JSON.stringify(neueste)}`)

console.error(`gepinnt ${gepinnt}, veroeffentlicht ${neueste}`)
if (neuer(teile(neueste), teile(gepinnt))) console.log(`version=${neueste}`)
