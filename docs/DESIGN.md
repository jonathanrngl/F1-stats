# Designsprache „Zeitnahme“

Dieses Dokument beschreibt, wie die Seite unter `explorer/` aussieht und warum.
Wer eine neue Seite baut, soll hier jede Entscheidung finden: Farben, Schrift,
Raster, Bausteine, Bewegung, Texte – und was es nicht gibt.

Stand: Entwurf zur Freigabe (Phase 2), Revision 1 nach dem Plan-Review,
12. November 2026. Was nach der Freigabe anders kam, steht am Ende unter
„Abweichungen“.

---

## 1. Für wen, und was die Seite sagen soll

**Leser.** Wer Formel 1 schaut und eine Zahl nachsehen will: Wer führt, wann ist
das nächste Rennen, wie viele Siege hatte Clark. Dazu, kleiner, wer tiefer
gräbt: Rekordbewegungen, Team-mates, eigene Abfragen. Beide lesen nicht, sie
suchen mit den Augen. Was sie suchen, muss zuerst zu sehen sein.

**Leitsatz der Seite.** *Formel 1 seit 1950, aus den Ergebnissen selbst
gerechnet.* Der zweite Halbsatz steht genau einmal, im Fuß. Bewiesen wird er
nicht durch Wiederholung, sondern dadurch, dass jede Zahl auf ihre Quelle
verlinkt.

**Leitidee.** Die Seite liest sich wie ein Zeitnahme-Monitor mit 76 Jahren
Gedächtnis. Formen, Farben und Ordnung kommen aus dem Sport selbst:
Timing-Tower, Lackierung, Sektorfarben, Flaggen. Kein Element ist Schmuck;
jedes trägt eine Angabe.

## 2. Fünf Prinzipien

1. **Die Farbe kommt aus den Daten.** Es gibt keinen Markenakzent. Jede Seite
   mit einem Gegenstand trägt dessen Lackierung (`--lackierung`):

   | Seite | Lackierung |
   |---|---|
   | Team | seine Farbe |
   | Fahrer | das Team mit den meisten Starts (bei Gleichstand das jüngere); der Kopfsatz nennt es |
   | Saison | das Team, für das der Fahrermeister – oder, solange es keinen gibt, der Führende – die meisten Rennen fuhr |
   | Rennen | das Team des Siegers |
   | Startseite | das Team des WM-Führenden |
   | Motor, Reifen, Strecke, Vorschau, Übersichten, Werkzeuge, Rekorde | Tinte |
   | Team ohne Farbe in `teams.css` | Tinte |

   Lackierung erscheint als Streifen, Fläche oder Unterstreichung, nie als
   Textfarbe.
2. **Jede Seite steht auf der Zeitachse.** Unter dem Kopf einer Seite mit
   Gegenstand liegt das Epochenband 1950–heute: gefahrene Saisons hoch,
   übrige flach. Man sieht ohne Lesen, ob jemand 1955 fuhr oder 2015, und wo
   die Lücken sind.
3. **Ranglisten sind Zeitnahme-Türme.** Position, Teamstreifen, Kürzel, Name,
   Wert rechtsbündig, Abstand. Eine Form für WM-Stand, Rekorde, Team-mates und
   Vergleiche – wer eine kennt, liest alle.
4. **Die Breite trägt Bedeutung.** Eine Schriftfamilie, Archivo, mit
   Breitenachse: breit und schwer für Namen und Titel (wie die Schrift auf einer
   Lackierung), normal für Text, schmal für Zahlenkolonnen.
5. **Ein lauter Moment pro Seite.** Startseite: das Meisterband. Fahrer und
   Team: der Name auf seiner Lackierung. Saison: der Turm des WM-Stands. Rennen:
   das Podium. Alles andere ist ruhig.

## 3. Der Vorschlag, geprüft gegen den Bestand

Der Auftrag brachte die Idee „Zeitnahme“ mit. Geprüft wurde sie an echten Daten
und gerenderten Kandidaten (Bildschirmfotos hell und dunkel, nicht im Kopf).
Was sich änderte:

| Vorschlag | Entscheidung | Warum |
|---|---|---|
| Meisterband auf dem Seitengrund | **Auf einer Monitorfläche, die in beiden Modi dunkel ist** | Im hellen Modus erreichen elf Lackierungen keine 3:1 zum Betongrund – McLaren 2,2, Renault 2,0, Brawn 2,2, Mercedes 2,8, Jordan 1,7. Die Balkenhöhe ist Information (WCAG 1.4.11). Auf der dunklen Fläche erreichen alle Teams ≥ 3,5:1. Nebenbei ist der Monitor der eine laute Moment der Startseite. |
| Links: Unterstreichung in Lackierung, sonst Tinte | **übernommen, als eigene Rolle `--lackierung-linie`** | Je Team und Modus vorab gerechnet (§ 6). Hell fallen 11 von 50 Teams auf Tinte zurück, dunkel keines. |
| Fahrerseite: Team mit den meisten Starts | **übernommen** | Geprüft: Hamilton → Mercedes, Senna → McLaren, Alonso → Renault. Das Team der Karriere, nicht der Stand von heute. Bisher: das letzte Team. |
| Saisonseite: Team des Fahrermeisters | **übernommen, auch für die Balken des Meisterbands** | Vor 1958 gab es keinen Konstrukteurstitel; die Farbe des Fahrermeisters gibt es für jede Saison. Für alle 76 abgeschlossenen Titel geprüft. |
| Kopf der Fahrerseite: ein Satz statt Kacheln | **Satz für die Lebensdaten, Kennzahlleiste für die Zählungen** | Der Satz „2 titles, 32 wins, 446 starts“ wiederholte drei Zahlen, die die Leiste direkt darunter ohnehin zeigt. Der Satz trägt jetzt, was keine Zahl sagt: „World Champion in 2005 and 2006. Born 29 July 1981 in Oviedo, Spain.“ |
| Epochenband: ein Zeitraum | **Jede Saison ein Feld** | Ein Zeitraum 2001–2026 verschweigt Alonsos Pause 2019–2020. 77 Felder zeigen sie. |
| Saisonseite: Epochenband | **Das Meisterband im Kleinen, das Jahr markiert – hell, ohne Links** | Ein einzelnes markiertes Jahr auf einer Achse sagt nichts. Im Meisterband sieht man, wo die Saison steht: 1988 neben 1989, McLarens Jahre am Stück. Es ist Zusammenhang, nicht der laute Moment: kein Monitor, kein Tabstopp; für Vorleser ein Satz. |
| Höhe des Meisterbands: „Anteil der möglichen Punkte“ | **übernommen, genau beschriftet** | Es ist dieselbe Größe wie im Vergleich und im Explorer: Punkte (Rennen und Sprints, vor der Streichung) geteilt durch das Höchste aus den eigenen Starts, doppelte und halbe Punkte eingerechnet. Jeder Balken sagt es in Zahlen: „94 of 144 possible points from 16 starts, 65%“. 1988 hatte so Prost (73 %) mehr als Meister Senna (65 %) – das Band zeigt es, wie es war. Offene Frage D1. |
| Tabellen: alles 75 % breit | **Zahlen 75 %, Namen 100 %** | Gerendert verglichen (Namen 87,5 % und 100 %): Schmale Namen wirken gequetscht und sparen kaum Platz; schmale Zahlen sparen Platz und werden größer lesbar. |
| Navigation laut Skizze (ohne „Next race“, „Engines“, „Tyres“) | **Navigation bleibt, Beschreibungszeilen fallen** | Die Skizze war keine Inhaltsentscheidung. „Next race“ ist in der Saison der häufigste Einstieg; Motoren und Reifen hätten keinen Weg mehr. Gekürzt wird, was doppelt ist (§ 11). |
| Grün = persönliche Bestmarke | **Grün = besser als die eigene Bezugsgröße** | Grün stand schon für „Duell gewonnen“ und „Plätze gutgemacht“. Das ist dieselbe Logik wie die Sektorfarbe: besser als der eigene Vergleichswert. Grün für „in den Punkten“ fällt weg – die Punkte stehen in ihrer Spalte. |
| Rot für Ergebnisse | **Entfällt** | Rekordzahlen werden Lila (absolute Bestmarke), die tragende Zahl einer Seite steht auf einem Lackierungsstreifen. Rot bleibt allein für Ausfälle (Status) und Serie 1 der Diagramme. |
| Animation: Band baut sich auf | **übernommen: ein Wischen von links, 800 ms, nur CSS** | Ein Balken nach dem anderen bräuchte je Balken eine Verzögerung, also `style`-Attribute (CSP) oder 77 Regeln. `clip-path` auf der ganzen Reihe zeigt dasselbe. |
| Balken als SVG mit Beschriftung | **HTML-Raster aus 77 Links, je ein kleines SVG** | Die Achsenbeschriftung bräuchte Prozentpositionen, und die gingen nur über `style`. Im Raster mit `grid-auto-columns` steht jede Jahreszahl in ihrer eigenen Spalte, die Anzahl der Saisons muss niemand kennen. |
| Hover und Fokus zeigen Jahr, Meister, Team | **in einer eigenen Zeile unter der Legende** | Ein Text, der die Legende ersetzt, müsste sich nach WCAG 1.4.13 mit Esc schließen lassen – das kann CSS nicht. Die Zeile verdeckt nichts; mit Skript bleibt sie stehen, bis ein anderer Balken gewählt wird, Esc leert sie. Ohne Skript zeigt der Browser den Text als Tooltip (`title`). Für Vorleser ist der Text der Name des Links. |
| Balken als Links, Tastatur | **ein Tabstopp, Pfeiltasten** | 77 Tabstopps zwischen Sprunglink und WM-Stand wären eine Wand. Mit Skript wandert man mit ←/→, Pos1, Ende; ohne Skript bleibt jeder Balken erreichbar. |
| Touch | **erster Tipp zeigt, zweiter öffnet** | Ein 3 px breiter Balken ist kein Ziel für einen Finger; der erste Tipp schreibt das Jahr in die Zeile. |

