# Handoff: 3D-Dorf – Endfassung (Hub-Dome)

Änderungsdokument für **Claude Code** im Repo `Davos-1/Hub-Dome` (Next.js, React Three Fiber, Supabase).
Ziel: Die 3D-Ansicht `/dorf/[username]` genau so umbauen, wie sie im Prototyp **Dorf 3D** jetzt eingestellt ist.

---

## 1. Über die Dateien in diesem Paket

`referenz/` enthält **Design-Referenzen in HTML/JS**, keinen Produktionscode:

| Datei | Inhalt |
|---|---|
| `referenz/dorf-viewer.js` | Kompletter Prototyp der Szene in plain three.js (r160). **Massgebliche Quelle für alle Zahlen, Farben und Algorithmen.** Funktionsnamen unten verweisen darauf. |
| `referenz/Dorf 3D.dc.html` | Vollbild-Seite mit Leiste unten, Popups und Einstellungsfenster. Die Logik steht im `<script data-dc-script>` am Ende. |
| `referenz/Dorf 3D Varianten.dc.html` | Analyse und alle verworfenen Varianten (nur zum Verständnis, **nicht** umsetzen). |

Aufgabe: Den Prototyp **in der bestehenden Architektur nachbauen** (R3F-Komponenten, `src/lib/*.ts` für reine Logik mit Vitest-Tests, Tailwind für UI). Nicht das HTML/JS kopieren.
Die Prototyp-Funktionen sind bewusst als reine Funktionen geschrieben und lassen sich 1:1 nach TypeScript portieren.

**Fidelity: High-Fidelity.** Masse, Farben, Abstände und Verhalten sind final.

---

## 2. Entscheidungen (vom Auftraggeber bestätigt)

1. **Endfassung fest eingebaut.** Für den Nutzer einstellbar bleiben nur **Tageszeit**, **Ansicht (3D/Karte)** und **Filter nach Kategorie**. Alle anderen Varianten aus dem Prototyp werden **nicht** als Einstellung angeboten.
2. **Fachbereich** wird **fest im Code über `module_code`** zugeordnet (Tabelle unten). Keine DB-Spalte für den Fachbereich.
3. **Semester**: neue nullable Spalte `houses.semester` (vom Besitzer editierbar, wird angezeigt). Gruppiert wird im Dorf **nur nach Fachbereich**.
4. **Haustypen pro Fachbereich ersetzen den Dorf-Hausstil** (`villages.house_style`). Der Stil-Picker für Häuser entfällt. **Zentrale-Stile bleiben** unverändert (inkl. eigenem GLB).
5. **Seitenlayout**: Vollbild-3D mit schwebender Leiste unten und Einstellungsfenster rechts.
6. **«Neu»** = Objekt mit `created_at` jünger als 7 Tage.

---

## 3. Festgelegte Konfiguration (entspricht den Defaults in `Dorf 3D.dc.html`)

| Bereich | Wert | Prototyp-Funktion |
|---|---|---|
| Gruppierung | Quartiere nach **Fachbereich** | `computeQuarters(…, mode='fach')` |
| Häuser im Quartier | **Rund** (ganz um den Nebenplatz) | `arrangeQuarter(…, 'rund')` |
| Quartiere zur Zentrale | **Kompakt** | `computeQuarters(…, qlayout='kompakt')` |
| Platzform | **Vieleck** (Haupt- und Nebenplätze) | `polyAssign`, `polyPlaza` |
| Wege | **Sanfter Bogen** (Hermite) | `hermite`, `quarterPaths` |
| Wegbelag | **Kies-Textur + Grasübergang** | `texRibbon`, `gravelTexture` |
| Grundstück | **Hecke** (schlanke Formhecke) | `fenceParts(…, 'hecke')` |
| Beschriftung | **Kompakt-Chip + Karte bei Hover + Holzschild am Tor** | `drawChip`, `drawCard`, `drawBoard`, `updateLabels` |
| Blumenpunkte | **entfernt** (Wiese und Blumenkästen) | `flowers=false` |
| Haustyp/Farbe | **pro Fachbereich** | `FACH_STYLE`, `TYPE_MODELS` |
| Hausgrösse | **zurückhaltend**: Footprint 1.1 / 1.25 / 1.4 | `tf` in `doRebuild` |
| Gelände | **sanfte Hügel** ausserhalb, Dorf flach | `terrainH` |
| Rand | **Waldgürtel + Nebel** | `nature(…)` mit `wald` |
| Wasser | **Fluss hinten + Brunnen am Platz** | `computeRiver`, `fountainParts` |
| Objekte | **Form nach Kategorie** | `objParts(…, typed=true)` |
| Aktivität | **Kaminrauch** bei neuen Objekten | `smoke` in `doRebuild`/`frame` |
| Dorfplatz | **Anschlagbrett** mit neuen Objekten | `drawNotice` |
| Leere Häuser | **Baustellenschild** «Erstes Objekt hinzufügen» | `drawConstruction` |
| Strassenlaternen | Plätze + entlang Wegen, unregelmässig | `addLamps`, Abschnitt «Umgebung der Zentrale» |

