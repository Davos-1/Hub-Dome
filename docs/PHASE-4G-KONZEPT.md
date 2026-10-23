# Phase 4g – Feinschliff der Welt (Konzept, Etappe 0)

Stand: 2026-10-23. Grundlage: Gians Feedback P1–P7 (Auftrag «Phase 4g»), Annahmen A1–A6. Entscheid Gian zum Ablauf: Etappen 0–4 am Stück, **Stopp nur bei der Stilwahl der Oberfläche** (Etappe 5, Richtung «dunkles Glas»), Commit und Push pro Etappe auf den Arbeitsbranch.

## 1. Ist-Zustand (gemessen)

| Thema | Befund (Generator v1, 50 Seeds bzw. Messpfad) |
|---|---|
| Vielfalt (P4) | 4 Landschaften × 4 Stimmungen = 16 Kombinationen; Fluss immer 70–84 m von der Mitte (ausserhalb des Dorfs, ≈ 50 m), See 99–105 m, Hügel 3.7–5.9 m, Bäume 360–417 je Welt. Teich 80 %, Weide 90 %, Mühle 84 %, Obstgarten 46 %: fast jede Welt hat dieselben Merkmale. Brücken 0–1. |
| Kamera (P3) | 0.9–1.5 s, kubisches Ease, Blick-Vorlauf 1.6: Blick dreht bis **239°/s**, Drehbeschleunigung bis **2645°/s²**, Kamera bis 5.7 Abstände pro Sekunde («hektisch»). |
| Zentrale (P5) | Pose wie ein Haus (Kamera 8.7 m hoch, 12.6 m davor): Leuchtturm (14.9 m) und Hochhaus (15.4 m) werden oben abgeschnitten, Hochformat nur pauschal weiter weg. |
| Wege (P7) | Band mit 9 Spalten, eine Kies-Textur (512 px auf 1.4 m), Farbe nur über Vertexfarben; kein Randstein, keine Randpflanzen, Häuser ohne Stichweg (0.4 m Graslücke zum Tor). |
| UI (P6) | 173 harte Farbwerte in 24 Komponenten (`[#…]`), Holzbretter-Kopf, Pergament, Giftgrün; Tokens nur teilweise (`--hd-*`). |
| Hintergrund (P2) | Boden endet als Quadrat (±(rFlat+90) m) im Nebel; dahinter nur Himmelsverlauf. |

Bilder: Kontaktbogen `kontaktbogen-vorher.png`, Basis-Aufnahmen (Zentrale je Stil, Wegnahaufnahme, Panorama, Mobile) liegen im Arbeitsordner und werden im Bericht verlinkt.

## 2. Kamera (P3, P5) – Etappe 1

- **Fahrt als reine Funktion** `src/lib/camera-flight.ts` (`planFlight`, `measureFlight`): Bogen um das neue Ziel bleibt; Abstand ändert sich logarithmisch; Ease = Smootherstep (Geschwindigkeit und Beschleunigung an beiden Enden 0); Blick-Vorlauf 1.3. Dauer `2.0 + 0.6·Drehung/π + 0.3·log2(1 + Weg/30)`, begrenzt auf 2.0–3.2 s. Gleiche Fahrt für Dorf, Quartier, Haus, Zentrale, Karte und zurück; `prefers-reduced-motion` springt.
- **Grenzen im Test** (60 Bilder/s abgetastet): Drehrate ≤ 90°/s, Drehbeschleunigung ≤ 250°/s², kein Sprung > 5 % des Abstands pro Bild, Dauer im Band. Erste Messung: ≤ 65°/s, ≤ 155°/s².
- **Hüllbox statt Schätzung:** Die Szene misst das tatsächliche Modell (Zentrale je Stil samt Terrasse, Objektring, Figur; Häuser je Typ und Stufe) und gibt die Hüllbox an `poseFor(…, { aspect, hullOf })`. `fitPose` sucht entlang der Blickrichtung den kleinsten Abstand, bei dem alle 8 Ecken mit 12 % Rand im Bild liegen (FOV 45°, echtes Seitenverhältnis, Hochformat inklusive). Test: 6 Stile × Desktop/Hochformat × mit/ohne Ring; dieselbe Prüfung für alle Haustypen (nie angeschnitten).

