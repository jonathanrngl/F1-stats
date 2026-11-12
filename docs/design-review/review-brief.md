# Prüfauftrag: Plan-Review von `docs/DESIGN.md`

Stand: 12. November 2026, Zweig `design/zeitnahme` (von `origin/main`, a7252a2).
Geprüft vom Moderator vor dem Versand: Bau grün (`npm run build`, 75 s),
52 Vorher-Bildschirmfotos erzeugt, Kontrastskript läuft, axe-Ausgangswerte
erhoben.

## Was geprüft wird

`docs/DESIGN.md` – eine neue Designsprache („Zeitnahme“) für die statische
Astro-Seite unter `explorer/`. Sie ist noch **nicht** umgesetzt. Als Nächstes
entstehen drei Prototypen (Start-, Fahrer-, Saisonseite) als echte Seiten,
danach die Umsetzung über alle rund 24 Seitentypen.

## Harte Rahmenbedingungen (nicht verhandelbar)

- Daten und Logik bleiben: `explorer/src/engine/`, `explorer/src/lib/`, API,
  Feeds, Kalender werden nicht geändert. Gestaltet wird, nicht neu gerechnet.
- CSP in `explorer/astro.config.mjs`: keine `style="…"`-Attribute, keine
  fremden Hosts, Schriften nur selbst gehostet (`font-src 'self'`), Bilder
  nur `self` und `data:`.
- Jede Farbe ist eine Rolle in `explorer/src/styles/theme.css`, hell und
  dunkel in einem `light-dark()`.
- Teamfarben (`explorer/src/styles/teams.css`), Gold/Silber/Bronze, Lila,
  Serienpalette `--s1`…`--s8` bleiben (geänderte Serienfarben werden neu auf
  Farbfehlsichtigkeit geprüft).
- WCAG 2.1 AA hell und dunkel, sichtbarer Fokus, `prefers-reduced-motion`,
  Bedienung ohne JavaScript (Menü als `<details>`), klebende Namensspalte und
  Scrollschatten der Tabellen, Farbe nie alleiniger Träger.
- Oberfläche britisches Englisch.
- Die Browserprüfung `explorer/scripts/pruefe-oberflaeche.mjs` muss grün
  bleiben.

## Dateien, die der Plan ändern wird

- `explorer/src/styles/theme.css` (1.900 Zeilen; die Kommentare darin
  dokumentieren frühere Fehlversuche – Rot überall, Links nur in Tinte, rote
  Schrägstriche wie im F1-Logo)
- `explorer/src/styles/teams.css`
- `explorer/src/layouts/Seite.astro`
- neue Komponenten: `Meisterband.astro`, `Epochenband.astro`
- alle Seiten in `explorer/src/pages/**` und Komponenten in
  `explorer/src/components/**` mit eigenem `<style>`
- `explorer/scripts/pruefe-kontraste.mjs` (neu), `explorer/scripts/bildschirmfotos.mjs` (neu)

## Belege, die du ansehen kannst

- Vorher-Bildschirmfotos: `c:\Users\jonat\F1-stats\explorer\.design\vorher\*.png`
  (Namen: `<seite>-<breite>-<light|dark>.png`; lange Seiten bei 7.000 px
  abgeschnitten – große Dateien, lies gezielt einzelne)
- Gerenderte Kandidaten: `C:\Users\jonat\AppData\Local\Temp\claude\7c325c02d50b5d9c\5359e08d-3169-472c-abd9-4736e5cd6157\scratchpad\kandidaten\k1.png`
  (Typo, Turm, Leiste, Tabellenvarianten, hell und dunkel) und `k2-oben-0.png`
  (Meisterband auf Monitorfläche)
- Datengrundlage Meisterband: Anteil der möglichen Punkte je Meister,
  `lib/profil.js` → `saisons[].moeglich`; Werte 33–93 %, 76 abgeschlossene
  Titel, Rechenzeit 0,4 s beim Bauen.

## Was ich von dir brauche

Du bist **schreibgeschützt**: Lies Dateien, führe höchstens lesende Befehle
aus, ändere nichts.

1. **Je Abschnitt des Plans** (§ 3, § 5, § 6, § 7, jeder Baustein in § 8,
   § 9, § 11): das wahrscheinlichste Versagen im echten Betrieb als konkrete
   Folge (Seite, Breite, Modus, was der Leser sieht oder nicht bedienen kann),
   die Entscheidungen, die der Plan braucht und nicht trifft, und Fehler in
   Reihenfolge oder Abhängigkeit.
2. **Für das Ganze:** Rückbau (was, wenn die Freigabe nach dem Prototyp
   scheitert), Zwischenstände (Seiten halb im alten, halb im neuen Stil),
   CSP, Barrierefreiheit (insbesondere Fokus, Tastatur im Meisterband,
   Vorleser, Kontrast auf der Monitorfläche, Farbe als Träger),
   Telefonbreite 390 px und die Anforderung „Meisterband, WM-Stand und
   nächstes Rennen in den ersten 800 px ohne Scrollen“, Leistung (Schrift
   90 KB statt 29 KB, 77 Links mit SVG auf der Startseite, ein
   `<style>`-Block hängt in Astro jedem Element ein Bereichsattribut an),
   Prüfungen in `pruefe-oberflaeche.mjs`, die durch den Plan brechen könnten.
3. **Ob die Sprache trägt:** Wo führt der Plan wieder zu einem der Tabu-Muster
   in § 12 oder zu einem der Fehlversuche, die die Kommentare in `theme.css`
   beschreiben? Wo reicht das Dokument nicht, um eine neue Seite ohne
   Rückfrage zu bauen?
4. **Am Ende eine bereinigte Frageliste.** Jede Frage mit Optionen, deine
   Empfehlung zuerst, markiert **BLOCKING** (mit dem Abschnitt, den sie
   blockiert) oder **LATER**.

Kennzeichne jede Behauptung, die du aus einer Datei ableitest, mit Datei und
Zeile. Höchstens etwa 1.500 Wörter, Tabellen zuerst.
