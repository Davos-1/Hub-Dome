# Wie funktioniert die Welt? (Phase 4f, erweitert in 4g)

Kurzanleitung für Gian: was die 3D-Welt bestimmt, was der Besitzer einstellen kann und wo man im Code etwas ändert. Hintergründe und Entscheide: `docs/PHASE-4F-KONZEPT.md` und `docs/ENTSCHEIDUNGEN.md`.

## 1. Woraus ein Dorf entsteht

```
Seed (8 Zeichen, pro Dorf gespeichert) + Generator-Version (v1 eingefroren, v2 aktuell)
  └─► Landschaft v2: Flussdorf · Flussgabel mit Insel · Bergsee · Bucht · Hochplateau · Bachtal · Hügelland
      (v1: Flussbogen · Bachtal · Seeufer · Hügelland)
      Stimmung:   Frühling · Sommer · Herbst · Alpin, dazu ein leichter Farbton je Welt
      Wasser (v2: Fluss oder Bach durchs Dorf, mehrere Brücken), Hügel, Wald- und Felsanteil,
      4–8 Merkmale aus dem Katalog (Mühle mit Wasserrad, Fähre, Wehr, Fischerhütte, Kapelle, Steinkreis,
      Heuballen, Rebberg, Ruine … sowie Teich, Weide, Windmühle, Obstgarten), Wanderweg mit Brücke
  └─► Panorama hinter der Karte (alle Versionen): Vorberge mit Wald, Berge, ferne Gipfel, Alpweide,
      Kapelle, Wasserfall, Morgennebel
  └─► Siedlung: Dorfplatz mit neun Ausgängen → je Fachbereich ein Quartierplatz mit Tafel → Gasse mit Bauplätzen
Häuser und Objekte (aus der Datenbank) ──► Häuser in der Reihenfolge ihrer Entstehung auf freie Bauplätze
Platzierungen des Besitzers ──► fixierte Häuser, eigene Deko, Varianten pro Haus
Danach: Laternen, Bäume, Büsche, Blumen, Tiere (weichen allem aus)
```

- **Gleich bleibt gleich:** gleicher Seed + gleiche Daten + gleiche Generator-Version = identisches Dorf, auf jedem Gerät.
- **Neue Häuser verschieben nichts:** Jedes Haus prüft sich nur gegen das, was vor ihm steht. Ein neues Haus kommt zuletzt.
- **Jedes Grundstück ist gleich gross** (Haus Stufe 3 plus 12 Objekt-Beete). Das Haus wächst darin mit der Anzahl Objekte (Stufe 1–3). Ab 13 Objekten steht ein Archivschrank «+N» im Garten.

## 2. Was der Besitzer tun kann

| Wo | Was | Hinweis |
|---|---|---|
| Leiste › **Bauen** | Deko setzen (14 Elemente in 5 Gruppen), verschieben, drehen, entfernen | Vorschau grün = passt (auch eingerastet), rot = mit Grund. Ungültiges lässt sich nicht setzen. |
| Bauen › Haus wählen | **Farbe** (4 Sets), **Dach** (Fachbereich, Schiefer, Ziegel), **Anbau** (Laube, Schuppen, Wintergarten), **Garten** (Blumen, Gemüse, Steingarten, Obst), **Umsetzen** auf einen freien Platz im eigenen Quartier | Was neben einem Haustyp keinen Platz hat, ist ausgegraut (mit Grund). |
| Bauen › Zurücksetzen auf Automatik | Alles Eigene weg, Häuser wieder automatisch | mit Bestätigung, rückgängig machbar bis zum Speichern |
| Einstellungen › Dorf › **Welt neu würfeln** | neue Landschaft als Vorschau in der Szene | Übernehmen erst nach zweiter Bestätigung; was in der neuen Landschaft nicht passt, wird vorher genannt |

**Tastatur im Bau-Modus:** Pfeile 0.5 m · Q/E drehen 15° · Enter setzen · Entf entfernen · Esc abbrechen · Strg+Z / Strg+Y. Mit gewähltem Element erscheint die Vorschau an der nächsten freien Stelle beim Blickziel; alles geht ohne Maus.

