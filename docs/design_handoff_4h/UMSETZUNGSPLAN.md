# Hub Dome – Oberfläche um die Welt: Umsetzungsplan
Stand: 24.10.2026 · Grundlage: Repo `Davos-1/Hub-Dome` (Branch `main`), Prototyp `Hub Dome Prototyp.dc.html` Ziel: Alles rund um die 3D-Welt neu gestalten (Dialoge, Auswahlen, Felder, HUD). Die 3D-Welt selbst bleibt unverändert.

## 0. Wichtig vor dem Start
- **Fokusregel im Repo:** `CLAUDE.md` sagt, bis zum Pilot-Feedback gelten nur noch Fehlerbehebungen, Performance und Barrierefreiheit. Diese Neugestaltung ist ein grösserer UI-Umbau. Vor dem Start bewusst entscheiden und in `docs/ENTSCHEIDUNGEN.md` festhalten: entweder Fokusregel für die UI aufheben (wie bei 4f/4g) oder Umbau nach dem Pilot als eigene Phase («Phase 7 Oberfläche»).
- **Projektregeln bleiben:** UI-Texte Deutsch (Schweiz, kein ß), Farben/Radien/Schatten nur über Tokens `--hd-*`, Eingaben mit Zod, neue Tabellen mit RLS und Tests, Kontrasttest `src/app/theme-contrast.test.ts` muss grün bleiben, vor jedem Commit `npm run check`.
- **Weltregel bleibt:** Nichts durchdringt sich, schwebt oder steht auf Wegen. Neue Platzierungslogik (Quartier umziehen, Wegformen, Bäume ausweichen) als reine Funktionen in `src/lib/world/` mit Property-Tests, Layout-Änderungen als neue Generator-Version (v1/v2 eingefroren, Golden-Test).

## 1. Festgelegte Gestaltung (alle Entscheide)
| Bereich | Entscheid |
|---|---|
| Grundrichtung | Werkbank-Familie, dunkel, «Tafel am Ort» (2c): keine festen Leisten, Bearbeiten direkt am Haus |
| Akzent | Petrol `#0b5c63`, Linien/Text auf dunkel aufgehellt (`--accLine`, `--accText`), Schrift auf Petrol automatisch hell |
| Fläche | dunkel |
| Ecken | weich |
| Scrollbalken | versteckt |
| Boxen | «Verlauf»: oben dunkles Petrol, nach unten ins Neutrale; **kein** schmaler Farbstrich links mehr |
| Hausauswahl | «Sucher»: vier Ecken um das Haus, ohne Namenspille |
| Kacheln am Haus | 86 × 72 px oben/rechts/unten/links: Öffnen (mit Zähler), Objekt (Petrol gefüllt), Bearbeiten, Liste |
| Auftritt | Rahmen und Kacheln erst nach dem Anflug (≈0,6 s), danach bleiben sie stehen und gleiten mit; weg nur bei anderem Haus, Rasen-Klick oder Esc |
| Verbindungslinie | aus |
| Info-Menge | ausführlich |
| Leiste unten | «Schalter»: 3D/Karte als Kippschalter, Tageszeit als farbiger Knopf (Hintergrund = Tageszeitfarbe), dazu Symbol-Knöpfe Reise (Kompass, mit Anfragen-Zähler) und Einstellungen (Regler) |
| Zoomregler | rechts, 50 % durchsichtig, beim Darüberfahren voll |
| Griff links | «Punkte» |
| Inventar-Kacheln | «Vorschau» |
| Liste | «Baum» |


## 2. Bildschirme und Abläufe (im Prototyp fertig)

### 2.1 Welt-HUD
- Brotkrumen oben links (Dorf › Quartier › Haus), kürzt das Quartier zuerst.
- Oben rechts: Liste (L), Inventar (I), Bauen (B), Profil «G» (Name, Beispieldaten zurücksetzen).
- Unten Mitte: Leiste (siehe oben). Ausgeblendet, solange eine Tafel offen ist.
- Rechts: Zoomregler mit Ende «INV».
- Hinweis-Karte beim ersten Besuch (drei Sätze, «Verstanden»).
- Hover über Haus: Tooltip (Quartier, Semester, Objekte, neu, geöffnet).

