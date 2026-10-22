-- Freundschaftslink: ersetzt den früheren Einladungslink. Wer ihn erzeugt, stimmt damit der Freundschaft zu;
-- die andere Person muss ihn nur noch annehmen (Entscheid Gian, 2026-10-22). Token nur als Hash gespeichert.

create table friend_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  max_uses int not null default 1 check (max_uses between 1 and 100),
  uses int not null default 0,
  created_at timestamptz not null default now(),
  check (uses >= 0)
);
create index friend_links_owner_idx on friend_links (owner_id);

alter table friend_links enable row level security;
-- Der Besitzer sieht, erzeugt und widerruft seine Links; Annehmen läuft nur über die Funktionen unten.
create policy friend_links_select on friend_links for select to authenticated
  using (owner_id = auth.uid());
create policy friend_links_insert on friend_links for insert to authenticated
  with check (
    owner_id = auth.uid()
    and uses = 0
    and expires_at <= now() + interval '8 days'
  );
create policy friend_links_delete on friend_links for delete to authenticated
  using (owner_id = auth.uid());
revoke all on friend_links from anon;
revoke update on friend_links from authenticated;

-- Wer hat den Link erzeugt, und ist er noch gültig? (für den Dialog vor dem Annehmen; verbraucht nichts)
create function friend_link_info(p_token text)
returns table (username text, display_name text, state text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_link friend_links%rowtype;
  v_state text := 'ok';
begin
  if v_uid is null then raise exception 'Nicht angemeldet.'; end if;
  select * into v_link from friend_links
    where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found then
    return query select null::text, null::text, 'ungueltig'::text;
    return;
  end if;
  if v_link.owner_id = v_uid then v_state := 'selbst';
  elsif exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(v_uid, v_link.owner_id)
      and greatest(f.requester_id, f.addressee_id) = greatest(v_uid, v_link.owner_id)
  ) then v_state := 'befreundet';
  elsif v_link.expires_at < now() then v_state := 'abgelaufen';
  elsif v_link.uses >= v_link.max_uses then v_state := 'aufgebraucht';
  end if;
  return query
    select p.username, p.display_name, v_state from profiles p where p.id = v_link.owner_id;
end;
$$;

-- Link annehmen: gegenseitige Freundschaft mit der Person, die ihn erzeugt hat. Gibt deren Benutzernamen zurück.
create function accept_friend_link(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_link friend_links%rowtype;
  v_f friendships%rowtype;
  v_username text;
begin
  if v_uid is null then raise exception 'Nicht angemeldet.'; end if;
  select * into v_link from friend_links
    where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') for update;
  if not found then raise exception 'Der Freundschaftslink ist ungültig.'; end if;
  if v_link.owner_id = v_uid then
    raise exception 'Das ist dein eigener Freundschaftslink.';
  end if;
  select username into v_username from profiles where id = v_link.owner_id;

  select * into v_f from friendships
    where least(requester_id, addressee_id) = least(v_uid, v_link.owner_id)
      and greatest(requester_id, addressee_id) = greatest(v_uid, v_link.owner_id);
  if found and v_f.status = 'accepted' then
    return v_username; -- schon befreundet: nichts verbrauchen
  end if;

  if v_link.expires_at < now() then raise exception 'Der Freundschaftslink ist abgelaufen.'; end if;
  if v_link.uses >= v_link.max_uses then
    raise exception 'Der Freundschaftslink wurde bereits aufgebraucht.';
  end if;

  if found then
    update friendships set status = 'accepted', responded_at = now() where id = v_f.id;
  else
    insert into friendships (requester_id, addressee_id, status, responded_at)
      values (v_link.owner_id, v_uid, 'accepted', now());
  end if;
  perform grant_mutual_access(v_uid, v_link.owner_id);
  update friend_links set uses = uses + 1 where id = v_link.id;
  return v_username;
end;
$$;

revoke execute on function friend_link_info(text), accept_friend_link(text) from public, anon;
grant execute on function friend_link_info(text), accept_friend_link(text) to authenticated;