## 3. Landschaft und Seed v2 (P4) – Etappe 2

- **`GENERATOR_VERSION = 2`**, `SUPPORTED_VERSIONS = [1, 2]`. v1 bleibt unverändert (Golden-Test mit Fingerabdruck von 6 Welten); `generateWorld` wählt Karte und Siedlung nach Version. Bestehende Dörfer bleiben v1; «Welt neu würfeln» erzeugt v2; zusätzlich «Auf neue Welt-Version aktualisieren» (gleicher Seed, Vorschau wie beim Würfeln, Bestätigung). Keine Migration nötig: `generator_version` ist schon eine Spalte.
- **Landschaftstypen v2** (gewichtet): *Flussdorf* (Fluss quert das Dorf, nächster Punkt 30–46 m), *Flussgabel* (Insel zwischen zwei Armen), *Bergsee* (See 55–72 m mit Zufluss durchs Dorf), *Bucht* (Küstenlinie 52–64 m mit Strand), *Hochplateau* (kleinere flache Zone, Felskanten, Bach mit Wasserfall am Rand), *Bachtal* (Bach 22–34 m, Terrassenfelder am Hang), *Hügelland* (höhere Hügel, Felsen, Teich).
- **Kontinuierliche Parameter** statt fester Varianten: Flussbreite 4.5–7 m, Mäander (Amplitude, Wellenlänge), Hügelhöhe 2–8 m, Waldanteil, Felsanteil, Merkmalsdichte, Farbton von Licht und Gras (± wenige Prozent). Stimmungen bleiben vier, jede mit Tönung.
- **Fluss präsent:** breiter, sichtbar im Dorfbild, mehrere Brücken (jede Gasse, die ihn quert, plus Wanderweg; Holz bei schmalem, Steinbogen bei breitem Wasser), Ufer mit Weiden, Schilf, Steinen, Sandbänken, Stegen, Booten; Strömungs- und Schaumlinien, Glanz bei Tag, Lichter am Wasser bei Nacht. Die Siedlung weicht aus (Landschaft hängt nur vom Seed ab).
- **Seed-Objekte:** jede Welt erhält 4–7 aus dem Katalog (gewichtet, ohne Zurücklegen, passend zur Landschaft): Wasserrad an der Mühle, Fähre, Wehr, Fischerhütte mit Steg, Picknickplatz am Wasser, Ruderboot, Kapelle, Steinkreis, Heuhaufen, Holzlager, Bienenstöcke, Vogelscheuche, Wegkreuz, Findlinge, Baum mit Schaukel, kleine Ruine, Weinberg/Terrassen. Jedes Objekt hat eine Grundfläche (Art «merkmal», mit Grund für das rote Geisterbild) und ein prozedurales Modell, das in ihr bleibt (Test).
- **Messen:** Kapazität (Ziel weiterhin 99–100 % bis 40 Häuser), Vielfalt (Histogramm, Anteil verschiedener Kombinationen, Abstand der Merkmalsvektoren), Kontaktbogen vorher/nachher.

## 4. Hintergrund (P2) – Etappe 3

- **Technik:** drei Ringe aus Höhenprofilen (Seed: Frequenzen, Phasen, Gipfel), 380 m / 520 m / 700 m, ein Mesh mit Vertexfarben und eigener Luftperspektive (Shader-Erweiterung: Farbe Richtung Horizontfarbe der Tageszeit, nach hinten heller und bläulicher; Szenen-Nebel wirkt dort nicht). Wald: instanzierte Low-Poly-Bäume auf dem vorderen Ring (Nadel/Laub nach Stimmung), Felsflächen über Steilheit, Schnee über der Höhengrenze bei «Alpin». Der Boden der Karte wird zu einer runden Scheibe, deren Rand unter dem vorderen Ring liegt (keine Kante, kein Loch).
- **Budget:** ≤ 100 000 Dreiecke und ≤ 8 Draw Calls (Desktop), ≤ 25 000 auf Mobile (weniger Segmente und Bäume). Gemessen über `__hubDome` mit und ohne Hintergrund.
- **Gewählte Ideen (4):** ferne **Alpweide mit Sennhütte** und winzigen Kühen (Rauch aus dem Kamin), **Wasserfall** an einer Felswand des vorderen Rings, **Kapelle** auf einem Vorhügel (nachts ein warmes Fenster), **Nebelbänder** im Tal am Morgen. Grund: passen zur Schweiz und zu den Stimmungen, bleiben ruhig und klein; Seilbahn, Zug, Ballon und Windräder bringen Bewegung ins Bild, die mit der Szene konkurriert. Nachts: dunkle Silhouetten, Mondlicht, wenige Lichter. Bewegtes langsam, bei `prefers-reduced-motion` still.

