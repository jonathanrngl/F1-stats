# Plan-Review von `docs/DESIGN.md`: Zusammenführung

Stand 12. November 2026. Zwei Prüfer, beide nur lesend: Sitz A (Verifier,
Opus 5.5, Blick „Korrektheit“) und Sitz B (Fable 5.2, Blick „Leser zuerst,
Widerspruch“). Beide sind Modelle desselben Herstellers – die Forderung „zwei
Modellfamilien“ ist damit nur halb erfüllt; die zweite Familie stand in dieser
Umgebung nicht zur Verfügung.

Wortlaut: `review-seat-a.md`, `review-seat-b.md`. Prüfauftrag: `review-brief.md`.

## Fakten, vom Moderator geprüft

| # | Behauptung | Ergebnis | Wie geprüft |
|---|---|---|---|
| F1 | Das Kontrastskript ist kaputt: Regex ohne Backslashes, `--teams` druckt nur den Kopf (A) | **stimmt**, behoben | Datei gelesen (`:144`, `:167`), nach der Korrektur: 86 Paare, Exit 0, 50 Teams |
| F2 | Verschachteltes `light-dark(var(--ink), #27f4d2)` ist ungeprüft (A) | **funktioniert** | Chrome 157: hell `rgb(22,25,30)`, dunkel `rgb(255,153,51)` |
| F3 | `color-scheme: dark` an einem Element löst die Rollen dort dunkel auf | **stimmt** für Farbe und `--team` | Chrome 157; die ganze Monitorfläche mit echten Rollen zeigt das Prototyp-Bildschirmfoto |
| F4 | Ein Muster im `<a>` erbt `--team` | **stimmt** | Chrome 157, `fill` = `rgb(255,128,0)` |
| F5 | Das Raster bildet 77 Spalten ohne Spaltenzahl im CSS | **stimmt** | Chrome 157, 77 × 3 px |
| F6 | Doppelte Punkte fehlen im Maximum (B) | **falsch** | `profil.js:71` multipliziert `maxRennpunkte` mit `rennFaktoren` |
| F7 | Nenner sind die Starts des Meisters, Zähler die Punkte vor der Streichung (B) | **stimmt** | 1988: Senna 94/144 = 65,3 %, Prost 105/144 = 72,9 %; Rindt 1970: 45/81 aus 9 von 13 Rennen |
| F8 | Sprintpunkte gehören in den Zähler (A) | **stimmt**, so gebaut | `meisterband-daten.js`: `punkte + sprintPunkte` |
| F9 | Die Telefonprüfung läuft mit 360 px, nicht 390 (A) | **stimmt** | `pruefe-oberflaeche.mjs:315` |
| F10 | `info.js` hängt sich nur an `.kacheln li > span` und `.rangkarte > h3` (A) | **stimmt** | `lib/info.js:28-35` |
| F11 | Die Prüfung liest `.hinweis.akzent` (A, B) | **stimmt** | `pruefe-oberflaeche.mjs:245` |
| F12 | Die Sprungleiste erscheint ab zwei Zielen (A) | **stimmt** | `Sprung.astro:21` |
| F13 | „Folgen“ und „Compare“ ergeben zwei gefüllte Knöpfe (A) | **falsch** | „Folgen“ ist `knopf leise`, gedrückt füllt sich nur der Stern (`Folgen.astro:19, 55`) |
| F14 | Ein Text, der bei Hover die Legende ersetzt, fällt unter WCAG 1.4.13 und muss sich mit Esc schließen lassen (A) | **stimmt** | W3C-Erläuterung zu 1.4.13: ausgenommen ist nur, was nichts verdeckt oder ersetzt |
| F15 | `clip-path` mit `fill-mode: both` schneidet danach Achse und Fokusrahmen ab (A) | **stimmt** (Spezifikation) | der Endwert bleibt stehen; im Prototyp ohne Füllmodus |
| F16 | Positioniertes `li` gibt dem Hovertext 3 px Breite (A) | **stimmt** | Containing Block ist das nächste positionierte Element |
| F17 | `/drivers/` lädt zusätzlich latin-ext, 86 KB (A) | **ungeprüft**, plausibel | Namen wie Tomáš Enge; hingenommen, Libre Franklin hatte dieselbe Teilung |

## Festgelegt (technisch, eine richtige Antwort)

Zur Kenntnis, nicht zur Frage. Einspruch ist möglich.