**Kosten, die bleiben.** Archivo mit beiden Achsen wiegt für Latein 90 KB statt
29 KB (Libre Franklin, nur Gewicht). Das ist der Preis der Breitenachse; die
Schrift lädt mit `font-display: swap`, der Text steht also sofort.

## 4. Zwei Gegenentwürfe, und warum „Zeitnahme“ bleibt

Um nicht der ersten Idee zu folgen, wurden zwei andere Richtungen
durchgespielt.

**A. „Jahrbuch“.** Die Seite als Almanach im Stil von Wisden: dichter Satz,
Zahlen in Sätzen („Clark gewann 1963 sieben von zehn Rennen“), Tabellen mit
Linien, keine Farbe außer den Medaillen, Kapitälchen für Namen.
*Stark:* liest sich, statt zu blinken; jede Zahl hat Zusammenhang.
*Schwach:* Wer nur den Stand nach Runde 20 sucht, liest erst einen Absatz.
Ohne Farbe muss man wieder jede Zeile lesen – genau daran scheiterte die
schwarzweiße Fassung (siehe Kommentar in `theme.css`). Und „Almanach“ gehört
keinem Sport.

**B. „Telemetrie“.** Jede Seite beginnt mit ihrem bestimmenden Diagramm: die
Karrierekurve beim Fahrer, der Punkteverlauf bei der Saison, der Rundenverlauf
beim Rennen. Dunkel zuerst, Linien statt Tabellen.
*Stark:* zeigt Verläufe, die keine Kachel zeigt.
*Schwach:* Diagramme beantworten die häufigste Frage – wie viele? – schlechter
als eine Zahl. Dunkel-zuerst mit leuchtenden Linien ist das zweite Muster
generierter Seiten (fast schwarz mit Neonakzent). Und ein Diagramm oben auf
jeder Seite ist nicht „ein lauter Moment“, sondern ein lauter Moment überall.

**Entscheidung.** „Zeitnahme“ beantwortet die häufigste Frage am schnellsten
(Turm, Kennzahlleiste) und ist als einzige der drei an diesen Sport gebunden.
Übernommen werden je ein Gedanke der Gegenentwürfe: aus A der Satz im Kopf,
der sagt, was keine Zahl sagt; aus B das eine Diagramm als Signatur, aber nur
auf der Startseite.

**Was wir nicht tun.** Kein Logo mit Streifen, kein Karbon-Muster, keine
Reifen-Icons als Schmuck, keine Countdown-Uhr mit Sekunden, kein dunkler Modus
als Voreinstellung, keine Fotos.

## 5. Farbe

### 5.1 Drei Stufen

Nach *Refactoring UI*: neutrale Töne für rund 90 % der Fläche, eine
seitenabhängige Primärfarbe (die Lackierung), wenige Bedeutungsfarben.

- **Neutrale:** ein kühles Grau, Beton im Hellen, Asphalt im Dunkeln.
- **Primär:** `--lackierung`, je Seite aus den Daten, Rückfall Tinte.
- **Bedeutung:** Gold, Silber, Bronze (Podium); Lila (absolute Bestmarke);
  Grün (besser als die eigene Bezugsgröße); Bernstein (Sonderfall);
  Rot (Ausfall); Gelb, Blau, Karo (Flaggen). Dazu die Teamfarben in
  `teams.css` und die Serienfarben der Diagramme.

### 5.2 Rollen

Jede Farbe ist eine Rolle in `theme.css`, hell und dunkel in einem
`light-dark()`. Seiten und Komponenten greifen nur über Rollen zu, nie über
Hex-Werte.

| Rolle | hell | dunkel | Aufgabe |
|---|---|---|---|
| `--plane` | `#eef1f2` | `#1c2026` | Seitengrund („Boxengasse“, Beton / Asphalt) |
| `--surface` | `#ffffff` | `#232830` | Datenfläche („Startplatz“): Tabellen, Türme, Hinweise |
| `--surface-2` | `#e3e7ea` | `#2b313a` | Hover auf dem Grund, gedrückte Knöpfe |
| `--surface-3` | `#d7dce0` | `#323944` | Rinnen in Balken |
| `--zebra` | `#f5f7f8` | `#272c34` | jede zweite Tabellenzeile |
| `--ink` | `#16191e` | `#eceef0` | Überschriften, Namen, Zahlen, Links |
| `--ink-2` | `#363c45` | `#c5cad1` | Fließtext |
| `--muted` | `#545b65` | `#9ba2ac` | Beschriftungen, Nebenangaben |
| `--border` | `#d3d9dd` | `#363c46` | Haarlinien |
| `--border-strong` | `#b6bec4` | `#4a525d` | Trennlinien zwischen Gruppen |
| `--border-input` | `#76808a` | `#7d8692` | Rand von Bedienelementen (≥ 3:1) |
| `--lackierung` | aus `teams.css` | aus `teams.css` | Streifen, Flächen, Balken |
| `--lackierung-linie` | Team oder Tinte | Team oder Tinte | Unterstreichung, Epochenband |
| `--lila` | `#7b2fbe` | `#c49bff` | absolute Bestmarke: Rekord, schnellste Runde |
| `--good` | `#0b7048` | `#3cc994` | besser als die eigene Bezugsgröße |
| `--warn` | `#8a5000` | `#e3a94f` | bemerkenswert, verschoben |
| `--danger-fg` / `-bg` | `#b00500` / `#fdf0ef` | `#ff8b83` / `#301615` | Ausfall, Fehler |
| `--gold` / `--silber` / `--bronze` | `#e5b83a` / `#c6c9ce` / `#d49563` | gleich | Podium, Text darauf `--podest-ink` |
| `--flagge-gelb` | `#f2c200` | `#ffd84d` | Datenlücke, Sonderfall |
| `--flagge-blau` | `#1f6fe5` | `#5b9bff` | Hinweis |