### 2.2 Hausauswahl und Tafeln
- Klick aufs Haus: Kamera fliegt hin (Haus mittig), dann Sucher + Kacheln.
- Öffnen/Objekt/Bearbeiten: Ansicht schiebt nach links, Tafel rechts daneben; zu wenig Platz → Tafel dockt rechts an.
- **Öffnen (7b):** Galerie 2-spaltig, Vorschaubild, Kategorie-Streifen, «neu», Klick öffnet Objekt; Kennzahlen oben.
- **Objekt (8c + 8e):** drei Schritte Link → Einordnen → Freigabe; darüber Vorschau-Karte, Klick auf Titel/Kategorie/Haus/Sichtbarkeit springt zum Schritt. Neu: geführt mit Prüfung (https, Titel). Bearbeiten: startet bei Schritt 2, frei springen, jederzeit speichern, Löschen mit Rückgängig.
- **Bearbeiten Haus (9b):** Miniatur-Vorschau (Titel, Farbe, Quartier, Semester live), 8 feste Farben, Quartierwahl, Semester 1–8; Löschen (Haus + Objekte) mit Rückgängig.
- **Quartier umziehen:** Haus sucht im Zielquartier einen freien Platz (Abstand zu allen Häusern), Kamera fliegt mit.

### 2.3 Liste (Griff links, Taste L)
- Baum Quartier › Haus › Objekt, Suche, Sortierung (eigene / Name / zuletzt), Ziehen zum Umsortieren und Verschieben, + Objekt pro Haus.
- Gewählte Zeile hebt das Objekt in der Welt hervor; Haus wandert in die Mitte der freien 3D-Fläche.

### 2.4 Inventar (Herauszoomen bis Anschlag, Taste I)
- Welt schrumpft zum Streifen, Inventar fährt hoch. Nie gleichzeitig mit der Liste.
- Filter Häuser/Zustand (neu, nie geöffnet, nur ich, ohne Beschreibung), Gruppierung nach Haus/Kategorie, Mehrfachauswahl → Verschieben, Kategorie, Sichtbarkeit, Löschen (mit Rückgängig), Ziehen zwischen Gruppen, Doppelklick zeigt im Dorf.

### 2.5 Einstellungen (Vollbild, 10a)
- Navigation links, gewählter Bereich vollflächig Petrol.
- Profil: Anzeigename, Abmelden.
- Dorf: Landschaft (Seed, «Welt neu würfeln …» mit Vorschau und doppelter Bestätigung), Stil der Zentrale (3 Karten), Topdorf, **Tageszeit Auto/Fest** (zurückgeholt).
- Claude: Token erzeugen (URL nur einmal sichtbar, Kopieren), Token-Liste mit Widerrufen, Anleitung 4 Schritte, Skill-Download.
- Konto: Löschen mit Bestätigung per Benutzername.

### 2.6 Reise & Freunde (Inselkarte, 11c)
- Freundesdörfer als Inseln um das eigene, Nähe = Aktivität, kollisionsfrei verteilt.
- Klick: Tafel (Häuser, Objekte, neu für dich), «Hinreisen» → Besuchsmodus mit Band oben, am Haus nur Öffnen + Liste, «Zurück in mein Dorf».
- Anfragen annehmen/ablehnen, Freund per Benutzername einladen, Freundschaftslink mit Anzahl Personen.

### 2.7 Bau-Modus (Plan, 12a)
- Welt wird Plan mit Raster, Quartiere als Flächen mit Griff, gewähltes Quartier immer in Bildmitte.
- Werkzeuge: Wählen, Haus (nur Häuser), Quartier (Haus ziehen bewegt Quartier), Weg (Eckpunkte setzen/ziehen/Doppelklick entfernt), Deko (nur Seed-Bäume versetzen).
- Bewegungsraum gestrichelt, grösser als heute; zu nah → zurückgesetzt mit Hinweis.
- Wegformen pro Quartier: **Intelligent** (kürzester geschwungener Weg zum Platz, nahe Wege vereinen sich, Regler «Kurve»), Ring, Halbkreis, Gasse (Regler «Radius»).
- Bäume weichen Häusern, Wegen und Plätzen aus und kommen am gleichen Ort zurück, sobald frei.
- Rückgängig/Wiederholen (Strg+Z/Y) für Häuser, Abbrechen verwirft, Speichern übernimmt.