| # | Festlegung | Quelle |
|---|---|---|
| L1 | Kontrastskript repariert; es ist das Gate für jede Farbänderung | A1, F1 |
| L2 | Alle alten Rollen (`--link*`, `--accent*`, `--band`) zeigen bis zur Umstellung auf Rollen in Tinte oder Fläche; am Ende entfernt | A15, B5 |
| L3 | Kein eigener Isolationsmodus für die Prototypen: Der Zweig ist die Isolation. Verworfen wird mit `git revert` der Prototyp-Commits; auf `main` kommt nichts vor der Freigabe des ganzen Pull Requests | A1, B5 |
| L4 | Meisterband: Der Text eines Balkens erscheint in einer **eigenen Zeile** unter der Legende, die Legende bleibt stehen (nichts wird verdeckt, also kein Esc-Zwang nach 1.4.13). Mit Skript bleibt die Zeile stehen, bis ein anderer Balken gewählt wird (1.4.13 „hoverable“, „persistent“); Esc leert sie. Ohne Skript: natives `title` | A2, F14 |
| L5 | Meisterband: Jahreszahlen als zweite Rasterzeile im `li`, kein positioniertes `li` | A3, F16 |
| L6 | Wischen ohne Füllmodus; nach 800 ms ist kein `clip-path` mehr gesetzt | A4, F15 |
| L7 | Spalten `minmax(0, 1fr)`, gebaut für 360 px | A5, F9 |
| L8 | Turm: der Teamname steht sichtbar, leise, hinter dem Fahrernamen – die Farbe ist Zugabe | A6 |
| L9 | Epochenband: Titeljahre ragen über die anderen hinaus (Form, nicht nur Farbe) | A7, B7 |
| L10 | Kennzahlleiste heißt weiter `.kacheln`, die tragende Zahl weiter `.stark`; Ranglisten weiter `.rangkarte` – `info.js` findet sie so ohne Änderung an `lib/` | A8, F10 |
| L11 | Hinweise behalten ihre Klassen: `.hinweis` = blaue Flagge, `.warn` = gelbe, `.akzent` = Streifen in Tinte („Ergebnis“: Titel entschieden, Titel wechselt), `.gut` = blau, neu `.karo`. Die Art steht im Text – als fettes erstes Wort oder im Satz selbst | A9, B11, F11 |
| L12 | Startseite am Telefon: Band ≤ 64 px hoch, Turm mit fünf Zeilen, Reihenfolge nach Messung so, dass Band, Stand und nächstes Rennen in 800 px stehen; „On this day“ und „Following“ darunter, ihre Prüfhaken bleiben | A11, B2, B11 |
| L13 | Lackierung: Rennen = Team des Siegers; Motor, Reifen, Strecke, Vorschau, Übersichten, Werkzeuge = Tinte; Team ohne Farbe = Tinte | A12, B6 |
| L14 | Die Daten des Meisterbands entstehen neben der Komponente (`components/meisterband-daten.js`) aus vorhandenen Funktionen, einmal je Bau; `lib/` bleibt unberührt | A13 |
| L15 | Kleines Band auf der Saisonseite: ohne Links, mit Satz für Vorleser, nicht auf dem Monitor – es ist Zusammenhang, nicht der laute Moment; das Jahr der Seite markiert | A14, B (zweiter lauter Moment) |
| L16 | Unterzeilen der Kennzahlen bleiben (Siegquote, Nennungen, Titeljahre) | B9 |
| L17 | Turm nur für einen Wert und Abstand; breitere Wertungen bleiben Tabellen | B8 |
| L18 | Lila: die absolute Bestmarke dort, wo sie zwischen anderen Werten auftaucht (Fahrerseite, Rennen, Änderungen). Auf der Rekordseite, wo jede erste Zeile ein Rekord ist, trägt der Halter die Goldplakette und der Wert steht in Tinte – sonst wäre Lila dort, was Rot vorher war | B12 |
| L19 | Textlinks immer 2 px unterstrichen, auch in Tinte; Namen in Tabellen wie bisher ohne Strich, mit Strich bei Zeiger und Fokus | B4 |
| L20 | Fahrerseite: Der Kopfsatz nennt das Team der Lackierung („Most starts: Renault, 136 of 446“), damit die Farbe erklärt ist | B6 |
| L21 | Sprungleiste klebt unter 52 rem nicht (wie bisher); ab zwei Abschnitten | A, F12 |
| L22 | Neue Komponenten ohne eigenen `<style>`-Block, kein `style`-Attribut, kein `define:vars` | A, B15 |
| L23 | Dokument bereinigt: vier Breiten, `clamp()` nur zwischen zwei Stufen, Fuß und Beschriftungen in Stufe 2 sind kein Fließtext, „65%“ ohne Leerzeichen | A16 |

## Offen für die Freigabe (echte Entscheidungen)

| # | Frage | Empfehlung |
|---|---|---|
| D1 | Was misst die Höhe des Meisterbands? | Den Anteil an den Punkten aus den eigenen Starts (wie bestellt, wie im Vergleich), genau beschriftet: „94 of 144 possible points from 16 starts“ |
| D2 | Monitorfläche: dunkel auch im hellen Modus? | Ja |
| D3 | Wann wischt das Band auf? | Bei jedem Laden der Startseite (nur CSS); einmal je Sitzung bräuchte ein Skript vor dem ersten Zeichnen |
| D4 | Der Turm ahmt die TV-Grafik nach – zu nah am Offiziellen? | Nein: Die Form ist im Motorsport allgemein; keine F1-Schrift, kein F1-Rot, kein Logo |

Antworten: siehe `DESIGN.md`, Anhang B.