---

## 4. Datenmodell

### 4.1 Migration
```sql
alter table houses add column semester smallint null check (semester between 1 and 12);
```
- RLS wie bei den übrigen `houses`-Spalten (nur Besitzer schreibt).
- Formular in der Listenansicht: optionales Feld «Semester».
- `villages.house_style` bleibt in der DB (keine destruktive Migration), wird aber **nicht mehr gelesen**. Stil-Picker für Häuser in `/einstellungen` entfernen, Zentrale-Picker behalten.

### 4.2 Neue Datei `src/lib/fachbereiche.ts`
Reine Logik + Vitest. Exportiert `FACHBEREICHE`, `fachbereichOf(house)`, `FACH_STYLE`.

**Fachbereiche und Stil** (aus `FACH_STYLE` im Prototyp; Wandfarbe variiert pro Haus um Faktor 0.90–1.09 über `fnv(house.id)`):

| Fachbereich | Haustyp | Wand | Dach | Akzent |
|---|---|---|---|---|
| Tragwerk & Bau | `werkstatt` | `#e9dccb` | `#9c4a32` | `#b5523b` |
| Umwelt & Nachhaltigkeit ¹ | `block` | `#9a6a42` | `#5f7a4a` | `#4f7d3f` |
| Gebäude & Energie | `solar` | `#eef0ec` | `#4b5d6e` | `#2f7d8c` |
| Projekt & Prozess | `atelier` | `#e8d6a6` | `#6f6355` | `#c08a2b` |
| Wirtschaft & Recht | `stadt` | `#efe7dc` | `#5b4d63` | `#7a3b4a` |
| Grundlagen | `haus` | `#e4e9ef` | `#5f6f86` | `#3f5f8a` |
| Sprache & Kommunikation | `turm` | `#efe6d8` | `#3f7a74` | `#2f8a7d` |
| Digital & Daten ² | `digital` | `#e6e4ee` | `#3d3a4f` | `#6b4fd8` |
| Weitere (Fallback) | `haus` | `#ece8e0` | `#7a746a` | `#6d6a63` |

¹ Im Prototyp hiess die Gruppe «Geotechnik & Umwelt». Der DCS-Katalog hat keine Geotechnik-Module, daher umbenannt. Stil unverändert.
² **Nicht im Prototyp.** Der DCS-Katalog hat viele Digital-/Daten-Module, die in keine der 7 Gruppen passen. Neuer Typ `digital`: Flachdach-Kubus wie `solarModel`, aber ohne Solarpaneele; stattdessen ein schmales leuchtendes Fensterband (Glow) um das Obergeschoss, auf dem Dach eine kleine Antenne und ein Kasten (Serverhaus). Wachstum: Stufe 2 Vordach in Akzent, Stufe 3 zweiter, versetzter Kubus. Bitte dem Auftraggeber zur Abnahme zeigen.

**Zuordnung `module_code` → Fachbereich** (Codes aus `supabase/seed.sql`, Präfix `TA.BA_` bzw. `I.BA_` hier weggelassen). Nicht gelistete Codes und Themenhäuser (`kind='thema'`) → «Weitere».

