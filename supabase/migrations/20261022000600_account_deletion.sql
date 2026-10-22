-- Phase 6: Konto löschen mit einem Tag Wartefrist (Entscheid Gian). Wer sich innerhalb der Frist wieder
-- anmeldet, bricht die Löschung ab. Ein täglicher Cron (/api/cron/konto-loeschen) löscht danach den
-- Auth-User; alle Daten hängen per on delete cascade daran.

create table account_deletions (
  user_id uuid primary key references profiles on delete cascade,
  requested_at timestamptz not null default now()
);
alter table account_deletions enable row level security;
create policy account_deletions_select on account_deletions for select to authenticated
  using (user_id = auth.uid());
-- Kein Insert/Update/Delete für Clients: nur über die Funktionen unten.
revoke insert, update, delete on account_deletions from anon, authenticated;

create function request_account_deletion() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  insert into account_deletions (user_id) values (auth.uid())
  on conflict (user_id) do update set requested_at = account_deletions.requested_at
  returning requested_at into v_at;
  -- Connector-Tokens sofort widerrufen
  update mcp_tokens set revoked_at = now() where user_id = auth.uid() and revoked_at is null;
  return v_at;
end;
$$;

-- Gibt true zurück, wenn eine laufende Löschung abgebrochen wurde.
create function cancel_account_deletion() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from account_deletions where user_id = auth.uid();
  return found;
end;
$$;

revoke execute on function request_account_deletion(), cancel_account_deletion() from public, anon;
grant execute on function request_account_deletion(), cancel_account_deletion() to authenticated;
