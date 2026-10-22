-- Phase 5b: Übernehmen + Nutzungsdaten (PLAN-ERWEITERUNG-2.md Teil A).

-- ============ Herkunft und Erlaubnisse pro Objekt ============

alter table artifacts
  add column is_copy boolean not null default false,
  add column source_artifact_id uuid references artifacts(id) on delete set null,
  add column source_owner_id uuid references profiles(id) on delete set null,
  add column allow_copy boolean not null default true,     -- Besitzer erlaubt Übernehmen (gilt rückwirkend, Entscheid Gian)
  add column topdorf_ok boolean not null default false;    -- Besitzer erlaubt Topdorf (Opt-in)

alter table artifacts
  add constraint artifacts_copy_private check (not is_copy or visibility = 'private'),
  add constraint artifacts_copy_no_top  check (not is_copy or topdorf_ok = false),
  add constraint artifacts_top_shared   check (not topdorf_ok or visibility = 'shared'),
  add constraint artifacts_no_self_src  check (source_artifact_id is null or source_artifact_id <> id);

create index artifacts_source_idx on artifacts(source_artifact_id);
create index artifacts_topdorf_idx on artifacts(topdorf_ok) where topdorf_ok;

-- Herkunftsfelder schützen: nur copy_artifact (mit hubdome.copying = on) setzt sie.
create function artifacts_guard_copy() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Privat heisst auch: nicht im Topdorf
  if new.visibility = 'private' then new.topdorf_ok := false; end if;

  if tg_op = 'INSERT' then
    if coalesce(current_setting('hubdome.copying', true), '') <> 'on' then
      new.is_copy := false;
      new.source_artifact_id := null;
      new.source_owner_id := null;
    end if;
    return new;
  end if;

  -- Update: Herkunft bleibt; is_copy darf nur von true auf false wechseln
  -- (on delete set null der Quelle darf source_* leeren)
  if new.source_artifact_id is distinct from old.source_artifact_id and new.source_artifact_id is not null then
    new.source_artifact_id := old.source_artifact_id;
  end if;
  if new.source_owner_id is distinct from old.source_owner_id and new.source_owner_id is not null then
    new.source_owner_id := old.source_owner_id;
  end if;
  if new.is_copy and not old.is_copy then
    new.is_copy := false;
  end if;
  -- Eigene Version: neue URL macht aus der Übernahme ein Original («basiert auf»)
  if old.is_copy and new.url is distinct from old.url then
    new.is_copy := false;
  end if;
  return new;
end;
$$;

create trigger artifacts_guard_copy before insert or update on artifacts
  for each row execute function artifacts_guard_copy();

-- ============ Nutzungsereignisse ============

create table item_events (
  artifact_id uuid not null references artifacts on delete cascade,
  user_id     uuid not null references profiles  on delete cascade,
  event       text not null check (event in ('geoeffnet','uebernommen')),
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  primary key (artifact_id, user_id, event)
);
create index item_events_user_idx on item_events(user_id);
alter table item_events enable row level security;
-- Keine Policies: Zugriff nur über die security-definer-Funktionen unten.
revoke all on item_events from anon, authenticated;

-- ============ Sichtbarkeit ============

-- Darf der aktuelle User dieses Objekt sehen?
-- Besitzer, oder geteilt + befreundet, oder Topdorf-freigegebenes Original.
-- Hinweis: topdorf_ok heisst «für alle angemeldeten Hub-Dome-Nutzer sichtbar» (heute = Studiengang).
create function can_view_artifact(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from artifacts x
    where x.id = a and auth.uid() is not null and (
      x.owner_id = auth.uid()
      or (x.visibility = 'shared' and can_view_village(house_village(x.house_id)))
      or (x.topdorf_ok and x.visibility = 'shared' and not x.is_copy)
    )
  );
$$;
revoke execute on function can_view_artifact(uuid) from public, anon;
grant execute on function can_view_artifact(uuid) to authenticated;

drop policy artifacts_select on artifacts;
create policy artifacts_select on artifacts for select to authenticated
  using (owner_id = auth.uid()
         or (visibility = 'shared' and can_view_village(house_village(house_id)))
         or (topdorf_ok and visibility = 'shared' and not is_copy));