- **Tragwerk & Bau**: `BAUSTATIK1`, `BAUSTATIK2`, `BS`, `TRL1`, `TRL2`, `BETON_STAHL1`, `HB2_MM`, `LABO`, `BEST`, `IP`, `CAMPUS`
- **Umwelt & Nachhaltigkeit**: `NABA`, `OEK`, `OEK_PWG`, `TA.MAA_SUSC_ISA`
- **Gebäude & Energie**: `B_GT_MM`, `BAUKLI_MM`, `GH_ENERGIE`, `GT_SYS`, `GA`, `HLKS_ENG1`–`HLKS_ENG4`, `GE_ENG1`–`GE_ENG3`, `EEVS`, `ET`, `ET2`, `EPO`, `DT`, `LAB_EE`, `GEB_SYS_ISA`
- **Projekt & Prozess**: `DC_STUD1`–`DC_STUD4`, `AT_TEAM`, `BAA_DC`, `FEI`, `INNO_PA`, `B_IW`, `INTPRO`, `PRAX_VTZ_DCS`, `PRAX_DCS_3`, `PRAX_DCS_6`, `WISSARB`, `DC_COLLAB_MM`, `DC_METH`, `INTDE`, `DC_BRIDGE`, `DC_SR1`, `INDES1_MM`, `INDES2_MM`, `SOCIAL_DCS`, `OPEN_ISA`
- **Wirtschaft & Recht**: `BRE`, `MG`, `EPRS`, `LEAD`, `BW+ING`, `BUSI+ENG`, `BIZCON`, `VWL`, `VWL2`, `GDF`, `DIGITRANS`, `I40_BAS`
- **Grundlagen**: `MATH1A`, `MATH2A`, `MATH3A`, `PHYSIK1A_MM`, `PHYSIK2A`, `LINALG_MM`, `STOC_MM`, `OPTIK`, `PRZ`, `NANOTECH`, `DESG`, `TE+GE_ISA`, `AFU`, `TUT`
- **Sprache & Kommunikation**: `LIDE+EG_ISA`, `EBUSI_SZ`, `PROF_SZ`, `PEAK`, `ECONS`, `FCE_SZ`, `EEXP`, `CAE_SZ`, `EBP`, `DEFRC1_1_SZ`, `DEFRC1_2_SZ`, `SP1`, `SP2`, `SELL`, `GFK_ISA`, `KOHEB`, `SWISS_ISA`, `AS_ISA`
- **Digital & Daten**: `DT_GRND_MM`, `DT_PARAM`, `DT_PROGR`, `DT_DESIGN`, `DT_CONST`, `DT_BETR_LIFE`, `DATA1_MM`, `DATA2_MM`, `DATA3_MM`, `PYTHON_MM`, `PYTHON_AD`, `APROG_MM`, `APP_MM`, `PRGC_MM`, `ML_MM`, `ADML_MM`, `BDM`, `DVIZ_MM`, `STAT_MM`, `MO_SIM1_MM`, `MO_SIM2_MM`, `USAB`, `MTIV`, `DC_GRND1_MM`, `DC_GRND2_MM`, `DC_TECH_MM`, `DDT`, `IMM_TECH`

Vergleich robust machen: `module_code` ohne Präfix bis zum ersten `.` und ohne `BA_` normalisieren. Test: jeder Code aus `seed.sql` ergibt einen Fachbereich ≠ undefined.

---

## 5. Änderungen pro Repo-Datei

### 5.1 `src/lib/layout.ts` (komplett neu, Tests anpassen)
Port von `plotFor`, `arrangeQuarter('rund')`, `computeQuarters(mode='fach', qlayout='kompakt', poly=true)`, `polyAssign`.
- **Grössenstufen** `houseTier` bleibt (0–2 / 3–6 / 7+). `TIER_FOOTPRINT = {1: 1.1, 2: 1.25, 3: 1.4}`.
- **Grundstück pro Haus** (`plotFor`): `{hw, front, back, slots}`. Objekte nach Kategorie sortiert, links und rechts des Gartenwegs in Reihen (1/2/3 Spalten pro Seite bei ≤2/≤4/mehr Objekten, Abstand 1.2 m, erste Reihe `fp*1.05 + 1.05`). Mitte bleibt frei. Rückgabe ersetzt `artifactSlots`.
- **Nebenplatz-Apothem** `rp = max(2.6, 1.3 / tan(π / max(5, m+1)))`, m = Häuser im Quartier.
- **Rund**: Slots `m+1` gleichmässig um den Nebenplatz, Slot 0 (Richtung Zentrale) bleibt frei. `R = max(rp + front + 2.4, front + (2·hw + 1.6) / (2·sin(Δ/2)))`. Haus schaut zum Nebenplatz.
- **Quartiersradius** `Qr = max über Häuser hypot(dist + back, hw) + 0.8`.
- **Kompakt**: Winkelanteil pro Quartier ∝ `Qr`, Start bei π/2 (vorne), Abstand `plaza + rp + 4 + 0.45·Qr`. Danach Auflöser (max. 400 Iterationen): überlappende Inseln radial auseinander (`Qr_i + Qr_j + 1.5`), Mindestabstand zum Hauptplatz, Hauptweg zu Quartier B darf Quartier A nicht schneiden (sonst B um 0.03 rad drehen).
- **Hauptplatz** Apothem `max(9.4, n·1.95/2π)`.
- **Vieleck**: Hauptplatz `n = max(5, Anzahl Quartiere)`, Nebenplatz `n = max(5, m+1)`. `polyAssign` wählt die Drehung so, dass jeder Weg eine eigene Seite bekommt und die Winkelabweichung minimal ist. Rückgabe pro Platz `{x, z, a, n, rot, used[]}`.
- `extent = max(|c| + Qr) + 6`.
- **Tests**: Für 5–50 Häuser (verschiedene Verteilungen auf Fachbereiche) überlappt kein Grundstücks-Rechteck ein anderes (SAT-Test, siehe `satOverlap`). Im Prototyp mit 150 Kombinationen geprüft.

