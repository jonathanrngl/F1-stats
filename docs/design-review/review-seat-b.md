# Review Sitz B (zweites Modell, Blick: Leser zuerst, Widerspruch)

Wortlaut des Prüfers, unverändert übernommen. Prüfung durch den Moderator:
siehe `review-merge.md`.

---

# Second-seat review: `docs/DESIGN.md` ("Zeitnahme"), contrarian and user-first

Read-only. I read DESIGN.md, the brief, theme.css, teams.css, Seite.astro, astro.config.mjs, pruefe-oberflaeche.mjs, parts of index.astro, drivers/[id].astro, profil.js and punkte.js, plus k1.png, k2-oben-0.png and two before-screenshots. I did not read `pruefe-ausgabe.mjs` (it runs inside `npm run build`) or seasons/[jahr].astro beyond a grep. Pixel estimates are mine, not measured.

## 1. Findings per section

| Section | Most likely failure (concrete sequence) | Missing decision | Ordering / dependency error |
|---|---|---|---|
| §3 decisions | Home, light mode, 2026: the leader is Mercedes, which falls back to ink for lines (§5.4). The home page has no title stripe, so "the home page wears the leader's livery" renders as nothing. | What livery visibly does on a page whose team fails 3:1. | The candidates were rendered with six nav items (k1.png); §8.1 keeps nine. The header was never tested as specified. |
| §5 colour | Hamilton page, light: driven seasons fall back to ink and title years are ink with a gold cap. Gold on `#eef1f2` is about 1.7:1 (my calculation), so titles are indistinguishable. | Livery for race, circuit, engine, tyre and preview pages (§2.1 names only team, driver, season, home). Livery for the roughly 120 teams with no colour (teams.css:17-19): ink stripe or none? | `data-lackierung` needs a second 50-rule list. Reusing `[data-team]` on `<body>` would leak the colour into every uncoloured row via `var(--team, transparent)` (theme.css:1458, 1470). Who generates it is not stated. |
| §5.5 monitor | Light mode, 1440: a near-black slab with mint `#27f4d2` and `#ff4055` bars (teams.css:22-23). That is the §12 "almost black with neon accent" pattern in a box. 2014–2020 is the loudest block for no data reason. | Whether Mercedes mint is toned down on the monitor. | — |
| §6 type | 360 px: the 125 % wordmark plus three 2.5 rem buttons leaves about 190 px. Overflow fails "kein waagerechtes Scrollen" (pruefe-oberflaeche.mjs:322-323). At 1024–1216 px, "Analysis" is clipped again, as recorded in theme.css:356-359. | Fallback metrics or preload: `swap` from system-ui to 125 %/800 reflows every h1. Size for dense grids and for the second cell line (today 0.76 rem, theme.css:1346-1349). The scale offers only 12, 14 or 16. | Tables grow from 14.4 px (theme.css:1208) to 16 px before anyone checks eight-column tables at 390. |
| §7 grid | White slabs on grey with no border read as a generic dashboard. This reverses "content stands on the paper, not in boxes" (theme.css:27-28) without saying why. | Row hover colour: `--link-wash` is abolished but used at theme.css:1254, 1302, 1372. | — |
| §8.1 header | See §6. | Nav breakpoints with Archivo. | Measure the header before the prototypes. |
| §8.2 page head | The driver head loses the eckdaten: span, died, full name, family (drivers/[id].astro:205-228). A builder has no sentence template for circuits, engines or 1950s drivers. | Sentence templates per type. Where family and death date go. Where code and number sit at 390. | — |
| §8.3 Epochenband | Alonso's page turns from Renault yellow to Aston green one weekend in 2027, and nothing on the page says what the colour means. | A visible label ("Most starts: Renault") and a tie rule. | — |
| §8.4 Meisterband | 390 px, touch: there is no hover. A tap on a 3 px bar navigates, often to the neighbouring year, so the value is never readable in place. Without JS there are 77 tab stops between the skip link and the standings. | Touch behaviour. ARIA pattern for the roving tabindex. A scale: there is no axis or gridline, so height reads only as "taller". | The measure needs settling before the component (below). |
| §8.5 tower | 1950s–80s standings: half the rows have no stripe (transparent fallback, theme.css:1458), and `abbreviation` can be null (guarded at drivers/[id].astro:209). The left edge is ragged. Kürzel at 800 looks more clickable than the link name at 600. | When a ranking is a tower and when a table: season standings carry more columns than "value + gap". Row count on home. Whether the gap column is optional (it is noise on records). | — |
| §8.6 Leiste | The tile sub-lines disappear: win rate, entries, best championship finish, title years (drivers/[id].astro:246-269). k1 shows Titles last and wrapped, which contradicts "first". | Whether sub-lines survive. Whether `.traegt` is information; position already says it, and the stripe is 1.7–2.2:1 for 11 teams. | — |
| §8.7 table | "Names are always links" is false: teams without a page are plain text (seasons/[jahr].astro:380). | Look of non-link names. | — |
| §8.8 notes | A What-if title change becomes the same blue note as "Note:". The test reads `.hinweis.akzent` (pruefe-oberflaeche.mjs:245), and 12 uses of akzent/warn/gut exist in `src`. | Mapping from old to new variants. | Fix the test or the class first. |
| §8.9 Sprung | Sticky at 390 again covers a third of the screen, the failure fixed at theme.css:914-918. | State the exception. | — |
| §8.11 links | Records, explorer, all index pages, and Mercedes/McLaren pages in light: ink text, ink underline, row links with no underline. This is the attempt theme.css:51-57 records: "nothing stood out, you had to search for what is clickable". | An affordance for links that does not depend on livery. | — |
| §8.13 states | Fine. | Error and Note share blue. | — |
| §9 motion | Low risk. The wipe plus the font swap shift the first paint together. | — | — |
| §11 removal list | "Following" and "On this day" are absent from the new home page, but tests require both (pruefe-oberflaeche.mjs:183-206). | Their position relative to the 800 px rule. | — |

