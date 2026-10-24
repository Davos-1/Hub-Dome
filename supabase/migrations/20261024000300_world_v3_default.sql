-- Phase 4h: Neue Dörfer starten auf Generator v3 (Wegformen je Quartier, Eckpunkte in Stichwegen, Bäume an
-- festen Plätzen aus dem Seed). Bestehende Dörfer bleiben auf ihrer Version, bis der Besitzer in den
-- Einstellungen aktualisiert oder neu würfelt. Ohne diese Migration starten neue Dörfer auf v2 (bzw. v1)
-- und können ebenfalls aktualisiert werden. Die neuen Felder liegen im bestehenden jsonb `placements`.
alter table village_worlds alter column generator_version set default 3;
