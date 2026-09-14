# F1 Statistics Explorer – Architektur und Datenstrategie

Stand: 14. September 2026. Grundlage ist die Spezifikation für eine
Statistikplattform mit Fahrerprofilen, Vergleichen, Team-, Saison-, Renn- und
Streckenseiten, Rekorddatenbank, Data Explorer und natürlichsprachlicher Suche.

Dieses Dokument beantwortet die Schritte 1 bis 5 der Vorgabe: Analyse des
Bestands, technische Architektur, Datenmodell, Datenquellen samt
Importstrategie, API-Struktur. Implementiert wird erst danach.

---

## 1. Analyse des Bestands

Die heutige Anwendung ist eine reine Browser-Anwendung: React 19, TypeScript,
Vite, keine Laufzeit-Abhängigkeit außer React. Rund 3000 Zeilen in zehn
Dateien. Sechs Ansichten: Fahrerwertung, Konstrukteurswertung, WM-Verlauf,
Rennanalyse, Titelkampf, Karriere.

### Was trägt

**Die Auswertungen sind reine Funktionen.** `src/analysis.ts` nimmt Rohdaten
und gibt Kennzahlen zurück, ohne Netzzugriff und ohne React. Das ist genau die
Trennung, die die Spezifikation unter „Statistik-Engine“ verlangt – der Kern
ist bereits da, er muss nur auf ein anderes Datenmodell umgestellt werden.

**Die Epochenfallen sind erkannt und behandelt.** Der Bestand behandelt
bereits Fälle, an denen die meisten F1-Statistikseiten scheitern:

| Fall | Behandlung im Code |
|---|---|
| Streichresultate bis 1990 | `hadDroppedScores()`; WM-Stand kommt aus der Wertung, nicht aus der Summe der Rennpunkte |
| Geteilte Fahrzeuge der 1950er | `mergeRows()`; Fangio hat 58 Ergebniszeilen bei 51 Starts |
| „Gewertet“ vs. „durchgekommen“ | `positionText` statt `status`; 90-Prozent-Regel |
| Sprints ab 2021 | `roundCaps()` mit rundengenauer Obergrenze |
| Fehlende Startplätze (`grid = "0"`) | Aus allen Mittelwerten ausgeschlossen |
| Poles vor 1996 nicht überliefert | Ersatzweise Startplatz 1, ehrlich beschriftet |

Diese Logik ist gegen die Rekordbücher geprüft: Fangio 51 Starts / 24 Siege /
29 aus Startplatz 1 / 35 Podien, Clark 72/25/33/32, Senna 161/41/65/80 – alle
exakt. Titelentscheidungen 2020 (Runde 14), 2021 (22), 2023 (17), 2024 (22)
treffen ebenfalls.

**Der API-Client ist auf Drosselung ausgelegt.** Serielle Warteschlange mit
300 ms Abstand, Wiederholung bei 429 mit wachsender Wartezeit, Bündelung
gleicher Pfade, Cache im `localStorage` mit nach Pfadalter gestaffelter
Lebensdauer.

### Was die Spezifikation blockiert

**Jede Zahl entsteht live aus einer gedrosselten API.** Jolpica erlaubt rund
vier Anfragen pro Sekunde und 500 pro Stunde. Das reicht für „eine Saison
ansehen“ und trägt keine einzige der Beispielfragen aus der Spezifikation, die
über Saisongrenzen hinweggehen.

Konkret gemessen: Der WM-Verlauf einer modernen Saison kostet 24 Anfragen und
gut acht Sekunden. Ein Karriereprofil kostet drei bis fünf Anfragen plus eine
je Saison. Eine Frage wie „Alle Fahrer von 2000–2026 mit mindestens fünf
Siegen und zwanzig Podien“ bräuchte den gesamten Ergebnisbestand – 26.181
Zeilen, 262 Anfragen – und wäre nach einer Handvoll solcher Fragen am
Stundenlimit.

**Es gibt keinen Zustand in der Adresse.** Saison, Rennen und Ansicht leben
nur im React-State. Nichts ist verlinkbar, der Zurück-Knopf verlässt die
Anwendung, und SEO ist nicht möglich: Der Server liefert eine leere Seite.

