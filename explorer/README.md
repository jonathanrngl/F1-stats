# F1 Statistics Explorer

Die Seite unter <https://jonathanrngl.github.io/F1-stats/>: rund 2.500 statische
Seiten, eine JSON-API und ein Explorer, alles beim Bauen aus der F1DB-Datenbank
erzeugt. Die frühere React-Anwendung aus `../src` liegt eingefroren unter
`/classic/` (siehe `../README.md`).

Die ursprüngliche Planung steht in [`../docs/ARCHITEKTUR.md`](../docs/ARCHITEKTUR.md);
wo die Umsetzung davon abweicht, sagt das Dokument es am Anfang.

## Entwickeln

```bash
npm run import          # Datenbank aus der gepinnten F1DB-Fassung bauen (~15 s)
npm run dev             # http://localhost:4321/F1-stats/
npm run build           # alle Seiten nach dist/, danach Ausgabe- und Linkprüfung
npm run vorschau        # dist/ ausliefern wie GitHub Pages, auf :4323/F1-stats/
npm run lint            # oxlint über src/ und scripts/
npm test                # Statistik-Engine gegen die Datenbank
npm run test:oberflaeche  # die gebaute Seite im installierten Chrome
```

`npm run vorschau` ersetzt `astro preview`, das die Seiten ohne den Vorsatz
`/F1-stats/` und damit ohne Stylesheet ausliefert.

## Die Fassung der Daten

`f1db-version.txt` nennt die F1DB-Fassung, aus der die Seite gebaut wird.
Derselbe Commit ergibt an jedem Tag dieselbe Seite.

Eine neue Fassung bringt `.github/workflows/f1db-update.yml` herein: viermal am
Tag nachsehen, bei einer neueren importieren, alle Prüfungen laufen lassen,
probeweise bauen – und erst dann die Fassung festschreiben und den Deploy
anstoßen. Fällt eine Prüfung durch, bleibt die Seite beim letzten guten Stand.

```bash
npm run import                       # die gepinnte Fassung
npm run import -- --version v2026.15.0
npm run import -- --neueste          # die neueste veröffentlichte
npm run import -- --csv <pfad>       # aus einem bereits entpackten Verzeichnis
```

Fassung und Prüfsumme stehen in der Tabelle `meta`, im Fuß jeder Seite und in
`/data/version.json`.

## Nichts hängt am Tag des Bauens

„Das nächste Rennen“ ist das erste ohne Ergebnis in den Daten, nicht das
erste mit einem Datum in der Zukunft. Liegt ein gefahrenes Rennen noch ohne
Ergebnis vor, weil das Release hinterherhinkt, ist es weiter das nächste –
seine Punkte sind noch zu vergeben, und der Titelrechner zählt sie mit.

Wie viele Tage es noch sind, rechnet der Browser (`src/components/Countdown.astro`),
ebenso die Startzeiten der Sessions in der Ortszeit des Besuchers. Einen
täglichen Neubau braucht es deshalb nicht mehr.

## Punktesysteme als Daten

`src/engine/punkte.js` führt alle acht Punktesysteme seit 1950, die beiden
Sprintformate und die Streichresultate 1950–1990 – je Saison, auch die
geteilten Jahre 1967–1980. Die Tabelle beweist sich an der Geschichte:

- Sie rechnet jede Ergebniszeile seit 1991 auf den Punkt nach, davor bis auf
  einige Dutzend Einzelentscheidungen (Formel-2-Wagen ohne Punkteberechtigung,
  aberkannte Punkte, geteilte schnellste Runden).
- Mit den Streichregeln ergibt sie den amtlichen WM-Stand jedes Fahrers in
  allen 41 Saisons bis 1990.
- Halbe und doppelte Punkte (Spanien 1975, Abu Dhabi 2014, Belgien 2021 …)
  erkennt sie aus den Punkten des Siegers.

Darauf stehen der What-if-Rechner auf jeder Saisonseite (jedes System, mit
oder ohne Streichresultate), der Titelrechner der Vorschau (an allen
Titelentscheidungen seit 1991 nachgeprüft) und der „Anteil der möglichen
Punkte“ im Vergleich und im Explorer – der einzige Punktevergleich über
Epochen, der nicht an der Größe der Zahlen hängt.

