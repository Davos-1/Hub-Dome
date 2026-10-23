# Visuelle Testmatrix

Rendert die 3D-Welt über die Entwickler-Route `/dev/dorf` in vielen Varianten (Seed, Datenmenge, Tageszeit, Kamera) und speichert Screenshots zum Bewerten und zum Vergleich zwischen Etappen. Das sind keine Pflicht-Tests: sie laufen nicht in `npm run check`, nicht in `npm run test:e2e` und nicht in Vitest, nur auf Abruf.

## Aufruf

```bash
npx playwright test -c playwright.visual.config.ts                    # Desktop und Mobile, reduzierte Matrix
npx playwright test -c playwright.visual.config.ts --project=desktop  # nur Desktop (1280×800)
npx playwright test -c playwright.visual.config.ts --list             # nur auflisten, nichts rendern
npx playwright test -c playwright.visual.config.ts -g "hubdome1-20h"  # einzelne Bilder über den Namen
```

Der Dev-Server startet bei Bedarf selbst (`npm run dev`). In Cloud-Umgebungen ohne passende Playwright-Browser: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` voranstellen. WebGL läuft headless über SwiftShader (CPU), die Chromium-Flags stehen im Kopf von `playwright.visual.config.ts`. Das ist langsam: Frame-Zeiten (`frameMs`) sind nur Richtwerte, Draw Calls und Dreiecke sind belastbar. Echte fps misst man auf einem Rechner mit GPU.

## Was gerendert wird

Jedes Bild ruft `/dev/dorf?seed=…&h=…&o=…&zeit=…&kamera=…&bewegung=0` auf (Bewegung eingefroren), wartet auf `window.__hubDome.ready === true` (höchstens 90 s) plus 300 ms und macht den Screenshot. Seitenfehler (`pageerror`) lassen den Test scheitern.

- **Seeds:** feste Liste von 8 (siehe `STANDARD_SEEDS` in `matrix.spec.ts`).
- **Datenmengen:** `leer` (0 Häuser), `3h` (3 Häuser × 4 Objekte), `10h` (10 × 6), `20h` (20 × 12), `deko` (10 × 6 mit Beispiel-Deko aller Katalog-Typen, `deko=1`, Häuser fixiert).
- **Tageszeiten:** `mittag`, `abend`, `nacht`.
- **Kameras:** `uebersicht`, `vogel`, `strasse`, `ufer` (Brücke, See oder Teich aus der Nähe); Nahaufnahme je Haustyp `haus-<typ>` (werkstatt, block, solar, atelier, stadt, haus, turm, digital, baustelle).

Standard (reduziert, 115 Bilder je Projekt): Seed 1 und 2 mit `leer`, `3h`, `10h`, `20h`, allen Tageszeiten und den drei Kameras, dazu `deko` auf Strassenhöhe zu jeder Tageszeit; die übrigen Seeds nur `uebersicht` und `vogel` bei `mittag` mit `10h`; jeder Seed zusätzlich `deko` bei `mittag` in der Übersicht und am Ufer; Nahaufnahmen aller neun Haustypen nur für Seed 1 mit `20h` bei `mittag` (nur dort kommen alle Typen vor).

## Umgebungsvariablen

| Variable              | Wirkung                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VISUAL_STAGE=<name>` | Etappe, Unterordner der Ausgabe (Standard `aktuell`, z.B. `baseline`, `etappe2`)                                                                                     |
| `VISUAL_FULL=1`       | alles für alle Seeds: volle Kombination und Nahaufnahmen (20h) bei allen Tageszeiten, 504 Bilder je Projekt                                                          |
| `VISUAL_SEEDS=a,b`    | ersetzt die Seed-Liste (je 8 Zeichen a-z0-9); die ersten zwei der Liste bekommen die volle Kombination, der erste die Nahaufnahmen                                   |
| `VISUAL_ONLY=…`       | schränkt die Auswahl ein: Kamera (`uebersicht`, `vogel`, `strasse`, `haus`, `haus-turm` …), Tageszeit, Datenmenge. Innerhalb einer Gruppe ODER, zwischen Gruppen UND |

Beispiele:

```bash
VISUAL_STAGE=etappe2 npx playwright test -c playwright.visual.config.ts --project=desktop
VISUAL_ONLY=uebersicht,nacht npx playwright test -c playwright.visual.config.ts      # Übersicht bei Nacht
VISUAL_SEEDS=b7k2m9qx VISUAL_ONLY=haus npx playwright test -c playwright.visual.config.ts  # alle Nahaufnahmen eines Seeds
```

## Ausgabe

```
test-results/visual/<etappe>/<projekt>/<seed>-<daten>-<zeit>-<kamera>.png
test-results/visual/<etappe>/<projekt>/stats.json     // [{ datei, calls, triangles, frameMs }, …]
```

`<projekt>` ist `desktop` oder `mobile` (390×844, Pixelverhältnis 2). `stats.json` wird bei Teil-Läufen mit der vorhandenen zusammengeführt (Eintrag pro Bild, neuer Lauf überschreibt). Gleiche Dateinamen in verschiedenen Etappen lassen sich direkt vergleichen.

`test-results/` steht in `.gitignore` und wird nicht committet. Die normale Konfiguration (`npm run test:e2e`) schreibt nach `test-results/e2e/`, die visuelle ihre Laufdateien nach `test-results/_visual-lauf/`; beide lassen `test-results/visual/` unberührt.

## Bewertung

Bilder nach der Rubrik der Phase 4f bewerten (Auftrag Phase 4f, Abschnitt 4.3; Konzept: `docs/PHASE-4F-KONZEPT.md`), je Bild oder je Gruppe mit Notiz bei Auffälligkeiten:

1. **Korrektheit:** nichts durchdringt sich, schwebt, steht schief, liegt auf Wegen oder Wasser oder ausserhalb der Karte.
2. **Logik:** Zugang und Weg zur Tür, freie Sicht aufs Schild, Dinge stehen dort, wo man sie erwartet.
3. **Detailreichtum:** Haus, Garten, Umgebung wirken ausgearbeitet, auch in der Nahaufnahme.
4. **Charakter:** Stimmung und Licht je Tageszeit, Haustypen unterscheidbar.
5. **Individualität:** verschiedene Seeds und Datenmengen ergeben erkennbar verschiedene Dörfer.
6. **Lesbarkeit der UI:** Beschriftungen, Brotkrumen, Suche und Leisten sind lesbar und überlappen nicht, besonders auf Mobile.
7. **Performance:** `calls` und `triangles` aus `stats.json` (Richtwerte aus den E2E-Tests: unter 250 Draw Calls, unter 600k Dreiecke), `frameMs` nur als Richtwert.
