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
