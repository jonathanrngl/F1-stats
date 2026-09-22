-- ---------------------------------------------------------------------------
-- Datenmodell des F1 Statistics Explorer
--
-- Quelle ist F1DB (CC BY 4.0). Die Tabellen bilden dessen CSV-Dateien ab, aber
-- nicht eins zu eins: Was die Plattform nicht braucht, fehlt; was sie braucht
-- und F1DB nicht liefert (Rundenpositionen, Wetter), bekommt eine leere
-- Tabelle, die ein späterer Lauf füllt.
--
-- Zwei Grundsätze:
--   1. NULL heißt „nicht überliefert" und wird nie zu 0 gerundet. Ein
--      Startplatz 0 in den Rohdaten wird hier NULL.
--   2. Was die Oberfläche als Zahl zeigt, muss die coverage-Tabelle decken.
-- ---------------------------------------------------------------------------

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------- Stammdaten

CREATE TABLE country (
  id          TEXT PRIMARY KEY,   -- 'germany'
  alpha3      TEXT,               -- 'DEU'
  ioc         TEXT,               -- 'GER' – die Schreibweise des Motorsports
  name        TEXT NOT NULL,
  demonym     TEXT                -- 'German'
);

CREATE TABLE driver (
  id                TEXT PRIMARY KEY,   -- 'max-verstappen', zugleich URL-Segment
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  -- Der Name, unter dem der Fahrer gefahren ist: 'Niki Lauda', nicht
  -- 'Andreas Nikolaus Lauda'. Beim Import gebildet, weil ihn jede Liste, jede
  -- Tabelle und jede Diagrammlegende braucht; zwanzig Abfragen muessten ihn
  -- sonst zwanzigmal selbst zusammensetzen.
  display_name      TEXT NOT NULL,
  abbreviation      TEXT,               -- 'VER'
  permanent_number  TEXT,
  date_of_birth     TEXT,
  date_of_death     TEXT,
  place_of_birth    TEXT,
  nationality_id    TEXT REFERENCES country(id),
  -- Aus F1DB übernommene Gesamtzahlen. Nicht zum Anzeigen gedacht, sondern
  -- als unabhängige Gegenprobe für die eigene Engine: weicht sie ab, ist
  -- entweder die Engine falsch oder eine Annahme über die Daten.
  f1db_race_entries      INTEGER,
  f1db_race_starts       INTEGER,
  f1db_race_wins         INTEGER,
  f1db_podiums           INTEGER,
  f1db_pole_positions    INTEGER,
  f1db_fastest_laps      INTEGER,
  f1db_championship_wins INTEGER,
  f1db_points            REAL,
  f1db_championship_points REAL
);

CREATE TABLE constructor (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  full_name         TEXT,
  nationality_id    TEXT REFERENCES country(id),
  f1db_race_entries      INTEGER,
  f1db_race_starts       INTEGER,
  f1db_race_wins         INTEGER,
  f1db_one_twos          INTEGER,   -- Doppelsiege
  f1db_podiums           INTEGER,
  f1db_pole_positions    INTEGER,
  f1db_fastest_laps      INTEGER,
  f1db_championship_wins INTEGER
);

-- Jaguar wurde Red Bull, Toro Rosso wurde AlphaTauri wurde RB. Ohne diese
-- Tabelle ist jede Team-Historie falsch.
CREATE TABLE constructor_chronology (
  parent_id       TEXT NOT NULL REFERENCES constructor(id),
  constructor_id  TEXT NOT NULL REFERENCES constructor(id),
  sort_order      INTEGER NOT NULL,
  year_from       INTEGER NOT NULL,
  year_to         INTEGER,          -- NULL = bis heute
  PRIMARY KEY (parent_id, constructor_id, year_from)
);

CREATE TABLE circuit (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  full_name      TEXT,
  previous_names TEXT,
  type           TEXT,              -- 'RACE', 'STREET', 'ROAD'
  direction      TEXT,
  place_name     TEXT,
  country_id     TEXT REFERENCES country(id),
  latitude       REAL,
  longitude      REAL,
  length_km      REAL,
  turns          INTEGER
);

