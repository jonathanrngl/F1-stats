# F1-Statistiken

Formel 1 seit 1950, zu jedem Rennen: Fahrer- und Konstrukteurswertung, der
Punkteverlauf einer Saison, das Kräfteverhältnis innerhalb der Teams und die
Runde, in der der Titel rechnerisch entschieden war. Die Daten kommen live von
der [Jolpica-F1-API](https://api.jolpi.ca) (Ergast-Nachfolger).

React 19 + TypeScript + Vite, ohne Laufzeit-Abhängigkeiten über React hinaus.
Die Graphen sind handgezeichnetes SVG, keine Chart-Bibliothek.

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
| `src/analysis.ts` | Auswertungen als reine Funktionen |
| `src/App.tsx` | Auswahl, Tabs, Wertungstabellen |
| `src/SeasonChart.tsx` | Liniendiagramm für Punkteverlauf und Rückstand |
| `src/RaceAnalysis.tsx` | Teamduelle, Startplatz zu Ziel, Zuverlässigkeit |
| `src/TitleRace.tsx` | Titelrechner und Rückstandsgraph |
| `src/ThemeSwitch.tsx` | Hell / Dunkel / Systemeinstellung |
| `src/nations.ts` | Nationalität zu Länderkürzel |
| `src/index.css` | Theme-Token (hell/dunkel) |
| `src/App.css` | Layout und Komponenten |

## Die fünf Ansichten

**Fahrer- und Konstrukteurswertung** zeigen den Weltmeisterschaftsstand direkt
nach dem gewählten Rennen.

**WM-Verlauf** zeichnet die Punkte aller Fahrer über die Saison. Er baut sich
Runde für Runde auf, während die Daten eintreffen.

**Rennanalyse** wertet die Rennergebnisse aus: das Teamduell im selben Auto,
die Summe aus Startplatz minus Zielposition, den Anteil der Antritte, die in
der Wertung endeten, und die häufigsten Ausfallgründe.

**Titelkampf** zeigt den Rückstand zur Spitze – eine Linie, die nach unten
wegläuft, ist ein erledigter Titelkampf – und beantwortet die Frage, wann der
Titel rechnerisch feststand oder wer ihn noch gewinnen kann.

## Fünf Dinge, die man wissen sollte

**Die API drosselt.** Jolpica erlaubt anonym rund vier Anfragen pro Sekunde und
500 pro Stunde und antwortet beim Überschreiten mit `429` – ohne `Retry-After`.
`src/api/jolpica.ts` schickt deshalb alle Anfragen seriell durch eine
Warteschlange mit 300 ms Mindestabstand, wiederholt `429` und Netzfehler mit
wachsender Wartezeit, bündelt gleiche Pfade zu einer Anfrage und legt Antworten
sechs Stunden im `localStorage` ab.

**Die zuletzt gewertete Runde ist nicht die letzte im Kalender.** In einer
laufenden Saison stehen die hinteren Rennen noch aus; für sie liefert die API
keine Wertung. Die Vorauswahl kommt daher aus `/{saison}/driverstandings/`
(aktueller Stand samt Rundennummer), nicht aus dem Rennkalender. Noch nicht
gefahrene Rennen sind in der Auswahl ausgegraut.

**Ergebnisliste und Wertung sind zweierlei.** Die Rennanalyse holt eine ganze
Saison über `/{saison}/results/`. Dieser Endpunkt zählt Ergebniszeilen, nicht
Rennen, und deckelt eine Seite bei 100: eine moderne Saison kostet fünf
Anfragen statt einer pro Rennen. Für den WM-Verlauf taugt er trotzdem nicht.
Bis 1990 zählten nur die besten N Rennen zur Meisterschaft – 1988 fuhr Prost
105 Punkte ein, gewertet wurden 87. Nur `/driverstandings/` kennt diese
Streichresultate, und dort geht eine Anfrage je Runde drauf.

**Gewertet heißt nicht durchgekommen.** Wer 90 % der Distanz schafft, wird
gewertet, auch wenn das Auto danach stehen bleibt. 2024 trägt die API bei 49
Zeilen den Status „Retired“, sechs davon haben trotzdem eine Platzziffer
(Russell wurde in Australien als 17. gewertet, nach 56 Runden). Maßgeblich ist
deshalb `positionText`: eine Ziffer heißt gewertet, R/D/W/N/E nicht.

**Der Titelrechner rechnet konservativ.** Die Obergrenze je Wochenende kommt
aus der Saison selbst: höchste Rennpunktzahl aus der Ergebnisliste, dazu der
Sprintbonus an den Runden mit Sprint. Ein Pauschalwert wäre zu grob – 2024
stand der Titel nach Las Vegas fest (Vorsprung 65, danach höchstens 60 zu
holen); rechnet man beide Restrennen mit Sprintmaximum, kommt man auf 66 und
datiert die Entscheidung eine Runde zu spät. Geprüft an 2020 (Runde 14), 2021
(Runde 22), 2023 (Runde 17) und 2024 (Runde 22) – alle treffen. Nur die Jahre
mit Streichresultaten fallen heraus: 1988 stand Senna in Japan fest, weil
Prosts Mehrpunkte ohnehin verfallen wären; die Rechnung sagt Australien. Diese
Saisons erkennt die App und schreibt die Einschränkung dazu.

## Farben in den Graphen

Acht Fahrer bekommen eine eigene Farbe, alle weiteren laufen als graue
Sammelgruppe mit – ab der neunten Farbe wäre kein Ton mehr sicher von den
anderen zu unterscheiden. Die Reihenfolge der acht Töne ist gegen Rot-Grün- und
Blau-Gelb-Sehschwäche geprüft (schlechtestes Nachbarpaar ΔE 9,2 bei
Farbfehlsichtigkeit, 19,6 bei normalem Sehen, in hell wie dunkel). Die Farbe
hängt am Fahrer, nicht an seinem aktuellen Rang: Wer die Rennen-Auswahl
zurückdreht, sieht dieselben Linien in denselben Farben.

Statt Flaggen-Emoji steht das dreistellige Länderkürzel: Windows liefert keine
Schrift für Regional-Indicator-Paare, dort stünden zwei Buchstaben im Kästchen.

Die Theme-Token stehen je Rolle einmal in einem `light-dark()`; welcher der
beiden Werte gilt, entscheidet `color-scheme`, das der Umschalter über
`data-theme` am Wurzelelement setzt. Das setzt einen Browser ab 2024 voraus –
wie `text-wrap: pretty` an anderer Stelle auch.

## Am Telefon

Die Graphen nehmen ihre Maße aus der gemessenen Breite, nicht aus einer festen
`viewBox`. Eine feste Breite von 900 skaliert auf einem 360 Pixel breiten
Display auf 0,4 – aus 11 Pixel Achsenschrift würden gut vier. Bei Maßstab 1
bleibt jede Beschriftung lesbar. Der Auszug zu einem Rennen steht dort fest
unter dem Graphen statt schwebend daneben, und ein angetippter Wert bleibt
stehen: Beim Abheben des Fingers feuert der Browser `pointerleave`, der Wert
verschwände sonst im selben Moment, in dem man ihn lesen will.

## Hinweis

Kein offizielles Angebot der Formel 1. F1, FORMULA ONE und Formel 1 sind Marken
der Formula One Licensing BV.
