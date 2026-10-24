-- Phase 4h: Tageszeit pro Person. «auto» folgt der Uhrzeit in Zürich, «fest» behält die Wahl aus der Leiste.
alter table profiles add column time_mode text not null default 'auto'
  check (time_mode in ('auto', 'fest'));

-- Clients ändern nur Anzeigename, Avatar und neu den Tageszeit-Modus (Column-Grant wie bisher;
-- Benutzername und Onboarding bleiben gesperrt). Die Policy profiles_update erlaubt nur das eigene Profil.
grant update (time_mode) on profiles to authenticated;