-- Hockenheim 2001, Silverstone 2010: Rundenzeiten über Layoutgrenzen hinweg
-- zu vergleichen ist unzulässig.
CREATE TABLE circuit_layout (
  id          TEXT PRIMARY KEY,
  circuit_id  TEXT NOT NULL REFERENCES circuit(id),
  /* F1DBs "effective" ist ein Wahrheitswert, kein Jahr: Es markiert die
     Streckenführung, die heute gefahren wird. Von wann bis wann ein Layout
     benutzt wurde, steht nirgends – das leiten die Rennen ab, die darauf
     stattfanden (race.circuit_layout_id). */
  is_current  INTEGER NOT NULL DEFAULT 0,
  length_km   REAL,
  turns       INTEGER
);

CREATE TABLE grand_prix (
  id            TEXT PRIMARY KEY,   -- 'monaco'
  name          TEXT NOT NULL,
  full_name     TEXT,
  short_name    TEXT,
  abbreviation  TEXT,
  country_id    TEXT REFERENCES country(id)
);

-- ---------------------------------------------------------------- Saison

CREATE TABLE season (
  year                  INTEGER PRIMARY KEY,
  race_count            INTEGER NOT NULL,
  has_constructors_championship INTEGER NOT NULL,
  -- Bis 1990 zählten nur die besten N Ergebnisse. NULL = alle zählen.
  -- Wird beim Import aus der Differenz zwischen Renn- und WM-Punkten erkannt,
  -- nicht aus einer gepflegten Regeltabelle.
  dropped_scores        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE race (
  id                  TEXT PRIMARY KEY,     -- 'monaco-grand-prix-2024'
  f1db_id             INTEGER NOT NULL,     -- numerische Kennung in den CSV
  year                INTEGER NOT NULL REFERENCES season(year),
  round               INTEGER NOT NULL,
  grand_prix_id       TEXT NOT NULL REFERENCES grand_prix(id),
  official_name       TEXT,
  circuit_id          TEXT NOT NULL REFERENCES circuit(id),
  circuit_layout_id   TEXT REFERENCES circuit_layout(id),
  date                TEXT NOT NULL,
  course_length_km    REAL,
  turns               INTEGER,
  laps                INTEGER,
  distance_km         REAL,
  scheduled_laps      INTEGER,
  qualifying_format   TEXT,
  had_sprint          INTEGER NOT NULL DEFAULT 0,
  -- F1DB markiert, in welchem Rennen die Meisterschaft entschieden wurde.
  -- Unabhängige Gegenprobe für den eigenen Titelrechner.
  drivers_title_decider      INTEGER NOT NULL DEFAULT 0,
  constructors_title_decider INTEGER NOT NULL DEFAULT 0,
  UNIQUE (year, round)
);

-- --------------------------------------------------------------- Rennen

CREATE TABLE race_result (
  race_id         TEXT NOT NULL REFERENCES race(id),
  driver_id       TEXT NOT NULL REFERENCES driver(id),
  constructor_id  TEXT NOT NULL REFERENCES constructor(id),
  engine_id       TEXT,
  tyre_id         TEXT,
  -- Laufende Nummer je Fahrer und Rennen. In den 1950ern übernahm man das
  -- Auto eines Teamkollegen; dann gibt es zwei Zeilen für denselben Fahrer.
  -- 127 solcher Zeilen stecken in den Daten, markiert über shared_car.
  entry_index     INTEGER NOT NULL,
  display_order   INTEGER NOT NULL,
  position        INTEGER,            -- NULL = nicht gewertet
  position_text   TEXT NOT NULL,      -- '1', 'DNF', 'DSQ', 'DNQ', …
  classified      INTEGER NOT NULL,   -- abgeleitet: position IS NOT NULL
  /*
   * Genannt ist nicht gestartet. Wer sich nicht qualifizierte (DNQ, DNPQ),
   * gar nicht erst antrat (DNS, WD, DNA, DNP) oder ausgeschlossen wurde (EX),
   * war zwar gemeldet, stand aber nicht in der Startaufstellung. Aguri Suzuki
   * kommt so auf 88 Nennungen bei 65 Starts, Senna auf 162 bei 161.
   *
   * Die Liste ist nicht geraten: Mit genau diesen sieben Werten stimmt die
   * Startzahl für alle 860 Fahrer mit den Gesamtzahlen von F1DB überein,
   * ohne sie für 445. „NC" (nicht gewertet) und „DSQ" zählen als Start –
   * diese Fahrer sind losgefahren.
   */
  started         INTEGER NOT NULL,
  shared_car      INTEGER NOT NULL DEFAULT 0,
  laps            INTEGER,
  time_ms         INTEGER,
  gap_ms          INTEGER,
  gap_laps        INTEGER,
  reason_retired  TEXT,
  points          REAL NOT NULL DEFAULT 0,
  /*
   * Achtung, drei verschiedene Dinge:
   *   qualifying_position = 1  schnellste Zeit im Qualifying – die Pole im
   *                            sportlichen Sinn, und das, was die Engine zählt
   *   grid_position = 1        tatsächlich von vorn losgefahren
   *   pole_position            F1DBs eigenes Flag; folgt im Kern dem Startplatz
   *                            und dient nur dem Abgleich mit dessen Gesamtzahlen
   * Bis in die 2000er fallen alle drei zusammen. Erst Strafversetzungen
   * trennen sie: Verstappen hat 52 Poles, fuhr aber nur 48-mal von Platz 1 los.
   */
  pole_position   INTEGER NOT NULL DEFAULT 0,
  qualifying_position INTEGER,
  grid_position   INTEGER,            -- NULL = nicht überliefert (war "0")
  positions_gained INTEGER,
  pit_stops       INTEGER,
  fastest_lap     INTEGER NOT NULL DEFAULT 0,
  driver_of_the_day INTEGER NOT NULL DEFAULT 0,
  grand_slam      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (race_id, driver_id, entry_index)
);

CREATE TABLE qualifying_result (
  race_id         TEXT NOT NULL REFERENCES race(id),
  driver_id       TEXT NOT NULL REFERENCES driver(id),
  constructor_id  TEXT NOT NULL REFERENCES constructor(id),
  position        INTEGER,
  position_text   TEXT,
  -- Vor 2006 gab es eine Zeit, danach drei Segmente. Beides wird geführt.
  time_ms         INTEGER,
  q1_ms           INTEGER,
  q2_ms           INTEGER,
  q3_ms           INTEGER,
  gap_ms          INTEGER,
  PRIMARY KEY (race_id, driver_id)
);

CREATE TABLE starting_grid (
  race_id         TEXT NOT NULL REFERENCES race(id),
  driver_id       TEXT NOT NULL REFERENCES driver(id),
  constructor_id  TEXT NOT NULL REFERENCES constructor(id),
  position        INTEGER,
  position_text   TEXT,
  qualifying_position INTEGER,
  -- Der Unterschied zwischen Qualifikation und Startplatz: Strafversetzung.
  grid_penalty    TEXT,
  grid_penalty_positions INTEGER,
  time_ms         INTEGER,
  PRIMARY KEY (race_id, driver_id)
);

CREATE TABLE sprint_result (
  race_id         TEXT NOT NULL REFERENCES race(id),
  driver_id       TEXT NOT NULL REFERENCES driver(id),
  constructor_id  TEXT NOT NULL REFERENCES constructor(id),
  position        INTEGER,
  position_text   TEXT NOT NULL,
  classified      INTEGER NOT NULL,
  grid_position   INTEGER,
  points          REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (race_id, driver_id)
);

CREATE TABLE pit_stop (             -- ab 1994
  race_id         TEXT NOT NULL REFERENCES race(id),
  driver_id       TEXT NOT NULL REFERENCES driver(id),
  stop            INTEGER NOT NULL,
  lap             INTEGER NOT NULL,
  duration_ms     INTEGER,
  PRIMARY KEY (race_id, driver_id, stop)
);

-- F1DB führt keine Rundendaten. Diese Tabelle füllt ein eigener Lauf gegen
-- Jolpica, für die Saisons ab 1996 – davor gibt es dort nichts.
CREATE TABLE lap_position (
  race_id         TEXT NOT NULL REFERENCES race(id),
  driver_id       TEXT NOT NULL REFERENCES driver(id),
  lap             INTEGER NOT NULL,
  position        INTEGER NOT NULL,
  time_ms         INTEGER,
  PRIMARY KEY (race_id, driver_id, lap)
);

-- -------------------------------------------------------------- Wertungen

-- Zwischenstand nach jeder Runde. Einzige Quelle, die Streichresultate kennt:
-- die Summe der Rennpunkte ist bis 1990 nicht der WM-Stand.
CREATE TABLE race_driver_standing (
  race_id         TEXT NOT NULL REFERENCES race(id),
  driver_id       TEXT NOT NULL REFERENCES driver(id),
  position        INTEGER,
  position_text   TEXT,
  points          REAL NOT NULL,
  positions_gained INTEGER,
  championship_won INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (race_id, driver_id)
);

CREATE TABLE race_constructor_standing (
  race_id         TEXT NOT NULL REFERENCES race(id),
  constructor_id  TEXT NOT NULL REFERENCES constructor(id),
  position        INTEGER,
  points          REAL NOT NULL,
  championship_won INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (race_id, constructor_id)
);

CREATE TABLE season_driver_standing (
  year            INTEGER NOT NULL REFERENCES season(year),
  driver_id       TEXT NOT NULL REFERENCES driver(id),
  position        INTEGER,
  position_text   TEXT,
  points          REAL NOT NULL,
  championship_won INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (year, driver_id)
);

CREATE TABLE season_constructor_standing (
  year            INTEGER NOT NULL REFERENCES season(year),
  constructor_id  TEXT NOT NULL REFERENCES constructor(id),
  position        INTEGER,
  points          REAL NOT NULL,
  championship_won INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (year, constructor_id)
);

-- ---------------------------------------------------------- Datenherkunft

-- Welche Kennzahl ab wann belegt ist. Die Oberfläche fragt diese Tabelle,
-- bevor sie eine Null anzeigt – sonst wird aus einer Datenlücke eine Aussage.
-- Wird beim Import aus den Daten ausgezählt, nicht von Hand gepflegt.
CREATE TABLE coverage (
  metric        TEXT PRIMARY KEY,
  first_year    INTEGER,
  last_year     INTEGER,
  -- Anteil der Rennen im Zeitraum, für die das Feld belegt ist (0..1).
  completeness  REAL,
  source        TEXT NOT NULL,
  note          TEXT
);

-- ----------------------------------------------------------------- Indizes

CREATE INDEX ix_result_driver    ON race_result (driver_id, classified, position);
CREATE INDEX ix_result_race      ON race_result (race_id, position);
CREATE INDEX ix_result_ctor      ON race_result (constructor_id, position);
CREATE INDEX ix_result_pole      ON race_result (driver_id, pole_position);
CREATE INDEX ix_race_year        ON race (year, round);
CREATE INDEX ix_race_circuit     ON race (circuit_id, year);
CREATE INDEX ix_race_gp          ON race (grand_prix_id, year);
CREATE INDEX ix_quali_driver     ON qualifying_result (driver_id, position);
CREATE INDEX ix_grid_driver      ON starting_grid (driver_id, position);
CREATE INDEX ix_pit_race         ON pit_stop (race_id, driver_id);
CREATE INDEX ix_lap_race         ON lap_position (race_id, lap);
CREATE INDEX ix_rds_driver       ON race_driver_standing (driver_id);
CREATE INDEX ix_sds_driver       ON season_driver_standing (driver_id);
