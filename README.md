# F1-Statistiken

Weltmeisterschaftsstände der Formel 1 zu jedem Rennen seit 1950 – Fahrerwertung,
Konstrukteurswertung und der Punkteverlauf einer Saison als Graph. Die Daten
kommen live von der [Jolpica-F1-API](https://api.jolpi.ca) (Ergast-Nachfolger).

React 19 + TypeScript + Vite, ohne Laufzeit-Abhängigkeiten über React hinaus.
Der Graph ist handgezeichnetes SVG, keine Chart-Bibliothek.

## Entwickeln

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build  ->  dist/
npm run lint     # oxlint
npm run preview  # gebautes dist/ lokal ansehen
```

## Veröffentlichen

Die Seite ist rein statisch – gebautes HTML, CSS, JS, keine Serverlogik. Die
Daten holt der Browser direkt von der Jolpica-API, es braucht also kein Backend
und keine Secrets. `vite.config.ts` setzt `base: './'`, damit derselbe Build
sowohl im Wurzelverzeichnis einer eigenen Domain als auch im Unterpfad von
GitHub Pages (`/F1-stats/`) funktioniert.

**GitHub Pages** ist eingerichtet: `.github/workflows/deploy.yml` baut bei jedem
Push auf `main` und veröffentlicht `dist/`. Einmalig im Repo nötig:

1. *Settings → Pages → Build and deployment → Source* auf **GitHub Actions**
   stellen.
2. Auf `main` pushen (oder den Workflow unter *Actions* manuell starten).

Danach liegt die Seite unter `https://<user>.github.io/F1-stats/`; die genaue
URL steht am Ende des Deploy-Jobs.

**Eigene Domain.** *Settings → Pages → Custom domain* eintragen, beim
DNS-Anbieter einen `CNAME` auf `<user>.github.io` setzen (bzw. `A`-Records auf
die Pages-IPs bei einer Apex-Domain) und *Enforce HTTPS* anhaken.

**Anderer Hoster.** `npm run build` und den Inhalt von `dist/` hochladen – durch
den relativen `base` läuft das Verzeichnis auch in einem Unterordner.

Noch offen, sobald die Domain feststeht: `og:url` und `og:image` in
`index.html`. Social-Netzwerke brauchen dafür absolute URLs, deshalb stehen dort
bisher nur die domainunabhängigen Tags. `public/robots.txt` greift ebenfalls erst
bei einer eigenen Domain – unter einem Pages-Unterpfad lesen Crawler nur die
`robots.txt` der Domainwurzel.

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/api/jolpica.ts` | API-Zugriff, Warteschlange, Cache |
| `src/App.tsx` | Auswahl, Tabs, Tabellen |
| `src/ProgressionChart.tsx` | WM-Verlauf als SVG |
| `src/index.css` | Theme-Token (hell/dunkel) |
| `src/App.css` | Layout und Komponenten |

## Zwei Dinge, die man wissen sollte

**Die API drosselt.** Jolpica erlaubt anonym rund vier Anfragen pro Sekunde und
500 pro Stunde und antwortet beim Überschreiten mit `429` – ohne `Retry-After`.
Der WM-Verlauf braucht eine Anfrage je Rennen, läuft also ohne Gegenmaßnahme
sofort ins Limit. `src/api/jolpica.ts` schickt deshalb alle Anfragen seriell
durch eine Warteschlange mit 300 ms Mindestabstand, wiederholt `429` und
Netzfehler mit wachsender Wartezeit, bündelt gleiche Pfade zu einer Anfrage und
legt Antworten sechs Stunden im `localStorage` ab.

**Die zuletzt gewertete Runde ist nicht die letzte im Kalender.** In einer
laufenden Saison stehen die hinteren Rennen noch aus; für sie liefert die API
keine Wertung. Die Vorauswahl kommt daher aus `/{saison}/driverstandings/`
(aktueller Stand samt Rundennummer), nicht aus dem Rennkalender. Noch nicht
gefahrene Rennen sind in der Auswahl ausgegraut.

## Farben im Graphen

Acht Fahrer bekommen eine eigene Farbe, alle weiteren laufen als graue
Sammelgruppe mit – ab der neunten Farbe wäre kein Ton mehr sicher von den
anderen zu unterscheiden. Die Reihenfolge der acht Töne ist gegen Rot-Grün- und
Blau-Gelb-Sehschwäche geprüft (schlechtestes Nachbarpaar ΔE 9,2 bei
Farbfehlsichtigkeit, 19,6 bei normalem Sehen, in hell wie dunkel). Die Farbe
hängt am Fahrer, nicht an seinem aktuellen Rang: Wer die Rennen-Auswahl
zurückdreht, sieht dieselben Linien in denselben Farben.

## Hinweis

Kein offizielles Angebot der Formel 1. F1, FORMULA ONE und Formel 1 sind Marken
der Formula One Licensing BV.
