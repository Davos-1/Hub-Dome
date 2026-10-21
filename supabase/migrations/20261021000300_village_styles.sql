-- Phase 4b: Stile pro Dorf (Häuser, Zentrale) und privater Speicher für eigene 3D-Modelle (GLB).
-- Siehe docs/PLAN-4B-GESTALTUNG.md.

alter table villages
  add column house_style text not null default 'haus'
    check (house_style in ('haus','blockhuette','marskuppel','werkstatt','tinyhaus','baumhaus')),
  add column zentrale_style text not null default 'rathaus'
    check (zentrale_style in ('rathaus','schule','hochhaus','villa','marskuppel','leuchtturm','custom')),
  -- Angaben zum hochgeladenen Modell (null = keins): bytes, triangles, uploaded_at
  add column zentrale_model_meta jsonb;

-- Sicheres Umwandeln von Text in uuid (null statt Fehler), für Storage-Policies
create function safe_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

-- Privater Bucket: nur .glb, max. 5 MB. Pfad: <village_id>/zentrale.glb
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('village-models', 'village-models', false, 5242880, array['model/gltf-binary', 'application/octet-stream'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lesen: Besitzer und freigegebene Viewer des Dorfs
create policy village_models_select on storage.objects for select to authenticated
  using (bucket_id = 'village-models' and can_view_village(safe_uuid((storage.foldername(name))[1])));

-- Schreiben/Ersetzen/Löschen: nur der Besitzer, nur genau dieser Dateiname
create policy village_models_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'village-models'
    and is_village_owner(safe_uuid((storage.foldername(name))[1]))
    and storage.filename(name) = 'zentrale.glb'
  );
create policy village_models_update on storage.objects for update to authenticated
  using (bucket_id = 'village-models' and is_village_owner(safe_uuid((storage.foldername(name))[1])))
  with check (
    bucket_id = 'village-models'
    and is_village_owner(safe_uuid((storage.foldername(name))[1]))
    and storage.filename(name) = 'zentrale.glb'
  );
create policy village_models_delete on storage.objects for delete to authenticated
  using (bucket_id = 'village-models' and is_village_owner(safe_uuid((storage.foldername(name))[1])));