## Der Explorer und die Fragen

`src/lib/abfrage.js` rechnet Abfragen über den Datenwürfel, im Browser und in
den Tests dieselbe Rechnung. `src/lib/frage.js` übersetzt eine Frage – englisch
oder deutsch – in eine solche Abfrage und gibt nie eine Antwort: Gerechnet
wird über die echten Daten. Was die Übersetzung nicht verwenden konnte, steht
darunter. Die Tests stellen dieselben Fragen wie ein Besucher und halten die
Spitze der Tabelle gegen eine unabhängige SQL-Zählung.

Jede Abfrage steht in der Adresse (`/explorer/?strecke=monaco&s=siege`) und
lässt sich teilen, ebenso jeder Vergleich (`/comparison/?a=…&b=…&von=…&bis=…`).

## Rundendaten

F1DB führt keine Rundendaten. `scripts/lade-runden.mjs` holt sie von Jolpica
(ab 1996) und legt je Rennen eine CSV nach `runden/`; der Import spielt sie ein
und lehnt jede Datei ab, deren Fahrer im Rennen nicht vorkommen. Die
Rennseite zeigt dann den Positionsverlauf und die Führungsrunden.

Der ganze Bestand sind rund 7.000 Anfragen bei 500 je Stunde. Den holt
`.github/workflows/runden.yml` in Portionen nach, jüngste Rennen zuerst.

## Tests

`npm test` prüft die Engine gegen die importierte Datenbank:

- **Massenabgleich:** Nennungen, Starts, Siege, Podien, Pole-Positions,
  schnellste Runden und Titel für jeden Fahrer, gegen die Gesamtzahlen, die
  F1DB selbst mitliefert. Zwei unabhängige Wege zum selben Wert.
- **Rekordbücher:** Fangio, Clark, Senna, Serien, Titelentscheidungen.
- **Punktesysteme, What-if, Titelrechner:** siehe oben.
- **Fragen und Explorer:** Übersetzung und Ergebnis, gegen SQL gehalten.
- **Invarianten statt fester Zahlen:** Wo ein Test „78 Hersteller“ erwartete,
  prüft er jetzt, dass jeder Hersteller mit Rennen in der Liste steht – eine
  neue F1DB-Fassung soll nicht an einer Zählung scheitern, die sich zu Recht
  ändert.

`npm run build` prüft danach die Ausgabe (`scripts/pruefe-ausgabe.mjs`):
zusammengeklebter Text und jeder seiteninterne Verweis, der ins Leere zeigt.

`npm run test:oberflaeche` öffnet die gebaute Seite in Chrome: keine
Konsolenfehler (auch keine Verletzung der Inhaltsrichtlinie), Suche,
Vergleich, Explorer und What-if funktionieren, Menü und Suche am Telefon,
Sprunglink, 404-Seite und die Umleitung alter Adressen.

## Pole-Position ist nicht Startplatz 1

Die Daten führen drei Zählungen, die sich erst in der Strafenära trennen.
Gemessen an Verstappen:

| Zählung | Anzahl |
|---|---|
| schnellste Zeit im Qualifying | **52** |
| von Startplatz 1 losgefahren | 48 |
| F1DBs eigenes Flag `polePosition` | 48 |

In Belgien 2024 war Verstappen Schnellster und startete nach einer Motorstrafe
als Elfter; die Rekordbücher schreiben ihm die Pole gut. `calculatePoles` nimmt
die sportliche Bedeutung, und dieselben Poles zählt die Pole-zu-Sieg-Quote.
`calculateStartsFromPole` steht daneben, F1DBs Flag dient nur dem Abgleich.

## Wann ein Rekord fällt

Die Seite `/changes/` rechnet den Verlauf jeder Bestmarke aus den Ergebnissen
nach: Alle gefahrenen Rennen laufen in zeitlicher Reihenfolge durch, und nach
jedem steht fest, ob die Spitze sich bewegt hat. Es gibt keine gepflegte Liste
von Rekordterminen – und der Endstand jeder Kette wird gegen die Rekordseite
geprüft, die dieselbe Zahl mit einem `GROUP BY` ermittelt. Dieselben Sätze
stehen im Atom-Feed `/feed.xml`.

