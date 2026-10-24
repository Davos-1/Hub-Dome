# Phase 4h – Oberfläche «Werkbank» (Konzept)

Stand: 2026-10-24. Auftrag: `docs/design_handoff_4h/UMSETZUNGSPLAN.md` (Plan von Gian), massgebend ist der klickbare
Prototyp `docs/design_handoff_4h/prototyp.dc.html` (Markup und Logik, entpackt aus dem Artifact). Die 3D-Welt
selbst bleibt, wie sie ist; neu gestaltet wird alles rund um sie (HUD, Auswahl, Tafeln, Liste, Inventar,
Einstellungen, Reise, Bau-Modus).

## Entscheide Gian (Beginn 4h)

| Frage | Entscheid |
|---|---|
| Fokusregel | Für 4h aufgehoben (wie 4f/4g), danach gilt sie wieder bis zum Pilot-Feedback. Pilot verschiebt sich. |
| Prototyp | Artifact-Link, entpackt und im Repo abgelegt (siehe oben). |
| Checkpoints | Phasen A–E am Stück, Stopp erst am Ende. Nach jeder Phase `npm run check`, Commit, Push. |
| Offene Punkte (Plan Abschnitt 3) | Gleich mit einbauen (Handy-Ansicht ausgenommen). |

Annahmen, von Gian nicht beanstandet: Petrol ersetzt Rauchglas/Bernstein in der ganzen App (deckende Flächen, keine
Unschärfe); 8 feste Hausfarben (Spalte `houses.color` gibt es schon, Zod schränkt ein); Migrationen schreibt
Claude, einspielen und RLS-/DB-E2E laufen lassen muss Gian; Wegformen als neue Generator-Version.

## Abbildung Prototyp → Code

Der Prototyp ist 2D (Häuser als Kästchen, Zoom per CSS). In Hub Dome ist die Welt eine R3F-Szene; die Bausteine
werden so übertragen:

| Prototyp | Hub Dome |
|---|---|
| `zoom`, `pan`, `flyPatch` (Haus in die Mitte bzw. links neben die Tafel) | Kamera-Fahrt (`camera-flight.ts`) zur Pose aus `fitPose`. Der freie Ausschnitt (`Frame`) kommt neu aus einer reinen Funktion `hud/layout.ts`: Liste links, Tafel rechts, Leiste unten, Rand für die Kacheln. |
| Hausposition `scr(h)` | `ScreenProbe` in der Szene projiziert die Hülle des gewählten bzw. überfahrenen Hauses auf den Bildschirm (nur wenn sich die Kamera bewegt) und schreibt in einen eigenen kleinen Store (`overlay-store.ts`). So gleiten Sucher und Kacheln mit, ohne dass die ganze Oberfläche neu rendert. |
| `ready` nach 580 ms | Sucher und Kacheln erscheinen, wenn die erste Fahrt zum Haus fertig ist; danach bleiben sie und folgen der Kamera. Weg bei anderem Haus, Klick auf den Rasen (`onPointerMissed`) oder Esc. |
| `mode` (house/obj/new/editObj/editHouse) | `tafel` im Szenen-Store: `haus`, `objekt`, `neu`, `objektedit`, `hausedit`, neu auch `quartier` (Quartier-Übersicht, Plan Abschnitt 3 Nr. 2). |
| Tafel rechts daneben bzw. angedockt | `tafelLayout(W, H, listW)` entscheidet: Gruppe «Haus + Kacheln + Tafel» passt → nebeneinander; sonst dockt die Tafel rechts an, das Haus steht in der Mitte der Restfläche. Unter 768 px (Handy) ist die Tafel ein Blatt unten (die eigentliche Handy-Gestaltung folgt später). |
| `splitW` (Liste) | Liste liegt über der Leinwand (kein Neuaufbau der Leinwand beim Ziehen); die Kamera spart die Breite über den `Frame` aus. Breite in `localStorage`. |
| `inv` (Welt schrumpft) | Inventar fährt von unten bis 150 px unter den oberen Rand hoch; die Szene bleibt oben als Streifen sichtbar und ruht (keine Animation). |
| Wheel am Zoom-Minimum | Kamera-Abstand am Maximum der OrbitControls: weiteres Herauszoomen füllt einen Balken, bei 300 Einheiten öffnet das Inventar. |
| `say(text, snap)` + Rückgängig | Toast mit «Rückgängig». Löschen wird erst nach Ablauf (5 s) an den Server geschickt (beim Verlassen der Seite sofort); Rückgängig verwirft es. Verschieben, Kategorie, Sichtbarkeit: Rückgängig schickt die alten Werte. |
| Einstellungen, Reise (Vollbild) | Bleiben über die URL erreichbar (`?d=einstellungen&t=…`, `?d=reise`), aber als Vollbild-Bereiche statt Dialoge. |

