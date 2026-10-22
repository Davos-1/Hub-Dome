-- Freundschaften statt Einladungslinks: Anfrage, die die andere Person annehmen muss.
-- Angenommen sehen sich beide gegenseitig die Dörfer (village_access wird von den Funktionen gepflegt).
-- Bestehende Einladungen und Freigaben aus dem alten System entfallen (nur Testdaten).

-- Altes System entfernen
drop function if exists accept_invite(text);
drop table if exists invites;
delete from village_access;
drop policy if exists village_access_delete on village_access;
-- Zugriffe ändern sich nur noch über die Funktionen unten (Freund entfernen, Anfrage annehmen)

-- ============ Tabelle ============

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles on delete cascade,
  addressee_id uuid not null references profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
-- Pro Paar höchstens eine Zeile, egal wer angefragt hat
create unique index friendships_pair_idx
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on friendships (addressee_id);

alter table friendships enable row level security;
-- Lesen nur die beiden Beteiligten; Schreiben ausschliesslich über die Funktionen
create policy friendships_select on friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
revoke all on friendships from anon;
revoke insert, update, delete on friendships from authenticated;

-- ============ Funktionen (security definer) ============

-- Gegenseitigen Zugriff auf die Dörfer herstellen
create function grant_mutual_access(p_a uuid, p_b uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into village_access (village_id, viewer_id)
    select v.id, p_b from villages v where v.owner_id = p_a
  on conflict do nothing;
  insert into village_access (village_id, viewer_id)
    select v.id, p_a from villages v where v.owner_id = p_b
  on conflict do nothing;
end;
$$;
revoke execute on function grant_mutual_access(uuid, uuid) from public, anon, authenticated;

-- Anfrage an einen Benutzernamen senden. Hat die andere Person bereits angefragt, wird sofort bestätigt.
create function send_friend_request(p_username text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_other uuid;
  v_f friendships%rowtype;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Nicht angemeldet.'; end if;
  select id into v_other from profiles
    where username = lower(trim(p_username)) and onboarded;
  if v_other is null then raise exception 'Diese Person gibt es nicht.'; end if;
  if v_other = v_uid then raise exception 'Du kannst dir nicht selbst eine Anfrage senden.'; end if;

  select * into v_f from friendships
    where least(requester_id, addressee_id) = least(v_uid, v_other)
      and greatest(requester_id, addressee_id) = greatest(v_uid, v_other);
  if found then
    if v_f.status = 'accepted' then raise exception 'Ihr seid bereits befreundet.'; end if;
    if v_f.requester_id = v_uid then raise exception 'Du hast diese Person bereits angefragt.'; end if;
    -- Die andere Person hatte schon angefragt: jetzt gegenseitig bestätigt
    update friendships set status = 'accepted', responded_at = now() where id = v_f.id;
    perform grant_mutual_access(v_uid, v_other);
    return v_f.id;
  end if;

  if (select count(*) from friendships where requester_id = v_uid and status = 'pending') >= 20 then
    raise exception 'Du hast schon viele offene Anfragen. Warte, bis sie beantwortet werden.';
  end if;
  insert into friendships (requester_id, addressee_id) values (v_uid, v_other) returning id into v_id;
  return v_id;
end;
$$;

-- Anfrage annehmen oder ablehnen (nur die angefragte Person)
create function respond_friend_request(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_f friendships%rowtype;
begin
  if v_uid is null then raise exception 'Nicht angemeldet.'; end if;
  select * into v_f from friendships
    where id = p_id and addressee_id = v_uid and status = 'pending' for update;
  if not found then raise exception 'Anfrage nicht gefunden.'; end if;
  if p_accept then
    update friendships set status = 'accepted', responded_at = now() where id = v_f.id;
    perform grant_mutual_access(v_f.requester_id, v_f.addressee_id);
  else
    delete from friendships where id = v_f.id;
  end if;
end;
$$;

-- Eigene offene Anfrage zurückziehen
create function cancel_friend_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from friendships
    where id = p_id and requester_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Anfrage nicht gefunden.'; end if;
end;
$$;

-- Freundschaft beenden: beide verlieren den Zugriff auf das Dorf der anderen Person
create function remove_friend(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Nicht angemeldet.'; end if;
  delete from friendships
    where least(requester_id, addressee_id) = least(v_uid, p_other)
      and greatest(requester_id, addressee_id) = greatest(v_uid, p_other);
  delete from village_access
    where (viewer_id = v_uid and village_id in (select id from villages where owner_id = p_other))
       or (viewer_id = p_other and village_id in (select id from villages where owner_id = v_uid));
end;
$$;

revoke execute on function
  send_friend_request(text), respond_friend_request(uuid, boolean),
  cancel_friend_request(uuid), remove_friend(uuid)
  from public, anon;
grant execute on function
  send_friend_request(text), respond_friend_request(uuid, boolean),
  cancel_friend_request(uuid), remove_friend(uuid)
  to authenticated;
