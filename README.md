# F1-Statistiken

Formel 1 seit 1950, ausgerechnet aus den Rennergebnissen selbst: Profile aller
Fahrer, Teams, Motoren und Strecken, jede Saison und jedes Rennen, Rekorde und
ihre Bewegung, ein Vergleich zweier Karrieren, ein Explorer für eigene
Abfragen und ein Quiz.

**<https://jonathanrngl.github.io/F1-stats/>**

## Aufbau

| Verzeichnis | Inhalt |
|---|---|
| [`explorer/`](explorer/) | Die Seite. Astro, statisch gebaut aus der F1DB-Datenbank. Beschreibung, Befehle und Prüfungen in [`explorer/README.md`](explorer/README.md). |
| `src/`, `public/` | Die frühere React-Anwendung, eingefroren (siehe unten). |
| [`docs/ARCHITEKTUR.md`](docs/ARCHITEKTUR.md) | Die ursprüngliche Planung, mit einem Nachtrag zu dem, was anders kam. |
| `.github/workflows/` | Bau, Datenaktualisierung, Rundendaten (siehe unten). |

## Veröffentlichen

Drei Workflows, jeder mit getrennten Rechten: Ein Job, der fremden Code oder
fremde Daten verarbeitet, darf nur lesen; geschrieben oder veröffentlicht wird
nur in einem eigenen Job, der nichts davon ausführt.

| Workflow | Wann | Was |
|---|---|---|
| `deploy.yml` | jeder Push auf `main`, oder angestoßen | Import der gepinnten F1DB-Fassung, Lint, Tests, Bau mit Link­prüfung, Browserprüfung, dann GitHub Pages |
| `f1db-update.yml` | viermal täglich | eine neuere F1DB-Fassung prüfen und bauen; nur wenn alles besteht, `explorer/f1db-version.txt` festschreiben und den Deploy anstoßen |
| `runden.yml` | alle vier Stunden | Rundendaten von Jolpica nachladen, prüfen, committen |

Dazu hält Dependabot (`.github/dependabot.yml`) die per Commit gepinnten
Aktionen und die npm-Abhängigkeiten aktuell.

Einmalig im Repo einzustellen: **Settings → Pages → Build and deployment →
Source: GitHub Actions**. Und: Die Workflows `f1db-update.yml` und `runden.yml`
schreiben auf `main`. Wird der Zweig geschützt, müssen sie stattdessen einen
Pull Request öffnen.

GitHub schaltet geplante Workflows in öffentlichen Repos ab, wenn 60 Tage lang
nichts geschieht – in einer langen Winterpause kann das passieren. Die
Actions-Übersicht zeigt dann einen Knopf zum Wiedereinschalten.

Die Sitemap (`/F1-stats/sitemap.xml`) meldet man in der Google Search Console
an. Eine `robots.txt` kann eine Projektseite auf GitHub Pages nicht haben – sie
läge in der Wurzel der Domain.

## Die frühere Anwendung, eingefroren

`src/` ist die erste Fassung: React, live aus der Jolpica-API. Sie liegt als
gebauter Stand unter `explorer/public/classic/` und wird unverändert unter
`/F1-stats/classic/` mitveröffentlicht; sie wird nicht mehr weiterentwickelt
und nicht mehr in der Pipeline gebaut. Neu bauen lässt sie sich weiterhin:

```bash
npm install
npm run build          # -> dist/, dann nach explorer/public/classic/ kopieren
VITE_POLLING=1 npm run dev   # auf einem Netzlaufwerk, wo die Dateiüberwachung fehlschlägt
```

Was an ihr gelernt wurde, steht in der Engine des Explorers: die Epochenfallen
(Streichresultate, geteilte Autos, „gewertet heißt nicht durchgekommen“), der
Titelrechner, die gegen Farbfehlsichtigkeit geprüften Serienfarben.

## Hinweis

Kein offizielles Angebot der Formel 1. F1, FORMULA ONE und Formel 1 sind Marken
der Formula One Licensing BV. Daten von [F1DB](https://github.com/f1db/f1db),
Creative Commons BY 4.0, und [Jolpica-F1](https://api.jolpi.ca).