## 3. Noch offen (Gestaltung)
| # | Bereich | Vorgehen | Bemerkung |
|---|---|---|---|
| 1 | Haus anlegen | direkt in Prototyp | Modul aus Katalog (Suche, nach Fachbereich gruppiert) oder Thema; Vorschau wie 9b; landet als Baustelle im Quartier |
| 2 | Suche ⌘K + Quartier-Ansicht | direkt | Befehlspalette (Häuser, Objekte, Befehle); Quartier anklicken → Übersicht der Häuser |
| 3 | Fremde Objekte übernehmen | direkt | im Besuchsmodus Kachel «In mein Dorf» mit Hausvorschlag (gleiches Modul) |
| 4 | Leere Zustände, Laden, Fehler | direkt | Baustelle, leere Liste/Inventar, keine Freunde, Ladebalken beim Reisen, Fehlermeldungen in Tafeln |
| 5 | Kategorie-Filter in der Welt | direkt | zurückgeholt: Chips in der Leiste unten oder im Zoomregler-Bereich, blendet andere Tafeln ab |
| 6 | Login, Onboarding, Start | direkt | gleiche Box-Art «Verlauf», Petrol, Himmel mit Welt-Silhouette |
| 7 | Rückgängig für Eckpunkte/Bäume | direkt | in den Bau-Verlauf aufnehmen |
| 8 | Handy-Ansicht | später | Tafeln als Blatt unten, Kacheln als Leiste |
| 9 | Design-Tokens `globals.css` | zum Schluss | siehe Abschnitt 5 |

Bewusst weggelassen: manueller Objekttyp, Tags.

## 4. Technische Umsetzung im Repo (Vorschlag, Reihenfolge)

### Phase A – Tokens und Grundbausteine
1. `src/app/globals.css`: neue Tokens (Abschnitt 5), alte Namen als Aliase lassen, Kontrasttest erweitern.
2. Neue Box-Komponente `src/components/ui/panel.tsx` (Verlauf-Kopf, Kicker, Titel, Untertitel, Schliessen) ersetzt `.hd-plank`/`hd-panel`-Kopf in `dialog-shell.tsx`, `side-window.tsx`, `display-popup.tsx`.
3. Kleine Bausteine: `Chip`, `Segment`, `Toggle`, `Stepper`, `ColorSwatches` (8 feste Farben), `IconButton` (Kompass, Regler).

### Phase B – Hausauswahl und Tafeln (ersetzt `side-window.tsx`)
1. `src/components/village/hud/selection.tsx`: Sucher-Ecken + 4 Kacheln, Positionen aus Kamera-Projektion (Haus-Bildschirmposition), Einblendung nach Ende des Kamera-Flugs (`camera-flight.ts` Ereignis «angekommen»).
2. `camera-poses.ts`: neue Pose «Haus mit Tafel rechts» (Haus links verschoben) und «Haus in freier Fläche neben Liste».
3. `src/components/world/tafel/` mit `house-gallery.tsx` (7b), `object-steps.tsx` (8c+8e, ersetzt `artifact-form.tsx`), `house-edit.tsx` (9b, ersetzt Teile von `add-dialogs.tsx`).
4. Server Actions bleiben (`createArtifact`, `updateArtifact`, `updateHouse` …); Zod-Schemas unverändert, Farbe auf 8 feste Werte einschränken.

### Phase C – Liste und Inventar
1. `list-dialog.tsx` → seitliche Liste mit Griff (`src/components/village/hud/list-panel.tsx`), Breite in `localStorage`.
2. Neues `inventory.tsx` (Vollbild, Zoom-Übergang), Massenaktionen als neue Server Actions mit RLS-Tests (`bulkMoveArtifacts`, `bulkSetVisibility`, `bulkSetKind`, `bulkDelete`).
3. Zoom-Grenze in `camera-rig.tsx`: Überscrollen am Minimum öffnet Inventar.

### Phase D – Vollbild-Bereiche
1. `settings-dialog.tsx` → `settings-screen.tsx` (10a).
2. `travel-dialog.tsx` → `travel-map.tsx` (11c), Aktivität aus `shell-data.ts` (letzte Änderung).
3. Besuchsband ersetzt `welcome-banner.tsx`, Neu-würfeln-Vorschau übernimmt Logik aus `reroll-banner.tsx`.
4. Tageszeit «Auto»: `daytime.ts` erweitern.