### 5.2 `src/lib/paths.ts` (ersetzen)
- Hauptweg pro Quartier: `hermite(S, dS, G, dG, amp=0)`, Start in der Mitte der zugewiesenen Seite des Hauptplatzes (`a − 0.35` vom Zentrum, Richtung = Seitennormale), Ende in der Mitte der Eingangsseite des Nebenplatzes, senkrecht. Breite 1.9 m.
- Hausweg: von der Nebenplatz-Seite zum Gartentor (`plot.front` vor dem Haus), senkrecht am Tor ankommend. Leichter Bogen `0.3·sin²(πt)`, Seite aus `fnv(id)`. Breite 1.5 m.
- Breite mit Einmündung: `w·(1 + 0.7·max(0, 1 − s/1.6)²) + 2.5 % sin(s·0.6 + seed)`.
- Bisherige Sinusformen, `spreadStartAngles` und Korridor-Skalierung entfallen.

### 5.3 `src/components/village/paths-geometry.ts`
Port von `texRibbon` + `gravelTexture`:
- Neu abtasten alle 0.3 m. Querschnitt 9 Stützpunkte: Gras (`#86bf6c`) → Kante → Belag → Kante → Gras. Grasübergang 0.45 m, an Anfang und Ende ausgeblendet. Kante 0.16 m.
- **Keine Zufallsfarbe pro Vertex** (das wirkte verpixelt). Stattdessen UV in Metern (`u = Querabstand/1.4`, `v = Bogenlänge/1.4`) und eine prozedurale, kachelbare **Kies-Textur 512 px** (`RepeatWrapping`, `anisotropy 8`). Vertexfarbe bestimmt den Ton:
  - Dorfwege: Belag `#d3cbb5`, Kante `#aaa188`
  - Quartierwege in der Quartierfarbe (`QCOL`): `#d3c9b0/#a99f86`, `#d6c0b8/#ad968d`, `#c2cdc6/#97a59c`, `#d9c7a0/#b29f78`, `#c4cad0/#9aa2aa`, `#d9b8a3/#b0907b`, `#cad2b2/#a2ab88`
- Ein Mesh für alle Wege (eine Geometrie, ein Material).

### 5.4 `src/components/village/decor.tsx`
- **`Ground`**: Gitter-Ebene `2·(extent+140)`, 180×180 Segmente, Höhe aus `terrainH` (flach bis `extent+9`, dann sanft auf 1–4 m), Vertexfarbe innen `#86bf6c` → aussen `#9ccc82` → auf Kuppen `#b4cf86`.
- **Hauptplatz** (`polyPlaza`, `terraceParts`):
  - Pflaster `#c9bfa2`, Bänder bei 62–65 % und 86–88.5 % des Umkreisradius (Ton ×0.9), Fugen von den Ecken zur Mitte (0.07 m, Ton ×0.88).
  - Randstein 0.28 × 0.14 m (`#a8a29e`) je Seite, **an Wegeinmündungen offen** (Lücke 3.6 m Hauptplatz, 3.0 m Nebenplatz).
  - Zweistufige Terrasse unter der Zentrale in derselben Vieleck-Form: R 5.5 (h 0.11, `#cfc7b4`) und R 4.95 (h 0.22, `#ddd5c3`). Zentrale um 0.22 m anheben.
  - Pflanzkübel mit Baum in jeder Ecke (R − 1.25). Freie Seiten: Bank (1.5 m vom Rand) + 2 Laternen.
  - Laubbaum-Ring ausserhalb (Ecken R+3.0, Seitenmitten a+3.2), frei von Wegen (2.6 m), Gärten und Nebenplätzen.
