# Phase 4f – Die Welt auf das nächste Level (Konzept, Etappe 0)

Stand: 2026-10-23. Ziel: detailliertere, individuelle Dörfer ohne «komische» Zustände, einfach zu bedienen. Grundlage: Auftrag von Gian (Phase 4f), Entscheide 1–4, Annahmen A1–A6 (als bestätigt angenommen, siehe Ende).

## 1. Ist-Zustand (Audit)

**Schon regelbasiert:** Layout (`layout.ts`) ist deterministisch; Grundstücke prüfen sich per SAT-Test auf Überlappung (Tests 5–50 Häuser); jeder Weg hat eine eigene Vieleckseite; Laternen (`lamps.ts`) meiden Grundstücke, fremde Wege und einander (4 m); Natur (`decor.tsx scatter`) meidet Platz, Gärten, Wege, Häuser, Quartiere und reservierte Kreise (Fluss, Teich, Weide, Mühle); Tiere bewegen sich zustandslos aus der Zeit.

**Gemessene Schwächen** (Audit-Skript, 16 Dörfer à 3–30 Häuser, 4 Seeds):

| Befund | Ausmass | Folge |
|---|---|---|
| Ein neues Haus oder mehr Objekte verschieben bestehende Häuser | **10 von 11** Häusern bewegen sich (10 → 11 Häuser) | verletzt künftige Invariante «Neue Häuser verschieben bestehende nie»; eigene Platzierungen wären unmöglich |
| Bäume überlappen sich (eigene Streuung ohne gegenseitige Prüfung) | 0–8 je Dorf | Stämme in Kronen, «komisch» |
| Streu-Bäume treffen die Laubbäume am Hauptplatz | 0–5 je Dorf | dito |
| Büsche/Steine in Bäumen | 0–3 je Dorf | dito |
| Umgebung (Fluss, Teich, Weide, Mühle) hängt von `extent` ab | wandert mit jedem neuen Haus | eigene Deko am Wasser (Steg) würde «schwimmen» |
| Individualität nur über Dorf-ID (Mäander, ±0.05 rad) | zwei Dörfer mit gleichen Modulen sehen fast gleich aus | Ziel 5 der Rubrik verfehlt |
| Mobile: Brotkrumen und Suchfeld überlappen, Hausfenster verdeckt die ganze Szene, Leiste dreizeilig | sichtbar in `test-results/visual/baseline/mobile-*` | Lesbarkeit |
| Keine Nacht, «Abend» ist die dunkelste Stufe | – | Ziel Licht/Atmosphäre |

Baseline: 41 Screenshots in `test-results/visual/baseline/` (nicht committet), Statistik `stats.json`: Desktop 10 Häuser 164 Draw Calls / 254k Dreiecke, 20 Häuser 183 / 346k; Mobile 81 / 136k.

## 2. Regelwerk (reine Funktionen in `src/lib/world/`)

Alles, was in der Welt steht, hat eine **Grundfläche** (Kreis oder gedrehtes Rechteck, OBB) und eine **Art** (Haus, Grundstück, Platz, Weg, Wasser, Merkmal, Deko, Vegetation, Laterne, Schild-Sichtzone). `rules.ts` prüft jede neue Grundfläche gegen alle bereits gesetzten:

| Regel | Wert |
|---|---|
| Mindestabstand Grundfläche ↔ Grundfläche | 0.3 m (Deko), 0.6 m (Grundstücke) |
| Abstand zu Wegen | Wegbreite/2 + 0.25 m (nur Wegeinmündung des eigenen Hauses erlaubt) |
| Wasser | verboten, ausser **Steg** (Sonderfall: Landende auf Ufer, 50–80 % über Wasser) |
| Gelände | Neigung ≤ 12 %, Höhenunterschied in der Grundfläche ≤ 0.25 m (sonst «steht schief») |
| Karte | ganz innerhalb des begehbaren Radius (`R_BUILD`), Häuser nur in der flachen Zone |
| Türzone | Grundstück eines Hauses (Garten, Gartenweg, Tor) ist für fremde Deko gesperrt |
| Schilder | Sichtzone vor Holzschild (2.4 × 3 m) und Quartiertafel (5.6 × 4 m) bleibt frei |
| Platz | Bank, Laterne, Brunnen, Picknicktisch dürfen auf Plätze, aber nicht in Wegeinmündungen und nicht auf die Terrasse/den Objekt-Ring der Zentrale |