### Phase E – Bau-Modus
1. `build-panel.tsx` neu als Plan-Ansicht + Werkzeugleiste + rechtes Panel.
2. Neue reine Funktionen in `src/lib/world/` mit Property-Tests:
  - `quarterMove(houses, quarterId, delta)` mit Kollisionsprüfung,
  - `roadsForQuarter(houses, center, form, radius|curve, bends)` → Polylinien (Intelligent: kürzester Weg, Verschmelzen nahe Wege),
  - `vegetationVisible(trees, houses, roads, plazas)` → Baum sichtbar/verdeckt, Position bleibt im Seed.
3. Generator-Version erhöhen (Wegformen), v1/v2 eingefroren.

### Datenmodell (neue Spalten, je mit Migration, RLS, Tests)
- `houses.quarter_override` (Fachbereich-ID, null = aus Modulcode) – erlaubt Quartierwahl in 9b.
- `villages.world_doc` erweitern um `quarterRoads { form, radius, curve }`, `roadBends { houseId: {x,y} }`, `treeMoves { index: {x,y} }`.
- `profiles.time_mode` (`auto` | `fest`).

## 5. Design-Tokens (Entwurf für `globals.css`)
```css
:root {
  --hd-surface: #161719;          /* Tafeln, Leisten */
  --hd-raised: #1f2023;           /* Karten, Zeilen */
  --hd-field: #0f1012;            /* Eingabefelder */
  --hd-line: #2a2b2f;
  --hd-chip: #2a2b2f;
  --hd-ink: #f2f2f3;
  --hd-ink-2: #d4d4d8;
  --hd-muted: #a1a1aa;
  --hd-faint: #8b8c92;
  --hd-accent: #0b5c63;           /* Petrol */
  --hd-accent-ink: #f4fbfb;       /* Schrift auf Petrol */
  --hd-accent-line: color-mix(in oklab, #0b5c63 62%, #fff);
  --hd-accent-text: color-mix(in oklab, #0b5c63 55%, #fff);
  --hd-accent-soft: rgba(11, 92, 99, .18);
  --hd-danger: #ffa89d;
  --hd-box-head: linear-gradient(180deg, color-mix(in srgb, #0b5c63 40%, #161719) 0%, #161719 52%);
  --hd-radius-panel: 14px;
  --hd-radius-ctl: 9px;
  --hd-shadow-panel: 0 24px 60px rgba(0, 0, 0, .5);
  --hd-time-morgen: #f7c873;
  --hd-time-mittag: #fff1b8;
  --hd-time-abend: #f08a4b;
  --hd-time-nacht: #7d8bd6;
}
```
Kontrasttest um Petrol-Paare ergänzen (Schrift auf Petrol, Petrol-Text auf Fläche).

## 6. Abnahme (pro Phase)
- `npm run check` grün, E2E angepasst (`bauen.spec.ts`, `welt.spec.ts`, `freigabe.spec.ts`, `objekttypen.spec.ts`).
- Tastatur: Esc schliesst von innen nach aussen, L/I/B, Tab-Reihenfolge in Tafeln, Fokus zurück zum Auslöser.
- Keine Überlappungen bei 924 × 540 und 1440 × 900 (Tafel, Kacheln, Leiste, Zoomregler).
- Weltregel: Property-Tests für Umzug, Wege, Bäume.
- Visuelle Matrix (`playwright.visual.config.ts`) neu aufnehmen.

## 7. Dateien in diesem Projekt
- `Hub Dome Prototyp.dc.html` – klickbarer Gesamtprototyp (massgebend)
- `Hausauswahl Varianten.dc.html` – 5a–5e, 6a (gewählt: 6a)
- `Popup Varianten.dc.html` – 7a–9e (gewählt: 7b, 8c+8e, 9b)
- `Bereiche Varianten.dc.html` – 10a–12c (gewählt: 10a, 11c, 12a)
- `Box-Markierung Varianten.dc.html` – 13a–13f (gewählt im Prototyp: «Verlauf» = 13f)
- `Hub Dome UI.dc.html` – Runden 1–3 (Richtungen, Werkbank-Varianten, Gesamtübersicht)
