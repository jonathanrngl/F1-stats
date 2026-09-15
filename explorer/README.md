# F1 Statistics Explorer

Neubau neben der bestehenden Anwendung in `../src`. Die läuft unverändert
weiter, bis dieser Stand sie einholt.

Architektur und Begründungen: [`../docs/ARCHITEKTUR.md`](../docs/ARCHITEKTUR.md).

## Stand

| Schritt | Status |
|---|---|
| 1 · Import F1DB, Validierung | **fertig** |
| 2 · Statistik-Engine, Tests | **fertig** |
| 3 · Seitengerüst Astro, Fahrerprofile | **fertig** |
| 4 · Team-, Saison-, Renn-, Streckenseiten | **fertig** |
| 5 · Rekorddatenbank | **fertig** |
| 6 · JSON-API und Fahrervergleich | **fertig** |
| 7 · Lader für Rundendaten | **fertig**, Nachladen offen |
| 8 · WM-Punkteverlauf | **fertig** |
| 9 · What-if: anderes Punktesystem | **fertig** |
| 10 · Data Explorer mit Export | **fertig** |
| 11 · Statistik-Suche in natürlicher Sprache | **fertig** |
| 12 · Stints und Wetter (OpenF1, ab 2023) | offen |
| 13 · Änderungen: Bewegung in den Rekordlisten | **fertig** |
| 13 · Rennvorschau auf das nächste Rennen | **fertig** |

## Entwickeln

```bash
npm run import   # Datenbank bauen (einmalig, 8 s)
npm run dev      # http://localhost:4321/F1-stats/
npm run build    # 2384 statische Seiten in ~31 s nach dist/
```

Der Build erzeugt fertiges HTML: 2384 Seiten, fünf JavaScript-Dateien in der
gesamten Ausgabe. Eine Fahrerseite wiegt 18 KB und braucht kein JavaScript, um
ihre Zahlen zu zeigen.

`npm run dev` bindet den Vorsatz `/F1-stats/` ein, unter dem die Seite auf
GitHub Pages liegt. `npx astro preview` tut das nicht und liefert die Seiten
ohne Stylesheet aus – zum Ansehen des Builds ist der Entwicklungsserver der
verlässlichere Weg.

## Tests

```bash
npm test        # 89 Prüfungen gegen die importierte Datenbank
```

Der Massenabgleich rechnet Nennungen, Starts, Siege, Podien, Pole-Positions,
schnellste Runden und Titel für **alle 860 Fahrer** neu und vergleicht mit den
Gesamtzahlen, die F1DB mitliefert. Dazu Einzelfälle gegen die Rekordbücher und
Randfälle: leere Eingaben, Division durch null, Fahrer ohne einen einzigen
Start, geteilte Fahrten.

## Pole-Position ist nicht Startplatz 1

Die Daten führen drei Zählungen, die sich erst in der Strafenära trennen.
Gemessen an Verstappen:

| Zählung | Anzahl |
|---|---|
| schnellste Zeit im Qualifying | **52** |
| von Startplatz 1 losgefahren | 48 |
| F1DBs eigenes Flag `polePosition` | 48 |

In Belgien 2024 war Verstappen Schnellster und startete nach einer Motorstrafe
als Elfter; die Rekordbücher schreiben ihm die Pole gut. Umgekehrt holte
Leclerc in Monaco 2021 die Pole und ging gar nicht an den Start. Bis in die
2000er fallen alle drei Zählungen zusammen – Fangios 29 und Sennas 65 stimmen
in jeder.

`calculatePoles` nimmt die sportliche Bedeutung, `calculateStartsFromPole`
steht daneben. F1DBs Flag dient nur dem Abgleich.

## Wann ein Rekord fällt

Die Seite `/aenderungen/` rechnet den Verlauf jeder Bestmarke aus den
Ergebnissen nach: Alle 1163 gefahrenen Rennen laufen in zeitlicher Reihenfolge
durch, und nach jedem steht fest, ob die Spitze sich bewegt hat. Es gibt keine
gepflegte Liste von Rekordterminen, die jemand zu aktualisieren vergessen
könnte – und der Endstand jeder Kette wird gegen die Rekordseite geprüft, die
dieselbe Zahl mit einem `GROUP BY` ermittelt.

Dabei fällt eine Eigenschaft auf, die man erst sieht, wenn man es so rechnet:
**Jede Marke wächst in Einerschritten, also muss sie einstellen, wer sie
brechen will.** Wer von 91 auf 92 will, stand vorher bei 91 – und damit auf der
Marke. Überholen ohne vorheriges Gleichziehen gibt es nicht. Hamilton stellte
Schumachers 91 Siege beim Eifel-Grand-Prix 2020 ein und brach sie vierzehn Tage
später in Portugal.

