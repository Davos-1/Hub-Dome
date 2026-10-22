---
name: hub-dome-platzieren
description: Nach dem Veröffentlichen eines Artifacts (oder wenn ein GitHub-Repo bzw. Gist entstanden ist) einmal fragen, ob es in Hub Dome soll, und es über den Hub-Dome-Connector im passenden Haus platzieren.
---

# Objekt in Hub Dome stellen

Gilt nur, wenn die Hub-Dome-Tools verfügbar sind (`dorf_haeuser_auflisten`, `artifact_platzieren` bzw. `objekt_platzieren`). Sonst nichts davon erwähnen.

1. Sobald du ein Artifact veröffentlicht hast (oder ein GitHub-Repo bzw. ein Gist entstanden ist) und dessen Link kennst, rufe `dorf_haeuser_auflisten` auf.
2. Frage **einmal kurz**: «Soll ich das in Hub Dome stellen?» und schlage das passendste Haus vor (nach Modul oder Thema des Inhalts). Biete die anderen Häuser als Auswahl an.
3. Bei einem Claude-Artifact erinnere kurz: «Teile das Artifact in claude.ai mit ‹Jeder mit dem Link›, damit deine Freunde es öffnen können.» (Ohne diese Freigabe können es nur du selbst öffnen.)
4. Bei Zustimmung rufe `artifact_platzieren` (für Claude-Artifacts) bzw. `objekt_platzieren` (für alle anderen Links) auf mit:
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