**Es gibt keine Entitäten, nur Ansichten.** Es existiert kein Strecken-, Team-
oder Rennobjekt, an dem eine Seite hängen könnte. Fahrer sind erst seit dem
Karriere-Tab ein eigenes Konzept.

### Verwertbar für den Neubau

- `src/analysis.ts` – Rechenlogik samt Epochenbehandlung, auf neues Modell umzustellen
- `src/SeasonChart.tsx` – Liniendiagramm, das seine Maße aus der gemessenen Breite nimmt
- `src/nations.ts` – Nationalität zu Länderkürzel
- `src/index.css` – Theme-Token mit `light-dark()`, geprüfte Serienfarben gegen Farbfehlsichtigkeit
- Die dokumentierten Epochenentscheidungen in `README.md`

Nicht verwertbar: `src/api/jolpica.ts` in seiner jetzigen Rolle (wird zum
Importer), `src/App.tsx` (Tab-Struktur weicht einer Seitenstruktur).

---

## 2. Datenquellen

Das ist die Entscheidung, an der alles andere hängt. Drei Quellen kommen in
Frage; sie ergänzen einander und decken unterschiedliche Zeiträume ab.

### F1DB – die Basis

[github.com/f1db/f1db](https://github.com/f1db/f1db), Creative Commons BY 4.0,
neue Fassung nach jedem Rennen. Aktuell v2026.14.0 vom 13. September 2026.

Enthält alle Saisons seit 1950: Fahrer, Konstrukteure samt Chassis,
Motorenhersteller samt Motoren, Reifenhersteller, Strecken samt Layouts und
SVG-Grafiken, Nennungen, Wertungen, Rennen mit freiem Training, Qualifying und
Vorqualifikation, Sprints, Startaufstellungen, Ergebnissen, schnellsten
Runden, Boxenstopps und Fahrer des Tages.

Artefakte: CSV 4,5 MB gepackt, JSON 6,7 MB, SQL-Dumps für MySQL, PostgreSQL
und SQLite je 5,8 MB, fertige SQLite-Datei 15,6 MB gepackt.

**Das ist die richtige Basis.** Ein Download statt 500+ API-Anfragen, bereits
normalisiert, mit Entitäten, die Jolpica gar nicht kennt (Motorenhersteller,
Reifenhersteller, Chassis, Streckenlayouts).

### Jolpica – Ergänzung und Rundendaten

[api.jolpi.ca](https://api.jolpi.ca), der Ergast-Nachfolger. Bleibt relevant
für zwei Dinge:

- **Rundenweise Positionen** (`/{saison}/{runde}/laps/`) – die einzige Quelle
  für Positionsverläufe und Führungsrunden vor 2023. Gemessen: ab 1996
  vorhanden, davor null Zeilen.
- **Zwischenstände während eines laufenden Wochenendes**, falls die
  Plattform Ergebnisse vor der nächsten F1DB-Fassung zeigen soll.

### OpenF1 – nur ab 2023

[openf1.org](https://openf1.org). Rundenzeiten, Sektoren, Reifenstints,
Wetter, Telemetrie. Kostenlos, drei Anfragen pro Sekunde. **Deckt
ausschließlich 2023 und später ab.**

### Deckungsmatrix

Das ist der ehrliche Teil. Mehrere Punkte der Spezifikation sind für die
Formel-1-Geschichte schlicht nicht verfügbar:

| Datum | Verfügbar ab | Quelle | Anmerkung |
|---|---|---|---|
| Ergebnisse, Startplätze, Punkte | 1950 | F1DB | vollständig |
| Wertungen (Fahrer/Konstrukteure) | 1950 / 1958 | F1DB | Konstrukteurs-WM erst ab 1958 |
| Qualifying-Positionen | 1950 | F1DB | |
| Qualifying-Zeiten Q1/Q2/Q3 | 2006 | F1DB | 2005 nur Q1/Q2, 1996–2004 eine Zeit, davor keine |
| Schnellste Rennrunde | 2004 | F1DB | davor lückenhaft bis gar nicht |
| Boxenstopps | 2011 | F1DB | gemessen: 2010 liefert null |
| Positionsverlauf je Runde | 1996 | Jolpica | gemessen: 1995 liefert null |
| **Führungsrunden** | **1996** | abgeleitet aus Rundendaten | vor 1996 **nicht ermittelbar** |
| **Führungs-Kilometer** | **1996** | Führungsrunden × Streckenlänge | Näherung, Streckenlänge ändert sich mit Layout |
| **Reifenstints** | **2023** | OpenF1 | vorher **nicht verfügbar** |
| **Safety-Car-Phasen** | **2023** | OpenF1 | vorher **nicht verfügbar** |
| **Wetter** | **2023** | OpenF1 | vorher **nicht verfügbar** |
| Fahrer des Tages | 2016 | F1DB | Publikumsabstimmung, erst seit 2016 |

**Folgerung für die Spezifikation:** Führungsrunden, Führungs-km, Stints,
Safety-Car und Wetter dürfen nicht als Kernkennzahlen eines Fahrerprofils oder
einer Streckenseite geführt werden. Sie gehören in Abschnitte, die sich selbst
als zeitlich begrenzt ausweisen. Ein Profil von Fangio, das „Führungsrunden:
0“ zeigt, ist falsch – es muss „nicht überliefert“ heißen. Diese Regel gilt im
Bestand bereits für schnellste Runden und ist konsequent auszuweiten.

---

## 3. Architekturempfehlung

### Die entscheidende Messung

Der gesamte Datenbestand ist klein. Gemessen über die API: **1172 Rennen,
26.181 Ergebniszeilen, 881 Fahrer, 78 Strecken.** Als gepackte CSV sind das
4,5 MB für die komplette Formel-1-Geschichte.

Das heißt: **Der vollständige Datenbestand passt in den Browser.** Eine
Abfrage wie „alle Fahrer mit mindestens fünf Siegen zwischen 2000 und 2026“
läuft über 26.181 Zeilen – das sind Millisekunden in JavaScript, ohne Server,
ohne Datenbank, ohne Netzwerkrunde.

### Empfehlung: Build-Zeit-Import, statische Auslieferung, Rechnen im Client

```
                    Build (CI, nach jedem Rennen)
  ┌──────────────────────────────────────────────────────────┐
  │  F1DB-Release  ──→  Import + Validierung  ──→  SQLite     │
  │  (CSV, 4,5 MB)       (Fremdschlüssel,         (lokal)     │
  │                       Plausibilität)             │        │
  │  Jolpica /laps/ ──→  Rundenpositionen ──────────→│        │
  │  (1996+, einmalig)                               │        │
  │  OpenF1 ────────→  Stints/Wetter (2023+) ───────→│        │
  │                                                  ↓        │
  │                                      Statistik-Engine     │
  │                                                  │        │
  │                   ┌──────────────────────────────┤        │
  │                   ↓              ↓               ↓        │
  │            HTML-Seiten     JSON-API        Explorer-Daten │
  │            (~2500, SEO)   (statisch)       (kompakt)      │
  └──────────────────────────────────────────────────────────┘
                              ↓
                    CDN / GitHub Pages
                              ↓
                    Browser: dieselbe Engine
                    rechnet Vergleiche, Explorer,
                    Filter live über die Daten
```

**Warum kein Server?**

Die Daten ändern sich 24-mal im Jahr, nicht 24-mal pro Sekunde. Ein Server,
der bei jedem Aufruf dieselben unveränderlichen Zahlen neu aus einer Datenbank
aggregiert, löst ein Problem, das hier nicht existiert – und bringt Betrieb,
Kosten und eine Fehlerquelle mit. Alles, was vorab berechenbar ist, wird
vorab berechnet; alles Übrige ist klein genug für den Client.

**Was das gewinnt:**

- Auslieferung über GitHub Pages oder ein CDN, kein Hosting nötig
- Jede Entitätsseite ist fertiges HTML – SEO und Ladezeit ohne Zusatzaufwand
- Der Data Explorer rechnet ohne Netzwerkrunde; Filter reagieren sofort
- Die statischen JSON-Dateien **sind** die API – cachebar, versionierbar,
  von Mobile-Apps direkt nutzbar
- Kein Unterschied zwischen „was die API rechnet“ und „was die UI rechnet“:
  dieselbe Engine läuft an beiden Stellen

**Wo es an Grenzen stößt – und was dann:**

Natürlichsprachliche Suche mit einem Sprachmodell braucht einen Endpunkt.
Dafür genügt später eine einzelne Funktion (Cloudflare Worker, Vercel
Function), die eine Frage in eine Explorer-Abfrage übersetzt und diese
Abfrage zurückgibt – **nicht** die Antwort. Gerechnet wird weiter im Client,
über die echten Daten. Damit kann das Modell keine Fakten erfinden: Es
formuliert nur den Filter, und der Nutzer sieht ihn.

Sollte der Datenbestand später doch einen echten Server verlangen, wandert
dasselbe Schema nach PostgreSQL und dieselbe Engine hinter Fastify. Die Engine
ist gegen das Datenmodell geschrieben, nicht gegen eine Transportform.

### Technischer Rahmen

| Baustein | Wahl | Begründung |
|---|---|---|
| Framework | **Astro** mit React-Inseln | Statische Erzeugung tausender Seiten, JavaScript nur dort, wo interagiert wird. Bestehende React-Komponenten bleiben nutzbar. |
| Sprache | TypeScript, strikt | wie bisher |
| Import/Build | Node-Skripte, `better-sqlite3` | Import, Validierung, Vorberechnung |
| Explorer-Daten | kompaktes Spaltenformat (Parquet über DuckDB-WASM oder getypte Arrays) | 26k Zeilen; DuckDB-WASM erlaubt echtes SQL im Browser |
| Diagramme | eigenes SVG, wie bisher | keine Chart-Bibliothek; der bestehende `SeasonChart` bleibt |
| Tests | Vitest | Engine ist rein, also gut testbar |

Alternative, falls ein einziges Framework gewünscht ist: Next.js mit
statischem Export. Gleiches Ergebnis, mehr ausgeliefertes JavaScript.

---

## 4. Datenmodell

Relational, an F1DB angelehnt, aber auf das reduziert, was die Plattform
braucht. Alle Schlüssel sind sprechende Bezeichner (`max-verstappen`,
`monaco`), damit sie zugleich als URL-Segment dienen.

```sql
-- ------------------------------------------------------------ Stammdaten

CREATE TABLE driver (
  id             TEXT PRIMARY KEY,      -- 'max-verstappen'
  given_name     TEXT NOT NULL,
  family_name    TEXT NOT NULL,
  abbreviation   TEXT,                  -- 'VER', fehlt bei vielen
  nationality    TEXT,                  -- fehlt bei 16 Fahrern, siehe Datenqualität
  date_of_birth  TEXT,                  -- ISO, kann fehlen
  date_of_death  TEXT,
  first_season   INTEGER NOT NULL,
  last_season    INTEGER NOT NULL,
  is_active      INTEGER NOT NULL       -- letzte Saison == aktuelle Saison
);

CREATE TABLE constructor (
  id             TEXT PRIMARY KEY,      -- 'red-bull'
  name           TEXT NOT NULL,
  full_name      TEXT,
  nationality    TEXT,
  first_season   INTEGER NOT NULL,
  last_season    INTEGER NOT NULL
);

-- Teamnamen wechseln, Rennställe werden verkauft. Jaguar wurde Red Bull,
-- Toro Rosso wurde AlphaTauri wurde RB. Ohne diese Tabelle ist jede
-- Team-Historie falsch.
CREATE TABLE constructor_lineage (
  lineage_id      TEXT NOT NULL,        -- 'red-bull-lineage'
  constructor_id  TEXT NOT NULL REFERENCES constructor(id),
  from_season     INTEGER NOT NULL,
  to_season       INTEGER,
  PRIMARY KEY (lineage_id, constructor_id)
);

CREATE TABLE circuit (
  id             TEXT PRIMARY KEY,      -- 'monaco'
  name           TEXT NOT NULL,
  locality       TEXT,
  country        TEXT,
  latitude       REAL,
  longitude      REAL
);

-- Ein Kurs ändert sich: Hockenheim 2001, Silverstone 2010. Rundenzeiten und
-- Führungs-Kilometer über Layoutgrenzen hinweg zu vergleichen ist unzulässig.
CREATE TABLE circuit_layout (
  circuit_id     TEXT NOT NULL REFERENCES circuit(id),
  from_season    INTEGER NOT NULL,
  to_season      INTEGER,
  length_m       INTEGER,
  turns          INTEGER,
  PRIMARY KEY (circuit_id, from_season)
);

-- --------------------------------------------------------------- Saison

CREATE TABLE season (
  year                 INTEGER PRIMARY KEY,
  race_count           INTEGER NOT NULL,
  has_constructors_championship INTEGER NOT NULL,  -- erst ab 1958
  points_system_id     TEXT NOT NULL REFERENCES points_system(id),
  -- Streichresultate: nur die besten N Ergebnisse zählten (bis 1990).
  -- NULL heißt: alle zählen.
  best_results_counted INTEGER
);

-- Das Punktesystem gehört in die Daten, nicht in den Code. Es hat sich seit
-- 1950 mehr als ein Dutzend Mal geändert.
CREATE TABLE points_system (
  id             TEXT PRIMARY KEY,      -- '2010-2018', '1950-1959'
  description    TEXT NOT NULL
);

CREATE TABLE points_award (
  points_system_id TEXT NOT NULL REFERENCES points_system(id),
  session          TEXT NOT NULL,       -- 'race' | 'sprint' | 'fastest-lap'
  position         INTEGER,             -- NULL bei Bonuspunkten
  points           REAL NOT NULL,
  condition        TEXT,                -- z. B. 'top-10' für die schnellste Runde
  PRIMARY KEY (points_system_id, session, position, condition)
);

-- ---------------------------------------------------------------- Rennen

CREATE TABLE race (
  id             TEXT PRIMARY KEY,      -- 'monaco-grand-prix-2024'
  season         INTEGER NOT NULL REFERENCES season(year),
  round          INTEGER NOT NULL,
  name           TEXT NOT NULL,
  circuit_id     TEXT NOT NULL REFERENCES circuit(id),
  date           TEXT NOT NULL,
  scheduled_laps INTEGER,
  had_sprint     INTEGER NOT NULL DEFAULT 0,
  -- Abgebrochene Rennen wurden halb gewertet (Belgien 2021, Monaco 1984).
  half_points    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (season, round)
);

-- Wer für wen antrat. Ein Fahrer kann in einer Saison mehrere Teams haben,
-- ein Team mehr als zwei Fahrer.
CREATE TABLE entry (
  race_id        TEXT NOT NULL REFERENCES race(id),
  driver_id      TEXT NOT NULL REFERENCES driver(id),
  constructor_id TEXT NOT NULL REFERENCES constructor(id),
  car_number     TEXT,
  PRIMARY KEY (race_id, driver_id, constructor_id)
);

CREATE TABLE race_result (
  race_id        TEXT NOT NULL REFERENCES race(id),
  driver_id      TEXT NOT NULL REFERENCES driver(id),
  constructor_id TEXT NOT NULL REFERENCES constructor(id),
  -- Laufende Nummer, weil ein Fahrer in den 1950ern zwei Autos fahren konnte.
  -- Siehe Datenqualität: Fangio hat 58 Zeilen bei 51 Starts.
  entry_index    INTEGER NOT NULL DEFAULT 0,
  position       INTEGER,               -- NULL wenn nicht gewertet
  position_text  TEXT NOT NULL,         -- '1', 'R', 'D', 'W', 'N', 'E'
  classified     INTEGER NOT NULL,      -- abgeleitet, indiziert
  grid           INTEGER,               -- NULL = nicht überliefert (statt 0)
  laps_completed INTEGER,
  status         TEXT,
  time_ms        INTEGER,
  gap_ms         INTEGER,               -- zum Sieger, abgeleitet
  points         REAL NOT NULL DEFAULT 0,
  fastest_lap    INTEGER NOT NULL DEFAULT 0,
  -- Geteilte Fahrt: dieselbe Position wird mehrfach vergeben
  shared_drive   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (race_id, driver_id, entry_index)
);

CREATE TABLE qualifying_result (
  race_id        TEXT NOT NULL REFERENCES race(id),
  driver_id      TEXT NOT NULL REFERENCES driver(id),
  constructor_id TEXT NOT NULL REFERENCES constructor(id),
  position       INTEGER,
  q1_ms          INTEGER,               -- NULL wenn nicht gefahren oder nicht überliefert
  q2_ms          INTEGER,
  q3_ms          INTEGER,
  PRIMARY KEY (race_id, driver_id)
);

CREATE TABLE sprint_result (
  race_id        TEXT NOT NULL REFERENCES race(id),
  driver_id      TEXT NOT NULL REFERENCES driver(id),
  constructor_id TEXT NOT NULL REFERENCES constructor(id),
  position       INTEGER,
  position_text  TEXT NOT NULL,
  grid           INTEGER,
  points         REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (race_id, driver_id)
);

-- Rundenweise Position. Erst ab 1996 vorhanden - die Tabelle ist für frühere
-- Jahre leer, und das muss die Oberfläche sagen können.
CREATE TABLE lap_position (
  race_id        TEXT NOT NULL REFERENCES race(id),
  driver_id      TEXT NOT NULL REFERENCES driver(id),
  lap            INTEGER NOT NULL,
  position       INTEGER NOT NULL,
  time_ms        INTEGER,
  PRIMARY KEY (race_id, driver_id, lap)
);

CREATE TABLE pit_stop (                 -- erst ab 2011
  race_id        TEXT NOT NULL REFERENCES race(id),
  driver_id      TEXT NOT NULL REFERENCES driver(id),
  stop           INTEGER NOT NULL,
  lap            INTEGER NOT NULL,
  duration_ms    INTEGER,
  PRIMARY KEY (race_id, driver_id, stop)
);

-- ------------------------------------------------------------- Wertungen

-- Der amtliche Zwischenstand nach jeder Runde. Einzige Quelle, die
-- Streichresultate kennt - deshalb nicht aus race_result ableitbar.
CREATE TABLE driver_standing (
  race_id        TEXT NOT NULL REFERENCES race(id),
  driver_id      TEXT NOT NULL REFERENCES driver(id),
  position       INTEGER,
  points         REAL NOT NULL,
  wins           INTEGER NOT NULL,
  PRIMARY KEY (race_id, driver_id)
);

CREATE TABLE constructor_standing (
  race_id        TEXT NOT NULL REFERENCES race(id),
  constructor_id TEXT NOT NULL REFERENCES constructor(id),
  position       INTEGER,
  points         REAL NOT NULL,
  wins           INTEGER NOT NULL,
  PRIMARY KEY (race_id, constructor_id)
);

-- --------------------------------------------------------- Datenherkunft

-- Welcher Zeitraum welcher Kennzahl überhaupt belegt ist. Die Oberfläche
-- fragt diese Tabelle, bevor sie eine Null anzeigt.
CREATE TABLE coverage (
  metric         TEXT PRIMARY KEY,      -- 'lap_position', 'pit_stop', 'q3_time'
  first_season   INTEGER NOT NULL,
  last_season    INTEGER,
  source         TEXT NOT NULL,
  note           TEXT
);
```

### Indizes

```sql
CREATE INDEX ix_result_driver   ON race_result (driver_id, classified, position);
CREATE INDEX ix_result_race     ON race_result (race_id, position);
CREATE INDEX ix_result_ctor     ON race_result (constructor_id, position);
CREATE INDEX ix_race_season     ON race (season, round);
CREATE INDEX ix_race_circuit    ON race (circuit_id, season);
CREATE INDEX ix_quali_driver    ON qualifying_result (driver_id, position);
CREATE INDEX ix_standing_driver ON driver_standing (driver_id);
```

### Vorberechnete Tabellen

Zur Build-Zeit erzeugt, nie von Hand gepflegt:

- `driver_career_summary` – Starts, Siege, Podien, Punkte, Quoten je Fahrer
- `driver_season_summary` – dasselbe je Fahrer und Saison
- `driver_circuit_summary` – je Fahrer und Strecke (trägt „Track Specialists“)
- `constructor_season_summary`
- `teammate_duel` – je Saison, Team und Fahrerpaar
- `record` – die Rekordtabelle, mit Verweis auf Fahrer und Rennen

---

## 5. Statistik-Engine

Der zentrale Baustein. Eine Datei je Kennzahlgruppe, reine Funktionen über dem
Datenmodell, keine UI-Kenntnis, keine Netzzugriffe.

```ts
// Jede Kennzahl liefert nicht nur den Wert, sondern auch, worauf er beruht.
// Ohne das kann die Oberfläche eine belastbare Null nicht von einer
// Datenlücke unterscheiden - der häufigste Fehler in F1-Statistiken.
export interface Metric<T = number> {
  value: T | null
  /** Auf wie vielen Rennen der Wert beruht. */
  sampleSize: number
  /** null heißt: für diesen Zeitraum nicht überliefert. */
  coverage: { firstSeason: number; lastSeason: number } | null
  /** Was die Oberfläche dazusagen muss, z. B. „erst ab 2004 erfasst“. */
  caveat?: string
}
```

Funktionen (Auszug, wie in der Spezifikation benannt):

```
calculateWins            calculatePodiums          calculatePoles
calculatePoints          calculateAverageFinish    calculateAverageStart
calculateDNFRate         calculateWinRate          calculatePodiumRate
calculatePoleToWinRate   calculatePositionsGained  calculateLongestStreak
calculateTeamMateComparison                        calculateTrackPerformance
calculateChampionshipProgression                   calculateNormalised
```

`calculateNormalised` ist der Schlüssel zu den historischen Vergleichen:
Punkte pro Rennen, Siege pro Start, Punkte pro möglichem Punkt. Letzteres
braucht das Punktesystem der Saison aus `points_award` – deshalb steht es in
den Daten und nicht im Code.

---

## 6. API-Struktur

Zur Build-Zeit erzeugte JSON-Dateien. Die Pfade entsprechen der Spezifikation,
die Auslieferung ist statisch und damit beliebig cachebar.

```
/api/v1/drivers.json                        Liste, schlank (Suchindex)
/api/v1/drivers/{id}.json                   Stammdaten
/api/v1/drivers/{id}/stats.json             Karrierekennzahlen
/api/v1/drivers/{id}/seasons.json           Saison für Saison
/api/v1/drivers/{id}/teammates.json         Teamkollegen-Bilanzen
/api/v1/drivers/{id}/circuits.json          Leistung je Strecke

/api/v1/constructors.json
/api/v1/constructors/{id}.json
/api/v1/constructors/{id}/stats.json

/api/v1/seasons.json
/api/v1/seasons/{year}.json                 Wertungen, Kalender, Kennzahlen
/api/v1/seasons/{year}/progression.json     WM-Verlauf je Runde

/api/v1/races/{id}.json                     Ergebnis, Startaufstellung, Boxenstopps
/api/v1/races/{id}/laps.json                Positionsverlauf (nur ab 1996)

/api/v1/circuits.json
/api/v1/circuits/{id}.json
/api/v1/circuits/{id}/stats.json

/api/v1/records.json                        Rekorddatenbank
/api/v1/coverage.json                       Welche Kennzahl ab wann belegt ist

/data/explorer.parquet                      Der Datenwürfel für den Explorer
```

Vergleiche (`/compare/drivers`, `/compare/teammates`) sind bewusst **keine**
Endpunkte: Bei 881 Fahrern wären das 387.640 Paarungen. Der Client lädt die
beiden Profile und rechnet den Vergleich mit derselben Engine – das ist
schneller als eine Netzwerkrunde und hält die Ausgabemenge klein.

### Adressen der Seiten

```
/fahrer/max-verstappen        /teams/ferrari          /saisons/2024
/rennen/monaco-grand-prix-2024                        /strecken/monaco
/rekorde                      /vergleich              /explorer
```

---

## 7. Datenqualität

Konsistenz vor Menge. Der Import bricht ab, statt Zweifelhaftes zu schreiben.

**Prüfungen beim Import:**

- Fremdschlüssel vollständig auflösbar
- Je Rennen genau ein Sieger, außer bei geteilter Fahrt (dann als solche markiert)
- Punktesumme eines Rennens entspricht dem Punktesystem der Saison
- Summe der Rennpunkte ≥ WM-Stand; Differenz nur in Saisons mit Streichresultaten
- Startplätze lückenlos aufsteigend, `0` wird zu `NULL`
- Rundenzahlen ≤ geplanter Renndistanz
- Bekannte Stichproben treffen: Fangio 51/24/29/35, Clark 72/25/33/32,
  Senna 161/41/65/80, Titelentscheidungen 2020/2021/2023/2024

**Umgang mit Lücken:**

`NULL` heißt „nicht überliefert“ und wird nie zu `0` gerundet. Die
`coverage`-Tabelle sagt je Kennzahl, ab wann sie belegt ist; die Oberfläche
zeigt außerhalb dieses Zeitraums „nicht überliefert“ statt einer Zahl. Diese
Regel gilt bereits im Bestand für schnellste Runden vor 2004 und wird
ausgeweitet.

---

## 8. Umsetzungsreihenfolge

Die Reihenfolge folgt der Priorisierung der Spezifikation, verschiebt aber
alles nach vorn, was die Datenbasis betrifft – ohne sie ist jede Ansicht
Makulatur.

| # | Schritt | Ergebnis |
|---|---|---|
| 1 | Import F1DB → Schema, Validierung, Stichproben | belastbare Datenbasis |
| 2 | Statistik-Engine, Tests gegen die Rekordbücher | geprüfte Kennzahlen |
| 3 | Seitengerüst Astro, Adressen, Layout | Navigation und SEO stehen |
| 4 | Fahrer-, Team-, Saison-, Renn-, Streckenseiten | das MVP |
| 5 | Fahrer- und Teamkollegen-Vergleich | Vergleichsfunktion |
| 6 | Rekorddatenbank | aus vorberechneten Tabellen |
| 7 | Rundendaten ab 1996 nachladen → Positionsverlauf, Führungsrunden | einmaliger Hintergrundlauf |
| 8 | WM-Punkteverlauf, historische Normalisierung | Epochenvergleiche |
| 9 | Data Explorer über DuckDB-WASM, Export | frei konfigurierbare Abfragen |
| 10 | Boxenstopps (2011+), Stints/Wetter (2023+) | klar als zeitlich begrenzt gekennzeichnet |
| 11 | Natürlichsprachliche Suche als Abfrage-Übersetzer | Modell formuliert Filter, rechnet nicht |
| 12 | What-if-Rechnungen auf `points_award` | anderes Punktesystem, ohne DNF, … |

Schritt 7 ist der teuerste: 1172 Rennen ab 1996 sind rund 700 Anfragen an
Jolpica, bei 500 pro Stunde also gut anderthalb Stunden einmaliger Lauf. Das
Ergebnis wird eingecheckt, nicht bei jedem Build neu geholt.

---

## 9. Was ich von dir brauche

Drei Entscheidungen, bevor ich mit Schritt 1 anfange:

1. **Neubau oder Umbau?** Die Empfehlung ist ein neues Projekt im selben
   Repository (`/app` neben dem heutigen Stand), das Engine, Diagramm und
   Theme übernimmt. Die heutige Anwendung bleibt lauffähig, bis der Neubau
   sie einholt. Alternative wäre ein harter Schnitt.

2. **Astro oder Next.js?** Empfehlung Astro – weniger ausgeliefertes
   JavaScript bei tausenden statischen Seiten. Next.js, wenn du ohnehin in
   dieser Welt arbeiten willst.

3. **Wie weit soll die Deckungsmatrix die Oberfläche bestimmen?** Mein
   Vorschlag: konsequent. Lieber „nicht überliefert“ als eine Null, die wie
   eine Aussage aussieht. Das kostet Fläche in jedem Profil, ist aber der
   Unterschied zwischen einer Statistikplattform und einer Zahlenwand.

Sag mir zu diesen drei Punkten Bescheid, dann beginne ich mit dem Import und
der Engine – den beiden Schritten, auf denen alles andere steht.
