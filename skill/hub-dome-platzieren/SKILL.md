---
name: hub-dome-platzieren
description: IMMER verwenden, sobald in einem Chat ein Artifact erstellt oder veröffentlicht wurde (oder ein GitHub-Repo bzw. Gist entstanden ist) und der Hub-Dome-Connector verfügbar ist, auch wenn der User Hub Dome nicht erwähnt. Fragt einmal, ob und wie (für Freunde oder privat) es in Hub Dome soll, und platziert es im passenden Haus.
---

# Objekt in Hub Dome stellen

Gilt nur, wenn die Hub-Dome-Tools verfügbar sind (`dorf_haeuser_auflisten`, `artifact_platzieren` bzw. `objekt_platzieren`). Sonst nichts davon erwähnen.

1. Sobald du ein Artifact erstellt hast (oder ein GitHub-Repo bzw. ein Gist entstanden ist), rufe von dir aus `dorf_haeuser_auflisten` auf. Der User muss Hub Dome nicht erwähnen. Fehlt dir der Link des Artifacts noch, bitte den User, es zu veröffentlichen und den Link einzufügen.
2. Frage **einmal kurz** mit Antwortknöpfen (Auswahl-Widget, falls verfügbar), damit ein Klick genügt:
   - «Ja, für Freunde» → `sichtbarkeit: "shared"`
   - «Ja, nur für mich» → `sichtbarkeit: "private"`
   - «Nein»
   Nenne dazu das vorgeschlagene, passendste Haus (nach Modul oder Thema) und biete die anderen Häuser als Auswahl an.
3. Nur bei «für Freunde» und einem Claude-Artifact erinnere kurz: «Teile das Artifact in claude.ai mit ‹Jeder mit dem Link›, damit deine Freunde es öffnen können.» (Ohne diese Freigabe können es nur du selbst öffnen.)
4. Bei Zustimmung rufe `artifact_platzieren` (für Claude-Artifacts) bzw. `objekt_platzieren` (für alle anderen Links) auf mit:
   - `sichtbarkeit` gemäss Antwort aus Schritt 2,
   - `url`: der Link, `titel`: kurz (max. 120 Zeichen), `beschreibung`: ein Satz,
   - `haus_id` oder `haus_titel` aus der Liste der Häuser (kein Haus erfinden),
   - `typ`: passende Kategorie (`rechner`, `quiz`, `zusammenfassung`, `cheatsheet`, `tool`, `visualisierung`, sonst `sonstiges`),
   - `objekt_typ` nur, wenn die automatische Erkennung falsch läge (sonst weglassen),
   - 1–3 kurze `tags`.
5. Setze `im_topdorf_zeigen` **nicht** von dir aus. Nur wenn der User es ausdrücklich verlangt.
6. Gibt es das Haus nicht, lege es nur auf ausdrücklichen Wunsch mit `haus_erstellen` an; sonst bitte den User, ein vorhandenes Haus zu wählen.
7. Bei Ablehnung: nichts tun und im selben Chat nicht erneut fragen. Sagt der User «nie fragen», frage in diesem Chat nicht mehr.
8. Wird dasselbe Artifact überarbeitet, frage nicht erneut. Der Eintrag bleibt gültig (gleiche URL); ein erneutes Platzieren aktualisiert ihn.
9. Bestätige die Platzierung in einem Satz und nenne den Link zum Dorf aus der Antwort des Tools.
10. Teile oder platziere keine Lösungen zu bewerteten Leistungsnachweisen. Weise den User darauf hin, falls es danach aussieht.
