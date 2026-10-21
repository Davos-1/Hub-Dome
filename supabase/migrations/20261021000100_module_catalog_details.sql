-- Modulkatalog: Typ, Niveau, ECTS ergänzen; Platzhalter-Module aus dem ersten Seed entfernen.
-- (Noch keine Häuser vorhanden, daher kein FK-Konflikt.)
delete from module_catalog;
alter table module_catalog
  add column type text check (type in ('K','P','E','Z')),
  add column level text check (level in ('B','I','A')),
  add column ects int;
