-- Phase 4g: Neue Dörfer starten auf Generator v2 (vielfältigere Landschaft, Fluss im Dorf, freie Hausplätze).
-- Bestehende Dörfer bleiben auf ihrer Version (v1), bis der Besitzer neu würfelt oder aktualisiert.
-- Ohne diese Migration starten neue Dörfer auf v1 und können in den Einstellungen aktualisiert werden.
alter table village_worlds alter column generator_version set default 2;