`checkPlacement()` liefert `{ ok, grund }` (kurzer deutscher Grund für das rote Geisterbild), `snapPlacement()` sucht spiralförmig (Raster 0.25 m, Drehung 15°) die nächste gültige Stelle bis 3 m, sonst `null` (nicht ablegbar). Dieselben Funktionen laufen im Browser (Live-Vorschau, Anzeige) und auf dem Server (Speichern).

## 3. Seed-Pipeline und Slot-Raster (Generator v1)

```
Seed (8 Zeichen) ──► Weltkarte: Landschaftstyp, Wasser, Gelände, Merkmale, Stimmung   (fix, unabhängig von Häusern)
                 ──► Siedlung: Hauptplatz → Quartier-Richtungen → Nebenplätze → Slots   (inkrementell)
Platzierungen    ──► fixierte Quartiere/Häuser, eigene Deko                            (vom Besitzer)
                 ──► Laternen, Vegetation, Leben                                       (weichen allem aus)
```

- **Weltkarte zuerst, fest:** Die Landschaft hängt nur vom Seed ab, nicht mehr von der Dorfgrösse. Landschaftstypen: *Flussbogen*, *Bachtal* (Bach + Teich), *Seeufer*, *Hügelland*; Stimmungen: *Frühling*, *Sommer*, *Herbst*, *Alpin* (Gras, Laub, Blüten, Pflaster). Flache Zone bis `R_FLAT` (58–66 m), Hügel und Waldgürtel ausserhalb.
- **Siedlung inkrementell:** Häuser werden in fester Reihenfolge gesetzt: fixierte zuerst, dann übrige nach `created_at`. Jedes Element prüft sich nur gegen das, was **vor** ihm steht. Ein neues Haus kommt zuletzt und kann daher nichts verschieben (**stabil ohne gespeicherten Zustand**).
- **Quartier = Quartierplatz + Gasse** (umgesetzt, siehe Entscheidungslog Etappe 1): Der Dorfplatz hat neun Ausgänge. Das erste Haus eines Fachbereichs wählt einen freien Ausgang (grösster Abstand zu belegten, bei Gleichstand mehr Platz bis zum Wasser, dann Seed). Dahinter liegt der Quartierplatz (Achteck) mit Tafel und je einem Haus links und rechts, danach eine leicht gebogene **Gasse** mit **Gassen-Slots** abwechselnd links und rechts. Alle neun Gassen sind von Anfang an als Korridor für Häuser reserviert. Ist eine Gasse voll oder vom Wasser begrenzt, öffnet das Quartier einen weiteren freien Ausgang (Erweiterung, möglichst nahe). Gassen dürfen den Fluss auf Brücken queren. (Ein erster Entwurf mit Bauplätzen rund um den Quartierplatz scheiterte an der Kapazität.)
- **Feste Slot-Grösse:** Jedes Grundstück ist 6.9 × 8.7 m (Haus der Stufe 3 samt Anbau plus 12 Objekt-Plätze). Das Haus wächst darin, das Grundstück nie. Ab 13 Objekten steht ein **Archivschrank** «+N» im Garten (alle Objekte bleiben über Fenster, Suche und Liste erreichbar).
- **Determinismus:** gleicher Seed + gleiche Daten + gleiche `generator_version` = identisches Ergebnis (Property-Test). Keine Zufallswerte ausser `seededRandom(seed:strom)`.

## 4. Datenmodell (Migration `20261023000100_village_worlds.sql`)

Tabelle `village_worlds` (1:1 zu `villages`):

| Spalte | Typ | Regel |
|---|---|---|
| `village_id` | uuid PK, FK `villages` on delete cascade | |
| `owner_id` | uuid FK `profiles` | = Besitzer des Dorfs (Trigger prüft) |
| `seed` | text | `^[a-z0-9]{8}$` |
| `generator_version` | smallint | 1–999, Standard 1 |
| `placements` | jsonb | Objekt, ≤ 64 KB |
| `updated_at` | timestamptz | |