## 5. Freie Häuser und Wege (P1, P7) – Etappe 4 (nur Generator v2)

- **Quartierfläche:** Punkte, deren nächste Achse *aller neun* Ausgänge (auch unbenutzter) eine Gasse des eigenen Quartiers ist, höchstens 18.5 m vom eigenen Rückgrat (zweite Reihe passt), nicht zwischen Dorfplatz und Quartierplatz, ausserhalb Dorfplatz, Wasser und Merkmale; die Korridore aller neun Achsen bleiben frei (wie v1). *Umsetzung abweichend vom ersten Entwurf («nächste belegte Achse», 14 m):* Die feste Aufteilung hängt nicht davon ab, welche Gassen später dazukommen; sonst könnte eine neue Gasse eine gespeicherte freie Lage ungültig machen und ein Haus beim Laden verschieben.
- **Datenmodell:** `haeuser[id]` darf neu `{ r, x, z }` sein (Gasse und Koordinate der Hausmitte, 0.01 m). `{ r, s }` (Slot) bleibt gültig und wird in v2 beim Laden über die Slot-Lage in Koordinaten übersetzt (verlustfrei; ungültig → wie bisher Automatik und Hinweis). Keine Migration (JSON-Spalte, Zod-Schema erweitert).
- **Ausrichtung automatisch:** Front quer zum Rückgrat an der nächsten Stelle, Tor zum Weg. Kein freies Drehen (einfacher, Wege bleiben logisch).
- **Einrasten:** in Rückgrat-Koordinaten (Länge t, Abstand d) auf 0.5 m; Magnet an Nachbarn derselben Seite (gleicher Abstand d, Standardlücke 1.4 m), höchstens 2 m vom Zeiger. Ungültig → nächste gültige Stelle bis 3 m (grün, «eingerastet»), sonst rot mit Grund. Gespeichert und geprüft wird die auf 1 cm gerundete Lage (Browser und Server prüfen dieselbe Zahl).
- **Reihenfolge egal:** Beim Laden kommen zuerst Bauplätze, dann freie Lagen; alle Prüfungen zwischen Grundstück, Stichweg und Gasse sind in beide Richtungen gleich streng (0.3 m), damit eine gespeicherte Welt in jeder Reihenfolge der Schlüssel (die Datenbank sortiert sie um) gleich aufgebaut wird (Test).
- **Automatik für neue Häuser:** wie v1 (Quartierplatz links/rechts, dann die Gasse hinaus), deterministisch, zuletzt gesetzt; verschiebt nie Bestehendes.
- **Quartier verschieben:** Griff am Quartierplatz → «Quartier verschieben». Verschiebt alle Häuser des Quartiers (samt Garten) und die eigene Deko in der Quartierfläche um denselben Vektor. Dorfplatz-Ausgang, Quartierplatz und Gassenachse bleiben fix; nur Stichwege und die gebaute Länge des Rückgrats passen sich an. Zulässig nur, wenn **jedes** Element gültig bleibt; sonst rastet die Gruppe auf die nächste gültige Verschiebung ein oder zeigt rot mit dem Grund des ersten Elements («stösst an den Fluss»). Kein Drehen der Gruppe (Entscheid: einfache Bedienung, Ausrichtung bleibt automatisch).
- **Wege v2:** Rückgrat je Quartier = Zuweg (Dorfplatz → Quartierplatz) + Gasse (Achse aus dem Seed, gebaut bis hinter das äusserste Haus). **Stichweg** je Haus vom Tor gerade zum Rückgrat (1.1 m breit, auch 0.4 m lange Stummel, damit kein Grasspalt bleibt). Stichwege sind Wege im Register (nichts darf darauf), kreuzen kein Grundstück, keine Deko, kein Wasser. Beim Verschieben eines Hauses ändert sich nur sein Stichweg. Gleiche Logik im Browser (Vorschau) und auf dem Server (Speichern).
- **Invarianten (Tests):** jedes Haus hat genau einen Weg (Stichweg trifft das Rückgrat); Wege schneiden kein Grundstück ausser am eigenen Tor; Breite je Wegtyp konstant; Einmündungen ausgerundet; kein Spalt zwischen Stichweg, Tor und Rückgrat. Property-Tests: zufällige Ziehbewegungen enden gültig oder abgewiesen; Gruppenverschiebung; Kapazität.
- **Wegoberfläche (alle Versionen, reine Darstellung):** feineres Band (0.15 m Abtastung, geglättete Kurven), je Wegtyp ein eigenes Mesh mit Längs-UV und eigener Textur (Kopfsteinpflaster für Zuwege, je Quartier Kies/Pflaster/Platten für Gassen, Trittplatten für Stichwege, Erde für Pfade), Variation über zweite Textur-Skala und Vertex-Rauschen (keine sichtbare Wiederholung), Randsteine bei Pflaster, Randgras und Steinchen als Instanzen, leichte Kantenschattierung. Höchstens 6 zusätzliche Draw Calls.