Alte Adressen bleiben gültig: `?d=liste` öffnet die Liste, `?d=objekt&h=…` die Tafel «Neues Objekt», `?d=objektedit&o=…`
und `?d=hausedit&h=…` die Bearbeiten-Tafeln, `?d=haus` die Tafel «Haus anlegen».

## Datenmodell

| Änderung | Migration | Tests |
|---|---|---|
| `houses.quarter_override` (Fachbereich-ID, `null` = aus Modulcode) | `20261024000100_quarter_override.sql` | RLS: nur Besitzer, Prüfung gültiger IDs |
| `profiles.time_mode` (`auto` \| `fest`) | `20261024000200_time_mode.sql` | RLS: nur eigenes Profil, nur erlaubte Werte |
| Welt-Dokument: `quarterRoads`, `roadBends`, `treeMoves` | keine (jsonb), Zod + Serverprüfung | Unit/Property |
| Hausfarbe | keine (`houses.color` existiert), Zod: 8 feste Werte | Unit |

`fachbereichOf` beachtet `quarter_override`; dieselbe Funktion gilt in Browser und Server (Weltberechnung).
Beim Umzug eines Hauses fixiert der Server alle anderen Häuser an ihrem bisherigen Platz, das umziehende Haus sucht
sich im Zielquartier einen freien Platz (Regeln wie beim Anlegen).

## Abweichungen vom Prototyp (bewusst)

- **Stil der Zentrale:** sechs echte Stile als Karten statt der drei Platzhalter.
- **Profil-Menü «G»:** Angemeldet als, Einstellungen, Abmelden (statt «Beispieldaten zurücksetzen», das nur im Prototyp Sinn ergibt).
- **Dachform im Bau-Modus:** entfällt; seit 4f gilt «Dach als Material statt Form» (Entscheid 2026-10-23).
- **Vorschaubilder:** keine Bilder von fremden Servern (Datenschutz, wie README-Bilder); die Kachel zeigt Kategoriefarbe und Objektsymbol, bei GitHub/Gist die vorhandene Vorschau.
- **Platzhalter-Welt:** Der Prototyp zeichnet Häuser als Kästchen; in Hub Dome bleibt die 3D-Welt.

## Phase E: Bau-Modus als Plan, Generator v3 (umgesetzt)

| Plan | Code |
|---|---|
| `quarterMove(houses, quarterId, delta)` | `world/free-drag.ts` `quarterMove` (exakt) und `groupGhost` (Vorschau mit Einrasten) |
| `roadsForQuarter(houses, center, form, radius\|curve, bends)` | `world/roads.ts` `roadsForQuarter` (Kernweg, Bauplätze, Bereich), `smartPaths` (Intelligent), `coreSpur` (Ring/Halbkreis); geprüft in `settlement.ts` |
| `vegetationVisible(trees, houses, roads, plazas)` | `world/vegetation.ts` `vegetationCandidates` (feste Lagen) und `vegetationVisible` |
| `world_doc.quarterRoads / roadBends / treeMoves` | Felder im Welt-Dokument (`world/doc.ts`), Entwurf `world/build.ts`, Prüfung `saveWorld` |
| Generator-Version erhöhen | `GENERATOR_VERSION = 3`, Migration `20261024000300_world_v3_default.sql`; v1/v2 eingefroren (Golden-Tests) |
| Bau-Modus Plan 12a | `village/build/build-hud.tsx` (Leiste, Werkzeuge, Panel, Meldung), `build-layer.tsx` (Plan), `build-store.ts` |

Bewusste Abweichungen: Bei Ring, Halbkreis und Intelligent ordnen sich die Häuser des Quartiers um den Platz (sonst
führte der Weg durch Gärten); Wegformen gelten nur für fixierte Quartiere; die eigene Deko bleibt im Deko-Werkzeug;
Dachform bleibt Material (siehe oben).
