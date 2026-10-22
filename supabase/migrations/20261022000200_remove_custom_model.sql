-- Eigene 3D-Modelle für die Zentrale entfallen (Missbrauchsrisiko). Der Speicher bleibt als leerer Behälter
-- ohne Zugriff bestehen: keine Policy, also kein Upload, kein Download.

drop policy if exists village_models_select on storage.objects;
drop policy if exists village_models_insert on storage.objects;
drop policy if exists village_models_update on storage.objects;
drop policy if exists village_models_delete on storage.objects;

-- Sicherheitshalber ausserdem keine Dateien mehr zulassen
update storage.buckets set file_size_limit = 1, allowed_mime_types = array['application/x-none']
  where id = 'village-models';

-- Dörfer mit eigenem Modell zeigen wieder das Rathaus
update villages set zentrale_style = 'rathaus', zentrale_model_meta = null
  where zentrale_style = 'custom';