**Speichern:** Der Server rechnet die Welt mit denselben Regeln neu und speichert nur, wenn alles passt. Beim Speichern werden alle heutigen Hausplätze mitgespeichert (fixiert), damit eine neue Bank nie ein Haus verschiebt.

## 3. Regeln (nichts «Komisches»)

Alle Regeln sind reine Funktionen in `src/lib/world/` und laufen im Browser und auf dem Server:

- `space.ts` – alles, was steht, hat eine Grundfläche (Kreis oder gedrehtes Rechteck). Neue Grundflächen werden gegen alle bestehenden geprüft, mit Mindestabstand.
- `rules.ts` – Deko: nicht auf Wegen, Wasser, Plätzen (ausser erlaubten Elementen), nicht schief im Hang (≤ 0.25 m Höhenunterschied), nicht vor Hausfronten (hohe Elemente), Steg nur am Ufer. `snapDeko` rastet bis 3 m ein.
- `settlement.ts` – Quartiere, Gassen, Bauplätze; `kit.ts` – Plätze für Anbau, Gartenfeld, Bank und Baum neben dem Haus.
- `generate.ts` – setzt alles zusammen (`generateWorld`).

Property-Tests (`src/lib/world/*.test.ts`) prüfen über 220 Seeds: keine Überlappung, alles in der Karte und auf zulässigem Gelände, freier Zugang und freie Sicht aufs Schild, Determinismus, neue Häuser verschieben nichts, zufällige Eingaben enden gültig oder abgewiesen.

## 4. Generator-Version

`GENERATOR_VERSION` in `src/lib/world/seed.ts` (heute 2). Wer die Regeln so ändert, dass bestehende Dörfer anders aussähen, erhöht die Version und lässt alte Dörfer auf ihrer Version (Annahme A4). v1 ist eingefroren: `src/lib/world/v1-golden.test.ts` vergleicht einen Fingerabdruck von sechs Welten. Ein v1-Dorf wechselt nur auf Wunsch des Besitzers: Einstellungen › Dorf › **Auf neue Welt-Version aktualisieren** (Vorschau mit gleichem Seed, Hausplätze werden mitgenommen) oder **Welt neu würfeln** (immer die aktuelle Version). Reine Darstellung (Kamera, Panorama, Wasser, Wege-Optik, Oberfläche) gilt für alle Versionen.

## 5. Datenbank

Tabelle `village_worlds` (Migration `supabase/migrations/20261023000100_village_worlds.sql`): Seed, Generator-Version, Platzierungen (JSON, Zod-geprüft). Lesen darf, wer das Dorf sehen darf; schreiben nur die Server Actions (`src/app/dorf/welt-actions.ts`) mit Service Role und `owner_id`-Filter. **Bis die Migration eingespielt ist,** gilt ein Ersatz-Seed aus der Dorf-ID, und Speichern meldet freundlich, dass das Datenbank-Update fehlt.

## 6. Testen und Anschauen ohne Datenbank

- `/dev/dorf?seed=…&h=10&o=6&zeit=nacht&kamera=strasse&bewegung=0&besitzer=1&deko=1` – Vorschau mit erfundenen Daten. `kamera`: `uebersicht`, `vogel`, `strasse`, `quartier`, `ufer`, `panorama` (Blick zum Horizont), `weg` (Wegnahaufnahme), `zentrale` (mit `zentrale=<stil>`), `haus-<typ>` (Zentrale und Häuser wie nach einem Klick, Fenster offen). `deko=1` setzt Beispiel-Deko und Varianten, `v=1` rechnet mit Generator v1. Speichern im Bau-Modus landet im Speicher des Dev-Servers.
- `/dev/deko?ansicht=seed` – Galerie der Seed-Objekte, Trauerweide und Steinbrücke (`&nur=kapelle`, `&winkel=…`).
- `/dev/deko` (Deko-Katalog), `/dev/deko?ansicht=kit` (Anbauten, Gartenstile), `/dev/stile?fach=<id>` (Haustypen).
- Visuelle Matrix: `npx playwright test -c playwright.visual.config.ts` (Anleitung `tests/visual/README.md`), Bilder in `test-results/visual/<etappe>/`.
