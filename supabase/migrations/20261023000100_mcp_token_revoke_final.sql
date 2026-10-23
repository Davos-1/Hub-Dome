-- Review 2026-10-23: Ein widerrufenes Connector-Token bleibt widerrufen.
-- Die Policy `mcp_tokens_all` erlaubt Updates auf eigene Tokens. Ohne diese Sperre könnte ein User
-- `revoked_at` wieder auf null setzen und so den Widerruf aus `request_account_deletion` (oder das
-- Limit von 5 aktiven Tokens) umgehen. Ebenso bleiben Besitzer und Hash nach dem Anlegen fest.

create function mcp_tokens_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'Ein widerrufenes Token kann nicht wieder aktiviert werden.';
  end if;
  if new.user_id <> old.user_id or new.token_hash <> old.token_hash then
    raise exception 'Besitzer und Token können nicht geändert werden.';
  end if;
  return new;
end;
$$;

create trigger mcp_tokens_guard_trg before update on mcp_tokens
  for each row execute function mcp_tokens_guard();
