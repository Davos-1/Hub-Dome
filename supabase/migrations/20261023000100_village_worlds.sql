-- Phase 4f: Welt pro Dorf. Seed (Landschaft), Generator-Version und eigene Platzierungen (Quartiere,
-- Häuser, Deko, Varianten) liegen in einer Zeile pro Dorf (docs/PHASE-4F-KONZEPT.md Abschnitt 4).
-- Clients dürfen nur lesen (Besitzer und Freunde). Geschrieben wird ausschliesslich von Server Actions mit
-- Service Role, nach Zod- und Regelprüfung und mit owner_id-Filter: Über PostgREST direkt könnte ein Client
-- die Platzierungsregeln des Servers sonst umgehen und «komische» Welten speichern.

-- ============ Tabelle ============

create table village_worlds (
  village_id uuid primary key references villages on delete cascade,
  owner_id uuid not null references profiles on delete cascade,
  seed text not null check (seed ~ '^[a-z0-9]{8}$'),
  generator_version smallint not null default 1 check (generator_version between 1 and 999),
  placements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(placements) = 'object' and pg_column_size(placements) <= 65536),
  updated_at timestamptz not null default now()
);

-- ============ Row Level Security ============

alter table village_worlds enable row level security;
-- Lesen: alle, die das Dorf sehen (Besitzer und Freunde). Bewusst keine Insert/Update/Delete-Policy.
create policy village_worlds_select on village_worlds for select to authenticated
  using (can_view_village(village_id));
revoke all on village_worlds from anon, authenticated;
grant select on village_worlds to authenticated;

-- ============ Trigger: Besitzer und Zeitstempel ============

-- owner_id kommt immer aus dem Dorf, nie aus der Anfrage (auch nicht von der Service Role).
create function village_worlds_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from villages where id = new.village_id;
  if not found then raise exception 'Dorf nicht gefunden.'; end if;
  new.owner_id := v_owner;
  new.updated_at := now();
  return new;
end;
$$;
create trigger village_worlds_guard_trg before insert or update on village_worlds
  for each row execute function village_worlds_guard();

-- Jedes neue Dorf bekommt sofort seine Welt mit Zufalls-Seed.
create function villages_create_world() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into village_worlds (village_id, owner_id, seed)
  values (new.id, new.owner_id, substr(md5(gen_random_uuid()::text), 1, 8))
  on conflict do nothing;
  return new;
end;
$$;
create trigger villages_create_world_trg after insert on villages
  for each row execute function villages_create_world();

-- ============ Nachtrag für bestehende Dörfer ============

-- Wichtig: genau dieser Ersatz-Seed. Der Code verwendet denselben Ausdruck, solange die Migration fehlt;
-- so springt beim Einspielen keine Landschaft.
insert into village_worlds (village_id, owner_id, seed, generator_version)
select id, owner_id, substr(md5(id::text), 1, 8), 1 from villages
on conflict do nothing;
