-- Hub Dome: Schema, Row Level Security, Funktionen, Trigger (PLAN.md Abschnitt 5)

-- ============ Tabellen ============

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_-]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_seed text not null default gen_random_uuid()::text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table villages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique not null references profiles on delete cascade,
  name text not null,
  theme text not null default 'standard',
  created_at timestamptz not null default now()
);

create table module_catalog (
  code text primary key,
  title text not null,
  semester int
);

create table houses (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages on delete cascade,
  kind text not null check (kind in ('zentrale','modul','thema')),
  title text not null check (char_length(title) between 1 and 80),
  module_code text references module_catalog,
  color text not null default '#8fb3ff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position_index int not null default 0,
  created_at timestamptz not null default now()
);
create unique index one_zentrale_per_village on houses(village_id) where kind = 'zentrale';
create index houses_village_idx on houses(village_id);

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references houses on delete cascade,
  owner_id uuid not null references profiles on delete cascade,
  url text not null check (url ~ '^https://claude\.ai/'),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  kind text not null default 'sonstiges'
    check (kind in ('rechner','quiz','zusammenfassung','cheatsheet','tool','visualisierung','sonstiges')),
  tags text[] not null default '{}',
  visibility text not null default 'shared' check (visibility in ('shared','private')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, url)
);
create index artifacts_house_idx on artifacts(house_id);

create table village_access (
  village_id uuid references villages on delete cascade,
  viewer_id uuid references profiles on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (village_id, viewer_id)
);
create index village_access_viewer_idx on village_access(viewer_id);

create table invites (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  max_uses int not null default 1 check (max_uses >= 1),
  uses int not null default 0,
  created_at timestamptz not null default now()
);

create table mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  token_hash text unique not null,
  label text not null default 'Claude',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index mcp_tokens_user_idx on mcp_tokens(user_id);

-- ============ Hilfsfunktionen (security definer, vermeiden RLS-Rekursion) ============

create function is_village_owner(v uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from villages where id = v and owner_id = auth.uid());
$$;

create function can_view_village(v uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from villages where id = v and owner_id = auth.uid())
      or exists (select 1 from village_access where village_id = v and viewer_id = auth.uid());
$$;

create function house_village(h uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select village_id from houses where id = h;
$$;

revoke execute on function is_village_owner(uuid), can_view_village(uuid), house_village(uuid) from public, anon;
grant execute on function is_village_owner(uuid), can_view_village(uuid), house_village(uuid) to authenticated;

-- ============ Trigger: Profil-Platzhalter bei neuem Auth-User ============

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, display_name)
  values (
    new.id,
    'u_' || substr(replace(new.id::text, '-', ''), 1, 12),
    left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'Neu'), 60)
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ============ Onboarding: Benutzername setzen, Dorf und Zentrale anlegen ============

create function complete_onboarding(p_username text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(p_display_name);
  v_village uuid;
begin
  if v_uid is null then raise exception 'Nicht angemeldet.'; end if;
  if p_username !~ '^[a-z0-9_-]{3,24}$' then
    raise exception 'Ungültiger Benutzername (3–24 Zeichen: a–z, 0–9, _ und -).';
  end if;
  if char_length(v_name) not between 1 and 60 then
    raise exception 'Der Anzeigename muss 1–60 Zeichen lang sein.';
  end if;

  begin
    update profiles set username = p_username, display_name = v_name, onboarded = true
    where id = v_uid;
  exception when unique_violation then
    raise exception 'Dieser Benutzername ist bereits vergeben.';
  end;

  insert into villages (owner_id, name) values (v_uid, 'Dorf von ' || v_name)
  on conflict (owner_id) do nothing;
  select id into v_village from villages where owner_id = v_uid;

  insert into houses (village_id, kind, title)
  values (v_village, 'zentrale', 'Zentrale')
  on conflict (village_id) where kind = 'zentrale' do nothing;

  return v_village;
end;
$$;

revoke execute on function complete_onboarding(text, text) from public, anon;
grant execute on function complete_onboarding(text, text) to authenticated;

-- ============ Einladung annehmen ============
-- Das Token ist 256 Bit zufällig, daher genügt SHA-256 ohne Pepper (siehe docs/ENTSCHEIDUNGEN.md).

create function accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_hash text := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  v_inv invites%rowtype;
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Nicht angemeldet.'; end if;

  select * into v_inv from invites where token_hash = v_hash for update;
  if not found then raise exception 'Einladung ungültig.'; end if;
  if v_inv.expires_at < now() then raise exception 'Einladung abgelaufen.'; end if;

  select owner_id into v_owner from villages where id = v_inv.village_id;
  if v_owner = v_uid then raise exception 'Du kannst dich nicht selbst einladen.'; end if;

  if exists (select 1 from village_access where village_id = v_inv.village_id and viewer_id = v_uid) then
    return v_inv.village_id;
  end if;

  if v_inv.uses >= v_inv.max_uses then raise exception 'Einladung bereits aufgebraucht.'; end if;

  insert into village_access (village_id, viewer_id) values (v_inv.village_id, v_uid);
  update invites set uses = uses + 1 where id = v_inv.id;
  return v_inv.village_id;
end;
$$;

revoke execute on function accept_invite(text) from public, anon;
grant execute on function accept_invite(text) to authenticated;

-- ============ Row Level Security ============

alter table profiles enable row level security;
alter table villages enable row level security;
alter table module_catalog enable row level security;
alter table houses enable row level security;
alter table artifacts enable row level security;
alter table village_access enable row level security;
alter table invites enable row level security;
alter table mcp_tokens enable row level security;

-- profiles: lesen alle Eingeloggten; ändern nur eigene, nur Anzeigename und Avatar
create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated, anon;
grant update (display_name, avatar_seed) on profiles to authenticated;

-- module_catalog: nur lesen (Pflege durch Admin über SQL)
create policy module_catalog_select on module_catalog for select to authenticated using (true);

-- villages (Anlegen/Löschen nur über complete_onboarding bzw. Konto-Löschung)
create policy villages_select on villages for select to authenticated using (can_view_village(id));
create policy villages_update on villages for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- houses
create policy houses_select on houses for select to authenticated using (can_view_village(village_id));
create policy houses_insert on houses for insert to authenticated
  with check (is_village_owner(village_id) and kind <> 'zentrale');
create policy houses_update on houses for update to authenticated
  using (is_village_owner(village_id)) with check (is_village_owner(village_id));
create policy houses_delete on houses for delete to authenticated
  using (is_village_owner(village_id) and kind <> 'zentrale');

-- artifacts
create policy artifacts_select on artifacts for select to authenticated
  using (owner_id = auth.uid()
         or (visibility = 'shared' and can_view_village(house_village(house_id))));
create policy artifacts_insert on artifacts for insert to authenticated
  with check (owner_id = auth.uid() and is_village_owner(house_village(house_id)));
create policy artifacts_update on artifacts for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and is_village_owner(house_village(house_id)));
create policy artifacts_delete on artifacts for delete to authenticated using (owner_id = auth.uid());

-- village_access: kein Insert (nur accept_invite)
create policy village_access_select on village_access for select to authenticated
  using (viewer_id = auth.uid() or is_village_owner(village_id));
create policy village_access_delete on village_access for delete to authenticated
  using (viewer_id = auth.uid() or is_village_owner(village_id));

-- invites
create policy invites_all on invites for all to authenticated
  using (is_village_owner(village_id)) with check (is_village_owner(village_id));

-- mcp_tokens
create policy mcp_tokens_all on mcp_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Anon darf nichts
revoke all on all tables in schema public from anon;