Abgeschafft: `--link` (Blau), `--accent` (Rot), `--band` (getönte Leiste),
`--link-wash`, `--accent-wash`. Während des Umbaus zeigen alle alten Namen
(`--link`, `--link-strong`, `--link-line`, `--link-wash`, `--accent`,
`--accent-strong`, `--accent-wash`, `--accent-ink`, `--band`) auf Rollen in
Tinte oder Fläche, damit nichts bricht; am Ende sind sie entfernt. Wer einen
davon neu benutzt, baut den alten Fehler wieder ein.

Der Zweig ist die Isolation: Bis zum Pull Request steht nichts davon auf
`main`, und ein verworfener Prototyp ist ein `git revert` seiner Commits.

### 5.3 Kontraste

Gerechnet von `npm run test:kontraste` (`scripts/pruefe-kontraste.mjs`) aus
derselben `theme.css`, die der Browser liest. Text braucht 4,5:1,
Bedienelemente und Grafik 3:1. Die Tabelle wird bei jeder Änderung neu
erzeugt (`--tabelle`).

<!-- kontraste:anfang -->
| Vordergrund | Fläche | nötig | hell | dunkel |
|---|---|---:|---:|---:|
| `--ink` | `--plane` | 4.5 | 15,52 | 14,06 |
| `--ink` | `--surface` | 4.5 | 17,62 | 12,74 |
| `--ink` | `--surface-2` | 4.5 | 14,17 | 11,26 |
| `--ink` | `--zebra` | 4.5 | 16,40 | 12,07 |
| `--ink-2` | `--plane` | 4.5 | 9,79 | 9,92 |
| `--ink-2` | `--surface` | 4.5 | 11,12 | 8,99 |
| `--ink-2` | `--surface-2` | 4.5 | 8,94 | 7,95 |
| `--ink-2` | `--zebra` | 4.5 | 10,34 | 8,52 |
| `--muted` | `--plane` | 4.5 | 6,04 | 6,35 |
| `--muted` | `--surface` | 4.5 | 6,86 | 5,75 |
| `--muted` | `--surface-2` | 4.5 | 5,52 | 5,09 |
| `--muted` | `--zebra` | 4.5 | 6,38 | 5,45 |
| `--plane` | `--ink` | 4.5 | 15,52 | 14,06 |
| `--plane` | `--lila` | 4.5 | 6,18 | 7,38 |
| `--lila` | `--plane` | 4.5 | 6,18 | 7,38 |
| `--lila` | `--surface` | 4.5 | 7,02 | 6,69 |
| `--lila` | `--zebra` | 4.5 | 6,53 | 6,34 |
| `--good` | `--plane` | 4.5 | 5,40 | 7,77 |
| `--good` | `--surface` | 4.5 | 6,13 | 7,04 |
| `--good` | `--zebra` | 4.5 | 5,70 | 6,67 |
| `--warn` | `--plane` | 4.5 | 5,73 | 7,83 |
| `--warn` | `--surface` | 4.5 | 6,51 | 7,09 |
| `--danger-fg` | `--danger-bg` | 4.5 | 6,59 | 7,41 |
| `--danger-fg` | `--surface` | 4.5 | 7,32 | 6,54 |
| `--podest-ink` | `--gold` | 4.5 | 9,32 | 9,32 |
| `--podest-ink` | `--silber` | 4.5 | 10,48 | 10,48 |
| `--podest-ink` | `--bronze` | 4.5 | 6,86 | 6,86 |
| `--ink` | `--gold-wash` | 4.5 | 15,88 | 12,09 |
| `--border-input` | `--plane` | 3 | 3,54 | 4,44 |
| `--border-input` | `--surface` | 3 | 4,02 | 4,02 |
| `--ink` | `--plane` | 3 | 15,52 | 14,06 |
| `--ink` | `--surface` | 3 | 17,62 | 12,74 |
| `--danger-border` | `--danger-bg` | 3 | 1,42 ✗ | 1,56 ✗ |
| `--s-rest` | `--surface` | 3 | 3,50 | 3,12 |
| `--s1` | `--surface` | 3 | 3,95 | 4,59 |
| `--s2` | `--surface` | 3 | 4,42 | 4,07 |
| `--s3` | `--surface` | 3 | 3,20 | 3,81 |
| `--s4` | `--surface` | 3 | 2,82 ✗ | 4,35 |
| `--s5` | `--surface` | 3 | 8,56 | 4,74 |
| `--s6` | `--surface` | 3 | 4,95 | 3,36 |
| `--s7` | `--surface` | 3 | 2,69 ✗ | 3,75 |
| `--s8` | `--surface` | 3 | 2,17 ✗ | 4,82 |
| `--flagge-gelb` | `--surface` | 3 | 1,68 ✗ | 10,71 |
| `--flagge-blau` | `--surface` | 3 | 4,70 | 5,34 |

Mit ✗ markiert und trotzdem zulässig, weil die Farbe dort nicht allein trägt: die hellen Serienfarben (Namen an den Linien, Tabellenansicht), die Flaggen (ein Wort sagt die Art), der Rand eines Ausfalls (darin steht „Ret“). Das Skript meldet sie, zählt sie aber nicht.
<!-- kontraste:ende -->

### 5.4 Teamfarben und `--lackierung-linie`

Die Teamfarben bleiben, wie sie sind; sie sind Bedeutung, nicht Gestaltung.
Für Linien (Unterstreichung, Epochenband) braucht eine Farbe aber 3:1 auf
Grund **und** Fläche. `npm run test:kontraste -- --teams` rechnet das je Team.
Wo es nicht reicht, ist die Linie Tinte – in diesem Modus, für dieses Team.

Hell fallen auf Tinte zurück: Mercedes, McLaren, Haas, RB/Racing Bulls, Kick
Sauber, Racing Point/Force India, Renault, Brawn, Jordan, Benetton, Arrows.
Dunkel keines.

Streifen in Tabellen und Türmen dürfen darunter liegen: Dort steht der Name des
Teams immer daneben, die Farbe ist Zugabe, nicht Träger.

### 5.5 Die Monitorfläche

`.monitor` setzt `color-scheme: dark` auf ein Element. Alle Rollen darin lösen
sich dann dunkel auf, auch die Teamfarben – in beiden Modi der Seite. Nur das
große Meisterband der Startseite steht auf dem Monitor; das kleine auf der
Saisonseite steht hell. Eine zweite Monitorfläche auf derselben Seite gibt es
nicht.

### 5.6 Diagramme

Die Serienpalette `--s1`…`--s8` bleibt rot geführt und in fester Reihenfolge.
Weil die dunkle Datenfläche heller wurde (`#232830` statt `#15181d`), fiel
`--s6` dunkel auf 2,996:1. Neu: `#0a8c0a` statt `#008300`. Geprüft mit dem
Dataviz-Validator, beide Modi:

| Modus | Fläche | CVD schlechtestes Nachbarpaar | normalsichtig | Kontrast |
|---|---|---|---|---|
| hell (unverändert) | `#ffffff` | ΔE 9,2 (`--s4`/`--s3`, Deutan) | ΔE 19,6 | `--s4`, `--s7`, `--s8` unter 3:1 – Namen an den Linien und Tabellenansicht, wie bisher |
| dunkel | `#232830` | ΔE 9,4 (`--s4`/`--s3`, Deutan) | ΔE 19,3 | alle ≥ 3:1 |

## 6. Schrift

**Archivo Variable** (`@fontsource-variable/archivo/wdth.css`), selbst
gehostet: Breite 62–125 %, Gewicht 100–900. Geprüft: Mit `tabular-nums` sind
alle Ziffern in jeder Breite gleich breit (gemessen in Chrome: 0, 1, 4, 8 bei
62 %, 75 %, 100 %, 125 %). Ohne die Einstellung sind sie proportional – im
Fließtext richtig, in Kolonnen falsch.

Die Latein-Datei wiegt 90 KB (Libre Franklin: 29 KB). Seiten mit Namen wie
Tomáš Enge oder Ryō Hirakawa laden zusätzlich die Erweiterung (latin-ext,
86 KB) – wie vorher auch, nur größer. Hingenommen: Die Schrift lädt mit
`font-display: swap`, der Text steht sofort.

