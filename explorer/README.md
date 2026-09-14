# F1 Statistics Explorer

Neubau neben der bestehenden Anwendung in `../src`. Die läuft unverändert
weiter, bis dieser Stand sie einholt.

Architektur und Begründungen: [`../docs/ARCHITEKTUR.md`](../docs/ARCHITEKTUR.md).

## Stand

| Schritt | Status |
|---|---|
| 1 · Import F1DB, Validierung | **fertig** |
| 2 · Statistik-Engine, Tests | offen |
| 3 · Seitengerüst Astro | offen |
| 4 · Fahrer-, Team-, Saison-, Renn-, Streckenseiten | offen |

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