- **Nebenplätze**: gleiches `polyPlaza` in Quartierfarbe (`plaza`/`edge` aus `QCOL`).
- **Quartiertafel** am Nebenplatz: 4.8 × 2.4 m, um 0.28 rad nach hinten geneigt, Pfosten 3.9 m, Querbalken. Inhalt: Name 60 px fett, Modulkürzel darunter, Kopfband in Quartierfarbe. Canvas 1024 × 512.
- **Brunnen** (`fountainParts`) bei `polar(π/2 + 0.78, 7.2)`, **Anschlagbrett** bei `polar(π/2 − 0.78, 7.3)`, zur Kamera gedreht.
- **Fluss** (`computeRiver`): Bogen hinten bei `extent + 4.5 ± Mäander`, Breite 3.4 m, Ufer `#cbbf99`, Wasser `#5b9cc4`. Bestehendes `life/water.tsx` darauf ausrichten.
- **Natur**: 46 Nadelbäume, 40 Büsche, 18 Steine wie bisher, **plus Waldgürtel** 230 Bäume zwischen `extent+9` und `extent+46` (Skala ×1.25), alles auf Geländehöhe. **Blumen entfernen.** Freihalten: Plätze, Gärten (+0.8 m), Wege, Fluss.
- **Strassenlaternen** (instanziert, siehe `addLamps`): Sockel, Mast 2.3 m, Kopf mit Dach, Glow-Box 0.18 × 0.24 m.
  - Hauptplatz: je 2 an jeder Wegeinmündung (± Lücke/2 + 0.45).
  - Nebenplätze: zufällige Ecken (Wahrscheinlichkeit 55 %, mindestens 2).
  - Wege: Abstand 6–14 m, Seite zufällig, 0.45–0.95 m neben dem Rand, 20 % der Stellen leer. Nicht in Gärten, nicht auf anderen Wegen, mindestens 4 m zur nächsten Laterne.
  - Zufall deterministisch: `seeded('laternen')`.
  - Am Abend 5 echte `PointLight` am Hauptplatz (Intensität 6, Reichweite 10).

### 5.5 `src/components/village/models/`
- Neu: `house-fach.ts` mit `werkstattModel`, `blockModel`, `solarModel`, `atelierModel`, `stadtModel`, `turmModel` (Port aus dem Prototyp) und neu `digitalModel` (siehe 4.2). `hausModel` erhält die Parameter `accent` (Tür, Läden) und `chimney`.
- `index.ts`: `houseModel(type: FachType, fp, tier, wall, roof, accent)`. `houseTopFactor` pro Typ aus `top` der Modelle ableiten.
- **Baustelle** (0 Objekte) bleibt typunabhängig (`baustelle`).
- Alle Typen haben 3 Wachstumsstufen.
- **Objekte** (`artifact-3d.tsx` / `object-models.ts`): Form nach **Kategorie** (`objParts`): Rechner = Pult, Quiz = Tafel, Zusammenfassung = Buch, Cheatsheet = Blatt, Tool = Werkzeugkiste, Visualisierung = Staffelei, Sonstiges = Tafel auf Sockel. Kategoriefarben bleiben (`KIND_COLORS`). Neue Objekte bekommen ein gelbes Fähnchen (`#facc15`).
- **Beete**: zusammenhängende Plätze gleicher Kategorie pro Reihe bilden ein Beet mit Erde `#7b5d45` und Kante in Kategoriefarbe (`bedParts`).
- **Garten wächst**: ab Stufe 2 eine Bank, ab Stufe 3 zusätzlich ein Baum hinter dem Haus.

### 5.6 `src/components/village/buildings.tsx`
- Pro Haus: Rasen `#9fcf83`, **Formhecke** 0.30 m breit, 0.50–0.56 m hoch, Abschnitte à ca. 1.1 m in `#3f7d42`/`#43834a`, Schnittkante oben `#5f9d57`. **Alle Heckenteile des Dorfs als ein `InstancedMesh`.**
- Steinpfosten am Tor 0.72 m. Hat das Haus neue Objekte, kommen Laternen auf die Pfosten.
- Gartenweg: Trittplatten 1.05 × 0.56 m vom Tor zur Tür.
- **Holzschild am Tor** (links, 1.6 × 0.8 m): Kürzel gesperrt, Titel 62 px fett, «8 Objekte · 2 neu».
- **Baustellenschild** bei leeren Häusern (rechts, 1.5 × 0.94 m, gelb-schwarz). Klick öffnet den bestehenden Dialog «Objekt hinzufügen» (nur für den Besitzer, sonst nicht klickbar).
- **Kaminrauch**: 6 weiche Sprites pro Haus mit neuen Objekten, steigen 2.4 m, Wind (0.7, −0.7). Nur Typen mit Kamin (`haus`, `block`). Bei `reducedMotion` aus.