### 6.1 Vier Breiten

| Breite | Token | Wofür |
|---|---|---|
| 125 % | `--breit` | Seitentitel, Abschnittsüberschriften, Wortmarke |
| 100 % | – | Fließtext, Namen, Beschriftungen |
| 75 % | `--schmal` | jede Zahl in einer Kolonne, Kürzel im Turm, Achsen |
| 62,5 % | `--eng` | große Kennzahlen (Kennzahlleiste, Countdown) |

### 6.2 Skala

Die klassische Folge nach Bringhurst (*The Elements of Typographic Style*,
3.1.1): 12, 14, 16, 18, 21, 24, 36, 48, 60. Keine Größe dazwischen; nur
Überschriften gleiten mit `clamp()` zwischen zwei benachbarten Stufen.
„Fließtext“ heißt: Absätze im Inhalt, Kopfsatz, Hinweise, Tabellen – nie unter
16 px. Beschriftungen, Tabellenköpfe, Unterzeilen und der Fuß stehen in
Stufe 2.

| Token | px / rem | Einsatz | Breite | Gewicht | Zeilenhöhe |
|---|---|---|---|---|---|
| `--text-1` | 12 / 0,75 | Achsen, Diagrammbeschriftung | 75 % | 500 | 1,3 |
| `--text-2` | 14 / 0,875 | Beschriftungen, Tabellenkopf, Fuß, Label unter Kennzahlen | 100 % | 500–600 | 1,4 |
| `--text-3` | 16 / 1 | Fließtext, Tabellen, Turm | 100 % (Zahlen 75 %) | 400, Namen 600 | 1,5 / Tabelle 1,35 |
| `--text-4` | 18 / 1,125 | Kopfsatz unter dem Titel (am Telefon Stufe 3), h3 | 100 % | 400, h3 700 | 1,5 / 1,25 |
| `--text-5` | 21 / 1,3125 | h2 am Telefon, Namen statt Zahlen in der Leiste | 125 % / 100 % | 750 / 700 | 1,15 |
| `--text-6` | 24 / 1,5 | h2 | 125 % | 750 | 1,15 |
| `--text-7` | 36 / 2,25 | h1 am Telefon, Kennzahlen | 125 % / 62,5 % | 800 / 700 | 1,05 / 1 |
| `--text-8` | 48 / 3 | h1 | 125 % | 800 | 1,0 |
| `--text-9` | 60 / 3,75 | Titel der Startseite | 125 % | 800 | 1,0 |

h1 gleitet zwischen Stufe 7 und 8 (`clamp()`), der Titel der Startseite
zwischen 7 und 9. Fließtext steht nie unter 16 px. Zeilen bleiben unter 80
Zeichen (`--mass: 38rem`). Zahlen in Kolonnen immer
`font-variant-numeric: tabular-nums lining-nums` und rechtsbündig; das Minus
ist ein echtes Minus (−), der Gedankenstrich steht für „kein Wert“, der
Bis-Strich in Zeiträumen (1950–2026).

## 7. Raster und Abstand

- **Satzspiegel:** höchstens `76rem`, Rand `1.5rem`, am Telefon `1rem`.
- **Spalten:** zwölf, Abstand `1.5rem`. Gebraucht werden zwei Teilungen:
  7 + 5 (Turm neben Nebenblock) und 6 + 6 (zwei Wertungen). Unter `56rem`
  untereinander.
- **Abstände** in Viererschritten, nur aus dieser Reihe:

  | Token | px | Einsatz |
  |---|---|---|
  | `--abstand-1` | 4 | innerhalb einer Zeile |
  | `--abstand-2` | 8 | Label zu Wert |
  | `--abstand-3` | 12 | Zellen, Listen |
  | `--abstand-4` | 16 | Überschrift zu Inhalt |
  | `--abstand-5` | 24 | Blöcke in einem Abschnitt |
  | `--abstand-6` | 32 | Kopf zu Inhalt |
  | `--abstand-7` | 48 | Abschnitt zu Abschnitt |
  | `--abstand-8` | 64 | vor dem Fuß |

- **Ecken:** Datenflächen eckig (0). Knöpfe und Felder `--radius` 3 px.
- **Linien:** Haarlinie 1 px `--border`. Die Linie unter einem Tabellenkopf
  und über einer Achse ist 1 px Tinte – wie auf dem Monitor.
- **Flächen:** Text steht auf dem Grund. Daten (Tabelle, Turm, Hinweis) stehen
  auf der Fläche. Ohne Schatten, ohne Rahmen um die Fläche. Das kehrt das
  frühere „alles auf einem Papier“ um, mit Absicht: Auf dem Papier sah man
  nicht, wo die Erklärung aufhört und die Daten anfangen, und jede Grenze
  brauchte eine getönte Leiste. Jetzt ist der Unterschied der Grund selbst.
- **Kein `style`-Attribut, kein `define:vars`** (beides verbietet die
  Inhaltsrichtlinie). Höhen von Balken stehen als SVG-Attribut, Positionen
  ergeben sich aus dem Raster. Neue Komponenten haben keinen eigenen
  `<style>`-Block, wenn sie viele Elemente zeichnen – Astro hängt jedem
  Element ein Bereichsattribut an.

## 8. Bausteine

Jeder Baustein steht einmal in `theme.css` oder als Komponente in
`src/components/`. Eine Seite setzt sie zusammen und erfindet keine eigenen.

### 8.1 Kopf (`Seite.astro`)

Klebt oben, auf dem Grund, eine Haarlinie darunter.

- **Wortmarke:** „Formula 1“ breit und schwer, „Statistics“ normal, `--muted`.
- **Navigation:** Next race, Seasons, Races, Drivers, Teams, Engines, Tyres,
  Circuits, Analysis ▾. Aktiver Punkt: Tinte, 650, 2 px Tinte darunter.
- **Analysis ▾** ist ein `<details>` mit sechs Namen, ohne Beschreibung.
- Suche, Hell/Dunkel, Menü wie bisher; das Menü am Telefon bleibt `<details>`
  mit zwei Listen (Browse, Analysis), jedes Ziel direkt ein Link – die
  Browserprüfung sucht sie dort bei 360 px.
- `Seite` nimmt `lackierung` (Team-ID) entgegen und setzt
  `data-lackierung` an `<body>`. Daraus entstehen `--lackierung` und
  `--lackierung-linie` (§ 5.4).

### 8.2 Seitenkopf

```text
Drivers / Spain                                                  [ESP]
▌Fernando Alonso                       (h1 breit, auf dem Streifen der Lackierung)
▌World Champion in 2005 and 2006. Most starts with Renault: 105 of 446.
▌Born 29 July 1981 in Oviedo, Spain. Timing code ALO, car number 14.
1950 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄▆┄▆▆▆▆█████▆▆▆▆┄┄▆▆▆▆▆▆ 2026
2        32      446          106      23       26         0        7      1
Titles   Wins    Starts       Podiums  Poles    Fastest    Sprint   DotD   Grand Slams
▔▔       7% of   All-time record (lila)
[☆ Follow]  [Compare with another driver]  [Season by season in the Explorer]
```

- Keine getönte Fläche mehr. Der Kopf gehört zur Seite.
- Der Streifen links an Titel und Kopfsatz (`.titelblock`) ist 6 px
  `--lackierung`. Seiten ohne Gegenstand haben keinen.
