-- Phase 3b: Objekttypen (PLAN-ERWEITERUNG.md). Tabelle bleibt `artifacts`, UI-Begriff «Objekte».

alter table artifacts
  add column item_type text not null default 'claude_artifact'
    check (item_type in ('claude_artifact','github_repo','gist','cloud_ordner','link','datei','paket')),
  add column meta jsonb not null default '{}'::jsonb,
  add column meta_refreshed_at timestamptz;

-- Bisherige URL-Prüfung (nur claude.ai) ersetzen. Der Constraint-Name wird nachgeschlagen
-- (Standardname wäre artifacts_url_check), damit die Migration unabhängig davon funktioniert.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.artifacts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%claude%'
      and conname <> 'artifacts_url_by_type'
  loop
    execute format('alter table public.artifacts drop constraint %I', c.conname);
  end loop;
end $$;

alter table artifacts add constraint artifacts_url_by_type check (
  url ~ '^https://' and (
    (item_type = 'claude_artifact' and url ~ '^https://claude\.ai/')
    or (item_type = 'github_repo' and url ~ '^https://github\.com/[^/]+/[^/]+/?$')
    or (item_type = 'gist' and url ~ '^https://gist\.github\.com/')
    or item_type in ('cloud_ordner','link')
    or item_type in ('datei','paket')   -- wird in Phase 8/9 präzisiert
  )
);

create index artifacts_item_type_idx on artifacts(item_type);