### 5.7 `src/components/village/label3d.tsx` + Labels
Ein Canvas-**Textur-Atlas** für alle Chips, Karten und Schilder (`buildAtlas`, 2048 bzw. 4096 px breit). Jede Beschriftung nutzt einen Ausschnitt über `offset/repeat`.
- **Chip** (Übersicht): Kürzel-Pille in Hausfarbe, Dokument-Symbol, Anzahl, gelbes «+2» bei neuen Objekten. Bildschirmhöhe 0.032. Anker unten mit Spitze.
- **Karte** (Hover/Tastatur): Kürzel-Kachel 88 px, Titel 38 px, Unterzeile «8 Objekte», gelbes Badge «2 neu», Balken nach Kategorie. Höhe 0.062.
- **Objekt-Karte** bei Hover über ein Objekt: Kategorie-Kachel mit Buchstabe, Titel, «Quiz · BST», «neu».
- **Quartiername** als dunkle Pille `rgba(40,38,34,.88)`, Höhe 0.03, über dem Nebenplatz.
- Regeln pro Frame (`updateLabels`):
  - Ebene **Dorf** mit mehr als 15 Häusern: nur Quartiernamen und Zentrale. Haus-Chips nur für das Haus unter der Maus oder das per Tastatur gewählte.
  - Ebene **Quartier/Haus**: Chips des aktiven Quartiers sichtbar, der eigene Quartiername **ausgeblendet** (die Tafel ist lesbar), andere Quartiere ×0.3.
  - Haus-Chips blenden unter 18–24 m Kameradistanz aus (das Schild übernimmt).
  - Überlappung: höchstens ein Ausweichschritt nach oben (×1.06 Höhe), sonst ausblenden. Nähere Chips haben Vorrang.
  - Filter aktiv: Häuser ohne Treffer ×0.28.
- Schriften: **IBM Plex Sans** (400/500/600/700) für Canvas und UI, **IBM Plex Mono** für kleine Labels. In `layout.tsx` über `next/font/google` laden und vor dem Zeichnen `document.fonts.load` abwarten.

### 5.8 `src/components/village/camera-rig.tsx` – Navigation als Ordnerstruktur
Ebenen **Dorf › Quartier › Haus** (`setNav`, `flyQuarter`, `fly`, `up`).
- **Dorf**: Übersichtspose `(0, e + 11, 1.38e + 16)` → Ursprung.
- **Quartier**: Ziel ist der Schwerpunkt von Nebenplatz und Häusern. Die Kamera steht auf der Zentrale-Seite: `Ziel − u·(1.25·Qr + 7)`, Höhe `1.05·Qr + 8`.
- **Haus**: vor dem Gartentor, `Tor + 6.5 m` nach aussen, Höhe `3.4 + 0.7·fp`, Blick auf `0.45·Tor`.
- **Karte**: senkrecht von oben, Rotation gesperrt (`minPolarAngle 0, maxPolarAngle 0.001`), kein Nebel.
- Übergang 0.9 s, ease-out cubic. Bei `reducedMotion` sofort.
- **Klick** auf Nebenplatz oder Quartiername öffnet das Quartier, auf ein Haus das Haus, auf ein Objekt das Haus und hebt das Objekt hervor.
- **Breadcrumb** oben links, jede Ebene klickbar.
- **Tastatur** (Fokus im Canvas):
  - Dorf: ← → wählt ein Quartier, Enter öffnet es.
  - Quartier: ← → wählt ein Haus, Enter öffnet es.
  - Haus: ← → springt zum nächsten Haus im Quartier.
  - Esc: eine Ebene zurück.

### 5.9 `village-scene.tsx` / Licht
Tageszeit-Presets (`TIMES`). `auto`: Morgen 5–10 Uhr, Mittag 10–18 Uhr, sonst Abend.