## 6. Oberfläche (P6) – Etappe 5

Design-Tokens als CSS-Variablen (`--hd-surface-*`, `--hd-ink-*`, `--hd-accent-*`, `--hd-line`, `--hd-radius-*`, `--hd-shadow-*`, `--hd-blur`, `--hd-motion-*`), Varianten als `data-hd-theme` am Wurzelelement. Alle Klassen (`hd-btn`, `hd-card`, `hd-input`, `hd-plank` …) und die 173 harten Werte werden auf Tokens umgestellt. Drei Varianten in Gians Richtung «dunkles Glas» (z. B. *Nachtglas* tintenblau, *Waldglas* tiefgrün, *Rauchglas* neutral mit Bernstein-Akzent), Screenshots (Start-Dialog, Haus-Fenster, Leiste, Bau-Leiste; Tag/Nacht; Desktop/Mobile) mit Kontrastmessung (WCAG AA) → **Stopp für Gians Wahl** → umsetzen.

## 7. Aufwand (relativ) und Reihenfolge

Etappe 1 Kamera ≈ 10 % · 2 Landschaft v2 ≈ 30 % · 3 Hintergrund ≈ 15 % · 4 Freie Häuser und Wege ≈ 30 % · 5 UI ≈ 10 % · 6 Abschluss ≈ 5 %. Subagenten (Sonnet) bekommen klar umrissene Teile (Modelle der Seed-Objekte und Hintergrund-Wahrzeichen, Wegtexturen, Umstellung der Farbwerte auf Tokens); Architektur, Regeln, Generator, Kamera und jede Abnahme bleiben bei Opus.

## 8. Offene Fragen (nicht blockierend, Vorschlag in Klammern)

1. Freies Ziehen nur für Dörfer auf Generator v2; v1-Dörfer behalten «Umsetzen auf freie Plätze», bis der Besitzer aktualisiert (ja, A3).
2. Häuser drehen sich automatisch zum Rückgrat, kein manuelles Drehen; die Gruppe wird nur verschoben, nicht gedreht (ja).
3. Beim Aktualisieren auf v2 bleiben Deko und Varianten; Hausplätze werden übersetzt, was nicht passt, setzt die Automatik (ja, Vorschau zeigt die Anzahl).
4. Die neue Wegoberfläche, die Kamera und der Hintergrund gelten sofort für alle Dörfer (reine Darstellung, A4) (ja).
5. Wer v2 nicht will, kann nicht zurück auf v1 (ja; Würfeln erzeugt immer die aktuelle Version).