-- ============ Funktionen ============

-- Ereignis erfassen (eine Zeile pro Person, Objekt und Art). Eigene Objekte zählen nicht.
-- Öffnen über eine Übernahme zählt für die noch vorhandene Quelle.
create function record_item_event(p_artifact uuid, p_event text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_owner uuid;
  r artifacts%rowtype;
begin
  if v_uid is null or p_event not in ('geoeffnet','uebernommen') then return; end if;
  if not can_view_artifact(p_artifact) then return; end if;

  select * into r from artifacts where id = p_artifact;
  v_target := r.id;
  v_owner := r.owner_id;
  if r.is_copy and r.source_artifact_id is not null then
    select id, owner_id into v_target, v_owner from artifacts where id = r.source_artifact_id;
    if v_target is null then return; end if;
  end if;
  if v_owner = v_uid then return; end if;

  insert into item_events (artifact_id, user_id, event) values (v_target, v_uid, p_event)
  on conflict (artifact_id, user_id, event) do update set last_at = now();
end;
$$;

-- Objekt ins eigene Dorf übernehmen. Fehlercodes werden in der Oberfläche übersetzt.
create function copy_artifact(p_source uuid, p_house uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s artifacts%rowtype;
  v_id uuid;
begin
  if v_uid is null then raise exception 'nicht_angemeldet'; end if;
  select * into s from artifacts where id = p_source;
  if not found or s.is_copy or not can_view_artifact(p_source) then raise exception 'nicht_gefunden'; end if;
  if s.owner_id = v_uid then raise exception 'eigenes_objekt'; end if;
  if not s.allow_copy then raise exception 'nicht_erlaubt'; end if;
  if p_house is null or not is_village_owner(house_village(p_house)) then raise exception 'haus_ungueltig'; end if;
  if exists (select 1 from artifacts where owner_id = v_uid and url = s.url) then
    raise exception 'bereits_vorhanden';
  end if;

  perform set_config('hubdome.copying', 'on', true);
  insert into artifacts (house_id, owner_id, url, title, description, kind, item_type, meta, tags,
                         visibility, is_copy, source_artifact_id, source_owner_id, allow_copy, topdorf_ok)
  values (p_house, v_uid, s.url, s.title, s.description, s.kind, s.item_type, s.meta, s.tags,
          'private', true, s.id, s.owner_id, false, false)
  returning id into v_id;
  perform set_config('hubdome.copying', 'off', true);

  insert into item_events (artifact_id, user_id, event) values (s.id, v_uid, 'uebernommen')
  on conflict (artifact_id, user_id, event) do update set last_at = now();
  return v_id;
end;
$$;

-- Nur Zahlen, nur für eigene Objekte (wer geöffnet hat, wird nie angezeigt).
create function item_stats(p_ids uuid[])
returns table (artifact_id uuid, geoeffnet int, uebernommen int)
language sql stable security definer set search_path = public as $$
  select a.id,
         count(*) filter (where e.event = 'geoeffnet')::int,
         count(*) filter (where e.event = 'uebernommen')::int
  from artifacts a
  left join item_events e on e.artifact_id = a.id
  where a.id = any(p_ids) and a.owner_id = auth.uid()
  group by a.id;
$$;

-- Alle eigenen geteilten Originale fürs Topdorf freigeben bzw. zurückziehen.
create function set_topdorf_all(p_on boolean) returns int
language sql security invoker set search_path = public as $$
  with u as (
    update artifacts set topdorf_ok = p_on
    where owner_id = auth.uid() and visibility = 'shared' and not is_copy and topdorf_ok <> p_on
    returning 1
  )
  select count(*)::int from u;
$$;

revoke execute on function record_item_event(uuid, text), copy_artifact(uuid, uuid),
  item_stats(uuid[]), set_topdorf_all(boolean) from public, anon;
grant execute on function record_item_event(uuid, text), copy_artifact(uuid, uuid),
  item_stats(uuid[]), set_topdorf_all(boolean) to authenticated;