## 2. Is the Meisterband honest?

No, as currently labelled.

- **The denominator is the champion's own starts**, not the season (profil.js:69-72). Rindt 1970 and anyone who skipped Indianapolis get a taller bar. "Of the points available" is wrong.
- **The numerator is gross points** (profil.js:68), before dropped scores. By my arithmetic the plan's own "1988: Senna 65 %" is 94/144. Prost scored 105 gross, so the non-champion had the higher share.
- **Double points** are excluded from the maximum (punkte.js:120-123) but, if F1DB records the doubled score, counted in the numerator (2014).
- **Eras are not comparable.** Second place everywhere is 67 % under 9-6, 80 % under 10-8 and 72 % under 25-18. Height tracks points systems. Shared 1950s drives split points and lower those bars.
- **Colour cannot identify a team.** Alfa, Ferrari and Maserati are all red (teams.css:22, 36, 65). Cooper, BRM, Lotus and Vanwall are near-identical green (43, 62-64). Brabham, Tyrrell, Matra, Williams and Red Bull are blues. 1959–1973 is a green-blue blur in k2.

## 3. Whole-programme risks

- **Still generic?** Yes, in part. Expanded heavy grotesk, condensed numerals, white slabs on cool grey, a left-stripe title and left-stripe callouts with a bold first word are a common generated set. A 60 px h1 over a dark chart slab is a hero with a chart in place of four tiles.
- **Faster for a fan?** Not on the home page. Today the next race and the leader are the first content after the hero (index.astro:97-146). The plan puts an h1 and the band above both. At 390 px I estimate the next race lands near 650–800 px, depending on the undecided tower length.
- **Red everywhere becomes purple everywhere.** Twelve lila record numbers on `/records/` repeat theme.css:3-5. Lila also loses its one known meaning, fastest lap (theme.css:93-95).
- **Intermediate states.** Aliasing `--link` and `--accent` to `--ink` (§5.2) puts every unmigrated page into the failed ink-only state and erases `td.meister`, `.eckdaten .stark` and record values (theme.css:844, 1377, 1762). The plan has no rollback section.
- **Performance.** 29 files have a `<style>` block. theme.css:1502-1504 records 170 KB from scope attributes. §8 does not forbid scoped styles in the new components.
- **The tower imitates the broadcast graphic.** theme.css:331-335 rejected looking official.

## 4. Questions

1. **Meisterband measure.** (a) Wins divided by races of the season: era-proof, readable as "8 of 16", and the data exists (profil.js:89). (b) Keep the share, relabel it "of the points from his starts, before dropped scores", and cap double points. (c) Margin over the runner-up. **Recommend (a).** BLOCKING §8.4.
2. **Home order at 390.** (a) Standings and next race first, band below at about 64 px, no display h1. (b) As planned. **Recommend (a).** BLOCKING §8.4, §11.
3. **Band on touch.** (a) Bars are not links on coarse pointers; a visible year list or stepper sits beneath. (b) First tap shows the label, second navigates (needs JS). (c) As planned. **Recommend (a).** BLOCKING §8.4.
4. **Link affordance without livery.** (a) Underline all text links and give row links a persistent thin underline. (b) Keep a link colour. (c) As planned. **Recommend (a).** BLOCKING §8.11.
5. **Migration.** (a) Scope the new tokens under a body attribute, leave old pages untouched, delete the old set in one final commit. (b) Alias as in §5.2. **Recommend (a).** BLOCKING §5.2.
6. **Livery for types and teams not covered.** (a) Race takes the winner's team, engine/tyre/circuit/preview take ink, uncoloured teams get a grey stripe, and a visible label names the livery team. (b) Ink everywhere else. **Recommend (a).** BLOCKING §8.2, §13.
7. **Title years when the line falls back to ink.** (a) Encode titles by shape (taller cell or a mark above). (b) Gold cap only. **Recommend (a).** BLOCKING §8.3.
8. **Tower or table.** (a) Tower only for one value plus gap; anything wider is `.tabelle`; home shows the top five. (b) Tower everywhere. **Recommend (a).** BLOCKING §8.5.
9. **Leiste sub-lines.** (a) Keep one quiet sub-line per figure. (b) Drop them. **Recommend (a).** BLOCKING §8.6.
10. **Header.** Re-render with nine items at 360, 1024, 1152 and 1280 before approval; drop the wordmark to 100 % width if it overflows. BLOCKING §8.1.
11. **Following, On this day, `.hinweis.akzent`.** Keep both sections below the fold and keep a distinct "result" note variant. BLOCKING §11, §8.8.
12. **Lila scope.** (a) Lila only for fastest lap; record holders get the gold plaque as today (theme.css:1743-1751). (b) As planned. **Recommend (a).** LATER.
13. **Monitor palette.** Toned-down team colours on the slab, or no slab with bars at 3:1 by outline. LATER.
14. **Font loading.** Preload plus a metric-matched fallback. LATER.
15. **Sprung at phone width, row hover colour, dense-grid text size, scoped-style ban in components.** Write each into §7–§8. LATER.