**Jede Marke wächst in Einerschritten, also muss sie einstellen, wer sie
brechen will.** Hamilton stellte Schumachers 91 Siege beim Eifel-Grand-Prix
2020 ein und brach sie vierzehn Tage später in Portugal.

**Die Termine hängen an der Zählweise.** Hier wird in Starts gezählt, nicht in
Nennungen; die Seite sagt das dazu.

**Hochrechnungen sind als solche kenntlich.** Wie weit jemand von einer Marke
entfernt ist, steht in den Daten. Wann er sie erreicht, nicht.

## Das Quiz

`/quiz/` stellt Fragen aus sieben Bereichen in drei Stufen. **Keine Frage ist
von Hand geschrieben.** `src/engine/quiz.js` erzeugt sie beim Bauen aus der
Datenbank; die falschen Antworten stammen aus derselben Saison, demselben
Rennen oder derselben Bestenliste, Mehrdeutiges fällt weg, und der Zufall ist
gesät.

## Was am Archiv geprüft wird

Das Archiv ist fremde Eingabe, und aus ihm entsteht der gesamte Inhalt der
Seite.

**Die Prüfsumme.** Das Skript lädt die `checksums_sha256.txt` des Releases und
vergleicht. Das fängt den abgerissenen oder unterwegs veränderten Download –
nicht ein an der Quelle verändertes Release.

**Die Kennungen.** Aus `driver.id` wird unmittelbar `/drivers/<id>/`. Erlaubt
sind deshalb nur Kleinbuchstaben, Ziffern und Bindestriche, geprüft für jede
Kennung, die zu einer Adresse werden kann. Das ist die wichtigere Prüfung.

**Das Format.** Jede CSV muss die Spalten haben, die der Import liest, und
keine Zeile darf eine falsche Spaltenzahl haben. Vorher fiel eine solche Zeile
still weg, und eine umbenannte Spalte kam überall als NULL an.

**Der Import ersetzt die alte Datenbank erst, wenn alles bestanden ist.** Er
baut in eine Nebendatei; bricht er ab, bleibt die bisherige unberührt.
Geprüft werden Fremdschlüssel, genau ein Sieger je Rennen (außer bei
geteiltem Auto), keine Startplätze `0`, der Abgleich aller Fahrer mit F1DBs
Gesamtzahlen, Stichproben aus den Rekordbüchern und bekannte
Titelentscheidungen.

## Was der Import selbst herausfindet

**Genannt ist nicht gestartet.** Wer sich nicht qualifizierte (`DNQ`, `DNPQ`),
nicht antrat (`DNS`, `WD`, `DNA`, `DNP`) oder ausgeschlossen wurde (`EX`), war
gemeldet, stand aber nicht in der Startaufstellung. Mit genau dieser Liste
stimmt die Startzahl für jeden Fahrer mit F1DB überein.

**Streichresultate** erkennt der Import aus den Daten: Liegt der WM-Stand eines
Fahrers unter der Summe seiner Rennpunkte, wurde gestrichen.

**Sprint-Wochenenden** erkennt er aus den Sprintergebnissen. F1DB führt ein
Sprintdatum erst seit 2024; die Sprints 2021–2023 fehlten vorher.

## Deckung

Die Tabelle `coverage` hält fest, ab wann jede Kennzahl belegt ist, und
`/api/v1/coverage.json` gibt sie heraus. Die Oberfläche zeigt außerhalb davon
einen Gedankenstrich statt einer Null.

| Kennzahl | ab |
|---|---|
| Ergebnisse, Startplätze, Pole-Positions, schnellste Runden, Zielabstände | 1950 |
| Qualifying-Zeit (eine je Fahrer) | 1950, bis 2005 |
| Q1/Q2/Q3 getrennt | 2006 |
| Boxenstopps | 1994 |
| Fahrer des Tages | 2016 |
| Sprints | 2021 |
| Positionsverlauf je Runde, Führungsrunden | 1996 · für die Rennen in `runden/` |
| Reifenstints, Safety-Car, Wetter | 2023 · nicht geladen |

## Datenquelle

[F1DB](https://github.com/f1db/f1db), Creative Commons BY 4.0, neue Fassung nach
jedem Rennen. Rundendaten von [Jolpica-F1](https://api.jolpi.ca). Kein
offizielles Angebot der Formel 1.