`placements` (Zod-Schema `src/lib/world/doc.ts`, Version 1):
`{ v: 1, quartiere: { <fach>: [ausgang, …] }, haeuser: { <houseId>: { r: ausgang, s: "p0"|"p1"|"g<j>" } }, deko: [{ id, typ, x, z, r }], varianten: { <houseId>: { farbe, dach, anbau, garten } } }`

**RLS:** Lesen für alle, die das Dorf sehen (`can_view_village`). **Kein** Schreiben für Clients (keine Insert/Update/Delete-Policy). Geschrieben wird nur von Server Actions mit Service Role, **nach** Zod- und Regelprüfung, immer mit `owner_id`-Filter. Grund: Mit direktem PostgREST-Zugriff könnte ein Client die Serverprüfung sonst umgehen («Der Server vertraut dem Client nie»). Trigger legen für neue Dörfer eine Zeile mit Zufalls-Seed an; bestehende Dörfer bekommen `substr(md5(id), 1, 8)`, denselben Wert, den der Code ohne Migration verwendet (kein Sprung beim Einspielen).
**Ohne Migration** läuft alles mit diesem Ersatz-Seed und ohne Platzierungen; Speichern meldet freundlich «noch nicht verfügbar».

## 5. Katalog (Qualität vor Menge)

- **Haustypen:** die 8 Fachbereich-Typen bleiben (Gians Design), jetzt mit Fenstern, Türen, Dachdetails und Materialien (≤ 2500 Dreiecke je Haus). Neu pro Haus wählbar (Etappe 3, immer gültig, weil alles im reservierten Grundstück liegt): **Farbe** (4 Sets), **Dach** (umgesetzt als Material: wie Fachbereich, Schiefer, Ziegel; siehe Entscheidungslog), **Anbau** (keiner, Laube, Schuppen, Wintergarten), **Garten** (Blumen, Gemüse, Steingarten, Obst). Anbau und Garten nur, wo neben dem Haustyp Platz ist (`kitLayout`).
- **Deko (14):** Bank, Picknicktisch, Laterne, Blumenbeet, Hochbeet, Zaun, kleiner Brunnen, Laubbaum, Nadelbaum, Obstbaum, Busch, Findling, Feuerstelle, Steg (Wasser).
- **Vegetation (automatisch):** Laub-, Nadel- und Obstbäume, Büsche, Findlinge, Blumeninseln, Schilf, Waldgürtel; Poisson-Verteilung mit Abstand je Art (keine Überlappung).
- **Leben:** bestehend (Schafe, Enten, Hühner, Bewohner, Vögel, Schmetterlinge, Wolken) plus Glühwürmchen und Fensterlicht in der Nacht. Tiere bleiben in ihren Bereichen (Weide, Teich, Hühnerhof), Bewohner auf Wegen.
- **Tageszeit:** neu vier Stufen Morgen, Mittag, Abend, **Nacht** (Mondlicht, Sterne, alle Fenster und Laternen an).

## 6. Bau-Modus (Etappe 4)

```
┌ Leiste (Besitzer) ───────────────────────────────────────────┐
│ 3D|Karte  ● Mittag │ Reise  Liste  + Haus  [Bauen]  Einstellungen │
└──────────────────────────────────────────────────────────────┘
            ▼ «Bauen»
┌ Bau-Leiste ──────────────────────────────────────────────────────────┐
│ [Bank][Laterne][Beet][Baum]…▸  │ ⟲ ⟳  🗑  │ ↶ ↷ │ Abbrechen  [Speichern] │
└──────────────────────────────────────────────────────────────────────┘
  Element wählen → erscheint als Geisterbild unter dem Zeiger: grün = gültig,
  rot + Grund («auf dem Weg», «zu nah am Haus»). Loslassen: gültig → platziert;
  ungültig → rastet auf die nächste gültige Stelle oder springt zurück.
  Haus anklicken (oder aus der Liste wählen) → Varianten; «Umsetzen» zeigt die freien
  Plätze im eigenen Quartier (grün), Klick oder Knopf «Platz n» setzt das Haus dorthin.
  Tastatur: Pfeile 0.5 m, Q/E drehen 15°, Enter setzen, Entf entfernen, Esc abwählen,
  Strg+Z/Y. Touch: Tippen setzt bzw. wählt, Ziehen bewegt die Kamera.
  Umgesetzt: Werkzeugleiste rechts (Desktop) bzw. unten (Handy), Vorschau beim Blickziel.
```

