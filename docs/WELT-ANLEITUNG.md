# Wie funktioniert die Welt? (Phase 4f, erweitert in 4g und 4h)

Kurzanleitung für Gian: was die 3D-Welt bestimmt, was der Besitzer einstellen kann und wo man im Code etwas ändert. Hintergründe und Entscheide: `docs/PHASE-4F-KONZEPT.md` und `docs/ENTSCHEIDUNGEN.md`.

## 1. Woraus ein Dorf entsteht

```
Seed (8 Zeichen, pro Dorf gespeichert) + Generator-Version (v1 und v2 eingefroren, v3 aktuell)
  └─► Landschaft v2: Flussdorf · Flussgabel mit Insel · Bergsee · Bucht · Hochplateau · Bachtal · Hügelland
      (v1: Flussbogen · Bachtal · Seeufer · Hügelland)
      Stimmung:   Frühling · Sommer · Herbst · Alpin, dazu ein leichter Farbton je Welt
      Wasser (v2: Fluss oder Bach durchs Dorf, mehrere Brücken), Hügel, Wald- und Felsanteil,
      4–8 Merkmale aus dem Katalog (Mühle mit Wasserrad, Fähre, Wehr, Fischerhütte, Kapelle, Steinkreis,
      Heuballen, Rebberg, Ruine … sowie Teich, Weide, Windmühle, Obstgarten), Wanderweg mit Brücke
  └─► Panorama hinter der Karte (alle Versionen): Vorberge mit Wald, Berge, ferne Gipfel, Alpweide,
      Kapelle, Wasserfall, Morgennebel
  └─► Siedlung: Dorfplatz mit neun Ausgängen → je Fachbereich ein Quartierplatz mit Tafel → Gasse mit Bauplätzen
      (v3: je Quartier wählbare Wegform Gasse · Ring · Halbkreis · Intelligent, Häuser ordnen sich danach)
Häuser und Objekte (aus der Datenbank) ──► Häuser in der Reihenfolge ihrer Entstehung auf freie Bauplätze
Platzierungen des Besitzers ──► fixierte Häuser, eigene Deko, Varianten pro Haus
Danach: Laternen, Bäume, Büsche, Blumen, Tiere (weichen allem aus; v3: Bäume an festen Plätzen aus dem Seed,
       verdeckte werden ausgeblendet und kommen am selben Ort zurück)
```

- **Gleich bleibt gleich:** gleicher Seed + gleiche Daten + gleiche Generator-Version = identisches Dorf, auf jedem Gerät.
- **Neue Häuser verschieben nichts:** Jedes Haus prüft sich nur gegen das, was vor ihm steht. Ein neues Haus kommt zuletzt.
- **Jedes Grundstück ist gleich gross** (Haus Stufe 3 plus 12 Objekt-Beete). Das Haus wächst darin mit der Anzahl Objekte (Stufe 1–3). Ab 13 Objekten steht ein Archivschrank «+N» im Garten.

## 2. Was der Besitzer tun kann