| | Himmel oben / Mitte / unten (= Nebel) | Sonne | Intensität | Position (×extent) | Hemi oben / unten / Intensität | Glow | Belichtung |
|---|---|---|---|---|---|---|---|
| morgen | `#8fb6e0` `#f2d4b8` `#f8e6d4` | `#ffd2a1` | 1.7 | (−0.9, 0.5, 0.7) | `#ffe9d6` `#7f9a6a` 0.85 | 0.7 | 1.0 |
| mittag | `#6fb1ec` `#b9dcf7` `#e8f3fb` | `#fff3dc` | 2.1 | (0.7, 1.2, 0.9) | `#fff7ea` `#7fa56a` 1.0 | 0.85 | 1.0 |
| abend | `#24335e` `#7a6190` `#eaa676` | `#ffa765` | 1.5 | (0.95, 0.38, 0.55) | `#a3a9d6` `#5a6a52` 1.05 | 2.6 | 1.08 |

- Nebel `Fog(d0 + 0.4·extent, d0 + 2.2·extent)`, mit `d0` = Abstand der Übersichtskamera.
- Schatten 4096 px, PCF soft, `radius 3`.

### 5.10 UI: `village-view.tsx`, `village-panel.tsx`
Vollbild wie `referenz/Dorf 3D.dc.html`. Das bisherige Seitenpanel wird zum Einstellungsfenster bzw. zur Detailansicht.
- **3D füllt den Viewport** (`position: fixed; inset: 0`), Seite scrollt nicht.
- **Oben links**: Breadcrumb `rgba(255,253,248,.94)`, Radius 9 px, Schatten `0 1px 3px rgba(0,0,0,.15)`, Schrift 13 px / 500. Aktive Ebene `#1c1b19` / 600, Links `#2f5d4a`.
- **Oben rechts**: Suchfeld 260 px. Findet Häuser (Titel, Kürzel) und Objekte (Titel, Kategorie), max. 7 Treffer. Wahl fliegt zum Haus, markiert das Objekt mit einem pulsierenden Ring (7 s) und öffnet seine Karte.
- **Leiste unten Mitte**: Hintergrund `rgba(255,253,248,.95)`, Radius 14 px, Schatten `0 6px 24px rgba(28,27,25,.2)`, Abstand 18 px zum Rand.
  - Segment 3D/Karte, aktiv `#1c1b19` auf `#efeae0`.
  - Tageszeit-Knopf mit Farbpunkt (Morgen `#f6c48f`, Mittag `#f8d34a`, Abend `#7a6190`, Auto `#9aa2aa`) → Popup mit 4 Segmenten.
  - Filter-Knopf → Popup «Nach Kategorie filtern» mit Chips (Alle, Rechner, Quiz, Zusammenfassung, Cheatsheet, Tool, Visualisierung, jeweils mit Farbquadrat). Aktiver Filter steht auf dem Knopf.
  - Knopf «Einstellungen» `#2f5d4a`, weisse Schrift.
- **Einstellungsfenster rechts**: 380 px breit, `top/right/bottom 12px`, Radius 16 px, Schatten `0 12px 40px rgba(28,27,25,.25)`. Inhalt:
  - Tageszeit, Ansicht, Filter.
  - Ein Block «Bedienung» (Klick, ← →, Enter, Esc).
  - Für den Besitzer Links «In der Listenansicht bearbeiten» und «Zentrale-Stil».
  - Bei offenem Fenster rückt die Leiste nach links: `left: max(calc(50% − 196px), 268px)`, Übergang 0.25 s.
- **Detail** (Haus oder Objekt gewählt): Inhalte aus dem bisherigen `village-panel.tsx` (Objektliste, «Öffnen», Vorschau) im selben Fenster rechts, mit Breadcrumb-Bezug.
- Popups und Fenster schliessen mit Esc, Klick daneben oder ✕. Die Einstellungen werden in `localStorage` gespeichert (`hubdome-dorf3d-settings`).
- Link zur Listenansicht bleibt erreichbar (Barrierefreiheit). Meldung bei fehlendem WebGL bleibt.

---

## 6. Interaktion und Zustand