Speichern schickt das ganze Dokument an die Server Action `saveWorld`; der Server berechnet die Welt selbst neu und lehnt ungültige Elemente mit Grund ab. **Zurücksetzen auf Automatik** entfernt eigene Deko, Varianten und Hausplätze (Bestätigung, rückgängig machbar bis zum Speichern). **Welt neu würfeln** (Einstellungen › Dorf): neuer Seed als Vorschau direkt in der Szene («Übernehmen / Nochmals / Verwerfen»), eigene Platzierungen bleiben, ausser «auch eigene Platzierungen zurücksetzen» ist angekreuzt; Deko, die in der neuen Landschaft ungültig wäre, wird vor dem Übernehmen gezählt und genannt (nie stillschweigend).

## 7. Teststrategie

- **Property-Tests** (`src/lib/world/*.test.ts`, 200+ Seeds × 0–40 Häuser): keine Überlappung (inkl. Mindestabstand), alles in der Karte und auf zulässigem Gelände, jedes Haus mit freiem Zugang und freier Schild-Sichtzone, neue Häuser verschieben nichts, Determinismus, Zufallseingaben (Verschieben/Drehen) enden gültig oder abgewiesen.
- **RLS-Tests** `tests/rls/welt.test.ts`: Besucher liest, Fremde nicht, niemand schreibt direkt (auch der Besitzer nicht).
- **Visuelle Matrix** `tests/visual/` (eigene Playwright-Konfiguration): 8 Seeds × 4 Datenmengen × 3 Tageszeiten × 4 Kameraposen × Desktop/Mobile über `/dev/dorf`, Screenshots nach `test-results/visual/<etappe>/`, Bewertung nach Rubrik.
- **E2E** bestehend bleiben grün; neu `bauen.spec.ts` (Bau-Modus auf `/dev/dorf` ohne Datenbank).

## 8. Risiken

1. **Layout-Neubau** berührt Kamera, Beschriftungen, Karte, Wege, Laternen: Ausgabeformat `VillageLayout` bleibt, damit die Szene weiterläuft. 2. **Bestehende Dörfer sehen nach dem Update anders aus** (Generator v1 ersetzt das alte Layout); vertretbar, da der Pilot noch nicht lief. 3. **Headless-WebGL** (SwiftShader) misst keine echte GPU-Leistung: Draw Calls/Dreiecke sind belastbar, fps nur als Richtwert; echte Messung über `?perf=1` auf Gians Laptop. 4. **Datenbank in dieser Umgebung nicht erreichbar:** RLS- und DB-E2E-Tests sind geschrieben, laufen aber erst bei Gian.

## 9. Aufwand (relativ)

Etappe 1 ≈ 35 % (Layout-Neubau, Regeln, Tests, Migration) · 2 ≈ 20 % · 3 ≈ 15 % · 4 ≈ 20 % · 5 ≈ 5 % · 6 ≈ 5 %.

## 10. Offene Fragen an Gian (nicht blockierend, Vorschläge in Klammern)

1. Migration `village_worlds` einspielen (danach `npm run test:rls`).
2. Ab 13 Objekten pro Haus ein Archivschrank «+N» statt eines immer grösseren Gartens (ja).
3. Häuser lassen sich nur auf freie Slots **im eigenen Quartier** umsetzen, nicht frei drehen (ja: Tür und Weg bleiben logisch).
4. Löschen eines nicht fixierten Hauses kann spätere, nicht fixierte Häuser nachrücken lassen. Fixiert wird beim Speichern im Bau-Modus (ja; optional später automatisch beim Anlegen).
5. Bestehende Testdörfer wechseln auf Generator v1 (ja, kein Pilot betroffen).
6. Höchstens 120 eigene Deko-Elemente pro Dorf (ja).

Annahmen A1–A6 aus dem Auftrag gelten als bestätigt; A6 ist mit Abschnitt 5 beantwortet.
