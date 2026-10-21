-- Semester pro Haus (optional, vom Besitzer editierbar). RLS: bestehende Policies der Tabelle houses gelten.
alter table houses add column semester smallint null check (semester between 1 and 12);