```ts
type Nav = { level: 'dorf' } | { level: 'quartier'; q: QuarterId } | { level: 'haus'; q?: QuarterId; h: HouseId };
type ViewerSettings = { view: '3d' | 'karte'; time: 'morgen' | 'mittag' | 'abend' | 'auto'; filter: ArtifactKind | '' };
```
- Hover → `hoverHouseId` / `hoverArtifactId` (Karte zeigen).
- Tastatur → `kbdQuarterId` / `kbdHouseId`.
- Suche und Anschlagbrett setzen ein **angeheftetes** Objekt (Karte bleibt sichtbar, Ring pulsiert). Klick auf einen Eintrag im Anschlagbrett: Zeile über `uv.y` der Trefferfläche bestimmen.
- `isNew(a) = Date.now() − Date.parse(a.created_at) < 7·24·3600·1000`. Anschlagbrett: neueste 5 neue Objekte.
- Filter wirkt ohne Neuaufbau (nur Materialfarben/Emissive: passende Objekte leuchten in Kategoriefarbe mit 0.45, andere grau `#9a9a9a`, Häuser ohne Treffer `#8d8d8d`).
- Tageszeit und Ansicht ebenfalls ohne Neuaufbau.

---

## 7. Leistung (Pflicht)

- Grundkörper-Geometrien nach Parametern cachen (`memo`), Hausmodelle pro Schlüssel cachen (`model()`).
- InstancedMesh für Hecken, Laternen (5 Meshes), Bäume, Büsche, Steine.
- Ein Atlas für alle Beschriftungen.
- Ziel bei 45 Häusern: Neuaufbau < 300 ms (Prototyp: 180–280 ms), flüssig auf Laptop.
- **Bekannter Engpass**: Objekte und Gartenteile pro Haus als eigene Meshes (~800 Draw Calls bei 32 Häusern). In der Produktion bitte pro Kategorie dorfweit zusammenführen bzw. instanzieren, Filter dann über Instanzfarbe. `window.__hubDome`-Statistik beibehalten und den Performance-Test (`tests/e2e/dorf3d.spec.ts`) auf < 250 Draw Calls bei 30 Häusern anpassen.
- `lowDetail`: kein Waldgürtel, Schatten aus, keine PointLights, Kaminrauch aus.

---

## 8. Nicht übernehmen

- Varianten aus dem Prototyp: organische Ist-Wege, Holzzaun, Steinkante, Pillen-/Karten-only-Beschriftung, Kreisplätze, andere Anordnungen (Bogen, Zeile, Doppelreihe, Locker; Kreis, Fächer, Versetzt, Flügel), Gruppierung nach Semester, «Einheitlich» / «nur Farbfamilie», Ist-Grössenstufen.
- Testdaten (`MODULES`, `EXTRA` im Prototyp) – echte Daten kommen aus Supabase.
- Prototyp-Statistik-Overlay und der Hinweistext unten links.

---

## 9. Design-Tokens (UI)

| Token | Wert |
|---|---|
| Papier / Panel | `#fffdf8`, `rgba(255,253,248,.95–.98)` |
| Fläche sekundär | `#efeae0` |
| Linie | `#e2ddd2`, `#ebe6dc`, `#d9d4c9` |
| Text | `#1c1b19`, sekundär `#3a3732`, `#6d6a63`, `#7a766d` |
| Akzent | `#2f5d4a` (aktiv hell `#e6efe9`) |
| Neu-Badge | `#fde68a` / Text `#78350f`, Fähnchen `#facc15` |
| Kategorien | Rechner `#f59e0b`, Quiz `#ec4899`, Zusammenfassung `#3b82f6`, Cheatsheet `#10b981`, Tool `#8b5cf6`, Visualisierung `#06b6d4`, Sonstiges `#9ca3af` |
| Radien | 6, 8, 9, 12, 14, 16 px, Pillen 999 px |
| Schrift | IBM Plex Sans 12.5–17 px UI; IBM Plex Mono 11–12 px Labels |

---

## 10. Vorgehen (Vorschlag für Claude Code)

1. `src/lib/fachbereiche.ts` + Tests, Migration `houses.semester`.
2. `layout.ts` / `paths.ts` portieren + Tests (SAT-Überlappung, jeder Weg startet an einer eigenen Vieleckseite, Tor senkrecht).
3. Geometrie: `paths-geometry.ts`, `decor.tsx` (Boden, Platz, Laternen, Natur, Fluss), Modelle, Hecke.
4. Labels + Atlas, Kamera/Navigation, Suche.
5. Vollbild-UI, Einstellungen entschlacken, Stil-Picker für Häuser entfernen.
6. Performance, E2E-Tests anpassen (`dorf3d.spec.ts`, `gestaltung.spec.ts`, `stile.spec.ts`).

Bei Unklarheiten das Verhalten in `referenz/dorf-viewer.js` nachlesen. Die Funktionsnamen in diesem Dokument entsprechen den Namen dort.