| Wo | Was | Hinweis |
|---|---|---|
| Oben rechts › **Bauen** (Taste B) | Plan von oben mit Raster; Quartiere als Flächen mit rundem Griff. Werkzeuge links: **Wählen**, **Haus**, **Quartier**, **Weg**, **Deko**; Panel rechts je nach Auswahl; Meldung unten | Leiste oben: Rückgängig, Wiederholen, Abbrechen, Speichern. Was nicht passt, wird mit Grund zurückgesetzt. |
| Werkzeug Wählen / Haus | Haus ziehen versetzt es (frei im eigenen Quartier, Bewegungsraum gestrichelt); Panel: **Farbe**, **Dach**, **Anbau**, **Garten**, **Automatik** | Grün = passt (rastet ein), rot = mit Grund. Das Haus dreht sich selbst zu seinem Weg bzw. zum Platz. |
| Werkzeug Quartier (oder Griff ziehen) | Ganzes Quartier samt eigener Deko verschieben | Quartierplatz und Achse bleiben fix; bis zur Grenze orange, gar nicht rot. |
| Panel › **Wegform** (v3) | **Intelligent** (Kurve gerade–stark), **Ring** und **Halbkreis** (Radius 5–12 m), **Gasse**; **Zurück auf Ausgangslage** | Die Häuser des Quartiers ordnen sich neu. Stösst die Form an ein Nachbarquartier oder Wasser, bleibt alles, wie es war (Meldung mit Grund). |
| Werkzeug Weg (v3) | Klick auf einen Stichweg setzt einen **Eckpunkt**, ziehen formt den Weg, Doppelklick entfernt ihn | «Alle Eckpunkte entfernen» im Panel |
| Werkzeug Deko | **Bäume aus dem Seed** ziehen (v3) und **eigene Deko** aus dem Katalog setzen (14 Elemente in 5 Gruppen), verschieben, drehen, entfernen | «Alle zurück an Seed-Platz»; höchstens 120 eigene Elemente |
| Panel › Alles auf Automatik | Alles Eigene weg, Häuser wieder automatisch | mit Bestätigung, rückgängig machbar bis zum Speichern |

**Tastatur im Bau-Modus:** Pfeile 0.5 m · Q/E drehen 15° · Enter setzen bzw. ablegen · Entf entfernen · Esc von innen nach aussen (Ziehen, Auswahl) · Strg+Z / Strg+Y. Quartier und Haus lassen sich über die Listen im Panel wählen, «Verschieben (Tastatur)» bzw. «Quartier verschieben (Tastatur)» bewegen mit Pfeilen und Enter.

**Speichern:** Der Server rechnet die Welt mit denselben Regeln neu und speichert nur, wenn alles passt. Beim Speichern werden alle heutigen Hausplätze mitgespeichert (fixiert), damit eine neue Bank nie ein Haus verschiebt.

## 3. Regeln (nichts «Komisches»)

Alle Regeln sind reine Funktionen in `src/lib/world/` und laufen im Browser und auf dem Server:

- `space.ts` – alles, was steht, hat eine Grundfläche (Kreis oder gedrehtes Rechteck). Neue Grundflächen werden gegen alle bestehenden geprüft, mit Mindestabstand.
- `rules.ts` – Deko: nicht auf Wegen, Wasser, Plätzen (ausser erlaubten Elementen), nicht schief im Hang (≤ 0.25 m Höhenunterschied), nicht vor Hausfronten (hohe Elemente), Steg nur am Ufer. `snapDeko` rastet bis 3 m ein.
- `settlement.ts` – Quartiere, Gassen, Bauplätze; v2 zusätzlich freie Lagen (Quartierfläche, Stichweg vom Tor zum Rückgrat, Prüfung `checkFreeHouse`/`checkFreeGroup`); `kit.ts` – Plätze für Anbau, Gartenfeld, Bank und Baum neben dem Haus.
- `free-drag.ts` – Ziehen im Bau-Modus: Prüfwelt ohne die gezogenen Häuser, Einrasten, Gruppenverschiebung mit Grenze, `quarterMove` (exakt).
- `roads.ts` (v3) – Wegformen als Geometrie: Kernweg (Ring, Halbkreis), Bauplätze rund um den Platz, geschwungene Wege für «Intelligent»; geprüft wird in `settlement.ts`.
- `vegetation.ts` – v3: `vegetationCandidates` (feste Lagen aus Seed und Karte) und `vegetationVisible` (was die Siedlung verdeckt, Waldrand, versetzte Bäume).
- `path-dress.ts` – Wegausstattung (alle Versionen, reine Darstellung): Belag je Wegtyp (Zuweg Kopfsteinpflaster, Gassen je Quartier Kies/Pflaster/Platten, Stichweg Kiesbett mit Trittplatten, Fusspfad Erde), Randsteine an Pflaster und Platten, Randgras und Steinchen; nichts davon liegt auf Wegen, in Gärten, im Wasser oder auf Plätzen.
- `generate.ts` – setzt alles zusammen (`generateWorld`).

