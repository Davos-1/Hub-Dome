-- Rate-Limit für den MCP-Connector: Aufrufe pro Token und Stunde. Nur der Server (Service Role) liest und schreibt.

create table mcp_rate (
  token_id uuid not null references mcp_tokens on delete cascade,
  hour timestamptz not null,
  calls int not null default 0,
  primary key (token_id, hour)
);

alter table mcp_rate enable row level security;
-- Keine Policies: Clients sehen und ändern nichts.
revoke all on mcp_rate from anon, authenticated;

-- Zählt einen Aufruf in der laufenden Stunde und gibt den neuen Stand zurück (atomar).
create function mcp_hit(p_token uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_calls int;
begin
  insert into mcp_rate (token_id, hour, calls)
  values (p_token, date_trunc('hour', now()), 1)
  on conflict (token_id, hour) do update set calls = mcp_rate.calls + 1
  returning calls into v_calls;
  -- alte Stunden gelegentlich wegräumen
  if random() < 0.02 then
    delete from mcp_rate where hour < now() - interval '2 days';
  end if;
  return v_calls;
end;
$$;

revoke execute on function mcp_hit(uuid) from public, anon, authenticated;
grant execute on function mcp_hit(uuid) to service_role;

-- Höchstens 5 aktive Connector-Tokens pro Person
create function mcp_tokens_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from mcp_tokens where user_id = new.user_id and revoked_at is null) >= 5 then
    raise exception 'Du hast schon 5 aktive Connector-Tokens. Widerrufe zuerst eines.';
  end if;
  return new;
end;
$$;
create trigger mcp_tokens_limit_trg before insert on mcp_tokens
  for each row execute function mcp_tokens_limit();
