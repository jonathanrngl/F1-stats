# F1-Statistiken

Formel-1-Statistiken von 1950 bis heute: Weltmeisterschaftsstände zu jedem
Rennen, Rennergebnisse, Qualifying, der Ablauf jedes Rennwochenendes, der
Punkteverlauf einer Saison als Graph, Saisonbestenlisten samt Boxenstopps und
die Laufbahn jedes einzelnen Fahrers.

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

Die Seite ist rein statisch – gebautes HTML, CSS, JS, keine Serverlogik und
keine Secrets. Die Daten holt der Browser direkt von den APIs.
`vite.config.ts` setzt `base: './'`, damit derselbe Build sowohl im
Wurzelverzeichnis einer eigenen Domain als auch im Unterpfad von GitHub Pages
(`/F1-stats/`) funktioniert. Die Auswahl steht im URL-Fragment, nicht im Pfad –
deshalb braucht kein Server eine Umschreibregel.

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

## Ansichten

| Tab | Inhalt |
|---|---|
| Fahrerwertung | WM-Stand der Fahrer nach dem gewählten Rennen |
| Konstrukteure | WM-Stand der Teams |
| Wochenende | alle Sessions des Rennwochenendes mit Termin in der Zeitzone des Lesers |
| Qualifying | Q1/Q2/Q3 und der Abstand auf die Bestzeit |
| Rennergebnis | Ziel, Startplatz, gutgemachte Plätze, Ausfallgrund, schnellste Runde – plus Sprint, wo es einen gab |
| WM-Verlauf | Punkteverlauf der Saison als Graph, jeder Fahrer anwählbar |
| Saison | Kennzahlen, acht Bestenlisten, alle Rennsieger, Ausfallbilanz, Boxenstopps |
| Fahrerkarriere | Suche über alle 881 Fahrer, dann die Laufbahn Saison für Saison und jedes Rennen |

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/api/cache.ts` | Zwischenspeicher für alle Quellen (Map + `localStorage`) |
| `src/api/jolpica.ts` | Hauptquelle: Warteschlange, Endpunkte, Karriere |
| `src/api/openf1.ts` | zweite Quelle, nur für Boxenstopp-Standzeiten |
| `src/api/pitstops.ts` | wählt zwischen den beiden Boxenstopp-Quellen |
| `src/lib/seasonStats.ts` | Bestenlisten und Boxenstopp-Wertung einer Saison |
| `src/lib/careerStats.ts` | Karrierebilanz und die Fahrersuche |
| `src/lib/format.ts` | Zahlen, Zeiten, Datumsangaben |
| `src/lib/status.ts` | Ausfallgründe auf Deutsch |
| `src/lib/nationality.ts` | Nationalitäten auf Deutsch |
| `src/lib/theme.ts` | Hell/Dunkel/Automatisch |
| `src/lib/urlState.ts` | Auswahl im URL-Fragment |
| `src/lib/useAsync.ts` | Laden der Ansichten, die erst beim Öffnen Daten brauchen |
| `src/components/DataTable.tsx` | sortierbare Tabelle für alle Ansichten |
| `src/ProgressionChart.tsx` | WM-Verlauf als SVG |
| `src/index.css` | Theme-Token, Animationen |
| `src/App.css` | Layout und Komponenten |

## Fünf Dinge, die man wissen sollte

**Die API drosselt.** Jolpica erlaubt anonym rund vier Anfragen pro Sekunde und
500 pro Stunde und antwortet beim Überschreiten mit `429` – ohne `Retry-After`.
`src/api/jolpica.ts` schickt deshalb alle Anfragen seriell durch eine
Warteschlange mit 300 ms Mindestabstand, wiederholt `429` und Netzfehler mit
wachsender Wartezeit, bündelt gleiche Pfade zu einer Anfrage und legt Antworten
sechs Stunden im `localStorage` ab. Teure Ansichten – WM-Verlauf, Boxenstopps –
laden erst, wenn man sie öffnet oder ausdrücklich anfordert.

In der Praxis fällt dabei gelegentlich eine einzelne Anfrage ohne
CORS-Antwortkopf aus; im Browser sieht das wie ein CORS-Fehler aus, ist aber ein
Aussetzer der Gegenseite. Die Wiederholung fängt das auf. Bei den Boxenstopps
lässt ein endgültig fehlendes Rennen den Lauf nicht platzen – es wird benannt
und ausgelassen.

**Die zuletzt gewertete Runde ist nicht die letzte im Kalender.** In einer
laufenden Saison stehen die hinteren Rennen noch aus; für sie liefert die API
keine Wertung. Die Vorauswahl kommt daher aus `/{saison}/driverstandings/`
(aktueller Stand samt Rundennummer), nicht aus dem Rennkalender. Noch nicht
gefahrene Rennen sind in der Auswahl ausgegraut.

**Es gibt keine Trainings-Ergebnisse und keine Überholmanöver.** Beides fehlt in
den Daten, und beides wird deshalb nicht erfunden:

* Für die freien Trainings führt die Schnittstelle keinen Endpunkt – weder
  Rundenzeiten noch eine Reihenfolge. Der Tab *Wochenende* zeigt darum die
  Termine aller Sessions und sagt an der Session, dass es dazu keine Ergebnisse
  gibt.
* Überholmanöver zählt keine der Quellen. Aus den Rundenpositionen liessen sie
  sich nur schätzen, wobei jeder Boxenstopp und jeder Ausfall als
  Überholvorgang gezählt würde. Stattdessen steht in den Bestenlisten
  *Plätze gutgemacht* – Startplatz minus Zielposition – und die Liste sagt
  ausdrücklich, dass das etwas anderes ist.

**Boxenstopp ist nicht Boxenstopp.** Zwei verschiedene Zeiten, die gern
verwechselt werden:

* Die **Standzeit** am Auto, die bekannten rund zwei Sekunden. Sie hängt nur an
  der Mannschaft und ist die einzige der beiden, die man über Strecken hinweg
  vergleichen darf. Sie kommt von OpenF1 und ist ungleichmässig vorhanden –
  2023 gar nicht, 2024 zu knapp einem Fünftel, 2025 zu etwa fünf Sechsteln.
  Deshalb wird keine Jahresgrenze behauptet: gezählt wird, was da ist, und die
  Abdeckung steht neben dem Ergebnis.
* Die **Zeit in der Boxengasse**, von der Einfahrt bis zur Ausfahrt. Sie ist die
  einzige Zahl, die Jolpica führt, und sie hängt an der Länge der Boxengasse und
  an der Rennsituation. In Zandvoort 2022 stoppte in den Runden 55 bis 57 das
  halbe Feld unter Safety Car; die zehn kürzesten Werte der ganzen Saison
  stammen aus diesen drei Runden, bei einem Rennmedian von 19,5 Sekunden.
  Umgekehrt stehen Rotphasen als `50:37.323` in den Daten. Eine Saisonbestzeit
  darüber wäre keine belastbare Zahl – sie steht deshalb nur je Rennen und
  immer neben dem Median desselben Rennens.

**Farben im Graphen.** Acht Fahrer bekommen eine eigene Farbe, alle weiteren
laufen als graue Sammelgruppe mit – ab der neunten Farbe wäre kein Ton mehr
sicher von den anderen zu unterscheiden. Die Reihenfolge der acht Töne ist gegen
Rot-Grün- und Blau-Gelb-Sehschwäche geprüft (schlechtestes Nachbarpaar ΔE 9,2
bei Farbfehlsichtigkeit, 19,6 bei normalem Sehen, in hell wie dunkel). Die Farbe
hängt am Fahrer, nicht an seinem aktuellen Rang: Wer die Rennen-Auswahl
zurückdreht, sieht dieselben Linien in denselben Farben. Anwählen lässt sich
trotzdem jeder Fahrer – wer aus der Sammelgruppe gewählt wird, bekommt seine
Linie in Textfarbe obenauf, was keine neue Dauerfarbe ist, sondern die
Markierung des einen Ausgewählten.

## Datenquellen

* [Jolpica-F1](https://api.jolpi.ca) – Ergast-Nachfolger, Hauptquelle für alles
  von 1950 an.
* [OpenF1](https://openf1.org) – ausschliesslich für die Standzeit am Auto, ab
  2023.

## Hinweis

Kein offizielles Angebot der Formel 1. F1, FORMULA ONE und Formel 1 sind Marken
der Formula One Licensing BV.