Property-Tests (`src/lib/world/*.test.ts`) prüfen über 220 Seeds: keine Überlappung, alles in der Karte und auf zulässigem Gelände, freier Zugang und freie Sicht aufs Schild, Determinismus, neue Häuser verschieben nichts, zufällige Eingaben enden gültig oder abgewiesen.

**Oberfläche:** Stil «Werkbank» (Phase 4h): deckende dunkle Flächen, Petrol als Hauptton, Tafeln am Haus statt Fenster. Farben, Radien und Schatten nur über die Design-Tokens `--hd-*` in `src/app/globals.css` (Tailwind `bg-hd-surface`, `text-hd-ink` …); der Kontrasttest `src/app/theme-contrast.test.ts` prüft alle Text-/Flächenpaare auf WCAG AA.

## 4. Generator-Version

`GENERATOR_VERSION` in `src/lib/world/seed.ts` (heute 3). Wer die Regeln so ändert, dass bestehende Dörfer anders aussähen, erhöht die Version und lässt alte Dörfer auf ihrer Version (Annahme A4). v1 und v2 sind eingefroren: `v1-golden.test.ts` und `v2-golden.test.ts` vergleichen je einen Fingerabdruck von sechs Welten. v3 nutzt die Karte von v2 und ändert nur Siedlungsformen (Wegformen, Eckpunkte, grösserer Bewegungsraum) und Pflanzen (feste Plätze). Ein älteres Dorf wechselt nur auf Wunsch des Besitzers: Einstellungen › Dorf › **Auf neue Welt-Version aktualisieren** (Vorschau mit gleichem Seed, Hausplätze werden mitgenommen) oder **Welt neu würfeln** (immer die aktuelle Version). Reine Darstellung (Kamera, Panorama, Wasser, Wege-Optik, Oberfläche) gilt für alle Versionen.

## 5. Datenbank

Tabelle `village_worlds` (Migration `supabase/migrations/20261023000100_village_worlds.sql`): Seed, Generator-Version, Platzierungen (JSON, Zod-geprüft; v3 zusätzlich `quarterRoads`, `roadBends`, `treeMoves`). Neue Dörfer starten mit `20261024000300_world_v3_default.sql` auf v3. Lesen darf, wer das Dorf sehen darf; schreiben nur die Server Actions (`src/app/dorf/welt-actions.ts`) mit Service Role und `owner_id`-Filter. **Bis die Migration eingespielt ist,** gilt ein Ersatz-Seed aus der Dorf-ID, und Speichern meldet freundlich, dass das Datenbank-Update fehlt.

## 6. Testen und Anschauen ohne Datenbank

- `/dev/dorf?seed=…&h=10&o=6&zeit=nacht&kamera=strasse&bewegung=0&besitzer=1&deko=1` – Vorschau mit erfundenen Daten. `kamera`: `uebersicht`, `vogel`, `strasse`, `quartier`, `ufer`, `panorama` (Blick zum Horizont), `weg` (Wegnahaufnahme), `zentrale` (mit `zentrale=<stil>`), `haus-<typ>` (Zentrale und Häuser wie nach einem Klick, Fenster offen). `deko=1` setzt Beispiel-Deko und Varianten, `v=1`/`v=2` rechnet mit Generator v1 bzw. v2, `wege=ring|halbkreis|intelligent` setzt eine Wegform in allen Quartieren, `freunde=1` erfindet Freunde für die Reise-Karte. Speichern im Bau-Modus landet im Speicher des Dev-Servers.
- `/dev/deko?ansicht=seed` – Galerie der Seed-Objekte, Trauerweide und Steinbrücke (`&nur=kapelle`, `&winkel=…`).
- `/dev/deko` (Deko-Katalog), `/dev/deko?ansicht=kit` (Anbauten, Gartenstile), `/dev/stile?fach=<id>` (Haustypen).
- Visuelle Matrix: `npx playwright test -c playwright.visual.config.ts` (Anleitung `tests/visual/README.md`), Bilder in `test-results/visual/<etappe>/`.
