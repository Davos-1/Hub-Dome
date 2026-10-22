# Phase 4b – Gestaltung: Wege, Stile, Umgebung, eigene Modelle (entfernt)

> **Teilweise Historie (Stand 2026-10-22):** Die Haus-Stile (Etappe B) sind durch die Haustypen pro Fachbereich aus dem Design-Handoff ersetzt, die eigenen Modelle (Etappe E) sind entfernt. Gültig bleiben die Wege (A), die Zentrale-Stile (C) und die Umgebung (D). Die Ideen unter «Später möglich» kommen erst nach dem Pilot (Fokusregel in `docs/PHASENPLAN.md`). Eine Tageszeit-Einstellung gibt es bereits.

Ergänzt `PLAN.md` Abschnitt 7. Quelle: Wünsche von Gian nach der ersten 3D-Abnahme (2026-10-21).
Alle Änderungen sind additiv. Neue DB-Spalten haben Standardwerte, bestehende Dörfer bleiben gültig.

## Etappen

| Etappe | Inhalt | Abnahme |
|---|---|---|
| A | Organische Wege (mehrere Varianten, berühren sich nicht) | Unit-Tests: kein Weg berührt einen anderen oder ein fremdes Haus |
| B | Haus-Stile (einmal pro Dorf wählbar) inkl. Bauzustand und Wachstum je Stil | Jeder Stil in 3 Stufen + Baustelle sichtbar; Auswahl mit Live-Vorschau |
| C | Zentrale-Stile (Rathaus, Schule, Hochhaus, Villa, Marskuppel, Leuchtturm) | Auswahl mit Live-Vorschau |
| D | Lebendige Umgebung (Fluss, Teich, Tiere, Dorfbewohner, Wolken, Windmühle …) | Läuft flüssig, bei «reduzierte Bewegung» steht alles still |
| E | ~~Eigene 3D-Modelle für die Zentrale (GLB-Upload)~~ – am 2026-10-22 wieder entfernt (Missbrauchsrisiko, siehe ENTSCHEIDUNGEN) | Limits greifen, fremder User ohne Freigabe erhält keine URL, Modell wird nur bei Bedarf geladen |

## Entscheidungen

- **Stil-Wahl pro Dorf**, nicht pro Haus: Spalte `villages.house_style` (gilt für alle Modul- und Themenhäuser) und `villages.zentrale_style`. Die Zentrale hat einen eigenen Stil.
- **Haus-Stile:** `haus` (einfaches Haus), `blockhuette`, `marskuppel`, `werkstatt`, `tinyhaus`, `baumhaus`.
- **Zentrale-Stile:** `rathaus`, `schule`, `hochhaus`, `villa`, `marskuppel`, `leuchtturm`; `custom` (eigenes Modell) entfällt seit 2026-10-22.
- **Wachstum:** Jeder Haus-Stil hat drei Stufen (0–2, 3–6, 7+ Objekte) und eine eigene Baustelle (Gerüst, Kran plus Rohbau passend zum Stil: Baumstämme, Kuppelrippen, Stahlrahmen, Fahrgestell, Plattform).
- **Wege:** Jeder Weg ist eine Kurve von der Zentrale zur Haustür, in Form und Belag (Sand, Kies, Platten, Trittsteine) pro Haus unterschiedlich, aber deterministisch. Die Auslenkung wird so lange halbiert, bis der Weg keinen anderen Weg und kein fremdes Haus berührt.
- **Eigene Modelle (entfernt am 2026-10-22, nur noch Historie):** Dateiformat **glTF Binary (`.glb`)**. Limits: 5 MB, 60 000 Dreiecke, max. 4 Texturen, keine externen Verweise. Es wird nichts ausgeführt (nur Daten). Speicherung in einem **privaten** Supabase-Storage-Bucket, Zugriff nur über kurzlebige signierte URLs nach RLS-Prüfung. Das Modell wird erst geladen, wenn das Dorf mit Stil `custom` geöffnet wird, auf die Dorfgrösse skaliert, und beim Verlassen freigegeben (`dispose`). Solange es lädt (oder bei einem Fehler), zeigt die Szene den Standard-Stil.
- **Leben in der Szene:** Animationen laufen mit begrenzter Bildrate (30 fps, Mobile 20 fps) und nur, wenn der Tab sichtbar ist und keine reduzierte Bewegung gewünscht ist. Tiere und Figuren sind instanziert; Bewegungen werden aus der Zeit berechnet (kein Zustand).

## Vorschläge für die Umgebung (Auswahl, in Etappe D umgesetzt: ★)

- ★ **Fluss** mit Holzbrücke am Dorfrand, Wasser mit sanfter Bewegung, Schilf und Steinen am Ufer
- ★ **Teich** mit Enten, Seerosen und Schilf
- ★ **Weide** mit Zaun und Schafen, die langsam umherlaufen und grasen
- ★ **Hühner** auf Spurensuche in der Nähe eines Hauses
- ★ **Dorfbewohner**, die auf den Wegen zwischen Zentrale und Häusern laufen (mehr Häuser, mehr Betrieb)
- ★ **Vögel**, die hoch über dem Dorf kreisen; **Schmetterlinge** über den Blumen
- ★ **Wolken**, die langsam ziehen
- ★ **Windmühle** mit drehenden Flügeln am Dorfrand
- ★ **Kaminrauch**, der aufsteigt
- Später möglich: Tag-Nacht-Rhythmus mit leuchtenden Fenstern, Jahreszeiten (Laub, Schnee), Marktstand auf dem Dorfplatz, Lagerfeuer, Gemüsegärten, Heuballen, Nebel am Morgen, Katze auf dem Dach, Fische im Teich, Leuchtkäfer in der Nacht