**Die Termine hängen an der Zählweise.** Hier wird in Starts gezählt, nicht in
Nennungen. Räikkönen erreichte Barrichellos 322 Starts in Mugello 2020 und zog
zwei Rennen später in Sotschi vorbei; seine 326. *Nennung* – die in den
Rekordbüchern übliche Marke – fiel erst beim Eifel-Grand-Prix. Beide Angaben
sind richtig, sie zählen Verschiedenes. Die Seite sagt das dazu.

**Hochrechnungen sind als solche kenntlich.** Wie weit jemand von einer Marke
entfernt ist, steht in den Daten. Wann er sie erreicht, nicht. Die
Fortschreibung nimmt die Trefferquote der letzten drei Saisons; wer darin zu
wenige Starts oder keinen Erfolg dieser Art hat, bekommt keine Zahl statt einer
unendlichen. Hält ein noch aktiver Fahrer die Marke selbst, wächst sie weiter,
während der Verfolger aufholt – auch das steht an der Zeile.

## Import

```bash
npm run import                  # lädt das aktuelle F1DB-Release und baut data/f1.sqlite
npm run import -- --csv <pfad>  # aus einem bereits entpackten Verzeichnis
```

Der Lauf dauert rund acht Sekunden und erzeugt eine 23 MB große SQLite-Datei.
`data/` ist nicht eingecheckt – die Datenbank entsteht aus dem Release.

**Der Import schreibt nichts, wenn eine Prüfung fehlschlägt.** Lieber keine
Datenbank als eine mit falschen Zahlen. Geprüft wird:

- Fremdschlüssel vollständig auflösbar
- je Rennen genau ein Sieger, außer bei geteiltem Auto (dann als solches markiert)
- kein Startplatz `0` – Lücken sind `NULL`
- **Nennungen, Starts, Siege, Pole-Positions und schnellste Runden stimmen für
  alle 860 Fahrer mit den Gesamtzahlen überein, die F1DB selbst mitliefert.**
  Zwei unabhängige Wege zum selben Wert; weicht einer ab, ist eine Annahme falsch.
- Einzelfälle gegen die Rekordbücher: Fangio 51/24/29, Clark 72/25/33, Senna 161/41/65
- Titelentscheidungen 2020 (Runde 14), 2021 (22), 2023 (17), 2024 (22)

## Zwei Dinge, die der Import selbst herausfindet

**Genannt ist nicht gestartet.** Wer sich nicht qualifizierte (`DNQ`, `DNPQ`),
nicht antrat (`DNS`, `WD`, `DNA`, `DNP`) oder ausgeschlossen wurde (`EX`), war
gemeldet, stand aber nicht in der Startaufstellung. Aguri Suzuki kommt so auf
88 Nennungen bei 65 Starts, Senna auf 162 bei 161. Die Liste dieser sieben
Werte ist nicht geraten: Mit ihr stimmt die Startzahl für alle 860 Fahrer, ohne
sie für 445. `NC` und `DSQ` zählen als Start – diese Fahrer sind losgefahren.

**Streichresultate erkennt der Import aus den Daten**, nicht aus einer
gepflegten Regeltabelle: Liegt der WM-Stand eines Fahrers unter der Summe
seiner Rennpunkte, wurde gestrichen. Ergebnis sind 26 Saisons zwischen 1950 und
1990 – genau die bekannte Epoche.

## Deckung

Die Tabelle `coverage` hält fest, ab wann jede Kennzahl belegt ist. Die
Oberfläche fragt sie, bevor sie eine Null anzeigt – sonst wird aus einer
Datenlücke eine Aussage.

| Kennzahl | ab |
|---|---|
| Ergebnisse, Startplätze, Pole-Positions, schnellste Runden, Zielabstände | 1950 |
| Qualifying-Zeit (eine je Fahrer) | 1950, bis 2005 |
| Q1/Q2/Q3 getrennt | 2006 |
| Boxenstopps | 1994 |
| Fahrer des Tages | 2016 |
| Positionsverlauf je Runde, Führungsrunden | 1996 · noch nicht geladen |
| Reifenstints, Safety-Car, Wetter | 2023 · noch nicht geladen |

## Datenquelle

[F1DB](https://github.com/f1db/f1db), Creative Commons BY 4.0, neue Fassung
nach jedem Rennen. Kein offizielles Angebot der Formel 1.