- Der **Kopfsatz** sagt in ganzen Sätzen, was keine Zahl sagt. Keine
  Aufzählung mit Mittelpunkten, keine Trennlinien. Vorlagen je Seitentyp:

  | Seite | Kopfsatz, in dieser Reihenfolge, was es gibt |
  |---|---|
  | Fahrer | Titeljahre („World Champion in 2005 and 2006.“), Team der Lackierung („Most starts with Renault: 105 of 446.“ / „All 12 starts with Connaught.“), Geburt, Tod, „Timing code ALO, car number 14.“, voller Name |
  | Team | Titel („16 constructors' titles, the last in 2008.“), Zeitraum und Lücken stehen im Epochenband, Herkunft, voller Name, Vorgänger und Nachfolger |
  | Saison | Rennen („23 races, 20 run so far, 6 with a sprint.“), Fahrertitel mit Runde und Link auf das Rennen, Konstrukteurstitel oder „no constructors' championship yet“ |
  | Rennen | Strecke, Ort, Datum, Runden und Distanz in einem Satz; Sieger steht im Podium-Turm |
  | Strecke, Motor, Reifen | Ort/Herkunft, Zeitraum in Worten nur, wenn das Epochenband ihn nicht zeigt |

  Familie steht als eigener Satz darunter („Family in Formula 1: …“).
- Das **Länderkürzel** steht oben rechts in einem Rahmen aus Tinte – eine
  Angabe aus der Zeitnahme, kein Knopf. Auf der Saisonseite steht dort die
  Nachbarschaft: „‹ 1987  1989 ›“.

### 8.3 Epochenband (`Epochenband.astro`)

Ein Feld je Saison von 1950 bis zur jüngsten, ein Raster mit
`grid-auto-flow: column` und `minmax(0, 1fr)`. Gefahrene Saison: zwei Drittel
hoch in `--lackierung-linie`. Titeljahr: volle Höhe in Tinte mit Goldkappe –
die Form trägt den Titel, nicht nur die Farbe (Gold auf Beton: 1,6:1). Übrige:
2 px Linie in `--border-strong`. Darunter 1950, erstes und letztes Jahr, heute
(eine Zahl entfällt, wenn sie näher als acht Saisons an einer anderen steht).
Höchstens `40rem` breit.

Für Vorleser `role="img"` mit einem Satz: „Seasons: 2001, 2003–2018,
2021–2026. Titles: 2005, 2006.“ Die Felder sind `aria-hidden`.

Benutzt auf: Fahrer, Team, Motor, Reifen, Strecke (Jahre mit einem Rennen
dort), Rennen (Jahre, in denen dieser Grand Prix stattfand).

### 8.4 Meisterband (`Meisterband.astro`)

Die Signatur der Startseite. Jede Saison ein Balken in der Farbe des Teams,
für das ihr Fahrermeister die meisten Rennen fuhr; die Höhe ist sein Anteil an
den möglichen Punkten aus den eigenen Starts – Rennen und Sprints, vor der
Streichung, doppelte und halbe Punkte eingerechnet (`lib/profil.js`,
`moeglich`, dieselbe Größe wie im Vergleich). Gesammelt einmal je Bau in
`components/meisterband-daten.js`. Die laufende Saison (ein Rennen ohne
Ergebnis) ist schraffiert, auch wenn der Titel schon vergeben ist. Ein
gestrichelter Maßstab bei 50 %, die Achse in Tinte, Jahrzehnte darunter.

- Auf der **Monitorfläche** (§ 5.5). Die Farbe zeigt die Epoche der
  Lackierung; welches Team es war, sagt der Text – Alfa, Ferrari und Maserati
  sind alle rot.
- Jedes `li` ist ein Raster aus zwei Zeilen: Balken, darunter (bei Jahrzehnten)
  die Jahreszahl. Spalten `minmax(0, 1fr)`: Bei 360 px werden die Balken 2,5 px
  schmal, statt die Seite waagerecht scrollen zu lassen.
- Jeder Balken ist ein Link auf seine Saison. Sein Text („1988: Ayrton Senna
  (McLaren), 94 of 144 possible points from 16 starts, 65%“) ist der Name des
  Links. Mit Skript erscheint er bei Zeiger, Fokus oder Antippen in einer
  eigenen **Zeile** unter der Legende und bleibt dort, bis ein anderer Balken
  gewählt wird; Esc leert sie. Am Telefon erscheint die Zeile erst beim
  Antippen. Ohne Skript zeigt der Browser den Text als Tooltip.
- **Tastatur:** Mit Skript ist das Band ein Tabstopp; ←/→, Pos1 und Ende
  wandern durch die Jahre. Ohne Skript ist jeder Balken ein Tabstopp.
- **Touch:** Der erste Tipp zeigt das Jahr, der zweite auf denselben Balken
  öffnet die Saison.
- **Bewegung:** die einzige Animation der Seite (§ 9).
- **Klein** (`markiert={jahr}`): auf der Saisonseite, 40 px hoch, hell auf dem
  Grund, ohne Links, das Jahr in voller Farbe mit einer Marke in Tinte
  darüber, die übrigen auf 40 % zurückgenommen. Für Vorleser ein Satz mit den
  Zahlen dieses Jahres.

### 8.5 Zeitnahme-Turm (`.turm`)

```text
 1 ▌ANT  Kimi Antonelli Mercedes          390
 2 ▌VER  Max Verstappen Red Bull          279   −111
```

- Spalten: Position (Feld 2 rem, Podium in Gold/Silber/Bronze, sonst
  `--zebra`), Teamstreifen 4 px, Kürzel (75 %, 800, Tinte), Name (100 %, der
  Link) mit dem **Team daneben in `--muted`** – am Telefon in einer zweiten
  Zeile –, Wert (75 %, 700, rechtsbündig), Abstand (75 %, `--muted`,
  rechtsbündig, echtes Minus).
- Die Teamfarbe setzt `data-team` am `li`; sie ist Zugabe, der Teamname steht
  immer da.
- Auf `--surface`, Zeilen durch Haarlinien getrennt, keine Ecken.
- **Nur für einen Wert mit Abstand.** Eine Wertung mit Siegen, Teams, Punkten
  bleibt eine Tabelle. Startseite: zehn Zeilen, am Telefon fünf. Saisonseite:
  je fünf, darunter „All 25“ auf die ganze Wertung.
- Varianten: **Teams** ohne Kürzel (die Spalte entfällt von selbst).
- Das Element ist eine `<ol>`; der Rang steht im Feld, nicht im Zähler
  (Gleichstand: „=5“). Für Vorleser hängen „points“ und „behind“ als
  versteckter Text an Wert und Abstand.
- Die Ranglisten der Rekordseite (`.rangkarte`/`.rangliste`) sehen aus wie ein
  Turm und behalten ihre Klassen – `lib/info.js` hängt die Info-Knöpfe an
  `.rangkarte > h3`.

### 8.6 Kennzahlleiste (`.kacheln`)

Der Klassenname bleibt `.kacheln` (und `.stark` für die tragende Zahl):
`lib/info.js` hängt die Info-Knöpfe an `.kacheln li > span`, und `lib/` bleibt
unberührt.

Die Zählungen einer Seite in einer Reihe: Wert groß und eng (`--eng`, Stufe 7,
700), Beschriftung darunter (Stufe 2, `--muted`), darunter eine leise
Unterzeile (Siegquote, Nennungen, Titeljahre). Keine Kästen, keine Linien
dazwischen; ein Raster `repeat(auto-fill, minmax(8rem, 1fr))`, am Telefon drei
Spalten.

Die eine Zahl, die die Seite trägt, steht zuerst und bekommt einen 6 px
Streifen in `--lackierung` unter der Zahl. Titel, wenn es welche gibt; sonst
Siege; sonst Starts. Ein Wert, der den Allzeitrekord hält oder einstellt,
steht in **Lila** und sagt es in der Unterzeile („All-time record“) – Alonsos
446 Starts. Die Rekordwerte kommen aus denselben Bestenlisten wie die
Rekordseite (`components/rekordwerte.js`, einmal je Bau).

### 8.7 Tabelle (`.tabelle`)

- Auf `--surface`. Kopf: Stufe 2, 600, `--muted`, darunter 1 px Tinte. Keine
  getönte Kopfzeile.
- Namen 100 % 600 Tinte; Zahlen 75 %, rechtsbündig. Jede zweite Zeile `--zebra`.
- Teamstreifen 4 px an der ersten Zelle, wenn die Zeile ein Team verlinkt.
- Plakette (`.pos`): Podium Gold/Silber/Bronze; sonst nur die Ziffer. Ausfall:
  rot gerahmt mit Text (Ret, DNQ). Kein Grün mehr für „in den Punkten“.
- Bleibt: klebende Namensspalte, Scrollschatten an den Kanten, klebender Kopf
  in langen Tabellen, keine eigene Höhe am Telefon.
- Zelle mit zwei Angaben (Team und Motor): zweite Angabe in einer zweiten
  Zeile, leise – nicht mit Mittelpunkt in einer Zeile.

### 8.8 Hinweis und Flagge (`.hinweis`)

Ein Absatz auf `--surface` mit einem 4 px Streifen links. Die Art steht im
Text – als fettes erstes Wort („Dropped scores:“) oder im Satz selbst („The
World Champion would be the same.“). Die Farbe trägt nie allein.

| Klasse | Streifen | Erstes Wort (Beispiele) | Wofür |
|---|---|---|---|
| `.hinweis` | `--flagge-blau` | „Note:“ | Erklärung, Bezug, ein What-if ohne Titelwechsel |
| `.hinweis.warn` (auch `.gelb`) | `--flagge-gelb` | „Gap in the data:“, „Dropped scores:“, „Indianapolis 500 only:“ | Datenlücke, Sonderfall, Modell |
| `.hinweis.akzent` | Tinte | „Title decided:“, Titelwechsel im What-if | ein Ergebnis |
| `.hinweis.gut` | `--flagge-blau` | – | wie `.hinweis` (Name bleibt für den Bestand) |
| `.hinweis.karo` | Karomuster aus Tinte und Fläche | „Season complete.“ | nur: Saison abgeschlossen |

Die Klassennamen bleiben, wie sie im Bestand stehen; die Browserprüfung liest
`.hinweis.akzent`. Das Karomuster ist ein Muster, das eine Flagge zeigt, kein
Verlauf als Schmuck. Grün und Rot als Hinweis gibt es nicht.

### 8.9 Sprungleiste (`Sprung.astro`)

Ab zwei Abschnitten. Klebt unter dem Kopf – unter `52rem` nicht, sonst deckten
beide Leisten ein Drittel des Schirms ab. Reiter in Stufe 2; der gelesene
Abschnitt in Tinte mit 3 px `--lackierung-linie` darunter. Die Beschriftung
ist der Titel des Abschnitts oder dessen erstes Wort – nicht ein drittes Wort
dafür.

### 8.10 Abschnitt (`.abschnitt`)

Abstand `--abstand-7` darüber, dann die Überschrift (h2, breit, Stufe 6), ein
Satz dazu in `--muted` nur wenn nötig, rechts gegebenenfalls „All seasons“ als
Link. **Keine getönte Leiste.**

### 8.11 Links und Knöpfe

- **Link im Text:** Tinte, Unterstreichung 2 px in `--lackierung-linie`,
  Abstand 0,2 em; beim Überfahren 3 px. Im Fuß dasselbe – vorher fielen die
  Links dort durch (1,85:1 zum Umtext, keine Unterstreichung).
- **Link als Zeile** (Name in Tabelle oder Turm): Tinte 600, ohne Strich;
  beim Überfahren und im Fokus unterstrichen – wie bisher. Erkennbar am Ort:
  Namen mit eigener Seite sind Links; ein Team ohne Seite steht in Tinte 400.
- **Knopf:** gefüllt Tinte, Schrift `--plane` (Hauptaktion, höchstens einer je
  Ansicht); leise: Rand `--border-input`, Schrift Tinte.
- **Gewählt** (Chips, Optionen): gefüllt Tinte. Nicht gewählt: Rand.
- **Fokus:** 2 px Tinte, Abstand 2 px, auf jedem Grund sichtbar; auf dem
  Monitor in dessen Tinte.

### 8.12 Fuß

Auf dem Grund, oben 1 px Tinte. Links die Wortmarke und der eine Satz zur
Herkunft; daneben Browse und Analysis; darunter Quelle, Fassung, Lizenz, API,
Feed, Kalender, klassische Fassung. Alle Links unterstrichen.

### 8.13 Favicon und Vorschaubild

Beide zeigen das Meisterband, nicht die Marke des Sports. Das alte Favicon
stand auf „F1“, das alte Vorschaubild auf schrägen roten Streifen wie im Logo
der Formel 1, einer gesperrten Versalzeile und fast schwarzem Grund.

| | Vorlage | Inhalt |
|---|---|---|
| `public/og.png` (1200 × 630) | `scripts/og-bild.html`, gezeichnet mit `node scripts/og-bild.mjs` | Wortmarke, ein Satz, darunter das Meisterband der abgeschlossenen Saisons 1950–2025 auf der Monitorfläche, Quelle im Fuß. Feste Werte – Geschichte ändert sich nicht; keine Anzahl, die nach dem nächsten Rennen falsch wäre. Einmal im Jahr, nach der Saison, neu zeichnen. |
| `public/favicon.svg` | von Hand | Monitorfläche `#232830`, vier Balken in den dunklen Lackierungen von Ferrari, Lotus, McLaren und Mercedes, eine Achse in Tinte. Geprüft bei 16, 32 und 64 px auf hellem und dunklem Grund. |

Recraft, das sonst erste Werkzeug für Bildmarken, war in dieser Umgebung nicht
angebunden; beide sind von Hand gezeichnet und aus dem Meisterband abgeleitet.

### 8.14 Zustände

- **Laden** (Inseln, „On this day“): die Fläche steht in ihrer endgültigen
  Höhe, darin „Loading …“ in `--muted`. Kein Spinner, kein Skelett.
- **Leer:** ein Satz, der sagt, warum, und wohin („No race has ever been held
  on 3 January. Go to the next race day, 12 January.“).
- **Fehler:** blauer Hinweis mit „Could not load …“ und dem, was trotzdem geht.
  Nie stilles Verschwinden, wenn der Abschnitt schon zu sehen war.
- **Ohne JavaScript:** alles Statische steht; Inseln zeigen ihren
  `nur-ohne-js`-Text.

## 9. Bewegung

- Es gibt **eine** Animation: das Meisterband wischt beim Laden der
  Startseite einmal von 1950 bis heute auf, 800 ms, `ease-out`, als
  `clip-path` auf der Reihe der Balken. Ohne Füllmodus: Danach ist kein
  `clip-path` mehr gesetzt, Fokusrahmen und Jahreszahlen bleiben ganz.
- Zustandswechsel (Hover, Aufklappen, Reiter) geschehen sofort, ohne
  Übergang.
- Bei `prefers-reduced-motion: reduce` steht das Band sofort da.
- Das Pulsieren auf der Lagekarte entfällt.

## 10. Texte

- Britisches Englisch, Datumsformat „22 November 2026“.
- Sätze statt Werbung. Kein „not copied from a curated list“, kein „every“,
  wenn „all“ reicht, keine Superlative über die Seite selbst.
- Überschriften sagen, was darunter steht („Championship after round 20“),
  nicht was man fühlen soll.
- Keine Metazeilen mit Mittelpunkt. Zwei Angaben: Komma oder zwei Zeilen.
- Zahlen: Tausender mit Komma (27,731), Prozent ohne Leerzeichen (65%), Minus
  als −, „kein Wert“ als –, Zeiträume mit Bis-Strich (1950–2026).
- Linkt ein Text, steht das Ziel im Linktext („Read the preview“), nicht
  „here“.
- Die Herkunft der Zahlen steht einmal: im Fuß.

## 11. Abbauliste

| Was | Wo | Ersatz |
|---|---|---|
| vier Zahlenkacheln (Races, Drivers, Teams, Circuits) | Startseite | Meisterband |
| „Right now“ in drei gleichen Spalten | Startseite | Turm + nächstes Rennen + Rekordwechsel, verschieden gewichtet |
| Verzeichnis „Explore“ und „Tools“ | Startseite | Navigation |
| „Recent seasons“ (sechs Felder) | Startseite | Meisterband |

Was auf der Startseite bleibt, unter den ersten 800 px: „On this day“ und
„Following“ (die Browserprüfung braucht ihre Haken `[data-heute-inhalt]`,
`[data-heute-datum]`, `[data-gefolgt-leer]`). Darüber, in dieser Reihenfolge
im Quelltext: Titel, Meisterband, nächstes Rennen, WM-Stand, Rekordwechsel.
Breit stellt das Raster den Stand links neben die beiden anderen; am Telefon
stehen Band, nächstes Rennen und der Führende in den ersten 800 px (gemessen:
bei 390 px endet die zweite Zeile des Turms bei 787 px, bei 360 px die erste
bei 781 px).
| Lead mit Herkunftsbehauptung | Startseite, Rekorde, Quiz | Fuß |
| getönte Leiste vor jedem Abschnitt | alle | Abstand + breite Überschrift |
| getönter Seitenkopf, Kacheln darin | alle | Kopf auf dem Grund + Kennzahlleiste |
| Beschreibungszeilen im Analysis-Menü | Kopf | nur Namen |
| Linkblau, Ergebnisrot | alle | Tinte + Lackierung, Lila |
| grüne Plakette „in den Punkten“ | Tabellen | Punktespalte |
| Podium als drei gleiche Karten | Rennseite | Turm mit drei Zeilen |
| Pulsieren, Übergänge | Lagekarte, Karte, Explorer, Quiz | keine |
| Versalien mit Sperrung | What-if | normale Schreibung |
| Mittelpunkt als Trenner im Text | 14 Stellen | Komma oder zweite Zeile |

## 12. Tabu – und wann doch

Diese Muster sehen generiert aus. Sie kommen nur vor, wenn eine Angabe sie
verlangt; die Ausnahme steht hier.

| Muster | Ausnahme |
|---|---|
| Versal-Oberzeile über Überschrift | keine |
| Monospace für kleine Labels | keine (Zahlen sind Archivo schmal) |
| `→` an Links | keine |
| Metazeile A · B · C | keine |
| ein Wort der Überschrift farbig oder kursiv | keine |
| gleiche abgerundete Karten mit Schatten | keine; Schatten nur für Aufklappendes über der Seite |
| Verlauf als Deko | Karomuster der Zielflagge (§ 8.8); Scrollschatten der Tabellen (zeigen, dass es weitergeht) |
| 01/02/03 ohne Reihenfolge | keine; Positionen sind eine Reihenfolge |
| Einblenden jedes Abschnitts | keine (§ 9) |
| Creme, Serife, Terrakotta | keine |
| fast schwarz mit Neonakzent | keine; der dunkle Modus ist Asphalt, die Farben sind Lackierungen |

## 13. Eine neue Seite bauen

1. Hat sie einen Gegenstand? Die Lackierung steht in der Tabelle unter
   Prinzip 1. Dann `<Seite lackierung={teamId}>`, `.titelblock` um Titel und
   Kopfsatz, Epochenband.
2. Kopf: Brotkrume, h1, Kopfsatz nach der Vorlage in § 8.2, Kennzahlleiste
   (`.kacheln`) mit der tragenden Zahl zuerst (`.stark`).
3. Sprungleiste ab zwei Abschnitten.
4. Ranglisten mit einem Wert als Turm, alles Breitere als `.tabelle`,
   Hinweise mit Flagge und Wort.
5. Keine eigene Farbe, Größe oder Abstand im `<style>` der Seite – nur
   Rollen und Tokens (`--text-*`, `--abstand-*`). Braucht es eine neue, kommt
   sie in `theme.css` mit Begründung. Kein `style`-Attribut, kein
   `define:vars`.
6. Den einen lauten Moment benennen. Gibt es zwei, einen leiser machen.
7. Prüfen: `npm run test:kontraste`, `npm run build`, `npm run test:oberflaeche`,
   Bildschirmfotos hell und dunkel, 1440 und 390 px
   (`node scripts/bildschirmfotos.mjs`).

## 14. Prüfungen

| Befehl | Prüft |
|---|---|
| `npm run test:kontraste` | jede Rolle auf jeder Fläche, beide Modi |
| `npm run lint`, `npm test`, `npm run build` | Code, Engine, Ausgabe und Links |
| `npm run test:oberflaeche` | Browser: Konsolenfehler, CSP, Bedienung, Telefon |
| `node scripts/bildschirmfotos.mjs <ziel>` | Hauptseiten hell/dunkel, 1440/390, für den Vergleich |

---

## Anhang A: Befund vor der Umstellung

### A.1 Mängel je Seitentyp

- **Startseite.** Überschrift, Lead, vier Zahlenkacheln: das Standard-Hero.
  „Right now“ in drei gleichen Spalten; „Explore“/„Tools“ wiederholt die
  Navigation; „Recent seasons“ wiederholt die Saisonliste. Vier gleich
  getönte Abschnittsleisten. Die Herkunftsbehauptung steht im Lead und im
  Fuß.
- **Saison.** Zwei Namenskacheln, vier Zählkacheln (darunter „Races 23“, das
  schon in der Brotkrume steht). Der WM-Stand – der Grund, die Seite
  aufzurufen – steht im zweiten Abschnitt unter einem Diagramm.
- **Rennen.** Podium als drei gleiche Karten, danach vier Kacheln, zehn
  Abschnitte mit getönter Leiste. „McLaren · Mercedes“ mit Mittelpunkt. Die
  grüne Plakette für P4–P10 erreicht 4,42:1 (axe).
- **Fahrer, Team, Motor, Reifen.** Getönter Kopf, darunter sechs bis neun
  Kacheln mit gleichem Gewicht; die lauteste Fläche ist der blaue Knopf
  „Compare with another driver“. Dunkel wird die Ferrari-Tönung braun.
- **Rekorde, Änderungen.** Zwölf Ranglisten mit roten Rekordzahlen – Rot
  heißt hier „Ergebnis“ und ist überall. Der Lead wiederholt die
  Herkunftsbehauptung.
- **Werkzeuge (Team-mates, Vergleich, Explorer, Quiz).** Gefüllte blaue Chips
  in Reihe; im Quiz eine blaue Wand aus sieben gewählten Themen. Gerahmte
  Kästen für die Schwierigkeit.
- **Übersichten.** Getönter Kopf ohne Inhalt außer dem Lead; die Weltkarte
  hat 78 Links ohne Namen (axe).
- **Überall.** Die Navigation steht siebenmal je Seite (Kopf, Telefon, Fuß,
  Startseite, 404). Über 40 verschiedene Schriftgrößen in den
  `<style>`-Blöcken. Fußlinks ohne Unterstreichung (1,85:1 zum Umtext).
  Alles gleich gewichtet: Kachel, Leiste, Karte.

### A.2 Seiteninventar

| Seite | Aufgabe | Kopf heute | Abschnitte |
|---|---|---|---|
| `/` | Einstieg: was jetzt ist, wohin es geht | eigenes Hero, 4 Kacheln | Right now · Following · On this day · Explore · Recent seasons |
| `/preview/` | das nächste Rennen | Kopf, Wappen | Schedule · Circuit · Strong here · Standings · Marks within reach |
| `/seasons/` | eine Saison wählen | Kopf, Lead | acht Jahrzehnte |
| `/seasons/[jahr]` | eine Saison ganz | Kopf, 2 + 4 Kacheln | Progression · Standings · Results grid · Calendar · Entries · What if |
| `/races/` | ein Rennen finden | Kopf, Lead | ein Abschnitt je Jahr |
| `/races/[id]` | ein Rennen ganz | Kopf, Podium, 4 Kacheln | bis zu zehn |
| `/drivers/`, `/teams/`, `/engines/`, `/tyres/` | finden und sortieren | Kopf, Lead | Tabelle |
| `/drivers/[id]` | eine Karriere | Kopf (Team getönt), 6–9 Kacheln | Numbers · Career · Seasons · Races · Team-mates · Circuits |
| `/teams/[id]` | ein Team und seine Namen | Kopf, 6 Kacheln | Numbers · Lineage · Seasons · Drivers |
| `/engines/[id]`, `/tyres/[id]` | ein Hersteller | Kopf, 6 Kacheln | fünf |
| `/circuits/`, `/circuits/[id]` | Karte und eine Strecke | Kopf, Karte | vier |
| `/records/`, `/changes/` | Bestmarken und ihre Bewegung | Kopf, Lead | sechs / fünf |
| `/teammates/`, `/comparison/`, `/explorer/`, `/quiz/` | Werkzeuge | Kopf, Lead | Insel |

Doppelte Wege: Navigation (Kopf, Telefon, Fuß) + Startseiten-Verzeichnis +
404-Karten; Streckenblock der Vorschau ≈ Streckenseite (beabsichtigt, aber
mit eigenem CSS je Seite); Indy-500-Erklärung an sechs Stellen;
„runs in your browser“ an drei.

### A.3 Ausgangswerte Barrierefreiheit

Kontraste der Rollen: alle Textpaare bestanden (88 Paare), die hellen
Serienfarben `--s4`, `--s7`, `--s8` bewusst unter 3:1.

axe-core 4.10 (WCAG 2.1 A/AA), 13 Seiten, hell und dunkel:

| Befund | Wo | Anzahl |
|---|---|---|
| `link-in-text-block` | Fuß, jede Seite | 5 je Seite |
| `color-contrast` | grüne Plakette, Rennseite hell | 1 |
| `nested-interactive` | Rundenverlauf, Explorer-Bild, Weltkarte | je 1 |
| `link-name` | Weltkarte, Punkte ohne Namen | 78 |

## Anhang B: Revision 1 – nach dem Plan-Review

Zwei Prüfer, nur lesend, haben den Entwurf angegriffen: Sitz A auf
Korrektheit, Sitz B aus Sicht des Lesers (`design-review/review-seat-a.md`,
`review-seat-b.md`). Jede strittige Behauptung wurde nachgeprüft
(`design-review/review-merge.md`, Fakten F1–F17); zwei waren falsch (doppelte
Punkte fehlten im Maximum; „Folgen“ sei ein zweiter gefüllter Knopf).

Was der Entwurf falsch hatte und jetzt anders steht:

| Fehler im Entwurf | Jetzt |
|---|---|
| Das Kontrastskript, das als Gate dienen sollte, lief nicht (Regex ohne Backslashes) | repariert, 88 Paare, Exit 0 |
| Der Text eines Balkens ersetzte die Legende – WCAG 1.4.13 verlangte Esc | eigene Zeile, Legende bleibt (§ 8.4) |
| Positioniertes `li` gab dem Text 3 px Breite; Jahreszahlen machten Spalten breit | Raster mit zwei Zeilen, `minmax(0, 1fr)` |
| `clip-path` mit Füllmodus hätte Achse und Fokus dauerhaft beschnitten | ohne Füllmodus (§ 9) |
| Bei 360 px wäre das Band breiter als der Schirm gewesen | Balken schrumpfen auf 2,5 px |
| Im Turm stand das Team nur als Farbe | Teamname daneben (§ 8.5) |
| Titeljahre im Epochenband nur durch Gold erkennbar (1,6:1) | durch die Höhe (§ 8.3) |
| Neue Klassennamen hätten `info.js` die Info-Knöpfe genommen | `.kacheln`, `.stark`, `.rangkarte` bleiben |
| Umbenannte Hinweisklassen hätten die Browserprüfung gebrochen | Klassen bleiben, Zuordnung in § 8.8 |
| Die 800-px-Forderung der Startseite stand nicht im Plan | gemessen und erfüllt (§ 11) |
| „Of the points available“ war ungenau | Zahlen im Text des Balkens (§ 8.4) |
| Lila auf jeder ersten Zeile der Rekordseite wäre das alte Rot gewesen | Lila nur zwischen anderen Werten (§ 8.6) |
| Lackierung nur für vier Seitentypen festgelegt | Tabelle unter Prinzip 1 |
| Das kleine Band auf der Saisonseite wäre ein zweiter lauter Moment gewesen | hell, ohne Links |

Die festgelegten technischen Punkte stehen als L1–L23 in
`design-review/review-merge.md`.

### Offen zur Freigabe

| # | Frage | Empfehlung |
|---|---|---|
| D1 | Was misst die Höhe des Meisterbands? | Wie bestellt: Anteil an den Punkten aus den eigenen Starts, mit den Zahlen im Text |
| D2 | Monitorfläche dunkel auch im hellen Modus? | Ja |
| D3 | Wann wischt das Band auf? | Bei jedem Laden der Startseite |
| D4 | Ist der Turm zu nah an der TV-Grafik der Formel 1? | Nein, die Form ist allgemein; keine F1-Schrift, kein F1-Rot |

Antworten vom 12. November 2026: alle vier wie empfohlen.

| # | Entscheidung |
|---|---|
| D1 | Die Höhe bleibt der Anteil an den möglichen Punkten aus den eigenen Starts; jeder Balken nennt die Zahlen. |
| D2 | Die Monitorfläche ist auch im hellen Modus dunkel. |
| D3 | Das Band wischt bei jedem Laden der Startseite auf (nur CSS). |
| D4 | Der Turm bleibt; keine F1-Schrift, kein F1-Rot, kein Logo. |

Die Freigabe ist damit erteilt; die Fragerunde ist geschlossen.

## Anhang C: Abgleich mit den Mustern generierter Seiten

Nachgeholt mit dem Skill `frontend-design`, der in Phase 2 nicht geladen war.
Er nennt fünf Muster, auf die generierte Gestaltung heute zuläuft. Der Plan
wurde gegen jedes geprüft, und gegen die Frage, ob er bei einem ähnlichen
Auftrag – einer beliebigen Sportstatistikseite – genauso aussähe.

| Muster | Im Plan? | Entscheidung |
|---|---|---|
| Creme, Serife, Terrakotta | nein | – |
| fast schwarz, ein greller Akzent | nein: Asphalt `#1c2026`, und auf dem Monitor 50 Lackierungen statt einer Farbe | bleibt |
| Zeitungslayout: Haarlinien, keine Rundung, dichte Spalten | teilweise: Haarlinien und eckige Datenflächen | bleibt, eng begrenzt: Haarlinien nur zwischen Zeilen von Daten (Turm, Tabelle) und unter dem Kopf einer Tabelle, wie auf dem Monitor; Fließtext nie in Spalten; Knöpfe und Felder gerundet |
| Karten-Baukasten mit Schatten und Verläufen | nein; die alten `.karte` werden flach | – |
| Vorlagen-Beiwerk (Versal-Oberzeile, „A · B · C“, Monospace-Labels, `→`) | nein, alle vier stehen in § 12 als verboten; 14 Mittelpunkte im Bestand werden entfernt | – |
| „große Zahl, kleines Label, Nebenzahlen“ als Standard-Hero | die Kennzahlleiste hat diese Form | bleibt auf Fahrer-, Team-, Motor-, Reifen-, Strecken- und Saisonseiten, weil der Auftrag sie verlangt – aber nicht als Einstieg der Startseite (dort das Meisterband), und nie neutral: die tragende Zahl auf ihrer Lackierung, ein Rekord in Lila |

Geschärft nach diesem Abgleich:

- **Linke Streifen nur mit Bedeutung.** Ein Streifen links steht an drei
  Stellen und nirgends sonst: am Titel (die Lackierung), an einer Tabellen-
  oder Turmzeile (das Team), an einem Hinweis (die Flagge). Keine Karte, kein
  Zitat, kein Hover bekommt einen.
- **Eine Kühnheit je Seite** (Prinzip 5) gilt auch für die Breite: Die
  Abschnittsüberschriften sind breit, aber eine Stufe kleiner als der Titel
  und ohne Farbe; nur der Titel steht auf der Lackierung.
- **Texte** werden in Phase 3 nach den Regeln in § 10 geschrieben: aus Sicht
  des Lesers, aktiv, ohne Werbung, Fehler und Leere mit Richtung statt
  Stimmung.

## Abweichungen

*(nach der Umsetzung)*
